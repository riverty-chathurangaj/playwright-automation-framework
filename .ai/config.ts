import Anthropic from '@anthropic-ai/sdk';
import { config } from '../src/core/config';

export const anthropicClient = new Anthropic({ apiKey: config.ai.apiKey });

export const AI_MODELS = {
  primary: 'claude-opus-4-6',
  fast: 'claude-sonnet-4-6',
  mini: 'claude-haiku-4-5-20251001',
} as const;

export const AI_DEFAULTS = {
  temperature: 0.3,       // Low temperature for consistent, deterministic outputs
  maxTokens: 4096,
  systemPrompt: `You are an expert test automation engineer specializing in financial API testing.
You understand GL (General Ledger) domain concepts including:
- Double-entry bookkeeping (debits must equal credits)
- Chart of accounts structure
- Fiscal periods, journal entries, and trial balance
- ISO 4217 currency codes
- Financial data precision requirements (2 decimal places standard)

Your primary role is to generate comprehensive, accurate BDD test scenarios in Gherkin syntax
and to provide insightful analysis of test failures in financial API systems.`,
} as const;
