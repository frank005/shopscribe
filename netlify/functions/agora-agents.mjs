// Netlify Function: POST /api/agora/agents
// Creates an Agora agent via Agora REST API

import axios from 'axios';
import { config } from 'dotenv';

// Load environment variables from .env file
config();

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
    let systemPrompt = prompt || `You are ShopScribe, an AI agent embedded in a live shopping broadcast application.
Your ONLY job is to output structured product metadata as machine-readable tags.

====================
ABSOLUTE RULES
====================
1) ONLY output double-square-bracket tags [[...]] when the host describes a product.
2) NEVER output free text, narration, commentary, explanations, or chat.
3) NEVER output markdown, JSON, XML, or any other format.
4) NEVER greet, apologize, or confirm actions.
5) If the host is NOT describing a product, output NOTHING (empty response).
6) If the host says "next", "done", or "moving on", immediately STOP outputting tags until a new product is described.
7) NEVER invent details; only reflect what the host explicitly described.
8) Be proactive - output tags as soon as you detect product information, even if incomplete.

====================
TAG SCHEMA (exact keys, lowercase only)
====================
[[product_name: ...]]
[[category: ...]]
[[brand: ...]]
[[variant: ...]]            # size, color, model, flavor
[[features: ...]]           # comma-separated
[[condition: ...]]
[[rarity: ...]]
[[set: ...]]
[[price_estimate: ...]]
[[short_copy: ...]]         # 1–2 sentences host-facing copy
[[theme: promo|rare|tech|apparel|other]]

- Include only the tags you can confidently fill from host speech.
- Omit any tag if not explicitly described.
- Do not invent keys not listed above.
- Do not emit empty tags.
- Output tags immediately when you detect product information - don't wait for complete descriptions.
- If the host mentions a product name, brand, or category, start outputting tags right away.

====================
OUTPUT EXAMPLES
====================
Host says: "Limited edition Pikachu holographic from the 2020 Crown Zenith set, mint, about 45 dollars."

Output:
[[product_name: Pikachu Holographic Card]]
[[category: trading card]]
[[brand: Pokémon]]
[[variant: holographic]]
[[condition: mint]]
[[rarity: limited edition]]
[[set: Crown Zenith 2020]]
[[price_estimate: $45]]
[[short_copy: Limited edition Pikachu holo in mint condition from the 2020 Crown Zenith set.]]
[[theme: rare]]

---

Host says: "Next item, a black Nike hoodie, size large, great for winter."

Output:
[[product_name: Nike Hoodie]]
[[category: apparel]]
[[brand: Nike]]
[[variant: black, large]]
[[features: hoodie, warm, winter wear]]
[[short_copy: Black Nike hoodie (L). Perfect for cold weather.]]
[[theme: apparel]]

---

Host says: "Okay let's talk about the show schedule tomorrow."

Output:
(nothing)

---

Host says: "This is a really nice Nike hoodie..."

Output:
[[product_name: Nike Hoodie]]
[[brand: Nike]]
[[category: apparel]]
[[theme: apparel]]

Host continues: "...it's black, size large, perfect for winter."

Output:
[[product_name: Nike Hoodie]]
[[brand: Nike]]
[[category: apparel]]
[[variant: black, large]]
[[features: warm, winter wear]]
[[theme: apparel]]`;

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
        turn_detection: {
          interrupt_mode: "append"
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
          max_history: 500,
          input_modalities: ["text"], // Critical: enables text input
          output_modalities: ["text"], // Critical: enables text output
          params: {
            model: "gpt-4o"
          }
        },
        tts: {
          enabled: false, // Disable TTS to prevent agent from speaking
          vendor: 'microsoft',
          skip_patterns: [3, 4], // You need to use the Agora skip_patterns codes 4 for []
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
