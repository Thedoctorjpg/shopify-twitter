/**
 * twitter.js
 * Full X/Twitter integration using twitter-api-v2 (OAuth 1.0a User Context)
 * Supports posting text tweets and tweets with images (from Shopify product images).
 */

import { TwitterApi } from 'twitter-api-v2';
import axios from 'axios';
import { logger } from './utils.js';

let rwClient = null;

function getTwitterClient() {
  if (rwClient) return rwClient;

  const appKey = process.env.TWITTER_API_KEY;
  const appSecret = process.env.TWITTER_API_SECRET;
  const accessToken = process.env.TWITTER_ACCESS_TOKEN;
  const accessSecret = process.env.TWITTER_ACCESS_SECRET;

  if (!appKey || !appSecret || !accessToken || !accessSecret) {
    logger.warn('Twitter credentials missing. Using mock mode.');
    return null;
  }

  try {
    const client = new TwitterApi({
      appKey,
      appSecret,
      accessToken,
      accessSecret,
    });
    rwClient = client.readWrite;
    logger.info('Twitter client initialized (OAuth 1.0a)');
    return rwClient;
  } catch (err) {
    logger.error('Failed to initialize Twitter client', err);
    return null;
  }
}

/**
 * Upload an image from a URL (e.g. Shopify CDN) and return media_id
 */
async function uploadImageFromUrl(imageUrl) {
  const client = getTwitterClient();
  if (!client) throw new Error('Twitter client not available');

  try {
    logger.debug(`Downloading image for upload: ${imageUrl}`);
    const response = await axios.get(imageUrl, { responseType: 'arraybuffer', timeout: 15000 });
    const buffer = Buffer.from(response.data, 'binary');

    // Determine mime type from response or url
    const contentType = response.headers['content-type'] || 'image/jpeg';
    
    const mediaId = await client.v1.uploadMedia(buffer, { mimeType: contentType });
    logger.info('Image uploaded to X', { mediaId, size: buffer.length });
    return mediaId;
  } catch (err) {
    logger.error('Image upload to X failed', err, { imageUrl });
    throw err;
  }
}

/**
 * Post a tweet. Optionally attach media from Shopify image URLs.
 * @param {string} text 
 * @param {string[]} imageUrls - optional array of image URLs to attach (first one used for simplicity)
 * @returns {Promise<{success: boolean, tweetId?: string, url?: string, error?: string}>}
 */
export async function postToTwitter(text, imageUrls = []) {
  const client = getTwitterClient();

  if (!client) {
    // Mock mode for development / when creds missing
    logger.info('[MOCK X] Would post tweet', { text: text.slice(0, 100), imageCount: imageUrls.length });
    const fakeId = 'mock_' + Date.now();
    return {
      success: true,
      tweetId: fakeId,
      url: `https://x.com/i/web/status/${fakeId}`,
      mock: true
    };
  }

  try {
    let mediaIds = [];

    if (imageUrls.length > 0) {
      // Upload first image only (Twitter free tier allows 4, but keep simple)
      try {
        const mediaId = await uploadImageFromUrl(imageUrls[0]);
        mediaIds.push(mediaId);
      } catch (uploadErr) {
        logger.warn('Proceeding without image due to upload failure', { error: uploadErr.message });
      }
    }

    const tweetOptions = mediaIds.length > 0 ? { media: { media_ids: mediaIds } } : {};
    
    const { data: createdTweet } = await client.v2.tweet(text, tweetOptions);

    const tweetUrl = `https://x.com/i/web/status/${createdTweet.id}`;
    logger.info('Tweet posted successfully', { id: createdTweet.id, url: tweetUrl });

    return {
      success: true,
      tweetId: createdTweet.id,
      url: tweetUrl,
      text
    };
  } catch (err) {
    // Handle common Twitter errors gracefully
    const errorMsg = err.data?.detail || err.message || 'Unknown Twitter error';
    logger.error('Failed to post to X/Twitter', err, { errorMsg, textPreview: text.slice(0, 80) });
    
    return {
      success: false,
      error: errorMsg,
      rateLimit: err.rateLimit || null
    };
  }
}

/**
 * Post a product announcement tweet (convenience wrapper)
 */
