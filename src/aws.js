/**
 * aws.js
 * AWS helpers: SSM Parameter Store secrets loader (for secure env on App Runner / ECS / Lambda).
 *
 * Usage:
 *   In .env or App Runner env: AWS_SSM_ENABLED=true
 *   AWS_SSM_PARAM_PREFIX=/shopify-x-integration/prod/
 *
 * Then at startup we pull params like /shopify-x-integration/prod/SHOPIFY_ACCESS_TOKEN
 * and inject into process.env if not already set.
 *
 * Requires IAM role with ssm:GetParametersByPath permission.
 */

import { SSMClient, GetParametersByPathCommand } from '@aws-sdk/client-ssm';
import { logger } from './utils.js';

const AWS_REGION = process.env.AWS_REGION || 'us-east-1';
const SSM_ENABLED = process.env.AWS_SSM_ENABLED === 'true';
const SSM_PREFIX = process.env.AWS_SSM_PARAM_PREFIX || '/shopify-x-integration/';

let ssmClient = null;

function getSSMClient() {
  if (!ssmClient) {
    ssmClient = new SSMClient({ region: AWS_REGION });
  }
  return ssmClient;
}

/**
 * Load secrets from SSM Parameter Store (by path) and merge into process.env.
 * Only loads if AWS_SSM_ENABLED=true.
 * Non-blocking; errors are logged but don't crash startup.
 */
export async function loadSecretsFromSSM() {
  if (!SSM_ENABLED) {
    return { loaded: false, reason: 'AWS_SSM_ENABLED not true' };
  }

  try {
    const client = getSSMClient();
    const command = new GetParametersByPathCommand({
      Path: SSM_PREFIX,
      Recursive: true,
      WithDecryption: true
    });

    const response = await client.send(command);
    const params = response.Parameters || [];

    let loadedCount = 0;
    for (const p of params) {
      const name = p.Name.replace(SSM_PREFIX, '').replace(/^\//, ''); // e.g. SHOPIFY_ACCESS_TOKEN
      if (name && !process.env[name]) {
        process.env[name] = p.Value;
        loadedCount++;
      }
    }

    logger.info('Loaded secrets from AWS SSM Parameter Store', { prefix: SSM_PREFIX, count: loadedCount });
    return { loaded: true, count: loadedCount };
  } catch (err) {
    logger.error('Failed to load secrets from AWS SSM (continuing with env vars)', err);
    return { loaded: false, error: err.message };
  }
}

export default { loadSecretsFromSSM };
