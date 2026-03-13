import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";

/**
 * Interface représentant le profil utilisateur stocké dans la base de données
 */
interface Profile {
  full_name: string;
  initials: string;
  plan_type?: string;
  search_limit?: number;
  search_usage?: number;
  onboarding_completed?: boolean;
  company_type?: string;
  industry?: string;
  company_size?: string;
  target_audience?: string;
  target_city?: string;
  target_channel?: string;
  value_prop?: string;
  communication_tone?: string;
  company_name?: string;
  objectives?: string;
  expectations?: string;
  business_activity?: string;
}

/**
 * Type pour le contexte d'authentification
 */
interface AuthContextType {
  session: Session | null;
  user: User | null;
  profile: Profile | null;
  loading: boolean;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  session: null,
  user: null,
  profile: null,
  loading: true,
  signOut: async () => { },
  refreshProfile: async () => { },
});

/**
 * Fournisseur de contexte d'authentification
 * Gère la session Supabase, l'utilisateur et son profil.
 */
export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  /**
   * Récupère le profil utilisateur depuis Supabase
   */
    const fetchProfile = async (userId: string) => {
        console.log('[Auth] Fetching profile for:', userId);
        try {
            // Add a timeout to prevent hanging forever
            const { data, error } = await Promise.race([
                supabase
                    .from("profiles")
                    .select("*")
                    .eq("user_id", userId)
                    .limit(1) // Better than maybeSingle if duplicates exist
                    .then(res => ({ data: res.data?.[0] || null, error: res.error })),
                new Promise<any>((_, reject) => 
                    setTimeout(() => reject(new Error("Profile fetch timeout")), 5000)
                )
            ]);

            if (error) {
                console.error("[Auth] Error fetching profile:", error);
                return;
            }
            console.log('[Auth] Profile fetched:', data ? 'Found' : 'Not Found');
            if (data) setProfile(data);
        } catch (err) {
            console.error("[Auth] Profile fetch failed or timed out:", err);
        }
    };

    useEffect(() => {
        let mounted = true;
        console.log('[Auth] Provider mounted, initializing...');

        const initAuth = async () => {
            try {
                // 1. Check existing session immediately
                console.log('[Auth] Checking initial session...');
                const { data: { session: initialSession }, error: sessionError } = await supabase.auth.getSession();
                
                if (sessionError) throw sessionError;
                
                if (mounted) {
                    console.log('[Auth] Initial session:', initialSession ? initialSession.user.id : 'None');
                    setSession(initialSession);
                    if (initialSession?.user) {
                        await fetchProfile(initialSession.user.id);
                    }
                    setLoading(false);
                }
            } catch (err) {
                console.error('[Auth] Initial check failed:', err);
                if (mounted) setLoading(false);
            }
        };

        const { data: { subscription } } = supabase.auth.onAuthStateChange(
            async (event, currentSession) => {
                if (!mounted) return;
                console.log('[Auth] State change event:', event, currentSession?.user?.id || 'No user');
                
                setSession(currentSession);
                if (currentSession?.user) {
                    await fetchProfile(currentSession.user.id);
                } else {
                    setProfile(null);
                }
                setLoading(false);
            }
        );

        initAuth();

        return () => {
            mounted = false;
            subscription.unsubscribe();
        };
    }, []);

  const signOut = async () => {
    await supabase.auth.signOut();
    setSession(null);
    setProfile(null);
  };

  const refreshProfile = async () => {
    if (!session?.user) return;
    
    // Add a race to prevent hanging forever
    try {
      await Promise.race([
        fetchProfile(session.user.id),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error("Refresh profile timeout")), 3000)
        )
      ]);
    } catch (err) {
      console.error("refreshProfile failed or timed out:", err);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        session,
        user: session?.user ?? null,
        profile,
        loading,
        signOut,
        refreshProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

/**
 * Hook personnalisé pour accéder au contexte d'authentification
 */
export const useAuth = () => useContext(AuthContext);
