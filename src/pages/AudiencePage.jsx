import React, { useState, useEffect, useCallback, useRef } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import toast from "react-hot-toast";
import { CONFIG } from "../services/config";
import agoraService from "../services/agoraService";
import {
  parseProductTags,
  isProductDisplayable,
  stripTags,
} from "../utils/product-sync";
import {
  getProductHistory,
  addProductToHistory,
} from "../utils/productHistory";
import productHistoryRTM from "../services/productHistoryRTM";
import VideoStage from "../components/VideoStage";
import ProductOverlay from "../components/ProductOverlay";
import ProductHistory from "../components/ProductHistory";
import ChannelBar from "../components/ChannelBar";
import { clearAllProductHistory } from "../utils/productHistory";

export default function AudiencePage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  // State management
  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [videoState, setVideoState] = useState('loading'); // 'loading', 'ready', 'muted'
  const [currentProduct, setCurrentProduct] = useState(null);
  const [overlayVisible, setOverlayVisible] = useState(false);
  const [productHistory, setProductHistory] = useState([]);
  const [transcript, setTranscript] = useState("");
  const [channelName, setChannelName] = useState("");
  const [viewerCount, setViewerCount] = useState(0);
  const [hostCount, setHostCount] = useState(0);
  const [showSessionEndedModal, setShowSessionEndedModal] = useState(false);
  const [wasBanned, setWasBanned] = useState(false);

  // Store UID to prevent multiple initializations with different UIDs
  const uidRef = useRef(null);

  // Load product history when channel name changes
  useEffect(() => {
    if (channelName) {
      // Load from local storage first (fast)
      const localHistory = getProductHistory(channelName);
      setProductHistory(localHistory);
      console.log(
        "📚 Loaded local product history for channel:",
        channelName,
        "with",
        localHistory.length,
        "products",
      );
    }
  }, [channelName]);

  // Listen for RTM product history updates
  useEffect(() => {
    const handleProductHistoryUpdate = (products) => {
      console.log(
        "📚 AudiencePage: RTM product history updated:",
        products.length,
        "products",
      );
      console.log(
        "📚 AudiencePage: Updated products:",
        products.map((p) => ({ name: p.product_name, id: p.id })),
      );
      setProductHistory(products);
    };

    console.log("📚 AudiencePage: Adding RTM product history listener");
    productHistoryRTM.addListener(handleProductHistoryUpdate);

    return () => {
      console.log("📚 AudiencePage: Removing RTM product history listener");
      productHistoryRTM.removeListener(handleProductHistoryUpdate);
    };
  }, []);

  // Fetch host/viewer counts
  const fetchHostInfo = async (channelName) => {
    try {
      const response = await fetch(
        `/.netlify/functions/agora-hosts?channel=${encodeURIComponent(channelName)}`,
      );
      if (response.ok) {
        const data = await response.json();
        console.log("📊 Audience: Host info received:", data);

        // Handle nested data structure
        const hostInfo = data.data || data;
        console.log("📊 Audience: Parsed host info:", hostInfo);

        setHostCount(hostInfo.hostCount || 0);
        setViewerCount(hostInfo.viewerCount || 0);
      }
    } catch (error) {
      console.error("❌ Audience: Error fetching host info:", error);
    }
  };

  // Get channel from URL params
  const channelParam = searchParams.get("channel");

  // Initialize connection
  const initializeConnection = useCallback(async () => {
    if (isConnecting || isConnected || !channelParam || wasBanned) return;

    setIsConnecting(true);
    toast.loading("Joining stream...", { id: "join" });

    try {
      setChannelName(channelParam);

      // Initialize Agora clients
      const appId = CONFIG.AGORA_APP_ID;
      if (!appId) {
        throw new Error("Agora App ID not configured");
      }

      // Use consistent UID - only generate once
      if (!uidRef.current) {
        uidRef.current = Math.floor(Math.random() * 1000000) + 1000;
      }
      const uid = uidRef.current;
      console.log("🎯 Audience: Using UID:", uid);

      // Initialize clients
      const initialized = await agoraService.initializeClients(appId, uid);
      if (!initialized) {
        throw new Error("Failed to initialize Agora clients");
      }

      // Join RTC channel as audience
      console.log("🏠 AudiencePage: About to call joinAsAudience with:", {
        channelName,
        uid,
      });
      const rtcJoined = await agoraService.joinAsAudience(channelParam, uid, null, {
        onHostPublished: () => {
          setVideoState('ready');
        },
        onHostUnpublished: () => {
          setVideoState('muted');
        }
      });
      console.log("🏠 AudiencePage: joinAsAudience result:", rtcJoined);
      if (!rtcJoined) {
        throw new Error("Failed to join RTC channel as audience");
      }

      // Join RTM channel
      await agoraService.joinSignalingChannel(channelParam);

      // Initialize RTM product history service
      try {
        console.log(
          "📚 AudiencePage: About to initialize RTM product history service...",
        );
        console.log(
          "📚 AudiencePage: RTM client available:",
          !!agoraService.rtmClient,
        );
        console.log(
          "📚 AudiencePage: RTM client connection state:",
          agoraService.rtmClient?.connectionState,
        );
        console.log("📚 AudiencePage: Channel param:", channelParam);

        const loadedProducts = await productHistoryRTM.initialize(
          agoraService.rtmClient,
          channelParam,
          agoraService.rtcEngine._config.role
        );
        console.log("📚 AudiencePage: RTM product history service initialized");
        console.log(
          "📚 AudiencePage: Loaded products from RTM:",
          loadedProducts?.length || 0,
        );
        console.log(
          "📚 AudiencePage: First loaded product:",
          loadedProducts?.[0],
        );

        // Update the product history state with loaded products
        if (loadedProducts && loadedProducts.length > 0) {
          setProductHistory(loadedProducts);
          console.log(
            "📚 AudiencePage: Updated product history state with",
            loadedProducts.length,
            "products",
          );
        }
      } catch (error) {
        console.error(
          "📚 AudiencePage: Failed to initialize RTM product history service:",
          error,
        );
        console.error("📚 AudiencePage: Error details:", {
          message: error.message,
          code: error.code,
          name: error.name,
        });
      }

      // CRITICAL: Subscribe to RTM messages like the host does
      console.log("🎯 Audience: Subscribing to RTM messages like host...");
      try {
        await agoraService.conversationalAI.subscribeMessage(channelParam);
        console.log("🎯 Audience: RTM message subscription complete");
      } catch (rtmError) {
        console.error("❌ Audience: RTM subscription failed:", rtmError);
        console.error("❌ RTM Error details:", {
          message: rtmError.message,
          code: rtmError.code,
          name: rtmError.name,
        });
        // Don't throw here - continue with RTC functionality
        console.log("⚠️ Audience: Continuing without RTM subscription");
      }

      // Set up transcription listener with enhanced debugging
      console.log("🎯 Audience: Setting up agent response listener...");
      agoraService.onAgentResponse((chatHistory) => {
        console.log("🎯 Audience received agent response:", chatHistory);
        console.log("🎯 Audience chatHistory length:", chatHistory?.length);
        console.log("🎯 Audience chatHistory type:", typeof chatHistory);
        console.log(
          "🎯 Audience chatHistory isArray:",
          Array.isArray(chatHistory),
        );

        if (chatHistory && chatHistory.length > 0) {
          const latestMessage = chatHistory[chatHistory.length - 1];
          console.log("🎯 Audience latest message:", latestMessage);
          console.log("🎯 Audience latest message type:", typeof latestMessage);
          console.log(
            "🎯 Audience latest message keys:",
            latestMessage ? Object.keys(latestMessage) : "null",
          );

          if (latestMessage && latestMessage.data) {
            const text = latestMessage.data.text || "";
            console.log("🎯 Audience message text:", text);
            console.log("🎯 Audience message text length:", text.length);

            // Parse product tags
            const productData = parseProductTags(text);
            console.log("🎯 Audience parsed product data:", productData);
            console.log(
              "🎯 Audience is product displayable?",
              isProductDisplayable(productData),
            );

            if (isProductDisplayable(productData)) {
              console.log(
                "🎯 Audience: Setting current product and showing overlay",
              );
              setCurrentProduct(productData);
              setOverlayVisible(true);

              // Add to product history with RTM storage
              productHistoryRTM
                .addProduct(productData)
                .then((updatedHistory) => {
                  setProductHistory(updatedHistory);
                  console.log(
                    "🎯 Audience: Product added to history, new history length:",
                    updatedHistory.length,
                  );
                })
                .catch((error) => {
                  console.error(
                    "🎯 Audience: Failed to add product to RTM history:",
                    error,
                  );
                  // Fallback to local storage
                  const localHistory = addProductToHistory(
                    channelName,
                    productData,
                  );
                  setProductHistory(localHistory);
                });
            } else {
              console.log(
                "🎯 Audience: Product not displayable, skipping overlay",
              );
            }

            // Update transcript with cleaned text (strip tags for display)
            const cleanedText = stripTags(text);
            setTranscript(cleanedText);
            console.log("🎯 Audience: Transcript updated with:", cleanedText);
          } else {
            console.log("🎯 Audience: No data in latest message");
            console.log(
              "🎯 Audience: latestMessage.data:",
              latestMessage?.data,
            );
          }
        } else {
          console.log("🎯 Audience: No chat history or empty array");
        }
      });

      // Add debug event listeners
      agoraService.conversationalAI.on("debug-log", (message) => {
        console.log("🔍 AI Debug:", message);
      });

      // Add fallback RTM message listener for agent responses
      console.log("🎯 Audience: Setting up RTM message fallback listener...");
      console.log(
        "🎯 Audience: agoraService.rtmChannel:",
        agoraService.rtmChannel,
      );
      console.log(
        "🎯 Audience: agoraService.rtmChannel type:",
        typeof agoraService.rtmChannel,
      );

      if (
        agoraService.rtmChannel &&
        typeof agoraService.rtmChannel.on === "function"
      ) {
        console.log("🎯 Audience: RTM channel available, setting up listener");
        agoraService.rtmChannel.on("ChannelMessage", (message, memberId) => {
          console.log(
            "🎯 Audience RTM fallback: Received message:",
            message,
            "from:",
            memberId,
          );
          if (message && message.text) {
            console.log(
              "🎯 Audience RTM fallback: Message text:",
              message.text,
            );

            // Parse product tags from RTM message
            const productData = parseProductTags(message.text);
            console.log(
              "🎯 Audience RTM fallback: Parsed product data:",
              productData,
            );

            if (isProductDisplayable(productData)) {
              console.log(
                "🎯 Audience RTM fallback: Setting product from RTM message",
              );
              setCurrentProduct(productData);
              setOverlayVisible(true);

              // Add to product history
              productHistoryRTM
                .addProduct(productData)
                .then((updatedHistory) => {
                  setProductHistory(updatedHistory);
                })
                .catch((error) => {
                  console.error(
                    "🎯 Audience: Failed to add product to RTM history:",
                    error,
                  );
                  // Fallback to local storage
                  const localHistory = addProductToHistory(
                    channelName,
                    productData,
                  );
                  setProductHistory(localHistory);
                });
            }

            // Update transcript
            const cleanedText = stripTags(message.text);
            setTranscript(cleanedText);
          }
        });
      } else {
        console.log(
          "⚠️ Audience: RTM channel does not have on method, skipping fallback listener",
        );
        console.log("🔍 RTM channel object:", agoraService.rtmChannel);
      }

      agoraService.conversationalAI.on("agent-error", (agentUserId, error) => {
        console.error("❌ AI Agent Error:", agentUserId, error);
      });

      // Set up user count tracking
      agoraService.onMemberJoined = (memberId) => {
        setViewerCount((prev) => prev + 1);
      };

      agoraService.onMemberLeft = (memberId) => {
        setViewerCount((prev) => Math.max(0, prev - 1));
      };

      // Set up user banned handler
      agoraService.onUserBanned = (connectionState) => {
        console.log("🚫 User was banned from channel:", connectionState);
        console.log("🚫 Ban handler triggered - setting wasBanned to true");
        setWasBanned(true); // Mark as banned to prevent reconnection attempts
        setShowSessionEndedModal(true);
        setIsConnected(false);
        setVideoState('left');
        toast.error("You have been disconnected from the stream", {
          id: "banned",
        });
      };

      setIsConnected(true);
      setVideoState('muted');
      toast.success("Joined stream successfully!", { id: "join" });

      // Fetch host/viewer counts
      await fetchHostInfo(channelParam);
    } catch (error) {
      console.error("Connection error:", error);
      console.error("Error details:", {
        message: error.message,
        stack: error.stack,
        name: error.name,
        code: error.code,
      });
      toast.error(
        `Failed to join stream: ${error.message || "Unknown error"}`,
        { id: "join" },
      );
    } finally {
      setIsConnecting(false);
    }
  }, [isConnecting, isConnected, channelParam, wasBanned]);

  // Auto-connect when component mounts
  useEffect(() => {
    if (channelParam && !wasBanned) {
      initializeConnection();
    } else if (!channelParam) {
      toast.error("No channel specified");
      navigate("/lobby");
    }
  }, [channelParam, initializeConnection, navigate, wasBanned]);

  // Cleanup on unmount only
  useEffect(() => {
    return () => {
      // Only disconnect when component is actually unmounting (leaving the page)
      if (isConnected) {
        agoraService.disconnect();
        setVideoState('loading');
      }
    };
  }, []); // Empty dependency array - only runs on mount/unmount

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
      clearAllProductHistory();

      setVideoState('left');
    }
    // Clean up RTM service
    productHistoryRTM.destroy().catch((error) => {
      console.error("📚 AudiencePage: Error destroying RTM service:", error);
    });
    navigate("/lobby");
  };

  const handleSessionEndedModalClose = () => {
    setShowSessionEndedModal(false);
    setWasBanned(false); // Reset banned state so user can join other channels
    navigate("/lobby");
  };

  // Format channel name for display (same as browse page)
  const formatChannelName = (name) => {
    if (!name) return "Unknown Channel";

    // Handle new custom channel name pattern: UserInput_timestamp_random
    const parts = name.split("_");
    if (parts.length >= 3) {
      // Check if it's the new format (has timestamp and random at the end)
      const lastPart = parts[parts.length - 1];
      const secondLastPart = parts[parts.length - 2];

      // If last two parts look like timestamp and random (6 digits + 3 alphanumeric)
      if (/^\d{6}$/.test(secondLastPart) && /^[a-z0-9]{3}$/.test(lastPart)) {
        // Remove timestamp and random parts, join the rest with spaces
        const nameParts = parts.slice(0, -2);
        return nameParts.join(" ");
      }
    }

    // Handle old ss_host_ pattern
    if (name.startsWith("ss_host_")) {
      const parts = name.split("_");
      if (parts.length >= 3) {
        const hostId = parts[2];
        return `Host ${hostId}`;
      }
    }

    // For other patterns, clean up the name
    return name.replace(/^shopscribe_/, "").replace(/_/g, " ");
  };

  // Handle switching to a different stream
  const handleSwitchStream = async (newChannelName) => {
    try {
      console.log("🔄 Switching from", channelName, "to", newChannelName);

      // Show loading toast
      toast.loading("Switching streams...", { id: "switch" });

      // Store the current ban handler before disconnecting
      const currentBanHandler = agoraService.onUserBanned;

      // Leave current channels (but keep clients alive)
      if (isConnected) {
        console.log("🔄 Stream switch: Leaving current channels...");
        clearAllProductHistory();
        await agoraService.leaveRTCChannel();
        await agoraService.leaveSignalingChannel();
        console.log("🔄 Stream switch: Left current channels");
        setIsConnected(false);
      }

      // Clear product history for new stream (will be loaded when new channel connects)
      setProductHistory([]);
      setCurrentProduct(null);
      setOverlayVisible(false);
      setTranscript("");

      // Reset state
      setIsConnecting(true);
      setChannelName(newChannelName);
      setViewerCount(0);
      setHostCount(0);
      setWasBanned(false);

      // Update URL without page reload
      const newUrl = `/watch?channel=${encodeURIComponent(newChannelName)}`;
      window.history.pushState({}, "", newUrl);

      // Initialize connection to new channel
      const appId = CONFIG.AGORA_APP_ID;
      if (!appId) {
        throw new Error("Agora App ID not configured");
      }

      // Use consistent UID - only generate once
      if (!uidRef.current) {
        uidRef.current = Math.floor(Math.random() * 1000000) + 1000;
      }
      const uid = uidRef.current;
      console.log("🎯 Audience: Using UID for new stream:", uid);

      // Check if clients are available (they should be since we didn't disconnect)
      console.log("🔄 Stream switch: Checking client availability...");
      console.log(
        "🔄 Stream switch: agoraService.rtcEngine available:",
        !!agoraService.rtcEngine,
      );
      console.log(
        "🔄 Stream switch: agoraService.rtmClient available:",
        !!agoraService.rtmClient,
      );

      if (!agoraService.rtcEngine || !agoraService.rtmClient) {
        throw new Error("Agora clients not available - cannot switch streams");
      }

      // Join RTC channel as audience
      const rtcJoined = await agoraService.joinAsAudience(newChannelName, uid);
      if (!rtcJoined) {
        throw new Error("Failed to join RTC channel as audience");
      }

      // Join RTM channel
      await agoraService.joinSignalingChannel(newChannelName);

      // Initialize RTM product history service for new channel
      try {
        await productHistoryRTM.initialize(
          agoraService.rtmClient,
          newChannelName,
          agoraService.rtcEngine._config.role
        );
        console.log(
          "📚 AudiencePage: RTM product history service initialized for new channel",
        );
      } catch (error) {
        console.error(
          "📚 AudiencePage: Failed to initialize RTM product history service for new channel:",
          error,
        );
      }

      // Subscribe to RTM messages for the new channel
      try {
        await agoraService.conversationalAI.subscribeMessage(newChannelName);
        console.log(
          "🎯 Audience: RTM message subscription complete for new stream",
        );
      } catch (rtmError) {
        console.error(
          "❌ Audience: RTM subscription failed for new stream:",
          rtmError,
        );
        console.log("⚠️ Audience: Continuing without RTM subscription");
      }

      // Set up transcription listener
      agoraService.onAgentResponse((chatHistory) => {
        if (chatHistory && chatHistory.length > 0) {
          const latestMessage = chatHistory[chatHistory.length - 1];

          if (latestMessage && latestMessage.data) {
            const text = latestMessage.data.text || "";

            // Parse product tags
            const productData = parseProductTags(text);

            if (isProductDisplayable(productData)) {
              setCurrentProduct(productData);
              setOverlayVisible(true);

              // Add to product history with RTM storage
              productHistoryRTM
                .addProduct(productData)
                .then((updatedHistory) => {
                  setProductHistory(updatedHistory);
                })
                .catch((error) => {
                  console.error(
                    "🎯 Audience: Failed to add product to RTM history:",
                    error,
                  );
                  // Fallback to local storage
                  const localHistory = addProductToHistory(
                    channelName,
                    productData,
                  );
                  setProductHistory(localHistory);
                });
            }

            // Update transcript with cleaned text
            const cleanedText = stripTags(text);
            setTranscript(cleanedText);
          }
        }
      });

      // Set up user count tracking
      agoraService.onMemberJoined = (memberId) => {
        setViewerCount((prev) => prev + 1);
      };

      agoraService.onMemberLeft = (memberId) => {
        setViewerCount((prev) => Math.max(0, prev - 1));
      };

      // Restore the ban handler (this is critical for stream ending detection)
      agoraService.onUserBanned =
        currentBanHandler ||
        ((connectionState) => {
          console.log("🚫 User was banned from channel:", connectionState);
          console.log(
            "🚫 Ban handler triggered (stream switch) - setting wasBanned to true",
          );
          setWasBanned(true);
          setShowSessionEndedModal(true);
          setIsConnected(false);
          setVideoState('left');
          toast.error("You have been disconnected from the stream", {
            id: "banned",
          });
        });

      setIsConnected(true);
      setVideoState('muted');
      setIsConnecting(false);
      toast.success("Switched to new stream!", { id: "switch" });

      // Fetch host/viewer counts for new channel
      await fetchHostInfo(newChannelName);
    } catch (error) {
      console.error("Stream switch error:", error);
      toast.error(
        `Failed to switch streams: ${error.message || "Unknown error"}`,
        { id: "switch" },
      );
      setIsConnecting(false);
    }
  };

  if (!channelParam) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-4">
            No Channel Specified
          </h1>
          <p className="text-gray-600 mb-6">
            Please select a channel from the lobby.
          </p>
          <button onClick={() => navigate("/lobby")} className="btn-primary">
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
              {formatChannelName(channelName)}
            </h1>
            <div className="flex items-center gap-4 text-sm text-gray-600">
              <span>Channel: {channelName}</span>
              {viewerCount > 0 && <span>{viewerCount} viewers</span>}
            </div>
          </div>

          <button onClick={handleLeaveStream} className="btn-secondary">
            Leave
          </button>
        </div>

        {!isConnected ? (
          /* Connection Status */
          <div className="max-w-md mx-auto">
            <div className="card text-center">
              <h2 className="text-xl font-semibold mb-4">
                {isConnecting
                  ? "Joining Stream..."
                  : wasBanned
                    ? "Stream Ended"
                    : "Connection Error"}
              </h2>
              <p className="text-gray-600 mb-6">
                {isConnecting
                  ? "Please wait while we connect you to the stream."
                  : wasBanned
                    ? "The host has ended this stream. You will be redirected to browse other channels."
                    : "Unable to connect to the stream. Please try again."}
              </p>
              {!isConnecting && !wasBanned && (
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
                <VideoStage videoState={videoState} mode="remote">
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
              <ProductHistory products={productHistory} isHost={false} />

              {/* Live Transcript */}
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
                <h3 className="text-lg font-semibold text-gray-900 mb-3">
                  Live Transcript
                </h3>
                <div className="bg-gray-50 rounded-lg p-3 max-h-64 overflow-y-auto">
                  <p className="text-sm text-gray-700 whitespace-pre-wrap">
                    {transcript || "Waiting for stream to start..."}
                  </p>
                </div>
              </div>

              {/* Stream Info */}
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
                <h3 className="text-lg font-semibold text-gray-900 mb-3">
                  Stream Info
                </h3>
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

        {/* Channel Bar - Show other live streams */}
        {isConnected && (
          <ChannelBar
            onJoinChannel={handleSwitchStream}
            currentChannel={channelName}
            className="mt-6"
          />
        )}
      </div>

      {/* Session Ended Modal */}
      {showSessionEndedModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full mx-4 p-6">
            <div className="text-center">
              <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-red-100 mb-4">
                <svg
                  className="h-6 w-6 text-red-600"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z"
                  />
                </svg>
              </div>
              <h3 className="text-lg font-medium text-gray-900 mb-2">
                Stream Ended
              </h3>
              <p className="text-sm text-gray-500 mb-6">
                The host has ended the live stream. You will be redirected to
                the browse page.
              </p>
              <button
                onClick={handleSessionEndedModalClose}
                className="w-full bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
              >
                Return to Browse
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
