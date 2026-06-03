# Shopify + X (Twitter) Integration

**Built with Grok as your primary AI coding partner.**

A production-ready Node.js/Express backend that connects your Shopify store to X (Twitter) with:

- Real-time Shopify webhooks (products/create, orders/create, etc.)
- Automatic tweet posting with product images (OAuth 1.0a via `twitter-api-v2`)
- Manual tweet endpoints
- Server-rendered dashboard widgets (HTML)
- Excellent structured logging + "prompt log" style output perfect for feeding back into AI
- Clean, reusable code you can extend

## Project Structure

```
shopify-x-integration/
├── package.json
├── .env.example
├── .gitignore
├── README.md
└── src/
    ├── server.js        # Main Express app + routes + webhook handler
    ├── shopify.js       # Shopify Admin API client (axios)
    ├── twitter.js       # Full X posting with image support
    ├── utils.js         # Logger, formatters, HMAC verifier, tweet generators
    └── widgets.js       # HTML + data widgets for dashboards
```

## Quick Start

1. **Clone / create the folder** and install deps (already done if you followed the session):

   ```bash
   cd shopify-x-integration
   npm install
   ```

2. **Setup environment**

   ```bash
   cp .env.example .env
   ```

   Fill in `.env`:

   ```env
   SHOPIFY_ACCESS_TOKEN=shpat_xxx...
   SHOPIFY_SHOP_DOMAIN=your-store.myshopify.com
   SHOPIFY_WEBHOOK_SECRET=your_random_webhook_secret   # Generate a strong one!

   TWITTER_API_KEY=...
   TWITTER_API_SECRET=...
   TWITTER_ACCESS_TOKEN=...
   TWITTER_ACCESS_SECRET=...
   ```

3. **Run**

   ```bash
   npm start
   # or for auto-reload on changes:
   npm run dev
   ```

4. Visit:
   - `http://localhost:3000/dashboard` — server-rendered sales + product widgets
   - `http://localhost:3000/products`
   - `http://localhost:3000/orders`

## Key Features Implemented

- **Full Twitter posting** (OAuth 1.0a) with image upload from Shopify CDN
- **Webhook receiver** at `POST /webhooks` with proper HMAC verification
- Auto-tweet + **WordPress posts** + **forward to external/Google** on webhook events
- Supports many topics: `products/create`, `products/update`, `orders/create`, `orders/paid`, ...
- Convenient `POST /webhooks/setup` (when `WEBHOOK_BASE_URL` is set)
- Rich logging that prints clean JSON blocks (search for `PROMPT LOG` in console)

## Webhook Setup (Real-time Triggers)

**Your public webhook URL must be HTTPS and reachable by Shopify.**

### 1. For Local Development
Use a tunnel:
```bash
npx ngrok http 3000
# or cloudflared, localtunnel, etc.
```
Then register:
```bash
curl -X POST http://localhost:3000/webhooks/register \
  -H "Content-Type: application/json" \
  -d '{"topic":"products/create","address":"https://abc123.ngrok.io/webhooks"}'
```

### 2. For Production / Remote Hosting (Recommended)
Set `WEBHOOK_BASE_URL` in your `.env` (or hosting platform env vars):

```env
WEBHOOK_BASE_URL=https://your-app.onrender.com
# or https://your-service-xxx-uc.a.run.app   (Google Cloud Run)
# or https://shopify-x-xxx.fly.dev
```

Then use the one-command setup:
```bash
curl -X POST https://your-app.onrender.com/webhooks/setup
```

This registers the most useful topics (`products/create`, `products/update`, `orders/create`, `orders/paid`) pointing at your public `/webhooks` endpoint.

You can also still use individual `POST /webhooks/register` or set them manually inside Shopify Admin.

### 3. In Shopify Admin (Manual)
Settings → Notifications → Webhooks → Create webhook  
Use the exact same `SHOPIFY_WEBHOOK_SECRET` from your `.env`.

The secret + HMAC verification protects your endpoint.

## WordPress Integration

When you create a new product in Shopify, the system can automatically create a draft (or published) post on your WordPress site.

### Setup
1. In WordPress: Users → Profile → Add New Application Password (give it a name like "Shopify Integration").
2. Add to `.env`:

```env
WORDPRESS_SITE_URL=https://your-site.com
WORDPRESS_USERNAME=admin
WORDPRESS_APP_PASSWORD=xxxx xxxx xxxx xxxx xxxx xxxx
```

3. Restart the server. New `products/create` webhooks will now create WordPress posts.

The post includes title, price, featured image (as HTML), description, and a link back to the Shopify product. Tags are synced too.

You can change `status: 'draft'` to `'publish'` in `src/integrations.js`.

**Test connection** (optional):
```bash
curl -X POST http://localhost:3000/webhooks/setup
# (or just trigger a product/create webhook)
```

## Forwarding to Remote / Google-Hosted Websites

Use the `EXTERNAL_WEBHOOK_URLS` variable to fan out every Shopify event to any number of HTTPS endpoints.

This is perfect for:
- Google Apps Script Web Apps
- Google Cloud Functions / Cloud Run
- Firebase
- Your own remote Node/Python/PHP site
- n8n, Make.com (Integromat), Zapier Catch Hooks, etc.

