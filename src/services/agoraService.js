import ConversationalAIAPI from './conversationalAIAPI';
import { CONFIG } from './config';

// RTC and RTM SDKs are loaded via CDN and available globally
// We'll use wait functions to ensure they're loaded before using them

// Function to wait for RTC SDK to load
const waitForAgoraRTC = () => {
  return new Promise((resolve, reject) => {
    const maxAttempts = 100;
    let attempts = 0;
    
    const checkRTC = () => {
      attempts++;
      console.log(`🔍 Attempt ${attempts}: Checking for AgoraRTC...`);
      
      if (window.AgoraRTC && typeof window.AgoraRTC.createClient === 'function') {
        console.log('✅ AgoraRTC loaded successfully');
        resolve(window.AgoraRTC);
      } else if (attempts >= maxAttempts) {
        console.error('❌ AgoraRTC failed to load after 100 attempts');
        console.error('Available window properties:', Object.keys(window).filter(key => key.includes('Agora')));
        reject(new Error('AgoraRTC failed to load after 100 attempts'));
      } else {
        setTimeout(checkRTC, 200);
      }
    };
    
    checkRTC();
  });
};

// Function to wait for RTM SDK to load
const waitForAgoraRTM = () => {
  return new Promise((resolve, reject) => {
    const maxAttempts = 100;
    let attempts = 0;
    
    const checkRTM = () => {
      attempts++;
      console.log(`🔍 Attempt ${attempts}: Checking for AgoraRTM...`);
      
      if (window.AgoraRTM) {
        console.log('🔍 AgoraRTM object found:', window.AgoraRTM);
        console.log('🔍 AgoraRTM properties:', Object.getOwnPropertyNames(window.AgoraRTM));
        
        // Check for different possible RTM SDK structures
        if (typeof window.AgoraRTM.createInstance === 'function') {
          console.log('✅ AgoraRTM.createInstance found');
          resolve(window.AgoraRTM);
        } else if (window.AgoraRTM.default && typeof window.AgoraRTM.default.createInstance === 'function') {
          console.log('✅ AgoraRTM.default.createInstance found');
          resolve(window.AgoraRTM.default);
        } else if (typeof window.AgoraRTM === 'function') {
          console.log('✅ AgoraRTM is a function (constructor)');
          resolve(window.AgoraRTM);
        } else if (window.AgoraRTM.RTM && typeof window.AgoraRTM.RTM === 'function') {
          console.log('✅ AgoraRTM.RTM found (RTM v2.x structure)');
          resolve(window.AgoraRTM.RTM);
        } else {
          console.log('🔍 AgoraRTM structure:', typeof window.AgoraRTM, window.AgoraRTM);
          if (attempts >= maxAttempts) {
            console.error('❌ AgoraRTM failed to load after 100 attempts');
            console.error('Available window properties:', Object.keys(window).filter(key => key.includes('Agora')));
            reject(new Error('AgoraRTM failed to load after 100 attempts'));
          } else {
            setTimeout(checkRTM, 200);
          }
        }
      } else if (attempts >= maxAttempts) {
        console.error('❌ AgoraRTM failed to load after 100 attempts');
        console.error('Available window properties:', Object.keys(window).filter(key => key.includes('Agora')));
        reject(new Error('AgoraRTM failed to load after 100 attempts'));
      } else {
        setTimeout(checkRTM, 200);
      }
    };
    
    checkRTM();
  });
};

class AgoraService {
  constructor() {
    this.baseUrl = process.env.REACT_APP_API_URL || '';
    this.currentAgentId = null;
    this.currentChannelName = null;
    this.customUID = null;
    this.isConnected = false;
    this.rtcEngine = null;
    this.rtmClient = null;
    this.rtmChannel = null;
    this.localAudioTrack = null;
    this.remoteAudioTrack = null;
    this.remoteVideoTrack = null;
    this.conversationalAI = new ConversationalAIAPI();
    this.videoElementMonitor = null;
  }

  // Initialize RTC and Signaling clients
  async initializeClients(appId, uid) {
    console.log('🔍 InitializeClients: Starting initialization...');
    console.log('🔍 InitializeClients: RTC Engine exists:', !!this.rtcEngine);
    console.log('🔍 InitializeClients: RTM Client exists:', !!this.rtmClient);
    console.log('🔍 InitializeClients: _initializing flag:', this._initializing);
    
    // Prevent multiple initializations - check if already initializing
    if (this._initializing) {
      console.log('🔍 Clients already initializing, waiting...');
      // Wait for the current initialization to complete
      while (this._initializing) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
      return true;
    }

    // Prevent multiple initializations
    if (this.rtcEngine && this.rtmClient) {
      console.log('🔍 Clients already initialized, skipping...');
      console.log('🔍 RTC Engine exists:', !!this.rtcEngine);
      console.log('🔍 RTM Client exists:', !!this.rtmClient);
      console.log('🔍 RTM Client UID:', this.rtmClient?.userId);
      return true;
    }

    // Set initialization flag
    this._initializing = true;

    try {
      // Wait for both SDKs to load
      const [AgoraRTCInstance, AgoraRTMInstance] = await Promise.all([
        waitForAgoraRTC(),
        waitForAgoraRTM()
      ]);
      
      console.log('🔍 AgoraRTC loaded successfully:', typeof AgoraRTCInstance);
      console.log('🔍 AgoraRTM loaded successfully:', typeof AgoraRTMInstance);
      console.log('🔍 AgoraRTM.createInstance:', typeof AgoraRTMInstance.createInstance);
      
      // Store SDK instances for later use
      this.agoraRTC = AgoraRTCInstance;
      this.agoraRTM = AgoraRTMInstance;
      
      // Initialize RTC Engine - using live mode for host/audience roles with VP9 codec
      this.rtcEngine = AgoraRTCInstance.createClient({ mode: 'live', codec: 'vp9' });
      console.log('✅ RTC client created:', this.rtcEngine);
      console.log('🔍 RTC engine stored in this.rtcEngine:', !!this.rtcEngine);
      
      // Also set log level on the client instance
      if (this.rtcEngine.setLogLevel) {
        this.rtcEngine.setLogLevel(0);
        console.log('🔍 RTC client log level set to DEBUG (0)');
      }
      
      // Enable ALL Agora RTC logs for debugging - most verbose level
      AgoraRTCInstance.setLogLevel(0); // 0 = DEBUG (most verbose)
      AgoraRTCInstance.enableLogUpload(); // Enable log upload for debugging
      console.log('🔍 Agora RTC logs enabled at DEBUG level (0) - most verbose');
      console.log('🔍 Agora RTC log upload enabled');
      
      // Initialize Signaling Client (RTM) - RTM v2.x style (copied from working onboardingbot)
      // Generate unique UID to prevent conflicts - use timestamp + random + process ID
      const clientUid = uid || Date.now() + Math.floor(Math.random() * 10000) + Math.floor(Math.random() * 1000);
      console.log('🔍 Creating RTM client with UID:', clientUid);
      console.log('🔍 RTM UID type:', typeof clientUid);
      console.log('🔍 RTM UID generation timestamp:', Date.now());
      
      this.rtmClient = new AgoraRTMInstance(appId.trim(), clientUid.toString(), {
        token: null, // No token for testing
        logUpload: false,
        logLevel: 'INFO' // Use INFO level like onboardingbot
      });
      
      console.log('✅ RTM v2.x client created:', this.rtmClient);
      console.log('🔍 RTM client UID after creation:', this.rtmClient.userId);
      console.log('🔍 RTM client rtmImpl UID:', this.rtmClient.rtmImpl?.userId);
      console.log('🔍 RTM client methods:', Object.getOwnPropertyNames(this.rtmClient));
      console.log('🔍 RTM client prototype methods:', Object.getOwnPropertyNames(Object.getPrototypeOf(this.rtmClient)));
      console.log('🔍 RTM client createChannel:', typeof this.rtmClient.createChannel);
      console.log('🔍 RTM client rtmImpl:', this.rtmClient.rtmImpl);
      console.log('🔍 RTM client rtmImpl methods:', this.rtmClient.rtmImpl ? Object.getOwnPropertyNames(this.rtmClient.rtmImpl) : 'undefined');
      
      // Check available RTM methods
      console.log('🔍 Available RTM client methods:', Object.getOwnPropertyNames(this.rtmClient));
      console.log('🔍 Available rtmImpl methods:', this.rtmClient.rtmImpl ? Object.getOwnPropertyNames(this.rtmClient.rtmImpl) : 'undefined');
      
      // Look for channel-related methods
      const channelMethods = Object.getOwnPropertyNames(this.rtmClient).filter(method => 
        method.toLowerCase().includes('channel') || method.toLowerCase().includes('join')
      );
      console.log('🔍 Channel-related methods on RTM client:', channelMethods);
      
      const rtmImplChannelMethods = this.rtmClient.rtmImpl ? 
        Object.getOwnPropertyNames(this.rtmClient.rtmImpl).filter(method => 
          method.toLowerCase().includes('channel') || method.toLowerCase().includes('join')
        ) : [];
      console.log('🔍 Channel-related methods on rtmImpl:', rtmImplChannelMethods);
      
      // Login to RTM - this is required for product functionality
      console.log('🔍 Logging into RTM...');
      console.log('🔍 RTM client connection state before login:', this.rtmClient.connectionState);
      
      // Check if already logged in to prevent login loops
      if (this.rtmClient.connectionState === 'CONNECTED') {
        console.log('✅ RTM already logged in, skipping login');
      } else {
        await this.rtmClient.login({token: null});
        console.log('✅ RTM login successful');
      }
      console.log('🔍 RTM client connection state after login:', this.rtmClient.connectionState);
      
      // Initialize ConversationalAIAPI using the proper init method
      this.conversationalAI = ConversationalAIAPI.init({
        rtcEngine: this.rtcEngine,
        rtmEngine: this.rtmClient,
        renderMode: 'text',
        enableLog: true,
        expectedAgentId: '8888'
      });
      console.log('✅ ConversationalAIAPI initialized successfully');
      
      console.log('✅ RTC, Signaling, and ConversationalAI clients initialized');
      console.log('🔍 InitializeClients: Final state - RTC Engine:', !!this.rtcEngine, 'RTM Client:', !!this.rtmClient);
      return true;
    } catch (error) {
      console.error('❌ Error initializing clients:', error);
      console.error('❌ InitializeClients: Error details:', error.message, error.stack);
      return false;
    } finally {
      // Clear initialization flag
      this._initializing = false;
      console.log('🔍 InitializeClients: Cleared _initializing flag');
    }
  }

