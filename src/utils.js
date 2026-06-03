/**
 * utils.js
 * Shared utilities for Shopify + X integration.
 * Includes logging, formatting, Shopify webhook HMAC verification.
 */

import crypto from 'crypto';

const isDev = process.env.NODE_ENV !== 'production';

/**
 * Simple structured logger (prompt-log style for easy copy/paste into AI chats)
 */
export const logger = {
  info: (msg, meta = {}) => {
    const ts = new Date().toISOString();
    console.log(`[INFO ${ts}] ${msg}`, Object.keys(meta).length ? meta : '');
  },
  warn: (msg, meta = {}) => {
    const ts = new Date().toISOString();
    console.warn(`[WARN ${ts}] ${msg}`, Object.keys(meta).length ? meta : '');
  },
  error: (msg, err = null, meta = {}) => {
    const ts = new Date().toISOString();
    console.error(`[ERROR ${ts}] ${msg}`);
    if (err) console.error(err.stack || err);
    if (Object.keys(meta).length) console.error('meta:', meta);
  },
  debug: (msg, meta = {}) => {
    if (isDev) {
      const ts = new Date().toISOString();
      console.log(`[DEBUG ${ts}] ${msg}`, Object.keys(meta).length ? meta : '');
    }
  },
  // Special "prompt log" for AI reuse - prints a clean block you can copy into next prompt
  promptLog: (title, data) => {
    console.log('\n' + '='.repeat(60));
    console.log(`PROMPT LOG: ${title}`);
    console.log('='.repeat(60));
    console.log(JSON.stringify(data, null, 2));
    console.log('='.repeat(60) + '\n');
  }
};

/**
 * Format a Shopify product for display / tweeting
 */
export function formatProductForTweet(product) {
  const price = product.variants?.[0]?.price || '0.00';
  const url = product.handle 
    ? `https://${process.env.SHOPIFY_SHOP_DOMAIN}/products/${product.handle}`
    : '';
  return {
    id: product.id,
    title: product.title,
    price,
    image: product.images?.[0]?.src || null,
    url,
    vendor: product.vendor,
    tags: product.tags || ''
  };
}

/**
 * Format currency
 */
export function formatCurrency(amount, currency = 'USD') {
  const num = parseFloat(amount) || 0;
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency
  }).format(num);
}

/**
 * Format order summary for tweet or dashboard
 */
export function formatOrderSummary(order) {
  const total = parseFloat(order.total_price || 0);
  const name = order.customer 
    ? `${order.customer.first_name || ''} ${order.customer.last_name || ''}`.trim() || order.email
    : order.email || 'Customer';
  return {
    id: order.id,
    name: order.name,
    total: formatCurrency(total, order.currency || 'USD'),
    customer: name,
    itemCount: order.line_items?.length || 0,
    created: order.created_at
  };
}

/**
 * Verify Shopify webhook HMAC (critical for security)
 * @param {string} body - raw request body
 * @param {string} hmacHeader - value of X-Shopify-Hmac-Sha256 header
 * @param {string} secret - SHOPIFY_WEBHOOK_SECRET
 */
export function verifyShopifyWebhook(body, hmacHeader, secret) {
  if (!secret || !hmacHeader) {
    logger.warn('Webhook verification skipped: missing secret or hmac header');
    return false;
  }
  const digest = crypto
    .createHmac('sha256', secret)
    .update(body, 'utf8')
    .digest('base64');
  
  // Use timingSafeEqual to prevent timing attacks
  try {
    const hmacBuffer = Buffer.from(hmacHeader, 'base64');
    const digestBuffer = Buffer.from(digest, 'base64');
    if (hmacBuffer.length !== digestBuffer.length) return false;
    return crypto.timingSafeEqual(hmacBuffer, digestBuffer);
  } catch (e) {
    logger.error('HMAC comparison failed', e);
    return false;
  }
}

/**
 * Safe JSON parse with fallback
 */
export function safeJsonParse(str, fallback = null) {
  try {
    return JSON.parse(str);
  } catch {
    return fallback;
  }
}

/**
 * Truncate text for Twitter (280 char limit, with URL consideration)
 */
export function truncateForTwitter(text, maxLength = 280) {
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength - 1) + '…';
}

/**
 * Generate a nice tweet text for a new product
 */
export function generateProductTweet(product) {
  const p = formatProductForTweet(product);
  let tweet = `🛍️ New in the shop: ${p.title}`;
  if (p.price) tweet += ` — $${p.price}`;
  if (p.url) tweet += `\n\n${p.url}`;
  tweet += `\n\n#Shopify #NewArrival`;
  return truncateForTwitter(tweet);
}

/**
 * Generate tweet for a new order (privacy friendly summary)
 */
export function generateOrderTweet(order) {
  const o = formatOrderSummary(order);
  let tweet = `🎉 New order ${o.name}! ${o.itemCount} item(s) • ${o.total}`;
  tweet += `\n\nThank you to our customers!`;
  tweet += `\n\n#Shopify #Ecommerce`;
  return truncateForTwitter(tweet);
}
