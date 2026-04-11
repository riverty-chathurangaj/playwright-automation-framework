import amqp from 'amqp-connection-manager';
import type { AmqpConnectionManager, ChannelWrapper } from 'amqp-connection-manager';
import type { Channel } from 'amqplib';
import { config } from '../core/config';
import { logger } from '../core/logger';

export interface QueueOptions {
  exclusive?: boolean;
  durable?: boolean;
  autoDelete?: boolean;
  ttlMs?: number;
  /** Exchange type to assert. Pass false to skip declaration (use when binding to a pre-existing server-managed exchange). */
  exchangeType?: string | false;
}

export class RabbitClient {
  private manager: AmqpConnectionManager | null = null;
  private channelWrapper: ChannelWrapper | null = null;
  private _connected: boolean = false;

  get ch(): ChannelWrapper {
    if (!this.channelWrapper) throw new Error('RabbitMQ channel not initialized. Call connect() first.');
    return this.channelWrapper;
  }

  async connect(): Promise<void> {
    try {
      const url = config.rabbitmq.url;
      const parsed = new URL(url.replace(/^amqps?:\/\//, 'http://'));

      this.manager = amqp.connect(
        [
          {
            hostname: parsed.hostname,
            port: parseInt(parsed.port || '5672'),
            username: decodeURIComponent(parsed.username) || 'guest',
            password: decodeURIComponent(parsed.password) || 'guest',
            vhost: config.rabbitmq.vhost,
            heartbeat: config.rabbitmq.heartbeat,
          },
        ],
        { reconnectTimeInSeconds: 5 },
      );

      this.manager.on('connect', () => {
        this._connected = true;
        logger.info('Connected to RabbitMQ', { url: url.replace(/:[^:@]+@/, ':***@') });
      });

      this.manager.on('disconnect', ({ err }: { err?: Error }) => {
        this._connected = false;
        logger.warn('RabbitMQ disconnected — will reconnect in 5s', { reason: err?.message });
      });

      this.manager.on('connectFailed', ({ err }: { err: Error }) => {
        logger.error('RabbitMQ connection attempt failed', { reason: err.message });
      });

      this.channelWrapper = this.manager.createChannel({
        json: false,
        setup: async (channel: Channel) => {
          channel.on('error', (err: Error) => logger.error('RabbitMQ channel error', { err }));
          logger.debug('RabbitMQ channel ready');
        },
      });

      await this.channelWrapper.waitForConnect();
      this._connected = true;
    } catch (error) {
      logger.error('Failed to connect to RabbitMQ', { error });
      throw error;
    }
  }

  async createTestQueue(exchange: string, routingKey: string, options: QueueOptions = {}): Promise<string> {
    const queueName = `pw-testforge-gls-${exchange}-${routingKey}-${Date.now()}`.replace(/\./g, '-');

    const exchangeType = options.exchangeType ?? 'topic';
    if (exchangeType !== false) {
      await this.ch.assertExchange(exchange, exchangeType, { durable: true });
    }
    await this.ch.assertQueue(queueName, {
      // exclusive: false so the queue survives reconnects (autoDelete + TTL handle cleanup)
      exclusive: options.exclusive ?? false,
      durable: options.durable ?? false,
      autoDelete: options.autoDelete ?? true,
      arguments: {
        'x-expires': options.ttlMs ?? 300_000, // 5-minute TTL safety net
        'x-message-ttl': 600_000,
      },
    });

    await this.ch.bindQueue(queueName, exchange, routingKey);
    logger.debug('Test queue created', { queueName, exchange, routingKey });
    return queueName;
  }

  async bindToDLQ(dlqName: string): Promise<void> {
    await this.ch.assertQueue(dlqName, { durable: true });
    logger.debug('Bound to DLQ', { dlqName });
  }

  async publish(
    exchange: string,
    routingKey: string,
    content: unknown,
    headers: Record<string, string> = {},
  ): Promise<boolean> {
    const buffer = Buffer.from(JSON.stringify(content));
    await this.ch.publish(exchange, routingKey, buffer, {
      contentType: 'application/json',
      headers,
      messageId: `test-${Date.now()}`,
      timestamp: Math.floor(Date.now() / 1000),
      persistent: true,
    });

    logger.debug('Message published', { exchange, routingKey });
    return true;
  }

  async publishRaw(exchange: string, routingKey: string, rawContent: string): Promise<boolean> {
    const buffer = Buffer.from(rawContent);
    await this.ch.publish(exchange, routingKey, buffer, { contentType: 'application/json' });
    return true;
  }

  async purgeQueue(queueName: string): Promise<void> {
    await this.ch.purgeQueue(queueName);
  }

  async deleteQueue(queueName: string): Promise<void> {
    await this.ch.deleteQueue(queueName);
  }

  async disconnect(): Promise<void> {
    try {
      await this.channelWrapper?.close();
      await this.manager?.close();
      this._connected = false;
      logger.debug('Disconnected from RabbitMQ');
    } catch {
      // Ignore errors during disconnect
    }
  }

  isConnected(): boolean {
    return this._connected;
  }
}
