/**
 * cron.js
 * Scheduled jobs for cross-platform summaries, etc.
 * Uses node-cron for reliable daily tasks.
 *
 * Env:
 *   ENABLE_DAILY_SUMMARY_CRON=true
 *   DAILY_SUMMARY_CRON_SCHEDULE="0 18 * * *"   # 6pm daily (default)
 *   DAILY_SUMMARY_KEYWORDS="trending gadgets,wireless earbuds,smart watch"  # for AliExpress
 */

import cron from 'node-cron';
import { logger } from './utils.js';
import { getProducts } from './shopify.js';
import { getEbayProducts, formatEbayProductForTweet } from './ebay.js';
import { searchAliExpressProducts, formatAliExpressProduct } from './aliexpress.js';
import { postToTwitter } from './twitter.js';
import nodemailer from 'nodemailer';

const ENABLE_CRON = process.env.ENABLE_DAILY_SUMMARY_CRON === 'true';
const CRON_SCHEDULE = process.env.DAILY_SUMMARY_CRON_SCHEDULE || '0 18 * * *'; // 6pm UTC daily
const ALI_KEYWORDS = (process.env.DAILY_SUMMARY_KEYWORDS || 'trending gadgets,wireless earbuds,portable blender').split(',').map(k => k.trim());

let cronTask = null;

/**
 * Score an item for "best" selection. Higher = better.
 * Factors: lower price good, higher rating good, recency bonus.
 */
function scoreItem(item, platform) {
  const price = parseFloat(item.price || item.variants?.[0]?.price || item.sale_price || 999) || 999;
  const rating = parseFloat(item.average_rating || item.rating || '4.5') || 4.5;
  const priceScore = Math.max(0, (200 - price) / 200); // cheaper better
  const ratingScore = (rating - 3) / 2; // 0-1
  let recency = 0.5;
  if (item.created_at || item.createdAt) {
    const ageDays = (Date.now() - new Date(item.created_at || item.createdAt)) / (1000*3600*24);
    recency = Math.max(0.1, 1 - ageDays / 30);
  }
  return (priceScore * 0.5) + (ratingScore * 0.3) + (recency * 0.2);
}

/**
 * Select "best" items with improved scoring across platforms.
 */
async function getBestCrossPlatformItems() {
  const candidates = [];

  try {
    const shopifyProducts = await getProducts({ limit: 6 });
    shopifyProducts.forEach(p => {
      const score = scoreItem(p, 'shopify');
      candidates.push({ platform: 'Shopify', score, raw: p, formatted: {
        title: p.title,
        price: p.variants?.[0]?.price,
        url: p.handle ? `https://${process.env.SHOPIFY_SHOP_DOMAIN}/products/${p.handle}` : '',
        image: p.images?.[0]?.src
      }});
    });
  } catch (e) {
    logger.warn('Cron: failed to fetch Shopify products for summary', { error: e.message });
  }

  try {
    const ebayItems = await getEbayProducts({ limit: 6, q: 'best seller' });
    ebayItems.forEach(item => {
      const f = formatEbayProductForTweet(item);
      const score = scoreItem({price: f.price, rating: '4.7'}, 'ebay');
      candidates.push({ platform: 'eBay', score, raw: item, formatted: f });
    });
  } catch (e) {
    logger.warn('Cron: failed to fetch eBay products for summary', { error: e.message });
  }

  try {
    const keyword = ALI_KEYWORDS[Math.floor(Math.random() * ALI_KEYWORDS.length)];
    const aliResults = await searchAliExpressProducts(keyword, { limit: 6 });
    aliResults.forEach(item => {
      const f = formatAliExpressProduct(item);
      const score = scoreItem({price: f.price, rating: f.rating || '4.6'}, 'ali');
      candidates.push({ platform: 'AliExpress', score, raw: item, formatted: f });
    });
  } catch (e) {
    logger.warn('Cron: failed to fetch AliExpress products for summary', { error: e.message });
  }

  // Sort by score desc, take top 4
  candidates.sort((a, b) => b.score - a.score);
  return candidates.slice(0, 4).map(c => ({ platform: c.platform, ...c.formatted, raw: c.raw }));
}

/**
 * Generate and post a daily cross-platform summary tweet.
 */
// Old combined tweet version removed in favor of per-item + email fallback (see enhanced version below)

/**
 * Start the scheduled cron if enabled.
 */
export function startCrons() {
  if (!ENABLE_CRON) {
    logger.info('Daily summary cron disabled (set ENABLE_DAILY_SUMMARY_CRON=true to enable)');
    return;
  }

  if (cronTask) {
    cronTask.stop();
  }

  cronTask = cron.schedule(CRON_SCHEDULE, async () => {
    await runDailySummary();
  }, {
    scheduled: true,
    timezone: 'UTC'
  });

  logger.info(`Daily cross-platform summary cron started. Schedule: ${CRON_SCHEDULE} (UTC)`);
}

/**
 * Manual trigger (for testing or API call)
 */
export async function triggerSummaryNow() {
  return runDailySummary();
}

/**
 * Optional email fallback using nodemailer (configure SMTP in env).
 */
async function sendEmailSummary(items, tweetResults) {
  const { EMAIL_HOST, EMAIL_USER, EMAIL_PASS, EMAIL_TO } = process.env;
  if (!EMAIL_HOST || !EMAIL_USER || !EMAIL_TO) return { skipped: true };

  try {
    const transporter = nodemailer.createTransport({
      host: EMAIL_HOST,
      port: 587,
      secure: false,
      auth: { user: EMAIL_USER, pass: EMAIL_PASS }
    });

    const text = `Daily Cross-Platform Summary\n\n` + items.map(i => 
      `${i.platform}: ${i.title} - $${i.price}\n${i.url}`
    ).join('\n\n') + `\n\nTweets: ${JSON.stringify(tweetResults, null, 2)}`;

    await transporter.sendMail({
      from: EMAIL_USER,
      to: EMAIL_TO,
      subject: '🛍️ Daily Multi-Platform Summary',
      text
    });
    logger.info('Summary email sent as fallback');
    return { success: true };
  } catch (e) {
    logger.error('Email fallback failed', e);
    return { success: false };
  }
}

// Enhance run to support multiple tweets + email fallback
export async function runDailySummary() {
  logger.info('Starting daily cross-platform summary cron job...');

  const items = await getBestCrossPlatformItems();

  if (items.length === 0) {
    logger.warn('Daily summary: no items fetched from any platform. Skipping tweet.');
    return { success: false, reason: 'no items' };
  }

  const tweetResults = [];
  for (const item of items) {
    let text = `${item.platform} pick: ${item.title}`;
    if (item.price) text += ` — $${item.price}`;
    if (item.url) text += `\n${item.url}`;
    text += `\n\n#Deals #${item.platform}`;

    try {
      const res = await postToTwitter(text, item.image ? [item.image] : []);
      tweetResults.push({ platform: item.platform, success: true, ...res });
    } catch (e) {
      tweetResults.push({ platform: item.platform, success: false, error: e.message });
    }
  }

  // If any tweet failed, or always, send email fallback
  const anyFail = tweetResults.some(r => !r.success);
  if (anyFail || process.env.ALWAYS_EMAIL_SUMMARY === 'true') {
    await sendEmailSummary(items, tweetResults);
  }

  logger.info('Daily summary completed', { itemCount: items.length, tweets: tweetResults.length });
  logger.promptLog('DAILY CROSS-PLATFORM SUMMARY', { items, tweetResults });

  return { success: true, items, tweetResults };
}

export default { startCrons, runDailySummary, triggerSummaryNow };
