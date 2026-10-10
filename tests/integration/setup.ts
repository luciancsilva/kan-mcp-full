export const TEST_API_KEY = 'test-api-key';
export const TEST_BASE_URL = 'https://kan.bn/api/v1';
export const TEST_WORKSPACE_SLUG = 'kan-mcp-test';

export const isIntegrationTest = process.env.INTEGRATION_TEST === 'true';

export async function loadEnv() {
  if (isIntegrationTest) {
    const { config } = await import('dotenv');
    config({ path: '.env' });
    return {
      TEST_API_KEY: process.env.KAN_API_KEY || 'test-api-key',
      TEST_BASE_URL: process.env.KAN_API_BASE_URL || 'https://kan.bn/api/v1',
    };
  }
  return { TEST_API_KEY, TEST_BASE_URL };
}
