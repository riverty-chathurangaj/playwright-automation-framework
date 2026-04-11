import { request, APIRequestContext, APIResponse } from 'playwright';
import { config } from './config';
import { AuthManager } from './auth-manager';
import { logRequest, logResponse } from './logger';
import { RetryHandler } from './retry-handler';

export interface RequestOptions {
  body?: unknown;
  queryParams?: Record<string, string | number | boolean>;
  headers?: Record<string, string>;
  skipAuth?: boolean;
  correlationId?: string;
}

export interface ApiResponse<T = unknown> {
  status: number;
  body: T;
  headers: Record<string, string>;
  duration: number;
  correlationId?: string;
}

export class ApiClient {
  private context!: APIRequestContext;
  private authManager: AuthManager;
  private retryHandler: RetryHandler;
  private baseUrl: string;
  private ownsContext = true;

  constructor(baseUrl: string = config.baseUrl) {
    this.baseUrl = baseUrl;
    this.authManager = new AuthManager();
    this.retryHandler = new RetryHandler();
  }

  async init(existingContext?: APIRequestContext): Promise<void> {
    if (existingContext) {
      // Use the Playwright-managed context (enables tracing via playwright.config.ts)
      this.context = existingContext;
      this.ownsContext = false;
    } else {
      this.context = await request.newContext({
        baseURL: this.baseUrl,
        extraHTTPHeaders: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
          'X-Test-Run-Id': config.gitSha,
          'X-Framework': 'pw-testforge-gls',
        },
        ignoreHTTPSErrors: true,
        timeout: config.apiTimeout,
      });
      this.ownsContext = true;
    }
  }

  async dispose(): Promise<void> {
    // Only dispose if we created the context ourselves — Playwright manages its own
    if (this.ownsContext) {
      await this.context?.dispose();
    }
  }

  private async buildHeaders(options?: RequestOptions, role?: string): Promise<Record<string, string>> {
    const headers: Record<string, string> = {};

    if (!options?.skipAuth) {
      const authHeaders = await this.authManager.getAuthHeaders(role);
      Object.assign(headers, authHeaders);
    }

    if (options?.correlationId) {
      headers['X-Correlation-Id'] = options.correlationId;
    }

    if (options?.headers) {
      Object.assign(headers, options.headers);
    }

    return headers;
  }

  private async executeRequest(
    method: 'get' | 'post' | 'put' | 'patch' | 'delete',
    endpoint: string,
    options?: RequestOptions,
    role?: string,
  ): Promise<ApiResponse> {
    const url = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
    const headers = await this.buildHeaders(options, role);
    const correlationId = options?.correlationId || `test-${Date.now()}`;

    logRequest(method, url, options?.body);

    const startTime = Date.now();

    const performRequest = async (): Promise<ApiResponse> => {
      let response: APIResponse;

      const requestInit = {
        headers: { ...headers, 'X-Correlation-Id': correlationId },
        params: options?.queryParams as Record<string, string>,
      };

      if (method === 'get' || method === 'delete') {
        response = await this.context[method](url, requestInit);
      } else {
        response = await this.context[method](url, {
          ...requestInit,
          data: options?.body,
        });
      }

      const duration = Date.now() - startTime;
      let body: unknown;

      try {
        body = await response.json();
      } catch {
        body = await response.text().catch(() => null);
      }

      logResponse(method, url, response.status(), duration, body);

      return {
        status: response.status(),
        body,
        headers: response.headers(),
        duration,
        correlationId,
      };
    };

    // Retry on transient server errors (5xx) and network issues
    return this.retryHandler.execute(performRequest, {
      retryOn: (error, response) => {
        if (error) return true;
        return response?.status !== undefined && response.status >= 500;
      },
    });
  }

  async get<T = unknown>(endpoint: string, options?: RequestOptions, role?: string): Promise<ApiResponse<T>> {
    return this.executeRequest('get', endpoint, options, role) as Promise<ApiResponse<T>>;
  }

  async post<T = unknown>(endpoint: string, options?: RequestOptions, role?: string): Promise<ApiResponse<T>> {
    return this.executeRequest('post', endpoint, options, role) as Promise<ApiResponse<T>>;
  }

  async put<T = unknown>(endpoint: string, options?: RequestOptions, role?: string): Promise<ApiResponse<T>> {
    return this.executeRequest('put', endpoint, options, role) as Promise<ApiResponse<T>>;
  }

  async patch<T = unknown>(endpoint: string, options?: RequestOptions, role?: string): Promise<ApiResponse<T>> {
    return this.executeRequest('patch', endpoint, options, role) as Promise<ApiResponse<T>>;
  }

  async delete<T = unknown>(endpoint: string, options?: RequestOptions, role?: string): Promise<ApiResponse<T>> {
    return this.executeRequest('delete', endpoint, options, role) as Promise<ApiResponse<T>>;
  }

  // Send raw payload (bypasses type checking — for negative testing)
  async sendRaw(
    method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE',
    endpoint: string,
    body: any,
    options?: RequestOptions,
    role?: string,
  ): Promise<ApiResponse> {
    return this.executeRequest(
      method.toLowerCase() as 'get' | 'post' | 'put' | 'patch' | 'delete',
      endpoint,
      {
        ...options,
        body,
      },
      role,
    );
  }

  setAuthRole(role: string): void {
    this.authManager.setCurrentRole(role);
  }

  setStaticAuthToken(token: string, role: string = 'default'): void {
    this.authManager.setStaticToken(token, role);
  }

  clearAuth(): void {
    this.authManager.clearTokens();
  }
}
