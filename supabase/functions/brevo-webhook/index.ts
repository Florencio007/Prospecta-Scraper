import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.7.1"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error('Variables d\'environnement manquantes')
    }

    // Initialize Supabase client
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // Brevo sends a JSON payload for webhook events
    const payload = await req.json()

    console.log("Brevo Webhook Payload:", JSON.stringify(payload))

    // Example Brevo Webhook Payload:
    // { "event": "opened", "email": "user@example.com", "id": 123456, "date": "2024-03-10...", "message-id": "<some-id@brevo.com>", ... }

    const event = payload.event
    const brevoMessageId = payload['message-id']

    if (!event || !brevoMessageId) {
      return new Response(JSON.stringify({ message: "Payload ignoré, 'event' ou 'message-id' manquant" }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200, // Return 200 so Brevo doesn't retry
      })
    }

    // Find the campaign recipient associated with this message-id
    const { data: recipient, error: recipientError } = await supabase
      .from('campaign_recipients')
      .select('id, campaign_id, status')
      .eq('brevo_message_id', brevoMessageId)
      .maybeSingle()

    if (recipientError || !recipient) {
      console.error("Destinataire introuvable pour ce message-id:", brevoMessageId)
      return new Response(JSON.stringify({ message: "Destinataire introuvable" }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      })
    }

    const campaignId = recipient.campaign_id

    // Map Brevo event to database fields and logic
    switch (event) {
      case 'delivered':
        // Update recipient status to delivered (if needed)
        await supabase.from('campaign_recipients').update({ status: 'delivered' }).eq('id', recipient.id)
        break;

      case 'opened':
        // Only increment if not already opened
        if (recipient.status !== 'opened' && recipient.status !== 'clicked' && recipient.status !== 'replied') {
          await supabase.from('campaign_recipients').update({ status: 'opened' }).eq('id', recipient.id)
          // Increment opened_count using RPC or query (here we do a direct read/write or RPC is better, but since it's an edge function we can just read/update, or better write a quick RPC)
          // Since we don't have an RPC, we will fetch campaign and update
          const { data: campaign } = await supabase.from('email_campaigns').select('opened_count').eq('id', campaignId).single()
          if (campaign) {
            await supabase.from('email_campaigns').update({ opened_count: (campaign.opened_count || 0) + 1 }).eq('id', campaignId)
          }
        }
        break;

      case 'click':
        // Only update if not already clicked
        if (recipient.status !== 'clicked' && recipient.status !== 'replied') {
          await supabase.from('campaign_recipients').update({ status: 'clicked' }).eq('id', recipient.id)
          const { data: campaign } = await supabase.from('email_campaigns').select('clicked_count').eq('id', campaignId).single()
          if (campaign) {
            await supabase.from('email_campaigns').update({ clicked_count: (campaign.clicked_count || 0) + 1 }).eq('id', campaignId)
          }
        }
        break;

      case 'bounce':
      case 'hard_bounce':
      case 'soft_bounce':
      case 'blocked':
        // Handle bounce
        await supabase.from('campaign_recipients').update({ status: 'failed', bounce_reason: payload.reason || event }).eq('id', recipient.id)
        const { data: bCampaign } = await supabase.from('email_campaigns').select('bounced_count').eq('id', campaignId).single()
        if (bCampaign) {
          await supabase.from('email_campaigns').update({ bounced_count: (bCampaign.bounced_count || 0) + 1 }).eq('id', campaignId)
        }
        break;

      case 'unsubscribed':
        // Handle unsubscribe
        await supabase.from('campaign_recipients').update({ status: 'unsubscribed' }).eq('id', recipient.id)
        const { data: uCampaign } = await supabase.from('email_campaigns').select('unsubscribed_count').eq('id', campaignId).single()
        if (uCampaign) {
          await supabase.from('email_campaigns').update({ unsubscribed_count: (uCampaign.unsubscribed_count || 0) + 1 }).eq('id', campaignId)
        }
        break;

      case 'spam':
        // Handle spam report
        await supabase.from('campaign_recipients').update({ status: 'unsubscribed' }).eq('id', recipient.id) // Treat as unsubscribed
        break;

      default:
        console.log(`Événement non pris en charge: ${event}`)
        break;
    }

    return new Response(JSON.stringify({ message: "Webhook traité avec succès" }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    })

  } catch (error: any) {
    console.error('Erreur lors du traitement du webhook Brevo:', error)
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400, // Important, sometimes returning 400 makes the webhook retry. We want that if it's an internal error.
    })
  }
})
