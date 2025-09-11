// Simple Agora Channel List API - Serverless Function
import fetch from 'node-fetch';
import { config } from 'dotenv';

// Load environment variables from .env file
config();

// Environment variables
const AGORA_APP_ID = process.env.REACT_APP_AGORA_APP_ID;
const AGORA_CUSTOMER_ID = process.env.AGORA_CUSTOMER_ID;
const AGORA_CUSTOMER_SECRET = process.env.AGORA_CUSTOMER_SECRET;

// Generate Basic Auth header
function generateAuthHeader() {
  if (!AGORA_CUSTOMER_ID || !AGORA_CUSTOMER_SECRET) {
    return '';
  }
  const credentials = Buffer.from(`${AGORA_CUSTOMER_ID}:${AGORA_CUSTOMER_SECRET}`).toString('base64');
  return `Basic ${credentials}`;
}

// Simple channel list query - just get channels, no complex host logic
async function queryChannelList() {
  try {
    const url = `https://api.agora.io/dev/v1/channel/${AGORA_APP_ID}?page_no=0&page_size=20`;
    
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Authorization': generateAuthHeader(),
        'Accept': 'application/json'
      }
    });

    if (!response.ok) {
      throw new Error(`Agora API error: ${response.status}`);
    }

    const data = await response.json();
    
    if (!data.success) {
      throw new Error(`Agora API returned error: ${data.message || 'Unknown error'}`);
    }
    
    const channels = data.data?.channels || [];
    
    // Debug: Log the channels being returned
    console.log('📺 Channels returned from Agora API:', channels.length);
    channels.forEach((channel, index) => {
      console.log(`📺 Channel ${index + 1}:`, {
        channel_name: channel.channel_name,
        user_count: channel.user_count,
        create_time: channel.create_time
      });
    });
    
    // Simple response - just return channels as-is
    return {
      page: 1,
      pageSize: 20,
      total: data.data?.total_size || 0,
      channels: channels
    };
  } catch (error) {
    console.error('Error querying channel list:', error);
    throw error;
  }
}

// Netlify function handler - using newer format like onboardingbot
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

    const result = await queryChannelList();

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
    console.error('Channel list error:', error);

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