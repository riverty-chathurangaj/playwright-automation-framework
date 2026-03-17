import { When, Then } from '../../fixtures';
import { randomUUID } from 'crypto';
import { expect } from 'chai';
import { logger } from '@core/logger';
import type { DatabaseClient } from '@database/db-client';

type BookClientDepositFixtures = {
  store: (key: string, value: unknown) => void;
  retrieve: <T = unknown>(key: string) => T;
  dbClient: DatabaseClient;
};

// ── Message builder ──────────────────────────────────────────────────────────

function buildBookClientDepositMessage(messageId: string): Record<string, unknown> {
  const conversationId = randomUUID();
  const sentTime = new Date().toISOString();

  return {
    messageId,
    requestId: null,
    correlationId: null,
    conversationId,
    initiatorId: null,
    sourceAddress:
      'rabbitmqs://rabbitmq-general-dev.riverty.io/shared/generalledgers_GeneralLedgerP_bus_yryyyybouip3iwkabdxgxhuxd3?temporary=true',
    destinationAddress:
      'rabbitmqs://rabbitmq-general-dev.riverty.io/shared/GeneralLedger:BookClientDeposit',
    responseAddress: null,
    faultAddress: null,
    messageType: ['urn:message:GeneralLedger:BookClientDeposit'],
    message: {
      InstanceId: 2022,
      ClientId: 60232,
      Source: 'settlement-service',
      Amount: '2.4000',
      CreatedByUser: 'PhoenixTest\\SR_HorizonAppUser',
      SettledDate: '2026-02-23T00:00:00',
      Reference: '12346789012',
      BundleNoSettled: 12345678907,
      MerchantId: 'GL_TEST01',
    },
    expirationTime: null,
    sentTime,
    headers: {
      context: 'GeneralLedger.PostingService.BubbleContext',
      source: 'settlement-service',
      callLogId: 31086350,
    },
    host: {
      machineName:
        'generalledger-service-postingservice-bubblecontext-79cf47db845n',
      processName: 'GeneralLedger.PostingService.BubbleContext',
      processId: 1,
      assembly: 'GeneralLedger.PostingService.BubbleContext',
      assemblyVersion: '1.0.0.0',
      frameworkVersion: '10.0.2',
      massTransitVersion: '8.5.7.0',
      operatingSystemVersion: 'Unix 5.15.0.1102',
    },
  };
}

// ── Steps ────────────────────────────────────────────────────────────────────

When('I define a valid message for booking a client deposit', function (
  { store }: Pick<BookClientDepositFixtures, 'store'>,
) {
  const messageId = randomUUID();
  const message = buildBookClientDepositMessage(messageId);

  store('currentMessage', message);
  store('generatedMessageId', messageId);
});

When('I define a message for booking a client deposit with the last published message id', function (
  { retrieve, store }: Pick<BookClientDepositFixtures, 'retrieve' | 'store'>,
) {
  const lastMessage = retrieve<Record<string, unknown>>('lastPublishedMessage');
  if (!lastMessage?.messageId) {
    throw new Error('No previously published message found. Publish a message first.');
  }

  const messageId = lastMessage.messageId as string;
  const message = buildBookClientDepositMessage(messageId);

  store('currentMessage', message);
  store('generatedMessageId', messageId);
});

// ── Database verification ────────────────────────────────────────────────────

Then('the transactions from the book client deposit message should exist in the database', async function (
  { dbClient, retrieve }: Pick<BookClientDepositFixtures, 'dbClient' | 'retrieve'>,
) {
  const message = retrieve<Record<string, unknown>>('lastPublishedMessage');
  if (!message) {
    throw new Error('No published message found. Publish a message first.');
  }

  const innerMessage = message.message as Record<string, unknown>;
  const instanceId = innerMessage.InstanceId as number;
  const reference = innerMessage.Reference as string;

  // Use a cutoff slightly before the message sentTime to catch transactions
  const sentTime = message.sentTime as string;
  const createdAfter = sentTime
    ? new Date(new Date(sentTime).getTime() - 60_000)   // 1 min before sentTime
    : new Date(Date.now() - 5 * 60_000);                // fallback: 5 min ago

  // Poll the database — the GL service processes the message asynchronously
  const transactions = await dbClient.getTransactionsByReferenceWithRetry(
    instanceId,
    reference,
    30_000,   // timeout: 30 seconds
    2_000,    // poll interval: 2 seconds
    createdAfter,
  );

  expect(transactions.length, 'Expected at least 1 transaction row in Data.Transaction').to.be.at.least(1);

  logger.info('Verified transactions in Data.Transaction', {
    instanceId,
    reference,
    transactionCount: transactions.length,
    transactions: transactions.map(t => ({
      Id: t.Id,
      Amount: t.Amount,
      ClientId: t.ClientId,
      Account: t.Account,
    })),
  });
});

