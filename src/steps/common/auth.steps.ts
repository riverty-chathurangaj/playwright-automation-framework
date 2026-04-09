import { Given } from '../../fixtures';

Given('I am authenticated as {string}', async function (
  { apiClient, activeRole }: {
    apiClient: import('../../core/api-client').ApiClient;
    activeRole: { value: string };
  },
  role: string,
) {
  activeRole.value = role;
  apiClient.setAuthRole(role);
});

Given('I am not authenticated', function (
  { apiClient, activeRole }: {
    apiClient: import('../../core/api-client').ApiClient;
    activeRole: { value: string };
  },
) {
  apiClient.clearAuth();
  activeRole.value = 'unauthenticated';
});

Given('I am authenticated with an expired token', async function (
  { apiClient, activeRole }: {
    apiClient: import('../../core/api-client').ApiClient;
    activeRole: { value: string };
  },
) {
  apiClient.clearAuth();
  // Inject an obviously-expired JWT for negative auth testing
  const expiredToken = 'eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9.eyJleHAiOjE2MDAwMDAwMDB9.invalid';
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (apiClient as any).authManager.setStaticToken(expiredToken, 'expired');
  apiClient.setAuthRole('expired');
  activeRole.value = 'expired';
});

Given('I am authenticated with an invalid token', async function (
  { apiClient, activeRole }: {
    apiClient: import('../../core/api-client').ApiClient;
    activeRole: { value: string };
  },
) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (apiClient as any).authManager.setStaticToken('invalid-token-xyz', 'invalid');
  apiClient.setAuthRole('invalid');
  activeRole.value = 'invalid';
});
