import { When, Then } from '../../fixtures';
import { expect } from 'chai';
import { logger } from '@core/logger';
import {
  buildBookClientPayoutMessage,
  type BookClientPayoutMessage,
} from '@models/test-data/factories/book-client-payout.factory';
import { resolveExchange } from '@messaging/exchanges';
import type { RabbitClient } from '@messaging/rabbit-client';
import type { DatabaseClient } from '@database/db-client';

type BookClientPayoutFixtures = {
  rabbitClient: RabbitClient;
  store: (key: string, value: unknown) => void;
  retrieve: <T = unknown>(key: string) => T;
  dbClient: DatabaseClient;
};

// ── Steps ────────────────────────────────────────────────────────────────────

When('I define a valid message for booking a client payout', function (
  { store }: Pick<BookClientPayoutFixtures, 'store'>,
) {
  const message = buildBookClientPayoutMessage();

  store('currentMessage', message);
  store('generatedMessageId', message.messageId);
});

When('I define a message for booking a client payout with the last published message id', function (
  { retrieve, store }: Pick<BookClientPayoutFixtures, 'retrieve' | 'store'>,
) {
  const lastMessage = retrieve<BookClientPayoutMessage>('lastPublishedMessage');
  if (!lastMessage?.messageId) {
    throw new Error('No previously published message found. Publish a message first.');
  }

  const message = buildBookClientPayoutMessage({}, lastMessage.messageId);

  store('currentMessage', message);
  store('generatedMessageId', message.messageId);
});

When('I set the book client payout message ID to be the same as the previous message', function (
  { retrieve, store }: Pick<BookClientPayoutFixtures, 'retrieve' | 'store'>,
) {
  const currentMessage = retrieve<BookClientPayoutMessage>('currentMessage');
  const lastPublished = retrieve<BookClientPayoutMessage>('lastPublishedMessage');
  if (!currentMessage) {
    throw new Error('No current message defined. Use a "I define a valid message …" step first.');
  }
  if (!lastPublished?.messageId) {
    throw new Error('No previously published message found. Publish a message first.');
  }

  currentMessage.messageId = lastPublished.messageId;
  store('generatedMessageId', lastPublished.messageId);
});

When('I publish {int} book client payout message(s) with an invalid message ID to {string}', async function (
  { rabbitClient, store }: Pick<BookClientPayoutFixtures, 'rabbitClient' | 'store'>,
  count: number,
  exchangeLabel: string,
) {
  const { exchange, routingKey } = resolveExchange(exchangeLabel);
  const publishedMessages: BookClientPayoutMessage[] = [];

  for (let i = 0; i < count; i++) {
    const invalidId = `not-a-valid-guid-${Date.now()}-${i}`;
    const message = buildBookClientPayoutMessage({}, invalidId);

    await rabbitClient.publish(exchange, routingKey, message);

    publishedMessages.push(message);
    logger.debug(`Published message ${i + 1}/${count} with invalid messageId`, {
      messageId: invalidId,
    });
  }

  store('publishedBatchMessages', publishedMessages);
  store('publishedBatchCount', count);

  if (publishedMessages.length > 0) {
    store('lastPublishedMessage', publishedMessages[publishedMessages.length - 1]);
  }

  logger.info(`Published ${count} book client payout message(s) with invalid message IDs`);
});

// ── Database verification ────────────────────────────────────────────────────

Then('the transactions from the book client payout message should exist in the database', async function (
  { dbClient, retrieve, store }: Pick<BookClientPayoutFixtures, 'dbClient' | 'retrieve' | 'store'>,
) {
  const message = retrieve<BookClientPayoutMessage>('lastPublishedMessage');
  if (!message) {
    throw new Error('No published message found. Publish a message first.');
  }

  const { InstanceId: instanceId, Reference: reference, Amount: expectedAmount } = message.message;

  // PartitionId for book-client-payout queries — speeds up Data.Transaction lookups
  const PARTITION_ID = 20222026;

  // Use a cutoff slightly before the message sentTime to catch transactions
  const sentTime = message.sentTime;
  const createdAfter = sentTime
    ? new Date(new Date(sentTime).getTime() - 60_000)   // 1 min before sentTime
    : new Date(Date.now() - 5 * 60_000);                // fallback: 5 min ago

  // Poll the database — the GL service processes the message asynchronously.
  // We poll for the specific amount match because old rows for the same
  // Reference may already exist, and we need to wait for the NEW ones.
  const timeoutMs = 30_000;
  const intervalMs = 2_000;
  const start = Date.now();
  let positiveEntry: Record<string, unknown> | undefined;
  let negativeEntry: Record<string, unknown> | undefined;

  while (Date.now() - start < timeoutMs) {
    const transactions = await dbClient.getTransactionsByReference(
      instanceId,
      reference,
      createdAfter,
      PARTITION_ID,
    );

    positiveEntry = transactions.find(
      t => Math.abs((t.AmountNotRounded as number) - expectedAmount) < 0.0001,
    );
    negativeEntry = transactions.find(
      t => Math.abs((t.AmountNotRounded as number) - (-expectedAmount)) < 0.0001,
    );

    if (positiveEntry && negativeEntry) {
      logger.info('Both transaction entries found', {
        elapsedMs: Date.now() - start,
        totalRows: transactions.length,
      });
      break;
    }

    logger.debug('Waiting for matching transactions...', {
      expectedAmount,
      foundPositive: !!positiveEntry,
      foundNegative: !!negativeEntry,
      totalRows: transactions.length,
      elapsedMs: Date.now() - start,
    });
    await new Promise(r => setTimeout(r, intervalMs));
  }

  // ── Assert both entries were found ──
  expect(positiveEntry, `Expected a transaction with AmountNotRounded ≈ +${expectedAmount} (polled ${timeoutMs / 1000}s)`).to.exist;
  expect(negativeEntry, `Expected a transaction with AmountNotRounded ≈ ${-expectedAmount} (polled ${timeoutMs / 1000}s)`).to.exist;

  // Both entries must share the same BundleNumber and Reference
  expect(
    positiveEntry!.BundleNumber,
    'Both entries should have the same BundleNumber',
  ).to.equal(negativeEntry!.BundleNumber);

  expect(
    positiveEntry!.Reference,
    'Both entries should have the same Reference',
  ).to.equal(negativeEntry!.Reference);

  logger.info('Verified book client payout transactions in Data.Transaction', {
    instanceId,
    reference,
    expectedAmount,
    positiveAmountNotRounded: positiveEntry!.AmountNotRounded,
    negativeAmountNotRounded: negativeEntry!.AmountNotRounded,
    bundleNumber: positiveEntry!.BundleNumber,
  });

  store('clientPayoutPositiveEntry', positiveEntry);
  store('clientPayoutNegativeEntry', negativeEntry);
});

Then('the book client payout transactions should have the posting number {string}', function (
  { retrieve }: Pick<BookClientPayoutFixtures, 'retrieve'>,
  expectedPostingNumber: string,
) {
  const positiveEntry = retrieve<Record<string, unknown>>('clientPayoutPositiveEntry');
  const negativeEntry = retrieve<Record<string, unknown>>('clientPayoutNegativeEntry');

  if (!positiveEntry || !negativeEntry) {
    throw new Error('No transaction entries found. Run the DB verification step first.');
  }

  const expected = Number(expectedPostingNumber);

  expect(
    positiveEntry.PostingNumber,
    `Positive entry PostingNumber should be ${expected}`,
  ).to.equal(expected);

  expect(
    negativeEntry.PostingNumber,
    `Negative entry PostingNumber should be ${expected}`,
  ).to.equal(expected);
});