  // Join as host
  async joinAsHost(channelName, uid, token = null) {
    if (!this.rtcEngine) {
      throw new Error('RTC Engine not initialized');
    }

    // Check if already connected to a channel
    if (this.rtcEngine.connectionState === 'CONNECTED' || this.rtcEngine.connectionState === 'CONNECTING') {
      console.log('🔍 RTC client already connected/connecting, skipping join...');
      return true;
    }

    try {
      const appId = window.REACT_APP_AGORA_APP_ID || process.env.REACT_APP_AGORA_APP_ID || 'your_agora_app_id';
      
      console.log('🏠 Joining as host to channel:', channelName, 'with UID:', uid);
      console.log('🏠 RTC client mode:', this.rtcEngine.mode);
      
      // Store the channel name for later use (critical for endStream)
      this.currentChannelName = channelName;
      console.log('🏠 Stored current channel name:', this.currentChannelName);
      
      // Attach listeners BEFORE joining to catch early events
      console.log('🏠 Setting up RTC event listeners (pre-join)...');
      this.setupRTCEventListeners();
      
      // Join channel first
      await this.rtcEngine.join(appId, channelName, token || null, uid);
      console.log(`✅ Joined RTC channel: ${channelName} with UID: ${uid}`);
      
      // Set client role to host
      console.log('🏠 Setting client role to host...');
      await this.rtcEngine.setClientRole('host');
      console.log('✅ Set client role to host');
      console.log('🏠 Current client role:', this.rtcEngine.role);
      
      return true;
    } catch (error) {
      console.error('❌ Error joining as host:', error);
      return false;
    }
  }

  // Join as audience
  async joinAsAudience(channelName, uid, token = null) {
    if (!this.rtcEngine) {
      throw new Error('RTC Engine not initialized');
    }

    // Check if already connected to a channel
    if (this.rtcEngine.connectionState === 'CONNECTED' || this.rtcEngine.connectionState === 'CONNECTING') {
      console.log('🔍 RTC client already connected/connecting, skipping join...');
      return true;
    }

    try {
      const appId = window.REACT_APP_AGORA_APP_ID || process.env.REACT_APP_AGORA_APP_ID || 'your_agora_app_id';
      
      console.log('👥 Joining as audience to channel:', channelName, 'with UID:', uid);
      console.log('👥 RTC client mode:', this.rtcEngine.mode);
      
      // Store the channel name for later use
      this.currentChannelName = channelName;
      console.log('👥 Stored current channel name:', this.currentChannelName);
      
      // Attach listeners BEFORE joining to catch early events
      console.log('👥 Setting up RTC event listeners (pre-join)...');
      this.setupRTCEventListeners();
      
      // Join channel first
      await this.rtcEngine.join(appId, channelName, token || null, uid);
      console.log(`✅ Joined RTC channel: ${channelName} with UID: ${uid}`);
      
      // Set client role to audience
      console.log('👥 Setting client role to audience...');
      await this.rtcEngine.setClientRole('audience');
      console.log('✅ Set client role to audience');
      console.log('👥 Current client role:', this.rtcEngine.role);
      
      // Check for existing published tracks (host might have already published)
      console.log('👥 Checking for existing published tracks...');
      console.log('👥 RTC engine state:', {
        connectionState: this.rtcEngine.connectionState,
        role: this.rtcEngine.role,
        mode: this.rtcEngine.mode
      });
      
      try {
        // Get remote users who have already published
        const remoteUsers = this.rtcEngine.remoteUsers || [];
        console.log('👥 Found remote users:', remoteUsers.length);
        console.log('👥 Remote users details:', remoteUsers.map(user => ({
          uid: user.uid,
          hasVideo: !!user.videoTrack,
          hasAudio: !!user.audioTrack,
          videoTrack: user.videoTrack,
          audioTrack: user.audioTrack
        })));
        
        for (const user of remoteUsers) {
          console.log('👥 Processing user:', user.uid, 'hasVideo:', !!user.videoTrack, 'hasAudio:', !!user.audioTrack);
          
          if (user.videoTrack) {
            console.log('👥 Found existing video track for user:', user.uid);
            console.log('👥 Video track details:', user.videoTrack);
            const videoResult = await this.subscribeToVideo(user);
            console.log('👥 Video subscription result:', videoResult);
          }
          if (user.audioTrack) {
            console.log('👥 Found existing audio track for user:', user.uid);
            console.log('👥 Audio track details:', user.audioTrack);
            const audioResult = await this.subscribeToAudio(user);
            console.log('👥 Audio subscription result:', audioResult);
          }
        }
      } catch (error) {
        console.log('👥 Error checking existing tracks:', error);
      }
      
      return true;
    } catch (error) {
      console.error('❌ Error joining as audience:', error);
      return false;
    }
  }

  // Legacy method for backward compatibility
  async joinRTCChannel(channelName, uid, token = null) {
    return this.joinAsHost(channelName, uid, token);
  }

  // Join Signaling channel
  async joinSignalingChannel(channelName) {
    if (!this.rtmClient) {
      throw new Error('RTM client not initialized - this is required for product functionality');
    }

    try {
      console.log('📡 Joining RTM channel:', channelName);
      
      // RTM v2.x doesn't use createChannel - it uses direct channel joining
      // The ConversationalAIAPI handles the RTM channel joining internally
      console.log('📡 RTM v2.x - ConversationalAIAPI handles channel joining internally');
      console.log(`✅ RTM channel ${channelName} will be handled by ConversationalAIAPI`);
      
      // Store the channel name for reference
      this.rtmChannel = { channelName };
      console.log('📡 Stored RTM channel name in this.rtmChannel');
      
      // RTM v2.x event listeners are handled by ConversationalAIAPI
      console.log('📡 RTM event listeners will be handled by ConversationalAIAPI');
      
      return this.rtmChannel;
    } catch (error) {
      console.error('❌ Error joining Signaling channel:', error);
      throw error; // Re-throw to ensure proper error handling
    }
  }

