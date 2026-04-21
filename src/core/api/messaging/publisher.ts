import { RabbitClient } from './rabbit-client';
import { logger } from '@shared-core/logger';

export interface PublishOptions {
  headers?: Record<string, string>;
  correlationId?: string;
  messageId?: string;
}

export class MessagePublisher {
  constructor(private rabbitClient: RabbitClient) {}

  async publishValidMessage(
    exchange: string,
    routingKey: string,
    content: Record<string, unknown>,
    options?: PublishOptions,
  ): Promise<boolean> {
    logger.debug('Publishing valid message', { exchange, routingKey });
    return this.rabbitClient.publish(exchange, routingKey, content, options?.headers);
  }

  async publishMalformedMessage(exchange: string, routingKey: string): Promise<boolean> {
    const malformed = '{invalid-json-here: no closing brace';
    logger.debug('Publishing malformed message', { exchange, routingKey });
    return this.rabbitClient.publishRaw(exchange, routingKey, malformed);
  }

  async publishWithMissingFields(
    exchange: string,
    routingKey: string,
    content: Record<string, unknown>,
    fieldsToRemove: string[],
  ): Promise<boolean> {
    const mutated = { ...content };
    for (const field of fieldsToRemove) {
      delete mutated[field];
    }
    logger.debug('Publishing message with missing fields', { exchange, routingKey, fieldsToRemove });
    return this.rabbitClient.publish(exchange, routingKey, mutated);
  }

  async publishWithInvalidValues(
    exchange: string,
    routingKey: string,
    content: Record<string, unknown>,
    invalidFields: Record<string, unknown>,
  ): Promise<boolean> {
    const mutated = { ...content, ...invalidFields };
    logger.debug('Publishing message with invalid field values', { exchange, routingKey, invalidFields });
    return this.rabbitClient.publish(exchange, routingKey, mutated);
  }

  async publishProcessingFailureTrigger(exchange: string, routingKey: string): Promise<boolean> {
    const trigger = {
      eventId: 'trigger-processing-failure',
      eventType: '__TestProcessingFailure__',
      timestamp: new Date().toISOString(),
      data: { simulateFailure: true },
    };
    return this.rabbitClient.publish(exchange, routingKey, trigger);
  }
}