export async function tweetNewProduct(product) {
  const { generateProductTweet, formatProductForTweet } = await import('./utils.js');
  const tweetText = generateProductTweet(product);
  const imageUrl = product.images?.[0]?.src;
  const imageUrls = imageUrl ? [imageUrl] : [];
  
  return postToTwitter(tweetText, imageUrls);
}

/**
 * Post an order notification tweet (privacy-safe)
 */
export async function tweetNewOrder(order) {
  const { generateOrderTweet } = await import('./utils.js');
  const tweetText = generateOrderTweet(order);
  return postToTwitter(tweetText);
}

/**
 * Verify credentials (useful for health checks)
 */
export async function verifyTwitterCredentials() {
  const client = getTwitterClient();
  if (!client) return { ok: false, mock: true };

  try {
    const me = await client.v2.me();
    return { ok: true, user: me.data };
  } catch (err) {
    return { ok: false, error: err.message };
  }
}

/**
 * Post a marketing tweet with tracking and rich options.
 * Integrates with Imagine for ad creatives if image provided/generated.
 */
export async function postMarketingTweet(item, options = {}) {
  const { generateMarketingTweet, suggestHashtags } = await import('./utils.js');
  const { generateProductAd } = await import('./imagine.js').catch(() => ({}));

  let tweetText = generateMarketingTweet(item, options);

  // Auto-generate marketing image if no image and Imagine available
  let imageUrls = options.imageUrls || [];
  if (imageUrls.length === 0 && generateProductAd && item) {
    try {
      const adResult = await generateProductAd(item, options.adScene || 'promotional marketing shot');
      if (adResult && (adResult.url || adResult[0]?.url)) {
        const adUrl = adResult.url || adResult[0].url;
        imageUrls = [adUrl];
        logger.info('Auto-generated marketing creative with xAI Imagine');
      }
    } catch (e) {
      logger.debug('Could not auto-generate ad image', { error: e.message });
    }
  }

  if (options.hashtags) {
    tweetText = tweetText.replace(/#[\w]+/g, ''); // remove defaults if custom
    tweetText += `\n\n${options.hashtags}`;
  } else {
    tweetText += `\n\n${suggestHashtags(item, options.platform)}`;
  }

  return postToTwitter(tweetText, imageUrls);
}

/**
 * Fetch metrics for a tweet (useful for marketing analytics / ads performance)
 */
export async function getTweetMetrics(tweetId) {
  const client = getTwitterClient();
  if (!client) {
    return { mock: true, metrics: { like_count: 42, retweet_count: 12, reply_count: 5, impression_count: 1200 } };
  }

  try {
    const tweet = await client.v2.singleTweet(tweetId, {
      'tweet.fields': 'public_metrics,non_public_metrics,organic_metrics'
    });
    const metrics = tweet.data.public_metrics || {};
    logger.info('Fetched tweet metrics', { tweetId, metrics });
    return { success: true, tweetId, metrics };
  } catch (err) {
    logger.error('Failed to fetch tweet metrics', err);
    return { success: false, error: err.message };
  }
}

/**
 * Post a tweet for special events (holidays, flash sales, launches)
 */
export async function tweetSpecialEvent(eventName, item, options = {}) {
  const { generateSpecialEventTweet } = await import('./utils.js');
  const tweetText = generateSpecialEventTweet(eventName, item, options);

  let imageUrls = options.imageUrls || [];
  if (imageUrls.length === 0 && item.image) {
    imageUrls = [item.image];
  }

  return postToTwitter(tweetText, imageUrls);
}

/**
 * Verify if account has ads access (basic check)
 */
export async function checkAdsAccess() {
  const client = getTwitterClient();
  if (!client) return { hasAdsAccess: false, mock: true };

  // In real, would call Ads API or check scopes. For now, placeholder.
  try {
    const me = await client.v2.me();
    return { hasAdsAccess: true, user: me.data, note: 'Full Ads API requires separate Ads account access and different endpoints.' };
  } catch {
    return { hasAdsAccess: false };
  }
}

export default { 
  postToTwitter, 
  tweetNewProduct, 
  tweetNewOrder, 
  verifyTwitterCredentials,
  postMarketingTweet,
  getTweetMetrics,
  tweetSpecialEvent,
  checkAdsAccess
};
