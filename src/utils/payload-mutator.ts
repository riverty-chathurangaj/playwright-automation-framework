/**
 * PayloadMutator — enables unrestricted negative testing by applying
 * configurable corruptions to valid request payloads.
 *
 * This is the core advantage of using TypeScript over .NET for testing:
 * we can assign ANY value to ANY field without compile-time restrictions.
 */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type Payload = Record<string, any>;

export type CorruptionType =
  | 'string-in-numeric'
  | 'overflow'
  | 'negative-amount'
  | 'null'
  | 'missing'
  | 'empty-string'
  | 'exceed-max-length'
  | 'sql-injection'
  | 'special-chars'
  | 'wrong-type-array'
  | 'wrong-type-object'
  | 'unicode'
  | 'whitespace-only'
  | 'boolean'
  | 'zero'
  | 'negative-integer'
  | 'float-precision-overflow'
  | 'invalid-uuid'
  | 'invalid-date'
  | 'invalid-currency'
  | 'xss-payload'
  | 'crlf-injection';

export interface MutationSpec {
  field: string;
  corruption: CorruptionType;
  customValue?: unknown;
}

export class PayloadMutator {
  static corruptField(payload: Payload, field: string, corruption: CorruptionType): Payload {
    const mutated = structuredClone(payload);
    const value = PayloadMutator.getCorruptionValue(corruption);
    PayloadMutator.setNestedField(mutated, field, value);
    return mutated;
  }

  private static getCorruptionValue(corruption: CorruptionType): unknown {
    switch (corruption) {
      case 'string-in-numeric':         return 'not-a-number';
      case 'overflow':                  return Number.MAX_SAFE_INTEGER + 1;
      case 'negative-amount':           return -99999.99;
      case 'null':                      return null;
      case 'missing':                   return undefined; // handled by setNestedField
      case 'empty-string':              return '';
      case 'exceed-max-length':         return 'x'.repeat(10_000);
      case 'sql-injection':             return "'; DROP TABLE gl_accounts; --";
      case 'special-chars':             return '<>&\'"\\{}[]|`^~';
      case 'wrong-type-array':          return [1, 'two', 3];
      case 'wrong-type-object':         return { unexpected: true, nested: { value: 42 } };
      case 'unicode':                   return '日本語テスト 한국어 中文 العربية';
      case 'whitespace-only':           return '   \t\n   ';
      case 'boolean':                   return true;
      case 'zero':                      return 0;
      case 'negative-integer':          return -1;
      case 'float-precision-overflow':  return 1.123456789012345678;
      case 'invalid-uuid':              return 'not-a-valid-uuid-format';
      case 'invalid-date':              return '31-13-2025'; // invalid month
      case 'invalid-currency':          return 'INVALID';
      case 'xss-payload':               return '<script>alert("xss")</script>';
      case 'crlf-injection':            return "value\r\nX-Injected: header";
      default:
        throw new Error(`Unknown corruption type: ${corruption}`);
    }
  }

  // Supports dot-notation for nested fields: "data.amount"
  private static setNestedField(obj: Payload, path: string, value: unknown): void {
    const parts = path.split('.');
    let current = obj;

    for (let i = 0; i < parts.length - 1; i++) {
      if (current[parts[i]] === undefined || current[parts[i]] === null) {
        current[parts[i]] = {};
      }
      current = current[parts[i]];
    }

    const lastKey = parts[parts.length - 1];
    if (value === undefined) {
      delete current[lastKey];
    } else {
      current[lastKey] = value;
    }
  }

  // Apply multiple mutations at once
  static applyMutations(payload: Payload, mutations: MutationSpec[]): Payload {
    let mutated = structuredClone(payload);
    for (const { field, corruption, customValue } of mutations) {
      if (customValue !== undefined) {
        PayloadMutator.setNestedField(mutated, field, customValue);
      } else {
        mutated = PayloadMutator.corruptField(mutated, field, corruption);
      }
    }
    return mutated;
  }

  // Generate all corruption variants for a field — used for exhaustive negative testing
  static generateAllCorruptions(payload: Payload, field: string): Array<{ corruption: CorruptionType; payload: Payload }> {
    const corruptions: CorruptionType[] = [
      'null', 'missing', 'empty-string', 'whitespace-only',
      'string-in-numeric', 'overflow', 'negative-amount',
      'exceed-max-length', 'sql-injection', 'special-chars',
      'wrong-type-array', 'wrong-type-object', 'unicode',
      'xss-payload', 'crlf-injection',
    ];

    return corruptions.map(corruption => ({
      corruption,
      payload: PayloadMutator.corruptField(payload, field, corruption),
    }));
  }

  // Deep merge — useful for overriding specific nested fields without full mutation
  static merge(base: Payload, overrides: Payload): Payload {
    const result = structuredClone(base);
    for (const [key, value] of Object.entries(overrides)) {
      if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
        result[key] = PayloadMutator.merge(result[key] || {}, value);
      } else {
        result[key] = value;
      }
    }
    return result;
  }

  // Remove a field — for "missing required field" tests
  static removeField(payload: Payload, field: string): Payload {
    return PayloadMutator.corruptField(payload, field, 'missing');
  }

  // Set custom value — for domain-specific invalid values
  static setField(payload: Payload, field: string, value: unknown): Payload {
    const mutated = structuredClone(payload);
    PayloadMutator.setNestedField(mutated, field, value);
    return mutated;
  }
}