  // Send RTM message
  async sendRTMMessage(channel, message, type = 'text') {
    if (!channel) {
      throw new Error('Channel not available');
    }

    try {
      const messageData = {
        type,
        content: message,
        timestamp: Date.now(),
        sender: 'user'
      };

      await channel.sendMessage({ text: JSON.stringify(messageData) });
      console.log('✅ RTM message sent:', messageData);
      return true;
    } catch (error) {
      console.error('❌ Error sending RTM message:', error);
      return false;
    }
  }

  // Send message to Agora agent via ConversationalAIAPI
  async sendMessageToAgent(message) {
    if (!this.conversationalAI.isReady()) {
      throw new Error('ConversationalAIAPI not ready');
    }

    try {
      const result = await this.conversationalAI.chat('8888', { 
        messageType: 'TEXT',
        text: message 
      });
      console.log('✅ Message sent to agent:', message);
      return result;
    } catch (error) {
      console.error('❌ Error sending message to agent:', error);
      throw error;
    }
  }

  // Subscribe to agent responses
  onAgentResponse(callback) {
    console.log('🔗 Setting up onAgentResponse callback');
    // Set up the event listener on the CovSubRenderController instance, not the main ConversationalAIAPI instance
    this.conversationalAI.covSubRenderController.on('transcription-updated', callback);
    console.log('🔗 Event listener registered for transcription-updated');
  }

  // Subscribe to user transcriptions
  onUserTranscription(callback) {
    this.conversationalAI.on('transcription-updated', callback);
  }

  // Send image via RTM
  async sendRTMImage(channel, imageData) {
    if (!channel) {
      throw new Error('Channel not available');
    }

    try {
      const messageData = {
        type: 'image',
        content: imageData,
        timestamp: Date.now(),
        sender: 'user'
      };

      await channel.sendMessage({ text: JSON.stringify(messageData) });
      console.log('✅ RTM image sent');
      return true;
    } catch (error) {
      console.error('❌ Error sending RTM image:', error);
      return false;
    }
  }

  // Start video element monitoring
  startVideoElementMonitoring() {
    if (this.videoElementMonitor) {
      clearInterval(this.videoElementMonitor);
    }
    
    console.log('🔍 Starting video element monitoring...');
    this.videoElementMonitor = setInterval(() => {
      this.checkVideoElements();
    }, 2000); // Check every 2 seconds
  }
  
  // Stop video element monitoring
  stopVideoElementMonitoring() {
    if (this.videoElementMonitor) {
      clearInterval(this.videoElementMonitor);
      this.videoElementMonitor = null;
      console.log('🔍 Stopped video element monitoring');
    }
  }
  
  // Check video elements status
  checkVideoElements() {
    const remotePlayerElement = document.getElementById('remote-player');
    const localPlayerElement = document.getElementById('local-player');
    
    if (remotePlayerElement) {
      const remoteVideos = remotePlayerElement.querySelectorAll('video');
      const remoteCanvases = remotePlayerElement.querySelectorAll('canvas');
      const remoteAgoraElements = remotePlayerElement.querySelectorAll('.agora_video_player');
      
      if (remoteVideos.length > 0 || remoteCanvases.length > 0 || remoteAgoraElements.length > 0) {
        console.log('🔍 Remote video elements found:', {
          videos: remoteVideos.length,
          canvases: remoteCanvases.length,
          agoraElements: remoteAgoraElements.length,
          total: remotePlayerElement.children.length
        });
      } else if (this.remoteVideoTrack && this.remoteVideoTrack.isPlaying) {
        console.warn('⚠️ Remote video track is playing but no video elements found in DOM');
      }
    }
    
    if (localPlayerElement) {
      const localVideos = localPlayerElement.querySelectorAll('video');
      const localCanvases = localPlayerElement.querySelectorAll('canvas');
      const localAgoraElements = localPlayerElement.querySelectorAll('.agora_video_player');
      
      if (localVideos.length > 0 || localCanvases.length > 0 || localAgoraElements.length > 0) {
        console.log('🔍 Local video elements found:', {
          videos: localVideos.length,
          canvases: localCanvases.length,
          agoraElements: localAgoraElements.length,
          total: localPlayerElement.children.length
        });
      } else if (this.localVideoTrack && this.localVideoTrack.isPlaying) {
        console.warn('⚠️ Local video track is playing but no video elements found in DOM');
      }
    }
  }

  // Helper: Ensure unique container exists for a UID
  ensureContainer(id) {
    let el = document.getElementById(id);
    if (!el) {
      el = document.createElement('div');
      el.id = id;
      Object.assign(el.style, { 
        position: 'absolute', 
        inset: '0',
        width: '100%',
        height: '100%'
      });
      
      // Try to append to video-stage first, then fallback to remote-player
      const videoStage = document.getElementById('video-stage');
      const remotePlayer = document.getElementById('remote-player');
      const parent = videoStage || remotePlayer;
      
      if (parent) {
        parent.appendChild(el);
        console.log(`✅ Created container: ${id} in ${parent.id}`);
      } else {
        console.error(`❌ No parent container found for: ${id}`);
        console.log('🔍 Available elements:', {
          videoStage: !!videoStage,
          remotePlayer: !!remotePlayer,
          body: !!document.body
        });
        
        // Fallback: append to body temporarily and hide it
        if (document.body) {
          el.style.display = 'none'; // Hide while in wrong parent
          document.body.appendChild(el);
          console.log(`⚠️ Created container: ${id} in body (fallback, hidden)`);
        }
      }
    }
    return el;
  }

  // Helper: Remove container by ID
  removeContainer(id) {
    const el = document.getElementById(id);
    if (el && el.parentNode) {
      el.parentNode.removeChild(el);
      console.log(`✅ Removed container: ${id}`);
    }
  }

  // Helper: Play video when DOM is ready and sized
  playWhenReady(videoTrack, elementId) {
    const tryPlay = () => {
      const el = document.getElementById(elementId);
      if (!el) {
        console.log(`⏳ Container not mounted yet: ${elementId}`);
        return false;
      }
      
      // Check if container is in the right parent and move if needed
      const videoStage = document.getElementById('video-stage');
      const remotePlayer = document.getElementById('remote-player');
      const correctParent = videoStage || remotePlayer;
      
      if (correctParent && el.parentNode !== correctParent) {
        console.log(`🔄 Moving container ${elementId} to correct parent`);
        correctParent.appendChild(el);
        el.style.display = ''; // Show the container now that it's in the right place
        console.log(`✅ Container ${elementId} now visible in correct parent`);
      }
      
      const rect = el.getBoundingClientRect();
      if (rect.width < 2 || rect.height < 2) {
        console.log(`⏳ Container has zero size: ${elementId} (${rect.width}x${rect.height})`);
        return false;
      }
      
      try {
        videoTrack.play(el);
        console.log(`✅ [AUD] playing ${elementId} (${rect.width}x${rect.height})`);
        return true;
      } catch (error) {
        console.error(`❌ Error playing video in ${elementId}:`, error);
        return false;
      }
    };
    
    if (tryPlay()) return;
    
    let tries = 0;
    const maxTries = 30; // ~3 seconds
    const interval = setInterval(() => {
      tries++;
      if (tryPlay() || tries >= maxTries) {
        clearInterval(interval);
        if (tries >= maxTries) {
          console.error(`❌ Failed to play video in ${elementId} after ${maxTries} attempts`);
        }
      }
    }, 100);
  }

