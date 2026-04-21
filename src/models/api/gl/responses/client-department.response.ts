// Client department as returned by GET /gl-service/{instanceId}/clients/departments
export interface ClientDepartmentResponse {
  recno: number;
  name: string;
  description: string | null;
}
