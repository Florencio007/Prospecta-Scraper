/**
 * Journalisation d'activité - Utilitaire pour enregistrer les actions utilisateur dans la table activity_log
 */

import { supabase } from '@/integrations/supabase/client';

export type ActivityType =
    | 'prospect_added'
    | 'prospect_converted'
    | 'campaign_created'
    | 'campaign_sent'
    | 'export_generated'
    | 'email_sent'
    | 'login';

export interface LogActivityParams {
    userId: string;
    actionType: ActivityType;
    entityType?: 'prospect' | 'campaign' | 'export' | 'email' | 'auth';
    entityId?: string;
    metadata?: Record<string, any>;
}

/**
 * Enregistre une activité dans la table activity_log
 */
export const logActivity = async (params: LogActivityParams): Promise<void> => {
    try {
        const { error } = await supabase
            .from('activity_log')
            .insert({
                user_id: params.userId,
                action_type: params.actionType,
                entity_type: params.entityType,
                entity_id: params.entityId,
                metadata: params.metadata || {},
            });

        if (error) {
            console.error('Error logging activity:', error);
        }
    } catch (error) {
        console.error('Error in logActivity:', error);
    }
};

/**
 * Fonctions utilitaires pour les activités courantes
 */

export const logProspectAdded = (userId: string, prospectId: string, prospectName: string) => {
    return logActivity({
        userId,
        actionType: 'prospect_added',
        entityType: 'prospect',
        entityId: prospectId,
        metadata: { name: prospectName },
    });
};

export const logCampaignCreated = (userId: string, campaignId: string, campaignName: string) => {
    return logActivity({
        userId,
        actionType: 'campaign_created',
        entityType: 'campaign',
        entityId: campaignId,
        metadata: { campaign_name: campaignName },
    });
};

export const logCampaignSent = (userId: string, campaignId: string, campaignName: string, recipientCount: number) => {
    return logActivity({
        userId,
        actionType: 'campaign_sent',
        entityType: 'campaign',
        entityId: campaignId,
        metadata: { campaign_name: campaignName, recipient_count: recipientCount },
    });
};

export const logExportGenerated = (userId: string, format: string, recordCount: number) => {
    return logActivity({
        userId,
        actionType: 'export_generated',
        entityType: 'export',
        metadata: { format, record_count: recordCount },
    });
};

export const logEmailSent = (userId: string, emailId: string, recipientEmail: string) => {
    return logActivity({
        userId,
        actionType: 'email_sent',
        entityType: 'email',
        entityId: emailId,
        metadata: { recipient: recipientEmail },
    });
};
