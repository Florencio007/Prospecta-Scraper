import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export interface UsageData {
    plan_type: string;
    search_limit: number;
    search_usage: number;
    prospect_limit: number;
    current_prospects: number;
    created_at: string;
}

export const useUsage = () => {
    const { user } = useAuth();
    const [usage, setUsage] = useState<UsageData | null>(null);
    const [loading, setLoading] = useState(true);

    const fetchUsage = async () => {
        if (!user) return;
        setLoading(true);

        try {
            // Fetch profile for search usage/limits
            const { data: profiles, error: profileError } = await supabase
                .from("profiles")
                .select("*")
                .eq("user_id", user.id)
                .limit(1);

            if (profileError) {
                console.warn("[Usage] Could not fetch profile:", profileError.message);
            }

            const profile = profiles?.[0] || null;

            // Count actual prospects
            const { count, error: countError } = await supabase
                .from("prospects")
                .select("*", { count: 'exact', head: true })
                .eq("user_id", user.id);

            if (countError) {
                console.warn("[Usage] Could not count prospects:", countError.message);
            }

            const usageData: UsageData = {
                plan_type: profile?.plan_type || 'starter',
                search_limit: profile?.search_limit || 20,
                search_usage: profile?.search_usage || 0,
                prospect_limit: profile?.prospect_limit || 100,
                current_prospects: count || 0,
                created_at: profile?.created_at || new Date().toISOString()
            };

            setUsage(usageData);
        } catch (error) {
            console.error("Error fetching usage data:", error);
        } finally {
            setLoading(false);
        }
    };

    const incrementSearchUsage = async () => {
        if (!user) return;
        try {
            // @ts-ignore - RPC types are tricky with manual definition
            const { error } = await supabase.rpc('increment_search_usage', { user_id_param: user.id });
            if (error) throw error;
            await fetchUsage(); // Refresh
        } catch (error) {
            console.error("Error incrementing search usage:", error);
        }
    };

    useEffect(() => {
        fetchUsage();
    }, [user]);

    return { usage, loading, refreshUsage: fetchUsage, incrementSearchUsage };
};
