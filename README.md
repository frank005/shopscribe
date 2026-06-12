# ShopScribe - Live Shopping App

A Whatnot-style live shopping web application powered by **Agora Web SDK** and **Agora Conversational AI**. Hosts can broadcast video/audio, describe products naturally, and trigger AI-generated product overlays. Audiences can discover and join live channels to watch streams with real-time product information.

---

## 🆕 Recent Changes

### Agora Presets (ASR, LLM, TTS)
The agent now supports **Agora-managed presets** so you no longer need vendor API keys. Set any of the following env vars to use presets:
- `ASR_PRESET` — `deepgram_nova_2`, `deepgram_nova_3` (or leave blank for `ares`)
- `LLM_PRESET` — `openai_gpt_4o_mini`, `openai_gpt_4_1_mini`, `openai_gpt_5_nano`, `openai_gpt_5_mini`
- `TTS_PRESET` — `minimax_speech_2_6_turbo`, `minimax_speech_2_8_turbo`, `openai_tts_1` *(note: TTS is disabled in ShopScribe — the agent is transcript-only — but the preset is wired for future use)*

When a preset is set, the corresponding API key (`OPENAI_API_KEY`, `MICROSOFT_TTS_API_KEY`) is **not** needed. Leaving a preset blank falls back to the original env-var key mode.

Vendor-specific preset params:
- MiniMax: `TTS_MINIMAX_VOICE_ID`, `TTS_MINIMAX_SAMPLE_RATE`
- OpenAI TTS: `TTS_OPENAI_VOICE`, `TTS_OPENAI_SPEED`
- LLM: `LLM_TEMPERATURE`, `LLM_MAX_TOKENS`, `LLM_MAX_HISTORY` (apply in both preset and key mode)

### Token Authentication
Added support for App-Certificate-based RTC tokens:
- New env var `AGORA_APP_CERTIFICATE` (or legacy `AGORA_CERTIFICATE`, both supported) enables token mode
- New endpoint `/api/token` (Netlify function `token.mjs`) returns combined RTC+RTM tokens for clients
- Agent token is generated server-side in `agora-agents.mjs`
- Client-side `joinAsHost` / `joinAsAudience` now auto-fetch tokens before joining
- If `AGORA_APP_CERTIFICATE` is not set, falls back to tokenless mode (App ID only)

---


## Features

- **Host Interface**: Broadcast video/audio, describe products naturally, control product overlays
- **Audience Interface**: Browse live channels, join streams, view product overlays
- **AI-Powered Product Detection**: Automatically parses product descriptions into structured overlays
- **Real-time Communication**: Powered by Agora Web SDK for low-latency streaming
- **Channel Discovery**: Browse and search active live shopping channels
- **Product History**: Pin and manage product information during streams

## Tech Stack

- **Frontend**: React 18, Tailwind CSS, Framer Motion
- **Real-time**: Agora Web SDK (RTC + RTM)
- **AI**: Agora Conversational AI
- **Backend**: Netlify Functions (Serverless)
- **Deployment**: Netlify

## Quick Start

### 1. Prerequisites

- Node.js 18+
- Agora account with App ID and credentials
- Netlify account (for deployment)

### 2. Installation

```bash
# Clone the repository
git clone <repository-url>
cd shopscribe

# Install dependencies
npm install

# Copy environment configuration
cp env.example .env
```

### 3. Environment Setup

Edit `.env` with your credentials:

```env
# Agora Configuration
REACT_APP_AGORA_APP_ID=your_agora_app_id_here
AGORA_CERTIFICATE=your_agora_certificate_here
AGORA_CUSTOMER_ID=your_agora_customer_id_here
AGORA_CUSTOMER_SECRET=your_agora_customer_secret_here

# OpenAI Configuration (Optional)
OPENAI_API_KEY=your_openai_key
OPENAI_MODEL=gpt-4o

# TTS Configuration (Optional)
TTS_VENDOR=microsoft
MICROSOFT_TTS_API_KEY=your_microsoft_key
MICROSOFT_TTS_REGION=eastus

# API Configuration
REACT_APP_API_URL=http://localhost:8888
```

