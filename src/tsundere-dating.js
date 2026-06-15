/**
 * tsundere-dating.js
 * Optimal product catalog for tsundere / dating-site cross-promotion.
 * Curated for Melbourne Lantern Bard, scam-awareness PSA, and sovereign date-night content.
 *
 * Niche lanes map to dating-app audiences + content creator merch stacks.
 * Integrates with Shopify import, X marketing tweets, and Grok Imagine ads.
 */

import { logger, truncateForTwitter, addUTM, suggestHashtags } from './utils.js';

/** Dating / content lanes this catalog optimizes for */
export const DATING_SITE_LANES = {
  hinge: { label: 'Hinge / IRL date prep', tone: 'warm-deadpan', cta: 'first-date-not-a-rescue-mission' },
  bumble: { label: 'Bumble / boundary-first', tone: 'sovereign-polite', cta: 'no-love-bomb-speedrun' },
  tinder: { label: 'Tinder / scam PSA', tone: 'chaotic-neutral', cta: 'red-flag-prop-required' },
  otaku: { label: 'Anime / tsundere merch', tone: 'tsundere', cta: 'not-enjoying-but-buying-anyway' },
  melbourne: { label: 'Melbourne date-night', tone: 'laneway-pilgrim', cta: 'hosier-golden-hour' },
  creator: { label: 'Reels / TikTok creator', tone: 'gopro-feral', cta: 'content-dept-approved' },
  korean: { label: 'K-culture + TTMIK crossover', tone: 'study-date', cta: 'shadowing-on-the-tram' },
  sovereign: { label: 'Helen boundary / scam recovery', tone: 'cord-cutting', cta: 'block-not-negotiate' },
  'tarot-scam': { label: 'Tarot-predicted scam PSA', tone: 'sovereign-deadpan', cta: 'dont-fund-predictions' }
};

/**
 * Optimal curated item list — scored for tsundere voice + dating-site conversion.
 * searchKeywords drive live eBay / AliExpress enrichment when API keys are set.
 */
