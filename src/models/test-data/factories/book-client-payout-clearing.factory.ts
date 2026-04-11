import { randomUUID } from 'crypto';
import { DataGenerator } from '../../../utils/data-generator';

/**
 * MassTransit envelope for the BookClientPayoutClearing message.
 * The `message` field contains the GL-domain payload.
 */
export interface BookClientPayoutClearingMessage {
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
  message: BookClientPayoutClearingPayload;
  expirationTime: null;
  sentTime: string;
  headers: Record<string, unknown>;
  host: Record<string, unknown>;
}

export interface BookClientPayoutClearingPayload {
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
 * Builds a valid BookClientPayoutClearing RabbitMQ message.
 *
 * - `Amount` is a random number (4 decimal places) unless overridden
 * - `messageId` is a fresh UUID unless overridden
 * - All other fields use sensible defaults that can be overridden via `payloadOverrides`
 * - Internal clearing between merchant and partner client accounts after a partner settlement
 *
 * @example
 *   // Default random amount
 *   const msg = buildBookClientPayoutClearingMessage();
 *
 *   // Fixed amount
 *   const msg = buildBookClientPayoutClearingMessage({ Amount: 100.5 });
 *
 *   // Reuse an existing messageId (duplicate test)
 *   const msg = buildBookClientPayoutClearingMessage({}, existingMessageId);
 */
export function buildBookClientPayoutClearingMessage(
  payloadOverrides: Partial<BookClientPayoutClearingPayload> = {},
  messageId: string = randomUUID(),
): BookClientPayoutClearingMessage {
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
    sourceAddress: 'rabbitmqs://general-ledger/shared/generalledgers_GeneralLedgerP_bus?temporary=true',
    destinationAddress: 'rabbitmqs://general-ledger/shared/GeneralLedger:BookClientPayoutClearing',
    responseAddress: null,
    faultAddress: null,
    messageType: ['urn:message:GeneralLedger:BookClientPayoutClearing'],
    message: {
      InstanceId: 2022,
      ClientId: 60232,
      Source: 'settlement-service',
      Amount: amount,
      BundleNoHandledManual: 12345678901,
      CreatedByUser: 'PhoenixTest\\SR_HorizonAppUser',
      SettledDate: settledDate,
      Reference: '98745612308',
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
      machineName: 'generalledger-service-postingservice-bubblecontext-79cf47db845n',
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
