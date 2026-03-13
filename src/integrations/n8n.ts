import { supabase } from "@/integrations/supabase/client";

export const N8N_WEBHOOK_URLS = {
    GOOGLE: import.meta.env.VITE_N8N_WEBHOOK_GOOGLE || "",
    FACEBOOK: import.meta.env.VITE_N8N_WEBHOOK_FACEBOOK || "",
    LINKEDIN: import.meta.env.VITE_N8N_WEBHOOK_LINKEDIN || "",
    INSTAGRAM: import.meta.env.VITE_N8N_WEBHOOK_INSTAGRAM || "",
    TIKTOK: import.meta.env.VITE_N8N_WEBHOOK_TIKTOK || "",
    WHATSAPP: import.meta.env.VITE_N8N_WEBHOOK_WHATSAPP || "",
    GOVCON: import.meta.env.VITE_N8N_WEBHOOK_GOVCON || "",
    GOOGLE_MAPS: import.meta.env.VITE_N8N_WEBHOOK_GOOGLE_MAPS || "",
    ENRICH: import.meta.env.VITE_N8N_WEBHOOK_ENRICH || "",
    AI_ENRICH: import.meta.env.VITE_N8N_WEBHOOK_AI_ENRICH || "",
    LINKEDIN_XRAY: import.meta.env.VITE_N8N_WEBHOOK_LINKEDIN_XRAY || "",
    AI_EMAIL_GENERATION: import.meta.env.VITE_N8N_WEBHOOK_AI_EMAIL_GENERATION || "",
    PAGES_JAUNES: import.meta.env.VITE_N8N_WEBHOOK_PAGES_JAUNES || "",
};

export type Channel = keyof typeof N8N_WEBHOOK_URLS;

/**
 * Trigger an n8n workflow for a specific channel
 * @param channel The channel to trigger (e.g., 'LINKEDIN')
 * @param params Additional parameters for the workflow
 */
export const triggerN8nWorkflow = async (channel: Channel, params: Record<string, any>) => {
    const webhookUrl = N8N_WEBHOOK_URLS[channel];

    if (!webhookUrl) {
        console.warn(`No webhook URL configured for channel: ${channel}`);
        return { success: false, message: "Webhook non configuré" };
    }

    try {
        const response = await fetch(webhookUrl, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                ...params,
                timestamp: new Date().toISOString(),
            }),
        });

        if (!response.ok) {
            throw new Error(`n8n webhook failed: ${response.statusText}`);
        }

        return { success: true, data: await response.json() };
    } catch (error: any) {
        console.error(`Error triggering n8n for ${channel}:`, error);
        return { success: false, error: error.message };
    }
};
