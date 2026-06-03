# Shopify + X (Twitter) + eBay + AliExpress Integration

**Built with Grok as your primary AI coding partner.**

A production-ready Node.js/Express backend + React/Vite frontend that connects **Shopify, eBay, and AliExpress** to X (Twitter), WordPress, and any external endpoint, with:

- Real-time Shopify webhooks
- Multi-platform product/order fetching and announcement tweeting
- Easy deployment to **Amazon Web Services** (Docker + App Runner ready)

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

- **Full Twitter posting** (OAuth 1.0a) with image upload
- **Multi-platform support**: Shopify + **eBay** + **AliExpress**
- Real-time **Shopify webhooks** → X + WordPress + external (Google, n8n, etc.)
- Fetch products/orders from eBay and AliExpress and tweet them
- **AWS-ready**: Dockerfile + healthchecks + instructions for App Runner / ECS + GitHub Actions + SSM loader
- **React/Vite Dashboard**: Unified view across all platforms with tweet & import buttons
- Convenient `POST /webhooks/setup` + platform-specific tweet + import endpoints + daily cron
- Rich prompt-log style logging for AI-assisted development

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

## Deploying to Amazon Web Services (AWS)

This app is container-ready and works great on AWS.

### Recommended: AWS App Runner (easiest)

1. Push your code to GitHub (you already did).
2. Go to AWS App Runner → Create service → Source = GitHub.
3. Select this repo + branch.
4. Build settings:
   - Runtime: Node.js (or use the Dockerfile for more control)
   - For Dockerfile: Choose "Deploy with a Dockerfile"
5. Environment variables: Copy everything from your `.env` (especially `SHOPIFY_*`, Twitter keys, `WEBHOOK_BASE_URL` will be set after first deploy).
6. After deploy, App Runner gives you a URL like `https://abc123.us-west-2.awsapprunner.com`.
7. Set `WEBHOOK_BASE_URL` (or `AWS_WEBHOOK_BASE_URL`) to that URL and restart/redeploy.
8. Run:
   ```bash
   curl -X POST https://your-app.awsapprunner.com/webhooks/setup
   ```

App Runner gives you automatic HTTPS, scaling, and a stable public URL — perfect for Shopify + eBay webhooks.

### Alternative: Docker on ECS / Fargate / Elastic Beanstalk

We provide a production `Dockerfile` + `.dockerignore`.

Build & push:
```bash
docker build -t shopify-x-integration .
docker tag ... your-ecr-repo
docker push ...
```

Then deploy the image to:
- AWS App Runner (container)
- ECS Fargate
- Elastic Beanstalk (Docker platform)
- EKS (overkill for this)

The Dockerfile includes a non-root user and a `/health` endpoint that AWS load balancers like.

### Secrets on AWS (Advanced)
- Use the built-in SSM loader: set `AWS_SSM_ENABLED=true` and `AWS_SSM_PARAM_PREFIX=/shopify-x-integration/prod/`
  - At startup the app pulls params (e.g. SHOPIFY_ACCESS_TOKEN) using the task role and injects them.
- Or use App Runner's built-in env var / secret injection.
- Scripts in `scripts/deploy-app-runner.ps1` (and .sh) help with container deploys to ECR + update service.

See `src/aws.js` and the scripts/ folder.

## eBay Integration

### Setup
1. Create an app at https://developer.ebay.com/my/keys
2. Get **App ID (Client ID)** and **App Secret (Client Secret)**
3. For accessing **your own listings and orders**, generate a user access token (OAuth2 user consent flow or use the "Get Token" tool in the developer portal for testing).
4. Add to `.env`:

```env
EBAY_ENV=production          # or "sandbox"
EBAY_APP_ID=...
EBAY_APP_SECRET=...
EBAY_ACCESS_TOKEN=...        # user token for seller data
```

### Usage

```bash
# Search / list eBay products
curl "http://localhost:3000/ebay/products?limit=10&q=wireless%20headphones"

# Tweet an eBay item (you can pass the full item JSON or just an ID in advanced usage)
curl -X POST http://localhost:3000/tweet-ebay-product \
  -H "Content-Type: application/json" \
  -d '{"itemId": "1234567890"}'
```

The code supports both public Browse API and authenticated seller Inventory/Fulfillment APIs.

**eBay Webhooks**: eBay has "Event Notifications". You can point them at `/webhooks` (or add a dedicated `/ebay/webhooks` receiver) and use `verifyEbayWebhook` from `ebay.js`.

## AliExpress Integration

