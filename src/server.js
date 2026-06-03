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

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;
const WEBHOOK_SECRET = process.env.SHOPIFY_WEBHOOK_SECRET;

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
      'GET /products',
      'GET /products/:id',
      'GET /orders',
      'POST /tweet-product',
      'POST /tweet-order',
      'POST /webhooks',
      'GET /dashboard',
      'POST /webhooks/register'
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

  // React to events
  try {
    if (topic === 'products/create') {
      const tweetResult = await tweetNewProduct(payload);
      logger.info('Auto-tweeted new product from webhook', { productId: payload.id, tweetResult });
      // You could also save to DB here
    }

    if (topic === 'orders/create') {
      const tweetResult = await tweetNewOrder(payload);
      logger.info('Auto-tweeted new order from webhook', { orderId: payload.id, tweetResult });
    }

    // Add more topics as needed: 'orders/paid', 'products/update', etc.
  } catch (err) {
    logger.error('Error while processing webhook side-effects', err);
    // Still return 200 to Shopify so it doesn't retry forever
  }

  // Always acknowledge quickly
  res.status(200).send('OK');
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
          <p style="color:#666">Built with Grok • <a href="/products">/products</a> • <a href="/orders">/orders</a></p>

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
            Auto-tweeting enabled for products/create & orders/create via webhooks.
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
    logger.info(`   Webhook endpoint: POST http://localhost:${PORT}/webhooks`);
    if (!WEBHOOK_SECRET) {
      logger.warn('SHOPIFY_WEBHOOK_SECRET not set — webhooks will be rejected!');
    }
  });
}

// Export app for testing / advanced use
export default app;