  // Set up RTC event listeners
  setupRTCEventListeners() {
    if (!this.rtcEngine) {
      console.log('❌ setupRTCEventListeners: No RTC engine available');
      return;
    }

    console.log('🔧 Setting up RTC event listeners on engine:', this.rtcEngine);
    console.log('🔧 RTC engine connection state:', this.rtcEngine.connectionState);
    console.log('🔧 RTC engine role:', this.rtcEngine.role);
    console.log('🔧 RTC engine events:', this.rtcEngine._events ? Object.keys(this.rtcEngine._events) : 'no events');
    
    // Start video element monitoring
    this.startVideoElementMonitoring();

    // Handle connection state changes
    this.rtcEngine.on('connection-state-change', (cur, prev, reason) => {
      console.log('🔗 [RTC] state change', { prev, cur, reason });
      
      // Handle UID_BANNED event - user was kicked from channel
      if (reason === 'UID_BANNED') {
        console.log('🚫 User was banned from channel');
        // Trigger custom event for components to handle
        if (this.onUserBanned) {
          this.onUserBanned({ prev, cur, reason });
        }
      }
    });

    // Handle user published
    this.rtcEngine.on('user-published', async (user, mediaType) => {
      console.log('👤 [AUD] user-published', user.uid, mediaType);
      console.log('👤 User object:', user);
      console.log('👤 Media type:', mediaType);
      console.log('👤 Current client role:', this.rtcEngine.role);
      console.log('👤 RTC connection state:', this.rtcEngine.connectionState);
      console.log('👤 User video track:', user.videoTrack);
      console.log('👤 User audio track:', user.audioTrack);
      
      // Store the remote user for potential control
      this.remoteUser = user;
      
      if (mediaType === 'audio') {
        console.log('🎵 Subscribing to audio...');
        await this.rtcEngine.subscribe(user, 'audio');
        console.log('🎵 [AUD] subscribed', user.uid, 'audio');
        
        if (user.audioTrack) {
          user.audioTrack.play();
          console.log('🎵 Audio track playing');
        }
      } else if (mediaType === 'video') {
        console.log('📺 Subscribing to video...');
        await this.rtcEngine.subscribe(user, 'video');
        console.log('📺 [AUD] subscribed', user.uid, 'video');
        
        if (user.videoTrack) {
          const elId = `remote-player-${user.uid}`;
          this.ensureContainer(elId);
          
          // Try the unique container approach first
          this.playWhenReady(user.videoTrack, elId);
          
          // Fallback: if unique container fails, try the original remote-player
          setTimeout(() => {
            const uniqueContainer = document.getElementById(elId);
            if (uniqueContainer && uniqueContainer.children.length === 0) {
              console.log(`🔄 Fallback: Using original remote-player for ${user.uid}`);
              const remotePlayer = document.getElementById('remote-player');
              if (remotePlayer) {
                user.videoTrack.play(remotePlayer);
                console.log(`✅ [AUD] playing in remote-player (fallback)`);
              }
            }
          }, 2000);
        }
      }
    });

    // Handle user unpublished
    this.rtcEngine.on('user-unpublished', (user, mediaType) => {
      console.log('👤 [AUD] user-unpublished', user.uid, mediaType);
      
      // Only stop tracks for the specific media type that was unpublished
      if (mediaType === 'audio' && this.remoteAudioTrack && user.uid === this.remoteAudioTrack.getUserId()) {
        console.log('🎵 Stopping audio track for user:', user.uid);
        this.remoteAudioTrack.stop();
        this.remoteAudioTrack = null;
      }
      
      if (mediaType === 'video' && this.remoteVideoTrack && user.uid === this.remoteVideoTrack.getUserId()) {
        console.log('📺 Stopping video track for user:', user.uid);
        this.remoteVideoTrack.stop();
        this.remoteVideoTrack = null;
        
        // Clean up the unique container
        const elId = `remote-player-${user.uid}`;
        this.removeContainer(elId);
      }
    });
  }

  // Set up Signaling event listeners
  setupSignalingEventListeners(channel) {
    if (!channel) {
      console.log('❌ setupSignalingEventListeners: No channel provided');
      return;
    }

    console.log('🔧 Setting up RTM event listeners on channel:', channel);
    console.log('🔧 Channel name:', channel.channelName);

    // Handle channel messages
    channel.on('ChannelMessage', (message, memberId) => {
      console.log('📨 Received channel message:', message, 'from:', memberId);
      
      // Parse message data
      try {
        const data = JSON.parse(message.text);
        this.handleChannelMessage(data, memberId);
      } catch (error) {
        console.error('Error parsing channel message:', error);
      }
    });

    // Handle member joined
    channel.on('MemberJoined', (memberId) => {
      console.log('👤 Member joined:', memberId);
      this.onMemberJoined?.(memberId);
    });

    // Handle member left
    channel.on('MemberLeft', (memberId) => {
      console.log('👤 Member left:', memberId);
      this.onMemberLeft?.(memberId);
    });
  }

  // Handle different types of channel messages
  handleChannelMessage(data, memberId) {
    switch (data.type) {
      case 'agent_response':
        this.onAgentResponse?.(data);
        break;
      case 'agent_audio':
        this.onAgentAudio?.(data);
        break;
      case 'agent_video':
        this.onAgentVideo?.(data);
        break;
      case 'transcription':
        this.onTranscription?.(data);
        break;
      case 'avatar_stream':
        this.onAvatarStream?.(data);
        break;
      case 'system_message':
        this.onSystemMessage?.(data);
        break;
      default:
        console.log('Unknown message type:', data.type);
    }
  }

  // Subscribe to remote audio
  async subscribeToAudio(user) {
    if (!this.rtcEngine || !user) return false;
    
    try {
      await this.rtcEngine.subscribe(user, 'audio');
      console.log('✅ Subscribed to remote audio');
      
      this.remoteAudioTrack = user.audioTrack;
      this.remoteAudioTrack.play();
      return true;
    } catch (error) {
      console.error('❌ Error subscribing to audio:', error);
      return false;
    }
  }

