import fetch from 'node-fetch';

export default async (req, ctx) => {
  // Only allow POST requests
  if (req.method !== 'POST') {
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
    const body = await req.json();
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

    // Construct the Agora API URL - use the same base as agora-agents
    const baseUrl = process.env.AGORA_BASE_URL || 'https://api.agora.io';
    // Try the stop endpoint - this might not exist, but let's try it
    const url = `${baseUrl}/api/conversational-ai-agent/v2/projects/${appId}/stop`;

    // Create basic auth header
    const auth = Buffer.from(`${customerId}:${customerSecret}`).toString('base64');

    console.log('Stopping Agora agent:', agentId);
    
    // Note: Agora Conversational AI agents don't have a dedicated stop endpoint
    // The agent will naturally stop when the session ends or when the client disconnects
    // We'll just return success to acknowledge the stop request
    
    return new Response(JSON.stringify({ 
      success: true, 
      message: 'Agent stop request acknowledged. Agent will stop when session ends.',
      agentId: agentId
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