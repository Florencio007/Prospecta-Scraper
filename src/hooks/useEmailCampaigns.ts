import { useState, useCallback, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useApiKeys } from '@/hooks/useApiKeys';
import { sendSingleEmail, personalizeTemplate, getWarmupLimit, randomThrottle } from '@/services/emailService';

export interface EmailCampaign {
    id: string;
    name: string;
    status: 'draft' | 'active' | 'paused' | 'completed' | 'failed';
    from_name: string;
    from_email: string;
    reply_to?: string;
    subject: string;
    body_html?: string;
    body_text?: string;
    tags: string[];
    daily_limit: number;
    throttle_min_seconds: number;
    throttle_max_seconds: number;
    schedule_time: string;
    enable_warmup: boolean;
    warmup_current_day: number;
    total_recipients: number;
    sent_count: number;
    sent_today: number;
    opened_count: number;
    clicked_count: number;
    bounced_count: number;
    unsubscribed_count: number;
    last_sent_at?: string;
    created_at: string;
    updated_at: string;
}

export function useEmailCampaigns() {
    const { user } = useAuth();
    const { getKeyByProvider } = useApiKeys();
    const [campaigns, setCampaigns] = useState<EmailCampaign[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const fetchCampaigns = useCallback(async () => {
        if (!user) return;
        setLoading(true);
        try {
            const { data, error } = await supabase
                .from('email_campaigns')
                .select('*')
                .eq('user_id', user.id)
                .order('created_at', { ascending: false });

            if (error) {
                setError(error.message);
            } else {
                setCampaigns(data || []);
            }
        } catch (err: any) {
            console.error("fetchCampaigns internal error:", err);
            setError(err.message || 'Error fetching campaigns');
        } finally {
            setLoading(false);
        }
    }, [user]);

    useEffect(() => {
        fetchCampaigns();
    }, [fetchCampaigns]);

    const createCampaign = useCallback(async (campaignData: Partial<EmailCampaign>) => {
        if (!user) return null;
        const { data, error } = await (supabase
            .from('email_campaigns') as any)
            .insert([{ ...campaignData, user_id: user.id }])
            .select()
            .single();

        if (error) {
            setError(error.message);
            throw error;
        }
        await fetchCampaigns();
        return data as EmailCampaign;
    }, [user, fetchCampaigns]);

    const updateCampaign = useCallback(async (id: string, updates: Partial<EmailCampaign>) => {
        if (!user) return false;
        const { error } = await (supabase
            .from('email_campaigns') as any)
            .update(updates)
            .eq('id', id)
            .eq('user_id', user.id);

        if (error) {
            setError(error.message);
            throw error;
        }
        await fetchCampaigns();
        return true;
    }, [user, fetchCampaigns]);

    const deleteCampaign = useCallback(async (id: string) => {
        if (!user) return false;
        const { error } = await supabase
            .from('email_campaigns')
            .delete()
            .eq('id', id)
            .eq('user_id', user.id);

        if (error) {
            setError(error.message);
            throw error;
        }
        await fetchCampaigns();
        return true;
    }, [user, fetchCampaigns]);

    const importFromProspects = useCallback(async (campaignId: string, prospectIds: string[]) => {
        if (!user || !prospectIds.length) return { success: false, added: 0, skipped: 0 };

        console.log(`[importFromProspects] Starting import of ${prospectIds.length} prospects for campaign ${campaignId}`);

        // 1. Fetch prospects info
        const { data: prospectsData, error: pError } = await supabase
            .from('prospect_data')
            .select('prospect_id, name, company, email')
            .in('prospect_id', prospectIds);

        if (pError || !prospectsData) {
            console.error("[importFromProspects] Prospect Data fetch error:", pError);
            setError(pError?.message || 'Erreur lors de la récupération des prospects');
            return { success: false, added: 0, skipped: 0 };
        }

        console.log(`[importFromProspects] Fetched data for ${prospectsData.length} / ${prospectIds.length} prospects`);

        // If some IDs were not found in prospect_data, they might be temporary IDs or already deleted
        const foundIds = new Set((prospectsData as any[]).map(p => p.prospect_id));
        const missingCount = prospectIds.length - prospectsData.length;
        if (missingCount > 0) {
            console.warn(`[importFromProspects] ${missingCount} IDs were not found in prospect_data table.`);
        }

        // 2. Fetch existing recipients for this campaign to avoid duplicates
        const { data: existingRecipients, error: eError } = await supabase
            .from('campaign_recipients')
            .select('prospect_id, email')
            .eq('campaign_id', campaignId);
        
        if (eError) {
            console.error("[importFromProspects] Error checking existing recipients:", eError);
        }

        const existingProspectIds = new Set((existingRecipients as any[] || []).map((r: any) => r.prospect_id).filter(Boolean));
        const existingEmails = new Set((existingRecipients as any[] || []).map((r: any) => r.email?.toLowerCase()).filter(Boolean));

        // 3. Filter out prospects that are already in the campaign or don't have an email
        let skippedNoEmail = 0;
        let skippedDuplicate = 0;

        const validRecipients = (prospectsData as any[]).filter(p => {
            if (!p.email) {
                skippedNoEmail++;
                return false;
            }
            const isAlreadyInById = p.prospect_id && existingProspectIds.has(p.prospect_id);
            const isAlreadyInByEmail = p.email && existingEmails.has(p.email.toLowerCase());
            
            if (isAlreadyInById || isAlreadyInByEmail) {
                skippedDuplicate++;
                return false;
            }
            return true;
        });

        const totalSkipped = skippedNoEmail + skippedDuplicate + missingCount;
        console.log(`[importFromProspects] Stats: ${validRecipients.length} to add, ${skippedNoEmail} no email, ${skippedDuplicate} duplicates, ${missingCount} missing from DB`);

        if (validRecipients.length === 0) {
            return { success: true, added: 0, skipped: totalSkipped };
        }

        const recipientsToInsert = validRecipients.map(p => {
            const names = (p.name || '').split(' ');
            return {
                campaign_id: campaignId,
                user_id: user.id,
                prospect_id: p.prospect_id,
                email: p.email,
                first_name: names[0] || '',
                last_name: names.slice(1).join(' ') || '',
                company: p.company || '',
                status: 'pending'
            };
        });

        const { error: insertError } = await (supabase
            .from('campaign_recipients') as any)
            .insert(recipientsToInsert);

        if (insertError) {
            console.error("[importFromProspects] Insert error:", insertError);
            setError(insertError.message);
            return { success: false, added: 0, skipped: totalSkipped };
        }

        // 4. Update total recipients count
        const { count } = await supabase
            .from('campaign_recipients')
            .select('*', { count: 'exact', head: true })
            .eq('campaign_id', campaignId);

        await updateCampaign(campaignId, { total_recipients: count || 0 });

        return { success: true, added: validRecipients.length, skipped: totalSkipped };
    }, [user, updateCampaign]);

    // Lancer le batch d'emails du jour
    const launchDailyBatch = useCallback(async (campaignId: string, onProgress?: (sent: number, total: number) => void) => {
        if (!user) throw new Error("Non authentifié");

        const brevoKey = await getKeyByProvider('brevo');
        if (!brevoKey) throw new Error("Clé Brevo non configurée. Allez dans Paramètres > Intégrations");

        const campaign = campaigns.find(c => c.id === campaignId);
        if (!campaign) throw new Error("Campagne non trouvée");

        // Calcul limit
        const limit = campaign.enable_warmup
            ? getWarmupLimit(campaign.warmup_current_day, campaign.daily_limit)
            : campaign.daily_limit;

        const remainingToday = Math.max(0, limit - campaign.sent_today);
        if (remainingToday === 0) {
            return { sent: 0, error: "Limite quotidienne atteinte" };
        }

        // Récupérer les destinataires
        const { data: recipients, error: rError } = await supabase
            .from('campaign_recipients')
            .select('*')
            .eq('campaign_id', campaignId)
            .eq('status', 'pending')
            .limit(remainingToday);

        if (rError) throw rError;
        if (!recipients || recipients.length === 0) {
            // Fin de la campagne
            await updateCampaign(campaignId, { status: 'completed' });
            return { sent: 0, completed: true };
        }

        let sentToday = 0;
        let errors = 0;

        await updateCampaign(campaignId, { status: 'active' });

        for (const recipient of recipients) {
            const htmlContent = personalizeTemplate(campaign.body_html || '', {
                prenom: recipient.first_name,
                nom: recipient.last_name,
                entreprise: recipient.company,
            });

            const result = await sendSingleEmail({
                brevoApiKey: brevoKey,
                to: { email: recipient.email, name: `${recipient.first_name} ${recipient.last_name}`.trim() },
                from: { email: campaign.from_email, name: campaign.from_name },
                replyTo: campaign.reply_to || campaign.from_email,
                subject: campaign.subject,
                htmlContent,
                tags: campaign.tags || [],
                campaignId: campaign.id
            });

            if (result.messageId) {
                console.log(`[useEmailCampaigns] Batch send: Email delivered to ${recipient.email}. MessageID: ${result.messageId}`);
                sentToday++;
                // Update recipient logic...
                await (supabase.from('campaign_recipients') as any).update({
                    status: 'sent',
                    sent_at: new Date().toISOString(),
                    brevo_message_id: result.messageId
                }).eq('id', recipient.id);

            } else {
                console.error(`[useEmailCampaigns] Batch send: Email FAILED to ${recipient.email}. Error: ${result.error}`);
                errors++;
                await (supabase.from('campaign_recipients') as any).update({
                    status: 'failed',
                    bounce_reason: result.error
                }).eq('id', recipient.id);
            }

            if (onProgress) onProgress(sentToday, recipients.length);

            // Throttle entre chaque email si ce n'est pas le dernier
            if (sentToday + errors < recipients.length) {
                await randomThrottle(campaign.throttle_min_seconds, campaign.throttle_max_seconds);
            }
        }

        // Update campaign logic
        await updateCampaign(campaignId, {
            sent_today: campaign.sent_today + sentToday,
            sent_count: campaign.sent_count + sentToday,
            last_sent_at: new Date().toISOString(),
            status: (sentToday + errors === recipients.length) && (recipients.length < remainingToday) ? 'completed' : 'active'
        });

        // Simuler le passage au jour suivant (dans une base réelle ce serait un CRON job minuit)
        // Mais pour simplifier, si on a atteint la limite, on avance d'un jour.
        if (campaign.enable_warmup && (campaign.sent_today + sentToday) >= limit) {
            await updateCampaign(campaignId, { warmup_current_day: campaign.warmup_current_day + 1, sent_today: 0 });
        }

        return { sent: sentToday, errors };
    }, [user, getKeyByProvider, campaigns, updateCampaign]);

    const getCampaignRecipients = useCallback(async (campaignId: string) => {
        if (!user) return [];
        const { data, error } = await supabase
            .from('campaign_recipients')
            .select('*')
            .eq('campaign_id', campaignId)
            .order('created_at', { ascending: false });

        if (error) {
            setError(error.message);
            return [];
        }
        return data || [];
    }, [user]);

    const addManualRecipient = useCallback(async (campaignId: string, recipientData: { first_name: string, last_name: string, email: string, company: string }) => {
        if (!user) return { success: false, error: 'Non authentifié' };

        const { error } = await (supabase
            .from('campaign_recipients') as any)
            .insert([{
                campaign_id: campaignId,
                user_id: user.id,
                email: recipientData.email,
                first_name: recipientData.first_name,
                last_name: recipientData.last_name,
                company: recipientData.company,
                status: 'pending'
            }]);

        if (error) {
            console.error("[addManualRecipient] Insert error:", error);
            setError(error.message);
            return { success: false, error: error.message };
        }

        // Update total recipients count
        const { count } = await supabase
            .from('campaign_recipients')
            .select('*', { count: 'exact', head: true })
            .eq('campaign_id', campaignId);

        await updateCampaign(campaignId, { total_recipients: count || 0 });

        return { success: true };
    }, [user, updateCampaign]);

    const removeRecipient = useCallback(async (campaignId: string, recipientId: string) => {
        if (!user) return false;
        
        const { error } = await supabase
            .from('campaign_recipients')
            .delete()
            .eq('id', recipientId)
            .eq('campaign_id', campaignId);

        if (error) {
            setError(error.message);
            return false;
        }

        // Update total recipients count
        const { count } = await supabase
            .from('campaign_recipients')
            .select('*', { count: 'exact', head: true })
            .eq('campaign_id', campaignId);

        await updateCampaign(campaignId, { total_recipients: count || 0 });
        
        return true;
    }, [user, updateCampaign]);

    return {
        campaigns,
        loading,
        error,
        fetchCampaigns,
        createCampaign,
        updateCampaign,
        deleteCampaign,
        importFromProspects,
        addManualRecipient,
        launchDailyBatch,
        getCampaignRecipients,
        removeRecipient
    };
}
