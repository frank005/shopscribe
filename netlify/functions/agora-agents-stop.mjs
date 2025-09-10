import fetch from 'node-fetch';

export default async function handler(event, context) {
  // Only allow POST requests
  if (event.httpMethod !== 'POST') {
    return new Response(JSON.stringify({ 
      success: false, 
      error: 'Method not allowed' 
    }), {
      status: 405,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  try {
    // Get request body
    const body = await event.json();
    const { agentId } = body;

    if (!agentId) {
      return new Response(JSON.stringify({ 
        success: false, 
        error: 'Agent ID is required' 
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Get environment variables
    const appId = process.env.REACT_APP_AGORA_APP_ID;
    const customerId = process.env.AGORA_CUSTOMER_ID;
    const customerSecret = process.env.AGORA_CUSTOMER_SECRET;

    if (!appId || !customerId || !customerSecret) {
      return new Response(JSON.stringify({ 
        success: false, 
        error: 'Missing required environment variables' 
      }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Construct the Agora API URL - try different possible endpoints
    const baseUrl = process.env.AGORA_BASE_URL || 'https://api.agora.io';
    // Try the leave endpoint instead of stop
    const url = `${baseUrl}/api/conversational-ai-agent/v2/projects/${appId}/leave`;

    // Create basic auth header
    const auth = Buffer.from(`${customerId}:${customerSecret}`).toString('base64');

    console.log('Stopping Agora agent:', agentId);
    console.log('Agora API URL:', url);

    // Make the API call to stop the agent
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${auth}`,
        'Content-Type': 'application/json'
      }
    });

    const responseData = await response.text();
    console.log('Agora API response status:', response.status);
    console.log('Agora API response:', responseData);

    if (!response.ok) {
      return new Response(JSON.stringify({ 
        success: false, 
        error: `Agora API error: ${response.status} ${response.statusText} - ${responseData}` 
      }), {
        status: response.status,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Parse the response
    let parsedResponse;
    try {
      parsedResponse = JSON.parse(responseData);
    } catch (parseError) {
      console.error('Error parsing Agora API response:', parseError);
      return new Response(JSON.stringify({ 
        success: false, 
        error: 'Invalid response from Agora API' 
      }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    return new Response(JSON.stringify({ 
      success: true, 
      data: parsedResponse 
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Error stopping Agora agent:', error);
    return new Response(JSON.stringify({ 
      success: false, 
      error: error.message 
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}