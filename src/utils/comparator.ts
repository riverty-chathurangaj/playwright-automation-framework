/**
 * Deep comparison utilities for API response validation.
 * Supports partial matching, type-aware comparison, and financial precision.
 */

export type CompareResult = {
  match: boolean;
  differences: Difference[];
};

export type Difference = {
  path: string;
  expected: unknown;
  actual: unknown;
  reason: string;
};

export class Comparator {
  // Full deep equality check
  static deepEqual(actual: unknown, expected: unknown, path: string = 'root'): CompareResult {
    const differences: Difference[] = [];
    Comparator.collectDifferences(actual, expected, path, differences);
    return { match: differences.length === 0, differences };
  }

  // Partial match: actual must contain all expected fields (allows extra fields)
  static partialMatch(actual: unknown, expected: unknown, path: string = 'root'): CompareResult {
    const differences: Difference[] = [];
    Comparator.collectPartialDifferences(actual, expected, path, differences);
    return { match: differences.length === 0, differences };
  }

  // Compare specific field value
  static fieldEquals(obj: Record<string, unknown>, fieldPath: string, expectedValue: unknown): boolean {
    const actual = Comparator.getNestedValue(obj, fieldPath);
    return Comparator.valuesEqual(actual, expectedValue);
  }

  // Get nested field value via dot notation: "data.amount"
  static getNestedValue(obj: Record<string, unknown>, path: string): unknown {
    const parts = path.split('.');
    let current: unknown = obj;

    for (const part of parts) {
      if (current === null || current === undefined) return undefined;
      current = (current as Record<string, unknown>)[part];
    }

    return current;
  }

  // Check if object contains a path
  static hasField(obj: Record<string, unknown>, fieldPath: string): boolean {
    const value = Comparator.getNestedValue(obj, fieldPath);
    return value !== undefined;
  }

  // Financial amount comparison with precision tolerance
  static amountsEqual(actual: number, expected: number, tolerance: number = 0.001): boolean {
    return Math.abs(actual - expected) <= tolerance;
  }

  // Snapshot diff — compare before/after state
  static snapshotDiff(before: Record<string, unknown>, after: Record<string, unknown>): {
    added: string[];
    removed: string[];
    changed: Array<{ field: string; from: unknown; to: unknown }>;
  } {
    const beforeKeys = new Set(Object.keys(before));
    const afterKeys = new Set(Object.keys(after));

    const added = [...afterKeys].filter(k => !beforeKeys.has(k));
    const removed = [...beforeKeys].filter(k => !afterKeys.has(k));
    const changed: Array<{ field: string; from: unknown; to: unknown }> = [];

    for (const key of beforeKeys) {
      if (afterKeys.has(key) && !Comparator.valuesEqual(before[key], after[key])) {
        changed.push({ field: key, from: before[key], to: after[key] });
      }
    }

    return { added, removed, changed };
  }

  private static valuesEqual(a: unknown, b: unknown): boolean {
    if (a === b) return true;
    if (a === null || b === null) return a === b;
    if (typeof a !== typeof b) return false;

    if (typeof a === 'number' && typeof b === 'number') {
      return Comparator.amountsEqual(a, b);
    }

    if (Array.isArray(a) && Array.isArray(b)) {
      if (a.length !== b.length) return false;
      return a.every((item, index) => Comparator.valuesEqual(item, b[index]));
    }

    if (typeof a === 'object' && typeof b === 'object') {
      const aObj = a as Record<string, unknown>;
      const bObj = b as Record<string, unknown>;
      const aKeys = Object.keys(aObj);
      const bKeys = Object.keys(bObj);
      if (aKeys.length !== bKeys.length) return false;
      return aKeys.every(key => Comparator.valuesEqual(aObj[key], bObj[key]));
    }

    return false;
  }

  private static collectDifferences(
    actual: unknown,
    expected: unknown,
    path: string,
    differences: Difference[],
  ): void {
    if (Comparator.valuesEqual(actual, expected)) return;

    if (typeof expected === 'object' && expected !== null && typeof actual === 'object' && actual !== null) {
      const expObj = expected as Record<string, unknown>;
      const actObj = actual as Record<string, unknown>;

      for (const key of new Set([...Object.keys(expObj), ...Object.keys(actObj)])) {
        Comparator.collectDifferences(actObj[key], expObj[key], `${path}.${key}`, differences);
      }
    } else {
      differences.push({
        path,
        expected,
        actual,
        reason: `Expected ${JSON.stringify(expected)} but got ${JSON.stringify(actual)}`,
      });
    }
  }

  private static collectPartialDifferences(
    actual: unknown,
    expected: unknown,
    path: string,
    differences: Difference[],
  ): void {
    if (expected === null || expected === undefined) return;

    if (typeof expected === 'object' && !Array.isArray(expected)) {
      if (typeof actual !== 'object' || actual === null) {
        differences.push({
          path,
          expected,
          actual,
          reason: `Expected object but got ${typeof actual}`,
        });
        return;
      }

      const expObj = expected as Record<string, unknown>;
      const actObj = actual as Record<string, unknown>;

      for (const key of Object.keys(expObj)) {
        Comparator.collectPartialDifferences(actObj[key], expObj[key], `${path}.${key}`, differences);
      }
    } else {
      if (!Comparator.valuesEqual(actual, expected)) {
        differences.push({
          path,
          expected,
          actual,
          reason: `Expected ${JSON.stringify(expected)} but got ${JSON.stringify(actual)}`,
        });
      }
    }
  }
}
