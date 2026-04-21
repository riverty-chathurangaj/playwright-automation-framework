// GLAccountBalance as returned by GET /gl-service/{instanceId}/balance
export interface GLAccountBalanceResponse {
  account: string | null;
  accountName: string | null;
  inBalance: number;
  balanceChange: number;
  outBalance: number;
}

// GLAccountBalanceListingModel as returned by GET /gl-service/{instanceId}/balance/listing
export interface GLAccountBalanceListingResponse {
  account: string | null;
  accountName: string | null;
  orgnoClient: string | null;
  clientName: string | null;
  inBalance: number;
  balanceChange: number;
  outBalance: number;
  date: string;
  accountingYearMonth: number | null;
  ssoNumber: string | null;
}
