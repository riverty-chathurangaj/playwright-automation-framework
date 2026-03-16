/**
 * Exchange registry — maps human-readable labels used in feature files
 * to the actual RabbitMQ exchange names and default routing keys.
 *
 * Usage in .feature files:
 *   Given I am listening on "general ledger posting service"
 *   When I publish the message to "general ledger posting service"
 *
 * Mirrors the pattern in src/utils/http-status.ts.
 */

export interface ExchangeEntry {
  exchange: string;
  routingKey: string;
}

const EXCHANGES: Record<string, ExchangeEntry> = {
  'general ledger posting service': {
    exchange: 'finance.general-ledger-posting-service',
    routingKey: '',
  },
  'general ledger posting service error': {
    exchange: 'finance.general-ledger-posting-service_error',
    routingKey: '',
  },
};

/**
 * Resolve a friendly label to the concrete exchange name + default routing key.
 * Labels are matched case-insensitively.
 */
export function resolveExchange(label: string): ExchangeEntry {
  const entry = EXCHANGES[label.toLowerCase()];
  if (!entry) {
    throw new Error(
      `Unknown exchange label "${label}". Known labels: ${Object.keys(EXCHANGES).join(', ')}`,
    );
  }
  return entry;
}
