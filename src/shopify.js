/**
 * shopify.js
 * Shopify Admin API client (2025-04 API version as example - update as needed)
 * Includes products, orders, and helpers for webhooks.
 */

import axios from 'axios';
import { logger } from './utils.js';

const SHOPIFY_ACCESS_TOKEN = process.env.SHOPIFY_ACCESS_TOKEN;
const SHOPIFY_SHOP_DOMAIN = process.env.SHOPIFY_SHOP_DOMAIN;
const API_VERSION = '2025-04'; // Update to current stable when needed (e.g. 2024-10)

if (!SHOPIFY_ACCESS_TOKEN || !SHOPIFY_SHOP_DOMAIN) {
  logger.warn('Shopify credentials missing in environment. API calls will fail.');
}

const shopify = axios.create({
  baseURL: `https://${SHOPIFY_SHOP_DOMAIN}/admin/api/${API_VERSION}`,
  headers: {
    'X-Shopify-Access-Token': SHOPIFY_ACCESS_TOKEN,
    'Content-Type': 'application/json',
    'Accept': 'application/json'
  },
  timeout: 30000
});

// Add response interceptor for logging + error normalization
shopify.interceptors.response.use(
  (response) => response,
  (error) => {
    const status = error.response?.status;
    const data = error.response?.data;
    logger.error(`Shopify API error ${status || ''}`, null, {
      url: error.config?.url,
      method: error.config?.method,
      shopifyErrors: data?.errors || data
    });
    return Promise.reject(error);
  }
);

export async function getProducts(params = {}) {
  try {
    const query = new URLSearchParams(params).toString();
    const response = await shopify.get(`/products.json${query ? `?${query}` : ''}`);
    return response.data.products || [];
  } catch (err) {
    logger.error('Failed to fetch products', err);
    throw err;
  }
}

export async function getProductById(productId) {
  try {
    const response = await shopify.get(`/products/${productId}.json`);
    return response.data.product;
  } catch (err) {
    logger.error(`Failed to fetch product ${productId}`, err);
    throw err;
  }
}

export async function getOrders(params = { status: 'any', limit: 50 }) {
  try {
    const query = new URLSearchParams(params).toString();
    const response = await shopify.get(`/orders.json?${query}`);
    return response.data.orders || [];
  } catch (err) {
    logger.error('Failed to fetch orders', err);
    throw err;
  }
}

export async function getOrderById(orderId) {
  try {
    const response = await shopify.get(`/orders/${orderId}.json`);
    return response.data.order;
  } catch (err) {
    logger.error(`Failed to fetch order ${orderId}`, err);
    throw err;
  }
}

/**
 * Register a webhook with Shopify.
 * @param {string} topic e.g. 'products/create', 'orders/create'
 * @param {string} address full URL to your /webhooks endpoint
 */
export async function registerWebhook(topic, address) {
  try {
    const payload = {
      webhook: {
        topic,
        address,
        format: 'json'
      }
    };
    const response = await shopify.post('/webhooks.json', payload);
    logger.info('Webhook registered', { topic, address, id: response.data.webhook?.id });
    return response.data.webhook;
  } catch (err) {
    // Common case: webhook already exists for this address/topic
    if (err.response?.status === 422) {
      logger.warn('Webhook may already exist', { topic, address });
    }
    logger.error('Failed to register webhook', err);
    throw err;
  }
}

export async function listWebhooks() {
  try {
    const response = await shopify.get('/webhooks.json');
    return response.data.webhooks || [];
  } catch (err) {
    logger.error('Failed to list webhooks', err);
    throw err;
  }
}

export async function deleteWebhook(webhookId) {
  try {
    await shopify.delete(`/webhooks/${webhookId}.json`);
    logger.info('Webhook deleted', { id: webhookId });
    return true;
  } catch (err) {
    logger.error('Failed to delete webhook', err);
    throw err;
  }
}

/**
 * Helper: Get recent orders for dashboard / summaries
 */
export async function getRecentOrders(limit = 10) {
  return getOrders({ status: 'any', limit, order: 'created_at desc' });
}

/**
 * Get shop info (useful for health + display)
 */
export async function getShopInfo() {
  try {
    const response = await shopify.get('/shop.json');
    return response.data.shop;
  } catch (err) {
    logger.error('Failed to fetch shop info', err);
    throw err;
  }
}

/**
 * Register the most common/ useful webhooks pointing at your public base URL.
 * Call this from scripts or on controlled startup if desired.
 * @param {string} baseUrl - e.g. https://myapp.example.com  (no trailing /webhooks)
 */
export async function setupCommonWebhooks(baseUrl) {
  if (!baseUrl) throw new Error('baseUrl is required');

  const webhookUrl = `${baseUrl.replace(/\/$/, '')}/webhooks`;
  const topics = ['products/create', 'products/update', 'orders/create', 'orders/paid'];

  const results = [];
  for (const topic of topics) {
    try {
      const hook = await registerWebhook(topic, webhookUrl);
      results.push({ topic, success: true, webhookId: hook?.id });
    } catch (err) {
      results.push({ topic, success: false, error: err.message });
    }
  }
  return { webhookUrl, results };
}

/**
 * Create a new product in Shopify (as draft by default).
 * Useful for import flows from AliExpress, eBay, etc.
 * @param {object} productData - { title, body_html, vendor, product_type, variants: [{price}], images: [{src}], tags, ... }
 */
export async function createProduct(productData) {
  try {
    const payload = { product: productData };
    const response = await shopify.post('/products.json', payload);
    const created = response.data.product;
    logger.info('Created Shopify product', { id: created.id, title: created.title });
    return created;
  } catch (err) {
    logger.error('Failed to create Shopify product', err);
    throw err;
  }
}

/**
 * Convenience: Import an AliExpress (or normalized) item as a Shopify draft product.
 */
export async function importToShopifyFromExternal(normalizedItem, platform = 'External') {
  const productData = {
    title: normalizedItem.title,
    body_html: `<p>Imported from ${platform}.</p><p>Original: <a href="${normalizedItem.url}">${normalizedItem.url}</a></p>`,
    vendor: platform,
    product_type: 'Imported',
    status: 'draft', // safe default
    variants: [{
      price: normalizedItem.price || '0.00',
      sku: normalizedItem.id ? String(normalizedItem.id) : undefined
    }],
    tags: `imported,${platform.toLowerCase()},aliexpress,ebay`.split(',').filter(Boolean).join(',')
  };

  if (normalizedItem.image) {
    productData.images = [{ src: normalizedItem.image }];
  }

  return createProduct(productData);
}

export default shopify;
