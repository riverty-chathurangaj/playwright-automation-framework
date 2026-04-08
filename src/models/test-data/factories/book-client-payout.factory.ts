import { randomUUID } from 'crypto';
import { DataGenerator } from '../../../utils/data-generator';

/**
 * MassTransit envelope for the BookClientPayout message.
 * The `message` field contains the GL-domain payload.
 */
export interface BookClientPayoutMessage {
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
  message: BookClientPayoutPayload;
  expirationTime: null;
  sentTime: string;
  headers: Record<string, unknown>;
  host: Record<string, unknown>;
}

export interface BookClientPayoutPayload {
  InstanceId: number;
  ClientId: number;
  Source: string;
  Amount: number;
  BundleNoHandledManual: number;
  CreatedByUser: string;
  SettledDate: string;
  Reference: string;
  MerchantId: string;
}

/**
 * Builds a valid BookClientPayout RabbitMQ message.
 *
 * - `Amount` is a random number (4 decimal places) unless overridden
 * - `messageId` is a fresh UUID unless overridden
 * - All other fields use sensible defaults that can be overridden via `payloadOverrides`
 * - Uses `BundleNoHandledManual` (payout bundle handled manually, not auto-settled)
 *
 * @example
 *   // Default random amount
 *   const msg = buildBookClientPayoutMessage();
 *
 *   // Fixed amount
 *   const msg = buildBookClientPayoutMessage({ Amount: 100.5 });
 *
 *   // Reuse an existing messageId (duplicate test)
 *   const msg = buildBookClientPayoutMessage({}, existingMessageId);
 */
export function buildBookClientPayoutMessage(
  payloadOverrides: Partial<BookClientPayoutPayload> = {},
  messageId: string = randomUUID(),
): BookClientPayoutMessage {
  const conversationId = randomUUID();
  const sentTime = new Date().toISOString();

  const amount = DataGenerator.amount(1, 10_000, 4);

  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const settledDate = `${year}-${month}-23T00:00:00`;

  return {
    messageId,
    requestId: null,
    correlationId: null,
    conversationId,
    initiatorId: null,
    sourceAddress:
      'rabbitmqs://rabbitmq-general-dev.riverty.io/shared/generalledgers_GeneralLedgerP_bus_yryyyybouip3iwkabdxgxhuxd3?temporary=true',
    destinationAddress:
      'rabbitmqs://rabbitmq-general-dev.riverty.io/shared/GeneralLedger:BookClientPayout',
    responseAddress: null,
    faultAddress: null,
    messageType: ['urn:message:GeneralLedger:BookClientPayout'],
    message: {
      InstanceId: 2022,
      ClientId: 60232,
      Source: 'settlement-service',
      Amount: amount,
      BundleNoHandledManual: 12345678905,
      CreatedByUser: 'PhoenixTest\\SR_HorizonAppUser',
      SettledDate: settledDate,
      Reference: '12346789012',
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
