/**
 * .ai/config.ts — Reference / documentation only.
 *
 * The live AI configuration is in src/core/config.ts (AIConfig interface)
 * and the AI client is instantiated in src/support/ai-enricher.ts.
 * This file documents the available providers and models for quick reference.
 */

// ── Active provider ──────────────────────────────────────────────────────────
// Set AI_PROVIDER in .env to switch providers.
// Active deployment: azure-openai → o4-mini on Azure OpenAI Service
export const ACTIVE_PROVIDER = 'azure-openai' as const;

// ── Supported providers ───────────────────────────────────────────────────────
export const AI_PROVIDERS = {
  'azure-openai': {
    description: 'Azure OpenAI Service (primary)',
    envVars: ['OPENAI_API_KEY', 'OPENAI_ENDPOINT', 'OPENAI_API_VERSION', 'AI_MODEL'],
    models: ['o4-mini'],
    notes: 'Uses max_completion_tokens (not max_tokens). Reasoning model — no temperature support.',
  },
  openai: {
    description: 'OpenAI API (direct)',
    envVars: ['OPENAI_API_KEY', 'AI_MODEL'],
    models: ['gpt-4o', 'gpt-4o-mini'],
    notes: 'Uses responses.create() API.',
  },
  anthropic: {
    description: 'Anthropic Claude',
    envVars: ['ANTHROPIC_API_KEY', 'AI_MODEL'],
    models: ['claude-opus-4-6', 'claude-sonnet-4-6', 'claude-haiku-4-5-20251001'],
    notes: 'Uses messages.create() API.',
  },
} as const;

// ── Defaults ──────────────────────────────────────────────────────────────────
export const AI_DEFAULTS = {
  maxTokens: 4096,
  systemContext: `GL (General Ledger) API test automation framework.
Domain: double-entry bookkeeping, chart of accounts, fiscal periods,
journal entries, trial balance, ISO 4217 currencies, financial precision.`,
} as const;
