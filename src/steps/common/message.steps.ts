import { Given, Then } from '../../fixtures';
import { DataTable } from 'playwright-bdd';
import { expect } from 'chai';
import type { CollectedMessage } from '../../messaging/consumer-harness';
import type { RabbitClient } from '../../messaging/rabbit-client';
import type { ConsumerHarness } from '../../messaging/consumer-harness';
import type { MessagePublisher } from '../../messaging/publisher';
import type { DLQMonitor } from '../../messaging/dlq-monitor';
import type { MessageValidator } from '../../messaging/message-validator';
import type { CurrentResponse } from '../../fixtures';

type MessagingFixtures = {
  rabbitClient: RabbitClient;
  consumerHarness: ConsumerHarness;
  messagePublisher: MessagePublisher;
  dlqMonitor: DLQMonitor;
  messageValidator: MessageValidator;
  store: (key: string, value: unknown) => void;
  retrieve: <T = unknown>(key: string) => T;
  currentResponse: CurrentResponse;
};

// ─── Setup ────────────────────────────────────────────────────────

Given('I am listening on exchange {string} with routing key {string}', async function (
  { consumerHarness }: Pick<MessagingFixtures, 'consumerHarness'>,
  exchange: string,
  routingKey: string,
) {
  await consumerHarness.startListening(exchange, routingKey);
});

Given('I am listening on existing exchange {string} with routing key {string}', async function (
  { consumerHarness }: Pick<MessagingFixtures, 'consumerHarness'>,
  exchange: string,
  routingKey: string,
) {
  await consumerHarness.startListening(exchange, routingKey, { exchangeType: false });
});

Given('I am listening on the dead-letter queue {string}', async function (
  { dlqMonitor }: Pick<MessagingFixtures, 'dlqMonitor'>,
  dlqName: string,
) {
  await dlqMonitor.startMonitoring(dlqName);
});

// ─── Message publishing (for injection scenarios) ─────────────────

Given('I publish a message to exchange {string} with routing key {string}:', async function (
  { rabbitClient, store }: Pick<MessagingFixtures, 'rabbitClient' | 'store'>,
  exchange: string,
  routingKey: string,
  docString: string,
) {
  const content = JSON.parse(docString);
  await rabbitClient.publish(exchange, routingKey, content);
  store('lastPublishedMessage', content);
});

Given('I publish a malformed message to exchange {string}:', async function (
  { messagePublisher }: Pick<MessagingFixtures, 'messagePublisher'>,
  exchange: string,
  dataTable: DataTable,
) {
  const row = dataTable.hashes()[0];
  await messagePublisher.publishMalformedMessage(exchange, row.routingKey || 'test.key');
});

// ─── Assertions ───────────────────────────────────────────────────

Then('I should receive {int} message(s) within {int} seconds', async function (
  { consumerHarness, store }: Pick<MessagingFixtures, 'consumerHarness' | 'store'>,
  count: number,
  seconds: number,
) {
  const messages = await consumerHarness.waitForMessages(count, seconds * 1000);
  expect(messages.length).to.be.at.least(count);
  store('lastMessages', messages);
  store('lastMessage', messages[0]);
});

Then('no messages should be received within {int} seconds', async function (
  { consumerHarness }: Pick<MessagingFixtures, 'consumerHarness'>,
  seconds: number,
) {
  await consumerHarness.assertNoMessages(seconds * 1000);
});

Then('the message should match schema {string}', function (
  { retrieve, messageValidator }: Pick<MessagingFixtures, 'retrieve' | 'messageValidator'>,
  schemaName: string,
) {
  const message = retrieve<CollectedMessage>('lastMessage');
  if (!message) throw new Error('No message collected. Use "I should receive N message" step first.');

  const result = messageValidator.validateSchema(message, schemaName);
  expect(
    result.valid,
    `Message schema validation failed for "${schemaName}":\n${result.errors?.map(e => `  ${e.path}: ${e.message}`).join('\n')}`,
  ).to.be.true;
});

Then('the message field {string} should equal {string}', function (
  { retrieve, messageValidator }: Pick<MessagingFixtures, 'retrieve' | 'messageValidator'>,
  field: string,
  expected: string,
) {
  const message = retrieve<CollectedMessage>('lastMessage');
  const actual = messageValidator.getField(message, field);
  expect(String(actual)).to.equal(expected);
});

Then('the message field {string} should equal {float}', function (
  { retrieve, messageValidator }: Pick<MessagingFixtures, 'retrieve' | 'messageValidator'>,
  field: string,
  expected: number,
) {
  const message = retrieve<CollectedMessage>('lastMessage');
  const actual = messageValidator.getField(message, field) as number;
  expect(actual).to.be.closeTo(expected, 0.001);
});

