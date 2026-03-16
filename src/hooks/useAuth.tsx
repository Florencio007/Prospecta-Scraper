import { createContext, useContext, useEffect, useState, ReactNode, useRef } from "react";
import { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";

/**
 * Interface représentant le profil utilisateur stocké dans la base de données
 */
interface Profile {
  id: string;
  user_id: string;
  full_name: string | null;
  avatar_url: string | null;
  email: string | null;
  initials?: string;
  plan_type?: string;
  search_limit?: number;
  search_usage?: number;
  onboarding_completed?: boolean;
  company_name?: string;
  company_type?: string;
  industry?: string;
  company_size?: string;
  target_audience?: string;
  target_city?: string;
  target_channel?: string;
  value_prop?: string;
  communication_tone?: string;
  objectives?: string;
  expectations?: string;
  business_activity?: string;
  user_service_description?: string;
  role?: string;
  created_at?: string;
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
  const mounted = useRef(true);

  /**
   * Récupère le profil utilisateur depuis Supabase
   */
    const fetchProfile = async (userId: string) => {
        if (!userId) return;
        console.log('[Auth] Checking profile for:', userId);
        try {
            const { data, error } = await Promise.race([
                supabase
                    .from("profiles")
                    .select("*")
                    .eq("user_id", userId)
                    .limit(1)
                    .then(res => ({ data: res.data?.[0] || null, error: res.error })),
                new Promise<any>((_, reject) => 
                    setTimeout(() => reject(new Error("Profile fetch timeout")), 5000)
                )
            ]);

            if (error) {
                console.error("[Auth] Error fetching profile:", error);
                return;
            }
            if (mounted.current && data) {
                console.log('[Auth] Profile updated for:', userId);
                setProfile(data);
            } else if (mounted.current) {
                console.log('[Auth] No profile found for:', userId);
            }
        } catch (err) {
            console.error("[Auth] Profile fetch failed or timed out:", err);
        }
    };

    useEffect(() => {
        console.log('[Auth] Provider mounted, initializing...');

        const { data: { subscription } } = supabase.auth.onAuthStateChange(
            async (event, currentSession) => {
                if (!mounted.current) return;
                console.log('[Auth] Event:', event, currentSession?.user?.id || 'No user');
                
                setSession(currentSession);
                
                if (currentSession?.user) {
                    await fetchProfile(currentSession.user.id);
                } else {
                    setProfile(null);
                }
                
                // Set loading false once we have settled (initial session or event)
                setLoading(false);
            }
        );

        // Check initial session if onAuthStateChange hasn't triggered yet
        supabase.auth.getSession().then(({ data: { session: initialSession } }) => {
            if (mounted.current && initialSession && !session) {
                console.log('[Auth] Manual initial session check:', initialSession.user.id);
                setSession(initialSession);
                fetchProfile(initialSession.user.id).finally(() => {
                    if (mounted.current) setLoading(false);
                });
            } else if (mounted.current && !initialSession) {
                setLoading(false);
            }
        });

        return () => {
            mounted.current = false;
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