  // Subscribe to remote video
  async subscribeToVideo(user) {
    if (!this.rtcEngine || !user) {
      console.log('❌ subscribeToVideo: Missing RTC engine or user');
      return false;
    }
    
    console.log('🎥 subscribeToVideo: Starting subscription for user:', user.uid);
    console.log('🎥 subscribeToVideo: User video track:', user.videoTrack);
    console.log('🎥 subscribeToVideo: RTC engine state:', {
      connectionState: this.rtcEngine.connectionState,
      role: this.rtcEngine.role,
      mode: this.rtcEngine.mode
    });
    
    try {
      console.log('🎥 subscribeToVideo: Calling rtcEngine.subscribe...');
      await this.rtcEngine.subscribe(user, 'video');
      console.log('✅ subscribeToVideo: Successfully subscribed to remote video');
      
      this.remoteVideoTrack = user.videoTrack;
      console.log('🎥 subscribeToVideo: Set remoteVideoTrack:', this.remoteVideoTrack);
      
      // Check if video track is valid
      if (!this.remoteVideoTrack) {
        console.error('❌ subscribeToVideo: No video track available');
        return false;
      }
      
      console.log('🎥 subscribeToVideo: Video track properties:', {
        internalTrackId: this.remoteVideoTrack._trackId,
        enabled: this.remoteVideoTrack.enabled,
        muted: this.remoteVideoTrack.muted,
        isPlaying: this.remoteVideoTrack.isPlaying,
        mediaStreamTrack: this.remoteVideoTrack._mediaStreamTrack,
        hasPlay: typeof this.remoteVideoTrack.play === 'function',
        trackType: this.remoteVideoTrack.trackType,
        trackId: this.remoteVideoTrack.trackId,
        uid: this.remoteVideoTrack.uid,
        userId: this.remoteVideoTrack.userId
      });
      
      // Check if the video track has a media stream
      if (this.remoteVideoTrack._mediaStreamTrack) {
        console.log('🎥 subscribeToVideo: Media stream track details:', {
          id: this.remoteVideoTrack._mediaStreamTrack.id,
          kind: this.remoteVideoTrack._mediaStreamTrack.kind,
          label: this.remoteVideoTrack._mediaStreamTrack.label,
          enabled: this.remoteVideoTrack._mediaStreamTrack.enabled,
          muted: this.remoteVideoTrack._mediaStreamTrack.muted,
          readyState: this.remoteVideoTrack._mediaStreamTrack.readyState
        });
      } else {
        console.warn('⚠️ subscribeToVideo: No media stream track found');
      }
      
      console.log('🎥 subscribeToVideo: Playing video in remote-player...');
      
      // Check if play method exists
      if (typeof this.remoteVideoTrack.play !== 'function') {
        console.error('❌ subscribeToVideo: Video track does not have play method');
        return false;
      }
      
      // Enhanced video element creation with fallback
      const ensureVideoElement = async (attempt = 1, maxAttempts = 10) => {
        try {
          console.log(`🎥 subscribeToVideo: Video element creation attempt ${attempt}/${maxAttempts}`);
          
          // Check if target element exists
          const remotePlayerElement = document.getElementById('remote-player');
          if (!remotePlayerElement) {
            console.error(`❌ subscribeToVideo: Remote player element not found on attempt ${attempt}`);
            if (attempt < maxAttempts) {
              console.log(`🔄 subscribeToVideo: Retrying in 300ms...`);
              setTimeout(() => ensureVideoElement(attempt + 1, maxAttempts), 300);
              return false;
            } else {
              console.error('❌ subscribeToVideo: Max retry attempts reached, remote player element still not found');
              return false;
            }
          }
          
          // Clear any existing content to ensure clean state
          if (attempt === 1) {
            remotePlayerElement.innerHTML = '';
            console.log('🎥 subscribeToVideo: Cleared remote player element for clean start');
          }
          
          // Try to play the video
          console.log('🎥 subscribeToVideo: Calling play on video track...');
          this.remoteVideoTrack.play('remote-player');
          console.log(`✅ subscribeToVideo: Video play call successful on attempt ${attempt}`);
          
          // Wait for video element to be created
          await new Promise(resolve => setTimeout(resolve, 500));
          
          // Check for video element creation
          const videoElement = remotePlayerElement.querySelector('video') || 
                             remotePlayerElement.querySelector('canvas') ||
                             remotePlayerElement.querySelector('.agora_video_player') ||
                             remotePlayerElement.firstElementChild;
          
          if (videoElement) {
            console.log(`✅ subscribeToVideo: Video element found after attempt ${attempt}:`, {
              tagName: videoElement.tagName,
              className: videoElement.className,
              id: videoElement.id,
              videoWidth: videoElement.videoWidth || 'N/A',
              videoHeight: videoElement.videoHeight || 'N/A',
              readyState: videoElement.readyState || 'N/A',
              paused: videoElement.paused || 'N/A',
              currentTime: videoElement.currentTime || 'N/A',
              style: videoElement.style.cssText,
              src: videoElement.src || 'N/A'
            });
            
            // Ensure video element is properly styled
            if (videoElement.tagName === 'VIDEO') {
              videoElement.style.width = '100%';
              videoElement.style.height = '100%';
              videoElement.style.objectFit = 'cover';
              console.log('🎥 subscribeToVideo: Applied video element styling');
            }
            
            return true;
          } else {
            console.warn(`⚠️ subscribeToVideo: No video element found after attempt ${attempt}`);
            console.log(`🎥 subscribeToVideo: Remote player element children:`, remotePlayerElement.children.length);
            console.log(`🎥 subscribeToVideo: Remote player element innerHTML:`, remotePlayerElement.innerHTML);
            
            if (attempt < maxAttempts) {
              console.log(`🔄 subscribeToVideo: Retrying video element creation...`);
              setTimeout(() => ensureVideoElement(attempt + 1, maxAttempts), 500);
              return false;
            } else {
              console.error('❌ subscribeToVideo: Max retry attempts reached, video element creation failed');
              
              // Fallback: Create video element manually
              console.log('🎥 subscribeToVideo: Attempting manual video element creation as fallback...');
              try {
                const fallbackVideo = document.createElement('video');
                fallbackVideo.id = 'fallback-remote-video';
                fallbackVideo.style.width = '100%';
                fallbackVideo.style.height = '100%';
                fallbackVideo.style.objectFit = 'cover';
                fallbackVideo.autoplay = true;
                fallbackVideo.muted = true;
                fallbackVideo.playsInline = true;
                
                // Try to attach the media stream directly
                if (this.remoteVideoTrack._mediaStreamTrack) {
                  fallbackVideo.srcObject = new MediaStream([this.remoteVideoTrack._mediaStreamTrack]);
                  remotePlayerElement.appendChild(fallbackVideo);
                  console.log('✅ subscribeToVideo: Fallback video element created and attached');
                  return true;
                } else {
                  console.error('❌ subscribeToVideo: No media stream track available for fallback');
                  return false;
                }
              } catch (fallbackError) {
                console.error('❌ subscribeToVideo: Fallback video element creation failed:', fallbackError);
                return false;
              }
            }
          }
        } catch (error) {
          console.error(`❌ subscribeToVideo: Video element creation attempt ${attempt} failed:`, error);
          if (attempt < maxAttempts) {
            console.log(`🔄 subscribeToVideo: Retrying in 500ms...`);
            setTimeout(() => ensureVideoElement(attempt + 1, maxAttempts), 500);
            return false;
          } else {
            console.error('❌ subscribeToVideo: Max retry attempts reached, all video element creation attempts failed');
            return false;
          }
        }
      };
      
      // Start the enhanced video element creation process
      const videoElementCreated = await ensureVideoElement();
      
      if (videoElementCreated) {
        console.log('✅ subscribeToVideo: Video element successfully created and playing');
        return true;
      } else {
        console.error('❌ subscribeToVideo: Failed to create video element after all attempts');
        return false;
      }
      
    } catch (error) {
      console.error('❌ subscribeToVideo: Error subscribing to video:', error);
      console.error('❌ subscribeToVideo: Error details:', {
        message: error.message,
        code: error.code,
        stack: error.stack
      });
      return false;
    }
  }

  // Unsubscribe from remote audio
  async unsubscribeFromAudio() {
    if (!this.rtcEngine || !this.remoteUser) return false;
    
    try {
      await this.rtcEngine.unsubscribe(this.remoteUser, 'audio');
      console.log('✅ Unsubscribed from remote audio');
      
      if (this.remoteAudioTrack) {
        this.remoteAudioTrack.stop();
        this.remoteAudioTrack = null;
      }
      return true;
    } catch (error) {
      console.error('❌ Error unsubscribing from audio:', error);
      return false;
    }
  }

  // Toggle audio subscription
  async toggleAudioSubscription(enabled) {
    if (enabled) {
      return await this.subscribeToAudio(this.remoteUser);
    } else {
      return await this.unsubscribeFromAudio();
    }
  }

  // Publish local audio
  async publishAudio() {
    console.log('🎵 publishAudio called, checking RTC engine...');
    console.log('🎵 this.rtcEngine:', this.rtcEngine);
    console.log('🎵 RTC engine exists:', !!this.rtcEngine);
    if (!this.rtcEngine) {
      console.error('❌ RTC Engine not initialized in publishAudio');
      throw new Error('RTC Engine not initialized');
    }

    try {
      console.log('🎵 Creating microphone audio track...');
      this.localAudioTrack = await this.agoraRTC.createMicrophoneAudioTrack();
      console.log('🎵 Microphone audio track created:', this.localAudioTrack);
      
      console.log('🎵 Publishing audio track to RTC engine...');
      console.log('🎵 RTC engine state before publish:', {
        connectionState: this.rtcEngine.connectionState,
        role: this.rtcEngine.role,
        mode: this.rtcEngine.mode
      });
      console.log('🎵 Audio track details:', {
        trackId: this.localAudioTrack._trackId,
        enabled: this.localAudioTrack.enabled,
        muted: this.localAudioTrack.muted
      });
      
      console.log('🎵 About to call rtcEngine.publish() with track:', this.localAudioTrack);
      const publishResult = await this.rtcEngine.publish(this.localAudioTrack);
      console.log('🎵 rtcEngine.publish() result:', publishResult);
      
      console.log('✅ Published local audio track to RTC engine');
      console.log('🎵 RTC engine state after publish:', {
        connectionState: this.rtcEngine.connectionState,
        role: this.rtcEngine.role,
        mode: this.rtcEngine.mode
      });
      
      return true;
    } catch (error) {
      console.error('❌ Error publishing audio:', error);
      
      // Handle permission errors gracefully
      if (error.name === 'NotAllowedError') {
        throw new Error('Microphone access denied. Please allow microphone access and try again.');
      } else if (error.name === 'NotFoundError') {
        throw new Error('No microphone found. Please connect a microphone and try again.');
      } else if (error.name === 'NotReadableError') {
        throw new Error('Microphone is being used by another application. Please close other applications and try again.');
      }
      
      return false;
    }
  }

