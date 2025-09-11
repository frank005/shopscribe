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
  }

  // Initialize RTC and Signaling clients
  async initializeClients(appId, uid) {
    // Prevent multiple initializations
    if (this.rtcEngine && this.rtmClient) {
      console.log('🔍 Clients already initialized, skipping...');
      return true;
    }

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
      
      // Initialize RTC Engine - using live mode for host/audience roles
      this.rtcEngine = AgoraRTCInstance.createClient({ mode: 'live', codec: 'vp8' });
      console.log('✅ RTC client created:', this.rtcEngine);
      console.log('🔍 RTC engine stored in this.rtcEngine:', !!this.rtcEngine);
      
      // Enable all Agora RTC logs for debugging
      AgoraRTCInstance.setLogLevel(0); // DEBUG level
      console.log('🔍 Agora RTC logs enabled at DEBUG level');
      
      // Initialize Signaling Client (RTM) - RTM v2.x style
      const clientUid = uid || Math.floor(Math.random() * 1000000) + 1000;
      console.log('🔍 Creating RTM client with UID:', clientUid);
      // console.log('🔍 RTM App ID being used:', appId);
      // console.log('🔍 RTM App ID length:', appId.length);
      // console.log('🔍 RTM App ID type:', typeof appId);
      // console.log('🔍 RTM App ID hex:', Array.from(appId).map(c => c.charCodeAt(0).toString(16).padStart(2, '0')).join(''));
      // console.log('🔍 RTM App ID trimmed:', appId.trim());
      
      this.rtmClient = new AgoraRTMInstance(appId.trim(), clientUid.toString(), {
        token: null, // No token for testing
        logUpload: false,
        logLevel: 'INFO'
      });
      
      console.log('✅ RTM v2.x client created:', this.rtmClient);
      console.log('🔍 RTM client methods:', Object.getOwnPropertyNames(this.rtmClient));
      console.log('🔍 RTM client prototype methods:', Object.getOwnPropertyNames(Object.getPrototypeOf(this.rtmClient)));
      console.log('🔍 RTM client createChannel:', typeof this.rtmClient.createChannel);
      console.log('🔍 RTM client createStreamChannel:', typeof this.rtmClient.createStreamChannel);
      console.log('🔍 RTM client rtmImpl:', this.rtmClient.rtmImpl);
      console.log('🔍 RTM client rtmImpl methods:', this.rtmClient.rtmImpl ? Object.getOwnPropertyNames(this.rtmClient.rtmImpl) : 'undefined');
      
      // Login to RTM
      console.log('🔍 Logging into RTM...');
      await this.rtmClient.login({token: null});
      console.log('✅ RTM login successful');
      
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
      return true;
    } catch (error) {
      console.error('❌ Error initializing clients:', error);
      return false;
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
      
      // Join channel with host role
      await this.rtcEngine.join(appId, channelName, token || null, uid);
      console.log(`✅ Joined RTC channel: ${channelName} with UID: ${uid}`);
      
      // Set client role to host
      console.log('🏠 Setting client role to host...');
      await this.rtcEngine.setClientRole('host');
      console.log('✅ Set client role to host');
      console.log('🏠 Current client role:', this.rtcEngine.role);
      
      // Set up RTC event listeners
      console.log('🏠 Setting up RTC event listeners...');
      this.setupRTCEventListeners();
      
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
      
      // Join channel with audience role
      await this.rtcEngine.join(appId, channelName, token || null, uid);
      console.log(`✅ Joined RTC channel: ${channelName} with UID: ${uid}`);
      
      // Set client role to audience
      console.log('👥 Setting client role to audience...');
      await this.rtcEngine.setClientRole('audience');
      console.log('✅ Set client role to audience');
      console.log('👥 Current client role:', this.rtcEngine.role);
      
      // Set up RTC event listeners
      console.log('👥 Setting up RTC event listeners...');
      this.setupRTCEventListeners();
      
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
      throw new Error('Signaling client not initialized');
    }

    try {
      console.log('📡 Joining RTM channel:', channelName);
      
      // Try to use createChannel from rtmImpl if available, otherwise use createStreamChannel
      let channel;
      if (this.rtmClient.rtmImpl && typeof this.rtmClient.rtmImpl.createChannel === 'function') {
        console.log('🔍 Using rtmImpl.createChannel');
        channel = this.rtmClient.rtmImpl.createChannel(channelName);
      } else if (typeof this.rtmClient.createChannel === 'function') {
        console.log('🔍 Using rtmClient.createChannel');
        channel = this.rtmClient.createChannel(channelName);
      } else {
        console.log('🔍 Using rtmClient.createStreamChannel');
        channel = this.rtmClient.createStreamChannel(channelName);
      }
      
      console.log('📡 Created RTM channel object:', channel);
      await channel.join();
      
      console.log(`✅ Joined Signaling channel: ${channelName}`);
      
      // Store the channel for later use
      this.rtmChannel = channel;
      console.log('📡 Stored RTM channel in this.rtmChannel');
      
      // Set up Signaling event listeners
      this.setupSignalingEventListeners(channel);
      
      return channel;
    } catch (error) {
      console.error('❌ Error joining Signaling channel:', error);
      return null;
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

  // Set up RTC event listeners
  setupRTCEventListeners() {
    if (!this.rtcEngine) return;

    // Handle user published
    this.rtcEngine.on('user-published', async (user, mediaType) => {
      console.log('👤 User published:', user.uid, mediaType);
      console.log('👤 User object:', user);
      console.log('👤 Media type:', mediaType);
      console.log('👤 Current client role:', this.rtcEngine.role);
      console.log('👤 RTC connection state:', this.rtcEngine.connectionState);
      
      // Store the remote user for potential control
      this.remoteUser = user;
      
      if (mediaType === 'audio') {
        console.log('🎵 Subscribing to audio...');
        // Subscribe to audio by default
        await this.subscribeToAudio(user);
      } else if (mediaType === 'video') {
        console.log('📺 Subscribing to video...');
        console.log('📺 Video track available:', !!user.videoTrack);
        console.log('📺 Video track details:', user.videoTrack);
        // Subscribe to video by default
        await this.subscribeToVideo(user);
      }
    });

    // Handle user unpublished
    this.rtcEngine.on('user-unpublished', (user) => {
      console.log('👤 User unpublished:', user.uid);
      if (this.remoteAudioTrack && user.uid === this.remoteAudioTrack.getUserId()) {
        this.remoteAudioTrack.stop();
        this.remoteAudioTrack = null;
      }
      if (this.remoteVideoTrack && user.uid === this.remoteVideoTrack.getUserId()) {
        this.remoteVideoTrack.stop();
        this.remoteVideoTrack = null;
      }
    });
  }

  // Set up Signaling event listeners
  setupSignalingEventListeners(channel) {
    if (!channel) return;

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
    if (!this.rtcEngine || !user) return false;
    
    try {
      console.log('📺 Subscribing to remote video for user:', user.uid);
      console.log('📺 RTC engine state before subscribe:', {
        connectionState: this.rtcEngine.connectionState,
        role: this.rtcEngine.role,
        mode: this.rtcEngine.mode
      });
      
      await this.rtcEngine.subscribe(user, 'video');
      console.log('✅ Subscribed to remote video');
      
      this.remoteVideoTrack = user.videoTrack;
      console.log('📺 Remote video track:', this.remoteVideoTrack);
      console.log('📺 Video track state - isClosed:', this.remoteVideoTrack._isClosed);
      console.log('📺 Video track state - isDestroyed:', this.remoteVideoTrack._isDestroyed);
      console.log('📺 Video track mediaStreamTrack:', this.remoteVideoTrack.mediaStreamTrack);
      
      // Check if the video track is valid before playing
      if (this.remoteVideoTrack._isClosed || this.remoteVideoTrack._isDestroyed) {
        console.error('❌ Video track is closed or destroyed, cannot play');
        return false;
      }
      
      // Play video in the remote player container
      console.log('📺 Playing remote video in #remote-player container...');
      try {
        // Wait for DOM element to be available
        let remotePlayerEl = document.getElementById('remote-player');
        let retries = 0;
        const maxRetries = 10;
        
        while (!remotePlayerEl && retries < maxRetries) {
          console.log(`📺 Waiting for #remote-player element... (attempt ${retries + 1}/${maxRetries})`);
          await new Promise(resolve => setTimeout(resolve, 100));
          remotePlayerEl = document.getElementById('remote-player');
          retries++;
        }
        
        if (!remotePlayerEl) {
          console.error('❌ #remote-player element not found after retries');
          return false;
        }
        
        console.log('📺 Found #remote-player element:', remotePlayerEl);
        await this.remoteVideoTrack.play(remotePlayerEl);
        console.log('✅ Remote video playing');
      } catch (playError) {
        console.error('❌ Error playing remote video:', playError);
        return false;
      }
      return true;
    } catch (error) {
      console.error('❌ Error subscribing to video:', error);
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
      this.localAudioTrack = await this.agoraRTC.createMicrophoneAudioTrack();
      await this.rtcEngine.publish(this.localAudioTrack);
      console.log('✅ Published local audio');
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
      
      console.log('🎥 Publishing video track...');
      await this.rtcEngine.publish(this.localVideoTrack);
      console.log('🎥 Video track published successfully');
      
      // Play local video in the local player container
      console.log('🎥 Playing video in #local-player container...');
      console.log('🎥 Available DOM elements:', document.querySelectorAll('[id*="player"]'));
      console.log('🎥 Document body:', document.body.innerHTML.substring(0, 500));
      
      // Wait for DOM element to be available
      let localPlayerEl = document.getElementById('local-player');
      let retries = 0;
      const maxRetries = 20;
      
      while (!localPlayerEl && retries < maxRetries) {
        console.log(`🎥 Waiting for #local-player element... (attempt ${retries + 1}/${maxRetries})`);
        await new Promise(resolve => setTimeout(resolve, 200));
        localPlayerEl = document.getElementById('local-player');
        retries++;
      }
      
      if (!localPlayerEl) {
        console.error('❌ #local-player element not found after retries');
        return false;
      }
      
      console.log('🎥 Found #local-player element:', localPlayerEl);
      this.localVideoTrack.play(localPlayerEl);
      console.log('✅ Published and playing local video');
      return true;
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
    if (!this.rtcEngine) return;

    try {
      if (this.localAudioTrack) {
        this.localAudioTrack.close();
        this.localAudioTrack = null;
      }
      
      await this.rtcEngine.leave();
      console.log('✅ Left RTC channel');
      return true;
    } catch (error) {
      console.error('❌ Error leaving RTC channel:', error);
      return false;
    }
  }

  // Leave Signaling channel
  async leaveSignalingChannel() {
    if (!this.rtmClient) return;

    try {
      await this.rtmClient.logout();
      console.log('✅ Left Signaling channel');
      return true;
    } catch (error) {
      console.error('❌ Error leaving Signaling channel:', error);
      return false;
    }
  }

  // Complete disconnect (for audience leaving)
  async disconnect() {
    try {
      await this.leaveRTCChannel();
      await this.leaveSignalingChannel();
      
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

  // End stream (for host - stops agent and disconnects)
  async endStream() {
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
      
      await this.leaveRTCChannel();
      await this.leaveSignalingChannel();
      
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