export const OPTIMAL_TSUNDERE_DATING_ITEMS = [
  {
    id: 'td-001',
    title: 'Mini Ring Light + Phone Clip (laneway selfie kit)',
    price: '14.99',
    category: 'creator-gear',
    lanes: ['creator', 'melbourne', 'hinge'],
    skillId: 'melbourne-lantern-bard',
    searchKeywords: 'phone ring light clip selfie vlog',
    tweetHook: 'Not enjoying the lighting. Fixing it anyway. 📸',
    score: 94,
    tags: 'gopro,content,reel-b,hosier'
  },
  {
    id: 'td-002',
    title: 'Pocket Phone Gimbal Stabilizer',
    price: '29.99',
    category: 'creator-gear',
    lanes: ['creator', 'melbourne'],
    skillId: 'melbourne-lantern-bard',
    searchKeywords: 'pocket phone gimbal stabilizer 3 axis',
    tweetHook: 'SYSTEM says shaky footage reads as scam. Rude but fair.',
    score: 92,
    tags: 'reel-a,reel-b,centre-place'
  },
  {
    id: 'td-003',
    title: 'RED FLAG Prop Card Deck (dating satire)',
    price: '12.50',
    category: 'scam-awareness',
    lanes: ['tinder', 'bumble', 'sovereign'],
    skillId: 'helen-neighbor',
    searchKeywords: 'red flag dating card game party',
    tweetHook: 'Episode counter optional. Boundary mandatory. 🚩',
    score: 98,
    tags: 'scam-psa,reel-a,main-skit'
  },
  {
    id: 'td-004',
    title: '"I\'m Fine" Tsundere Sticker Pack (50pcs)',
    price: '6.99',
    category: 'tsundere-merch',
    lanes: ['otaku', 'tinder', 'creator'],
    skillId: 'melbourne-lantern-bard',
    searchKeywords: 'anime tsundere sticker pack kawaii',
    tweetHook: '멜버른 골목이 정말 예뻐요 — on your laptop, lying.',
    score: 96,
    tags: 'not-impressed,ep-2,reel-b'
  },
  {
    id: 'td-005',
    title: 'Korean Phrasebook for Travel Dates',
    price: '9.95',
    category: 'k-culture',
    lanes: ['korean', 'melbourne', 'hinge'],
    skillId: 'melbourne-lantern-bard',
    searchKeywords: 'korean phrase book travel beginner',
    tweetHook: 'Practice shadowing before the café date. Not a rescue mission.',
    score: 91,
    tags: 'ttmik,degraves,daily-life'
  },
  {
    id: 'td-006',
    title: 'Privacy Screen Phone Filter (2-pack)',
    price: '8.49',
    category: 'scam-awareness',
    lanes: ['sovereign', 'bumble', 'tinder'],
    skillId: 'helen-neighbor',
    searchKeywords: 'privacy screen protector phone anti spy',
    tweetHook: 'Helen-approved: strangers on the tram don\'t read your DMs.',
    score: 89,
    tags: 'boundary,emergency-protocol'
  },
  {
    id: 'td-007',
    title: 'Webcam Cover Slider (laptop + tablet)',
    price: '5.99',
    category: 'scam-awareness',
    lanes: ['sovereign', 'tinder'],
    skillId: 'helen-neighbor',
    searchKeywords: 'webcam cover slide laptop privacy',
    tweetHook: 'Romance scam awareness includes your camera. Obviously.',
    score: 87,
    tags: 'scam-psa,side-boundary'
  },
  {
    id: 'td-008',
    title: 'Compact Café Date Card Game (2-player)',
    price: '16.00',
    category: 'date-night',
    lanes: ['hinge', 'bumble', 'melbourne'],
    skillId: 'lo3tus',
    searchKeywords: 'couples card game date night portable',
    tweetHook: 'Degraves coffee + questions that aren\'t love bombs.',
    score: 90,
    tags: 'degraves,social-cultural,main-others'
  },
  {
    id: 'td-009',
    title: 'Insulated Travel Tumbler ("Content Dept" edition)',
    price: '18.50',
    category: 'date-night',
    lanes: ['melbourne', 'creator', 'hinge'],
    skillId: 'melbourne-lantern-bard',
    searchKeywords: 'insulated coffee tumbler travel mug custom',
    tweetHook: 'B5: GoPro on bag. Coffee in hand. Still not impressed.',
    score: 88,
    tags: 'reel-b,b5-content-dept'
  },
  {
    id: 'td-010',
    title: 'Anime Tsundere Enamel Pin Set',
    price: '11.99',
    category: 'tsundere-merch',
    lanes: ['otaku', 'creator'],
    skillId: 'melbourne-lantern-bard',
    searchKeywords: 'tsundere anime enamel pin set',
    tweetHook: 'It\'s not a personality. It\'s a merchandising lane.',
    score: 93,
    tags: 'lantern-bard,reel-a'
  },
  {
    id: 'td-011',
    title: 'Portable Power Bank 10000mAh (slim)',
    price: '19.99',
    category: 'creator-gear',
    lanes: ['creator', 'melbourne', 'tinder'],
    skillId: 'melbourne-lantern-bard',
    searchKeywords: 'slim power bank 10000mah portable charger',
    tweetHook: '4G > fate. Battery > feelings.',
    score: 86,
    tags: 'reel-b,b6-centre,tech'
  },
  {
    id: 'td-012',
    title: 'Noise-Cancelling Earbuds (budget ANC)',
    price: '24.99',
    category: 'sovereign-gear',
    lanes: ['sovereign', 'bumble', 'korean'],
    skillId: 'helen-neighbor',
    searchKeywords: 'noise cancelling earbuds budget anc',
    tweetHook: 'Mute SYSTEM notifications. Keep Korean audio.',
    score: 85,
    tags: 'shadowing,helen,side-boundary'
  },
  {
    id: 'td-013',
    title: 'Foldable Picnic Blanket (water-resistant)',
    price: '15.99',
    category: 'date-night',
    lanes: ['melbourne', 'hinge'],
    skillId: 'asuka-brisbane',
    searchKeywords: 'foldable picnic blanket waterproof compact',
    tweetHook: 'Fed Square rain glass optional. Blanket mandatory.',
    score: 84,
    tags: 'fed-square,southbank,date-night'
  },
  {
    id: 'td-014',
    title: 'Scam Survival Zine / Romance Fraud Guide',
    price: '7.50',
    category: 'scam-awareness',
    lanes: ['tinder', 'sovereign', 'bumble'],
    skillId: 'helen-neighbor',
    searchKeywords: 'romance scam awareness booklet guide',
    tweetHook: 'Reel A energy, but you can hold it.',
    score: 97,
    tags: 'reel-a,scam-psa,main-skit'
  },
  {
    id: 'td-015',
    title: 'Cute Stationery Set (love-bomb parody notes)',
    price: '10.99',
    category: 'tsundere-merch',
    lanes: ['otaku', 'korean', 'hinge'],
    skillId: 'lo3tus',
    searchKeywords: 'kawaii stationery set gel pen sticky notes',
    tweetHook: 'Write the tsundere reply. Mail it never.',
    score: 82,
    tags: 'ep-3,love-bomb,chaotic-neutral'
  },
  {
    id: 'td-016',
    title: 'Chest Mount / Bag Clip for GoPro / Phone',
    price: '13.49',
    category: 'creator-gear',
    lanes: ['creator', 'melbourne'],
    skillId: 'melbourne-lantern-bard',
    searchKeywords: 'gopro chest mount phone clip action camera',
    tweetHook: 'A8 sovereign tap — mount edition.',
    score: 91,
    tags: 'reel-a,a8-hosier,gopro'
  },
  {
    id: 'td-017',
    title: '"Melbourne Arrival" Postcard Set (12)',
    price: '8.99',
    category: 'date-night',
    lanes: ['melbourne', 'korean', 'hinge'],
    skillId: 'melbourne-lantern-bard',
    searchKeywords: 'melbourne australia postcard set laneway',
    tweetHook: 'Send one. Pretend you didn\'t care which you picked.',
    score: 83,
    tags: 'melbourne-arrival,ep-2'
  },
  {
    id: 'td-018',
    title: 'Blocking & Boundaries Journal',
    price: '14.00',
    category: 'sovereign-gear',
    lanes: ['sovereign', 'bumble'],
    skillId: 'helen-neighbor',
    searchKeywords: 'boundaries journal self care dotted',
    tweetHook: '죄송하지만 지금은 어려워요 — in ink.',
    score: 88,
    tags: 'helen,ep-4,side-boundary'
  },
  {
    id: 'td-019',
    title: 'LED Lantern Prop (rechargeable, warm white)',
    price: '22.00',
    category: 'tsundere-merch',
    lanes: ['melbourne', 'otaku', 'creator'],
    skillId: 'melbourne-lantern-bard',
    searchKeywords: 'rechargeable led lantern warm white portable',
    tweetHook: 'Lantern Bard tax. Golden hour not included.',
    score: 95,
    tags: 'ep-8,princes-dawn,lantern'
  },
  {
    id: 'td-020',
    title: 'Magnetic Phone Tripod (mini, laneway-height)',
    price: '11.99',
    category: 'creator-gear',
    lanes: ['creator', 'melbourne', 'tinder'],
    skillId: 'melbourne-lantern-bard',
    searchKeywords: 'magnetic phone tripod mini magsafe',
    tweetHook: 'W1 wide vertical: subject small, standards large.',
    score: 90,
    tags: 'reel-b,w1-hosier,tiktok-15'
  },
  {
    id: 'td-021',
    title: 'Funny Dating App Survival Mug',
    price: '12.99',
    category: 'tsundere-merch',
    lanes: ['tinder', 'hinge', 'otaku'],
    skillId: 'lo3tus',
    searchKeywords: 'funny dating mug single coffee cup',
    tweetHook: 'It\'s not you. It\'s my content department.',
    score: 81,
    tags: 'lo3tus,daily-life'
  },
  {
    id: 'td-022',
    title: 'SD Card 128GB + USB-C Reader Kit',
    price: '17.99',
    category: 'creator-gear',
    lanes: ['creator', 'melbourne'],
    skillId: 'flame-kissed-bard',
    searchKeywords: '128gb sd card usb c reader kit',
    tweetHook: '10:15 wrap — offload before feelings.',
    score: 84,
    tags: 'jun-19-block,wrap,main-film'
  },
  {
    id: 'td-023',
    title: 'K-Beauty Lip Tint Set (date-night subtle)',
    price: '13.50',
    category: 'date-night',
    lanes: ['korean', 'hinge', 'bumble'],
    skillId: 'lo3tus',
    searchKeywords: 'korean lip tint set gradient',
    tweetHook: 'Tsundere lip sync: fine face, complicated interior.',
    score: 80,
    tags: 'reel-b,b8-fine-face'
  },
  {
    id: 'td-024',
    title: 'Anti-Phishing / Digital Safety Quick Card',
    price: '4.99',
    category: 'scam-awareness',
    lanes: ['tinder', 'sovereign'],
    skillId: 'helen-neighbor',
    searchKeywords: 'phishing awareness reference card wallet',
    tweetHook: 'Invoice beat at Collins — know the pattern first.',
    score: 92,
    tags: 'reel-a,a6-collins,scam'
  },
  {
    id: 'td-025',
    title: 'Tarot Scam Awareness Card (wallet size)',
    price: '4.50',
    category: 'scam-awareness',
    lanes: ['tarot-scam', 'sovereign', 'tinder'],
    skillId: 'helen-neighbor',
    searchKeywords: 'psychic scam awareness card wallet guide',
    tweetHook: 'The cards didn\'t show your bank details. Block.',
    score: 96,
    tags: 'tarot-scam,helen,side-tarot-scam'
  },
  {
    id: 'td-026',
    title: 'Boundaries Journal — "I don\'t fund predictions"',
    price: '14.00',
    category: 'sovereign-gear',
    lanes: ['tarot-scam', 'sovereign', 'bumble'],
    skillId: 'helen-neighbor',
    searchKeywords: 'boundaries journal dotted notebook self care',
    tweetHook: '4G > fate. Ink > invoice.',
    score: 90,
    tags: 'tarot-scam,ep-4,side-boundary'
  }
];

