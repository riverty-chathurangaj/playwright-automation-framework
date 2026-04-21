import { randomUUID } from 'crypto';
import { DataGenerator } from '@api-utils/data-generator';

/**
 * MassTransit envelope for the BookPartnerDeposit message.
 * The `message` field contains the GL-domain payload.
 */
export interface BookPartnerDepositMessage {
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
  message: BookPartnerDepositPayload;
  expirationTime: null;
  sentTime: string;
  headers: Record<string, unknown>;
  host: Record<string, unknown>;
}

export interface BookPartnerDepositPayload {
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
 * Builds a valid BookPartnerDeposit RabbitMQ message.
 *
 * - `Amount` is a random number (4 decimal places) unless overridden
 * - `messageId` is a fresh UUID unless overridden
 * - All other fields use sensible defaults that can be overridden via `payloadOverrides`
 *
 * @example
 *   // Default random amount
 *   const msg = buildBookPartnerDepositMessage();
 *
 *   // Fixed amount
 *   const msg = buildBookPartnerDepositMessage({ Amount: 100.5 });
 *
 *   // Reuse an existing messageId (duplicate test)
 *   const msg = buildBookPartnerDepositMessage({}, existingMessageId);
 */
export function buildBookPartnerDepositMessage(
  payloadOverrides: Partial<BookPartnerDepositPayload> = {},
  messageId: string = randomUUID(),
): BookPartnerDepositMessage {
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
    destinationAddress: 'rabbitmqs://general-ledger/shared/GeneralLedger:BookPartnerDeposit',
    responseAddress: null,
    faultAddress: null,
    messageType: ['urn:message:GeneralLedger:BookPartnerDeposit'],
    message: {
      InstanceId: 2022,
      ClientId: 60232,
      Source: 'settlement-service',
      Amount: amount,
      CreatedByUser: 'PhoenixTest\\SR_HorizonAppUser',
      SettledDate: settledDate,
      Reference: '77777777331',
      BundleNoSettled: 77777777331,
      MerchantId: 'GL_TEST01',
      ...payloadOverrides,
    },
    expirationTime: null,
    sentTime,
    headers: {
      context: 'GeneralLedger.PostingService.BubbleContext',
      source: 'settlement-service',
      callLogId: 310863501,
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
