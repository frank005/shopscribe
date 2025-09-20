import React, { useState, useEffect, useCallback } from 'react';
import toast from 'react-hot-toast';
import { CONFIG } from '../services/config';
import agoraService from '../services/agoraService';
import { parseProductTags, isProductDisplayable, stripTags } from '../utils/product-sync';
import { SHOPSCRIBE_PROMPT } from '../utils/shopscribe-prompt';
import { 
  getProductHistory, 
  addProductToHistory, 
  exportProductHistory, 
  copyProductToClipboard 
} from '../utils/productHistory';
import productHistoryRTM from '../services/productHistoryRTM';
import VideoStage from '../components/VideoStage';
import ProductOverlay from '../components/ProductOverlay';
import ProductHistory from '../components/ProductHistory';
import HostControls from '../components/HostControls';
import DeviceSettings from '../components/DeviceSettings';

export default function HostPage() {
  
  // State management
  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [currentProduct, setCurrentProduct] = useState(null);
  const [overlayVisible, setOverlayVisible] = useState(false);
  const [productHistory, setProductHistory] = useState([]);
  const [microphoneEnabled, setMicrophoneEnabled] = useState(true);
  const [videoEnabled, setVideoEnabled] = useState(false);
  const [videoState, setVideoState] = useState('loading'); // 'loading', 'ready', 'muted'
  const [transcript, setTranscript] = useState('');
  const [channelName, setChannelName] = useState('');
  const [viewerCount, setViewerCount] = useState(0);
  const [hostCount, setHostCount] = useState(0);
  const [customChannelName, setCustomChannelName] = useState('');
  const [deviceSettingsOpen, setDeviceSettingsOpen] = useState(false);

  // Load product history when channel name changes
  useEffect(() => {
    if (channelName) {
      // Load from local storage first (fast)
      const localHistory = getProductHistory(channelName);
      setProductHistory(localHistory);
      
      // RTM service will load from server and update if needed
      console.log('🏠 HostPage: Loaded local product history:', localHistory.length, 'products');
    }
  }, [channelName]);

  // Listen for RTM product history updates
  useEffect(() => {
    const handleProductHistoryUpdate = (products) => {
      console.log('🏠 HostPage: RTM product history updated:', products.length, 'products');
      setProductHistory(products);
    };

    productHistoryRTM.addListener(handleProductHistoryUpdate);

    return () => {
      productHistoryRTM.removeListener(handleProductHistoryUpdate);
    };
  }, []);

  // Sanitize channel name input - only allow letters, numbers, and spaces
  const sanitizeChannelName = (input) => {
    return input
      .replace(/[^a-zA-Z0-9\s]/g, '') // Remove special characters
      .replace(/\s+/g, ' ') // Replace multiple spaces with single space
      .trim() // Remove leading/trailing spaces
      .substring(0, 30); // Limit length
  };

  // Handle custom channel name input
  const handleCustomChannelNameChange = (e) => {
    const sanitized = sanitizeChannelName(e.target.value);
    setCustomChannelName(sanitized);
  };

  // Fetch host/viewer counts
  const fetchHostInfo = async (channelName) => {
    try {
      const response = await fetch(`/.netlify/functions/agora-hosts?channel=${encodeURIComponent(channelName)}`);
      if (response.ok) {
        const data = await response.json();
        //console.log('📊 Host: Host info received:', data);
        
        // Handle nested data structure
        const hostInfo = data.data || data;
        //console.log('📊 Host: Parsed host info:', hostInfo);
        
        setHostCount(hostInfo.hostCount || 0);
        setViewerCount(hostInfo.viewerCount || 0);
      }
    } catch (error) {
      console.error('❌ Host: Error fetching host info:', error);
    }
  };

  // Product control handlers
  const handleProductCopy = useCallback((product) => {
    copyProductToClipboard(product);
    toast.success('Product copied to clipboard');
  }, []);

  const handleProductExport = useCallback(() => {
    exportProductHistory(productHistory);
    toast.success('Product history exported');
  }, [productHistory]);

  const handleProductNext = useCallback(() => {
    setCurrentProduct(null);
    setOverlayVisible(false);
    toast.success('Moving to next product');
  }, []);

  const handleProductHistoryClear = useCallback(async () => {
    if (channelName) {
      await productHistoryRTM.clearHistory();
      setProductHistory([]);
      toast.success('Product history cleared');
    }
  }, [channelName]);

  // Initialize connection
  const initializeConnection = useCallback(async () => {
    if (isConnecting || isConnected) return;

    // Validate custom channel name
    if (!customChannelName.trim()) {
      toast.error('Please enter a channel name to start streaming');
      return;
    }

    setIsConnecting(true);
    toast.loading('Initializing connection...', { id: 'init' });

    try {
      // Generate channel name from custom input
      const sanitizedInput = sanitizeChannelName(customChannelName);
      const timestamp = Date.now().toString().slice(-6);
      const random = Math.random().toString(36).substring(2, 5);
      const channelName = `${sanitizedInput.replace(/\s+/g, '_')}_${timestamp}_${random}`;
      setChannelName(channelName);

      // Initialize Agora clients
      const appId = CONFIG.AGORA_APP_ID;
      if (!appId) {
        throw new Error('Agora App ID not configured');
      }

      const uid = agoraService.customUID || Math.floor(Math.random() * 1000000) + 1000;
      
      // Initialize clients
      const initialized = await agoraService.initializeClients(appId, uid);
      if (!initialized) {
        throw new Error('Failed to initialize Agora clients');
      }

      // Join RTC channel as host
      console.log('🏠 HostPage: About to call joinAsHost with:', { channelName, uid });
      const rtcJoined = await agoraService.joinAsHost(channelName, uid);
      if (!rtcJoined) {
        throw new Error('Failed to join RTC channel as host');
      }

      // Join RTM channel
      await agoraService.joinSignalingChannel(channelName);

      // Initialize RTM product history service
      try {
        await productHistoryRTM.initialize(agoraService.rtmClient, channelName, agoraService.rtcEngine._config.role);
        console.log('🏠 HostPage: RTM product history service initialized');
      } catch (error) {
        console.error('🏠 HostPage: Failed to initialize RTM product history service:', error);
      }

      // Set connection state first so UI renders
      setIsConnecting(false);
      setIsConnected(true);
      
      // Wait for DOM to render, then publish media
      setTimeout(async () => {
        try {
          console.log('🎥 Host: Starting media publishing...');
          const mediaPublished = await agoraService.publishMedia({
            onVideoTrackReady: () => {
              setVideoEnabled(true); //hide loading spinner
              setVideoState('ready');
            }
          });
          console.log('🎥 Host: Media publishing result:', mediaPublished);
          if (!mediaPublished) {
            console.error('❌ Host: Failed to publish media');
            toast.error('Failed to start video stream');
          } else {
            console.log('✅ Host: Media published successfully');
            toast.success('Video stream started');
            
            // Force a re-render to ensure video displays
            setTimeout(() => {
              window.dispatchEvent(new Event('resize'));
            }, 500);
          }
        } catch (mediaError) {
          console.error('❌ Host: Media publishing error:', mediaError);
          // Handle permission errors specifically
          if (mediaError.message.includes('access denied') || mediaError.message.includes('not found')) {
            toast.error(mediaError.message, { duration: 5000 });
          } else {
            toast.error('Failed to start video stream: ' + mediaError.message);
          }
        }
      }, 1500); // Increased wait time for DOM to render

      // Create AI agent with unified prompt
      const agent = await agoraService.createAgent(
        channelName,
        CONFIG.AGORA_AGENT_UID,
        uid,
        SHOPSCRIBE_PROMPT
      );

      if (!agent) {
        throw new Error('Failed to create AI agent');
      }

      // Start receiving transcriptions from the agent
      await agoraService.conversationalAI.subscribeMessage(channelName);

      // Set up transcription listener
      agoraService.onAgentResponse((chatHistory) => {
        console.log('🎯 Host received agent response:', chatHistory);
        if (chatHistory && chatHistory.length > 0) {
          const latestMessage = chatHistory[chatHistory.length - 1];
          //console.log('🎯 Latest message:', latestMessage);
          if (latestMessage && latestMessage.data) {
            const text = latestMessage.data.text || '';
            console.log('🎯 Message text:', text);
      
            if (latestMessage.data.speaker.includes('Assistant')) {
              // Parse product tags
              const productData = parseProductTags(text);
            console.log('🎯 Parsed product data:', productData);
            //console.log('🎯 Is product displayable?', isProductDisplayable(productData));
            if (isProductDisplayable(productData)) {
              //console.log('🎯 Setting current product and showing overlay');
              setCurrentProduct(productData);
              setOverlayVisible(true);
              
              // Add to product history with RTM storage
              productHistoryRTM.addProduct(productData).then(updatedHistory => {
                setProductHistory(updatedHistory);
              }).catch(error => {
                console.error('🎯 Failed to add product to RTM history:', error);
                // Fallback to local storage
                const localHistory = addProductToHistory(channelName, productData);
                setProductHistory(localHistory);
              });
            } else {
              console.log('🎯 Product not displayable, skipping overlay');
            }
            } else {
            // Update transcript with cleaned text (strip tags for display) for User text
            const cleanedText = stripTags(text);
            setTranscript(cleanedText);
            };            
          }
        }
      });

      // Add debug event listeners
      agoraService.conversationalAI.on('debug-log', (message) => {
        console.log('🔍 AI Debug:', message);
      });
      
      agoraService.conversationalAI.on('agent-error', (agentUserId, error) => {
        console.error('❌ AI Agent Error:', agentUserId, error);
      });

      toast.success('Connected successfully!', { id: 'init' });
      
    } catch (error) {
      console.error('Connection error:', error);
      toast.error(`Connection failed: ${error.message}`, { id: 'init' });
      setIsConnecting(false);
      setIsConnected(false);
    }
  }, [isConnecting, isConnected, customChannelName]);

  // Real-time updates for host/viewer counts
  useEffect(() => {
    if (!isConnected || !channelName) return;

    // Initial fetch
    fetchHostInfo(channelName);

    // Set up polling for real-time updates
    const interval = setInterval(() => {
      fetchHostInfo(channelName);
    }, 5000); // Update every 5 seconds

    return () => clearInterval(interval);
  }, [isConnected, channelName]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (isConnected) {
        agoraService.disconnect();
      }
    };
  }, [isConnected]);

  // Control handlers
  const handleToggleOverlay = () => {
    setOverlayVisible(!overlayVisible);
  };

  const handleNextProduct = () => {
    setCurrentProduct(null);
    setOverlayVisible(false);
  };

  const handlePinProduct = () => {
    if (currentProduct && isProductDisplayable(currentProduct)) {
      setProductHistory(prev => [currentProduct, ...prev.slice(0, CONFIG.MAX_PRODUCT_HISTORY - 1)]);
      toast.success('Product pinned to history');
    }
  };

  const handleToggleMicrophone = async () => {
    try {
      const newState = !microphoneEnabled;
      await agoraService.setMicrophoneEnabled(newState);
      setMicrophoneEnabled(newState);
      toast.success(newState ? 'Microphone enabled' : 'Microphone disabled');
    } catch (error) {
      toast.error('Failed to toggle microphone');
    }
  };

  const handleToggleVideo = async () => {
    try {
      const newState = !videoEnabled;
      await agoraService.setVideoEnabled(newState);
      setVideoEnabled(newState);

      // Update videoState based on new state
      if (newState) {
        setVideoState('ready');
      } else {
        setVideoState('muted');
      };
      toast.success(newState ? 'Video enabled' : 'Video disabled');
    } catch (error) {
      toast.error('Failed to toggle video');
    }
  };

  const handleSelectProduct = (product) => {
    setCurrentProduct(product);
    setOverlayVisible(true);
  };

  const handleRemoveProduct = (product, index) => {
    setProductHistory(prev => prev.filter((_, i) => i !== index));
    toast.success('Product removed from history');
  };

  const handleCopyProductHistory = async () => {
    try {
      const historyText = JSON.stringify(productHistory, null, 2);
      await navigator.clipboard.writeText(historyText);
      toast.success('Product history copied to clipboard');
    } catch (error) {
      console.error('Failed to copy to clipboard:', error);
      toast.error('Failed to copy to clipboard');
    }
  };

  const handleExportProductHistory = () => {
    try {
      const historyData = JSON.stringify(productHistory, null, 2);
      const blob = new Blob([historyData], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `product-history-${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast.success('Product history exported');
    } catch (error) {
      console.error('Failed to export:', error);
      toast.error('Failed to export product history');
    }
  };

  // Device settings handlers
  const handleOpenDeviceSettings = () => {
    setDeviceSettingsOpen(true);
  };

  const handleCloseDeviceSettings = () => {
    setDeviceSettingsOpen(false);
  };

  const handleDeviceChange = (deviceType, deviceId) => {
    console.log(`Device changed: ${deviceType} to ${deviceId}`);
    // The DeviceSettings component handles the actual device switching
    // This callback can be used for additional UI updates if needed
  };

  const handleEndStream = async () => {
    if (window.confirm('Are you sure you want to end the stream? This will disconnect all viewers.')) {
      try {
        console.log('🏁 HostPage: About to end stream');
        console.log('🏁 HostPage: agoraService.currentChannelName before endStream:', agoraService.currentChannelName);
        console.log('🏁 HostPage: channelName state before endStream:', channelName);
        
        // Clear product history BEFORE disconnecting from RTM
        if (channelName) {
          await productHistoryRTM.clearHistory();
          console.log('🗑️ Cleared product history for ended stream:', channelName);
        }
        
        // Clean up RTM service BEFORE disconnecting
        await productHistoryRTM.destroy();
        
        // Now end the stream (which disconnects RTM)
        await agoraService.endStream(channelName);
        console.log('🏁 HostPage: endStream completed');
        
        setIsConnected(false);
        setChannelName('');
        setCurrentProduct(null);
        setOverlayVisible(false);
        setTranscript('');
        setProductHistory([]);
        // Reset mic/video states to default
        setMicrophoneEnabled(true);
        setVideoEnabled(false);
        setVideoState('loading');
        // Reset stream info
        setHostCount(0);
        setViewerCount(0);
        toast.success('Stream ended successfully');
      } catch (error) {
        console.error('🏁 HostPage: Error ending stream:', error);
        toast.error('Failed to end stream');
      }
    }
  };

  // Auto-hide overlay after timeout
  useEffect(() => {
    if (overlayVisible && currentProduct) {
      const timer = setTimeout(() => {
        setOverlayVisible(false);
      }, CONFIG.OVERLAY_TIMEOUT_MS);

      return () => clearTimeout(timer);
    }
  }, [overlayVisible, currentProduct]);

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="container mx-auto px-4 py-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 mb-2">Host Live Stream</h1>
            <p className="text-gray-600">
              {isConnected 
                ? `Streaming to channel: ${channelName}`
                : 'Start your live shopping stream'
              }
            </p>
          </div>
          
          {isConnected && (
            <button
              onClick={handleEndStream}
              className="btn-danger"
            >
              End Stream
            </button>
          )}
        </div>

        {!isConnected ? (
          /* Connection Setup */
          <div className="max-w-md mx-auto">
            <div className="card text-center">
              <h2 className="text-xl font-semibold mb-4">Start Streaming</h2>
              <p className="text-gray-600 mb-6">
                Enter a name for your live shopping stream. This will help viewers find your channel.
              </p>
              
              <div className="mb-6">
                <label htmlFor="channelName" className="block text-sm font-medium text-gray-700 mb-2">
                  Channel Name
                </label>
                <input
                  id="channelName"
                  type="text"
                  value={customChannelName}
                  onChange={handleCustomChannelNameChange}
                  placeholder="e.g., My Shopping Stream"
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  maxLength={30}
                />
                <p className="text-xs text-gray-500 mt-1">
                  Only letters, numbers, and spaces allowed. Max 30 characters.
                </p>
              </div>
              
              <button
                onClick={initializeConnection}
                disabled={isConnecting || !customChannelName.trim()}
                className="btn-primary w-full disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isConnecting ? 'Connecting...' : 'Start Stream'}
              </button>
            </div>
          </div>
        ) : (
          /* Main Stream Interface */
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
            {/* Video Stage */}
            <div className="lg:col-span-3">
              <div className="aspect-video mb-4">
                <VideoStage videoState={videoState} mode="local">
                  <ProductOverlay
                    product={currentProduct}
                    visible={overlayVisible}
                    onClose={() => setOverlayVisible(false)}
                    onNext={handleProductNext}
                    onCopy={handleProductCopy}
                    onExport={handleProductExport}
                    isHost={true}
                  />
                </VideoStage>
              </div>
              
              {/* Host Controls */}
              <HostControls
                currentProduct={currentProduct}
                overlayVisible={overlayVisible}
                microphoneEnabled={microphoneEnabled}
                videoEnabled={videoEnabled}
                onToggleOverlay={handleToggleOverlay}
                onNextProduct={handleNextProduct}
                onPinProduct={handlePinProduct}
                onToggleMicrophone={handleToggleMicrophone}
                onToggleVideo={handleToggleVideo}
                onOpenDeviceSettings={handleOpenDeviceSettings}
              />
              
              {/* Controls Help */}
              <div className="mt-4 p-3 bg-blue-50 rounded-lg border border-blue-200">
                <h4 className="text-sm font-medium text-blue-900 mb-2">Control Guide:</h4>
                <div className="text-xs text-blue-700 space-y-1">
                  <p><strong>Show/Hide:</strong> Toggle product overlay visibility</p>
                  <p><strong>Next:</strong> Clear current product and wait for new description</p>
                  <p><strong>Pin:</strong> Save current product to history sidebar</p>
                </div>
              </div>
            </div>

            {/* Sidebar */}
            <div className="lg:col-span-1 space-y-6">
              {/* Stream Info */}
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
                <h3 className="text-lg font-semibold text-gray-900 mb-3">Stream Info</h3>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-600">Channel:</span>
                    <span className="font-medium">{channelName}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Hosts:</span>
                    <span className="font-medium">{hostCount}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Viewers:</span>
                    <span className="font-medium">{viewerCount}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Status:</span>
                    <span className="font-medium text-green-600">Live</span>
                  </div>
                </div>
              </div>

              {/* Product History */}
              <ProductHistory
                products={productHistory}
                onCopy={handleProductCopy}
                onExport={handleProductExport}
                onClear={handleProductHistoryClear}
                isHost={true}
              />
              
              {/* Live Transcript */}
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
                <h3 className="text-lg font-semibold text-gray-900 mb-3">Live Transcript</h3>
                <div className="bg-gray-50 rounded-lg p-3 max-h-48 overflow-y-auto">
                  <p className="text-sm text-gray-700 whitespace-pre-wrap">
                    {transcript || 'Start speaking to see transcript...'}
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
      
      {/* Device Settings Modal */}
      <DeviceSettings
        isOpen={deviceSettingsOpen}
        onClose={handleCloseDeviceSettings}
        onDeviceChange={handleDeviceChange}
      />
    </div>
  );
}
