import { When, Then } from '../../fixtures';
import { expect } from 'chai';
import { logger } from '@core/logger';
import {
  buildBookClientDepositMessage,
  type BookClientDepositMessage,
} from '@models/test-data/factories/book-client-deposit.factory';
import type { DatabaseClient } from '@database/db-client';

type BookClientDepositFixtures = {
  store: (key: string, value: unknown) => void;
  retrieve: <T = unknown>(key: string) => T;
  dbClient: DatabaseClient;
};

// ── Steps ────────────────────────────────────────────────────────────────────

When('I define a valid message for booking a client deposit', function (
  { store }: Pick<BookClientDepositFixtures, 'store'>,
) {
  const message = buildBookClientDepositMessage();

  store('currentMessage', message);
  store('generatedMessageId', message.messageId);
});

When('I define a message for booking a client deposit with the last published message id', function (
  { retrieve, store }: Pick<BookClientDepositFixtures, 'retrieve' | 'store'>,
) {
  const lastMessage = retrieve<BookClientDepositMessage>('lastPublishedMessage');
  if (!lastMessage?.messageId) {
    throw new Error('No previously published message found. Publish a message first.');
  }

  const message = buildBookClientDepositMessage({}, lastMessage.messageId);

  store('currentMessage', message);
  store('generatedMessageId', message.messageId);
});

When('I set the message ID to be the same as the previous message', function (
  { retrieve, store }: Pick<BookClientDepositFixtures, 'retrieve' | 'store'>,
) {
  const currentMessage = retrieve<BookClientDepositMessage>('currentMessage');
  const lastPublished = retrieve<BookClientDepositMessage>('lastPublishedMessage');
  if (!currentMessage) {
    throw new Error('No current message defined. Use a "I define a valid message …" step first.');
  }
  if (!lastPublished?.messageId) {
    throw new Error('No previously published message found. Publish a message first.');
  }

  currentMessage.messageId = lastPublished.messageId;
  store('generatedMessageId', lastPublished.messageId);
});

// ── Database verification ────────────────────────────────────────────────────

Then('the transactions from the book client deposit message should exist in the database', async function (
  { dbClient, retrieve, store }: Pick<BookClientDepositFixtures, 'dbClient' | 'retrieve' | 'store'>,
) {
  const message = retrieve<BookClientDepositMessage>('lastPublishedMessage');
  if (!message) {
    throw new Error('No published message found. Publish a message first.');
  }

  const { InstanceId: instanceId, Reference: reference, Amount: expectedAmount } = message.message;

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

  logger.info('Verified book client deposit transactions in Data.Transaction', {
    instanceId,
    reference,
    expectedAmount,
    positiveAmountNotRounded: positiveEntry!.AmountNotRounded,
    negativeAmountNotRounded: negativeEntry!.AmountNotRounded,
    bundleNumber: positiveEntry!.BundleNumber,
  });

  store('depositPositiveEntry', positiveEntry);
  store('depositNegativeEntry', negativeEntry);
});

Then('the transactions should have the posting number {string}', function (
  { retrieve }: Pick<BookClientDepositFixtures, 'retrieve'>,
  expectedPostingNumber: string,
) {
  const positiveEntry = retrieve<Record<string, unknown>>('depositPositiveEntry');
  const negativeEntry = retrieve<Record<string, unknown>>('depositNegativeEntry');

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

