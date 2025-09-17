// Product History RTM Storage Service
// Manages product history using Agora RTM channel metadata for cross-session persistence
// and sessionStorage for local caching and offline access

import { 
  getProductHistory as getLocalHistory,
  saveProductHistory as saveLocalHistory,
  addProductToHistory as addLocalHistory,
  clearProductHistory as clearLocalHistory
} from '../utils/productHistory';

const PRODUCT_HISTORY_KEY = 'productHistory';
const MAX_RTM_PRODUCTS = 20; // Limit RTM storage to prevent size issues
const RTM_UPDATE_THROTTLE_MS = 1000; // Throttle RTM updates to prevent rate limiting

class ProductHistoryRTMService {
  constructor() {
    this.rtmClient = null;
    this.channelName = null;
    this.isInitialized = false;
    this.storageListeners = new Set();
    this.lastRTMUpdate = 0; // Track last RTM update for throttling
    this.pendingUpdate = null; // Store pending update to batch them
    this.hasExistingMetadata = false; // Track if metadata already exists in RTM
  }

  /**
   * Initialize the RTM service with client and channel
   * @param {Object} rtmClient - Agora RTM client instance
   * @param {string} channelName - Channel name
   */
  async initialize(rtmClient, channelName) {
    console.log('🔄 ProductHistoryRTM: Initializing for channel:', channelName);
    
    this.rtmClient = rtmClient;
    this.channelName = channelName;
    this.isInitialized = true;

    // Set up storage event listener
    this.setupStorageListener();

    // Load initial product history from RTM
    await this.loadFromRTM();
  }

  /**
   * Set up RTM storage event listener for product history updates
   */
  setupStorageListener() {
    if (!this.rtmClient) return;

    const handleStorageEvent = (event) => {
      console.log('📦 ProductHistoryRTM: Storage event received:', event);
      
      if (event.eventType === 'ChannelMetadataUpdate' || event.eventType === 'UPDATE') {
        const channelName = event.channelName;
        const channelType = event.channelType;
        
        // Only process events for our channel
        if (channelName === this.channelName && channelType === 'MESSAGE') {
          console.log('📦 ProductHistoryRTM: Processing channel metadata update');
          
          // Extract product history from metadata
          const productHistoryData = event.data?.metadata?.[PRODUCT_HISTORY_KEY]?.value;
          if (productHistoryData) {
            try {
              const products = JSON.parse(productHistoryData);
              console.log('📦 ProductHistoryRTM: Received product history from RTM:', products.length, 'products');
              
              // Update local storage
              saveLocalHistory(this.channelName, products);
              
              // Notify listeners
              this.notifyListeners(products);
            } catch (error) {
              console.error('📦 ProductHistoryRTM: Failed to parse product history from RTM:', error);
            }
          }
        }
      }
    };

    this.rtmClient.addEventListener('storage', handleStorageEvent);
    console.log('📦 ProductHistoryRTM: Storage event listener set up');
  }

  /**
   * Load product history from RTM storage
   */
  async loadFromRTM() {
    if (!this.isInitialized) {
      console.warn('📦 ProductHistoryRTM: Not initialized, cannot load from RTM');
      return [];
    }

    try {
      console.log('📦 ProductHistoryRTM: Loading product history from RTM for channel:', this.channelName);
      
      const result = await this.rtmClient.storage.getChannelMetadata(
        this.channelName,
        'MESSAGE'
      );

      console.log('📦 ProductHistoryRTM: RTM metadata result:', result);

      const productHistoryData = result?.metadata?.[PRODUCT_HISTORY_KEY]?.value;
      if (productHistoryData) {
        const products = JSON.parse(productHistoryData);
        console.log('📦 ProductHistoryRTM: Loaded', products.length, 'products from RTM');
        
        // Update local storage
        saveLocalHistory(this.channelName, products);
        
        // Mark that we have existing metadata (for future updates)
        this.hasExistingMetadata = true;
        
        return products;
      } else {
        console.log('📦 ProductHistoryRTM: No product history found in RTM');
        this.hasExistingMetadata = false;
        return [];
      }
    } catch (error) {
      console.error('📦 ProductHistoryRTM: Failed to load from RTM:', error);
      // Fallback to local storage
      this.hasExistingMetadata = false;
      return getLocalHistory(this.channelName);
    }
  }

