/**
 * Service d'Email - Enveloppe côté client pour la fonction Edge send-email
 */

import { supabase } from '@/integrations/supabase/client';

export interface SendEmailParams {
    to: string | string[];
    subject: string;
    htmlBody?: string;
    textBody?: string;
    campaignId?: string;
    prospectId?: string;
}

export interface SendEmailResponse {
    success: boolean;
    message?: string;
    error?: string;
    note?: string;
}

/**
 * Envoie un email via une Supabase Edge Function
 */
export const sendEmail = async (params: SendEmailParams): Promise<SendEmailResponse> => {
    try {
        const { data, error } = await supabase.functions.invoke('send-email', {
            body: params,
        });

        if (error) {
            console.error('Error invoking send-email function:', error);
            return {
                success: false,
                error: error.message || 'Failed to send email',
            };
        }

        return data as SendEmailResponse;
    } catch (error: any) {
        console.error('Error in sendEmail:', error);
        return {
            success: false,
            error: error.message || 'Unknown error occurred',
        };
    }
};

/**
 * Envoie des emails de campagne à plusieurs prospects avec personnalisation
 */
export const sendCampaignEmails = async (
    campaignId: string,
    prospects: Array<{ id: string; email: string; name: string }>,
    emailTemplate: { subject: string; htmlBody?: string; textBody?: string },
    onProgress?: (sent: number, total: number) => void
): Promise<{ sent: number; failed: number; errors: string[] }> => {
    let sent = 0;
    let failed = 0;
    const errors: string[] = [];

    for (let i = 0; i < prospects.length; i++) {
        const prospect = prospects[i];

        try {
            // Personnalisation de l'email (remplace {{name}} par le nom réel)
            const personalizedSubject = emailTemplate.subject.replace(/\{\{name\}\}/g, prospect.name);
            const personalizedHtml = emailTemplate.htmlBody?.replace(/\{\{name\}\}/g, prospect.name);
            const personalizedText = emailTemplate.textBody?.replace(/\{\{name\}\}/g, prospect.name);

            const result = await sendEmail({
                to: prospect.email,
                subject: personalizedSubject,
                htmlBody: personalizedHtml,
                textBody: personalizedText,
                campaignId,
                prospectId: prospect.id,
            });

            if (result.success) {
                sent++;
            } else {
                failed++;
                errors.push(`${prospect.email}: ${result.error}`);
            }
        } catch (error: any) {
            failed++;
            errors.push(`${prospect.email}: ${error.message}`);
        }

        // Rapport de progression
        if (onProgress) {
            onProgress(i + 1, prospects.length);
        }

        // Petit délai pour éviter la limitation de débit (rate limiting)
        if (i < prospects.length - 1) {
            await new Promise(resolve => setTimeout(resolve, 100));
        }
    }

    return { sent, failed, errors };
};