  // Enable/disable local microphone
  async setMicrophoneEnabled(enabled) {
    if (!this.localAudioTrack) {
      console.warn('⚠️ No local audio track available');
      return false;
    }

    try {
      if (enabled) {
        await this.localAudioTrack.setEnabled(true);
        console.log('✅ Microphone enabled');
      } else {
        await this.localAudioTrack.setEnabled(false);
        console.log('✅ Microphone disabled');
      }
      return true;
    } catch (error) {
      console.error('❌ Error toggling microphone:', error);
      return false;
    }
  }

  // Enable/disable local video
  async setVideoEnabled(enabled) {
    if (!this.localVideoTrack) {
      console.warn('⚠️ No local video track available');
      return false;
    }

    try {
      await this.localVideoTrack.setEnabled(enabled);
      console.log(`✅ Video ${enabled ? 'enabled' : 'disabled'}`);
      return true;
    } catch (error) {
      console.error('❌ Error toggling video:', error);
      return false;
    }
  }

  // Get microphone enabled state
  isMicrophoneEnabled() {
    return this.localAudioTrack ? this.localAudioTrack.enabled : false;
  }

  // Toggle microphone
  async toggleMicrophone() {
    const currentState = this.isMicrophoneEnabled();
    return await this.setMicrophoneEnabled(!currentState);
  }

  // Publish local video
  async publishVideo() {
    if (!this.rtcEngine) {
      throw new Error('RTC Engine not initialized');
    }

    try {
      console.log('🎥 Creating camera video track...');
      this.localVideoTrack = await this.agoraRTC.createCameraVideoTrack();
      console.log('🎥 Camera video track created:', this.localVideoTrack);
      
      console.log('🎥 Publishing video track to RTC engine...');
      console.log('🎥 RTC engine state before publish:', {
        connectionState: this.rtcEngine.connectionState,
        role: this.rtcEngine.role,
        mode: this.rtcEngine.mode
      });
      console.log('🎥 Video track details:', {
        trackId: this.localVideoTrack._trackId,
        enabled: this.localVideoTrack.enabled,
        muted: this.localVideoTrack.muted
      });
      
      console.log('🎥 About to call rtcEngine.publish() with track:', this.localVideoTrack);
      const publishResult = await this.rtcEngine.publish(this.localVideoTrack);
      console.log('🎥 rtcEngine.publish() result:', publishResult);
      
      console.log('✅ [HOST] published audio+video, codec=vp9');
      console.log('🎥 RTC engine state after publish:', {
        connectionState: this.rtcEngine.connectionState,
        role: this.rtcEngine.role,
        mode: this.rtcEngine.mode
      });
      
      // Enhanced local video element creation with retry mechanism
      const ensureLocalVideoElement = async (attempt = 1, maxAttempts = 5) => {
        try {
          console.log(`🎥 publishVideo: Local video element creation attempt ${attempt}/${maxAttempts}`);
          
          // Check if target element exists
          const localPlayerElement = document.getElementById('local-player');
          if (!localPlayerElement) {
            console.error(`❌ publishVideo: Local player element not found on attempt ${attempt}`);
            if (attempt < maxAttempts) {
              console.log(`🔄 publishVideo: Retrying in 300ms...`);
              setTimeout(() => ensureLocalVideoElement(attempt + 1, maxAttempts), 300);
              return false;
            } else {
              console.error('❌ publishVideo: Max retry attempts reached, local player element still not found');
              return false;
            }
          }
          
          // Clear any existing content to ensure clean state
          if (attempt === 1) {
            localPlayerElement.innerHTML = '';
            console.log('🎥 publishVideo: Cleared local player element for clean start');
          }
          
          console.log('🎥 publishVideo: Playing video in local-player element...');
          this.localVideoTrack.play('local-player');
          console.log(`✅ publishVideo: Video play call successful on attempt ${attempt}`);
          
          // Wait for video element to be created
          await new Promise(resolve => setTimeout(resolve, 500));
          
          // Check for video element creation
          const videoElement = localPlayerElement.querySelector('video') || 
                             localPlayerElement.querySelector('canvas') ||
                             localPlayerElement.querySelector('.agora_video_player') ||
                             localPlayerElement.firstElementChild;
          
          if (videoElement) {
            console.log(`✅ publishVideo: Local video element found after attempt ${attempt}:`, {
              tagName: videoElement.tagName,
              className: videoElement.className,
              id: videoElement.id,
              videoWidth: videoElement.videoWidth || 'N/A',
              videoHeight: videoElement.videoHeight || 'N/A',
              readyState: videoElement.readyState || 'N/A',
              paused: videoElement.paused || 'N/A',
              currentTime: videoElement.currentTime || 'N/A',
              style: videoElement.style.cssText,
              src: videoElement.src || 'N/A'
            });
            
            // Ensure video element is properly styled
            if (videoElement.tagName === 'VIDEO') {
              videoElement.style.width = '100%';
              videoElement.style.height = '100%';
              videoElement.style.objectFit = 'cover';
              console.log('🎥 publishVideo: Applied local video element styling');
            }
            
            return true;
          } else {
            console.warn(`⚠️ publishVideo: No local video element found after attempt ${attempt}`);
            console.log(`🎥 publishVideo: Local player element children:`, localPlayerElement.children.length);
            console.log(`🎥 publishVideo: Local player element innerHTML:`, localPlayerElement.innerHTML);
            
            if (attempt < maxAttempts) {
              console.log(`🔄 publishVideo: Retrying local video element creation...`);
              setTimeout(() => ensureLocalVideoElement(attempt + 1, maxAttempts), 500);
              return false;
            } else {
              console.error('❌ publishVideo: Max retry attempts reached, local video element creation failed');
              return false;
            }
          }
        } catch (error) {
          console.error(`❌ publishVideo: Local video element creation attempt ${attempt} failed:`, error);
          if (attempt < maxAttempts) {
            console.log(`🔄 publishVideo: Retrying in 500ms...`);
            setTimeout(() => ensureLocalVideoElement(attempt + 1, maxAttempts), 500);
            return false;
          } else {
            console.error('❌ publishVideo: Max retry attempts reached, all local video element creation attempts failed');
            return false;
          }
        }
      };
      
      // Start the enhanced local video element creation process
      const localVideoElementCreated = await ensureLocalVideoElement();
      
      if (localVideoElementCreated) {
        console.log('✅ publishVideo: Local video element successfully created and playing');
        return true;
      } else {
        console.error('❌ publishVideo: Failed to create local video element after all attempts');
        return false;
      }
      
    } catch (error) {
      console.error('❌ Error publishing video:', error);
      
      // Handle permission errors gracefully
      if (error.name === 'NotAllowedError') {
        throw new Error('Camera access denied. Please allow camera access and try again.');
      } else if (error.name === 'NotFoundError') {
        throw new Error('No camera found. Please connect a camera and try again.');
      } else if (error.name === 'NotReadableError') {
        throw new Error('Camera is being used by another application. Please close other applications and try again.');
      }
      
      return false;
    }
  }

  // Publish both audio and video
  async publishMedia() {
    const audioResult = await this.publishAudio();
    const videoResult = await this.publishVideo();
    return audioResult && videoResult;
  }

  // Get available cameras
  async getCameras() {
    try {
      const cameras = await this.agoraRTC.getCameras();
      return cameras;
    } catch (error) {
      console.error('❌ Error getting cameras:', error);
      return [];
    }
  }

  // Get available microphones
  async getMicrophones() {
    try {
      const microphones = await this.agoraRTC.getMicrophones();
      return microphones;
    } catch (error) {
      console.error('❌ Error getting microphones:', error);
      return [];
    }
  }