  /**
   * Save product history to RTM storage with throttling
   * @param {Array} products - Array of product objects
   * @param {boolean} force - Force immediate update (bypass throttling)
   * @param {boolean} isInitial - Whether this is the initial save (use setChannelMetadata)
   */
  async saveToRTM(products, force = false, isInitial = false) {
    if (!this.isInitialized) {
      console.warn('📦 ProductHistoryRTM: Not initialized, cannot save to RTM');
      return false;
    }

    const now = Date.now();
    
    // Throttle updates to prevent rate limiting (except for initial saves)
    if (!force && !isInitial && (now - this.lastRTMUpdate) < RTM_UPDATE_THROTTLE_MS) {
      console.log('📦 ProductHistoryRTM: Throttling RTM update, storing pending update');
      this.pendingUpdate = products;
      
      // Schedule the update
      setTimeout(() => {
        if (this.pendingUpdate) {
          this.saveToRTM(this.pendingUpdate, true, false);
          this.pendingUpdate = null;
        }
      }, RTM_UPDATE_THROTTLE_MS - (now - this.lastRTMUpdate));
      
      return true;
    }

    try {
      // Limit products for RTM storage
      const limitedProducts = products.slice(0, MAX_RTM_PRODUCTS);
      
      console.log('📦 ProductHistoryRTM: Saving', limitedProducts.length, 'products to RTM (isInitial:', isInitial, ')');
      
      if (isInitial) {
        // Use setChannelMetadata for initial creation
        await this.rtmClient.storage.setChannelMetadata(
          this.channelName,
          'MESSAGE',
          [{
            key: PRODUCT_HISTORY_KEY,
            value: JSON.stringify(limitedProducts)
          }],
          {addTimeStamp:true, addUserId: false}
        );
      } else {
        // Use updateChannelMetadata for updates
        await this.rtmClient.storage.updateChannelMetadata(
          this.channelName,
          'MESSAGE',
          [{
            key: PRODUCT_HISTORY_KEY,
            value: JSON.stringify(limitedProducts)
          }],
          {addTimeStamp:true, addUserId: false}
        );
      }

      this.lastRTMUpdate = now;
      console.log('📦 ProductHistoryRTM: Successfully saved to RTM');
      return true;
    } catch (error) {
      console.error('📦 ProductHistoryRTM: Failed to save to RTM:', error);
      return false;
    }
  }

  /**
   * Add a product to history (both local and RTM)
   * @param {Object} product - Product object to add
   * @returns {Array} Updated product history
   */
  async addProduct(product) {
    if (!product || typeof product !== 'object') {
      return getLocalHistory(this.channelName);
    }

    // Add to local storage first
    const updatedHistory = addLocalHistory(this.channelName, product);
    
    // Determine if this is initial creation or update
    const isInitial = !this.hasExistingMetadata;
    
    // Save to RTM storage
    await this.saveToRTM(updatedHistory, false, isInitial);
    
    // Mark that we now have metadata
    this.hasExistingMetadata = true;
    
    // Notify listeners
    this.notifyListeners(updatedHistory);
    
    return updatedHistory;
  }

  /**
   * Get product history (from local storage)
   * @returns {Array} Array of product objects
   */
  getProductHistory() {
    return getLocalHistory(this.channelName);
  }

  /**
   * Clear product history (both local and RTM)
   * @param {boolean} force - Force immediate clear (bypass throttling)
   */
  async clearHistory(force = false) {
    console.log('📦 ProductHistoryRTM: Clearing product history...');
    
    // Clear local storage first
    clearLocalHistory(this.channelName);
    
    // Clear RTM storage
    if (this.isInitialized) {
      try {
        // Use removeChannelMetadata to delete the specific key
        await this.rtmClient.storage.removeChannelMetadata(
          this.channelName,
          'MESSAGE',
          {
            data: [{key: PRODUCT_HISTORY_KEY}]
          }
        );
        
        this.lastRTMUpdate = Date.now();
        this.pendingUpdate = null; // Clear any pending updates
        this.hasExistingMetadata = false; // Reset metadata flag
        console.log('📦 ProductHistoryRTM: Successfully cleared RTM storage');
      } catch (error) {
        console.error('📦 ProductHistoryRTM: Failed to clear RTM storage:', error);
        // Still clear local storage even if RTM fails
      }
    }
    
    // Notify listeners immediately
    this.notifyListeners([]);
  }

  /**
   * Add a listener for product history updates
   * @param {Function} listener - Callback function
   */
  addListener(listener) {
    this.storageListeners.add(listener);
  }

  /**
   * Remove a listener
   * @param {Function} listener - Callback function
   */
  removeListener(listener) {
    this.storageListeners.delete(listener);
  }

  /**
   * Notify all listeners of product history updates
   * @param {Array} products - Updated product array
   */
  notifyListeners(products) {
    this.storageListeners.forEach(listener => {
      try {
        listener(products);
      } catch (error) {
        console.error('📦 ProductHistoryRTM: Error in listener:', error);
      }
    });
  }

  /**
   * Force flush any pending updates to RTM
   */
  async flushPendingUpdates() {
    if (this.pendingUpdate) {
      console.log('📦 ProductHistoryRTM: Flushing pending updates...');
      await this.saveToRTM(this.pendingUpdate, true, false);
      this.pendingUpdate = null;
    }
  }

  /**
   * Clean up resources
   */
  async destroy() {
    // Flush any pending updates before destroying
    await this.flushPendingUpdates();
    
    this.storageListeners.clear();
    this.rtmClient = null;
    this.channelName = null;
    this.isInitialized = false;
    this.lastRTMUpdate = 0;
    this.pendingUpdate = null;
    this.hasExistingMetadata = false;
    console.log('📦 ProductHistoryRTM: Destroyed');
  }
}

// Create singleton instance
const productHistoryRTM = new ProductHistoryRTMService();

export default productHistoryRTM;
