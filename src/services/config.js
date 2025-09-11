// Configuration service for ShopScribe Live Shopping App

export const CONFIG = {
  // Public configuration (safe to expose to client)
  CHANNEL_LIST_REFRESH_MS: parseInt(process.env.REACT_APP_CHANNEL_LIST_REFRESH_MS) || 10000,
  OVERLAY_ANIM_MS: parseInt(process.env.REACT_APP_OVERLAY_ANIM_MS) || 200,
  
  // Feature toggles
  ENABLE_RTM_SYNC: process.env.REACT_APP_ENABLE_RTM_SYNC === 'true',
  ENABLE_PRODUCT_HISTORY: process.env.REACT_APP_ENABLE_PRODUCT_HISTORY !== 'false',
  
  // UI Configuration
  MAX_PRODUCT_HISTORY: 10,
  OVERLAY_TIMEOUT_MS: 30000, // Auto-hide overlay after 30 seconds
  
  // Agora Configuration
  AGORA_APP_ID: process.env.REACT_APP_AGORA_APP_ID || '',
  AGORA_AGENT_UID: '8888', // Standard agent UID
  
  // API Configuration
  API_BASE_URL: process.env.REACT_APP_API_URL || '',
  
  // Default channel settings
  DEFAULT_CHANNEL_PREFIX: 'ss_',
  MAX_CHANNEL_NAME_LENGTH: 64,
  
  // Product parsing configuration
  PRODUCT_TAG_PATTERN: /\[\[(\w+):\s*([^\]]+)\]\]/g,
  VALID_PRODUCT_FIELDS: [
    'product_name', 'category', 'brand', 'variant', 'features',
    'condition', 'rarity', 'set', 'price_estimate', 'short_copy', 'theme'
  ],
  
  // UI Themes for products
  PRODUCT_THEMES: {
    promo: {
      bgColor: 'bg-red-50',
      borderColor: 'border-red-200',
      textColor: 'text-red-800',
      accentColor: 'bg-red-500'
    },
    rare: {
      bgColor: 'bg-purple-50',
      borderColor: 'border-purple-200', 
      textColor: 'text-purple-800',
      accentColor: 'bg-purple-500'
    },
    tech: {
      bgColor: 'bg-blue-50',
      borderColor: 'border-blue-200',
      textColor: 'text-blue-800', 
      accentColor: 'bg-blue-500'
    },
    apparel: {
      bgColor: 'bg-green-50',
      borderColor: 'border-green-200',
      textColor: 'text-green-800',
      accentColor: 'bg-green-500'
    },
    default: {
      bgColor: 'bg-gray-50',
      borderColor: 'border-gray-200',
      textColor: 'text-gray-800',
      accentColor: 'bg-gray-500'
    }
  }
};

// Validation helpers
export function validateConfig() {
  const errors = [];
  
  if (!CONFIG.AGORA_APP_ID) {
    errors.push('REACT_APP_AGORA_APP_ID is required');
  }
  
  return {
    isValid: errors.length === 0,
    errors
  };
}

// Get theme configuration for a product
export function getProductThemeConfig(theme = 'default') {
  return CONFIG.PRODUCT_THEMES[theme] || CONFIG.PRODUCT_THEMES.default;
}


// Generate a safe channel name (shorter format)
export function generateChannelName(prefix = '') {
  // Use shorter timestamp (last 6 digits) and shorter random string
  const shortTimestamp = Date.now().toString().slice(-6);
  const shortRandom = Math.random().toString(36).substring(2, 5);
  const baseName = `${CONFIG.DEFAULT_CHANNEL_PREFIX}${prefix}_${shortTimestamp}_${shortRandom}`;
  
  // Ensure it's within length limits and safe for Agora
  return baseName
    .replace(/[^a-zA-Z0-9_]/g, '_')
    .substring(0, CONFIG.MAX_CHANNEL_NAME_LENGTH);
}

export default CONFIG;
