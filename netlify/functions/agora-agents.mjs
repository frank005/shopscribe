// Netlify Function: POST /api/agora/agents
// Creates an Agora agent via Agora REST API

import axios from 'axios';
import { config } from 'dotenv';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
require('./utils/AccessToken2.js');
const { RtcTokenBuilder, RtcRole } = require('./utils/RtcTokenBuilder2.js');

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

    // Resolve preset configuration
    const asrPreset = process.env.ASR_PRESET || '';
    const llmPreset = process.env.LLM_PRESET || '';
    const ttsPreset = process.env.TTS_PRESET || '';

    // Build preset string (comma-joined list of active presets)
    const activePresets = [asrPreset, llmPreset, ttsPreset].filter(Boolean);
    const presetString = activePresets.join(',');

    const asrLanguage = process.env.ASR_LANGUAGE || 'en-US';
    const llmMaxHistory = parseInt(process.env.LLM_MAX_HISTORY) || 10;
    const llmTemperature = parseFloat(process.env.LLM_TEMPERATURE) || 0.2;
    const llmMaxTokens = parseInt(process.env.LLM_MAX_TOKENS) || 1000;

    // Build ASR config
    let asrConfig;
    if (asrPreset) {
      const asrVendor = asrPreset.startsWith('deepgram') ? 'deepgram' : 'ares';
      asrConfig = { vendor: asrVendor, language: asrLanguage };
    } else {
      asrConfig = { vendor: process.env.ASR_VENDOR || 'ares', language: asrLanguage };
    }

    // Build LLM config
    let llmConfig;
    if (llmPreset) {
      llmConfig = {
        vendor: 'openai',
        system_messages: systemMessages,
        greeting_message: "",
        failure_message: "I'm having trouble processing that. Could you please rephrase?",
        max_history: llmMaxHistory,
        input_modalities: ["text"],
        output_modalities: ["text"],
        params: {
          temperature: llmTemperature,
          max_tokens: llmMaxTokens,
        }
      };
    } else {
      llmConfig = {
        url: process.env.OPENAI_API_URL || 'https://api.openai.com/v1/chat/completions',
        api_key: process.env.OPENAI_API_KEY || '',
        system_messages: systemMessages,
        greeting_message: "",
        failure_message: "I'm having trouble processing that. Could you please rephrase?",
        max_history: llmMaxHistory,
        input_modalities: ["text"],
        output_modalities: ["text"],
        params: {
          model: process.env.OPENAI_MODEL || 'gpt-4o',
          temperature: llmTemperature,
          max_tokens: llmMaxTokens,
        }
      };
    }

    // Build TTS config — disabled for shopscribe (agent is silent, transcript-only)
    // skip_patterns: [3,4] strips () and [] from audio in case TTS is re-enabled later
    let ttsConfig;
    if (ttsPreset) {
      const ttsVendor = ttsPreset.startsWith('minimax_speech_') ? 'minimax' : 'openai';
      const ttsParams = {};
      if (ttsPreset.startsWith('minimax_speech_')) {
        const voiceId = process.env.TTS_MINIMAX_VOICE_ID || '';
        const sampleRate = parseInt(process.env.TTS_MINIMAX_SAMPLE_RATE) || 32000;
        if (voiceId) ttsParams.voice_setting = { voice_id: voiceId };
        ttsParams.audio_setting = { sample_rate: sampleRate };
      } else {
        ttsParams.voice = process.env.TTS_OPENAI_VOICE || 'alloy';
        ttsParams.speed = parseFloat(process.env.TTS_OPENAI_SPEED) || 1.0;
      }
      ttsConfig = {
        enabled: false,
        vendor: ttsVendor,
        skip_patterns: [3, 4],
        ...(Object.keys(ttsParams).length > 0 ? { params: ttsParams } : {})
      };
    } else {
      ttsConfig = {
        enabled: false,
        vendor: 'microsoft',
        skip_patterns: [3, 4],
        params: {
          key: process.env.MICROSOFT_TTS_API_KEY || '',
          region: process.env.MICROSOFT_TTS_REGION || 'eastus',
          voice_name: process.env.MICROSOFT_TTS_VOICE || 'en-US-EvelynMultilingualNeural',
          speed: parseFloat(process.env.MICROSOFT_TTS_SPEED) || 1.3,
        }
      };
    }

    // Generate agent token if certificate is configured
    let agentToken = '';
    const shopAppId = process.env.REACT_APP_AGORA_APP_ID;
    const shopAppCertificate = process.env.AGORA_APP_CERTIFICATE || process.env.AGORA_CERTIFICATE;
    if (shopAppCertificate && shopAppId) {
      try {
        const TTL = 3600;
        const expireAt = Math.floor(Date.now() / 1000) + TTL;
        agentToken = await RtcTokenBuilder.buildTokenWithRtm(
          shopAppId,
          shopAppCertificate,
          channelName,
          agentUid.toString(),
          RtcRole.PUBLISHER,
          expireAt,
          expireAt
        );
      } catch (tokenErr) {
        console.error('⚠️ Failed to generate agent token:', tokenErr);
      }
    }

    // Generate agent configuration with required payload parameters
    const agentConfig = {
      name: `onboarding_agent_${Date.now()}`,
      ...(presetString ? { preset: presetString } : {}),
      properties: {
        channel: channelName,
        token: agentToken,
        agent_rtc_uid: agentUid.toString(),
        remote_rtc_uids: ["*"], // Allow all clients to connect
        enable_string_uid: false,
        idle_timeout: 30,
        agent_rtm_uid: channelName.toString() + "_agent", // Critical for RTM messaging
        advanced_features: {
          enable_rtm: true, // Required: enable RTM for data channel
          enable_aivad: false // no TTS so latency doesn't matter
        },
        asr: asrConfig,
        turn_detection: {
          interrupt_mode: "append",
          silence_duration_ms: 1300
        },
        parameters: {
          audio_scenario: "chorus",
          data_channel: "rtm", // Required: specifies RTM as data channel
          enable_metrics: false,
          enable_error_message: true,
          transcript: {
            enable: true, // Critical: explicitly enables transcripts
            redundant: false
          }
        },
        llm: llmConfig,
        tts: ttsConfig
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
