/**
 * server.js
 * Main Express server for Shopify + X integration.
 * - REST endpoints for products/orders
 * - Webhook receiver with Shopify HMAC verification
 * - Auto-tweet on product/order creation (configurable)
 * - Quick HTML dashboard using widgets
 */

import express from 'express';
import dotenv from 'dotenv';
import cors from 'cors';
import { fileURLToPath } from 'url';
import { resolve } from 'path';
import { getProducts, getOrders, getProductById, getOrderById, registerWebhook, listWebhooks } from './shopify.js';
import { postToTwitter, tweetNewProduct, tweetNewOrder } from './twitter.js';
import { 
  logger, 
  verifyShopifyWebhook, 
  generateProductTweet, 
  generateOrderTweet,
  formatProductForTweet 
} from './utils.js';
import { 
  generateProductWidget, 
  generateSalesWidget, 
  generateProductGrid, 
  generateActivityFeed 
} from './widgets.js';
import { dispatchExternalIntegrations } from './integrations.js';
import { 
  getEbayProducts, 
  getEbayOrders, 
  tweetEbayProduct, 
  verifyEbayWebhook,
  formatEbayProductForTweet 
} from './ebay.js';
import { 
  searchAliExpressProducts, 
  getAliExpressProduct, 
  tweetAliExpressProduct, 
  formatAliExpressProduct 
} from './aliexpress.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;
const WEBHOOK_SECRET = process.env.SHOPIFY_WEBHOOK_SECRET;
const WEBHOOK_BASE_URL = (process.env.WEBHOOK_BASE_URL || '').replace(/\/$/, ''); // no trailing slash

// CORS for frontend later
app.use(cors({
  origin: process.env.FRONTEND_URL || '*'
}));

// IMPORTANT: For webhook verification we need raw body on /webhooks route.
// Use a specific raw middleware only for webhooks.
app.use('/webhooks', express.raw({ type: 'application/json' }));

// Normal JSON parser for everything else
app.use(express.json());

// Request logger (simple)
app.use((req, res, next) => {
  logger.debug(`${req.method} ${req.path}`);
  next();
});

// ---------- HEALTH & INFO ----------
app.get('/', (req, res) => {
  res.json({
    name: 'shopify-x-integration',
    status: 'running',
    builtWith: 'Grok',
    endpoints: [
      'GET /products', 'GET /orders',
      'POST /tweet-product', 'POST /tweet-order',
      'GET /ebay/products', 'POST /tweet-ebay-product',
      'GET /aliexpress/search', 'POST /tweet-aliexpress-product',
      'POST /webhooks',
      'GET /dashboard',
      'POST /webhooks/register',
      'POST /webhooks/setup'
    ]
  });
});

app.get('/health', async (req, res) => {
  res.json({ status: 'ok', time: new Date().toISOString() });
});

// ---------- PRODUCTS ----------
app.get('/products', async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit) || 20, 50);
    const products = await getProducts({ limit });
    res.json(products);
  } catch (err) {
    logger.error('GET /products failed', err);
    res.status(500).json({ error: 'Failed to fetch products' });
  }
});

app.get('/products/:id', async (req, res) => {
  try {
    const product = await getProductById(req.params.id);
    res.json(product);
  } catch (err) {
    res.status(404).json({ error: 'Product not found' });
  }
});

// ---------- ORDERS ----------
app.get('/orders', async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit) || 20, 50);
    const orders = await getOrders({ status: 'any', limit });
    res.json(orders);
  } catch (err) {
    logger.error('GET /orders failed', err);
    res.status(500).json({ error: 'Failed to fetch orders' });
  }
});

// ---------- TWEETING (manual) ----------
app.post('/tweet-product', async (req, res) => {
  try {
    const { productId, customText } = req.body;
    if (!productId) return res.status(400).json({ error: 'productId required' });

    const product = await getProductById(productId);
    let result;

    if (customText) {
      const imageUrl = product.images?.[0]?.src;
      result = await postToTwitter(customText, imageUrl ? [imageUrl] : []);
    } else {
      result = await tweetNewProduct(product);
    }

    logger.promptLog('TWEETED PRODUCT', { product: formatProductForTweet(product), result });
    res.json({ status: 'tweeted', result });
  } catch (err) {
    logger.error('tweet-product failed', err);
    res.status(500).json({ error: 'Failed to tweet product' });
  }
});

app.post('/tweet-order', async (req, res) => {
  try {
    const { orderId, customText } = req.body;
    if (!orderId) return res.status(400).json({ error: 'orderId required' });

    const order = await getOrderById(orderId);
    const result = customText 
      ? await postToTwitter(customText) 
      : await tweetNewOrder(order);

    logger.promptLog('TWEETED ORDER', { orderId, result });
    res.json({ status: 'tweeted', result });
  } catch (err) {
    logger.error('tweet-order failed', err);
    res.status(500).json({ error: 'Failed to tweet order' });
  }
});

