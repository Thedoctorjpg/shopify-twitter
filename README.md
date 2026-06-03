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
- **Webhook receiver** at `POST /webhooks` with proper HMAC verification (`utils.js:verifyShopifyWebhook`)
- Auto-tweet on `products/create` and `orders/create`
- Webhook registration helper: `POST /webhooks/register`
- Rich logging that prints clean JSON blocks (search for `PROMPT LOG` in console)

## Webhook Setup (Real-time Triggers)

### Option A: Use the built-in registration endpoint

```bash
curl -X POST http://localhost:3000/webhooks/register \
  -H "Content-Type: application/json" \
  -d '{
    "topic": "products/create",
    "address": "https://your-public-url.ngrok.io/webhooks"
  }'
```

(Use ngrok or similar for local development.)

### Option B: In Shopify Admin

1. Go to Settings → Notifications → Webhooks
2. Create webhook for:
   - `Product creation` → `https://your-domain/webhooks`
   - `Order creation`
3. Use the same `SHOPIFY_WEBHOOK_SECRET` you put in `.env`

The secret is used to verify `X-Shopify-Hmac-Sha256` header.

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
2. ✅ Webhooks for real-time new product/order triggers — **DONE**
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
