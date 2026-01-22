# ShopScribe AI/LLM Integration Guide

A comprehensive developer guide documenting how AI powers real-time product extraction during live shopping streams.

## Table of Contents

1. [Introduction and Overview](#1-introduction-and-overview)
2. [Architecture Overview](#2-architecture-overview)
3. [LLM Configuration and Prompt Engineering](#3-llm-configuration-and-prompt-engineering)
4. [Tag Schema Reference](#4-tag-schema-reference)
5. [Agent Creation API](#5-agent-creation-api)
6. [Real-Time Transcription Handling](#6-real-time-transcription-handling)
7. [Product Extraction and Parsing](#7-product-extraction-and-parsing)
8. [Data Flow: End-to-End](#8-data-flow-end-to-end)
9. [Integration with HostPage](#9-integration-with-hostpage)
10. [Environment Configuration](#10-environment-configuration)
11. [Extending and Customizing](#11-extending-and-customizing)
12. [Troubleshooting](#12-troubleshooting)
13. [API Reference](#13-api-reference)
14. [Glossary](#14-glossary)

---

## 1. Introduction and Overview

### Purpose

ShopScribe uses AI to automatically extract structured product information from host speech during live shopping streams. When a host describes a product verbally, the AI agent:

1. Converts speech to text (ASR)
2. Processes the text with GPT-4o
3. Outputs structured product tags
4. Displays product cards in real-time

### Technology Stack

| Component | Technology |
|-----------|------------|
| LLM Provider | OpenAI GPT-4o |
| AI Agent Platform | Agora Conversational AI Agent |
| Speech Recognition | Agora ARES ASR |
| Real-time Messaging | Agora RTM |
| Backend | Netlify Functions |
| Frontend | React |

### High-Level Data Flow

```
Host Speech → Agora ASR → GPT-4o Agent → [[Tags]] → Product Overlay
```

---

## 2. Architecture Overview

### System Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              HOST BROWSER                                    │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────────────────┐ │
│  │   Agora RTC     │  │   Agora RTM     │  │      React Components       │ │
│  │  (audio/video)  │  │  (messaging)    │  │  ProductOverlay, HostPage   │ │
│  └────────┬────────┘  └────────┬────────┘  └──────────────┬──────────────┘ │
└───────────┼────────────────────┼──────────────────────────┼─────────────────┘
            │                    │                          │
            │ Audio              │ Transcripts              │ Product Display
            ▼                    ▼                          │
┌─────────────────────────────────────────────────┐        │
│                  AGORA CLOUD                     │        │
│  ┌─────────────┐  ┌─────────────┐  ┌──────────┐ │        │
│  │ RTC Server  │  │ RTM Server  │  │   ASR    │ │        │
│  │             │  │             │  │  (ARES)  │ │        │
│  └──────┬──────┘  └──────┬──────┘  └────┬─────┘ │        │
│         │                │               │       │        │
│         └────────┬───────┴───────────────┘       │        │
│                  ▼                               │        │
│  ┌───────────────────────────────────────────┐  │        │
│  │      Conversational AI Agent              │  │        │
│  │  - Receives ASR text                      │  │        │
│  │  - Calls OpenAI GPT-4o                    │  │        │
│  │  - Returns [[tags]] via RTM               │  │        │
│  └───────────────────────────────────────────┘  │        │
└────────────────────────┬────────────────────────┘        │
                         │                                  │
                         │ API Calls                        │
                         ▼                                  │
┌─────────────────────────────────────────────────┐        │
│              NETLIFY EDGE FUNCTIONS              │        │
│  ┌─────────────────────────────────────────────┐│        │
│  │ agora-agents.mjs     - Create agent         ││        │
│  │ agora-agents-chat.mjs - Send messages       ││        │
│  │ agora-agents-stop.mjs - Stop agent          ││        │
│  └──────────────────────┬──────────────────────┘│        │
└─────────────────────────┼───────────────────────┘        │
                          │                                 │
                          │ OpenAI API                      │
                          ▼                                 │
┌─────────────────────────────────────────────────┐        │
│               OPENAI API                         │        │
│  ┌─────────────────────────────────────────────┐│        │
│  │ Model: gpt-4o                               ││        │
│  │ Temperature: 0.2                            ││        │
│  │ Output: Structured [[key: value]] tags      ││────────┘
│  └─────────────────────────────────────────────┘│
└─────────────────────────────────────────────────┘
```

### Component Responsibilities

| Component | File | Responsibility |
|-----------|------|----------------|
| Agent Creation | `netlify/functions/agora-agents.mjs` | Creates AI agent with LLM config |
| System Prompt | `src/utils/shopscribe-prompt.js` | Defines AI behavior and tag schema |
| RTM Messaging | `src/services/conversationalAIAPI.js` | Handles real-time transcriptions |
| Product Parsing | `src/utils/product-sync.js` | Extracts product data from tags |
| UI Display | `src/components/ProductOverlay.jsx` | Renders product information |
| Host Integration | `src/pages/HostPage.jsx` | Orchestrates entire flow |
| Configuration | `src/services/config.js` | Theme config and feature toggles |

---

## 3. LLM Configuration and Prompt Engineering

### LLM Provider Configuration

The AI agent is configured in `netlify/functions/agora-agents.mjs` (lines 194-207):

```javascript
llm: {
  url: process.env.OPENAI_API_URL || 'https://api.openai.com/v1/chat/completions',
  api_key: process.env.OPENAI_API_KEY || '',
  system_messages: systemMessages,
  greeting_message: "",  // Empty - no agent speech
  failure_message: "I'm having trouble processing that. Could you please rephrase?",
  max_history: 10,
  input_modalities: ["text"],
  output_modalities: ["text"],
  params: {
    model: "gpt-4o",
    temperature: 0.2  // Low temperature for consistent tag output
  }
}
```

**Key Configuration Decisions:**

| Setting | Value | Rationale |
|---------|-------|-----------|
| `model` | `gpt-4o` | Fast, capable model for real-time processing |
| `temperature` | `0.2` | Low value ensures consistent, deterministic tag formatting |
| `input_modalities` | `["text"]` | Text-only input from ASR |
| `output_modalities` | `["text"]` | Text-only output (no TTS) |
| `max_history` | `10` | Maintains context for multi-turn product descriptions |
| `greeting_message` | `""` | Empty to prevent agent from speaking |

### System Prompt Structure

The prompt is defined in `src/utils/shopscribe-prompt.js`:

```javascript
export const SHOPSCRIBE_PROMPT = `
You are a live shopping assistant. Listen to the host describing a product.
When you detect a coherent product description, output structured tags anywhere in your response using this exact format.

====================
TAG SCHEMA
====================
[[product_name: ...]]
[[category: ...]]
[[brand: ...]]          # omit if unknown
[[variant: ...]]        # size, color, model, capacity, etc.
[[features: ...]]       # comma-separated bullets
[[condition: ...]]
[[rarity: ...]]
[[set: ...]]
[[price_estimate: ...]]
[[short_copy: ...]]
[[theme: promo|rare|tech|apparel|other]]

====================
PARTIAL TAGGING POLICY
====================
- Emit tags as soon as you detect any part of a coherent product mention.
- It is OK to emit only [[product_name]] and [[category]] first.
- Add additional tags (like [[variant]], [[features]]) later as more details are revealed.
- Re-emit or override tags as needed (latest value wins).

The bracketed tags will be stripped from the visible UI and parsed into state. If the host says "next" or "move on", clear the current product and wait for a new description. Do not invent details.

====================
FORMAT & POLICY
====================
- Only output tags in [[key: value]] format.
- If not describing a product, output nothing (or (( ... )) notes).
- Re-emit keys to correct/refine (latest wins).
- Do not emit refusals ("not enough info").

====================
CONFIDENT ENRICHMENT
====================
- Brand inference: only for canonical families (Apple iPhone, Google Pixel, Pokémon TCG, etc.).
- Specs enrichment: only if standard and well-known for the model (e.g., iPhone 7 → A10 Fusion).
- Safe category inference: infer [[category]] when obvious (smartphone, apparel, trading card).
`;
```

### Prompt Engineering Best Practices Applied

1. **Clear Role Definition**: "You are a live shopping assistant"
2. **Structured Output Schema**: Explicit tag format with examples
3. **Delimiter Sections**: `====================` for clear separation
4. **Incremental Output Rules**: "emit tags as soon as detected"
5. **Negative Instructions**: "Do not invent details", "Do not emit refusals"
6. **Confident Enrichment Rules**: When AI can safely infer missing data

---

## 4. Tag Schema Reference

### Tag Format

All product data is output in double-bracket format:

```
[[key: value]]
```

### Supported Fields

| Field | Type | Description | Example | Required |
|-------|------|-------------|---------|----------|
| `product_name` | string | Product name/title | `iPhone 15 Pro` | Recommended |
| `category` | string | Product category | `Electronics` | Recommended |
| `brand` | string | Brand/manufacturer | `Apple` | Optional |
| `variant` | string | Size, color, model | `256GB, Natural Titanium` | Optional |
| `features` | string | Comma-separated features | `A17 Pro chip, Pro camera` | Optional |
| `condition` | string | Item condition | `Brand new`, `Mint` | Optional |
| `rarity` | string | Rarity level | `Ultra rare`, `Limited edition` | Optional |
| `set` | string | Set/collection name | `Crown Zenith 2020` | Optional |
| `price_estimate` | string | Price estimate | `$1,199` | Optional |
| `short_copy` | string | Marketing copy (1-2 sentences) | `Latest iPhone with...` | Optional |
| `theme` | enum | UI theme | `promo\|rare\|tech\|apparel\|other` | Optional |

### Theme Values and Styling

Themes control the visual appearance of product cards. Defined in `src/services/config.js` (lines 35-66):

| Theme | Background | Border | Text | Accent | Use Case |
|-------|------------|--------|------|--------|----------|
| `promo` | `bg-red-50` | `border-red-200` | `text-red-800` | `bg-red-500` | Promotional items, sales |
| `rare` | `bg-purple-50` | `border-purple-200` | `text-purple-800` | `bg-purple-500` | Collectibles, limited editions |
| `tech` | `bg-blue-50` | `border-blue-200` | `text-blue-800` | `bg-blue-500` | Electronics, gadgets |
| `apparel` | `bg-green-50` | `border-green-200` | `text-green-800` | `bg-green-500` | Clothing, fashion |
| `default` | `bg-gray-50` | `border-gray-200` | `text-gray-800` | `bg-gray-500` | General products |

### Example AI Output

**Host says:** "Limited edition Pikachu holographic from the 2020 Crown Zenith set, mint, about 45 dollars."

**AI outputs:**
```
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
```

---

## 5. Agent Creation API

### Endpoint

```
POST /.netlify/functions/agora-agents
```

### Request Payload

```javascript
{
  channelName: "stream_123456_abc",  // RTC channel name
  agentUid: "8888",                   // Standard agent UID
  clientUid: 12345,                   // Host's UID
  prompt: SHOPSCRIBE_PROMPT           // System prompt (optional, has default)
}
```

### Agent Configuration Object

The full agent configuration sent to Agora (from `agora-agents.mjs` lines 162-221):

```javascript
const agentConfig = {
  name: `onboarding_agent_${Date.now()}`,
  properties: {
    channel: channelName,
    token: '',
    agent_rtc_uid: agentUid.toString(),
    remote_rtc_uids: ["*"],
    enable_string_uid: false,
    idle_timeout: 30,
    agent_rtm_uid: channelName.toString() + "_agent",
    advanced_features: {
      enable_rtm: true,    // Required for transcript delivery
      enable_aivad: false  // No TTS needed
    },
    asr: {
      vendor: "ares",      // Agora's ASR engine
      language: "en-US"
    },
    turn_detection: {
      interrupt_mode: "append",
      silence_duration_ms: 1300  // Pause detection threshold
    },
    parameters: {
      audio_scenario: "chorus",
      data_channel: "rtm",  // RTM as data channel
      enable_metrics: false,
      enable_error_message: true,
      transcript: {
        enable: true,       // Enables transcripts
        redundant: false
      }
    },
    llm: { /* See LLM Configuration section */ },
    tts: {
      enabled: false       // Disable TTS
    }
  }
};
```

### Key Configuration Properties

| Property | Value | Purpose |
|----------|-------|---------|
| `agent_rtc_uid` | `"8888"` | Agent's UID in RTC channel |
| `enable_rtm` | `true` | Required for transcript delivery |
| `asr.vendor` | `"ares"` | Agora's speech recognition engine |
| `asr.language` | `"en-US"` | Speech recognition language |
| `silence_duration_ms` | `1300` | Pause detection threshold (ms) |
| `data_channel` | `"rtm"` | Use RTM for data delivery |
| `transcript.enable` | `true` | Enable transcript output |
| `tts.enabled` | `false` | Disable text-to-speech |

### Response Format

```javascript
{
  success: true,
  data: {
    agent_id: "agent_xyz123",
    status: "active",
    create_ts: 1704067200000
  }
}
```

---

## 6. Real-Time Transcription Handling

### ConversationalAIAPI Overview

The `src/services/conversationalAIAPI.js` file manages real-time transcription delivery. It contains two main classes:

1. **`CovSubRenderController`** - Handles message processing and deduplication
2. **`ConversationalAIAPI`** - Singleton API for managing AI communication

### Event Types

```javascript
const EConversationalAIAPIEvents = {
  TRANSCRIPTION_UPDATED: 'transcription-updated',
  AGENT_STATE_CHANGED: 'agent-state-changed',
  AGENT_INTERRUPTED: 'agent-interrupted',
  AGENT_METRICS: 'agent-metrics',
  AGENT_ERROR: 'agent-error',
  DEBUG_LOG: 'debug-log',
  MESSAGE_RECEIPT_UPDATED: 'message-receipt-updated',
  MESSAGE_ERROR: 'message-error'
};
```

### Message Types

```javascript
const EMessageType = {
  USER_TRANSCRIPTION: 'user.transcription',
  AGENT_TRANSCRIPTION: 'assistant.transcription',
  MSG_INTERRUPTED: 'message.interrupt',
  MSG_METRICS: 'message.metrics',
  MSG_ERROR: 'message.error',
  IMAGE_UPLOAD: 'image.upload',
  MESSAGE_INFO: 'message.info'
};
```

### CovSubRenderController

The controller handles incoming messages with deduplication (lines 103-300):

```javascript
class CovSubRenderController extends EventHelper {
  constructor(options = {}) {
    super();
    this.chatHistory = [];
    this.processedMessageIds = new Set();
    this.processedKeys = new Map();  // Deduplication map
    this.expectedAgentId = options.expectedAgentId || null;
    // ... callbacks
  }

  handleTranscriptionMessage(message, context) {
    // Clean up old processed keys (30 second TTL)
    const currentTime = Date.now();
    const timeThreshold = 30000;
    for (const [key, timestamp] of this.processedKeys.entries()) {
      if (currentTime - timestamp > timeThreshold) {
        this.processedKeys.delete(key);
      }
    }

    // Create unique key for deduplication
    const turnId = message.turn_id || message.turnId || '';
    const messageId = message.message_id || message.messageId || '';
    const text = message.text || message.content || '';
    const uniqueKey = messageId || `${turnId}:${text.trim()}`;

    // Skip if already processed
    if (this.processedKeys.has(uniqueKey)) {
      return;
    }

    // Mark as processed
    this.processedKeys.set(uniqueKey, currentTime);

    // Process message...
  }
}
```

### Message Flow

1. **RTM Message Received** - Agent sends transcript via RTM
2. **Message Parsed** - JSON decoded from RTM payload
3. **Routed to Controller** - `handleMessage()` determines type
4. **Transcription Processed** - `handleTranscriptionMessage()` with deduplication
5. **Event Emitted** - `TRANSCRIPTION_UPDATED` event fires
6. **Callback Invoked** - HostPage receives chat history

---

## 7. Product Extraction and Parsing

### Core Parsing Functions

Located in `src/utils/product-sync.js`:

#### parseProductTags(text)

Extracts all `[[key: value]]` tags from AI response (lines 43-64):

```javascript
const TAG_RE = /\[\[(\w+):\s*([^\]]+)\]\]/g;

const VALID_KEYS = new Set([
  'product_name', 'category', 'brand', 'variant', 'features',
  'condition', 'rarity', 'set', 'price_estimate', 'short_copy', 'theme'
]);

export function parseProductTags(text) {
  if (!text || typeof text !== 'string') {
    return {};
  }

  const product = {};
  let match;

  // Reset regex lastIndex to ensure we start from the beginning
  TAG_RE.lastIndex = 0;

  while ((match = TAG_RE.exec(text)) !== null) {
    const key = match[1]?.toLowerCase();
    const value = (match[2] || '').trim();

    if (key && VALID_KEYS.has(key) && value) {
      product[key] = value;
    }
  }

  return product;
}
```

#### stripTags(text)

Removes tags from text for clean UI display (lines 71-86):

```javascript
export function stripTags(text) {
  if (!text || typeof text !== 'string') {
    return text || '';
  }

  // If string starts with parentheses, return empty
  if (text.trim().startsWith('(')) {
    return '';
  }

  // Remove bracketed tags and clean up whitespace
  return text
    .replace(TAG_RE, '')
    .replace(/\s{2,}/g, ' ')
    .trim();
}
```

#### isProductDisplayable(product)

Validates that product has enough data to display (lines 189-197):

```javascript
export function isProductDisplayable(product) {
  if (!product || typeof product !== 'object') {
    return false;
  }

  // Need at least one of these key fields
  const keyFields = ['product_name', 'short_copy', 'category'];
  return keyFields.some(field => product[field] && product[field].trim());
}
```

#### getPrimaryProductField(product)

Determines the main display text (lines 107-122):

```javascript
export function getPrimaryProductField(product) {
  if (!product || typeof product !== 'object') {
    return '';
  }

  // Priority order for primary field
  const priority = ['product_name', 'short_copy', 'category', 'brand'];

  for (const field of priority) {
    if (product[field] && product[field].trim()) {
      return product[field];
    }
  }

  return '';
}
```

### Product Type Definition

```javascript
export const ProductType = {
  product_name: 'string',
  category: 'string',
  brand: 'string',
  variant: 'string',
  features: 'string',
  condition: 'string',
  rarity: 'string',
  set: 'string',
  price_estimate: 'string',
  short_copy: 'string',
  theme: 'string'
};
```

---

## 8. Data Flow: End-to-End

### Sequence Diagram

```
Host          Agora RTC     Agora Cloud      RTM           HostPage.jsx
 │                │              │             │                 │
 │──Speech───────►│              │             │                 │
 │                │──Audio──────►│             │                 │
 │                │              │             │                 │
 │                │         ┌────┴────┐        │                 │
 │                │         │  ASR    │        │                 │
 │                │         │ (ARES)  │        │                 │
 │                │         └────┬────┘        │                 │
 │                │              │             │                 │
 │                │         ┌────▼────┐        │                 │
 │                │         │ GPT-4o  │        │                 │
 │                │         │ Agent   │        │                 │
 │                │         └────┬────┘        │                 │
 │                │              │             │                 │
 │                │              │──[[tags]]──►│                 │
 │                │              │             │──RTM Message───►│
 │                │              │             │                 │
 │                │              │             │    parseProductTags()
 │                │              │             │    isProductDisplayable()
 │                │              │             │    setCurrentProduct()
 │                │              │             │                 │
 │◄───────────────┼──────────────┼─────────────┼──ProductOverlay─┤
 │                │              │             │                 │
```

### Complete Code Path Trace

| Step | File | Function/Line | Description |
|------|------|---------------|-------------|
| 1 | HostPage.jsx | `initializeConnection()` :125 | User starts stream |
| 2 | HostPage.jsx | `agoraService.createAgent()` :216-221 | Create AI agent |
| 3 | agora-agents.mjs | `handler()` :10-304 | Netlify function creates agent |
| 4 | Agora Cloud | - | ASR converts speech to text |
| 5 | Agora Cloud | - | GPT-4o processes text, outputs tags |
| 6 | conversationalAIAPI.js | `handleMessage()` :147 | RTM message received |
| 7 | conversationalAIAPI.js | `handleTranscriptionMessage()` :184 | Process with deduplication |
| 8 | HostPage.jsx | `onAgentResponse()` :231-269 | Callback receives chat history |
| 9 | product-sync.js | `parseProductTags()` :43 | Extract [[tags]] from text |
| 10 | product-sync.js | `isProductDisplayable()` :189 | Validate product data |
| 11 | HostPage.jsx | `setCurrentProduct()` :247 | Update React state |
| 12 | ProductOverlay.jsx | - | Render product card |

### Timing Expectations

| Stage | Latency |
|-------|---------|
| Speech capture | ~50ms |
| ASR transcription | ~500ms |
| LLM inference | ~1000-2000ms |
| RTM delivery | ~100ms |
| UI render | ~50ms |
| **Total** | **~2-3 seconds** |

---

## 9. Integration with HostPage

### Agent Creation

From `src/pages/HostPage.jsx` (lines 215-225):

```javascript
// Create AI agent with unified prompt
const agent = await agoraService.createAgent(
  channelName,
  CONFIG.AGORA_AGENT_UID,  // '8888'
  uid,
  SHOPSCRIBE_PROMPT
);

if (!agent) {
  throw new Error('Failed to create AI agent');
}
```

### Transcription Subscription

From `src/pages/HostPage.jsx` (lines 227-269):

```javascript
// Start receiving transcriptions from the agent
await agoraService.conversationalAI.subscribeMessage(channelName);

// Set up transcription listener
agoraService.onAgentResponse((chatHistory) => {
  console.log('Host received agent response:', chatHistory);
  if (chatHistory && chatHistory.length > 0) {
    const latestMessage = chatHistory[chatHistory.length - 1];
    if (latestMessage && latestMessage.data) {
      const text = latestMessage.data.text || '';

      if (latestMessage.data.speaker.includes('Assistant')) {
        // Parse product tags
        const productData = parseProductTags(text);

        if (isProductDisplayable(productData)) {
          setCurrentProduct(productData);
          setOverlayVisible(true);

          // Add to product history with RTM storage
          productHistoryRTM.addProduct(productData).then(updatedHistory => {
            setProductHistory(updatedHistory);
          });
        }
      } else {
        // Update transcript with cleaned text for User text
        const cleanedText = stripTags(text);
        setTranscript(cleanedText);
      }
    }
  }
});
```

### Product State Management

| State Variable | Type | Purpose |
|----------------|------|---------|
| `currentProduct` | Object | Active product being displayed |
| `overlayVisible` | Boolean | Controls overlay visibility |
| `productHistory` | Array | List of captured products |
| `transcript` | String | Cleaned text for captions |

---

## 10. Environment Configuration

### Required Environment Variables

```env
# Agora Configuration (REQUIRED)
REACT_APP_AGORA_APP_ID=your_agora_app_id
AGORA_CERTIFICATE=your_agora_certificate
AGORA_CUSTOMER_ID=your_agora_customer_id
AGORA_CUSTOMER_SECRET=your_agora_customer_secret

# OpenAI Configuration (REQUIRED for AI features)
OPENAI_API_KEY=your_openai_api_key
```

### Optional Environment Variables

```env
# OpenAI URL override (defaults to standard endpoint)
OPENAI_API_URL=https://api.openai.com/v1/chat/completions

# Agora base URL override
AGORA_BASE_URL=https://api.agora.io

# Feature toggles
REACT_APP_ENABLE_RTM_SYNC=false
REACT_APP_ENABLE_PRODUCT_HISTORY=true
REACT_APP_CHANNEL_LIST_REFRESH_MS=10000
```

### Configuration Constants

From `src/services/config.js`:

```javascript
export const CONFIG = {
  // UI Configuration
  MAX_PRODUCT_HISTORY: 10,
  OVERLAY_TIMEOUT_MS: 30000,  // Auto-hide after 30 seconds
  OVERLAY_ANIM_MS: 200,

  // Agora Configuration
  AGORA_APP_ID: process.env.REACT_APP_AGORA_APP_ID || '',
  AGORA_AGENT_UID: '8888',  // Standard agent UID

  // Channel settings
  DEFAULT_CHANNEL_PREFIX: 'ss_',
  MAX_CHANNEL_NAME_LENGTH: 64,

  // Product parsing
  PRODUCT_TAG_PATTERN: /\[\[(\w+):\s*([^\]]+)\]\]/g,
  VALID_PRODUCT_FIELDS: [
    'product_name', 'category', 'brand', 'variant', 'features',
    'condition', 'rarity', 'set', 'price_estimate', 'short_copy', 'theme'
  ]
};
```

---

## 11. Extending and Customizing

### Adding New Product Fields

1. **Update VALID_KEYS** in `src/utils/product-sync.js`:
   ```javascript
   const VALID_KEYS = new Set([
     // existing fields...
     'your_new_field'  // Add here
   ]);
   ```

2. **Update prompt schema** in `src/utils/shopscribe-prompt.js`:
   ```
   [[your_new_field: ...]]  # description
   ```

3. **Update ProductOverlay.jsx** to render the new field:
   ```javascript
   if (product.your_new_field) {
     details.push({ label: 'Your Label', value: product.your_new_field });
   }
   ```

4. **Update ProductType** in `src/utils/product-sync.js`:
   ```javascript
   export const ProductType = {
     // existing fields...
     your_new_field: 'string'
   };
   ```

### Changing LLM Provider

Modify `netlify/functions/agora-agents.mjs`:

```javascript
llm: {
  url: 'https://your-llm-provider.com/v1/chat/completions',
  api_key: process.env.YOUR_API_KEY,
  params: {
    model: 'your-model-name',
    temperature: 0.2
  }
}
```

**Note:** The LLM provider must support the OpenAI-compatible chat completions API format.

### Customizing the Prompt

Edit `src/utils/shopscribe-prompt.js`:

1. **Add new tag types** in the TAG SCHEMA section
2. **Modify extraction rules** in PARTIAL TAGGING POLICY
3. **Add domain-specific examples** in OUTPUT EXAMPLES

**Example - Adding auction support:**

```javascript
// Add to TAG SCHEMA section:
[[starting_bid: ...]]
[[bid_increment: ...]]
[[auction_end: ...]]

// Add to examples:
Host says: "Starting bid $50, increments of $5, auction ends at 3pm."

Output:
[[starting_bid: $50]]
[[bid_increment: $5]]
[[auction_end: 3pm]]
```

### Adding New Product Themes

In `src/services/config.js`:

```javascript
PRODUCT_THEMES: {
  // existing themes...
  vintage: {
    bgColor: 'bg-amber-50',
    borderColor: 'border-amber-200',
    textColor: 'text-amber-800',
    accentColor: 'bg-amber-500'
  },
  luxury: {
    bgColor: 'bg-yellow-50',
    borderColor: 'border-yellow-300',
    textColor: 'text-yellow-900',
    accentColor: 'bg-yellow-500'
  }
}
```

Then update the prompt to include the new theme options:

```
[[theme: promo|rare|tech|apparel|vintage|luxury|other]]
```

---

## 12. Troubleshooting

### Common Issues

| Issue | Cause | Solution |
|-------|-------|----------|
| No product overlay appears | Tags not being parsed | Check AI response format, verify regex matches |
| Tags visible in captions | `stripTags()` not called | Ensure display uses cleaned text |
| Overlay appears delayed | High LLM latency | Check OpenAI API status, reduce prompt length |
| Agent not responding | RTM subscription failed | Verify channel name, check RTM connection |
| Duplicate products shown | Deduplication failing | Check `processedKeys` Map in controller |
| "Failed to create agent" | Missing env variables | Verify all required env vars are set |
| Agent creates but no output | ASR not working | Check `asr.language` matches spoken language |

### Debug Logging

Enable verbose logging in HostPage:

```javascript
// Already included - check console for these prefixes:
agoraService.conversationalAI.on('debug-log', (message) => {
  console.log('AI Debug:', message);
});

agoraService.conversationalAI.on('agent-error', (agentUserId, error) => {
  console.error('AI Agent Error:', agentUserId, error);
});
```

Key log prefixes to watch:
- `[RTC]` - Real-time communication events
- `[RTM]` - Real-time messaging events
- `🎯` - Product parsing in HostPage
- `🔄` - Deduplication skips in controller

### Testing Product Parsing Locally

```javascript
import { parseProductTags, isProductDisplayable, stripTags } from '../utils/product-sync';

// Test parsing
const testText = '[[product_name: Test Product]][[category: Electronics]][[theme: tech]]';
const product = parseProductTags(testText);
console.log('Parsed:', product);
// Output: { product_name: 'Test Product', category: 'Electronics', theme: 'tech' }

console.log('Displayable:', isProductDisplayable(product));
// Output: true

console.log('Stripped:', stripTags(testText));
// Output: ''
```

### Verifying Agent Creation

Check Netlify function logs:

```
🔍 Agora agents function called - creating agent
🚀 Creating Agora agent via REST API...
✅ Created Agora agent agent_xyz123
```

If you see errors, check:
1. All environment variables are set in Netlify
2. Agora customer credentials are valid
3. OpenAI API key has sufficient quota

---

## 13. API Reference

### Netlify Functions

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/.netlify/functions/agora-agents` | POST | Create AI agent |
| `/.netlify/functions/agora-agents-chat` | POST | Send message to agent |
| `/.netlify/functions/agora-agents-stop` | POST | Stop agent |
| `/.netlify/functions/agora-agents-interrupt` | POST | Interrupt agent |

### Product Sync Functions

| Function | Signature | Description |
|----------|-----------|-------------|
| `parseProductTags` | `(text: string) => Object` | Extract tags from text |
| `stripTags` | `(text: string) => string` | Remove tags from text |
| `isProductDisplayable` | `(product: Object) => boolean` | Check if displayable |
| `formatProductForDisplay` | `(product: Object) => Object` | Format for UI |
| `getPrimaryProductField` | `(product: Object) => string` | Get main display text |
| `getProductTheme` | `(product: Object) => string` | Get theme name |
| `mergeProductUpdate` | `(existing: Object, update: Object) => Object` | Merge product updates |
| `hasProductTags` | `(text: string) => boolean` | Check if text has tags |

### ConversationalAIAPI Methods

| Method | Description |
|--------|-------------|
| `init(config)` | Initialize API with RTC/RTM engines |
| `subscribeMessage(channel)` | Subscribe to channel transcriptions |
| `unsubscribe()` | Unsubscribe from channel |
| `on(event, handler)` | Add event listener |
| `off(event, handler)` | Remove event listener |

### Configuration Helpers

| Function | Signature | Description |
|----------|-----------|-------------|
| `getProductThemeConfig` | `(theme: string) => Object` | Get Tailwind classes for theme |
| `validateConfig` | `() => { isValid: boolean, errors: string[] }` | Validate env config |
| `generateChannelName` | `(prefix: string) => string` | Generate safe channel name |

---

## 14. Glossary

| Term | Definition |
|------|------------|
| **ASR** | Automatic Speech Recognition - converts speech to text |
| **RTM** | Real-Time Messaging - Agora's signaling/messaging service |
| **RTC** | Real-Time Communication - Agora's audio/video service |
| **LLM** | Large Language Model (GPT-4o in this case) |
| **Tag** | Bracketed key-value pair `[[key: value]]` for structured data |
| **Transcription** | Text representation of spoken words |
| **Conv AI Agent** | Agora's Conversational AI Agent service |
| **UID** | User ID - unique identifier in Agora channels |
| **ARES** | Agora's proprietary ASR engine |
| **Turn Detection** | Logic to detect when a speaker has finished talking |
| **Theme** | Visual styling category for product cards |

---

## Quick Reference Card

```
┌─────────────────────────────────────────────────────────────┐
│                    SHOPSCRIBE AI QUICK REF                  │
├─────────────────────────────────────────────────────────────┤
│ LLM: GPT-4o | Temp: 0.2 | Agent UID: 8888                  │
├─────────────────────────────────────────────────────────────┤
│ TAG FORMAT: [[key: value]]                                  │
│                                                             │
│ REQUIRED FIELDS (at least one):                            │
│   product_name | short_copy | category                     │
│                                                             │
│ OPTIONAL FIELDS:                                           │
│   brand | variant | features | condition                   │
│   rarity | set | price_estimate | theme                    │
│                                                             │
│ THEMES: promo | rare | tech | apparel | default            │
├─────────────────────────────────────────────────────────────┤
│ KEY FILES:                                                  │
│   Prompt:    src/utils/shopscribe-prompt.js                │
│   Parsing:   src/utils/product-sync.js                     │
│   Agent:     netlify/functions/agora-agents.mjs            │
│   Handling:  src/services/conversationalAIAPI.js           │
│   Display:   src/components/ProductOverlay.jsx             │
│   Config:    src/services/config.js                        │
├─────────────────────────────────────────────────────────────┤
│ ENV VARS (required):                                        │
│   REACT_APP_AGORA_APP_ID | AGORA_CUSTOMER_ID               │
│   AGORA_CUSTOMER_SECRET  | OPENAI_API_KEY                  │
└─────────────────────────────────────────────────────────────┘
```
