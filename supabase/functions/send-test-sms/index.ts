import { serve } from "https://deno.land/std@0.190.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface TestSmsRequest {
  to: string;
  message?: string;
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const messagebirdApiKey = Deno.env.get('MESSAGEBIRD_API_KEY');
    
    if (!messagebirdApiKey) {
      console.error('MESSAGEBIRD_API_KEY not configured');
      return new Response(
        JSON.stringify({ error: 'MessageBird API key not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { to, message }: TestSmsRequest = await req.json();
    
    if (!to) {
      return new Response(
        JSON.stringify({ error: 'Phone number (to) is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const smsMessage = message || '✅ Aivia SMS Test - Your MessageBird integration is working correctly!';
    
    console.log(`Sending test SMS to ${to}`);

    // Send SMS via MessageBird API
    const response = await fetch('https://rest.messagebird.com/messages', {
      method: 'POST',
      headers: {
        'Authorization': `AccessKey ${messagebirdApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        originator: 'Aivia',
        recipients: [to.replace(/\s/g, '')],
        body: smsMessage,
      }),
    });

    const result = await response.json();
    
    if (!response.ok) {
      console.error('MessageBird API error:', result);
      return new Response(
        JSON.stringify({ error: 'Failed to send SMS', details: result }),
        { status: response.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('SMS sent successfully:', result);

    return new Response(
      JSON.stringify({ success: true, messageId: result.id }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: unknown) {
    console.error('Error sending test SMS:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
