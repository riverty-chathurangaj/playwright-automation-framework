import * as fs from 'fs';
import { readFile } from 'fs/promises';
import * as path from 'path';
import { config, type VaultConfig } from '@shared-core/config';
import { logger } from '@shared-core/logger';
import { VaultClient, type VaultClientLike } from './vault-client';

interface BootstrapLogger {
  info: (...args: unknown[]) => unknown;
  warn: (...args: unknown[]) => unknown;
}

export type DatabaseCredentialSource = 'files' | 'vault' | 'env';

export interface DatabaseCredentials {
  user: string;
  password: string;
  source: DatabaseCredentialSource;
}

export interface DatabaseSecretBootstrapResult {
  applied: boolean;
  skipped: boolean;
  source?: DatabaseCredentialSource;
  reason?: string;
}

export interface DatabaseSecretBootstrapOptions {
  filesDir?: string;
  vaultClient?: VaultClientLike;
  loggerInstance?: BootstrapLogger;
}

const DEFAULT_FILES_DIR = path.resolve(path.sep, 'secrets', 'database');
const USERNAME_FILE = 'MsSql__UserId';
const PASSWORD_FILE = 'MsSql__Password';

export async function bootstrapDatabaseSecrets(
  options: DatabaseSecretBootstrapOptions = {},
): Promise<DatabaseSecretBootstrapResult> {
  const log = options.loggerInstance ?? logger;

  if (config.database.authType === 'azure-active-directory-default') {
    log.info('Skipping database secret bootstrap for Azure AD passwordless authentication.');
    return {
      applied: false,
      skipped: true,
      reason: 'azure-active-directory-default',
    };
  }

  const credentials = await resolveDatabaseCredentials(options);
  if (!credentials) {
    log.info('Database secret bootstrap did not change credentials.', {
      secretSource: config.database.secretSource,
    });
    return {
      applied: false,
      skipped: true,
      reason: 'no-credentials-resolved',
    };
  }

  applyDatabaseCredentials(credentials);

  log.info('Database credentials resolved for test run.', {
    source: credentials.source,
    host: config.database.host,
    database: config.database.name,
  });

  return {
    applied: true,
    skipped: false,
    source: credentials.source,
  };
}

export async function resolveDatabaseCredentials(
  options: DatabaseSecretBootstrapOptions = {},
): Promise<DatabaseCredentials | null> {
  const source = config.database.secretSource;

  switch (source) {
    case 'files':
      return readDatabaseCredentialsFromFiles(options.filesDir ?? DEFAULT_FILES_DIR, true);
    case 'vault':
      return readDatabaseCredentialsFromVault(options.vaultClient, true);
    case 'env':
      return readDatabaseCredentialsFromEnv(true);
    case 'auto': {
      const fileCredentials = await readDatabaseCredentialsFromFiles(options.filesDir ?? DEFAULT_FILES_DIR, false);
      if (fileCredentials) {
        return fileCredentials;
      }

      const vaultCredentials = await readDatabaseCredentialsFromVault(options.vaultClient, false);
      if (vaultCredentials) {
        return vaultCredentials;
      }

      return readDatabaseCredentialsFromEnv(false);
    }
  }

  return null;
}

export async function readDatabaseCredentialsFromFiles(
  filesDir: string,
  strict: boolean,
): Promise<DatabaseCredentials | null> {
  const userPath = path.join(filesDir, USERNAME_FILE);
  const passwordPath = path.join(filesDir, PASSWORD_FILE);
  const userExists = fs.existsSync(userPath);
  const passwordExists = fs.existsSync(passwordPath);

  if (!userExists && !passwordExists) {
    if (strict) {
      throw new Error(`Database secret files were not found under "${filesDir}".`);
    }

    return null;
  }

  if (!userExists || !passwordExists) {
    throw new Error(
      `Database secret files in "${filesDir}" are incomplete. Expected ${USERNAME_FILE} and ${PASSWORD_FILE}.`,
    );
  }

  const [user, password] = await Promise.all([readTrimmedFile(userPath), readTrimmedFile(passwordPath)]);

  assertNonEmpty(user, `Database username file "${userPath}"`);
  assertNonEmpty(password, `Database password file "${passwordPath}"`);

  return {
    user,
    password,
    source: 'files',
  };
}

export async function readDatabaseCredentialsFromVault(
  providedClient?: VaultClientLike,
  strict: boolean = false,
): Promise<DatabaseCredentials | null> {
  const missing = getMissingVaultConfig(config.vault);

  if (missing.length > 0) {
    if (strict) {
      throw new Error(`Vault database secret bootstrap is missing required settings: ${missing.join(', ')}.`);
    }

    return null;
  }

  const vaultClient = providedClient ?? new VaultClient(config.vault);
  const token = await vaultClient.loginAppRole(config.vault.authPath, config.vault.roleId, config.vault.secretId);
  const secret = await vaultClient.readSecret(token, config.vault.dbSecretPath);

  const user = readRequiredSecretField(secret, config.vault.dbUsernameField);
  const password = readRequiredSecretField(secret, config.vault.dbPasswordField);

  return {
    user,
    password,
    source: 'vault',
  };
}

export function readDatabaseCredentialsFromEnv(strict: boolean): DatabaseCredentials | null {
  const user = process.env.DB_USER?.trim() ?? config.database.user.trim();
  const password = process.env.DB_PASSWORD?.trim() ?? config.database.password.trim();

  if (!user && !password) {
    if (strict) {
      throw new Error('DB_USER and DB_PASSWORD are required when DB_SECRET_SOURCE=env.');
    }

    return null;
  }

  if (!user || !password) {
    throw new Error('DB_USER and DB_PASSWORD must both be provided for database authentication.');
  }

  return {
    user,
    password,
    source: 'env',
  };
}

export function applyDatabaseCredentials(credentials: DatabaseCredentials): void {
  process.env.DB_USER = credentials.user;
  process.env.DB_PASSWORD = credentials.password;
  config.database.user = credentials.user;
  config.database.password = credentials.password;
}

export function readRequiredSecretField(secret: unknown, selector: string): string {
  const value = getValueByPath(secret, selector);

  if (typeof value !== 'string') {
    throw new Error(`Vault secret field "${selector}" did not resolve to a string value.`);
  }

  const trimmed = value.trim();
  assertNonEmpty(trimmed, `Vault secret field "${selector}"`);
  return trimmed;
}

export function getValueByPath(value: unknown, selector: string): unknown {
  return selector.split('.').reduce<unknown>((current, key) => {
    if (!key) {
      return current;
    }

    if (!current || typeof current !== 'object' || !(key in current)) {
      throw new Error(`Vault secret field "${selector}" was not found in the secret response.`);
    }

    return (current as Record<string, unknown>)[key];
  }, value);
}

function getMissingVaultConfig(vaultConfig: VaultConfig): string[] {
  const requiredEntries: Array<[string, string]> = [
    ['VAULT_ADDR', vaultConfig.addr.trim()],
    ['VAULT_ROLE_ID', vaultConfig.roleId.trim()],
    ['VAULT_SECRET_ID', vaultConfig.secretId.trim()],
    ['VAULT_DB_SECRET_PATH', vaultConfig.dbSecretPath.trim()],
  ];

  return requiredEntries.filter(([, value]) => !value).map(([name]) => name);
}

async function readTrimmedFile(filePath: string): Promise<string> {
  return (await readFile(filePath, 'utf8')).trim();
}

function assertNonEmpty(value: string, fieldName: string): void {
  if (!value) {
    throw new Error(`${fieldName} is empty.`);
  }
}
