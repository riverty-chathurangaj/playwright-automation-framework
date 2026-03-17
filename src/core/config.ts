import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });

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
}

export interface AuthConfig {
  baseUrl: string;       // Identity server base URL  (e.g. https://identity-test.horizonafs.io)
  clientId: string;
  clientSecret: string;
  audience: string;
}

export interface AIConfig {
  enabled: boolean;
  apiKey: string;
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

export interface FrameworkConfig {
  baseUrl: string;
  servicePath: string;
  instanceId: number;
  apiVersion: string;
  env: string;
  apiTimeout: number;
  messageWaitTimeout: number;
  auth: AuthConfig;
  rabbitmq: RabbitMQConfig;
  database: DatabaseConfig;
  ai: AIConfig;
  xray: XrayConfig;
  logLevel: string;
  reportDir: string;
  gitSha: string;
}

function required(key: string): string {
  const value = process.env[key];
  if (!value) {
    throw new Error(`Required environment variable "${key}" is not set. Check your .env file.`);
  }
  return value;
}

function optional(key: string, fallback: string): string {
  return process.env[key] || fallback;
}

export const config: FrameworkConfig = {
  baseUrl: optional('BASE_URL', 'http://localhost:5000'),
  servicePath: optional('SERVICE_PATH', 'gl-service'),
  instanceId: Number(optional('INSTANCE_ID', '1001')),
  apiVersion: optional('API_VERSION', 'v1'),
  env: optional('TEST_ENV', 'dev'),
  apiTimeout: Number(optional('API_TIMEOUT', '30000')),
  messageWaitTimeout: Number(optional('MESSAGE_WAIT_TIMEOUT', '15000')),

  auth: {
    baseUrl: optional('AUTH_BASE_URL', ''),
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
    client: (optional('DB_CLIENT', 'mssql') as 'mssql' | 'pg' | 'mysql2'),
    host: optional('DB_HOST', 'localhost'),
    port: Number(optional('DB_PORT', '1433')),
    user: optional('DB_USER', ''),
    password: optional('DB_PASSWORD', ''),
    name: optional('DB_NAME', 'GL_Database'),
    schema: optional('DB_SCHEMA', 'dbo'),
    queryTimeout: Number(optional('DB_QUERY_TIMEOUT', '10000')),
    authType: (optional('DB_AUTH_TYPE', 'default') as 'default' | 'azure-active-directory-default'),
  },

  ai: {
    enabled: optional('AI_ENABLED', 'false') === 'true',
    apiKey: optional('ANTHROPIC_API_KEY', ''),
    model: optional('AI_MODEL', 'claude-opus-4-6'),
    maxTokens: Number(optional('AI_MAX_TOKENS', '4096')),
  },

  xray: {
    clientId: optional('XRAY_CLIENT_ID', ''),
    clientSecret: optional('XRAY_CLIENT_SECRET', ''),
    baseUrl: optional('XRAY_BASE_URL', 'https://xray.cloud.getxray.app'),
    projectKey: optional('XRAY_PROJECT_KEY', 'GL'),
    executionKey: optional('XRAY_EXECUTION_KEY', ''),
  },

  logLevel: optional('LOG_LEVEL', 'info'),
  reportDir: optional('REPORT_DIR', 'reports'),
  gitSha: optional('GIT_SHA', `local-${Date.now()}`),
};

export default config;
