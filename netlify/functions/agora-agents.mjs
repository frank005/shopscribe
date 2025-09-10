// Netlify Function: POST /api/agora/agents
// Creates an Agora agent via Agora REST API

import axios from 'axios';

const handler = async (req, ctx) => {
  try {
    // Only allow POST requests
    if (req.method !== "POST") {
      return new Response(JSON.stringify({ 
        success: false,
        error: "Method Not Allowed",
        allowedMethods: ["POST"]
      }), {
        status: 405,
        headers: { 
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Headers": "Content-Type"
        },
      });
    }

    console.log('🔍 Agora agents function called - creating agent');

    // Parse request body
    const body = await req.json();
    const { channelName, agentUid, clientUid, prompt, profileContext } = body;
    
    if (!channelName || !agentUid || !clientUid) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Missing required fields: channelName, agentUid, clientUid'
      }), {
        status: 400,
        headers: { 
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Headers": "Content-Type"
        },
      });
    }

    // console.log('📋 Creating agent with:', { channelName, agentUid, clientUid, hasProfileContext: !!profileContext });

    // Build system messages array
    const systemMessages = [];
    
    // Live shopping doesn't use profile context
    const hasValidProfile = false;
    
    // Build the main system prompt with optional PROFILE_CONTEXT concatenated
    // If prompt is null (from agoraService), use the comprehensive prompt from this function
    let systemPrompt = prompt || `[AGORA_AGENT_SERVICE] You are a live shopping assistant. Listen to the host describing a product.

Your personality: helpful and informative

=====================================================
LIVE SHOPPING ASSISTANT RULES

1. Listen to the host describing products naturally during their live stream.
2. When you detect a coherent product description (usually after a brief pause), output structured tags anywhere in your response using this exact format:

[[product_name: ...]]
[[category: ...]]
[[brand: ...]]
[[variant: ...]]
[[features: ...]]
[[condition: ...]]
[[rarity: ...]]
[[set: ...]]
[[price_estimate: ...]]
[[short_copy: ...]]
[[theme: promo|rare|tech|apparel]]

3. Keep normal spoken language natural for the audience, but the bracketed tags will be stripped from the visible UI and parsed into state.

4. If the host says "next" or "move on", clear the current product and wait for a new description.

5. Do not invent details - only summarize what the host actually describes.

6. Be concise and helpful in your responses.

7. NEVER speak any audible words. Emit only hidden tags + optional transcript text.

=====================================================
EXAMPLES

Host: "This is a brand new iPhone 15 Pro in Natural Titanium, 256GB storage. It has the new A17 Pro chip and the advanced Pro camera system. Perfect condition, never been used."

Assistant: "That's a fantastic device! The iPhone 15 Pro is one of Apple's latest flagship phones with incredible performance and camera capabilities. [[product_name: iPhone 15 Pro]] [[category: Electronics]] [[brand: Apple]] [[variant: 256GB Natural Titanium]] [[features: A17 Pro chip, Pro camera system]] [[condition: Brand new]] [[price_estimate: $1,199]] [[short_copy: Latest iPhone with advanced camera and performance]] [[theme: tech]]"

Host: "Moving on to this vintage Pokemon card..."

Assistant: "[[product_name: ]] [[category: ]] [[brand: ]] [[variant: ]] [[features: ]] [[condition: ]] [[rarity: ]] [[set: ]] [[price_estimate: ]] [[short_copy: ]] [[theme: ]]"

=====================================================`;

    // Live shopping greeting message - empty to prevent agent from speaking
    const greetingMessage = "";
    
        // Add main system prompt
    systemMessages.push({
      role: 'system',
      content: systemPrompt
    });

    // Generate agent configuration with required payload parameters
    const agentConfig = {
      name: `onboarding_agent_${Date.now()}`,
      properties: {
        channel: channelName,
        token: '', // No token needed for testing
        agent_rtc_uid: agentUid.toString(),
        remote_rtc_uids: ["*"], // Allow all clients to connect
        enable_string_uid: false,
        idle_timeout: 30,
        agent_rtm_uid: agentUid.toString(), // Critical for RTM messaging
        advanced_features: {
          enable_rtm: true // Required: enable RTM for data channel
        },
        asr: {
          vendor: "ares",
          language: "en-US"
        },
        parameters: {
          audio_scenario: "chorus",
          data_channel: "rtm", // Required: specifies RTM as data channel
          enable_metrics: true,
          enable_error_message: true,
          transcript: {
            enable: true, // Critical: explicitly enables transcripts
            redundant: false
          }
        },
        llm: {
          url: process.env.OPENAI_API_URL || 'https://api.openai.com/v1/chat/completions',
          api_key: process.env.OPENAI_API_KEY || '',
          system_messages: systemMessages,
          greeting_message: "",
          failure_message: "I'm having trouble processing that. Could you please rephrase?",
          max_history: 32,
          input_modalities: ["text"], // Critical: enables text input
          output_modalities: ["text"], // Critical: enables text output
          params: {
            model: "gpt-4o-mini"
          }
        },
        tts: {
          enabled: false, // Disable TTS to prevent agent from speaking
          vendor: 'microsoft',
          skip_patterns: ["[", "]"], // Skip square brackets in audio
          params: {
            key: process.env.MICROSOFT_TTS_API_KEY || '',
            region: process.env.MICROSOFT_TTS_REGION || 'eastus',
            voice_name: 'en-US-EvelynMultilingualNeural',
            sample_rate: 24000,
			speed: 1.3
          }
        }
      }
    };

    // Call Agora /join API
    const appId = process.env.REACT_APP_AGORA_APP_ID;
    const customerId = process.env.AGORA_CUSTOMER_ID;
    const customerSecret = process.env.AGORA_CUSTOMER_SECRET;
    const baseUrl = process.env.AGORA_BASE_URL || 'https://api.agora.io';
    
    if (!appId || !customerId || !customerSecret) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Agora configuration missing'
      }), {
        status: 500,
        headers: { 
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Headers": "Content-Type"
        },
      });
    }

    const headers = {
      "Content-Type": "application/json",
      "Authorization": `Basic ${Buffer.from(`${customerId}:${customerSecret}`).toString('base64')}`
    };

    const url = `${baseUrl}/api/conversational-ai-agent/v2/projects/${appId}/join`;
    
    console.log('🚀 Creating Agora agent via REST API...');
    // console.log('🌐 URL:', url);
    // console.log('📤 Request payload:', JSON.stringify(agentConfig, null, 2));
    
    const response = await axios.post(url, agentConfig, { headers });
    
    // console.log('🔍 Agora API Response:', JSON.stringify(response.data, null, 2));
    
    if (response.data && (response.data.agent_id || response.data.agentId)) {
      const agentId = response.data.agent_id || response.data.agentId;
      console.log(`✅ Created Agora agent ${agentId}`);
      
      return new Response(JSON.stringify({
        success: true,
        data: response.data
      }), {
        status: 200,
        headers: { 
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Headers": "Content-Type"
        },
      });
    } else {
      console.error('❌ No agent ID in response:', response.data);
      return new Response(JSON.stringify({
        success: false,
        error: 'Failed to create agent - no agentId in response'
      }), {
        status: 500,
        headers: { 
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Headers": "Content-Type"
        },
      });
    }
  } catch (err) {
    console.error("❌ agora-agents error:", err);
    return new Response(JSON.stringify({ 
      success: false,
      error: "Internal Error", 
      details: String(err) 
    }), {
      status: 500,
      headers: { 
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "Content-Type"
      },
    });
  }
};

export default handler;
