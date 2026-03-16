import { RabbitClient } from './rabbit-client';
import { ConsumerHarness, CollectedMessage } from './consumer-harness';
import { config } from '../core/config';
import { logger } from '../core/logger';

export class DLQMonitor {
  private harness: ConsumerHarness;

  constructor(rabbitClient: RabbitClient) {
    this.harness = new ConsumerHarness(rabbitClient);
  }

  async startMonitoring(dlqName: string = config.rabbitmq.dlq): Promise<void> {
    await this.harness.startListeningDLQ(dlqName);
    logger.info('DLQ monitoring started', { dlqName });
  }

  async waitForDLQMessage(timeoutMs: number = 10_000): Promise<CollectedMessage> {
    return this.harness.waitForMessage(timeoutMs);
  }

  async assertMessageInDLQ(timeoutMs: number = 10_000): Promise<CollectedMessage> {
    const msg = await this.waitForDLQMessage(timeoutMs);
    logger.debug('Message found in DLQ', {
      headers: msg.headers,
      routingKey: msg.routingKey,
    });
    return msg;
  }

  async assertNoDLQMessages(waitMs: number = 3_000): Promise<void> {
    await this.harness.assertNoMessages(waitMs);
  }

  getCollectedMessages(): CollectedMessage[] {
    return this.harness.getMessages();
  }

  reset(): void {
    this.harness.reset();
  }

  async cleanup(): Promise<void> {
    await this.harness.cleanup();
  }
}
