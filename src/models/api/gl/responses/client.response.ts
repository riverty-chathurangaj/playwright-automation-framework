// Client as returned by GET /gl-service/{instanceId}/clients
export interface ClientResponse {
  orgno: string | null;
  globalId: number | null;
  name: string | null;
}
