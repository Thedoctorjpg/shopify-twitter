/**
 * grocery.js
 * Grocery shopping & fast food integration for the multi-platform dashboard.
 * Supports: Walmart, Target, Pak N Save, Woolworths, Konbini (convenience), Jollibee, Fast Food.
 *
 * Uses mock data for realism + xAI Imagine for generating product images/ads.
 * Allows tweeting deals, importing to Shopify, generating marketing creatives.
 */

import { logger } from './utils.js';

// Mock product data per store (realistic samples)
const STORE_PRODUCTS = {
  walmart: [
    { id: 'wm-001', title: 'Great Value Milk 1 Gallon', price: '2.98', category: 'Dairy', image: null, store: 'Walmart' },
    { id: 'wm-002', title: 'Bananas Bunch', price: '1.98', category: 'Produce', image: null, store: 'Walmart' },
    { id: 'wm-003', title: 'Wonder Bread Classic', price: '1.48', category: 'Bakery', image: null, store: 'Walmart' },
    { id: 'wm-004', title: 'Tyson Chicken Nuggets 32oz', price: '6.98', category: 'Frozen', image: null, store: 'Walmart' },
  ],
  target: [
    { id: 'tg-001', title: 'Good & Gather Organic Milk', price: '3.49', category: 'Dairy', image: null, store: 'Target' },
    { id: 'tg-002', title: 'Avocados 4ct', price: '2.99', category: 'Produce', image: null, store: 'Target' },
    { id: 'tg-003', title: 'Archer Farms Granola', price: '4.29', category: 'Breakfast', image: null, store: 'Target' },
    { id: 'tg-004', title: 'Market Pantry Ground Beef', price: '5.49', category: 'Meat', image: null, store: 'Target' },
  ],
  'pak-n-save': [
    { id: 'pns-001', title: 'Anchor Milk 2L', price: '3.99', category: 'Dairy', image: null, store: 'Pak N Save' },
    { id: 'pns-002', title: 'NZ Apples 1.5kg', price: '4.50', category: 'Produce', image: null, store: 'Pak N Save' },
    { id: 'pns-003', title: 'Vogel\'s Bread', price: '3.29', category: 'Bakery', image: null, store: 'Pak N Save' },
    { id: 'pns-004', title: 'Countdown Chicken Thighs', price: '8.99', category: 'Meat', image: null, store: 'Pak N Save' },
  ],
  woolworths: [
    { id: 'ww-001', title: 'Woolworths Full Cream Milk 2L', price: '3.20', category: 'Dairy', image: null, store: 'Woolworths' },
    { id: 'ww-002', title: 'Bananas 1kg', price: '2.80', category: 'Produce', image: null, store: 'Woolworths' },
    { id: 'ww-003', title: 'Tip Top Bread', price: '2.99', category: 'Bakery', image: null, store: 'Woolworths' },
    { id: 'ww-004', title: 'Woolworths Mince 500g', price: '6.50', category: 'Meat', image: null, store: 'Woolworths' },
  ],
  konbini: [
    { id: 'kb-001', title: 'Onigiri Tuna Mayo', price: '1.50', category: 'Ready-to-eat', image: null, store: 'Konbini' },
    { id: 'kb-002', title: 'FamilyMart Karaage', price: '3.80', category: 'Hot Food', image: null, store: 'Konbini' },
    { id: 'kb-003', title: 'Lawson Egg Sandwich', price: '2.20', category: 'Sandwiches', image: null, store: 'Konbini' },
    { id: 'kb-004', title: '7-Eleven Coffee', price: '1.80', category: 'Beverages', image: null, store: 'Konbini' },
  ],
  jollibee: [
    { id: 'jb-001', title: 'Chickenjoy 1pc with Rice', price: '5.99', category: 'Chicken', image: null, store: 'Jollibee' },
    { id: 'jb-002', title: 'Spaghetti with Chicken', price: '4.49', category: 'Pasta', image: null, store: 'Jollibee' },
    { id: 'jb-003', title: 'Yumburger', price: '2.99', category: 'Burgers', image: null, store: 'Jollibee' },
    { id: 'jb-004', title: 'Peach Mango Pie', price: '1.99', category: 'Dessert', image: null, store: 'Jollibee' },
  ],
  fastfood: [
    { id: 'ff-001', title: 'Big Mac Meal', price: '8.99', category: 'Burgers', image: null, store: 'Fast Food' },
    { id: 'ff-002', title: 'Original Recipe Bucket', price: '12.99', category: 'Chicken', image: null, store: 'Fast Food' },
    { id: 'ff-003', title: 'Pepperoni Pizza Large', price: '11.49', category: 'Pizza', image: null, store: 'Fast Food' },
    { id: 'ff-004', title: 'French Fries Large', price: '3.49', category: 'Sides', image: null, store: 'Fast Food' },
  ],
};

