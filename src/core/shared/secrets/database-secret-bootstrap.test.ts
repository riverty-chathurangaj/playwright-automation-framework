import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import * as path from 'path';
import { afterEach, describe, it } from 'node:test';
import { config } from '@shared-core/config';
import {
  bootstrapDatabaseSecrets,
  type DatabaseSecretBootstrapResult,
} from '@shared-core/secrets/database-secret-bootstrap';
import type { VaultClientLike } from '@shared-core/secrets/vault-client';

type LoggerCall = string;

function createTestLogger() {
  const calls: LoggerCall[] = [];

  return {
    logger: {
      info: (...args: unknown[]) => {
        calls.push(formatLogCall(args));
      },
      warn: (...args: unknown[]) => {
        calls.push(formatLogCall(args));
      },
    },
    calls,
  };
}

function formatLogCall(args: unknown[]): string {
  return args.map((arg) => (typeof arg === 'string' ? arg : JSON.stringify(arg))).join(' ');
}

function assertNoSecretsInLogs(calls: LoggerCall[], secrets: string[]): void {
  const combined = calls.join('\n');

  secrets.forEach((secret) => {
    assert.equal(combined.includes(secret), false, `Expected logs to exclude secret value "${secret}".`);
  });
}

const originalEnv = {
  DB_USER: process.env.DB_USER,
  DB_PASSWORD: process.env.DB_PASSWORD,
};

const originalDatabaseConfig = {
  user: config.database.user,
  password: config.database.password,
  secretSource: config.database.secretSource,
  authType: config.database.authType,
};

const originalVaultConfig = {
  addr: config.vault.addr,
  authPath: config.vault.authPath,
  roleId: config.vault.roleId,
  secretId: config.vault.secretId,
  namespace: config.vault.namespace,
  dbSecretPath: config.vault.dbSecretPath,
  dbUsernameField: config.vault.dbUsernameField,
  dbPasswordField: config.vault.dbPasswordField,
  timeout: config.vault.timeout,
};

let tempDirs: string[] = [];

afterEach(() => {
  restoreEnvValue('DB_USER', originalEnv.DB_USER);
  restoreEnvValue('DB_PASSWORD', originalEnv.DB_PASSWORD);

  config.database.user = originalDatabaseConfig.user;
  config.database.password = originalDatabaseConfig.password;
  config.database.secretSource = originalDatabaseConfig.secretSource;
  config.database.authType = originalDatabaseConfig.authType;

  config.vault.addr = originalVaultConfig.addr;
  config.vault.authPath = originalVaultConfig.authPath;
  config.vault.roleId = originalVaultConfig.roleId;
  config.vault.secretId = originalVaultConfig.secretId;
  config.vault.namespace = originalVaultConfig.namespace;
  config.vault.dbSecretPath = originalVaultConfig.dbSecretPath;
  config.vault.dbUsernameField = originalVaultConfig.dbUsernameField;
  config.vault.dbPasswordField = originalVaultConfig.dbPasswordField;
  config.vault.timeout = originalVaultConfig.timeout;

  tempDirs.forEach((dir) => rmSync(dir, { recursive: true, force: true }));
  tempDirs = [];
});

