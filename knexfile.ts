import * as dotenv from 'dotenv';
import type { Knex } from 'knex';

dotenv.config();

const baseConnection = {
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'sa',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'GL_Database',
};

const config: { [key: string]: Knex.Config } = {
  // SQL Server (default for GL Service)
  mssql: {
    client: 'mssql',
    connection: {
      ...baseConnection,
      port: Number(process.env.DB_PORT) || 1433,
      options: {
        encrypt: process.env.DB_ENCRYPT === 'true',
        trustServerCertificate: true,
        requestTimeout: Number(process.env.DB_QUERY_TIMEOUT) || 10000,
      },
    } as unknown as Knex.StaticConnectionConfig,
    pool: { min: 1, max: 5 },
    debug: process.env.LOG_LEVEL === 'debug',
  },

  // PostgreSQL
  pg: {
    client: 'pg',
    connection: {
      ...baseConnection,
      port: Number(process.env.DB_PORT) || 5432,
      ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false,
    },
    pool: { min: 1, max: 5 },
  },

  // MySQL
  mysql2: {
    client: 'mysql2',
    connection: {
      ...baseConnection,
      port: Number(process.env.DB_PORT) || 3306,
    },
    pool: { min: 1, max: 5 },
  },
};

const client = process.env.DB_CLIENT || 'mssql';
module.exports = config[client] || config.mssql;
export default config;
