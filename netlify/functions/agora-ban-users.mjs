import { config } from 'dotenv';

// Load environment variables
config();

export default async (request, context) => {
  // Handle CORS
  if (request.method === 'OPTIONS') {
    return new Response(null, {
      status: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
      },
    });
  }

  if (request.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  try {
    const { channelName } = await request.json();

    if (!channelName) {
      return new Response(JSON.stringify({ error: 'Channel name is required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    console.log('🚫 Banning all users from channel:', channelName);
    console.log('🚫 Ban request details:', {
      channelName,
      timestamp: new Date().toISOString()
    });

    const appId = process.env.REACT_APP_AGORA_APP_ID;
    const customerId = process.env.AGORA_CUSTOMER_ID;
    const customerSecret = process.env.AGORA_CUSTOMER_SECRET;

    // Debug environment variables
    console.log('🔧 Environment variables loaded:');
    console.log('🔧 AGORA_APP_ID:', appId ? `${appId.substring(0, 8)}...` : 'MISSING');
    console.log('🔧 AGORA_CUSTOMER_ID:', customerId ? `${customerId.substring(0, 8)}...` : 'MISSING');
    console.log('🔧 AGORA_CUSTOMER_SECRET:', customerSecret ? `${customerSecret.substring(0, 8)}...` : 'MISSING');

    if (!appId || !customerId || !customerSecret) {
      console.error('❌ Missing Agora credentials');
      return new Response(JSON.stringify({ error: 'Agora credentials not configured' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Create basic auth header
    const authHeader = Buffer.from(`${customerId}:${customerSecret}`).toString('base64');

    const banResponse = await fetch('https://api.sd-rtn.com/dev/v1/kicking-rule', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Basic ${authHeader}`
      },
        body: JSON.stringify({
          appid: appId,
          cname: channelName,
          uid: null,
          ip: "",
          time_in_seconds: 60, // 60 seconds - ensure users are properly kicked
          privileges: ["join_channel"]
        })
    });

    if (!banResponse.ok) {
      const errorData = await banResponse.json();
      console.error('❌ Failed to ban users:', errorData);
      return new Response(JSON.stringify({ error: errorData.message || 'Failed to ban users from channel' }), {
        status: banResponse.status,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const banData = await banResponse.json();
    console.log('✅ Users banned from channel:', banData);
    console.log('✅ Ban response status:', banResponse.status);
    console.log('✅ Ban response headers:', Object.fromEntries(banResponse.headers.entries()));

    return new Response(JSON.stringify({ 
      success: true, 
      data: banData 
    }), {
      status: 200,
      headers: { 
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
    });

  } catch (error) {
    console.error('❌ Error banning users:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};
