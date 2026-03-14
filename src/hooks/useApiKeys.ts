import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

export type ApiProvider = 'brevo' | 'openai' | 'google_maps' | 'facebook' | 'linkedin' | 'twilio' | 'smtp';

export interface ApiKey {
    id: string;
    provider: ApiProvider;
    label: string;
    api_key: string;
    api_secret?: string;
    is_active: boolean;
    last_tested_at?: string;
    last_test_status?: 'success' | 'failed' | 'pending';
    last_test_message?: string;
    created_at: string;
}

export function useApiKeys() {
    const { user } = useAuth();
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Récupère toutes les clés de l'utilisateur
    const getKeys = useCallback(async (): Promise<ApiKey[]> => {
        if (!user) return [];
        setLoading(true);
        try {
            const { data, error } = await supabase
                .from('user_api_keys')
                .select('*')
                .eq('user_id', user.id)
                .order('created_at', { ascending: false });
            if (error) { setError(error.message); return []; }
            return data || [];
        } catch (err: unknown) {
            console.error("getKeys internal error:", err);
            setError((err instanceof Error ? err.message : "Une erreur inconnue s'est produite") || 'Error fetching keys');
            return [];
        } finally {
            setLoading(false);
        }
    }, [user]);

    // Récupère la clé d'un provider spécifique
    const getKeyByProvider = useCallback(async (provider: ApiProvider): Promise<string | null> => {
        if (!user) return null;
        try {
            const { data } = await supabase
                .from('user_api_keys')
                .select('api_key')
                .eq('user_id', user.id)
                .eq('provider', provider)
                .eq('is_active', true)
                .maybeSingle();
            return (data as any)?.api_key || null;
        } catch (err) {
            console.error("getKeyByProvider internal error:", err);
            return null;
        }
    }, [user]);

    // Sauvegarde ou met à jour une clé
    const saveKey = useCallback(async (
        provider: ApiProvider,
        apiKey: string,
        label?: string,
        apiSecret?: string
    ): Promise<boolean> => {
        if (!user) return false;
        setLoading(true);
        const { error } = await (supabase
            .from('user_api_keys') as any)
            .upsert({
                user_id: user.id,
                provider,
                api_key: apiKey,
                api_secret: apiSecret,
                label: label || provider,
                is_active: true,
                last_test_status: 'pending',
            }, { onConflict: 'user_id,provider' });
        setLoading(false);
        if (error) { setError(error.message); return false; }
        return true;
    }, [user]);

    // Supprime une clé
    const deleteKey = useCallback(async (provider: ApiProvider): Promise<boolean> => {
        if (!user) return false;
        const { error } = await supabase
            .from('user_api_keys')
            .delete()
            .eq('user_id', user.id)
            .eq('provider', provider);
        return !error;
    }, [user]);

    // Teste une clé API (vérification réelle)
    const testKey = useCallback(async (provider: ApiProvider): Promise<{ ok: boolean; message: string }> => {
        const key = await getKeyByProvider(provider);
        if (!key) return { ok: false, message: 'Aucune clé configurée' };

        let result = { ok: false, message: '' };

        try {
            if (provider === 'openai') {
                const res = await fetch('https://api.openai.com/v1/models', {
                    headers: { Authorization: `Bearer ${key}` }
                });
                result = res.ok
                    ? { ok: true, message: 'Clé OpenAI valide' }
                    : { ok: false, message: 'Clé OpenAI invalide ou quota dépassé' };
            } else if (provider === 'smtp') {
                // SMTP connection is tested in ApiKeysSettings via testSmtpConnection in emailService
                result = { ok: true, message: 'Configuration SMTP enregistrée' };
            } else {
                result = { ok: true, message: 'Clé sauvegardée (test non disponible pour ce provider)' };
            }
        } catch {
            result = { ok: false, message: 'Erreur réseau lors du test' };
        }

        // Mise à jour du statut de test en base
        if (user) {
            await (supabase.from('user_api_keys') as any).update({
                last_tested_at: new Date().toISOString(),
                last_test_status: result.ok ? 'success' : 'failed',
                last_test_message: result.message,
            }).eq('user_id', user.id).eq('provider', provider);
        }

        return result;
    }, [user, getKeyByProvider]);

    return { getKeys, getKeyByProvider, saveKey, deleteKey, testKey, loading, error };
}
