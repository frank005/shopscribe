# ShopScribe - Live Shopping App

A Whatnot-style live shopping web application powered by **Agora Web SDK** and **Agora Conversational AI**. Hosts can broadcast video/audio, describe products naturally, and trigger AI-generated product overlays. Audiences can discover and join live channels to watch streams with real-time product information.

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
OPENAI_MODEL=gpt-4o-mini

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
