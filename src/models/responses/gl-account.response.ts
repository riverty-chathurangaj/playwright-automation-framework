// GLAccount as returned by GET /gl-service/{instanceId}/accounts
export interface GLAccountResponse {
  account: string | null;
  description: string | null;
}
