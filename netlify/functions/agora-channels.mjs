// Simple Agora Channel List API - Serverless Function
import fetch from 'node-fetch';

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

// Netlify function handler - using older format that was working
export default async function handler(event, context) {
  const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS'
  };

  // Handle CORS preflight
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers
    };
  }

  try {
    const result = await queryChannelList();

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        data: result
      })
    };

  } catch (error) {
    console.error('Channel list error:', error);

    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        success: false,
        error: error.message || 'Internal server error'
      })
    };
  }
}