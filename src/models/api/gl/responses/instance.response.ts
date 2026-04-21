// Instance as returned by GET /gl-service/instances
export interface InstanceResponse {
  id: number;
  name: string | null;
  sourceSystemId: number | null;
  countryCode: string | null;
  countryId: number | null;
  isActive: boolean;
}
