// Product Sync System - Robust Product Parsing with Bracketed Tags
// Implements deterministic product updates from Agora agent responses for live shopping

// ————————————————————————————————————————————————————————————————
// 1) PRODUCT PARSING UTILITIES
// ————————————————————————————————————————————————————————————————

/**
 * Product type definition
 */
export const ProductType = {
  product_name: 'string',
  category: 'string', 
  brand: 'string',
  variant: 'string',
  features: 'string',
  condition: 'string',
  rarity: 'string',
  set: 'string',
  price_estimate: 'string',
  short_copy: 'string',
  theme: 'string'
};

/**
 * Valid product field names
 */
const VALID_KEYS = new Set([
  'product_name', 'category', 'brand', 'variant', 'features',
  'condition', 'rarity', 'set', 'price_estimate', 'short_copy', 'theme'
]);

/**
 * Regex pattern for bracketed product tags
 */
const TAG_RE = /\[\[(\w+):\s*([^\]]+)\]\]/g;

/**
 * Parse product tags from assistant message
 * @param {string} text - Assistant message text
 * @returns {Object} - Parsed product object with available fields
 */
export function parseProductTags(text) {
  if (!text || typeof text !== 'string') {
    return {};
  }

  const product = {};
  let match;

  // Reset regex lastIndex to ensure we start from the beginning
  TAG_RE.lastIndex = 0;

  while ((match = TAG_RE.exec(text)) !== null) {
    const key = match[1]?.toLowerCase();
    const value = (match[2] || '').trim();
    
    if (key && VALID_KEYS.has(key) && value) {
      product[key] = value;
    }
  }

  return product;
}

/**
 * Strip bracketed tags from text for display
 * @param {string} text - Raw assistant message
 * @returns {string} - Cleaned message for display
 */
export function stripTags(text) {
  if (!text || typeof text !== 'string') {
    return text || '';
  }

  // Remove bracketed tags and clean up whitespace
  return text
    .replace(TAG_RE, '')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

/**
 * Check if text contains product tags
 * @param {string} text - Text to check
 * @returns {boolean} - True if product tags are found
 */
export function hasProductTags(text) {
  if (!text || typeof text !== 'string') {
    return false;
  }

  TAG_RE.lastIndex = 0;
  return TAG_RE.test(text);
}

/**
 * Get the most important product field for display
 * @param {Object} product - Product object
 * @returns {string} - Primary display field
 */
export function getPrimaryProductField(product) {
  if (!product || typeof product !== 'object') {
    return '';
  }

  // Priority order for primary field
  const priority = ['product_name', 'short_copy', 'category', 'brand'];
  
  for (const field of priority) {
    if (product[field] && product[field].trim()) {
      return product[field];
    }
  }

  return '';
}

/**
 * Format product for display
 * @param {Object} product - Product object
 * @returns {Object} - Formatted product with display helpers
 */
export function formatProductForDisplay(product) {
  if (!product || typeof product !== 'object') {
    return {
      primary: '',
      details: [],
      hasContent: false
    };
  }

  const details = [];
  const hasContent = Object.keys(product).length > 0;

  // Build details array for display
  if (product.brand) details.push({ label: 'Brand', value: product.brand });
  if (product.variant) details.push({ label: 'Variant', value: product.variant });
  if (product.features) details.push({ label: 'Features', value: product.features });
  if (product.condition) details.push({ label: 'Condition', value: product.condition });
  if (product.rarity) details.push({ label: 'Rarity', value: product.rarity });
  if (product.set) details.push({ label: 'Set', value: product.set });
  if (product.price_estimate) details.push({ label: 'Price', value: product.price_estimate });

  return {
    primary: getPrimaryProductField(product),
    shortCopy: product.short_copy || '',
    category: product.category || '',
    theme: product.theme || 'default',
    details,
    hasContent,
    raw: product
  };
}

// ————————————————————————————————————————————————————————————————
// 2) CONVERSATION WIRING
// ————————————————————————————————————————————————————————————————

/**
 * Wire conversation to product updates
 * @param {Object} agoraService - Agora service instance
 * @param {Function} onProductUpdate - Callback for product updates
 * @returns {Function} - Cleanup function
 */
export function wireConvoToProduct(agoraService, onProductUpdate) {
  console.log('🔗 Product sync wired');
  
  // Return cleanup function
  return () => {
    console.log('🔌 Product sync unwired');
  };
}

// ————————————————————————————————————————————————————————————————
// 3) UTILITY FUNCTIONS
// ————————————————————————————————————————————————————————————————

/**
 * Check if product is complete enough to display
 * @param {Object} product - Product object to check
 * @returns {boolean} - True if product has enough info to display
 */
export function isProductDisplayable(product) {
  if (!product || typeof product !== 'object') {
    return false;
  }

  // Need at least one of these key fields
  const keyFields = ['product_name', 'short_copy', 'category'];
  return keyFields.some(field => product[field] && product[field].trim());
}

/**
 * Merge product updates (new values override existing)
 * @param {Object} existing - Existing product object
 * @param {Object} update - New product data
 * @returns {Object} - Merged product object
 */
export function mergeProductUpdate(existing = {}, update = {}) {
  return {
    ...existing,
    ...update
  };
}

/**
 * Get product theme for UI styling
 * @param {Object} product - Product object
 * @returns {string} - Theme name for styling
 */
export function getProductTheme(product) {
  if (!product || typeof product !== 'object') {
    return 'default';
  }

  const theme = product.theme?.toLowerCase();
  const validThemes = ['promo', 'rare', 'tech', 'apparel', 'default'];
  
  return validThemes.includes(theme) ? theme : 'default';
}

// Feature flags for testing
export const FEATURE_FLAGS = {
  FINAL_ONLY_PARSE: true,
  HIDE_TAGS_IN_CAPTIONS: true,
  ENABLE_PRODUCT_MERGING: true
};