// ---------- eBay Routes ----------
app.get('/ebay/products', async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit) || 12, 50);
    const q = req.query.q;
    const products = await getEbayProducts({ limit, q });
    res.json(products);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch eBay products' });
  }
});

app.post('/tweet-ebay-product', async (req, res) => {
  try {
    const { itemId, customText, item } = req.body;
    let ebayItem = item;

    if (!ebayItem && itemId) {
      // Try to fetch it first (basic implementation may need enhancement)
      const items = await getEbayProducts({ limit: 1, q: itemId });
      ebayItem = items[0];
    }
    if (!ebayItem) return res.status(400).json({ error: 'item or itemId required' });

    const result = customText 
      ? await postToTwitter(customText) 
      : await tweetEbayProduct(ebayItem);

    logger.promptLog('TWEETED EBAY PRODUCT', { item: formatEbayProductForTweet(ebayItem), result });
    res.json({ status: 'tweeted', result });
  } catch (err) {
    logger.error('tweet-ebay-product failed', err);
    res.status(500).json({ error: 'Failed to tweet eBay product' });
  }
});

// ---------- AliExpress Routes ----------
app.get('/aliexpress/search', async (req, res) => {
  try {
    const keywords = req.query.q || req.query.keywords || 'wireless earbuds';
    const limit = Math.min(parseInt(req.query.limit) || 10, 20);
    const products = await searchAliExpressProducts(keywords, { limit });
    res.json(products);
  } catch (err) {
    res.status(500).json({ error: 'AliExpress search failed (check your Alibaba keys)' });
  }
});

app.post('/tweet-aliexpress-product', async (req, res) => {
  try {
    const { itemId, keywords, item } = req.body;
    let product = item;

    if (!product && itemId) {
      product = await getAliExpressProduct(itemId);
    } else if (!product && keywords) {
      const results = await searchAliExpressProducts(keywords, { limit: 1 });
      product = results[0];
    }
    if (!product) return res.status(400).json({ error: 'item, itemId, or keywords required' });

    const result = await tweetAliExpressProduct(product);
    logger.promptLog('TWEETED ALIEXPRESS PRODUCT', { product: formatAliExpressProduct(product), result });
    res.json({ status: 'tweeted', result });
  } catch (err) {
    logger.error('tweet-aliexpress failed', err);
    res.status(500).json({ error: 'Failed to tweet AliExpress product' });
  }
});

// ---------- WEBHOOKS (Shopify → us) ----------
app.post('/webhooks', async (req, res) => {
  const hmacHeader = req.headers['x-shopify-hmac-sha256'];
  const topic = req.headers['x-shopify-topic'];
  const shopDomain = req.headers['x-shopify-shop-domain'];

  // Get raw body as string (we mounted raw parser on this route)
  const rawBody = req.body.toString('utf8');

  // Verify signature
  const isValid = verifyShopifyWebhook(rawBody, hmacHeader, WEBHOOK_SECRET);
  if (!isValid) {
    logger.warn('Webhook rejected: invalid HMAC', { topic, shopDomain });
    return res.status(401).send('Invalid signature');
  }

  let payload;
  try {
    payload = JSON.parse(rawBody);
  } catch (e) {
    return res.status(400).send('Bad JSON');
  }

  logger.info(`Webhook received: ${topic}`, { shop: shopDomain, id: payload.id });

  // IMPORTANT: Always respond to Shopify quickly (within 5s) or it will retry.
  // We kick off all side effects (X, WordPress, external/Google, etc.) in parallel
  // and use Promise.allSettled so one slow destination never blocks the ack.
  res.status(200).send('OK');

  // --- Side effects (non-blocking for the HTTP response) ---
  (async () => {
    const sideEffects = [];

    // X / Twitter reactions
    if (topic === 'products/create') {
      sideEffects.push(
        tweetNewProduct(payload)
          .then(result => logger.info('Auto-tweeted new product', { productId: payload.id, result }))
          .catch(err => logger.error('Tweet product failed', err))
      );
    }

    if (topic === 'orders/create') {
      sideEffects.push(
        tweetNewOrder(payload)
          .then(result => logger.info('Auto-tweeted new order', { orderId: payload.id, result }))
          .catch(err => logger.error('Tweet order failed', err))
      );
    }

    // You can easily add more here:
    // if (topic === 'orders/paid') { ... }
    // if (topic === 'products/update') { ... }

    // External integrations: WordPress + any Google-hosted / remote sites
    sideEffects.push(
      dispatchExternalIntegrations(topic, payload, shopDomain)
        .catch(err => logger.error('External integrations dispatch failed', err))
    );

    await Promise.allSettled(sideEffects);
  })();
});

// ---------- WEBHOOK MANAGEMENT (register from API) ----------
app.post('/webhooks/register', async (req, res) => {
  try {
    const { topic, address } = req.body;
    if (!topic || !address) {
      return res.status(400).json({ error: 'topic and address required' });
    }
    const webhook = await registerWebhook(topic, address);
    res.json({ success: true, webhook });
  } catch (err) {
    res.status(500).json({ error: 'Failed to register webhook' });
  }
});

