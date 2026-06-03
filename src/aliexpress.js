/**
 * aliexpress.js
 * AliExpress / Alibaba Open Platform integration.
 *
 * Great for:
 *   - Product research / dropshipping inspiration
 *   - Cross-promoting trending items from AliExpress alongside your Shopify/eBay store
 *   - Fetching product data to tweet or forward to other systems
 *
 * Register / get keys: https://open.aliexpress.com/ (or Alibaba Cloud)
 * API explorer & docs: Search for "aliexpress.product" or "affiliate.product" in the portal.
 *
 * Many endpoints require a signature (app_key + secret + sorted params + MD5).
 */

import axios from 'axios';
import crypto from 'crypto';
import { logger } from './utils.js';

const APP_KEY = process.env.ALIBABA_APP_KEY;
const APP_SECRET = process.env.ALIBABA_APP_SECRET;
const ACCESS_TOKEN = process.env.ALIBABA_ACCESS_TOKEN;

const ALI_BASE_URL = 'https://api-sg.aliexpress.com'; // Singapore endpoint (good for most)

function generateSignature(params, secret) {
  // Alibaba style: sort keys, concatenate keyvalue pairs + secret, then MD5 (uppercase)
  const sortedKeys = Object.keys(params).sort();
  let signStr = '';
  sortedKeys.forEach(key => {
    if (key !== 'sign' && params[key] !== undefined && params[key] !== '') {
      signStr += `${key}${params[key]}`;
    }
  });
  signStr += secret;
  return crypto.createHash('md5').update(signStr, 'utf8').digest('hex').toUpperCase();
}

function buildSignedParams(method, extraParams = {}) {
  const timestamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d+Z$/, 'Z');
  const params = {
    app_key: APP_KEY,
    timestamp,
    method,
    sign_method: 'md5',
    ...extraParams
  };

  if (ACCESS_TOKEN) {
    params.access_token = ACCESS_TOKEN;
  }

  params.sign = generateSignature(params, APP_SECRET);
  return params;
}

const aliClient = axios.create({
  baseURL: ALI_BASE_URL,
  timeout: 15000
});

/**
 * Search products on AliExpress.
 * Common method: aliexpress.affiliate.product.query (affiliate) or similar product search.
 * You may need to enable the right API in your Alibaba console.
 */
export async function searchAliExpressProducts(keywords, opts = {}) {
  if (!APP_KEY || !APP_SECRET) {
    throw new Error('ALIBABA_APP_KEY and ALIBABA_APP_SECRET are required');
  }

  const method = opts.method || 'aliexpress.affiliate.product.query';
  const params = buildSignedParams(method, {
    keywords,
    page_no: opts.page || 1,
    page_size: Math.min(opts.limit || 10, 50),
    sort: opts.sort || 'SALE_PRICE_ASC', // or RELEVANCE, etc.
    target_currency: opts.currency || 'USD',
    target_language: opts.lang || 'en'
  });

  try {
    const res = await aliClient.get('/sync', { params });
    // Response shape varies by method — common patterns below
    const data = res.data;

    if (data?.result?.products) {
      return data.result.products;
    }
    if (data?.products) {
      return data.products;
    }
    if (data?.result?.product) {
      return Array.isArray(data.result.product) ? data.result.product : [data.result.product];
    }

    logger.debug('AliExpress search raw response shape', { keys: Object.keys(data || {}) });
    return data?.result || data || [];
  } catch (err) {
    logger.error('AliExpress search failed', err, { keywords, method });
    throw err;
  }
}

/**
 * Get detailed info for a specific product (by item ID / product ID).
 */
export async function getAliExpressProduct(itemId) {
  if (!APP_KEY || !APP_SECRET) {
    throw new Error('ALIBABA_APP_KEY and ALIBABA_APP_SECRET are required');
  }

  const method = 'aliexpress.affiliate.product.detail.get'; // or aliexpress.product.detail
  const params = buildSignedParams(method, {
    product_id: itemId,
    target_currency: 'USD',
    target_language: 'en'
  });

  try {
    const res = await aliClient.get('/sync', { params });
    return res.data?.result?.product || res.data?.product || res.data;
  } catch (err) {
    logger.error('AliExpress product detail failed', err, { itemId });
    throw err;
  }
}

/**
 * Normalize an AliExpress product into a consistent shape for widgets/tweeting.
 */
export function formatAliExpressProduct(item) {
  const title = item.product_title || item.title || item.subject || 'AliExpress Product';
  const price = item.sale_price || item.min_price || item.price || item.target_sale_price || '';
  const url = item.product_detail_url || item.detail_url || item.promotion_link || `https://www.aliexpress.com/item/${item.product_id || item.item_id}.html`;
  const image = item.product_main_image_url || item.image_url || (item.images && item.images[0]) || null;
  const rating = item.average_rating || item.rating || '';

  return {
    id: item.product_id || item.item_id,
    title,
    price: String(price).replace(/[^\d.]/g, ''),
    url,
    image,
    rating
  };
}

/**
 * Tweet an AliExpress find (very useful for "inspiration" or deals accounts).
 */
export async function tweetAliExpressProduct(item) {
  const { postToTwitter } = await import('./twitter.js');
  const formatted = formatAliExpressProduct(item);

  let text = `🔥 AliExpress find: ${formatted.title}`;
  if (formatted.price) text += ` — from $${formatted.price}`;
  if (formatted.rating) text += ` (${formatted.rating}★)`;
  if (formatted.url) text += `\n\n${formatted.url}`;
  text += `\n\n#AliExpress #Deals #Dropshipping`;

  const imageUrls = formatted.image ? [formatted.image] : [];
  return postToTwitter(text, imageUrls);
}

export default {
  searchAliExpressProducts,
  getAliExpressProduct,
  tweetAliExpressProduct,
  formatAliExpressProduct
};
