// Product History RTM Storage Service
// Manages product history using Agora RTM channel metadata for cross-session persistence
// and sessionStorage for local caching and offline access

import {
  getProductHistory as getLocalHistory,
  saveProductHistory as saveLocalHistory,
  addProductToHistory as addLocalHistory,
  clearProductHistory as clearLocalHistory,
} from "../utils/productHistory";

const PRODUCT_HISTORY_KEY = "productHistory";
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
    console.log("🔄 ProductHistoryRTM: Initializing for channel:", channelName);
    console.log("🔄 ProductHistoryRTM: RTM client provided:", !!rtmClient);
    console.log(
      "🔄 ProductHistoryRTM: RTM client connection state:",
      rtmClient?.connectionState,
    );

    this.rtmClient = rtmClient;
    this.channelName = channelName;
    this.isInitialized = true;

    // Set up storage event listener
    this.setupStorageListener();

    // Load initial product history from RTM
    console.log("🔄 ProductHistoryRTM: About to call loadFromRTM...");
    const loadedProducts = await this.loadFromRTM();
    console.log(
      "🔄 ProductHistoryRTM: loadFromRTM completed, loaded products:",
      loadedProducts?.length || 0,
    );

    // Set up periodic retry for loading data (in case host hasn't saved yet)
    this.setupPeriodicRetry();
    return loadedProducts;
  }

  /**
   * Set up periodic retry for loading data (in case host hasn't saved yet)
   */
  setupPeriodicRetry() {
    // Retry loading every 5 seconds for the first 30 seconds
    let retryCount = 0;
    const maxRetries = 6; // 6 * 5 seconds = 30 seconds

    this.retryInterval = setInterval(async () => {
      retryCount++;
      console.log(
        "📦 ProductHistoryRTM: Periodic retry",
        retryCount,
        "of",
        maxRetries,
      );

      const loadedProducts = await this.loadFromRTM();
      if (loadedProducts && loadedProducts.length > 0) {
        console.log(
          "📦 ProductHistoryRTM: Found data on retry",
          retryCount,
          "- stopping retries",
        );
        clearInterval(this.retryInterval);
        this.retryInterval = null;
      } else if (retryCount >= maxRetries) {
        console.log(
          "📦 ProductHistoryRTM: Max retries reached, stopping periodic retry",
        );
        clearInterval(this.retryInterval);
        this.retryInterval = null;
      }
    }, 5000);
  }

  /**
   * Set up RTM storage event listener for product history updates
   */
  setupStorageListener() {
    if (!this.rtmClient) {
      console.log(
        "📦 ProductHistoryRTM: No RTM client available for storage listener",
      );
      return;
    }

    const handleStorageEvent = (event) => {
      console.log("📦 ProductHistoryRTM: Storage event received:", event);
      console.log("📦 ProductHistoryRTM: Event type:", event.eventType);
      console.log(
        "📦 ProductHistoryRTM: Event channel name:",
        event.channelName,
      );
      console.log(
        "📦 ProductHistoryRTM: Event channel type:",
        event.channelType,
      );
      console.log("📦 ProductHistoryRTM: Our channel name:", this.channelName);

      if (
        event.eventType === "ChannelMetadataUpdate" ||
        event.eventType === "UPDATE"
      ) {
        const channelName = event.channelName;
        const channelType = event.channelType;

        // Only process events for our channel
        if (channelName === this.channelName && channelType === "MESSAGE") {
          console.log(
            "📦 ProductHistoryRTM: Processing channel metadata update for our channel",
          );

          // Extract product history from metadata
          const productHistoryData =
            event.data?.metadata?.[PRODUCT_HISTORY_KEY]?.value;
          console.log(
            "📦 ProductHistoryRTM: Product history data in event:",
            !!productHistoryData,
          );
          console.log(
            "📦 ProductHistoryRTM: Event metadata keys:",
            event.data?.metadata ? Object.keys(event.data.metadata) : "none",
          );

          if (productHistoryData) {
            try {
              const products = JSON.parse(productHistoryData);
              console.log(
                "📦 ProductHistoryRTM: Received product history from RTM:",
                products.length,
                "products",
              );
              console.log(
                "📦 ProductHistoryRTM: First product from event:",
                products[0],
              );

              // Update local storage
              saveLocalHistory(this.channelName, products);
              console.log(
                "📦 ProductHistoryRTM: Updated local storage from event",
              );

              // Notify listeners
              console.log(
                "📦 ProductHistoryRTM: Notifying",
                this.storageListeners.size,
                "listeners from event",
              );
            } catch (error) {
              console.error(
                "📦 ProductHistoryRTM: Failed to parse product history from RTM:",
                error,
              );
            }
          } else {
            console.log(
              "📦 ProductHistoryRTM: No product history data found in event",
            );
          }
        } else {
          console.log(
            "📦 ProductHistoryRTM: Event not for our channel or wrong type",
          );
        }
      } else if (event.eventType === "SNAPSHOT") {
        console.log("📦 ProductHistoryRTM: Processing SNAPSHOT event");
        console.log("📦 ProductHistoryRTM: SNAPSHOT data:", event.data);
        console.log(
          "📦 ProductHistoryRTM: SNAPSHOT metadata keys:",
          Object.keys(event.data?.metadata || {}),
        );

        // Only process snapshots for our channel
        if (event.channelName === this.channelName) {
          console.log(
            "📦 ProductHistoryRTM: Processing SNAPSHOT for our channel",
          );

          // Extract product history from snapshot metadata
          const productHistoryData =
            event.data?.metadata?.[PRODUCT_HISTORY_KEY]?.value;
          if (productHistoryData) {
            try {
              const products = JSON.parse(productHistoryData);
              console.log(
                "📦 ProductHistoryRTM: Received",
                products.length,
                "products from SNAPSHOT event",
              );
              console.log(
                "📦 ProductHistoryRTM: First product from SNAPSHOT:",
                products[0],
              );

              // Update local storage
              saveLocalHistory(this.channelName, products);
              console.log(
                "📦 ProductHistoryRTM: Updated local storage from SNAPSHOT event",
              );

              // Notify listeners
              console.log(
                "📦 ProductHistoryRTM: Notifying",
                this.storageListeners.size,
                "listeners from SNAPSHOT event",
              );
            } catch (error) {
              console.error(
                "📦 ProductHistoryRTM: Failed to parse product history from SNAPSHOT:",
                error,
              );
            }
          } else {
            console.log(
              "📦 ProductHistoryRTM: No product history data found in SNAPSHOT event",
            );
          }
        } else {
          console.log(
            "📦 ProductHistoryRTM: SNAPSHOT not for our channel:",
            event.channelName,
          );
        }
      } else {
        console.log(
          "📦 ProductHistoryRTM: Event type not handled:",
          event.eventType,
        );
      }
    };

    this.rtmClient.addEventListener("storage", handleStorageEvent);
    console.log("📦 ProductHistoryRTM: Storage event listener set up");
  }

  /**
   * Load product history from RTM storage
   */
  async loadFromRTM() {
    if (!this.isInitialized) {
      console.warn(
        "📦 ProductHistoryRTM: Not initialized, cannot load from RTM",
      );
      return [];
    }

    try {
      console.log(
        "📦 ProductHistoryRTM: Loading product history from RTM for channel:",
        this.channelName,
      );
      console.log(
        "📦 ProductHistoryRTM: RTM client available:",
        !!this.rtmClient,
      );
      console.log(
        "📦 ProductHistoryRTM: RTM client connection state:",
        this.rtmClient?.connectionState,
      );

      console.log("📦 ProductHistoryRTM: About to call getChannelMetadata...");

      const result = await this.rtmClient.storage.getChannelMetadata(
        this.channelName,
        "MESSAGE",
      );

      console.log("📦 ProductHistoryRTM: RTM metadata result:", result);
      console.log(
        "📦 ProductHistoryRTM: Result metadata keys:",
        result?.metadata ? Object.keys(result.metadata) : "no metadata",
      );
      console.log(
        "📦 ProductHistoryRTM: Looking for key:",
        PRODUCT_HISTORY_KEY,
      );

      const productHistoryData = result?.metadata?.[PRODUCT_HISTORY_KEY]?.value;
      console.log(
        "📦 ProductHistoryRTM: Product history data found:",
        !!productHistoryData,
      );
      console.log(
        "📦 ProductHistoryRTM: Product history data length:",
        productHistoryData?.length || 0,
      );

      if (productHistoryData) {
        const products = JSON.parse(productHistoryData);
        console.log(
          "📦 ProductHistoryRTM: Successfully parsed",
          products.length,
          "products from RTM",
        );
        console.log("📦 ProductHistoryRTM: First product:", products[0]);

        // Update local storage
        saveLocalHistory(this.channelName, products);
        console.log(
          "📦 ProductHistoryRTM: Updated local storage with",
          products.length,
          "products",
        );

        // Mark that we have existing metadata (for future updates)
        this.hasExistingMetadata = true;

        return products;
      } else {
        console.log(
          "📦 ProductHistoryRTM: No product history found in RTM for key:",
          PRODUCT_HISTORY_KEY,
        );
        console.log(
          "📦 ProductHistoryRTM: Available metadata keys:",
          result?.metadata ? Object.keys(result.metadata) : "none",
        );
        this.hasExistingMetadata = false;
        return [];
      }
    } catch (error) {
      console.error("📦 ProductHistoryRTM: Failed to load from RTM:", error);
      console.error("📦 ProductHistoryRTM: Error details:", {
        message: error.message,
        code: error.code,
        name: error.name,
      });
      // Fallback to local storage
      this.hasExistingMetadata = false;
      const localHistory = getLocalHistory(this.channelName);
      console.log(
        "📦 ProductHistoryRTM: Fallback to local storage, found",
        localHistory.length,
        "products",
      );
      return localHistory;
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
      console.warn("📦 ProductHistoryRTM: Not initialized, cannot save to RTM");
      return false;
    }

    const now = Date.now();

    // Throttle updates to prevent rate limiting (except for initial saves)
    if (
      !force &&
      !isInitial &&
      now - this.lastRTMUpdate < RTM_UPDATE_THROTTLE_MS
    ) {
      console.log(
        "📦 ProductHistoryRTM: Throttling RTM update, storing pending update",
      );
      this.pendingUpdate = products;

      // Schedule the update
      setTimeout(
        () => {
          if (this.pendingUpdate) {
            this.saveToRTM(this.pendingUpdate, true, false);
            this.pendingUpdate = null;
          }
        },
        RTM_UPDATE_THROTTLE_MS - (now - this.lastRTMUpdate),
      );

      return true;
    }

    try {
      // Limit products for RTM storage
      const limitedProducts = products.slice(0, MAX_RTM_PRODUCTS);

      //console.log(
      //  "📦 ProductHistoryRTM: Saving",
      //  limitedProducts.length,
      //  "products to RTM (isInitial:",
      //  isInitial,
      //  ")",
      //);
      //console.log("📦 ProductHistoryRTM: Channel name:", this.channelName);
      //console.log(
      //  "📦 ProductHistoryRTM: RTM client available:",
      //  !!this.rtmClient,
      //);
      console.log(
        "📦 ProductHistoryRTM: Products to save:",
        limitedProducts.map((p) => ({ name: p.product_name, id: p.id })),
      );

      //console.log("📦 ProductHistoryRTM: About to call setChannelMetadata...");

      await this.rtmClient.storage.setChannelMetadata(
        this.channelName,
        "MESSAGE",
        [
          {
            key: PRODUCT_HISTORY_KEY,
            value: JSON.stringify(limitedProducts),
          },
        ],
      );
      this.lastRTMUpdate = now;
      //console.log(
      //  "📦 ProductHistoryRTM: Successfully saved to RTM with key:",
      //  PRODUCT_HISTORY_KEY,
      //);
      console.log(
        "📦 ProductHistoryRTM: Saved data length:",
        JSON.stringify(limitedProducts).length,
        "characters",
      );
      return true;
    } catch (error) {
      console.error("📦 ProductHistoryRTM: Failed to save to RTM:", error);
      console.error("📦 ProductHistoryRTM: Save error details:", {
        message: error.message,
        code: error.code,
        name: error.name,
      });
      return false;
    }
  }

  /**
   * Add a product to history (both local and RTM)
   * @param {Object} product - Product object to add
   * @returns {Array} Updated product history
   */
  async addProduct(product) {
    //console.log("📦 ProductHistoryRTM: addProduct called with:", product);
    //console.log("📦 ProductHistoryRTM: Channel name:", this.channelName);
    //console.log("📦 ProductHistoryRTM: Is initialized:", this.isInitialized);

    if (!product || typeof product !== "object") {
      console.log(
        "📦 ProductHistoryRTM: Invalid product, returning local history",
      );
      return getLocalHistory(this.channelName);
    }

    // Add to local storage first
    const updatedHistory = addLocalHistory(this.channelName, product);
    console.log(
      "📦 ProductHistoryRTM: Added to local storage, new history length:",
      updatedHistory.length,
    );

    // Determine if this is initial creation or update
    const isInitial = !this.hasExistingMetadata;
    //console.log("📦 ProductHistoryRTM: Is initial save:", isInitial);
    console.log(
      "📦 ProductHistoryRTM: Has existing metadata:",
      this.hasExistingMetadata,
    );

    // Save to RTM storage
    //console.log("📦 ProductHistoryRTM: About to save to RTM...");
    const saveResult = await this.saveToRTM(updatedHistory, false, isInitial);
    //console.log("📦 ProductHistoryRTM: Save to RTM result:", saveResult);

    // Mark that we now have metadata
    this.hasExistingMetadata = true;

    // Notify listeners
    console.log(
      "📦 ProductHistoryRTM: Notifying",
      this.storageListeners.size,
      "listeners",
    );

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
    console.log("📦 ProductHistoryRTM: Clearing product history...");

    // Clear local storage first
    clearLocalHistory(this.channelName);

    // Clear RTM storage only if client is connected
    if (
      this.isInitialized &&
      this.rtmClient &&
      this.rtmClient.rtmImpl.connectionState === "CONNECTED"
    ) {
      try {
        await this.rtmClient.storage.removeChannelMetadata(
          this.channelName,
          "MESSAGE",
        );

        this.lastRTMUpdate = Date.now();
        this.pendingUpdate = null; // Clear any pending updates
        this.hasExistingMetadata = false; // Reset metadata flag
        console.log("📦 ProductHistoryRTM: Successfully cleared RTM storage");
      } catch (error) {
        console.error(
          "📦 ProductHistoryRTM: Failed to clear RTM storage:",
          error,
        );
        // Still clear local storage even if RTM fails
      }
    } else {
      console.log(
        "📦 ProductHistoryRTM: Skipping RTM clear - client not connected or not initialized",
      );
    }

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
   * Force flush any pending updates to RTM
   */
  async flushPendingUpdates() {
    if (this.pendingUpdate) {
      console.log("📦 ProductHistoryRTM: Flushing pending updates...");
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

    // Clear retry interval
    if (this.retryInterval) {
      clearInterval(this.retryInterval);
      this.retryInterval = null;
    }

    this.storageListeners.clear();
    this.rtmClient = null;
    this.channelName = null;
    this.isInitialized = false;
    this.lastRTMUpdate = 0;
    this.pendingUpdate = null;
    this.hasExistingMetadata = false;
    console.log("📦 ProductHistoryRTM: Destroyed");
  }
}

// Create singleton instance
const productHistoryRTM = new ProductHistoryRTMService();

export default productHistoryRTM;
