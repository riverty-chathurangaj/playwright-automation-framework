import * as winston from 'winston';
import * as path from 'path';
import { config } from './config';

const { combine, timestamp, printf, colorize, json, errors } = winston.format;

const consoleFormat = printf(({ level, message, timestamp, ...meta }) => {
  const metaStr = Object.keys(meta).length
    ? `\n${JSON.stringify(meta, null, 2)}`
    : '';
  return `${timestamp} [${level.toUpperCase()}] ${message}${metaStr}`;
});

const logDir = path.resolve(process.cwd(), config.reportDir, 'logs');

export const logger = winston.createLogger({
  level: config.logLevel,
  defaultMeta: {
    env: config.env,
    framework: 'testonaut-gl',
  },
  format: combine(
    errors({ stack: true }),
    timestamp({ format: 'YYYY-MM-DD HH:mm:ss.SSS' }),
    json(),
  ),
  transports: [
    new winston.transports.Console({
      format: combine(
        colorize(),
        timestamp({ format: 'HH:mm:ss.SSS' }),
        consoleFormat,
      ),
    }),
  ],
  exceptionHandlers: [
    new winston.transports.Console(),
  ],
  rejectionHandlers: [
    new winston.transports.Console(),
  ],
});

export function logRequest(method: string, url: string, body?: unknown): void {
  logger.http('API Request', { method: method.toUpperCase(), url, body });
}

export function logResponse(
  method: string,
  url: string,
  status: number,
  duration: number,
  body?: unknown,
): void {
  const level = status >= 500 ? 'error' : status >= 400 ? 'warn' : 'http';
  logger.log(level, 'API Response', { method: method.toUpperCase(), url, status, duration, body });
}

export function logMessage(event: string, exchange: string, routingKey: string, content?: unknown): void {
  logger.info('RabbitMQ Message', { event, exchange, routingKey, content });
}

export function logDb(operation: string, table: string, params?: unknown): void {
  logger.debug('DB Query', { operation, table, params });
}

export default logger;
