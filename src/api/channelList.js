// Channel List API Client
// Wrapper for serverless channel list endpoint

/**
 * Get list of active Agora channels
 * @param {Object} options - Query options
 * @param {number} options.page - Page number (default: 1)
 * @param {number} options.pageSize - Items per page (default: 20)
 * @param {string} options.search - Search term (optional)
 * @param {boolean} options.withHosts - Include host and viewer counts (default: false)
 * @returns {Promise<Object>} - Channel list response
 */
export async function getChannelList({ page = 1, pageSize = 20, search = '', withHosts = false } = {}) {
  try {
    const params = new URLSearchParams({
      page: page.toString(),
      pageSize: pageSize.toString()
    });
    
    if (search) {
      params.append('search', search);
    }
    
    if (withHosts) {
      params.append('withHosts', 'true');
    }
    
    const url = `/.netlify/functions/agora-channels?${params}`;
    console.log('📊 Fetching channel list from:', url);
    console.log('📊 Request params:', Object.fromEntries(params));
    
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || `HTTP ${response.status}: ${response.statusText}`);
    }

    const data = await response.json();
    
    // Validate response structure
    if (!data || typeof data !== 'object') {
      throw new Error('Invalid response format');
    }
    
    // Handle nested data structure from Netlify function
    const responseData = data.data || data;
    
    return {
      page: responseData.page || page,
      pageSize: responseData.pageSize || pageSize,
      total: responseData.total || 0,
      channels: responseData.channels || [],
      success: data.success !== false
    };
  } catch (error) {
    console.error('Error fetching channel list:', error);
    
    // Return mock data when API is not available (for development)
    if (error.message.includes('Failed to fetch') || error.message.includes('ERR_CONNECTION_REFUSED') || error.message.includes('500')) {
      console.log('API not available, returning mock data for development');
      return {
        page,
        pageSize,
        total: 0,
        channels: [],
        success: false,
        error: 'API not available - use "npm run dev" for full functionality'
      };
    }
    
    return {
      page,
      pageSize,
      total: 0,
      channels: [],
      success: false,
      error: error.message
    };
  }
}

/**
 * Search channels by name
 * @param {string} searchTerm - Search term
 * @param {number} page - Page number
 * @param {number} pageSize - Items per page
 * @returns {Promise<Object>} - Search results
 */
export async function searchChannels(searchTerm, page = 1, pageSize = 20) {
  return getChannelList({ page, pageSize, search: searchTerm });
}

/**
 * Get channel details by name
 * @param {string} channelName - Channel name
 * @returns {Promise<Object|null>} - Channel details or null if not found
 */
export async function getChannelDetails(channelName) {
  try {
    const response = await getChannelList({ page: 1, pageSize: 100 });
    
    if (!response.success) {
      return null;
    }
    
    const channel = response.channels.find(ch => ch.name === channelName);
    return channel || null;
  } catch (error) {
    console.error('Error fetching channel details:', error);
    return null;
  }
}

/**
 * Check if a channel is currently active
 * @param {string} channelName - Channel name to check
 * @returns {Promise<boolean>} - True if channel is active
 */
export async function isChannelActive(channelName) {
  const channel = await getChannelDetails(channelName);
  return channel && channel.uidCount > 0;
}
