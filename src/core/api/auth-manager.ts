import { config } from '@shared-core/config';
import { logger } from '@shared-core/logger';

interface TokenCache {
  accessToken: string;
  expiresAt: number;
}

export class AuthManager {
  private m2mTokenCache: TokenCache | null = null;
  private staticTokens: Map<string, TokenCache> = new Map();
  private currentRole: string = 'default';
  private authDisabled: boolean = false;

  private isTokenValid(cache: TokenCache): boolean {
    // Expire 60 seconds early to avoid edge cases
    return Date.now() < cache.expiresAt - 60_000;
  }

  private async acquireTokenViaClientCredentials(): Promise<{ token: string; expiresIn: number }> {
    const tokenEndpoint = `${config.auth.baseUrl}/oauth/token`;

    const response = await fetch(tokenEndpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        grant_type: 'client_credentials',
        client_id: config.auth.clientId,
        client_secret: config.auth.clientSecret,
        audience: config.auth.audience,
      }),
    });

    if (!response.ok) {
      const errorBody = await response.text().catch(() => '');
      throw new Error(`Token endpoint returned HTTP ${response.status}: ${errorBody}`);
    }

    const data = (await response.json()) as { access_token?: string; expires_in?: number };

    if (!data.access_token) {
      throw new Error('No access_token found in token endpoint response');
    }

    return { token: data.access_token, expiresIn: data.expires_in ?? 3600 };
  }

  async getToken(role: string = this.currentRole): Promise<string> {
    if (this.authDisabled) {
      return '';
    }

    // Static tokens take precedence — used for negative testing (expired / invalid tokens)
    const staticCache = this.staticTokens.get(role);
    if (staticCache && this.isTokenValid(staticCache)) {
      return staticCache.accessToken;
    }

    if (this.m2mTokenCache && this.isTokenValid(this.m2mTokenCache)) {
      return this.m2mTokenCache.accessToken;
    }

    logger.debug('Acquiring M2M client credentials token');

    if (!config.auth.baseUrl || !config.auth.clientId || !config.auth.clientSecret) {
      logger.warn('Auth not configured — running without authentication');
      return '';
    }

    try {
      const { token, expiresIn } = await this.acquireTokenViaClientCredentials();
      this.m2mTokenCache = {
        accessToken: token,
        expiresAt: Date.now() + expiresIn * 1000,
      };

      logger.debug('M2M client credentials token acquired', { expiresIn });
      return token;
    } catch (error) {
      logger.error('Failed to acquire M2M token', { error });
      throw new Error(`M2M authentication failed: ${(error as Error).message}`);
    }
  }

  async getAuthHeaders(role?: string): Promise<Record<string, string>> {
    const token = await this.getToken(role || this.currentRole);
    if (!token) return {};
    return { Authorization: `Bearer ${token}` };
  }

  setCurrentRole(role: string): void {
    this.currentRole = role;
    this.authDisabled = false;
  }

  clearTokens(): void {
    this.m2mTokenCache = null;
    this.staticTokens.clear();
    this.authDisabled = true;
  }

  // For negative testing — inject a static token without hitting the token endpoint
  setStaticToken(token: string, role: string = 'default'): void {
    this.authDisabled = false;
    this.staticTokens.set(role, {
      accessToken: token,
      expiresAt: Date.now() + 3_600_000,
    });
  }
}
