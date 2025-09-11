// Product History Management with Session Storage
// Handles product history persistence and export functionality

const STORAGE_KEY = 'shopscribe_product_history';
const MAX_HISTORY_ITEMS = 50; // Limit to prevent storage bloat

/**
 * Get product history from session storage
 * @returns {Array} Array of product objects
 */
export function getProductHistory() {
  try {
    const stored = sessionStorage.getItem(STORAGE_KEY);
    if (!stored) return [];
    
    const parsed = JSON.parse(stored);
    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    console.error('Error loading product history:', error);
    return [];
  }
}

/**
 * Save product history to session storage
 * @param {Array} products - Array of product objects
 */
export function saveProductHistory(products) {
  try {
    // Limit history size
    const limitedProducts = products.slice(-MAX_HISTORY_ITEMS);
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(limitedProducts));
  } catch (error) {
    console.error('Error saving product history:', error);
  }
}

/**
 * Add a new product to history or merge with existing product
 * @param {Object} product - Product object to add
 * @returns {Array} Updated product history
 */
export function addProductToHistory(product) {
  if (!product || typeof product !== 'object') {
    return getProductHistory();
  }

  const history = getProductHistory();
  
  // Check if this is an update to an existing product
  const existingProductIndex = findExistingProductIndex(history, product);
  
  if (existingProductIndex !== -1) {
    // Merge with existing product
    const existingProduct = history[existingProductIndex];
    const mergedProduct = mergeProductUpdate(existingProduct, product);
    
    // Update the existing product in place
    history[existingProductIndex] = {
      ...mergedProduct,
      timestamp: new Date().toISOString(),
      id: existingProduct.id // Keep the same ID
    };
    
    console.log('🔄 Merged product update:', mergedProduct);
  } else {
    // Add as new product
    const productWithTimestamp = {
      ...product,
      timestamp: new Date().toISOString(),
      id: Date.now() + Math.random() // Simple unique ID
    };

    // Add to beginning of array (most recent first)
    history.unshift(productWithTimestamp);
    console.log('➕ Added new product to history:', productWithTimestamp);
  }
  
  saveProductHistory(history);
  return history;
}

/**
 * Find existing product index based on product name or key fields
 * @param {Array} history - Product history array
 * @param {Object} newProduct - New product to check against
 * @returns {number} Index of existing product or -1 if not found
 */
function findExistingProductIndex(history, newProduct) {
  if (!newProduct.product_name) {
    return -1; // Can't match without a product name
  }
  
  return history.findIndex(existing => {
    // Match by product name (case insensitive)
    if (existing.product_name && newProduct.product_name) {
      return existing.product_name.toLowerCase() === newProduct.product_name.toLowerCase();
    }
    return false;
  });
}

/**
 * Merge product updates (new values override existing)
 * @param {Object} existing - Existing product object
 * @param {Object} update - New product data
 * @returns {Object} Merged product object
 */
function mergeProductUpdate(existing, update) {
  return {
    ...existing,
    ...update,
    // Preserve timestamp and ID from existing
    timestamp: existing.timestamp,
    id: existing.id
  };
}

/**
 * Clear all product history
 */
export function clearProductHistory() {
  try {
    sessionStorage.removeItem(STORAGE_KEY);
  } catch (error) {
    console.error('Error clearing product history:', error);
  }
}

/**
 * Export product history as JSON
 * @param {Array} products - Array of product objects
 * @param {string} filename - Optional filename
 */
export function exportProductHistory(products, filename = null) {
  try {
    const dataStr = JSON.stringify(products, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename || `shopscribe-products-${new Date().toISOString().split('T')[0]}.json`;
    
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    URL.revokeObjectURL(url);
  } catch (error) {
    console.error('Error exporting product history:', error);
  }
}

/**
 * Copy product to clipboard
 * @param {Object} product - Product object to copy
 */
export function copyProductToClipboard(product) {
  try {
    const text = formatProductForClipboard(product);
    navigator.clipboard.writeText(text).then(() => {
      console.log('Product copied to clipboard');
    }).catch((error) => {
      console.error('Error copying to clipboard:', error);
      // Fallback for older browsers
      fallbackCopyToClipboard(text);
    });
  } catch (error) {
    console.error('Error copying product:', error);
  }
}

/**
 * Format product for clipboard (readable text format)
 * @param {Object} product - Product object
 * @returns {string} Formatted text
 */
function formatProductForClipboard(product) {
  if (!product || typeof product !== 'object') {
    return '';
  }

  const lines = [];
  
  if (product.product_name) lines.push(`Product: ${product.product_name}`);
  if (product.category) lines.push(`Category: ${product.category}`);
  if (product.brand) lines.push(`Brand: ${product.brand}`);
  if (product.variant) lines.push(`Variant: ${product.variant}`);
  if (product.features) lines.push(`Features: ${product.features}`);
  if (product.condition) lines.push(`Condition: ${product.condition}`);
  if (product.rarity) lines.push(`Rarity: ${product.rarity}`);
  if (product.set) lines.push(`Set: ${product.set}`);
  if (product.price_estimate) lines.push(`Price: ${product.price_estimate}`);
  if (product.short_copy) lines.push(`Description: ${product.short_copy}`);
  
  return lines.join('\n');
}

/**
 * Fallback copy method for older browsers
 * @param {string} text - Text to copy
 */
function fallbackCopyToClipboard(text) {
  const textArea = document.createElement('textarea');
  textArea.value = text;
  textArea.style.position = 'fixed';
  textArea.style.left = '-999999px';
  textArea.style.top = '-999999px';
  document.body.appendChild(textArea);
  textArea.focus();
  textArea.select();
  
  try {
    document.execCommand('copy');
    console.log('Product copied to clipboard (fallback)');
  } catch (error) {
    console.error('Fallback copy failed:', error);
  }
  
  document.body.removeChild(textArea);
}

/**
 * Get product history statistics
 * @returns {Object} Statistics about the product history
 */
export function getProductHistoryStats() {
  const history = getProductHistory();
  
  const stats = {
    total: history.length,
    categories: {},
    themes: {},
    recent: history.slice(0, 5) // Last 5 products
  };

  // Count categories and themes
  history.forEach(product => {
    if (product.category) {
      stats.categories[product.category] = (stats.categories[product.category] || 0) + 1;
    }
    if (product.theme) {
      stats.themes[product.theme] = (stats.themes[product.theme] || 0) + 1;
    }
  });

  return stats;
}