export const ALL_NICHES = [...new Set(OPTIMAL_TSUNDERE_DATING_ITEMS.flatMap(i => i.lanes))];

/**
 * Score an item for tsundere/dating-site fit (higher = better).
 */
export function scoreTsundereDatingItem(item, lane = null) {
  let score = item.score || 70;
  if (lane && item.lanes?.includes(lane)) score += 8;
  if (item.category === 'scam-awareness') score += 2;
  if (item.category === 'creator-gear') score += 1;
  const price = parseFloat(item.price) || 20;
  if (price >= 5 && price <= 25) score += 3; // impulse band for dating audiences
  return Math.min(100, score);
}

/**
 * Full optimal list sorted by score, optionally filtered by lane or category.
 */
export function getOptimalItemList({ lane = null, category = null, limit = 24 } = {}) {
  let items = [...OPTIMAL_TSUNDERE_DATING_ITEMS];
  if (lane) items = items.filter(i => i.lanes?.includes(lane));
  if (category) items = items.filter(i => i.category === category);
  items.sort((a, b) => scoreTsundereDatingItem(b, lane) - scoreTsundereDatingItem(a, lane));
  return items.slice(0, limit).map(item => ({
    ...item,
    computedScore: scoreTsundereDatingItem(item, lane),
    formatted: formatTsundereForTweet(item, { lane })
  }));
}

