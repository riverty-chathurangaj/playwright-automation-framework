import { RabbitClient } from './rabbit-client';
import { logger } from '../core/logger';
import { config } from '../core/config';

export interface CollectedMessage {
  content: Record<string, unknown>;
  rawContent: string;
  headers: Record<string, unknown>;
  routingKey: string;
  exchange: string;
  timestamp: Date;
  messageId: string;
  correlationId: string;
  contentType: string;
}

export class ConsumerHarness {
  private collectedMessages: CollectedMessage[] = [];
  private activeQueues: string[] = [];
  private consumerTags: string[] = [];

  constructor(private rabbitClient: RabbitClient) {}

  async startListening(exchange: string, routingKey: string, options: import('./rabbit-client').QueueOptions = {}): Promise<string> {
    const queueName = await this.rabbitClient.createTestQueue(exchange, routingKey, options);
    this.activeQueues.push(queueName);

    const { consumerTag } = await this.rabbitClient.ch.consume(queueName, (msg) => {
      if (!msg) return;

      const rawContent = msg.content.toString();
      let content: Record<string, unknown>;

      try {
        content = JSON.parse(rawContent);
      } catch {
        content = { _raw: rawContent, _parseError: true };
      }

      const collected: CollectedMessage = {
        content,
        rawContent,
        headers: (msg.properties.headers || {}) as Record<string, unknown>,
        routingKey: msg.fields.routingKey,
        exchange: msg.fields.exchange,
        timestamp: new Date(),
        messageId: msg.properties.messageId || '',
        correlationId: msg.properties.correlationId || '',
        contentType: msg.properties.contentType || '',
      };

      this.collectedMessages.push(collected);
      this.rabbitClient.ch.ack(msg);

      logger.debug('Message collected', {
        exchange: msg.fields.exchange,
        routingKey: msg.fields.routingKey,
        messageId: msg.properties.messageId,
        total: this.collectedMessages.length,
      });
    });

    this.consumerTags.push(consumerTag);
    logger.info('Consumer harness listening', { exchange, routingKey, queueName, consumerTag });
    return queueName;
  }

  async startListeningDLQ(dlqName: string): Promise<void> {
    await this.rabbitClient.bindToDLQ(dlqName);
    this.activeQueues.push(dlqName);

    const { consumerTag } = await this.rabbitClient.ch.consume(dlqName, (msg) => {
      if (!msg) return;

      const rawContent = msg.content.toString();
      let content: Record<string, unknown>;
      try {
        content = JSON.parse(rawContent);
      } catch {
        content = { _raw: rawContent };
      }

      this.collectedMessages.push({
        content,
        rawContent,
        headers: (msg.properties.headers || {}) as Record<string, unknown>,
        routingKey: msg.fields.routingKey,
        exchange: msg.fields.exchange,
        timestamp: new Date(),
        messageId: msg.properties.messageId || '',
        correlationId: msg.properties.correlationId || '',
        contentType: msg.properties.contentType || '',
      });

      this.rabbitClient.ch.ack(msg);
      logger.debug('DLQ message collected', { dlqName });
    });

    this.consumerTags.push(consumerTag);
    logger.info('Consumer harness listening on DLQ', { dlqName, consumerTag });
  }

  async waitForMessages(count: number, timeoutMs?: number): Promise<CollectedMessage[]> {
    const timeout = timeoutMs ?? config.messageWaitTimeout;
    const start = Date.now();

    while (this.collectedMessages.length < count) {
      if (Date.now() - start > timeout) {
        throw new Error(
          `Message wait timeout (${timeout}ms): expected ${count} message(s) but received ${this.collectedMessages.length}`,
        );
      }
      await new Promise(r => setTimeout(r, 100));
    }

    return [...this.collectedMessages];
  }

  async waitForMessage(timeoutMs?: number): Promise<CollectedMessage> {
    const messages = await this.waitForMessages(1, timeoutMs);
    return messages[0];
  }

  async assertNoMessages(waitMs: number = 3000): Promise<void> {
    await new Promise(r => setTimeout(r, waitMs));
    if (this.collectedMessages.length > 0) {
      throw new Error(
        `Expected no messages but received ${this.collectedMessages.length}: ${JSON.stringify(this.collectedMessages.map(m => m.routingKey))}`,
      );
    }
  }

  getMessages(): CollectedMessage[] {
    return [...this.collectedMessages];
  }

  getMessageCount(): number {
    return this.collectedMessages.length;
  }

  getLatestMessage(): CollectedMessage | undefined {
    return this.collectedMessages[this.collectedMessages.length - 1];
  }

  getMessageByIndex(index: number): CollectedMessage | undefined {
    return this.collectedMessages[index];
  }

  findMessageByField(fieldPath: string, value: unknown): CollectedMessage | undefined {
    return this.collectedMessages.find(msg => {
      const parts = fieldPath.split('.');
      let current: unknown = msg.content;
      for (const part of parts) {
        if (current === null || current === undefined) return false;
        current = (current as Record<string, unknown>)[part];
      }
      return current === value;
    });
  }

  reset(): void {
    this.collectedMessages = [];
  }

  async cleanup(): Promise<void> {
    // Cancel consumers first so amqp-connection-manager stops re-registering them on reconnect
    for (const tag of this.consumerTags) {
      try {
        await this.rabbitClient.ch.cancel(tag);
      } catch {
        // Best effort
      }
    }
    this.consumerTags = [];

    for (const queue of this.activeQueues) {
      try {
        await this.rabbitClient.deleteQueue(queue);
      } catch {
        // Best effort cleanup
      }
    }
    this.activeQueues = [];
    this.collectedMessages = [];
  }
}