### Setup
1. Go to the AliExpress Open Platform (https://open.aliexpress.com/) or Alibaba Cloud.
2. Create an app and get **App Key** + **App Secret**.
3. Some advanced calls need an access token.
4. Add to `.env`:

```env
ALIBABA_APP_KEY=...
ALIBABA_APP_SECRET=...
```

### Usage

```bash
# Search products (very useful for inspiration / deals accounts)
curl "http://localhost:3000/aliexpress/search?q=smart%20watch&limit=8"

# Tweet a trending AliExpress product
curl -X POST http://localhost:3000/tweet-aliexpress-product \
  -H "Content-Type: application/json" \
  -d '{"keywords": "portable blender"}'
```

AliExpress is excellent for:
- Finding trending low-cost products to promote
- Cross-posting between your Shopify/eBay store and AliExpress supplier links
- Building "daily deals" Twitter accounts

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

## Scheduled Jobs (Daily Cross-Platform Summaries)

Enable automatic daily tweets that pull "best" items from **all three platforms** and post a combined summary.

### Setup
```env
ENABLE_DAILY_SUMMARY_CRON=true
DAILY_SUMMARY_CRON_SCHEDULE="0 18 * * *"   # 6pm UTC (cron syntax)
DAILY_SUMMARY_KEYWORDS="trending gadgets,wireless earbuds,smart watch,portable blender"
```

The cron runs at the schedule, fetches latest/popular from Shopify + eBay + AliExpress, picks representatives, and tweets something like:

```
🛍️ Daily Cross-Platform Picks (6/4/2026)

1. Shopify: Wireless Noise Cancelling Headphones — $89
   https://yourstore.myshopify.com/...
2. eBay: ...
3. AliExpress: ...

#Deals #Shopify #eBay #AliExpress
```

### Manual trigger
```bash
curl -X POST https://your-app.awsapprunner.com/cron/trigger-summary
```

Great for "daily deals" Twitter accounts that aggregate across stores.

## eBay Event Notifications (Real Webhooks)

eBay can push events (ItemListed, ItemRevised, Order, etc.) to your server.

### Setup
1. In eBay Developer portal, subscribe to Event Notifications for your app.
2. Point the destination to `https://your-public-url/ebay/webhooks`
3. Your server will verify the `X-EBAY-SIGNATURE` (full ECDSA verification implemented in src/ebay.js).

The receiver currently auto-tweets on item listing events. Extend in `src/server.js` for orders, returns, etc.

See also the legacy Platform Notifications if using older Trading API (different signature).

## Product Import Flows

Easily import products from AliExpress (or eBay) into your Shopify store as **drafts**.

### Example: AliExpress → Shopify
```bash
curl -X POST https://your-app.../import/aliexpress-to-shopify \
  -H "Content-Type: application/json" \
  -d '{"keywords": "portable mini projector"}'
```

This:
- Searches AliExpress
- Normalizes the product (title, price, image, url)
- Creates a **draft** product in Shopify via Admin API (safe — you review & publish)

You can also pass `itemId` for exact product.

Extend `importToShopifyFromExternal` in `src/shopify.js` for more fields (variants, options, SEO, etc.).

Similar flows can be added for eBay → Shopify.

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

## Enhanced X/Twitter Features (Marketing, Ads, Special Events)

- Marketing tweets: `POST /tweet-marketing` with UTM params, campaign tracking, auto Imagine ad images.
- Ads support: `GET /tweet-metrics/:tweetId` for analytics (public + organic metrics). `GET /twitter/ads-access` check.
- Special events: `POST /tweet-special-event` for holidays, sales, launches. Easy to wire into cron.
- Frontend Twitter Hub: Test buttons, metrics lookup, ads status.
- See `src/twitter.js` (postMarketingTweet, getTweetMetrics, tweetSpecialEvent) and utils for generators.

## Extending the Project (High-Velocity Next Steps)

Current status (built with Grok):

- ✅ Shopify + eBay + AliExpress product/order fetching + import flows (Ali/eBay → Shopify, bulk supported)
- ✅ Multi-platform tweeting (X) + daily cross-platform summary cron (scoring + email fallback)
- ✅ Shopify webhooks + eBay Event Notifications (verified) + WordPress + arbitrary external forwards
- ✅ AWS hosting ready (Dockerfile + App Runner scripts + SSM secrets loader + GitHub Actions)
- ✅ Frontend Dashboard (React/Vite - unified view + tweet/import + xAI Grok Imagine + Twitter Marketing Hub)
- ✅ xAI Grok Imagine API integration (image gen, product ad mockups, edits, video)
- ✅ Enhanced X/Twitter: Marketing integration, Ads support (metrics), Special events
- ✅ Excellent docs + prompt logs

Run frontend: `npm run frontend` (after `cd frontend && npm install` if needed)
Full dev: `npm run dev:full` (requires concurrently)

Next high-value additions could be:
- Real eBay Event Notifications receiver
- Full product sync (e.g. import AliExpress item → create Shopify draft)
- React frontend that shows all three platforms in one dashboard
- Daily summary cron that posts "Today's best from Shopify + eBay + AliExpress"

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

> Continue the shopify-x-integration project at C:\Users\david\projects\shopify-x-integration. We now support Shopify + eBay + AliExpress + AWS hosting + webhooks to multiple destinations. Next: [describe exactly, e.g. "add a /cron/daily-summary route + node-cron that pulls best products from all platforms and tweets a combined summary"].
> Keep the same style: excellent comments, logger.promptLog where useful, ESM, minimal deps.

Let's ship the next chunk!
