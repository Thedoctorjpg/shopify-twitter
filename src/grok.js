/**
 * grok.js
 * Integration with xAI Grok for text generation (marketing copy, event tweets, etc.).
 * Uses OpenAI-compatible chat completions API.
 *
 * Model: grok-beta or current Grok model.
 * Requires XAI_API_KEY.
 */

import OpenAI from 'openai';
import { logger } from './utils.js';

let grokClient = null;

function getGrokClient() {
  if (grokClient) return grokClient;

  const apiKey = process.env.XAI_API_KEY;
  if (!apiKey) {
    throw new Error('XAI_API_KEY required for Grok text generation');
  }

  grokClient = new OpenAI({
    apiKey,
    baseURL: 'https://api.x.ai/v1',
  });

  return grokClient;
}

/**
 * Generate marketing copy or tweet text using Grok.
 * @param {string} prompt - e.g. "Write a catchy marketing tweet for wireless headphones on sale, include emojis and call to action"
 * @param {object} options - { model: 'grok-beta', max_tokens: 100, temperature: 0.7 }
 */
export async function generateText(prompt, options = {}) {
  const client = getGrokClient();
  const model = options.model || 'grok-beta';

  try {
    const response = await client.chat.completions.create({
      model,
      messages: [{ role: 'user', content: prompt }],
      max_tokens: options.max_tokens || 150,
      temperature: options.temperature || 0.7,
    });

    const text = response.choices[0]?.message?.content?.trim() || '';
    logger.info('Grok text generated', { model, promptPreview: prompt.substring(0, 60) });
    return text;
  } catch (err) {
    logger.error('Grok text generation failed', err);
    throw err;
  }
}

/**
 * Generate marketing tweet copy for an item.
 */
export async function generateMarketingCopy(item, options = {}) {
  const prompt = `Write a short, engaging marketing tweet (under 280 chars) for this product on ${options.platform || 'X/Twitter'}. Product: ${item.title || 'item'} priced at $${item.price || '??'}. Include emojis, a strong call-to-action, and 2-3 relevant hashtags. Make it promotional but not spammy.`;
  return generateText(prompt, options);
}

/**
 * Generate copy for a special event tweet.
 */
export async function generateEventCopy(eventName, item, options = {}) {
  const prompt = `Create a fun, timely tweet (under 280 chars) announcing a ${eventName} special for this product: ${item.title || 'item'}. Price: $${item.price || '??'}. Use emojis, excitement, and  hashtags like #${eventName.replace(/\s/g,'')}.`;
  return generateText(prompt, options);
}

export default { generateText, generateMarketingCopy, generateEventCopy };
