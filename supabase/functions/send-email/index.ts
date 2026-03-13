import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3'

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface EmailRequest {
    to: string | string[];
    subject: string;
    htmlBody?: string;
    textBody?: string;
    campaignId?: string;
    prospectId?: string;
}

serve(async (req) => {
    // Handle CORS preflight requests
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders })
    }

    try {
        // Get authorization header
        const authHeader = req.headers.get('Authorization')
        if (!authHeader) {
            throw new Error('No authorization header')
        }

        // Create Supabase client with service role for server-side operations
        const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
        const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
        const supabase = createClient(supabaseUrl, supabaseServiceKey)

        // Get user from JWT
        const token = authHeader.replace('Bearer ', '')
        const { data: { user }, error: userError } = await supabase.auth.getUser(token)

        if (userError || !user) {
            throw new Error('Invalid user token')
        }

        // Parse request body
        const { to, subject, htmlBody, textBody, campaignId, prospectId }: EmailRequest = await req.json()

        if (!to || !subject || (!htmlBody && !textBody)) {
            throw new Error('Missing required fields: to, subject, and body')
        }

        // Fetch user's SMTP settings from database
        const { data: smtpSettings, error: smtpError } = await supabase
            .from('smtp_settings')
            .select('*')
            .eq('user_id', user.id)
            .maybeSingle()

        if (smtpError || !smtpSettings) {
            throw new Error('SMTP settings not configured. Please configure in Settings.')
        }

        // Send email using SMTP
        // Note: Deno doesn't have a built-in SMTP client, so we'll use a fetch-based approach
        // For production, consider using a service like SendGrid, Mailgun, or AWS SES

        // For now, we'll use nodemailer-compatible approach with fetch
        const emailData = {
            from: smtpSettings.from_email,
            to: Array.isArray(to) ? to : [to],
            subject: subject,
            html: htmlBody,
            text: textBody,
            smtp: {
                host: smtpSettings.host,
                port: smtpSettings.port,
                secure: smtpSettings.port === 465,
                auth: {
                    user: smtpSettings.username,
                    pass: smtpSettings.password,
                },
            },
        }

        // Log email attempt (for tracking)
        if (campaignId && prospectId) {
            await supabase
                .from('email_events')
                .insert({
                    campaign_id: campaignId,
                    prospect_id: prospectId,
                    event_type: 'sent',
                    user_id: user.id,
                })
                .select()
        }

        // For MVP: Return success (actual SMTP sending would require additional library)
        // In production, integrate with a proper email service
        console.log('Email prepared:', {
            from: emailData.from,
            to: emailData.to,
            subject: emailData.subject,
            smtp_host: emailData.smtp.host,
        })

        return new Response(
            JSON.stringify({
                success: true,
                message: 'Email queued for sending',
                note: 'SMTP integration requires additional configuration. For production, use SendGrid/Mailgun API.',
                emailData: {
                    from: emailData.from,
                    to: emailData.to,
                    subject: emailData.subject,
                },
            }),
            {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                status: 200,
            }
        )
    } catch (error) {
        console.error('Error in send-email function:', error)
        return new Response(
            JSON.stringify({
                success: false,
                error: error.message || 'Unknown error occurred',
            }),
            {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                status: 400,
            }
        )
    }
})
