import { When } from '../../fixtures';
import { randomUUID } from 'crypto';

type BookClientDepositFixtures = {
  store: (key: string, value: unknown) => void;
  retrieve: <T = unknown>(key: string) => T;
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