app.get('/webhooks', async (req, res) => {
  try {
    const hooks = await listWebhooks();
    res.json(hooks);
  } catch (err) {
    res.status(500).json({ error: 'Failed to list webhooks' });
  }
});

/**
 * One-shot setup for common webhooks using WEBHOOK_BASE_URL.
 * POST /webhooks/setup  → registers the most useful topics pointing at your public URL.
 */
app.post('/webhooks/setup', async (req, res) => {
  if (!WEBHOOK_BASE_URL) {
    return res.status(400).json({ 
      error: 'WEBHOOK_BASE_URL is not set in environment. Set it to your public HTTPS URL first.' 
    });
  }

  const webhookUrl = `${WEBHOOK_BASE_URL}/webhooks`;
  const topics = [
    'products/create',
    'products/update',
    'orders/create',
    'orders/paid',
    // Add more topics you care about here
  ];

  const results = [];

  for (const topic of topics) {
    try {
      const hook = await registerWebhook(topic, webhookUrl);
      results.push({ topic, success: true, id: hook?.id });
    } catch (err) {
      const msg = err.response?.data?.errors || err.message;
      results.push({ topic, success: false, error: msg });
    }
  }

  logger.info('Webhook setup completed', { baseUrl: WEBHOOK_BASE_URL, results });
  res.json({ success: true, baseUrl: WEBHOOK_BASE_URL, webhookUrl, results });
});

// ---------- SIMPLE SERVER-SIDE DASHBOARD (HTML) ----------
app.get('/dashboard', async (req, res) => {
  try {
    const [products, orders] = await Promise.all([
      getProducts({ limit: 6 }),
      getOrders({ status: 'any', limit: 8 })
    ]);

    const salesWidget = generateSalesWidget(orders);
    const productGrid = generateProductGrid(products);
    const activity = generateActivityFeed(products, orders);

    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <title>Shopify + X • Dashboard</title>
          <style>
            body { font-family: system-ui, sans-serif; margin: 40px; background: #fafafa; color: #111; }
            h1 { margin-bottom: 8px; }
            .section { margin: 40px 0; }
            .card { background: white; padding: 20px; border-radius: 12px; box-shadow: 0 1px 3px rgba(0,0,0,0.06); }
          </style>
        </head>
        <body>
          <h1>🛍️ Shopify + 𝕏 Dashboard</h1>
          <p style="color:#666">Built with Grok • <a href="/products">/products</a> • <a href="/orders">/orders</a> • <a href="/webhooks">/webhooks</a></p>

          <div class="section">
            <div class="card">
              ${salesWidget}
            </div>
          </div>

          <div class="section">
            <h2>Latest Products</h2>
            <div class="card">
              ${productGrid}
            </div>
          </div>

          <div class="section">
            <div class="card">
              ${activity}
            </div>
          </div>

          <footer style="margin-top:60px;color:#888;font-size:12px">
            Webhooks: X/Twitter • WordPress • External (Google Apps Script, Cloud, etc.)<br>
            Use <code>POST /webhooks/setup</code> (when WEBHOOK_BASE_URL is set) or register manually.
          </footer>
        </body>
      </html>
    `;
    res.send(html);
  } catch (err) {
    logger.error('Dashboard render failed', err);
    res.status(500).send('<h1>Dashboard error</h1><pre>' + err.message + '</pre>');
  }
});

// ---------- ERROR HANDLER ----------
app.use((err, req, res, next) => {
  logger.error('Unhandled error', err);
  res.status(500).json({ error: 'Internal server error' });
});

// ---------- START (only when run directly, not when imported) ----------
const __filename = fileURLToPath(import.meta.url);
const isMainModule = resolve(process.argv[1] || '') === resolve(__filename);

if (isMainModule) {
  app.listen(PORT, () => {
    logger.info(`🚀 Grok-built Shopify+X server running on port ${PORT}`);
    logger.info(`   Dashboard: http://localhost:${PORT}/dashboard`);
    const effectiveWebhook = WEBHOOK_BASE_URL 
      ? `${WEBHOOK_BASE_URL}/webhooks` 
      : `http://localhost:${PORT}/webhooks (set WEBHOOK_BASE_URL for remote/production)`;
    logger.info(`   Webhook endpoint: POST ${effectiveWebhook}`);
    logger.info(`   Multi-platform: Shopify + eBay + AliExpress → X/Twitter + WordPress + externals`);
    if (!WEBHOOK_SECRET) {
      logger.warn('SHOPIFY_WEBHOOK_SECRET not set — webhooks will be rejected!');
    }
    if (WEBHOOK_BASE_URL) {
      logger.info(`   Remote mode enabled. Use POST /webhooks/setup to register common topics.`);
    }
  });
}

// Export app for testing / advanced use
export default app;
