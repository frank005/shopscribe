import React, { useState, useEffect, useCallback } from 'react';
import toast from 'react-hot-toast';
import { CONFIG, generateChannelName } from '../services/config';
import agoraService from '../services/agoraService';
import { parseProductTags, isProductDisplayable, stripTags } from '../utils/product-sync';
import { cleanSubtitleText } from '../utils/subtitle-clean';
import { SHOPSCRIBE_PROMPT } from '../utils/shopscribe-prompt';
import { 
  getProductHistory, 
  saveProductHistory, 
  addProductToHistory, 
  clearProductHistory, 
  exportProductHistory, 
  copyProductToClipboard 
} from '../utils/productHistory';
import VideoStage from '../components/VideoStage';
import ProductOverlay from '../components/ProductOverlay';
import ProductHistory from '../components/ProductHistory';
import HostControls from '../components/HostControls';
import ProductSidebar from '../components/ProductSidebar';

export default function HostPage() {
  
  // State management
  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [currentProduct, setCurrentProduct] = useState(null);
  const [overlayVisible, setOverlayVisible] = useState(false);
  const [productHistory, setProductHistory] = useState([]);
  const [microphoneEnabled, setMicrophoneEnabled] = useState(true);
  const [videoEnabled, setVideoEnabled] = useState(true);
  const [transcript, setTranscript] = useState('');
  const [channelName, setChannelName] = useState('');

  // Load product history on component mount
  useEffect(() => {
    const history = getProductHistory();
    setProductHistory(history);
  }, []);

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

  const handleProductHistoryClear = useCallback(() => {
    clearProductHistory();
    setProductHistory([]);
    toast.success('Product history cleared');
  }, []);

  // Initialize connection
  const initializeConnection = useCallback(async () => {
    if (isConnecting || isConnected) return;

    setIsConnecting(true);
    toast.loading('Initializing connection...', { id: 'init' });

    try {
      // Generate or use custom channel name
      const channelName = agoraService.currentChannelName || generateChannelName('host');
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
      console.log('🏠 HostPage: joinAsHost result:', rtcJoined);
      if (!rtcJoined) {
        throw new Error('Failed to join RTC channel as host');
      }

      // Join RTM channel
      await agoraService.joinSignalingChannel(channelName);

      // Set connection state first so UI renders
      setIsConnecting(false);
      setIsConnected(true);
      
      // Wait for DOM to render, then publish media
      setTimeout(async () => {
        try {
          console.log('🎥 Host: Starting media publishing...');
          const mediaPublished = await agoraService.publishMedia();
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
          console.log('🎯 Latest message:', latestMessage);
          if (latestMessage && latestMessage.data) {
            const text = latestMessage.data.text || '';
            console.log('🎯 Message text:', text);
            
            // Parse product tags
            const productData = parseProductTags(text);
            console.log('🎯 Parsed product data:', productData);
            console.log('🎯 Is product displayable?', isProductDisplayable(productData));
            if (isProductDisplayable(productData)) {
              console.log('🎯 Setting current product and showing overlay');
              setCurrentProduct(productData);
              setOverlayVisible(true);
              
              // Add to product history with session storage
              const updatedHistory = addProductToHistory(productData);
              setProductHistory(updatedHistory);
            } else {
              console.log('🎯 Product not displayable, skipping overlay');
            }
            
            // Update transcript with cleaned text (strip tags for display)
            const cleanedText = stripTags(text);
            setTranscript(cleanedText);
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
  }, [isConnecting, isConnected]);

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

  const handleEndStream = async () => {
    if (window.confirm('Are you sure you want to end the stream? This will disconnect all viewers.')) {
      try {
        await agoraService.endStream();
        setIsConnected(false);
        setChannelName('');
        setCurrentProduct(null);
        setOverlayVisible(false);
        setTranscript('');
        // Reset mic/video states to default
        setMicrophoneEnabled(true);
        setVideoEnabled(true);
        toast.success('Stream ended successfully');
      } catch (error) {
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
                Begin your live shopping stream and start describing products naturally.
                Our AI will automatically detect and create product overlays.
              </p>
              <button
                onClick={initializeConnection}
                disabled={isConnecting}
                className="btn-primary w-full"
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
                <VideoStage showLoading={!videoEnabled} mode="local">
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
    </div>
  );
}