/**
 * Get products for a niche lane (alias of lane filter).
 */
export function getTsundereDatingProducts(niche = 'all', limit = 12) {
  if (niche === 'all') {
    return getOptimalItemList({ limit });
  }
  return getOptimalItemList({ lane: niche, limit });
}

/**
 * Search curated catalog by title, tags, keywords, or category.
 */
export function searchTsundereDatingProducts(query, niche = 'all', limit = 12) {
  const lower = (query || '').toLowerCase().trim();
  let pool = niche === 'all'
    ? OPTIMAL_TSUNDERE_DATING_ITEMS
    : OPTIMAL_TSUNDERE_DATING_ITEMS.filter(i => i.lanes?.includes(niche));

  if (!lower) return getOptimalItemList({ lane: niche === 'all' ? null : niche, limit });

  const results = pool.filter(item =>
    item.title.toLowerCase().includes(lower) ||
    item.category.toLowerCase().includes(lower) ||
    item.tags?.toLowerCase().includes(lower) ||
    item.searchKeywords?.toLowerCase().includes(lower) ||
    item.tweetHook?.toLowerCase().includes(lower)
  );

  return results
    .sort((a, b) => (b.score || 0) - (a.score || 0))
    .slice(0, limit)
    .map(item => ({
      ...item,
      computedScore: scoreTsundereDatingItem(item, niche === 'all' ? null : niche),
      formatted: formatTsundereForTweet(item, { lane: niche === 'all' ? null : niche })
    }));
}

/**
 * Format for tweet / dashboard / Shopify import.
 */
export function formatTsundereForTweet(item, options = {}) {
  const lane = options.lane || item.lanes?.[0] || 'creator';
  const laneMeta = DATING_SITE_LANES[lane] || DATING_SITE_LANES.creator;
  const slug = item.id || 'item';
  return {
    id: item.id,
    title: item.title,
    price: item.price,
    category: item.category,
    lane,
    laneLabel: laneMeta.label,
    skillId: item.skillId,
    url: options.url || `https://shop.example.com/tsundere-dating/${slug}?lane=${lane}`,
    image: item.image || null,
    store: 'Tsundere Dating Catalog',
    tags: item.tags,
    tweetHook: item.tweetHook,
    searchKeywords: item.searchKeywords,
    computedScore: item.computedScore || scoreTsundereDatingItem(item, lane)
  };
}