  // Create camera track with specific device
  async createCameraVideoTrack(deviceId = null) {
    try {
      const config = {};
      if (deviceId) {
        config.cameraId = deviceId;
      }
      return await this.agoraRTC.createCameraVideoTrack(config);
    } catch (error) {
      console.error('❌ Error creating camera track:', error);
      throw error;
    }
  }

  // Create microphone track with specific device
  async createMicrophoneAudioTrack(deviceId = null) {
    try {
      const config = {};
      if (deviceId) {
        config.microphoneId = deviceId;
      }
      return await this.agoraRTC.createMicrophoneAudioTrack(config);
    } catch (error) {
      console.error('❌ Error creating microphone track:', error);
      throw error;
    }
  }

  // Health check to ensure Netlify functions are ready
  async healthCheck() {
    try {
      const response = await fetch('/api/health', {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`Health check failed with status: ${response.status}`);
      }

      const data = await response.json();
      console.log('✅ Health check passed:', data);
      return true;
    } catch (error) {
      console.error('❌ Health check failed:', error);
      return false;
    }
  }

  // Create an Agora agent via direct Agora REST API
  async createAgent(channelName, agentUid, clientUid, prompt, profileContext = null) {
    const maxRetries = 3;
    let lastError;
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        console.log(`🔗 Creating real Agora agent via REST API... (attempt ${attempt}/${maxRetries})`);
        console.log('🔗 Channel:', channelName);
        console.log('🔗 Agent UID:', agentUid);
        console.log('🔗 Client UID:', clientUid);
        console.log('🔗 Profile Context:', profileContext);
        
        // Call Netlify Function to create Agora agent
        console.log('🔗 Creating Agora agent via Netlify Function...');
        
        const response = await fetch('/.netlify/functions/agora-agents', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            channelName,
            agentUid,
            clientUid,
            prompt,
            profileContext
          }),
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || 'Failed to create agent');
        }

        const data = await response.json();
        console.log('✅ Agora agent created via Netlify Function:', data);
        
        // Check if the response has the expected structure
        if (!data.success || !data.data) {
          throw new Error('Invalid Netlify Function response format');
        }
        
        // The Netlify Function returns { success: true, data: agent }
        // where agent is the Agora API response with agent_id
        const agentData = data.data;
        // console.log('🔍 Agent data from Netlify Function:', agentData);
        
        if (!agentData.agent_id) {
          throw new Error('No agent_id in Netlify Function response');
        }
        
        // Store current agent info
        this.currentAgentId = agentData.agent_id;
        this.currentChannelName = channelName;
        this.isConnected = true;
        
        return {
          agentId: agentData.agent_id,
          status: agentData.status,
          createTs: agentData.create_ts
        };
      } catch (error) {
        lastError = error;
        console.error(`❌ Error creating Agora agent (attempt ${attempt}/${maxRetries}):`, error);
        
        // If it's a connection error and we have retries left, wait and try again
        if (attempt < maxRetries && (error.message.includes('Failed to fetch') || error.message.includes('ERR_CONNECTION_REFUSED'))) {
          console.log(`⏳ Waiting 2 seconds before retry...`);
          await new Promise(resolve => setTimeout(resolve, 2000));
          continue;
        }
        
        // If it's not a connection error or we're out of retries, throw immediately
        throw error;
      }
    }
    
    // If we get here, all retries failed
    throw lastError;
  }

                // Send text message to agent via Netlify Function
              async sendTextMessage(text, priority = 'INTERRUPT', interruptable = true) {
                if (!this.currentAgentId) {
                  throw new Error('No active agent. Please create an agent first.');
                }

                try {
                  const response = await fetch(`/api/agora/agents/chat`, {
                    method: 'POST',
                    headers: {
                      'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                      agentId: this.currentAgentId,
                      messageType: 'text',
                      text,
                      priority,
                      interruptable,
                      uuid: `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
                    }),
                  });

                  if (!response.ok) {
                    const errorData = await response.json();
                    throw new Error(errorData.error || 'Failed to send text message');
                  }

                  const data = await response.json();
                  console.log('✅ Text message sent:', data);
                  return data.data;
                } catch (error) {
                  console.error('❌ Error sending text message:', error);
                  throw error;
                }
              }

              // Send image message to agent via chat API
              async sendImageMessage(imageUrl, uuid = null) {
                if (!this.currentAgentId) {
                  throw new Error('No active agent. Please create an agent first.');
                }

                const messageUuid = uuid || `img_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

                try {
                  const response = await fetch(`/api/agora/agents/chat`, {
                    method: 'POST',
                    headers: {
                      'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                      agentId: this.currentAgentId,
                      messageType: 'image',
                      url: imageUrl,
                      uuid: messageUuid
                    }),
                  });

                  if (!response.ok) {
                    const errorData = await response.json();
                    throw new Error(errorData.error || 'Failed to send image message');
                  }

                  const data = await response.json();
                  console.log('✅ Image message sent:', data);
                  return data.data;
                } catch (error) {
                  console.error('❌ Error sending image message:', error);
                  throw error;
                }
              }

              // Legacy method for backward compatibility
              async sendBroadcastMessage(text, priority = 'INTERRUPT', interruptable = true) {
                return this.sendTextMessage(text, priority, interruptable);
              }

  // Interrupt agent
  async interruptAgent(agentId = null) {
    const agentToInterrupt = agentId || this.currentAgentId;
    if (!agentToInterrupt) {
      throw new Error('No agent to interrupt');
    }

    try {
      const response = await fetch(`/api/agora/agents/interrupt`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ agentId: agentToInterrupt }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to interrupt agent');
      }

      const data = await response.json();
      console.log('✅ Agent interrupted:', data);
      return data.data;
    } catch (error) {
      console.error('❌ Error interrupting agent:', error);
      throw error;
    }
  }

  // Stop agent
  async stopAgent(agentId = null) {
    const agentToStop = agentId || this.currentAgentId;
    if (!agentToStop) {
      console.warn('No agent to stop');
      return;
    }

    try {
      console.log(`🛑 Attempting to stop agent: ${agentToStop}`);
      
      const response = await fetch(`/.netlify/functions/agora-agents-stop`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ agentId: agentToStop }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        console.warn('⚠️ Agent stop API failed:', errorData.error || 'Failed to stop agent');
        // Don't throw, just log the warning
      } else {
        const data = await response.json();
        console.log('✅ Agora agent stopped:', data);
      }
      
      // Always clear current agent info regardless of API success
      if (agentId === this.currentAgentId || !agentId) {
        this.currentAgentId = null;
        this.currentChannelName = null;
        this.isConnected = false;
      }
      
      return { success: true };
    } catch (error) {
      console.warn('⚠️ Error stopping Agora agent (continuing anyway):', error.message);
      // Always clear current agent info even if there's an error
      if (agentId === this.currentAgentId || !agentId) {
        this.currentAgentId = null;
        this.currentChannelName = null;
        this.isConnected = false;
      }
      return { success: true }; // Don't throw, just return success
    }
  }

  // Leave RTC channel
  async leaveRTCChannel() {
    console.log('🔄 LeaveRTCChannel: Starting to leave RTC channel...');
    if (!this.rtcEngine) {
      console.log('🔄 LeaveRTCChannel: No RTC engine available, skipping');
      return;
    }

    try {
      // Stop video element monitoring
      this.stopVideoElementMonitoring();
      
      // Clean up local tracks
      if (this.localAudioTrack) {
        this.localAudioTrack.close();
        this.localAudioTrack = null;
      }
      
      if (this.localVideoTrack) {
        this.localVideoTrack.close();
        this.localVideoTrack = null;
      }
      
      // Clean up remote tracks
      if (this.remoteAudioTrack) {
        this.remoteAudioTrack.close();
        this.remoteAudioTrack = null;
      }
      
      if (this.remoteVideoTrack) {
        this.remoteVideoTrack.close();
        this.remoteVideoTrack = null;
      }
      
      // Clean up video elements with enhanced cleanup
      const remotePlayerElement = document.getElementById('remote-player');
      if (remotePlayerElement) {
        // Stop any playing videos before clearing
        const remoteVideos = remotePlayerElement.querySelectorAll('video');
        remoteVideos.forEach(video => {
          try {
            video.pause();
            video.srcObject = null;
            video.src = '';
          } catch (error) {
            console.warn('⚠️ Error stopping remote video:', error);
          }
        });
        remotePlayerElement.innerHTML = '';
        console.log('✅ Cleaned up remote video elements');
      }
      
      const localPlayerElement = document.getElementById('local-player');
      if (localPlayerElement) {
        // Stop any playing videos before clearing
        const localVideos = localPlayerElement.querySelectorAll('video');
        localVideos.forEach(video => {
          try {
            video.pause();
            video.srcObject = null;
            video.src = '';
          } catch (error) {
            console.warn('⚠️ Error stopping local video:', error);
          }
        });
        localPlayerElement.innerHTML = '';
        console.log('✅ Cleaned up local video elements');
      }
      
      await this.rtcEngine.leave();
      console.log('✅ LeaveRTCChannel: Successfully left RTC channel');
      return true;
    } catch (error) {
      console.error('❌ LeaveRTCChannel: Error leaving RTC channel:', error);
      return false;
    }
  }

  // Leave Signaling channel
  async leaveSignalingChannel() {
    console.log('🔄 LeaveSignalingChannel: Starting to leave RTM channel...');
    if (!this.rtmClient) {
      console.log('🔄 LeaveSignalingChannel: No RTM client available, skipping');
      return;
    }

    try {
      await this.rtmClient.logout();
      console.log('✅ LeaveSignalingChannel: Successfully left RTM channel');
      return true;
    } catch (error) {
      console.error('❌ LeaveSignalingChannel: Error leaving RTM channel:', error);
      return false;
    }
  }

  // Complete disconnect (for audience leaving)
  async disconnect() {
    try {
      console.log('🔄 Disconnect: Starting disconnect process...');
      console.log('🔄 Disconnect: RTC Engine exists:', !!this.rtcEngine);
      console.log('🔄 Disconnect: RTM Client exists:', !!this.rtmClient);
      
      await this.leaveRTCChannel();
      console.log('🔄 Disconnect: Left RTC channel');
      
      await this.leaveSignalingChannel();
      console.log('🔄 Disconnect: Left RTM channel');
      
      this.rtcEngine = null;
      this.rtmClient = null;
      this.rtmChannel = null;
      this.localAudioTrack = null;
      this.remoteAudioTrack = null;
      this.remoteVideoTrack = null;
      this.currentAgentId = null;
      this.currentChannelName = null;
      this.isConnected = false;
      
      console.log('✅ Disconnected from all channels');
    } catch (error) {
      console.error('❌ Error disconnecting:', error);
    }
  }

  // Ban all users from channel (for host ending session)
  async banAllUsersFromChannel(channelName) {
    try {
      console.log('🚫 Banning all users from channel:', channelName);
      console.log('🚫 Ban request payload:', { channelName });
      
      const response = await fetch('/.netlify/functions/agora-ban-users', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          channelName: channelName
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to ban users from channel');
      }

      const data = await response.json();
      console.log('✅ Users banned from channel:', data);
      return data.data;
    } catch (error) {
      console.error('❌ Error banning users from channel:', error);
      throw error;
    }
  }

  // End stream (for host - stops agent, leaves channel, then kicks remaining users)
  async endStream(fallbackChannelName = null) {
    try {
      // First unsubscribe from conversational AI to stop live updates
      if (this.conversationalAI) {
        await this.conversationalAI.unsubscribe();
        console.log('✅ Unsubscribed from conversational AI');
      }
      
      // Try to stop the agent, but don't fail if it doesn't work
      try {
        await this.stopAgent();
      } catch (agentError) {
        console.warn('⚠️ Agent stop failed, but continuing:', agentError.message);
      }
      
      // Store channel name before leaving
      let channelName = this.currentChannelName;
      console.log('🏁 EndStream: Stored channel name for ban:', channelName);
      console.log('🏁 EndStream: Current channel name property:', this.currentChannelName);
      
      // Fallback: if currentChannelName is null, try to get it from the RTC engine or parameter
      if (!channelName && this.rtcEngine && this.rtcEngine.channelName) {
        channelName = this.rtcEngine.channelName;
        console.log('🏁 EndStream: Using fallback channel name from RTC engine:', channelName);
      }
      
      // Final fallback: use the parameter if provided
      if (!channelName && fallbackChannelName) {
        channelName = fallbackChannelName;
        console.log('🏁 EndStream: Using fallback channel name from parameter:', channelName);
      }
      
      // Leave RTC and RTM channels first (host leaves the channel)
      console.log('🏁 EndStream: Leaving RTC channel...');
      await this.leaveRTCChannel();
      console.log('🏁 EndStream: Leaving RTM channel...');
      await this.leaveSignalingChannel();
      console.log('🏁 EndStream: Successfully left all channels');
      
      // Now ban all remaining users from the channel (after host has left)
      if (channelName) {
        console.log('🏁 EndStream: Banning users from channel:', channelName);
        try {
          await this.banAllUsersFromChannel(channelName);
          console.log('✅ All remaining users kicked from channel:', channelName);
        } catch (banError) {
          console.warn('⚠️ Failed to kick users from channel, but continuing:', banError.message);
          console.warn('⚠️ Ban error details:', banError);
        }
      } else {
        console.error('❌ EndStream: No channel name available for banning users!');
        console.error('❌ EndStream: this.currentChannelName was:', this.currentChannelName);
      }
      
      // Clean up all references
      this.rtcEngine = null;
      this.rtmClient = null;
      this.rtmChannel = null;
      this.localAudioTrack = null;
      this.remoteAudioTrack = null;
      this.remoteVideoTrack = null;
      this.currentAgentId = null;
      this.currentChannelName = null;
      this.isConnected = false;
      
      console.log('✅ Stream ended successfully');
    } catch (error) {
      console.error('❌ Error ending stream:', error);
    }
  }

  // Get current agent info
  getCurrentAgent() {
    return {
      agentId: this.currentAgentId,
      channelName: this.currentChannelName,
      isConnected: this.isConnected
    };
  }

  // Get Agora configuration status
  async getConfigStatus() {
    try {
      const response = await fetch(`${this.baseUrl}/api/agora/config`);

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to get config status');
      }

      const data = await response.json();
      return data.data;
    } catch (error) {
      console.error('❌ Error getting config status:', error);
      throw error;
    }
  }

  // Generate onboarding prompt - use the comprehensive prompt from agora-agents.mjs
  generateOnboardingPrompt(currentTopic, completedTopics) {
    // Return null to let the Netlify function use its own comprehensive prompt
    // The Netlify function has the complete prompt with all marker rules
    return null;
  }

  // Set custom channel name for host
  setCustomChannelName(channelName) {
    if (this.isConnected) {
      console.warn('⚠️ Cannot change channel name while connected');
      return false;
    }
    
    // Validate channel name
    if (!channelName || channelName.length === 0) {
      console.error('❌ Channel name cannot be empty');
      return false;
    }
    
    if (channelName.length > CONFIG.MAX_CHANNEL_NAME_LENGTH) {
      console.error(`❌ Channel name too long (max ${CONFIG.MAX_CHANNEL_NAME_LENGTH} characters)`);
      return false;
    }
    
    // Sanitize channel name (remove invalid characters)
    const sanitizedChannelName = channelName
      .replace(/[^a-zA-Z0-9_]/g, '_')
      .substring(0, CONFIG.MAX_CHANNEL_NAME_LENGTH);
    
    this.currentChannelName = sanitizedChannelName;
    console.log(`✅ Custom channel name set: ${sanitizedChannelName}`);
    return true;
  }

  // Set custom UID for host
  setCustomUID(uid) {
    if (this.isConnected) {
      console.warn('⚠️ Cannot change UID while connected');
      return false;
    }
    
    // Validate UID (must be integer)
    if (!Number.isInteger(uid) || uid <= 0) {
      console.error('❌ UID must be a positive integer');
      return false;
    }
    
    this.customUID = uid;
    console.log(`✅ Custom UID set: ${uid}`);
    return true;
  }

}

const agoraService = new AgoraService();
export default agoraService; 