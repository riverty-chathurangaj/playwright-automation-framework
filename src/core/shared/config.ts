import * as dotenv from 'dotenv';
import * as fs from 'fs';
import * as path from 'path';

export interface RabbitMQConfig {
  url: string;
  exchange: string;
  dlq: string;
  vhost: string;
  heartbeat: number;
}

export interface DatabaseConfig {
  client: 'mssql' | 'pg' | 'mysql2';
  host: string;
  port: number;
  user: string;
  password: string;
  name: string;
  schema: string;
  queryTimeout: number;
  authType: 'default' | 'azure-active-directory-default';
  secretSource: 'auto' | 'vault' | 'files' | 'env';
}

export interface VaultConfig {
  addr: string;
  authPath: string;
  roleId: string;
  secretId: string;
  namespace: string;
  dbSecretPath: string;
  dbUsernameField: string;
  dbPasswordField: string;
  timeout: number;
}

export interface AuthConfig {
  baseUrl: string; // Identity server base URL  (e.g. https://identity-test.horizonafs.io)
  clientId: string;
  clientSecret: string;
  audience: string;
}

export interface AIConfig {
  enabled: boolean;
  provider: 'anthropic' | 'openai' | 'azure-openai';
  anthropicApiKey: string;
  openaiApiKey: string;
  openaiEndpoint: string;
  openaiApiVersion: string;
  model: string;
  maxTokens: number;
}

export interface XrayConfig {
  clientId: string;
  clientSecret: string;
  baseUrl: string;
  projectKey: string;
  executionKey?: string;
}

export interface UIConfig {
  baseUrl: string;
  sauceDemoBaseUrl: string;
  authStoragePath: string;
  defaultTimeout: number;
  username: string;
  password: string;
}

export interface ApiRuntimeConfig {
  baseUrl: string;
  servicePath: string;
  instanceId: number;
  version: string;
  timeout: number;
  messageWaitTimeout: number;
}

export interface FrameworkConfig {
  api: ApiRuntimeConfig;
  env: string;
  auth: AuthConfig;
  rabbitmq: RabbitMQConfig;
  database: DatabaseConfig;
  vault: VaultConfig;
  ai: AIConfig;
  xray: XrayConfig;
  ui: UIConfig;
  logLevel: string;
  reportDir: string;
  gitSha: string;
}

type EnvMap = Record<string, string | undefined>;

const DEFAULT_TEST_ENV = 'dev';

function loadEnvFile(filePath: string): EnvMap {
  if (!fs.existsSync(filePath)) {
    return {};
  }

  return dotenv.parse(fs.readFileSync(filePath));
}

function resolveSelectedEnvironment(): string {
  if (process.env.TEST_ENV) {
    return process.env.TEST_ENV;
  }

  const localOverrides = loadEnvFile(path.resolve(process.cwd(), '.env.local'));
  if (localOverrides.TEST_ENV) {
    return localOverrides.TEST_ENV;
  }

  const legacyRootEnv = loadEnvFile(path.resolve(process.cwd(), '.env'));
  if (legacyRootEnv.TEST_ENV) {
    return legacyRootEnv.TEST_ENV;
  }

  return DEFAULT_TEST_ENV;
}

const selectedEnvironment = resolveSelectedEnvironment();
const environmentConfigDir = path.resolve(process.cwd(), 'config/environments');
const legacyRootEnvPath = path.resolve(process.cwd(), '.env');
const environmentOverlayPath = path.resolve(environmentConfigDir, `${selectedEnvironment}.env`);
const localOverridePath = path.resolve(process.cwd(), '.env.local');

const resolvedEnv: EnvMap = {
  ...loadEnvFile(legacyRootEnvPath),
  ...loadEnvFile(environmentOverlayPath),
  ...loadEnvFile(localOverridePath),
  ...process.env,
  TEST_ENV: process.env.TEST_ENV || selectedEnvironment,
};

function optional(key: string, fallback: string): string {
  return resolvedEnv[key] || fallback;
}

function normalizeAuthBaseUrl(value: string): string {
  return value.replace(/\/oauth\/token\/?$/i, '');
}