const ALL_STORES = Object.keys(STORE_PRODUCTS);

/**
 * Get products for a specific store (or all if 'all')
 */
export function getGroceryProducts(store = 'all', limit = 8) {
  let products = [];
  if (store === 'all' || !STORE_PRODUCTS[store]) {
    ALL_STORES.forEach(s => {
      products = products.concat(STORE_PRODUCTS[s]);
    });
  } else {
    products = STORE_PRODUCTS[store] || [];
  }
  return products.slice(0, limit);
}

/**
 * Simple search across stores
 */
export function searchGroceryProducts(query, store = 'all', limit = 8) {
  const lowerQuery = query.toLowerCase();
  let results = [];
  const storesToSearch = (store === 'all') ? ALL_STORES : [store];

  storesToSearch.forEach(s => {
    if (STORE_PRODUCTS[s]) {
      const filtered = STORE_PRODUCTS[s].filter(p =>
        p.title.toLowerCase().includes(lowerQuery) ||
        p.category.toLowerCase().includes(lowerQuery)
      );
      results = results.concat(filtered);
    }
  });
  return results.slice(0, limit);
}

/**
 * Format grocery item for tweeting / display
 */
export function formatGroceryForTweet(item) {
  return {
    id: item.id,
    title: item.title,
    price: item.price,
    category: item.category,
    store: item.store,
    url: `https://example.com/${item.store.toLowerCase().replace(/\s+/g, '-')}/product/${item.id}`, // mock
    image: item.image,
  };
}

/**
 * Generate a marketing tweet for a grocery/fast food deal
 */
export async function tweetGroceryDeal(item, options = {}) {
  const { postMarketingTweet } = await import('./twitter.js');
  const formatted = formatGroceryForTweet(item);
  const tweetOptions = {
    platform: item.store,
    campaign: options.campaign || 'grocery_deals',
    ...options
  };
  return postMarketingTweet(formatted, tweetOptions);
}

/**
 * Generate a grocery ad using xAI Imagine (product placement style)
 */
export async function generateGroceryAd(item, scenePrompt = 'in a bright modern kitchen, appetizing food photography') {
  const { generateProductAd } = await import('./imagine.js');
  const productForAd = {
    title: item.title,
    price: item.price,
    image: item.image,
    store: item.store
  };
  return generateProductAd(productForAd, scenePrompt);
}

/**
 * Import a grocery item as a Shopify product (mock draft)
 */
export async function importGroceryToShopify(item) {
  const { importToShopifyFromExternal } = await import('./shopify.js');
  const normalized = {
    title: `${item.store} - ${item.title}`,
    price: item.price,
    image: item.image,
    url: formatGroceryForTweet(item).url,
    id: item.id,
  };
  return importToShopifyFromExternal(normalized, item.store);
}

export default {
  getGroceryProducts,
  searchGroceryProducts,
  tweetGroceryDeal,
  generateGroceryAd,
  importGroceryToShopify,
  formatGroceryForTweet,
  ALL_STORES,
};
