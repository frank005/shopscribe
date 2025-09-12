import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, Users, Play, RefreshCw, AlertCircle } from 'lucide-react';
import { getChannelList } from '../api/channelList';

/**
 * AudienceLobby - Channel discovery and selection interface
 * @param {Object} props
 * @param {Function} props.onJoinChannel - Callback when channel is joined
 * @param {string} props.className - Additional CSS classes
 */
export default function AudienceLobby({ onJoinChannel, className = '' }) {
  const [channels, setChannels] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalChannels, setTotalChannels] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const [showFullName, setShowFullName] = useState({});

  const pageSize = 20;

  // Fetch host information for a specific channel
  const fetchHostInfo = async (channelName) => {
    try {
      const response = await fetch(`/.netlify/functions/agora-hosts?channel=${encodeURIComponent(channelName)}`);
      const data = await response.json();
      
      if (data.success) {
        return {
          hostCount: data.data.hostCount,
          viewerCount: data.data.viewerCount,
          totalUsers: data.data.totalUsers
        };
      } else {
        console.warn(`Failed to fetch host info for ${channelName}:`, data.error);
        return { hostCount: 0, viewerCount: 0, totalUsers: 0 };
      }
    } catch (error) {
      console.warn(`Error fetching host info for ${channelName}:`, error);
      return { hostCount: 0, viewerCount: 0, totalUsers: 0 };
    }
  };

  // Fetch channels with host information
  const fetchChannels = useCallback(async (page = 1, search = '') => {
    try {
      setError(null);
      
      // Step 1: Get channel list
      const response = await getChannelList({ 
        page, 
        pageSize, 
        search: search.trim(),
        withHosts: false // Don't ask server for host info, we'll get it ourselves
      });

      if (response.success) {
        console.log('📊 Step 1 - Channel list received:', response.channels);
        
        // Step 2: For each channel, get host and audience information
        const channelsWithHosts = await Promise.all(
          response.channels.map(async (channel) => {
            const hostInfo = await fetchHostInfo(channel.channel_name);
            console.log(`📊 Step 2 - Host info for ${channel.channel_name}:`, hostInfo);
            
            // Use the exact counts from the host API
            const totalUsers = hostInfo.totalUsers || 0;
            const hostCount = hostInfo.hostCount || 0;
            const viewerCount = hostInfo.viewerCount || 0;
            
            console.log(`📊 Step 3 - Final counts for ${channel.channel_name}:`, {
              totalUsers,
              hostCount,
              viewerCount,
              hostInfoRaw: hostInfo
            });
            
            return {
              ...channel,
              name: channel.channel_name,
              hostCount,
              viewerCount,
              totalUsers
            };
          })
        );
        
        // Step 3: Filter out channels with no users (non-existent or empty channels)
        const activeChannels = channelsWithHosts.filter(channel => channel.totalUsers > 0);
        console.log(`📊 Step 4 - Filtered ${channelsWithHosts.length} channels to ${activeChannels.length} active channels`);
        
        console.log('📊 Final processed channels:', activeChannels);
        
        setChannels(activeChannels);
        setTotalChannels(activeChannels.length);
        setTotalPages(Math.ceil(response.total / pageSize));
        setCurrentPage(page);
      } else {
        setError(response.error || 'Failed to fetch channels');
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [pageSize]);

  // Initial load
  useEffect(() => {
    fetchChannels(1, searchTerm);
  }, [fetchChannels, searchTerm]);

  // Auto-refresh every 10 seconds - only when component is visible and not searching
  useEffect(() => {
    // Check if the component is actually visible on the page
    const isVisible = document.visibilityState === 'visible' && 
                     window.location.pathname === '/lobby';
    
    if (!isVisible || searchTerm.trim()) return; // Don't auto-refresh when searching
    
    const interval = setInterval(() => {
      if (!loading && !refreshing && document.visibilityState === 'visible' && !searchTerm.trim()) {
        setRefreshing(true);
        fetchChannels(currentPage, searchTerm);
      }
    }, 10000);

    return () => clearInterval(interval);
  }, [fetchChannels, currentPage, searchTerm, loading, refreshing]);

  // Handle search with debounce
  const handleSearch = useCallback((value) => {
    setSearchTerm(value);
    setCurrentPage(1);
  }, []);

  // Debounced search effect
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      if (searchTerm !== '') {
        fetchChannels(1, searchTerm);
      }
    }, 500); // 500ms debounce

    return () => clearTimeout(timeoutId);
  }, [searchTerm, fetchChannels]);

  // Handle page change
  const handlePageChange = (page) => {
    if (page >= 1 && page <= totalPages) {
      fetchChannels(page, searchTerm);
    }
  };

  // Handle manual refresh
  const handleRefresh = () => {
    setRefreshing(true);
    fetchChannels(currentPage, searchTerm);
  };

  // Handle join channel
  const handleJoinChannel = (channelName) => {
    if (onJoinChannel) {
      onJoinChannel(channelName);
    }
  };

  // Format viewer count
  const formatViewerCount = (count) => {
    if (count === 0) return 'No viewers';
    if (count === 1) return '1 viewer';
    return `${count} viewers`;
  };

  // Format host and viewer counts
  const formatHostViewerCount = (hostCount, viewerCount) => {
    console.log('📊 formatHostViewerCount called with:', { 
      hostCount, 
      viewerCount, 
      hostCountType: typeof hostCount, 
      viewerCountType: typeof viewerCount 
    });
    if (hostCount === 0 && viewerCount === 0) return 'No activity';
    if (hostCount === 0) return formatViewerCount(viewerCount);
    if (viewerCount === 0) return `${hostCount} host${hostCount > 1 ? 's' : ''}`;
    return `${hostCount} host${hostCount > 1 ? 's' : ''} • ${viewerCount} viewer${viewerCount > 1 ? 's' : ''}`;
  };

  // Format channel name for display
  const formatChannelName = (name) => {
    if (!name) return 'Unknown Channel';
    
    // Handle new custom channel name pattern: UserInput_timestamp_random
    const parts = name.split('_');
    if (parts.length >= 3) {
      // Check if it's the new format (has timestamp and random at the end)
      const lastPart = parts[parts.length - 1];
      const secondLastPart = parts[parts.length - 2];
      
      // If last two parts look like timestamp and random (6 digits + 3 alphanumeric)
      if (/^\d{6}$/.test(secondLastPart) && /^[a-z0-9]{3}$/.test(lastPart)) {
        // Remove timestamp and random parts, join the rest with spaces
        const nameParts = parts.slice(0, -2);
        return nameParts.join(' ');
      }
    }
    
    // Handle old ss_host_ pattern
    if (name.startsWith('ss_host_')) {
      const parts = name.split('_');
      if (parts.length >= 3) {
        const hostId = parts[2];
        return `Host ${hostId}`;
      }
    }
    
    // For other patterns, clean up the name
    return name.replace(/^shopscribe_/, '').replace(/_/g, ' ');
  };

  // Get full channel name for tooltips
  const getFullChannelName = (name) => {
    if (!name) return 'Unknown Channel';
    return name;
  };

  // Toggle full channel name display
  const toggleFullName = (channelName) => {
    setShowFullName(prev => ({
      ...prev,
      [channelName]: !prev[channelName]
    }));
  };

  return (
    <div className={`max-w-4xl mx-auto p-6 ${className}`}>
      {/* Header */}
      <div className="text-center mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">
          Live Shopping Channels
        </h1>
        <p className="text-gray-600">
          Discover and join live shopping streams
        </p>
      </div>

      {/* Search and Controls */}
      <div className="flex flex-col sm:flex-row gap-4 mb-6">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
          <input
            type="text"
            placeholder="Search channels..."
            value={searchTerm}
            onChange={(e) => handleSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
          />
        </div>
        
        <button
          onClick={handleRefresh}
          disabled={refreshing}
          className="flex items-center gap-2 px-4 py-3 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50 transition-colors"
        >
          <RefreshCw size={16} className={refreshing ? 'animate-spin' : ''} />
          <span>Refresh</span>
        </button>
      </div>

      {/* Stats */}
      <div className="flex items-center justify-between mb-6 text-sm text-gray-600">
        <div className="flex items-center gap-4">
          <span>{totalChannels} channels found</span>
          {searchTerm && (
            <span>Searching for: "{searchTerm}"</span>
          )}
        </div>
        
        {totalPages > 1 && (
          <div className="flex items-center gap-2">
            <button
              onClick={() => handlePageChange(currentPage - 1)}
              disabled={currentPage === 1}
              className="px-3 py-1 border border-gray-300 rounded disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
            >
              Previous
            </button>
            <span>Page {currentPage} of {totalPages}</span>
            <button
              onClick={() => handlePageChange(currentPage + 1)}
              disabled={currentPage === totalPages}
              className="px-3 py-1 border border-gray-300 rounded disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
            >
              Next
            </button>
          </div>
        )}
      </div>

      {/* Content */}
      {loading ? (
        <div className="text-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600 mx-auto mb-4" />
          <p className="text-gray-600">Loading channels...</p>
        </div>
      ) : error ? (
        <div className="text-center py-12">
          <AlertCircle className="mx-auto mb-4 text-red-500" size={48} />
          <h3 className="text-lg font-semibold text-gray-900 mb-2">Error Loading Channels</h3>
          <p className="text-gray-600 mb-4">{error}</p>
          {error.includes('API not available') ? (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
              <p className="text-blue-800 text-sm">
                <strong>Development Mode:</strong> To test the full functionality including channel discovery, 
                run <code className="bg-blue-100 px-2 py-1 rounded">npm run dev</code> instead of <code className="bg-blue-100 px-2 py-1 rounded">npm start</code>
              </p>
            </div>
          ) : (
            <button
              onClick={handleRefresh}
              className="btn-primary"
            >
              Try Again
            </button>
          )}
        </div>
      ) : channels.length === 0 ? (
        <div className="text-center py-12">
          <Users className="mx-auto mb-4 text-gray-400" size={48} />
          <h3 className="text-lg font-semibold text-gray-900 mb-2">No Channels Found</h3>
          <p className="text-gray-600">
            {searchTerm 
              ? `No channels match "${searchTerm}"`
              : 'No live channels available right now'
            }
          </p>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          <AnimatePresence>
            {channels.map((channel, index) => (
              <motion.div
                key={channel.name}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                transition={{ duration: 0.2, delay: index * 0.05 }}
                className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 hover:shadow-md transition-shadow"
              >
                <div className="mb-4">
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex-1 min-w-0">
                      <h3 className="text-lg font-semibold text-gray-900 truncate">
                        {formatChannelName(channel.name)}
                      </h3>
                      {channel.name.length > 20 && (
                        <button
                          onClick={() => toggleFullName(channel.name)}
                          className="text-xs text-blue-600 hover:text-blue-800 underline mt-1"
                        >
                          {showFullName[channel.name] ? 'Hide' : 'Show'} full name
                        </button>
                      )}
                      {showFullName[channel.name] && (
                        <div className="mt-2 p-2 bg-gray-100 rounded text-xs font-mono text-gray-700 break-all">
                          {getFullChannelName(channel.name)}
                        </div>
                      )}
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-1 text-sm text-gray-500">
                    <Users size={16} />
                    <span>{formatHostViewerCount(channel.hostCount || 0, channel.viewerCount || 0)}</span>
                  </div>
                </div>

                <div className="flex items-center justify-between">
                  <div className="text-xs text-gray-500">
                    {channel.updatedAt && (
                      <span>Updated {new Date(channel.updatedAt).toLocaleTimeString()}</span>
                    )}
                  </div>
                  
                  <button
                    onClick={() => handleJoinChannel(channel.name)}
                    className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
                  >
                    <Play size={16} />
                    <span>Join</span>
                  </button>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
}
