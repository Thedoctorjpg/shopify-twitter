/**
 * ebay.js
 * eBay API integration (RESTful).
 * Supports:
 *   - Public product search / browse (great for cross-promotion)
 *   - Seller inventory & orders (when you provide a user access token)
 *   - Tweet helpers (consistent with Shopify)
 *   - Basic webhook event verification stub
 *
 * Get your keys: https://developer.ebay.com/my/keys
 * OAuth docs: https://developer.ebay.com/api-docs/static/oauth-credentials.html
 */

import axios from 'axios';
import crypto from 'crypto';
import { logger } from './utils.js';

const EBAY_ENV = process.env.EBAY_ENV || 'production';
const EBAY_APP_ID = process.env.EBAY_APP_ID;
const EBAY_APP_SECRET = process.env.EBAY_APP_SECRET;
const EBAY_ACCESS_TOKEN = process.env.EBAY_ACCESS_TOKEN;

const EBAY_BASE = EBAY_ENV === 'sandbox'
  ? 'https://api.sandbox.ebay.com'
  : 'https://api.ebay.com';

let ebayClient = null;

function getEbayClient() {
  if (ebayClient) return ebayClient;

  const headers = {
    'Content-Type': 'application/json',
  };

  if (EBAY_ACCESS_TOKEN) {
    headers['Authorization'] = `Bearer ${EBAY_ACCESS_TOKEN}`;
  }

  ebayClient = axios.create({
    baseURL: EBAY_BASE,
    headers,
    timeout: 20000
  });

  // Response interceptor for logging
  ebayClient.interceptors.response.use(
    (res) => res,
    (err) => {
      logger.error('eBay API error', null, {
        url: err.config?.url,
        status: err.response?.status,
        data: err.response?.data
      });
      return Promise.reject(err);
    }
  );

  return ebayClient;
}

/**
 * Get a fresh app access token (client credentials grant) - useful for public Browse API calls.
 */
export async function getEbayAppToken() {
  if (!EBAY_APP_ID || !EBAY_APP_SECRET) {
    throw new Error('EBAY_APP_ID and EBAY_APP_SECRET are required for app token');
  }

  const tokenUrl = `${EBAY_BASE}/identity/v1/oauth2/token`;
  const credentials = Buffer.from(`${EBAY_APP_ID}:${EBAY_APP_SECRET}`).toString('base64');

  try {
    const res = await axios.post(tokenUrl, 'grant_type=client_credentials&scope=https://api.ebay.com/oauth/api_scope', {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Authorization': `Basic ${credentials}`
      }
    });
    return res.data.access_token;
  } catch (err) {
    logger.error('Failed to get eBay app token', err);
    throw err;
  }
}

/**
 * Get active listings. 
 * If user token is present, tries seller-specific inventory.
 * Otherwise falls back to public Browse search (you can filter by seller).
 */
export async function getEbayProducts(params = {}) {
  const client = getEbayClient();
  const limit = params.limit || 20;

  try {
    if (EBAY_ACCESS_TOKEN) {
      // Seller inventory items (requires proper scopes on the token)
      const res = await client.get('/sell/inventory/v1/inventory_item', {
        params: { limit }
      });
      return res.data.inventoryItems || [];
    } else {
      // Public browse search (no auth needed for basic, but rate limited)
      // You can add &filter=sellers:{yourSellerId} if you know it
      const query = params.q || 'popular items';
      const res = await client.get('/buy/browse/v1/item_summary/search', {
        params: {
          q: query,
          limit,
          filter: params.filter || undefined
        },
        headers: {
          // Public calls can work without, but better with app token
          ...(await getAppTokenHeader())
        }
      });
      return res.data.itemSummaries || [];
    }
  } catch (err) {
    logger.error('Failed to fetch eBay products', err);
    throw err;
  }
}

async function getAppTokenHeader() {
  try {
    const token = await getEbayAppToken();
    return { 'Authorization': `Bearer ${token}` };
  } catch {
    return {};
  }
}

/**
 * Get recent orders (requires user access token with proper scopes).
 */
export async function getEbayOrders(params = {}) {
  const client = getEbayClient();
  if (!EBAY_ACCESS_TOKEN) {
    logger.warn('eBay orders require a user access token (EBAY_ACCESS_TOKEN)');
    return [];
  }

  try {
    const res = await client.get('/sell/fulfillment/v1/order', {
      params: {
        limit: params.limit || 10,
        orderCreationDateFrom: params.from || undefined
      }
    });
    return res.data.orders || [];
  } catch (err) {
    logger.error('Failed to fetch eBay orders', err);
    throw err;
  }
}

/**
 * Format an eBay item for tweeting / display (works for both browse and inventory shapes).
 */
export function formatEbayProductForTweet(item) {
  const title = item.title || item.product?.title || 'eBay Item';
  const price = item.price?.value || item.pricingSummary?.price?.value || item.estimatedAvailabilities?.[0]?.estimatedAvailabilityStatus || '';
  const url = item.itemWebUrl || item.webUrl || `https://www.ebay.com/itm/${item.itemId || item.sku || ''}`;
  const image = item.image?.imageUrl || item.thumbnailImages?.[0]?.imageUrl || null;

  return { title, price, url, image, id: item.itemId || item.sku };
}

/**
 * Post a nice tweet about an eBay listing.
 */
export async function tweetEbayProduct(item) {
  const { generateProductTweet } = await import('./utils.js');
  const { postToTwitter } = await import('./twitter.js');

  const formatted = formatEbayProductForTweet(item);
  let text = `🛒 On eBay: ${formatted.title}`;
  if (formatted.price) text += ` — $${formatted.price}`;
  if (formatted.url) text += `\n\n${formatted.url}`;
  text += `\n\n#eBay #Deals`;

  const imageUrls = formatted.image ? [formatted.image] : [];
  return postToTwitter(text, imageUrls);
}

/**
 * Verify eBay webhook / Event Notification signature (basic).
 * eBay uses a specific signature mechanism. See:
 * https://developer.ebay.com/api-docs/commerce/notification/overview.html
 *
 * For production, use their SDK or verify with the public key they provide.
 * This is a starting point (logs + basic structure).
 */
export function verifyEbayWebhook(body, signatureHeader, timestampHeader) {
  if (!signatureHeader) {
    logger.warn('eBay webhook missing signature header');
    return false;
  }

  // Placeholder: In real use you would:
  // 1. Get eBay's public key (they rotate, fetch from their metadata endpoint)
  // 2. Verify the signature using crypto (usually ECDSA or HMAC depending on config)
  //
  // For now we accept if the header exists (dev mode) or you can plug in real verification.

  logger.debug('eBay webhook signature present (verification stub)', {
    sig: signatureHeader?.slice(0, 30) + '...',
    ts: timestampHeader
  });

  // TODO: Implement full verification using eBay's notification public key.
  // Return true for now so you can test the flow.
  return true;
}

export default { getEbayProducts, getEbayOrders, tweetEbayProduct, verifyEbayWebhook, formatEbayProductForTweet };
