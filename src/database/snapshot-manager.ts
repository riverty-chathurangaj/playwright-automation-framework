import { logger } from '../core/logger';

export interface Snapshot {
  label: string;
  data: Record<string, unknown> | null;
  capturedAt: Date;
}

export interface SnapshotComparison {
  label: string;
  before: Record<string, unknown> | null;
  after: Record<string, unknown> | null;
  balanceDelta?: number;
  changes: FieldChange[];
  hasChanges: boolean;
}

export interface FieldChange {
  field: string;
  before: unknown;
  after: unknown;
}

export class SnapshotManager {
  private snapshots: Map<string, Snapshot> = new Map();

  async captureSnapshot(label: string, queryFn: () => Promise<Record<string, unknown> | null>): Promise<void> {
    const data = await queryFn();
    this.snapshots.set(label, {
      label,
      data,
      capturedAt: new Date(),
    });
    logger.debug('Snapshot captured', { label, hasData: data !== null });
  }

  async compareSnapshot(
    label: string,
    queryFn: () => Promise<Record<string, unknown> | null>,
  ): Promise<SnapshotComparison> {
    const before = this.snapshots.get(label);
    if (!before) {
      throw new Error(`No snapshot found with label "${label}". Call captureSnapshot() first.`);
    }

    const afterData = await queryFn();
    const changes = this.detectChanges(before.data, afterData);

    let balanceDelta: number | undefined;
    if (before.data?.balance !== undefined && afterData?.balance !== undefined) {
      balanceDelta = (afterData.balance as number) - (before.data.balance as number);
      balanceDelta = parseFloat(balanceDelta.toFixed(2));
    }

    return {
      label,
      before: before.data,
      after: afterData,
      balanceDelta,
      changes,
      hasChanges: changes.length > 0,
    };
  }

  getSnapshot(label: string): Snapshot | undefined {
    return this.snapshots.get(label);
  }

  private detectChanges(
    before: Record<string, unknown> | null,
    after: Record<string, unknown> | null,
  ): FieldChange[] {
    const changes: FieldChange[] = [];

    if (!before && !after) return changes;
    if (!before && after) {
      for (const [field, value] of Object.entries(after)) {
        changes.push({ field, before: undefined, after: value });
      }
      return changes;
    }
    if (before && !after) {
      for (const [field, value] of Object.entries(before)) {
        changes.push({ field, before: value, after: undefined });
      }
      return changes;
    }

    const allFields = new Set([
      ...Object.keys(before as Record<string, unknown>),
      ...Object.keys(after as Record<string, unknown>),
    ]);

    for (const field of allFields) {
      const beforeVal = (before as Record<string, unknown>)[field];
      const afterVal = (after as Record<string, unknown>)[field];

      if (JSON.stringify(beforeVal) !== JSON.stringify(afterVal)) {
        changes.push({ field, before: beforeVal, after: afterVal });
      }
    }

    return changes;
  }

  clear(): void {
    this.snapshots.clear();
  }
}
