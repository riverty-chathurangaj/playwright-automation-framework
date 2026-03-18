import { randomUUID } from 'crypto';
import { DataGenerator } from '../../../utils/data-generator';

/**
 * MassTransit envelope for the BookClientDeposit message.
 * The `message` field contains the GL-domain payload.
 */
export interface BookClientDepositMessage {
  messageId: string;
  requestId: null;
  correlationId: null;
  conversationId: string;
  initiatorId: null;
  sourceAddress: string;
  destinationAddress: string;
  responseAddress: null;
  faultAddress: null;
  messageType: string[];
  message: BookClientDepositPayload;
  expirationTime: null;
  sentTime: string;
  headers: Record<string, unknown>;
  host: Record<string, unknown>;
}

export interface BookClientDepositPayload {
  InstanceId: number;
  ClientId: number;
  Source: string;
  Amount: number;
  CreatedByUser: string;
  SettledDate: string;
  Reference: string;
  BundleNoSettled: number;
  MerchantId: string;
}

/**
 * Builds a valid BookClientDeposit RabbitMQ message.
 *
 * - `Amount` is a random number (4 decimal places) unless overridden
 * - `messageId` is a fresh UUID unless overridden
 * - All other fields use sensible defaults that can be overridden via `payloadOverrides`
 *
 * @example
 *   // Default random amount
 *   const msg = buildBookClientDepositMessage();
 *
 *   // Fixed amount
 *   const msg = buildBookClientDepositMessage({ Amount: 100.5 });
 *
 *   // Reuse an existing messageId (duplicate test)
 *   const msg = buildBookClientDepositMessage({}, existingMessageId);
 */
export function buildBookClientDepositMessage(
  payloadOverrides: Partial<BookClientDepositPayload> = {},
  messageId: string = randomUUID(),
): BookClientDepositMessage {
  const conversationId = randomUUID();
  const sentTime = new Date().toISOString();

  const amount = DataGenerator.amount(1, 10_000, 4);

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
      Amount: amount,
      CreatedByUser: 'PhoenixTest\\SR_HorizonAppUser',
      SettledDate: '2026-02-23T00:00:00',
      Reference: '12346789012',
      BundleNoSettled: 12345678907,
      MerchantId: 'GL_TEST01',
      ...payloadOverrides,
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

