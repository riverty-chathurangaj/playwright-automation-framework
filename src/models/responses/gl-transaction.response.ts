// GL Transaction as returned by GET /gl-service/{instanceId}/transactions
export interface GLTransactionResponse {
  voucherNo: number;
  clientOrgNo: string | null;
  clientName: string | null;
  bundleNo: number;
  registrationDate: string;
  registrationBy: string | null;
  voucherDate: string;
  accountingYearMonth: number;
  postingNo: number;
  postingName: string | null;
  glAccount: string | null;
  glAccountName: string | null;
  amount: number;
  customerNo: string | null;
  invoiceNo: string | null;
  paymentDate: string | null;
  settlementDate: string | null;
  reference: string | null;
  bankAccount: string | null;
  eventVariantId: number | null;
  count: number | null;
  ssoNumber: string | null;
}
