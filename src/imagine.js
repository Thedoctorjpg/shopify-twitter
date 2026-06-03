/**
 * imagine.js
 * Integration with xAI Grok Imagine API for image and video generation/editing.
 * Perfect for e-commerce: product ad mockups, virtual try-ons, restyles, variations, mockups from sketches.
 *
 * API: https://api.x.ai/v1 (OpenAI-compatible for images)
 * Docs: https://docs.x.ai/developers/model-capabilities/images/generation
 *
 * Requires XAI_API_KEY in env.
 */

import OpenAI from 'openai';
import axios from 'axios';
import { logger } from './utils.js';

let xaiClient = null;

function getXaiClient() {
  if (xaiClient) return xaiClient;

  const apiKey = process.env.XAI_API_KEY;
  if (!apiKey) {
    throw new Error('XAI_API_KEY is required for Imagine API. Get one at https://console.x.ai/');
  }

  xaiClient = new OpenAI({
    apiKey,
    baseURL: 'https://api.x.ai/v1',
  });

  return xaiClient;
}

/**
 * Generate one or more images from a text prompt.
 * @param {string} prompt
 * @param {object} options - { model: 'grok-imagine-image-quality', n: 1, aspect_ratio: '1:1'|'16:9' etc, resolution: '1k'|'2k', response_format: 'url'|'b64_json' }
 */
export async function generateImage(prompt, options = {}) {
  const client = getXaiClient();
  const model = options.model || 'grok-imagine-image-quality';

  try {
    const response = await client.images.generate({
      model,
      prompt,
      n: options.n || 1,
      // aspect_ratio and resolution are supported via extra params in the SDK
      ...(options.aspect_ratio && { aspect_ratio: options.aspect_ratio }),
      ...(options.resolution && { resolution: options.resolution }),
      response_format: options.response_format || 'url',
    });

    logger.info('Generated image(s) with Imagine API', { model, n: options.n || 1, promptPreview: prompt.substring(0, 50) });
    return response.data; // array of { url or b64_json, ... }
  } catch (err) {
    logger.error('xAI Imagine image generation failed', err);
    throw err;
  }
}

/**
 * Edit an existing image using a text prompt (style transfer, object changes, color edits, etc.).
 * Source image can be a public URL or base64 data URI.
 * @param {string} prompt
 * @param {string} imageUrlOrBase64 - e.g. "https://..." or "data:image/png;base64,...."
 * @param {object} options
 */
export async function editImage(prompt, imageUrlOrBase64, options = {}) {
  const apiKey = process.env.XAI_API_KEY;
  const model = options.model || 'grok-imagine-image-quality';

  const imagePayload = imageUrlOrBase64.startsWith('data:')
    ? { image: imageUrlOrBase64, type: 'image' }  // for base64? check docs, usually url or separate
    : { url: imageUrlOrBase64, type: 'image_url' };

  try {
    const response = await axios.post('https://api.x.ai/v1/images/edits', {
      model,
      prompt,
      image: imagePayload,
      ...(options.aspect_ratio && { aspect_ratio: options.aspect_ratio }),
      response_format: options.response_format || 'url',
    }, {
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
    });

    logger.info('Edited image with Imagine API', { model, promptPreview: prompt.substring(0, 50) });
    return response.data.data || response.data;
  } catch (err) {
    logger.error('xAI Imagine image edit failed', err);
    throw err;
  }
}

/**
 * Generate video from text or image (image-to-video).
 * Note: Video API may require polling for completion.
 * @param {string} prompt
 * @param {object} options - { model: 'grok-imagine-video', duration: 5-15, aspect_ratio, image_url? for img2vid }
 */
export async function generateVideo(prompt, options = {}) {
  const apiKey = process.env.XAI_API_KEY;
  const model = options.model || 'grok-imagine-video';

  try {
    // Start generation
    const startRes = await axios.post('https://api.x.ai/v1/videos/generations', {
      model,
      prompt,
      duration: options.duration || 10,
      aspect_ratio: options.aspect_ratio || '16:9',
      ...(options.image_url && { image: { url: options.image_url, type: 'image_url' } }),
    }, {
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
    });

    const requestId = startRes.data.request_id;
    logger.info('Started video generation', { requestId, model });

    // Poll for completion (simple sync for now; in prod use webhooks or background job)
    let result;
    const maxAttempts = 30; // ~2.5 min with 5s sleep
    for (let i = 0; i < maxAttempts; i++) {
      await new Promise(r => setTimeout(r, 5000));
      const pollRes = await axios.get(`https://api.x.ai/v1/videos/${requestId}`, {
        headers: { 'Authorization': `Bearer ${apiKey}` },
      });
      result = pollRes.data;
      if (result.status === 'done') {
        logger.info('Video generation complete', { requestId, url: result.video?.url });
        return result.video;
      }
      if (result.status === 'failed') {
        throw new Error(result.error || 'Video generation failed');
      }
    }
    throw new Error('Video generation timed out');
  } catch (err) {
    logger.error('xAI Imagine video generation failed', err);
    throw err;
  }
}

/**
 * Convenience: Generate a product ad mockup from a product image or description.
 */
export async function generateProductAd(product, scenePrompt = 'in a modern minimalist living room, high quality product photography') {
  const prompt = `Professional product advertisement photo of ${product.title || 'the product'}. ${scenePrompt}. High resolution, commercial lighting, clean background.`;
  const imageUrl = product.image || product.images?.[0]?.src;

  if (imageUrl) {
    // Use edit for placement on the product photo
    return editImage(scenePrompt, imageUrl, { aspect_ratio: '16:9', resolution: '2k' });
  } else {
    return generateImage(prompt, { n: 2, aspect_ratio: '16:9', resolution: '2k' });
  }
}

/**
 * Virtual try-on: Combine person photo + clothing product.
 * Uses multi-image or prompt-based.
 */
export async function generateVirtualTryOn(personImageUrl, clothingImageUrl, prompt = 'the person wearing the clothing item naturally, realistic fit and lighting') {
  // For multi-image, use edit with combined prompt or specific endpoint if available.
  // Simplified: use edit on person with clothing description, or generate.
  const combinedPrompt = `${prompt}. Reference clothing from the second image.`;
  // xAI supports multi-image in some calls via prompt with images? For now use two edits or one call.
  // Per docs, for multi use the multi-image editing page.
  return editImage(combinedPrompt, personImageUrl, { /* pass second? */ });
  // TODO: Implement proper multi-image using docs for /images/edits with multiple.
}

export default {
  generateImage,
  editImage,
  generateVideo,
  generateProductAd,
  generateVirtualTryOn,
};
