// Product History Management with User Input-Based Storage
// Handles product history persistence and export functionality
//
// IMPORTANT LIMITATION: Late-joining audience members cannot see product history
// that was built before they joined the channel. This is because:
// 1. Product history is built client-side from live transcripts
// 2. There is no server-side storage or database
// 3. History is only available to users who were present when products were discussed
//
// This system uses the user input part of channel names (e.g., "LiveShoppingChannel"
// from "LiveShoppingChannel_123456_abc") to group related sessions together.

const STORAGE_PREFIX = "shopscribe_product_history_";
const MAX_HISTORY_ITEMS = 50; // Limit to prevent storage bloat

/**
 * Extract user input part from channel name
 * Channel format: UserInput_timestamp_random
 * @param {string} channelName - Full channel name
 * @returns {string} User input part (without timestamp and random)
 */
export function extractUserInput(channelName) {
  if (!channelName) return "";
  return channelName;

  // const parts = channelName.split("_");
  // if (parts.length >= 3) {
  //   // Check if it's the new format (has timestamp and random at the end)
  //   const lastPart = parts[parts.length - 1];
  //   const secondLastPart = parts[parts.length - 2];

  //   // If last two parts look like timestamp and random (6 digits + 3 alphanumeric)
  //   if (/^\d{6}$/.test(secondLastPart) && /^[a-z0-9]{3}$/.test(lastPart)) {
  //     // Remove timestamp and random parts, join the rest
  //     const nameParts = parts.slice(0, -2);
  //     return nameParts.join("_");
  //   }
  // }

  // For other patterns, return as-is
  // return channelName;
}

/**
 * Get storage key for a specific user input
 * @param {string} channelName - Full channel name
 * @returns {string} Storage key based on user input
 */
function getStorageKey(channelName) {
  const userInput = extractUserInput(channelName);
  return `${STORAGE_PREFIX}${userInput}`;
}

/**
 * Get product history from sessionStorage for a specific user input
 * @param {string} channelName - Full channel name (will extract user input)
 * @returns {Array} Array of product objects
 */
export function getProductHistory(channelName) {
  if (!channelName) {
    console.warn("No channel name provided to getProductHistory");
    return [];
  }

  try {
    const storageKey = getStorageKey(channelName);
    const stored = sessionStorage.getItem(storageKey);
    if (!stored) return [];

    const parsed = JSON.parse(stored);
    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    console.error(
      "Error loading product history for user input",
      extractUserInput(channelName),
      ":",
      error,
    );
    return [];
  }
}

/**
 * Save product history to sessionStorage for a specific user input
 * @param {string} channelName - Full channel name (will extract user input)
 * @param {Array} products - Array of product objects
 */
export function saveProductHistory(channelName, products) {
  if (!channelName) {
    console.warn("No channel name provided to saveProductHistory");
    return;
  }

  try {
    // Limit history size
    const limitedProducts = products.slice(-MAX_HISTORY_ITEMS);
    const storageKey = getStorageKey(channelName);
    sessionStorage.setItem(storageKey, JSON.stringify(limitedProducts));
  } catch (error) {
    console.error(
      "Error saving product history for user input",
      extractUserInput(channelName),
      ":",
      error,
    );
  }
}

/**
 * Add a new product to history or merge with existing product
 * @param {string} channelName - Full channel name (will extract user input)
 * @param {Object} product - Product object to add
 * @returns {Array} Updated product history
 */
