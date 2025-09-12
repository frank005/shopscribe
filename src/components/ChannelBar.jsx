import React, { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Users, Play, ChevronLeft, ChevronRight } from 'lucide-react';
import { getChannelList } from '../api/channelList';

/**
 * ChannelBar - Horizontal scrollable channel list for stream switching
 * @param {Object} props
 * @param {Function} props.onJoinChannel - Callback when channel is joined
 * @param {string} props.currentChannel - Currently active channel name
 * @param {string} props.className - Additional CSS classes
 */
export default function ChannelBar({ onJoinChannel, currentChannel, className = '' }) {
  const [channels, setChannels] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  const [scrollPosition, setScrollPosition] = useState(0);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);
  
  const scrollContainerRef = useRef(null);
  const pageSize = 50; // Get more channels for the bar

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
  const fetchChannels = useCallback(async () => {
    try {
      setError(null);
      
      // Get channel list
      const response = await getChannelList({ 
        page: 1, 
        pageSize, 
        search: '',
        withHosts: false
      });

      if (response.success) {
        // For each channel, get host and audience information
        const channelsWithHosts = await Promise.all(
          response.channels.map(async (channel) => {
            const hostInfo = await fetchHostInfo(channel.channel_name);
            
            const totalUsers = hostInfo.totalUsers || 0;
            const hostCount = hostInfo.hostCount || 0;
            const viewerCount = hostInfo.viewerCount || 0;
            
            return {
              ...channel,
              name: channel.channel_name,
              hostCount,
              viewerCount,
              totalUsers
            };
          })
        );
        
        // Filter out channels with no users and exclude current channel
        const activeChannels = channelsWithHosts.filter(channel => 
          channel.totalUsers > 0 && channel.name !== currentChannel
        );
        
        setChannels(activeChannels);
      } else {
        setError(response.error || 'Failed to fetch channels');
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [currentChannel, pageSize]);

  // Initial load
  useEffect(() => {
    fetchChannels();
  }, [fetchChannels]);

  // Auto-refresh every 15 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      if (!loading && !refreshing) {
        setRefreshing(true);
        fetchChannels();
      }
    }, 15000);

    return () => clearInterval(interval);
  }, [fetchChannels, loading, refreshing]);

  // Handle scroll position updates
  const updateScrollButtons = useCallback(() => {
    if (scrollContainerRef.current) {
      const container = scrollContainerRef.current;
      const maxScroll = container.scrollWidth - container.clientWidth;
      
      setCanScrollLeft(container.scrollLeft > 0);
      setCanScrollRight(container.scrollLeft < maxScroll - 1); // -1 for rounding issues
    }
  }, []);

  // Scroll handlers
  const scrollLeft = () => {
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollBy({ left: -300, behavior: 'smooth' });
    }
  };

  const scrollRight = () => {
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollBy({ left: 300, behavior: 'smooth' });
    }
  };

  // Handle scroll events
  const handleScroll = () => {
    updateScrollButtons();
  };

  // Format channel name for display
  const formatChannelName = (name) => {
    if (!name) return 'Unknown Channel';
    
    // Handle new custom channel name pattern: UserInput_timestamp_random
    const parts = name.split('_');
    if (parts.length >= 3) {
      const lastPart = parts[parts.length - 1];
      const secondLastPart = parts[parts.length - 2];
      
      if (/^\d{6}$/.test(secondLastPart) && /^[a-z0-9]{3}$/.test(lastPart)) {
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
    
    return name.replace(/^shopscribe_/, '').replace(/_/g, ' ');
  };

  // Format host and viewer counts
  const formatHostViewerCount = (hostCount, viewerCount) => {
    if (hostCount === 0 && viewerCount === 0) return 'No activity';
    if (hostCount === 0) return `${viewerCount} viewer${viewerCount > 1 ? 's' : ''}`;
    if (viewerCount === 0) return `${hostCount} host${hostCount > 1 ? 's' : ''}`;
    return `${hostCount} host${hostCount > 1 ? 's' : ''} • ${viewerCount} viewer${viewerCount > 1 ? 's' : ''}`;
  };

  // Handle join channel
  const handleJoinChannel = (channelName) => {
    if (onJoinChannel) {
      onJoinChannel(channelName);
    }
  };

  // Don't render if no channels or error
  if (loading) {
    return (
      <div className={`bg-white border-t border-gray-200 p-4 ${className}`}>
        <div className="flex items-center justify-center">
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary-600 mr-3" />
          <span className="text-gray-600">Loading channels...</span>
        </div>
      </div>
    );
  }

  if (error || channels.length === 0) {
    return null; // Don't show error or empty state in the bar
  }

  return (
    <div className={`bg-white border-t border-gray-200 ${className}`}>
      <div className="px-4 py-3">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-medium text-gray-900">Other Live Streams</h3>
          <button
            onClick={fetchChannels}
            disabled={refreshing}
            className="text-xs text-gray-500 hover:text-gray-700 disabled:opacity-50"
          >
            {refreshing ? 'Refreshing...' : 'Refresh'}
          </button>
        </div>
        
        <div className="relative">
          {/* Scroll buttons */}
          {canScrollLeft && (
            <button
              onClick={scrollLeft}
              className="absolute left-0 top-1/2 transform -translate-y-1/2 z-10 bg-white shadow-lg rounded-full p-2 hover:bg-gray-50 transition-colors"
            >
              <ChevronLeft size={16} className="text-gray-600" />
            </button>
          )}
          
          {canScrollRight && (
            <button
              onClick={scrollRight}
              className="absolute right-0 top-1/2 transform -translate-y-1/2 z-10 bg-white shadow-lg rounded-full p-2 hover:bg-gray-50 transition-colors"
            >
              <ChevronRight size={16} className="text-gray-600" />
            </button>
          )}
          
          {/* Channel list */}
          <div
            ref={scrollContainerRef}
            onScroll={handleScroll}
            className="flex gap-3 overflow-x-auto scrollbar-hide pb-2"
            style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
          >
            <AnimatePresence>
              {channels.map((channel, index) => (
                <motion.div
                  key={channel.name}
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  transition={{ duration: 0.2, delay: index * 0.02 }}
                  className="flex-shrink-0 w-64 bg-gray-50 rounded-lg p-3 hover:bg-gray-100 transition-colors"
                >
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex-1 min-w-0">
                      <h4 className="text-sm font-medium text-gray-900 truncate">
                        {formatChannelName(channel.name)}
                      </h4>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-1 text-xs text-gray-500 mb-3">
                    <Users size={12} />
                    <span>{formatHostViewerCount(channel.hostCount || 0, channel.viewerCount || 0)}</span>
                  </div>

                  <button
                    onClick={() => handleJoinChannel(channel.name)}
                    className="w-full flex items-center justify-center gap-2 px-3 py-2 bg-primary-600 text-white rounded-md hover:bg-primary-700 transition-colors text-sm"
                  >
                    <Play size={14} />
                    <span>Join</span>
                  </button>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        </div>
      </div>
    </div>
  );
}