### Setup
```env
EXTERNAL_WEBHOOK_URLS=https://script.google.com/macros/s/XXXXXXXXXXXXXXXX/exec,https://my-cloud-function.run.app/shopify-webhook
```

Every webhook (regardless of topic) will be `POST`ed as JSON to all listed URLs, with extra headers:
- `X-Shopify-Topic`
- `X-Shopify-Shop-Domain`
- `X-Source: shopify-x-integration`

Your remote endpoint just needs to accept `POST` with a JSON body.

### Example: Google Apps Script Receiver (copy-paste ready)

1. Go to https://script.google.com → New project
2. Paste this code:

```javascript
function doPost(e) {
  const data = JSON.parse(e.postData.contents);
  const topic = e.parameter['X-Shopify-Topic'] || e.postData.headers?.['X-Shopify-Topic'] || 'unknown';

  // Example: Log everything to a Google Sheet
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('ShopifyEvents') 
                || SpreadsheetApp.getActiveSpreadsheet().insertSheet('ShopifyEvents');
  sheet.appendRow([new Date(), topic, JSON.stringify(data)]);

  // Example actions:
  if (topic === 'products/create') {
    // Send yourself an email, update a site, create a Calendar event, etc.
    GmailApp.sendEmail('you@gmail.com', 'New Shopify Product', 
      `New product: ${data.title}\nPrice: ${data.variants?.[0]?.price}`);
  }

  if (topic === 'orders/create' || topic === 'orders/paid') {
    // Forward to your internal system, update inventory in another tool, etc.
  }

  return ContentService.createTextOutput('OK').setMimeType(ContentService.MimeType.TEXT);
}
```

3. Deploy → New deployment → Web app → Execute as "Me" → Who has access: "Anyone"
4. Copy the `/exec` URL and put it in `EXTERNAL_WEBHOOK_URLS`
5. Re-deploy after changes.

This gives you a completely free, serverless Google-hosted receiver that can do almost anything.

## More Webhook Topics

The receiver already listens for any topic Shopify sends. Out of the box we react to:

- `products/create` → Tweet + (optional) WordPress post + external
- `orders/create` → Tweet + external
- `products/update`, `orders/paid` → logged + forwarded to externals

Add your own reactions easily in `src/server.js` inside the webhook handler.

## Manual Tweeting

```bash
# Tweet a specific product (auto-generates nice text + image)
curl -X POST http://localhost:3000/tweet-product \
  -H "Content-Type: application/json" \
  -d '{"productId": 1234567890}'

# With custom text
curl -X POST http://localhost:3000/tweet-product \
  -H "Content-Type: application/json" \
  -d '{"productId": 1234567890, "customText": "Check out our new limited drop! 🔥 https://..."}'
```

## Logging & AI-Friendly Output

The logger has a special `promptLog` method. Whenever important actions happen (tweets, etc.), it prints a block like:

```
============================================================
PROMPT LOG: TWEETED PRODUCT
============================================================
{
  "product": { ... },
  "result": { ... }
}
============================================================
```

Copy-paste these straight into your next prompt to Cursor / Grok / Claude for perfect context.

## Extending the Project (High-Velocity Next Steps)

The original session listed:

1. ✅ Complete Twitter posting (OAuth 1.0a full implementation) — **DONE**
2. ✅ Webhooks for real-time new product/order triggers + WordPress + Google/external — **DONE**
3. Frontend Dashboard (React/Vite + widgets)
4. Cron jobs for daily summaries (recommend `node-cron` + summary tweets)
5. ✅ Full README with setup instructions — **DONE**
6. ✅ Error handling + prompt log style documentation — **DONE**

### Suggested next chunks (pick one):

**A. Daily summary cron** (add `node-cron`)

```js
import cron from 'node-cron';
cron.schedule('0 18 * * *', async () => {
  const orders = await getRecentOrders(50);
  const summary = generateDailySummaryTweet(orders);
  await postToTwitter(summary);
});
```

**B. React + Vite frontend** (separate `frontend/` folder)
- Use the existing widgets as inspiration or call the API routes.
- Show live product grid + "Tweet this" buttons.

**C. More webhook topics + database persistence**
- Add Postgres/SQLite + store tweeted items so you never double-post.
- Handle `orders/paid`, `products/update`, `refunds/create`.

**D. Better media handling**
- Support multiple images per tweet.
- Video uploads (more complex).

## Environment Variables Reference

See [.env.example](.env.example).

## Security Notes

- Never commit `.env`
- Webhook verification is mandatory — the code will reject unsigned requests
- Twitter OAuth 1.0a keys have full posting permission — guard them

## Tech Stack

- Node 18+
- Express 5
- axios
- twitter-api-v2 (best maintained X client)
- No database yet (easy to add)

---

**This entire project was built in high-velocity mode with Grok.**

Ready for the next piece? Just say the number or describe (e.g. "add daily cron summaries + a nice summary tweet generator" or "scaffold the React dashboard").

Prompt example you can reuse:

> Continue the shopify-x-integration project at C:\Users\david\projects\shopify-x-integration. Current state: core server, full Twitter OAuth1 posting with images, verified webhooks, widgets, and logger are complete. Next: [describe exactly what you want, e.g. "implement daily summary cron that tweets top products + sales every evening at 6pm, add a utils function generateDailySummaryTweet"].
> Keep the same style: excellent comments, logger.promptLog where useful, ESM, minimal deps.

Let's ship the next chunk!
