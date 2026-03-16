import { faker } from '@faker-js/faker';

// GL-domain-specific fake data generators
export class DataGenerator {

  // --- Account Code ---
  static accountCode(digits: number = 4): string {
    return faker.string.numeric({ length: digits, allowLeadingZeros: false });
  }

  static accountCodeWithPrefix(prefix: string, digits: number = 4): string {
    return `${prefix}${faker.string.numeric({ length: digits })}`;
  }

  // Test data always prefixed — easily identifiable & cleanable
  static testAccountCode(): string {
    return `TEST-${faker.string.numeric({ length: 4 })}`;
  }

  // --- Currency ---
  static currencyCode(): string {
    const currencies = ['EUR', 'USD', 'GBP', 'CHF', 'NOK', 'SEK', 'DKK', 'PLN', 'CZK', 'HUF'];
    return faker.helpers.arrayElement(currencies);
  }

  static invalidCurrencyCode(): string {
    return faker.helpers.arrayElement(['INVALID', 'XYZ', 'ABC', '123', '', 'EU', 'EURO']);
  }

  // --- Amounts ---
  static amount(min: number = 0.01, max: number = 100_000, decimals: number = 2): number {
    const raw = faker.number.float({ min, max });
    return parseFloat(raw.toFixed(decimals));
  }

  static balancedDebitCredit(): { debitAmount: number; creditAmount: number } {
    const amount = DataGenerator.amount(100, 50_000);
    return { debitAmount: amount, creditAmount: amount };
  }

  static unbalancedDebitCredit(): { debitAmount: number; creditAmount: number } {
    const debit = DataGenerator.amount(100, 50_000);
    const credit = debit + faker.number.float({ min: 0.01, max: 100 });
    return {
      debitAmount: parseFloat(debit.toFixed(2)),
      creditAmount: parseFloat(credit.toFixed(2)),
    };
  }

  // --- Dates ---
  static postingDate(offsetDays: number = 0): string {
    const date = new Date();
    date.setDate(date.getDate() + offsetDays);
    return date.toISOString().split('T')[0]; // YYYY-MM-DD
  }

  static pastPostingDate(maxDaysAgo: number = 90): string {
    const daysAgo = faker.number.int({ min: 1, max: maxDaysAgo });
    return DataGenerator.postingDate(-daysAgo);
  }

  static fiscalYearBoundary(year: number = new Date().getFullYear()): string[] {
    return [
      `${year}-01-01`, // First day
      `${year}-12-31`, // Last day
      `${year}-03-31`, // Q1 end
      `${year}-06-30`, // Q2 end
      `${year}-09-30`, // Q3 end
    ];
  }

  static invalidDate(): string {
    return faker.helpers.arrayElement([
      '31-13-2025',     // invalid month
      '2025-02-29',     // not a leap year
      'not-a-date',     // string
      '2025-00-01',     // month zero
      '2025-01-00',     // day zero
    ]);
  }

  // --- Account Types ---
  static accountType(): string {
    return faker.helpers.arrayElement(['Asset', 'Liability', 'Equity', 'Revenue', 'Expense']);
  }

  // --- Names & Descriptions ---
  static accountName(): string {
    const prefixes = ['Cash', 'Bank', 'Trade', 'Accrued', 'Deferred', 'Prepaid', 'Retained'];
    const suffixes = ['Account', 'Receivables', 'Payables', 'Income', 'Expenses', 'Assets', 'Equity'];
    return `${faker.helpers.arrayElement(prefixes)} ${faker.helpers.arrayElement(suffixes)}`;
  }

  static journalDescription(): string {
    const templates = [
      `Invoice #${faker.string.alphanumeric(8).toUpperCase()} payment`,
      `Monthly accrual - ${faker.date.month()}`,
      `Reversal of ${faker.string.alphanumeric(6).toUpperCase()}`,
      `Payroll for period ending ${DataGenerator.pastPostingDate(7)}`,
      `Depreciation charge Q${faker.number.int({ min: 1, max: 4 })}`,
    ];
    return faker.helpers.arrayElement(templates);
  }

  // --- UUIDs ---
  static uuid(): string {
    return faker.string.uuid();
  }

  // --- Reference Numbers ---
  static referenceNumber(): string {
    return `REF-${Date.now()}-${faker.string.alphanumeric(6).toUpperCase()}`;
  }

  static correlationId(): string {
    return faker.string.uuid();
  }

  // --- GL Account Payload Builder ---
  static glAccountPayload(overrides: Record<string, unknown> = {}): Record<string, unknown> {
    return {
      accountCode: DataGenerator.testAccountCode(),
      accountName: DataGenerator.accountName(),
      accountType: DataGenerator.accountType(),
      currency: DataGenerator.currencyCode(),
      isActive: true,
      description: faker.lorem.sentence(),
      ...overrides,
    };
  }

  // --- Journal Entry Payload Builder ---
  static journalEntryPayload(overrides: Record<string, unknown> = {}): Record<string, unknown> {
    const { debitAmount, creditAmount } = DataGenerator.balancedDebitCredit();
    return {
      accountCode: DataGenerator.testAccountCode(),
      debitAmount,
      creditAmount,
      currency: DataGenerator.currencyCode(),
      postingDate: DataGenerator.postingDate(),
      description: DataGenerator.journalDescription(),
      reference: DataGenerator.referenceNumber(),
      ...overrides,
    };
  }
}