describe('bootstrapDatabaseSecrets', () => {
  it('prefers mounted secret files over vault and env in auto mode', async () => {
    config.database.secretSource = 'auto';
    process.env.DB_USER = 'env-user';
    process.env.DB_PASSWORD = 'env-password';

    const filesDir = createDatabaseSecretsDir('file-user', 'file-password');
    let vaultCalled = false;
    const { logger, calls } = createTestLogger();

    const result = await bootstrapDatabaseSecrets({
      filesDir,
      vaultClient: {
        async loginAppRole() {
          vaultCalled = true;
          return 'token';
        },
        async readSecret() {
          return {};
        },
      },
      loggerInstance: logger,
    });

    assertBootstrapResult(result, 'files');
    assert.equal(vaultCalled, false);
    assert.equal(process.env.DB_USER, 'file-user');
    assert.equal(process.env.DB_PASSWORD, 'file-password');
    assert.equal(config.database.user, 'file-user');
    assert.equal(config.database.password, 'file-password');
    assertNoSecretsInLogs(calls, ['file-user', 'file-password', 'env-user', 'env-password']);
  });

  it('reads vault credentials using the configured auth path, secret path, and selectors', async () => {
    config.database.secretSource = 'vault';
    config.vault.addr = 'https://vault.example';
    config.vault.authPath = 'auth/finance/approle/login';
    config.vault.roleId = 'role-id';
    config.vault.secretId = 'secret-id';
    config.vault.dbSecretPath = 'database/creds/general-ledger-app-role';
    config.vault.dbUsernameField = 'data.data.username';
    config.vault.dbPasswordField = 'data.data.password';

    const { logger, calls } = createTestLogger();
    const seen: { authPath?: string; secretPath?: string; roleId?: string; secretId?: string } = {};

    const vaultClient: VaultClientLike = {
      async loginAppRole(authPath, roleId, secretId) {
        seen.authPath = authPath;
        seen.roleId = roleId;
        seen.secretId = secretId;
        return 'vault-token';
      },
      async readSecret(_token, secretPath) {
        seen.secretPath = secretPath;
        return {
          data: {
            data: {
              username: 'vault-user',
              password: 'vault-password',
            },
          },
        };
      },
    };

    const result = await bootstrapDatabaseSecrets({
      filesDir: createEmptyTempDir(),
      vaultClient,
      loggerInstance: logger,
    });

    assertBootstrapResult(result, 'vault');
    assert.deepEqual(seen, {
      authPath: 'auth/finance/approle/login',
      roleId: 'role-id',
      secretId: 'secret-id',
      secretPath: 'database/creds/general-ledger-app-role',
    });
    assert.equal(process.env.DB_USER, 'vault-user');
    assert.equal(process.env.DB_PASSWORD, 'vault-password');
    assert.equal(config.database.user, 'vault-user');
    assert.equal(config.database.password, 'vault-password');
    assertNoSecretsInLogs(calls, ['vault-user', 'vault-password', 'vault-token', 'role-id', 'secret-id']);
  });

  it('uses existing environment credentials when env mode is selected', async () => {
    config.database.secretSource = 'env';
    process.env.DB_USER = 'env-mode-user';
    process.env.DB_PASSWORD = 'env-mode-password';

    const result = await bootstrapDatabaseSecrets({
      loggerInstance: createTestLogger().logger,
    });

    assertBootstrapResult(result, 'env');
    assert.equal(config.database.user, 'env-mode-user');
    assert.equal(config.database.password, 'env-mode-password');
  });

  it('fails fast when the configured vault field is missing', async () => {
    config.database.secretSource = 'vault';
    config.vault.addr = 'https://vault.example';
    config.vault.roleId = 'role-id';
    config.vault.secretId = 'secret-id';
    config.vault.dbSecretPath = 'database/creds/general-ledger-app-role';
    config.vault.dbUsernameField = 'data.username';
    config.vault.dbPasswordField = 'data.password';

    await assert.rejects(
      () =>
        bootstrapDatabaseSecrets({
          filesDir: createEmptyTempDir(),
          vaultClient: {
            async loginAppRole() {
              return 'vault-token';
            },
            async readSecret() {
              return {
                data: {
                  username: 'vault-user',
                },
              };
            },
          },
          loggerInstance: createTestLogger().logger,
        }),
      /Vault secret field "data\.password" was not found/,
    );
  });

  it('fails fast when the vault client returns an error', async () => {
    config.database.secretSource = 'vault';
    config.vault.addr = 'https://vault.example';
    config.vault.roleId = 'role-id';
    config.vault.secretId = 'secret-id';
    config.vault.dbSecretPath = 'database/creds/general-ledger-app-role';

    await assert.rejects(
      () =>
        bootstrapDatabaseSecrets({
          filesDir: createEmptyTempDir(),
          vaultClient: {
            async loginAppRole() {
              throw new Error('Vault request timed out');
            },
            async readSecret() {
              return {};
            },
          },
          loggerInstance: createTestLogger().logger,
        }),
      /Vault request timed out/,
    );
  });
});

function createDatabaseSecretsDir(user: string, password: string): string {
  const dir = createEmptyTempDir();
  writeFileSync(path.join(dir, 'MsSql__UserId'), user);
  writeFileSync(path.join(dir, 'MsSql__Password'), password);
  return dir;
}

function createEmptyTempDir(): string {
  const dir = mkdtempSync(path.join(tmpdir(), 'vault-db-bootstrap-'));
  mkdirSync(dir, { recursive: true });
  tempDirs.push(dir);
  return dir;
}

function assertBootstrapResult(result: DatabaseSecretBootstrapResult, source: 'files' | 'vault' | 'env'): void {
  assert.equal(result.applied, true);
  assert.equal(result.skipped, false);
  assert.equal(result.source, source);
}

function restoreEnvValue(name: 'DB_USER' | 'DB_PASSWORD', value: string | undefined): void {
  if (value === undefined) {
    delete process.env[name];
    return;
  }

  process.env[name] = value;
}
