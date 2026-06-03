/**
 * integrations.js
 * Additional destinations for Shopify webhook events.
 * - WordPress (via REST API + Application Passwords)
 * - Generic external webhooks (Google Apps Script, Cloud Functions, n8n, another server, etc.)
 *
 * These run in parallel with the X/Twitter posting and never block the Shopify webhook ack.
 */

import axios from 'axios';
import { logger } from './utils.js';

const WP_SITE = process.env.WORDPRESS_SITE_URL;
const WP_USER = process.env.WORDPRESS_USERNAME;
const WP_APP_PASS = process.env.WORDPRESS_APP_PASSWORD;

const EXTERNAL_URLS = (process.env.EXTERNAL_WEBHOOK_URLS || '')
  .split(',')
  .map(u => u.trim())
  .filter(Boolean);

/**
 * Create a Basic Auth header for WordPress Application Passwords
 */
function getWpAuthHeader() {
  if (!WP_USER || !WP_APP_PASS) return null;
  const token = Buffer.from(`${WP_USER}:${WP_APP_PASS.replace(/\s+/g, '')}`).toString('base64');
  return `Basic ${token}`;
}

/**
 * Post a new product announcement to WordPress as a draft or published post.
 * Uses the standard /wp-json/wp/v2/posts endpoint.
 */
export async function postProductToWordPress(product) {
  if (!WP_SITE || !WP_USER || !WP_APP_PASS) {
    logger.debug('WordPress integration not configured, skipping');
    return { skipped: true };
  }

  const auth = getWpAuthHeader();
  if (!auth) return { skipped: true };

  const title = `New Product: ${product.title}`;
  const price = product.variants?.[0]?.price || '';
  const image = product.images?.[0]?.src || '';
  const productUrl = product.handle 
    ? `https://${process.env.SHOPIFY_SHOP_DOMAIN}/products/${product.handle}`
    : '';

  // Build nice HTML content
  const content = `
    <p><strong>${product.title}</strong> is now available in our store!</p>
    ${price ? `<p><strong>Price:</strong> $${price}</p>` : ''}
    ${image ? `<p><img src="${image}" alt="${product.title}" style="max-width:100%;height:auto;border-radius:8px" /></p>` : ''}
    ${product.body_html ? `<div>${product.body_html}</div>` : ''}
    ${productUrl ? `<p><a href="${productUrl}" target="_blank" rel="noopener">Shop now →</a></p>` : ''}
    <p><em>Posted automatically from Shopify via Grok integration.</em></p>
  `.trim();

  const postData = {
    title,
    content,
    status: 'draft',           // Change to 'publish' if you want it live immediately
    excerpt: product.body_html ? product.body_html.replace(/<[^>]+>/g, '').slice(0, 150) : '',
    tags: (product.tags || '').split(',').map(t => t.trim()).filter(Boolean),
  };

  try {
    const response = await axios.post(`${WP_SITE.replace(/\/$/, '')}/wp-json/wp/v2/posts`, postData, {
      headers: {
        'Authorization': auth,
        'Content-Type': 'application/json'
      },
      timeout: 15000
    });

    const wpPost = response.data;
    logger.info('Posted new product to WordPress', { 
      wpPostId: wpPost.id, 
      wpPostUrl: wpPost.link, 
      shopifyProductId: product.id 
    });

    logger.promptLog('WORDPRESS POST CREATED', {
      title,
      wpPostId: wpPost.id,
      status: wpPost.status,
      link: wpPost.link
    });

    return { success: true, id: wpPost.id, url: wpPost.link };
  } catch (err) {
    const status = err.response?.status;
    const data = err.response?.data;
    logger.error('Failed to post to WordPress', err, { status, wpError: data });
    return { success: false, error: data?.message || err.message };
  }
}

/**
 * Forward any Shopify webhook payload to one or more external HTTPS endpoints.
 * Useful for Google Apps Script, Cloud Run, Firebase, Make.com, n8n, your own remote site, etc.
 * Sends the original payload + useful headers (X-Shopify-Topic, X-Shopify-Shop-Domain).
 */
export async function forwardToExternalWebhooks(payload, topic, shopDomain) {
  if (EXTERNAL_URLS.length === 0) {
    return { skipped: true };
  }

  const results = [];

  for (const url of EXTERNAL_URLS) {
    try {
      const res = await axios.post(url, payload, {
        headers: {
          'Content-Type': 'application/json',
          'X-Shopify-Topic': topic,
          'X-Shopify-Shop-Domain': shopDomain || '',
          'X-Source': 'shopify-x-integration'
        },
        timeout: 12000
      });

      logger.info('Forwarded webhook to external endpoint', { url, topic, status: res.status });
      results.push({ url, success: true, status: res.status });
    } catch (err) {
      logger.error('Failed to forward to external webhook', err, { url, topic });
      results.push({ url, success: false, error: err.message });
    }
  }

  return results;
}

/**
 * Dispatch all configured external integrations for a given event.
 * Called from the webhook handler (fire-and-forget, non-blocking).
 */
export async function dispatchExternalIntegrations(topic, payload, shopDomain) {
  const tasks = [];

  // WordPress - currently focused on new products (great for content marketing)
  if (topic === 'products/create') {
    tasks.push(
      postProductToWordPress(payload).catch(err => 
        logger.error('WordPress integration error (caught)', err)
      )
    );
  }

  // Generic external forwarder (Google Apps Script, remote sites, etc.)
  if (EXTERNAL_URLS.length > 0) {
    tasks.push(
      forwardToExternalWebhooks(payload, topic, shopDomain).catch(err =>
        logger.error('External webhook forward error (caught)', err)
      )
    );
  }

  if (tasks.length > 0) {
    // Run in parallel, don't await here if you want true fire-and-forget
    // But we do await in the caller with Promise.allSettled so we can log
    await Promise.allSettled(tasks);
  }
}

/**
 * Quick helper to test WordPress connection (used by /webhooks/setup)
 */
export async function testWordPressConnection() {
  if (!WP_SITE || !WP_USER || !WP_APP_PASS) {
    return { configured: false };
  }
  try {
    const auth = getWpAuthHeader();
    const res = await axios.get(`${WP_SITE.replace(/\/$/, '')}/wp-json/wp/v2/users/me`, {
      headers: { Authorization: auth },
      timeout: 8000
    });
    return { configured: true, ok: true, user: res.data?.name || res.data?.slug };
  } catch (e) {
    return { configured: true, ok: false, error: e.response?.data?.message || e.message };
  }
}