export const config: FrameworkConfig = {
  api: {
    baseUrl: optional('API_BASE_URL', optional('BASE_URL', 'http://localhost:5000')),
    servicePath: optional('API_SERVICE_PATH', optional('SERVICE_PATH', 'gl-service')),
    instanceId: Number(optional('INSTANCE_ID', '1001')),
    version: optional('API_VERSION', 'v1'),
    timeout: Number(optional('API_TIMEOUT', '30000')),
    messageWaitTimeout: Number(optional('MESSAGE_WAIT_TIMEOUT', '15000')),
  },
  env: optional('TEST_ENV', 'dev'),

  auth: {
    baseUrl: normalizeAuthBaseUrl(optional('AUTH_BASE_URL', optional('AUTH_TOKEN_URL', ''))),
    clientId: optional('AUTH_CLIENT_ID', ''),
    clientSecret: optional('AUTH_CLIENT_SECRET', ''),
    audience: optional('AUTH_AUDIENCE', ''),
  },

  rabbitmq: {
    url: optional('RABBITMQ_URL', 'amqp://guest:guest@localhost:5672'),
    exchange: optional('RABBITMQ_EXCHANGE', 'gl.events'),
    dlq: optional('RABBITMQ_DLQ', 'gl.events.dlq'),
    vhost: optional('RABBITMQ_VHOST', '/'),
    heartbeat: Number(optional('RABBITMQ_HEARTBEAT', '60')),
  },

  database: {
    client: optional('DB_CLIENT', 'mssql') as 'mssql' | 'pg' | 'mysql2',
    host: optional('DB_HOST', 'localhost'),
    port: Number(optional('DB_PORT', '1433')),
    user: optional('DB_USER', ''),
    password: optional('DB_PASSWORD', ''),
    name: optional('DB_NAME', 'GL_Database'),
    schema: optional('DB_SCHEMA', 'dbo'),
    queryTimeout: Number(optional('DB_QUERY_TIMEOUT', '10000')),
    authType: optional('DB_AUTH_TYPE', 'default') as 'default' | 'azure-active-directory-default',
    secretSource: optional('DB_SECRET_SOURCE', 'auto') as 'auto' | 'vault' | 'files' | 'env',
  },

  vault: {
    addr: optional('VAULT_ADDR', ''),
    authPath: optional('VAULT_AUTH_PATH', 'auth/finance/approle/login'),
    roleId: optional('VAULT_ROLE_ID', ''),
    secretId: optional('VAULT_SECRET_ID', ''),
    namespace: optional('VAULT_NAMESPACE', ''),
    dbSecretPath: optional('VAULT_DB_SECRET_PATH', ''),
    dbUsernameField: optional('VAULT_DB_USERNAME_FIELD', 'data.username'),
    dbPasswordField: optional('VAULT_DB_PASSWORD_FIELD', 'data.password'),
    timeout: Number(optional('VAULT_TIMEOUT', '10000')),
  },

  ai: {
    enabled: optional('AI_ENABLED', 'false') === 'true',
    provider: optional('AI_PROVIDER', 'anthropic') as 'anthropic' | 'openai' | 'azure-openai',
    anthropicApiKey: optional('ANTHROPIC_API_KEY', ''),
    openaiApiKey: optional('OPENAI_API_KEY', ''),
    openaiEndpoint: optional('OPENAI_ENDPOINT', ''),
    openaiApiVersion: optional('OPENAI_API_VERSION', '2024-12-01-preview'),
    model: optional(
      'AI_MODEL',
      optional('AI_PROVIDER', 'anthropic') === 'openai' || optional('AI_PROVIDER', 'anthropic') === 'azure-openai'
        ? 'gpt-4o-mini'
        : 'claude-opus-4-6',
    ),
    maxTokens: Number(optional('AI_MAX_TOKENS', '4096')),
  },

  xray: {
    clientId: optional('XRAY_CLIENT_ID', ''),
    clientSecret: optional('XRAY_CLIENT_SECRET', ''),
    baseUrl: optional('XRAY_BASE_URL', 'https://xray.cloud.getxray.app'),
    projectKey: optional('XRAY_PROJECT_KEY', 'GL'),
    executionKey: optional('XRAY_EXECUTION_KEY', ''),
  },

  ui: {
    baseUrl: optional('UI_BASE_URL', optional('API_BASE_URL', optional('BASE_URL', 'http://localhost:3000'))),
    sauceDemoBaseUrl: optional('UI_SAUCEDEMO_BASE_URL', 'https://www.saucedemo.com'),
    authStoragePath: optional('UI_AUTH_STORAGE_PATH', '.auth/ui-storage-state.json'),
    defaultTimeout: Number(optional('UI_DEFAULT_TIMEOUT', '10000')),
    username: optional('UI_USERNAME', ''),
    password: optional('UI_PASSWORD', ''),
  },

  logLevel: optional('LOG_LEVEL', 'info'),
  reportDir: optional('REPORT_DIR', 'reports'),
  gitSha: optional('GIT_SHA', `local-${Date.now()}`),
};

export default config;
