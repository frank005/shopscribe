// Agora Host List API - Serverless Function
import fetch from 'node-fetch';
import { config } from 'dotenv';

// Load environment variables from .env file
config();

// Environment variables
const AGORA_APP_ID = process.env.REACT_APP_AGORA_APP_ID;
const AGORA_CUSTOMER_ID = process.env.AGORA_CUSTOMER_ID;
const AGORA_CUSTOMER_SECRET = process.env.AGORA_CUSTOMER_SECRET;

// Debug environment variables
console.log('🔧 Environment variables loaded:');
console.log('🔧 AGORA_APP_ID:', AGORA_APP_ID ? `${AGORA_APP_ID.substring(0, 8)}...` : 'MISSING');
console.log('🔧 AGORA_CUSTOMER_ID:', AGORA_CUSTOMER_ID ? `${AGORA_CUSTOMER_ID.substring(0, 8)}...` : 'MISSING');
console.log('🔧 AGORA_CUSTOMER_SECRET:', AGORA_CUSTOMER_SECRET ? `${AGORA_CUSTOMER_SECRET.substring(0, 8)}...` : 'MISSING');

// Generate Basic Auth header
function generateAuthHeader() {
  if (!AGORA_CUSTOMER_ID || !AGORA_CUSTOMER_SECRET) {
    return '';
  }
  const credentials = Buffer.from(`${AGORA_CUSTOMER_ID}:${AGORA_CUSTOMER_SECRET}`).toString('base64');
  return `Basic ${credentials}`;
}

// Query host and audience list for a specific channel
async function queryHostList(channelName) {
  try {
    // URL encode the channel name to handle spaces and special characters
    const encodedChannelName = encodeURIComponent(channelName);
    const url = `https://api.agora.io/dev/v1/channel/user/${AGORA_APP_ID}/${encodedChannelName}`;
    
    console.log('🔍 Querying Agora API:', url);
    console.log('🔍 App ID:', AGORA_APP_ID);
    console.log('🔍 Channel Name:', channelName);
    console.log('🔍 Encoded Channel Name:', encodedChannelName);
    console.log('🔍 Auth Header:', generateAuthHeader() ? 'Present' : 'Missing');
    
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Authorization': generateAuthHeader(),
        'Accept': 'application/json'
      }
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ Agora API Error:', {
        status: response.status,
        statusText: response.statusText,
        url: url,
        errorText: errorText
      });
      
      // If channel doesn't exist (404), return empty data instead of throwing error
      if (response.status === 404) {
        console.log('📺 Channel does not exist, returning empty data');
        return {
          channelName,
          totalUsers: 0,
          hostCount: 0,
          viewerCount: 0,
          broadcasters: [],
          audience: []
        };
      }
      
      throw new Error(`Agora API error: ${response.status} - ${response.statusText}`);
    }

    const data = await response.json();
    
    if (!data.success) {
      throw new Error(`Agora API returned error: ${data.message || 'Unknown error'}`);
    }
    
    // Check if channel exists
    if (!data.data.channel_exist) {
      return {
        channelName,
        totalUsers: 0,
        hostCount: 0,
        viewerCount: 0,
        broadcasters: [],
        audience: []
      };
    }
    
    const broadcasters = data.data?.broadcasters || [];
    const audience = data.data?.audience || [];
    const hostCount = broadcasters.length;
    const viewerCount = audience.length;
    const totalUsers = hostCount + viewerCount;
    
    return {
      channelName,
      totalUsers,
      hostCount,
      viewerCount,
      broadcasters,
      audience
    };
  } catch (error) {
    console.error('Error querying host list:', error);
    throw error;
  }
}

// Netlify function handler
export default async (req, ctx) => {
  try {
    // Only allow GET requests
    if (req.method !== "GET") {
      return new Response(JSON.stringify({ 
        success: false,
        error: "Method Not Allowed",
        allowedMethods: ["GET"]
      }), {
        status: 405,
        headers: { 
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Headers": "Content-Type"
        },
      });
    }

    // Get channel name from query parameters
    const url = new URL(req.url);
    const channelName = url.searchParams.get('channel');
    
    if (!channelName) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Missing required parameter: channel'
      }), {
        status: 400,
        headers: { 
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Headers": "Content-Type"
        },
      });
    }

    const result = await queryHostList(channelName);

    return new Response(JSON.stringify({
      success: true,
      data: result
    }), {
      status: 200,
      headers: { 
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "Content-Type"
      },
    });

  } catch (error) {
    console.error('Host list error:', error);

    return new Response(JSON.stringify({
      success: false,
      error: error.message || 'Internal server error'
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
