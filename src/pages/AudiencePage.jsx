import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import { CONFIG } from '../services/config';
import agoraService from '../services/agoraService';
import { parseProductTags, isProductDisplayable } from '../utils/product-sync';
import { cleanSubtitleText } from '../utils/subtitle-clean';
import VideoStage from '../components/VideoStage';
import ProductOverlay from '../components/ProductOverlay';

export default function AudiencePage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  
  // State management
  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [currentProduct, setCurrentProduct] = useState(null);
  const [overlayVisible, setOverlayVisible] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [channelName, setChannelName] = useState('');
  const [viewerCount, setViewerCount] = useState(0);

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

      const uid = Math.floor(Math.random() * 1000000) + 1000;
      
      // Initialize clients
      const initialized = await agoraService.initializeClients(appId, uid);
      if (!initialized) {
        throw new Error('Failed to initialize Agora clients');
      }

      // Join RTC channel as audience
      const rtcJoined = await agoraService.joinAsAudience(channelParam, uid);
      if (!rtcJoined) {
        throw new Error('Failed to join RTC channel as audience');
      }

      // Join RTM channel
      await agoraService.joinSignalingChannel(channelParam);

      // Set up transcription listener
      agoraService.onAgentResponse((chatHistory) => {
        console.log('🎯 Audience received agent response:', chatHistory);
        if (chatHistory && chatHistory.length > 0) {
          const latestMessage = chatHistory[chatHistory.length - 1];
          console.log('🎯 Latest message:', latestMessage);
          if (latestMessage && latestMessage.data) {
            const text = latestMessage.data.text || '';
            console.log('🎯 Message text:', text);
            
            // Parse product tags
            const productData = parseProductTags(text);
            console.log('🎯 Parsed product data:', productData);
            if (isProductDisplayable(productData)) {
              setCurrentProduct(productData);
              setOverlayVisible(true);
            }
            
            // Update transcript with cleaned text
            const cleanedText = cleanSubtitleText(text);
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

      // Set up user count tracking
      agoraService.onMemberJoined = (memberId) => {
        setViewerCount(prev => prev + 1);
      };

      agoraService.onMemberLeft = (memberId) => {
        setViewerCount(prev => Math.max(0, prev - 1));
      };

      setIsConnected(true);
      toast.success('Joined stream successfully!', { id: 'join' });
      
    } catch (error) {
      console.error('Connection error:', error);
      toast.error(`Failed to join stream: ${error.message}`, { id: 'join' });
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

  // Auto-hide overlay after timeout
  useEffect(() => {
    if (overlayVisible && currentProduct) {
      const timer = setTimeout(() => {
        setOverlayVisible(false);
      }, CONFIG.OVERLAY_TIMEOUT_MS);

      return () => clearTimeout(timer);
    }
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
              />
            </VideoStage>
              </div>
            </div>

            {/* Sidebar */}
            <div className="lg:col-span-1">
              {/* Live Transcript */}
              <div className="card">
                <h3 className="text-lg font-semibold mb-3">Live Transcript</h3>
                <div className="bg-gray-50 rounded-lg p-3 max-h-64 overflow-y-auto">
                  <p className="text-sm text-gray-700 whitespace-pre-wrap">
                    {transcript || 'Waiting for stream to start...'}
                  </p>
                </div>
              </div>

              {/* Stream Info */}
              <div className="card mt-4">
                <h3 className="text-lg font-semibold mb-3">Stream Info</h3>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-600">Channel:</span>
                    <span className="font-medium">{channelName}</span>
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
