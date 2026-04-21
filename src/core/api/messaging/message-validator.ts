import { SchemaValidator, ValidationResult } from '@api-schemas/schema-validator';
import { CollectedMessage } from './consumer-harness';
import { Comparator } from '@api-utils/comparator';
import * as fs from 'fs';
import * as path from 'path';
import { logger } from '@shared-core/logger';

export class MessageValidator {
  private schemaValidator: SchemaValidator;

  constructor() {
    this.schemaValidator = new SchemaValidator();
    this.loadMessageSchemas();
  }

  private loadMessageSchemas(): void {
    const schemaDir = path.resolve(process.cwd(), 'src/core/api/messaging/message-schemas');
    if (!fs.existsSync(schemaDir)) return;

    const files = fs.readdirSync(schemaDir).filter((f) => f.endsWith('.schema.json'));
    for (const file of files) {
      try {
        const schema = JSON.parse(fs.readFileSync(path.join(schemaDir, file), 'utf-8'));
        if (schema.$id && !this.schemaValidator.hasSchema(schema.$id)) {
          this.schemaValidator.addSchema(schema);
          logger.debug('Message schema loaded', { schemaId: schema.$id });
        }
      } catch (error) {
        logger.error('Failed to load message schema', { file, error });
      }
    }
  }

  validateSchema(message: CollectedMessage, schemaName: string): ValidationResult {
    return this.schemaValidator.validate(schemaName, message.content);
  }

  validateField(message: CollectedMessage, fieldPath: string, expectedValue: unknown): boolean {
    return Comparator.fieldEquals(message.content as Record<string, unknown>, fieldPath, expectedValue);
  }

  getField(message: CollectedMessage, fieldPath: string): unknown {
    return Comparator.getNestedValue(message.content as Record<string, unknown>, fieldPath);
  }

  validateHeader(message: CollectedMessage, headerName: string, expectedValue: string): boolean {
    const actual = message.headers[headerName];
    return String(actual) === expectedValue;
  }

  validateOrdering(messages: CollectedMessage[]): boolean {
    for (let i = 1; i < messages.length; i++) {
      if (messages[i].timestamp < messages[i - 1].timestamp) {
        return false;
      }
    }
    return true;
  }

  validateUniqueIds(messages: CollectedMessage[], idField: string): boolean {
    const ids = messages.map((m) => Comparator.getNestedValue(m.content as Record<string, unknown>, idField));
    const unique = new Set(ids);
    return unique.size === messages.length;
  }

  validateCorrelation(
    message: CollectedMessage,
    apiResponseField: string,
    apiResponse: Record<string, unknown>,
  ): boolean {
    const apiValue = Comparator.getNestedValue(apiResponse, apiResponseField);
    const msgValue = message.correlationId || this.getField(message, 'correlationId');
    return msgValue === apiValue;
  }

  hasDLQDeathHeader(message: CollectedMessage): boolean {
    return 'x-death' in message.headers;
  }

  getDLQDeathCount(message: CollectedMessage): number {
    const xDeath = message.headers['x-death'];
    if (Array.isArray(xDeath) && xDeath.length > 0) {
      return ((xDeath[0] as Record<string, unknown>).count as number) || 0;
    }
    return 0;
  }

  getDLQDeathReason(message: CollectedMessage): string {
    return String(message.headers['x-first-death-reason'] || '');
  }
}
