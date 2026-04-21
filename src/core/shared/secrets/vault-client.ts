import axios, { AxiosInstance } from 'axios';
import type { VaultConfig } from '@shared-core/config';

export interface VaultClientLike {
  loginAppRole(authPath: string, roleId: string, secretId: string): Promise<string>;
  readSecret(token: string, secretPath: string): Promise<unknown>;
}

export class VaultClient implements VaultClientLike {
  private readonly http: AxiosInstance;
  private readonly namespace: string;

  constructor(private readonly vaultConfig: VaultConfig) {
    this.namespace = vaultConfig.namespace.trim();
    this.http = axios.create({
      baseURL: this.normalizeBaseUrl(vaultConfig.addr),
      timeout: vaultConfig.timeout,
      headers: this.namespace ? { 'X-Vault-Namespace': this.namespace } : undefined,
    });
  }

  async loginAppRole(authPath: string, roleId: string, secretId: string): Promise<string> {
    const response = await this.http.post<{ auth?: { client_token?: string } }>(this.toApiPath(authPath), {
      role_id: roleId,
      secret_id: secretId,
    });

    const token = response.data?.auth?.client_token?.trim();
    if (!token) {
      throw new Error('Vault AppRole login succeeded but no client token was returned.');
    }

    return token;
  }

  async readSecret(token: string, secretPath: string): Promise<unknown> {
    const response = await this.http.get<unknown>(this.toApiPath(secretPath), {
      headers: {
        'X-Vault-Token': token,
      },
    });

    return response.data;
  }

  private normalizeBaseUrl(addr: string): string {
    return addr.replace(/\/+$/, '');
  }

  private toApiPath(pathValue: string): string {
    return `/v1/${pathValue.replace(/^\/+/, '')}`;
  }
}

export default VaultClient;