Then('the message field {string} should match the API response {string}', function (
  { retrieve, messageValidator, currentResponse }: Pick<MessagingFixtures, 'retrieve' | 'messageValidator' | 'currentResponse'>,
  msgField: string,
  apiField: string,
) {
  const message = retrieve<CollectedMessage>('lastMessage');
  const msgValue = messageValidator.getField(message, msgField);
  const { Comparator } = require('../../utils/comparator');
  const apiValue = Comparator.getNestedValue(currentResponse.body, apiField);
  expect(msgValue).to.equal(apiValue, `Message field "${msgField}" should match API response field "${apiField}"`);
});

Then('the message header {string} should equal {string}', function (
  { retrieve }: Pick<MessagingFixtures, 'retrieve'>,
  header: string,
  expected: string,
) {
  const message = retrieve<CollectedMessage>('lastMessage');
  const actual = message.headers[header];
  expect(String(actual)).to.equal(expected);
});

Then('the message property {string} should not be empty', function (
  { retrieve, messageValidator }: Pick<MessagingFixtures, 'retrieve' | 'messageValidator'>,
  property: string,
) {
  const message = retrieve<CollectedMessage>('lastMessage');
  const value = (message as unknown as Record<string, unknown>)[property] || messageValidator.getField(message, property);
  expect(value, `Message property "${property}" should not be empty`).to.be.ok;
});

Then('the messages should be in chronological order', function (
  { retrieve, messageValidator }: Pick<MessagingFixtures, 'retrieve' | 'messageValidator'>,
) {
  const messages = retrieve<CollectedMessage[]>('lastMessages');
  const ordered = messageValidator.validateOrdering(messages);
  expect(ordered, 'Messages are not in chronological order').to.be.true;
});

Then('each message should have a unique {string}', function (
  { retrieve, messageValidator }: Pick<MessagingFixtures, 'retrieve' | 'messageValidator'>,
  idField: string,
) {
  const messages = retrieve<CollectedMessage[]>('lastMessages');
  const unique = messageValidator.validateUniqueIds(messages, idField);
  expect(unique, `Duplicate "${idField}" values found in messages`).to.be.true;
});

Then('each message {string} should match its API response correlation', function (
  { retrieve, messageValidator }: Pick<MessagingFixtures, 'retrieve' | 'messageValidator'>,
  field: string,
) {
  const messages = retrieve<CollectedMessage[]>('lastMessages');
  if (messages.length > 0) {
    const message = messages[0];
    expect(message[field as keyof typeof message] || messageValidator.getField(message, field)).to.be.ok;
  }
});

// ─── DLQ Assertions ──────────────────────────────────────────────

Then('the message should appear in the DLQ within {int} seconds', async function (
  { dlqMonitor, store }: Pick<MessagingFixtures, 'dlqMonitor' | 'store'>,
  seconds: number,
) {
  const message = await dlqMonitor.assertMessageInDLQ(seconds * 1000);
  store('dlqMessage', message);
});

Then('the DLQ message header {string} should contain routing information', function (
  { retrieve }: Pick<MessagingFixtures, 'retrieve'>,
  header: string,
) {
  const message = retrieve<CollectedMessage>('dlqMessage');
  const value = message.headers[header];
  expect(value, `DLQ message header "${header}" should exist and contain routing info`).to.be.ok;
});

Then('the DLQ message header {string} should be {string}', function (
  { retrieve }: Pick<MessagingFixtures, 'retrieve'>,
  header: string,
  expected: string,
) {
  const message = retrieve<CollectedMessage>('dlqMessage');
  const actual = message.headers[header];
  expect(String(actual)).to.equal(expected);
});

Then('the message should be retried {int} times', async function (
  { dlqMonitor, messageValidator }: Pick<MessagingFixtures, 'dlqMonitor' | 'messageValidator'>,
  retries: number,
) {
  const message = await dlqMonitor.assertMessageInDLQ(30_000);
  const count = messageValidator.getDLQDeathCount(message);
  expect(count).to.be.at.least(retries);
});

Then('after retries are exhausted the message should appear in the DLQ', async function (
  { dlqMonitor, store }: Pick<MessagingFixtures, 'dlqMonitor' | 'store'>,
) {
  const message = await dlqMonitor.assertMessageInDLQ(30_000);
  store('dlqMessage', message);
  expect(message).to.be.ok;
});

Then('the DLQ message header {string} should be {int}', function (
  { retrieve, messageValidator }: Pick<MessagingFixtures, 'retrieve' | 'messageValidator'>,
  header: string,
  expected: number,
) {
  const message = retrieve<CollectedMessage>('dlqMessage');
  const count = messageValidator.getDLQDeathCount(message);
  expect(count).to.equal(expected);
});