export function addProductToHistory(channelName, product) {
  if (!channelName) {
    console.warn("No channel name provided to addProductToHistory");
    return [];
  }

  if (!product || typeof product !== "object") {
    return getProductHistory(channelName);
  }

  const history = getProductHistory(channelName);
  const userInput = extractUserInput(channelName);

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
      id: existingProduct.id, // Keep the same ID
    };

    console.log(
      "🔄 Merged product update for user input",
      userInput,
      ":",
      mergedProduct,
    );
  } else {
    // Add as new product
    const productWithTimestamp = {
      ...product,
      timestamp: new Date().toISOString(),
      id: Date.now() + Math.random(), // Simple unique ID
    };

    // Add to beginning of array (most recent first)
    history.unshift(productWithTimestamp);
    console.log(
      "➕ Added new product to history for user input",
      userInput,
      ":",
      productWithTimestamp,
    );
  }

  saveProductHistory(channelName, history);
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

  return history.findIndex((existing) => {
    // Match by product name (case insensitive)
    if (existing.product_name && newProduct.product_name) {
      return (
        existing.product_name.toLowerCase() ===
        newProduct.product_name.toLowerCase()
      );
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
    id: existing.id,
  };
}

/**
 * Clear product history for a specific user input
 * @param {string} channelName - Full channel name (will extract user input)
 */
export function clearProductHistory(channelName) {
  if (!channelName) {
    console.warn("No channel name provided to clearProductHistory");
    return;
  }

  try {
    const storageKey = getStorageKey(channelName);

    sessionStorage.removeItem(storageKey);
    const userInput = extractUserInput(channelName);
    console.log("🗑️ Cleared product history for user input:", userInput);
  } catch (error) {
    console.error(
      "Error clearing product history for user input",
      extractUserInput(channelName),
      ":",
      error,
    );
  }
}

/**
 * Clear all product history for all user inputs
 */
export function clearAllProductHistory() {
  try {
    console.log("🌯 storageKey");
    // Get all sessionStorage keys that start with our prefix
    const keysToRemove = [];
    for (let i = 0; i < sessionStorage.length; i++) {
      const key = sessionStorage.key(i);
      if (key && key.startsWith(STORAGE_PREFIX)) {
        keysToRemove.push(key);
      }
    }

    // Remove all matching keys
    keysToRemove.forEach((key) => {
      sessionStorage.removeItem(key);
    });

    console.log(
      "🗑️ Cleared all product history for",
      keysToRemove.length,
      "user inputs",
    );
  } catch (error) {
    console.error("Error clearing all product history:", error);
  }
}

/**
 * Get all available user inputs with product history
 * @returns {Array} Array of user input strings that have product history
 */
export function getUserInputsWithHistory() {
  try {
    const userInputs = [];
    for (let i = 0; i < sessionStorage.length; i++) {
      const key = sessionStorage.key(i);
      if (key && key.startsWith(STORAGE_PREFIX)) {
        const userInput = key.replace(STORAGE_PREFIX, "");
        userInputs.push(userInput);
      }
    }
    return userInputs;
  } catch (error) {
    console.error("Error getting user inputs with history:", error);
    return [];
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
    const dataBlob = new Blob([dataStr], { type: "application/json" });

    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement("a");
    link.href = url;
    link.download =
      filename ||
      `shopscribe-products-${new Date().toISOString().split("T")[0]}.json`;

    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    URL.revokeObjectURL(url);
  } catch (error) {
    console.error("Error exporting product history:", error);
  }
}

/**
 * Copy product to clipboard
 * @param {Object} product - Product object to copy
 */
export function copyProductToClipboard(product) {
  try {
    const text = formatProductForClipboard(product);
    navigator.clipboard
      .writeText(text)
      .then(() => {
        console.log("Product copied to clipboard");
      })
      .catch((error) => {
        console.error("Error copying to clipboard:", error);
        // Fallback for older browsers
        fallbackCopyToClipboard(text);
      });
  } catch (error) {
    console.error("Error copying product:", error);
  }
}

/**
 * Format product for clipboard (readable text format)
 * @param {Object} product - Product object
 * @returns {string} Formatted text
 */
function formatProductForClipboard(product) {
  if (!product || typeof product !== "object") {
    return "";
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

  return lines.join("\n");
}

/**
 * Fallback copy method for older browsers
 * @param {string} text - Text to copy
 */
function fallbackCopyToClipboard(text) {
  const textArea = document.createElement("textarea");
  textArea.value = text;
  textArea.style.position = "fixed";
  textArea.style.left = "-999999px";
  textArea.style.top = "-999999px";
  document.body.appendChild(textArea);
  textArea.focus();
  textArea.select();

  try {
    document.execCommand("copy");
    console.log("Product copied to clipboard (fallback)");
  } catch (error) {
    console.error("Fallback copy failed:", error);
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
    recent: history.slice(0, 5), // Last 5 products
  };

  // Count categories and themes
  history.forEach((product) => {
    if (product.category) {
      stats.categories[product.category] =
        (stats.categories[product.category] || 0) + 1;
    }
    if (product.theme) {
      stats.themes[product.theme] = (stats.themes[product.theme] || 0) + 1;
    }
  });

  return stats;
}