### 4. Development

```bash
# Start development server
npm start

# Or start with Netlify Dev (recommended)
npm run dev
```

The app will be available at `http://localhost:3000`.

### 5. Deployment

```bash
# Build for production
npm run build

# Deploy to Netlify
netlify deploy --prod
```

## Usage

### For Hosts

1. Navigate to `/host`
2. Click "Start Stream" to begin broadcasting
3. Describe products naturally - AI will automatically detect and create overlays
4. Use controls to show/hide overlays, pin products, and move to next product

### For Audiences

1. Navigate to `/lobby` to browse live channels
2. Click "Join" on any active channel
3. Watch the stream with real-time product overlays
4. View live transcript and stream information

## Product Tag System

The AI automatically detects product information using bracketed tags:

```
[[product_name: iPhone 15 Pro]]
[[category: Electronics]]
[[brand: Apple]]
[[variant: 256GB Natural Titanium]]
[[features: A17 Pro chip, Pro camera system]]
[[condition: Brand new]]
[[price_estimate: $1,199]]
[[short_copy: Latest iPhone with advanced camera and performance]]
[[theme: tech]]
```

## API Endpoints

- `GET /api/agora/channels` - List active channels
- `POST /api/agora/agents` - Create AI agent
- `POST /api/agora/agents/chat` - Send message to agent
- `POST /api/agora/agents/interrupt` - Interrupt agent
- `POST /api/agora/agents/stop` - Stop agent

## Configuration

### Feature Flags

- `REACT_APP_ENABLE_RTM_SYNC` - Enable real-time overlay sync (Phase 2)
- `REACT_APP_ENABLE_PRODUCT_HISTORY` - Enable product history sidebar
- `REACT_APP_CHANNEL_LIST_REFRESH_MS` - Channel list refresh interval

### UI Themes

Products support different themes for visual styling:
- `promo` - Red theme for promotional items
- `rare` - Purple theme for rare/collectible items  
- `tech` - Blue theme for technology products
- `apparel` - Green theme for clothing/fashion
- `default` - Gray theme for general products

## Development

### Project Structure

```
src/
├── components/          # React components
│   ├── ProductOverlay.jsx
│   ├── HostControls.jsx
│   ├── VideoStage.jsx
│   ├── AudienceLobby.jsx
│   └── ProductSidebar.jsx
├── pages/              # Page components
│   ├── HostPage.jsx
│   ├── AudiencePage.jsx
│   └── LobbyPage.jsx
├── services/           # Business logic
│   ├── agoraService.js
│   ├── conversationalAIAPI.js
│   └── config.js
├── utils/              # Utilities
│   ├── product-sync.js
│   └── subtitle-clean.js
└── api/                # API clients
    └── channelList.js

netlify/functions/      # Serverless functions
├── agora-channels.mjs
├── agora-agents.mjs
└── agora-agents-chat.mjs
```

### Key Components

- **ProductOverlay**: Floating overlay displaying product information
- **HostControls**: Control panel for stream management
- **VideoStage**: Video container with overlay mounting
- **AudienceLobby**: Channel discovery interface
- **ProductSidebar**: Product history management

## Troubleshooting

### Common Issues

1. **Agora SDK not loading**: Ensure CDN links are accessible
2. **Connection failures**: Check Agora credentials and network
3. **Product tags not parsing**: Verify AI agent prompt and tag format
4. **Channel list empty**: Check Agora API credentials and permissions

### Debug Mode

Enable debug logging by setting `enableLog: true` in the Agora service configuration.

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## License

MIT License - see LICENSE file for details.

## Support

For issues and questions:
- Check the troubleshooting section
- Review Agora documentation
- Open an issue on GitHub
