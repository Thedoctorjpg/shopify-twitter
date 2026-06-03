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

const ENABLE_CRON = process.env.ENABLE_DAILY_SUMMARY_CRON === 'true';
const CRON_SCHEDULE = process.env.DAILY_SUMMARY_CRON_SCHEDULE || '0 18 * * *'; // 6pm UTC daily
const ALI_KEYWORDS = (process.env.DAILY_SUMMARY_KEYWORDS || 'trending gadgets,wireless earbuds,portable blender').split(',').map(k => k.trim());

let cronTask = null;

/**
 * Select "best" items heuristically.
 * For demo: take latest from Shopify/eBay, popular search from AliExpress.
 * In real: could use price, rating, created date, sales signals if available.
 */
async function getBestCrossPlatformItems() {
  const items = [];

  try {
    // Shopify - latest products
    const shopifyProducts = await getProducts({ limit: 5 });
    if (shopifyProducts.length > 0) {
      const bestShop = shopifyProducts[0]; // or pick by price etc.
      items.push({
        platform: 'Shopify',
        title: bestShop.title,
        price: bestShop.variants?.[0]?.price,
        url: bestShop.handle ? `https://${process.env.SHOPIFY_SHOP_DOMAIN}/products/${bestShop.handle}` : '',
        image: bestShop.images?.[0]?.src,
        raw: bestShop
      });
    }
  } catch (e) {
    logger.warn('Cron: failed to fetch Shopify products for summary', { error: e.message });
  }

  try {
    // eBay - popular or recent
    const ebayItems = await getEbayProducts({ limit: 5, q: 'best seller' });
    if (ebayItems.length > 0) {
      const bestEbay = ebayItems[0];
      const formatted = formatEbayProductForTweet(bestEbay);
      items.push({
        platform: 'eBay',
        title: formatted.title,
        price: formatted.price,
        url: formatted.url,
        image: formatted.image,
        raw: bestEbay
      });
    }
  } catch (e) {
    logger.warn('Cron: failed to fetch eBay products for summary', { error: e.message });
  }

  try {
    // AliExpress - search trending keywords, pick first good one
    const keyword = ALI_KEYWORDS[Math.floor(Math.random() * ALI_KEYWORDS.length)];
    const aliResults = await searchAliExpressProducts(keyword, { limit: 3 });
    if (aliResults.length > 0) {
      const bestAli = aliResults[0];
      const formatted = formatAliExpressProduct(bestAli);
      items.push({
        platform: 'AliExpress',
        title: formatted.title,
        price: formatted.price,
        url: formatted.url,
        image: formatted.image,
        raw: bestAli
      });
    }
  } catch (e) {
    logger.warn('Cron: failed to fetch AliExpress products for summary', { error: e.message });
  }

  return items;
}

/**
 * Generate and post a daily cross-platform summary tweet.
 */
export async function runDailySummary() {
  logger.info('Starting daily cross-platform summary cron job...');

  const items = await getBestCrossPlatformItems();

  if (items.length === 0) {
    logger.warn('Daily summary: no items fetched from any platform. Skipping tweet.');
    return { success: false, reason: 'no items' };
  }

  let tweetText = `🛍️ Daily Cross-Platform Picks (${new Date().toLocaleDateString()})\n\n`;

  items.forEach((item, idx) => {
    const priceStr = item.price ? `$${item.price}` : '';
    tweetText += `${idx + 1}. ${item.platform}: ${item.title} ${priceStr}\n`;
    if (item.url) tweetText += `   ${item.url}\n`;
  });

  tweetText += `\n#Deals #Shopify #eBay #AliExpress`;

  // Truncate if needed (Twitter limit)
  if (tweetText.length > 280) {
    tweetText = tweetText.slice(0, 277) + '...';
  }

  try {
    // Post with first image if available
    const firstImage = items.find(i => i.image)?.image;
    const result = await postToTwitter(tweetText, firstImage ? [firstImage] : []);

    logger.info('Daily summary tweet posted', { result, itemCount: items.length });
    logger.promptLog('DAILY CROSS-PLATFORM SUMMARY TWEET', { tweet: tweetText, items: items.map(i => ({platform: i.platform, title: i.title})) });

    return { success: true, result, items };
  } catch (err) {
    logger.error('Failed to post daily summary tweet', err);
    return { success: false, error: err.message };
  }
}

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

export default { startCrons, runDailySummary, triggerSummaryNow };
