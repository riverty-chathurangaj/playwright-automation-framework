// GL posting as returned by GET /gl-service/{instanceId}/postings
export interface GLPostingResponse {
  id: number;
  postingId: number;
  number: number | null;
  name: string | null;
  description: string | null;
  reno_AccountPlan: number;
}