/**
 * Tsundere-voice tweet generator (template; Grok override via twitter.js).
 */
export function generateTsundereDatingTweet(item, options = {}) {
  const f = item.formatted || formatTsundereForTweet(item, options);
  const laneMeta = DATING_SITE_LANES[f.lane] || DATING_SITE_LANES.creator;
  let tweet = options.customText || `${f.tweetHook}\n\n${f.title} — $${f.price}`;
  if (f.url) {
    tweet += `\n\n${addUTM(f.url, {
      source: 'twitter',
      medium: 'social',
      campaign: options.campaign || `tsundere_${f.lane}`
    })}`;
  }
  const tags = options.hashtags || suggestHashtags(f, f.lane) + ' #Tsundere #DatingAwareness';
  tweet += `\n\n${tags}`;
  if (options.callToAction) tweet += `\n\n${options.callToAction}`;
  else tweet += `\n\n(${laneMeta.cta})`;
  return truncateForTwitter(tweet);
}

/**
 * Enrich curated list with live eBay / AliExpress hits (when credentials exist).
 */
export async function enrichWithLiveSearch(items, { perItem = 1 } = {}) {
  const enriched = [];
  let ebayFn;
  let aliFn;
  let formatEbay;
  let formatAli;

  try {
    const ebay = await import('./ebay.js');
    ebayFn = ebay.getEbayProducts;
    formatEbay = ebay.formatEbayProductForTweet;
  } catch (_) { /* optional */ }

  try {
    const ali = await import('./aliexpress.js');
    aliFn = ali.searchAliExpressProducts;
    formatAli = ali.formatAliExpressProduct;
  } catch (_) { /* optional */ }

  for (const item of items) {
    const entry = { curated: item, live: [] };
    const kw = item.searchKeywords || item.title;

    if (ebayFn) {
      try {
        const hits = await ebayFn({ q: kw, limit: perItem });
        entry.live.push(...hits.map(h => ({ platform: 'eBay', ...formatEbay(h) })));
      } catch (e) {
        logger.debug('Tsundere dating: eBay enrich skipped', { id: item.id, error: e.message });
      }
    }

    if (aliFn) {
      try {
        const hits = await aliFn(kw, { limit: perItem });
        entry.live.push(...hits.map(h => ({ platform: 'AliExpress', ...formatAli(h) })));
      } catch (e) {
        logger.debug('Tsundere dating: AliExpress enrich skipped', { id: item.id, error: e.message });
      }
    }

    enriched.push(entry);
  }

  return enriched;
}

export async function tweetTsundereDatingProduct(item, options = {}) {
  const { postMarketingTweet } = await import('./twitter.js');
  const formatted = formatTsundereForTweet(item, options);
  const customText = options.useTemplate !== false
    ? generateTsundereDatingTweet({ ...item, formatted }, options)
    : null;
  return postMarketingTweet(formatted, {
    platform: 'Tsundere Dating',
    campaign: options.campaign || `tsundere_${formatted.lane}`,
    customText,
    hashtags: options.hashtags || '#Tsundere #DatingAwareness #MelbourneLantern',
    ...options
  });
}

export async function generateTsundereDatingAd(item, scenePrompt) {
  const { generateProductAd } = await import('./imagine.js');
  const formatted = formatTsundereForTweet(item);
  const prompt = scenePrompt || `tsundere dating merch ad, Melbourne laneway golden hour, playful not cringe, product: ${formatted.title}`;
  return generateProductAd({ title: formatted.title, price: formatted.price, store: formatted.store }, prompt);
}

export async function importTsundereDatingToShopify(item) {
  const { importToShopifyFromExternal } = await import('./shopify.js');
  const formatted = formatTsundereForTweet(item);
  return importToShopifyFromExternal({
    title: `[Tsundere Dating] ${formatted.title}`,
    price: formatted.price,
    image: formatted.image,
    url: formatted.url,
    id: formatted.id,
    tags: `${formatted.tags},tsundere,dating,${formatted.lane}`
  }, 'Tsundere Dating');
}

export default {
  DATING_SITE_LANES,
  OPTIMAL_TSUNDERE_DATING_ITEMS,
  ALL_NICHES,
  getOptimalItemList,
  getTsundereDatingProducts,
  searchTsundereDatingProducts,
  scoreTsundereDatingItem,
  formatTsundereForTweet,
  generateTsundereDatingTweet,
  enrichWithLiveSearch,
  tweetTsundereDatingProduct,
  generateTsundereDatingAd,
  importTsundereDatingToShopify
};