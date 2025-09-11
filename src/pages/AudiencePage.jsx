import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import { CONFIG } from '../services/config';
import agoraService from '../services/agoraService';
import { parseProductTags, isProductDisplayable, stripTags } from '../utils/product-sync';
import { cleanSubtitleText } from '../utils/subtitle-clean';
import { 
  getProductHistory, 
  addProductToHistory 
} from '../utils/productHistory';
import VideoStage from '../components/VideoStage';
import ProductOverlay from '../components/ProductOverlay';
import ProductHistory from '../components/ProductHistory';

export default function AudiencePage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  
  // State management
  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [currentProduct, setCurrentProduct] = useState(null);
  const [overlayVisible, setOverlayVisible] = useState(false);
  const [productHistory, setProductHistory] = useState([]);
  const [transcript, setTranscript] = useState('');
  const [channelName, setChannelName] = useState('');
  const [viewerCount, setViewerCount] = useState(0);
  const [hostCount, setHostCount] = useState(0);
  
  // Store UID to prevent multiple initializations with different UIDs
  const uidRef = useRef(null);

  // Load product history on component mount
  useEffect(() => {
    const history = getProductHistory();
    setProductHistory(history);
  }, []);

  // Fetch host/viewer counts
  const fetchHostInfo = async (channelName) => {
    try {
      const response = await fetch(`/.netlify/functions/agora-hosts?channel=${encodeURIComponent(channelName)}`);
      if (response.ok) {
        const data = await response.json();
        console.log('📊 Audience: Host info received:', data);
        
        // Handle nested data structure
        const hostInfo = data.data || data;
        console.log('📊 Audience: Parsed host info:', hostInfo);
        
        setHostCount(hostInfo.hostCount || 0);
        setViewerCount(hostInfo.viewerCount || 0);
      }
    } catch (error) {
      console.error('❌ Audience: Error fetching host info:', error);
    }
  };

  // Get channel from URL params
  const channelParam = searchParams.get('channel');

  // Initialize connection
  const initializeConnection = useCallback(async () => {
    if (isConnecting || isConnected || !channelParam) return;

    setIsConnecting(true);
    toast.loading('Joining stream...', { id: 'join' });

    try {
      setChannelName(channelParam);

      // Initialize Agora clients
      const appId = CONFIG.AGORA_APP_ID;
      if (!appId) {
        throw new Error('Agora App ID not configured');
      }

      // Use consistent UID - only generate once
      if (!uidRef.current) {
        uidRef.current = Math.floor(Math.random() * 1000000) + 1000;
      }
      const uid = uidRef.current;
      console.log('🎯 Audience: Using UID:', uid);
      
      // Initialize clients
      const initialized = await agoraService.initializeClients(appId, uid);
      if (!initialized) {
        throw new Error('Failed to initialize Agora clients');
      }

      // Join RTC channel as audience
      console.log('🏠 AudiencePage: About to call joinAsAudience with:', { channelName, uid });
      const rtcJoined = await agoraService.joinAsAudience(channelParam, uid);
      console.log('🏠 AudiencePage: joinAsAudience result:', rtcJoined);
      if (!rtcJoined) {
        throw new Error('Failed to join RTC channel as audience');
      }

      // Join RTM channel
      await agoraService.joinSignalingChannel(channelParam);

      // CRITICAL: Subscribe to RTM messages like the host does
      console.log('🎯 Audience: Subscribing to RTM messages like host...');
      try {
        await agoraService.conversationalAI.subscribeMessage(channelParam);
        console.log('🎯 Audience: RTM message subscription complete');
      } catch (rtmError) {
        console.error('❌ Audience: RTM subscription failed:', rtmError);
        console.error('❌ RTM Error details:', {
          message: rtmError.message,
          code: rtmError.code,
          name: rtmError.name
        });
        // Don't throw here - continue with RTC functionality
        console.log('⚠️ Audience: Continuing without RTM subscription');
      }

      // Set up transcription listener with enhanced debugging
      console.log('🎯 Audience: Setting up agent response listener...');
      agoraService.onAgentResponse((chatHistory) => {
        console.log('🎯 Audience received agent response:', chatHistory);
        console.log('🎯 Audience chatHistory length:', chatHistory?.length);
        console.log('🎯 Audience chatHistory type:', typeof chatHistory);
        console.log('🎯 Audience chatHistory isArray:', Array.isArray(chatHistory));
        
        if (chatHistory && chatHistory.length > 0) {
          const latestMessage = chatHistory[chatHistory.length - 1];
          console.log('🎯 Audience latest message:', latestMessage);
          console.log('🎯 Audience latest message type:', typeof latestMessage);
          console.log('🎯 Audience latest message keys:', latestMessage ? Object.keys(latestMessage) : 'null');
          
          if (latestMessage && latestMessage.data) {
            const text = latestMessage.data.text || '';
            console.log('🎯 Audience message text:', text);
            console.log('🎯 Audience message text length:', text.length);
            
            // Parse product tags
            const productData = parseProductTags(text);
            console.log('🎯 Audience parsed product data:', productData);
            console.log('🎯 Audience is product displayable?', isProductDisplayable(productData));
            
            if (isProductDisplayable(productData)) {
              console.log('🎯 Audience: Setting current product and showing overlay');
              setCurrentProduct(productData);
              setOverlayVisible(true);
              
              // Add to product history with session storage
              const updatedHistory = addProductToHistory(productData);
              setProductHistory(updatedHistory);
              console.log('🎯 Audience: Product added to history, new history length:', updatedHistory.length);
            } else {
              console.log('🎯 Audience: Product not displayable, skipping overlay');
            }
            
            // Update transcript with cleaned text (strip tags for display)
            const cleanedText = stripTags(text);
            setTranscript(cleanedText);
            console.log('🎯 Audience: Transcript updated with:', cleanedText);
          } else {
            console.log('🎯 Audience: No data in latest message');
            console.log('🎯 Audience: latestMessage.data:', latestMessage?.data);
          }
        } else {
          console.log('🎯 Audience: No chat history or empty array');
        }
      });

      // Add debug event listeners
      agoraService.conversationalAI.on('debug-log', (message) => {
        console.log('🔍 AI Debug:', message);
      });

      // Add fallback RTM message listener for agent responses
      console.log('🎯 Audience: Setting up RTM message fallback listener...');
      console.log('🎯 Audience: agoraService.rtmChannel:', agoraService.rtmChannel);
      console.log('🎯 Audience: agoraService.rtmChannel type:', typeof agoraService.rtmChannel);
      
      if (agoraService.rtmChannel && typeof agoraService.rtmChannel.on === 'function') {
        console.log('🎯 Audience: RTM channel available, setting up listener');
        agoraService.rtmChannel.on('ChannelMessage', (message, memberId) => {
          console.log('🎯 Audience RTM fallback: Received message:', message, 'from:', memberId);
          if (message && message.text) {
            console.log('🎯 Audience RTM fallback: Message text:', message.text);
            
            // Parse product tags from RTM message
            const productData = parseProductTags(message.text);
            console.log('🎯 Audience RTM fallback: Parsed product data:', productData);
            
            if (isProductDisplayable(productData)) {
              console.log('🎯 Audience RTM fallback: Setting product from RTM message');
              setCurrentProduct(productData);
              setOverlayVisible(true);
              
              // Add to product history
              const updatedHistory = addProductToHistory(productData);
              setProductHistory(updatedHistory);
            }
            
            // Update transcript
            const cleanedText = stripTags(message.text);
            setTranscript(cleanedText);
          }
        });
      } else {
        console.log('⚠️ Audience: RTM channel does not have on method, skipping fallback listener');
        console.log('🔍 RTM channel object:', agoraService.rtmChannel);
      }
      
      agoraService.conversationalAI.on('agent-error', (agentUserId, error) => {
        console.error('❌ AI Agent Error:', agentUserId, error);
      });

      // Set up user count tracking
      agoraService.onMemberJoined = (memberId) => {
        setViewerCount(prev => prev + 1);
      };

      agoraService.onMemberLeft = (memberId) => {
        setViewerCount(prev => Math.max(0, prev - 1));
      };

      setIsConnected(true);
      toast.success('Joined stream successfully!', { id: 'join' });
      
      // Fetch host/viewer counts
      await fetchHostInfo(channelParam);
      
    } catch (error) {
      console.error('Connection error:', error);
      console.error('Error details:', {
        message: error.message,
        stack: error.stack,
        name: error.name,
        code: error.code
      });
      toast.error(`Failed to join stream: ${error.message || 'Unknown error'}`, { id: 'join' });
    } finally {
      setIsConnecting(false);
    }
  }, [isConnecting, isConnected, channelParam]);

  // Auto-connect when component mounts
  useEffect(() => {
    if (channelParam) {
      initializeConnection();
    } else {
      toast.error('No channel specified');
      navigate('/lobby');
    }
  }, [channelParam, initializeConnection, navigate]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (isConnected) {
        agoraService.disconnect();
      }
    };
  }, [isConnected]);

  // Auto-hide overlay after timeout (host only - audience keeps overlay visible)
  useEffect(() => {
    // Don't auto-hide overlay for audience - they should see it until manually closed
    // if (overlayVisible && currentProduct) {
    //   const timer = setTimeout(() => {
    //     setOverlayVisible(false);
    //   }, CONFIG.OVERLAY_TIMEOUT_MS);

    //   return () => clearTimeout(timer);
    // }
  }, [overlayVisible, currentProduct]);

  const handleLeaveStream = () => {
    if (isConnected) {
      agoraService.disconnect();
    }
    navigate('/lobby');
  };

  if (!channelParam) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-4">No Channel Specified</h1>
          <p className="text-gray-600 mb-6">Please select a channel from the lobby.</p>
          <button onClick={() => navigate('/lobby')} className="btn-primary">
            Browse Channels
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="container mx-auto px-4 py-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 mb-2">
              {channelName.replace(/^shopscribe_/, '').replace(/_/g, ' ')}
            </h1>
            <div className="flex items-center gap-4 text-sm text-gray-600">
              <span>Channel: {channelName}</span>
              {viewerCount > 0 && (
                <span>{viewerCount} viewers</span>
              )}
            </div>
          </div>
          
          <button
            onClick={handleLeaveStream}
            className="btn-secondary"
          >
            Leave
          </button>
        </div>

        {!isConnected ? (
          /* Connection Status */
          <div className="max-w-md mx-auto">
            <div className="card text-center">
              <h2 className="text-xl font-semibold mb-4">
                {isConnecting ? 'Joining Stream...' : 'Connection Error'}
              </h2>
              <p className="text-gray-600 mb-6">
                {isConnecting 
                  ? 'Please wait while we connect you to the stream.'
                  : 'Unable to connect to the stream. Please try again.'
                }
              </p>
              {!isConnecting && (
                <button
                  onClick={initializeConnection}
                  className="btn-primary w-full"
                >
                  Try Again
                </button>
              )}
            </div>
          </div>
        ) : (
          /* Stream View */
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
            {/* Video Stage */}
            <div className="lg:col-span-3">
              <div className="aspect-video">
            <VideoStage showLoading={!isConnected} mode="remote">
              <ProductOverlay
                product={currentProduct}
                visible={overlayVisible}
                onClose={() => setOverlayVisible(false)}
                isHost={false}
              />
            </VideoStage>
              </div>
            </div>

            {/* Sidebar */}
            <div className="lg:col-span-1 space-y-6">
              {/* Product History */}
              <ProductHistory
                products={productHistory}
                isHost={false}
              />
              
              {/* Live Transcript */}
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
                <h3 className="text-lg font-semibold text-gray-900 mb-3">Live Transcript</h3>
                <div className="bg-gray-50 rounded-lg p-3 max-h-64 overflow-y-auto">
                  <p className="text-sm text-gray-700 whitespace-pre-wrap">
                    {transcript || 'Waiting for stream to start...'}
                  </p>
                </div>
              </div>

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
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
