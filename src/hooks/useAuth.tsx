import { createContext, useContext, useEffect, useState, ReactNode, useRef } from "react";
import { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { Tables } from "@/integrations/supabase/types";

/**
 * Interface représentant le profil utilisateur stocké dans la base de données
 */
/**
 * Interface représentant le profil utilisateur stocké dans la base de données
 */
export type Profile = Tables<"profiles">;

/**
 * Type pour le contexte d'authentification
 */
/**
 * Type pour le contexte d'authentification
 */
export interface AuthContextType {
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
  const fetchingProfileFor = useRef<string | null>(null);

  /**
   * Récupère le profil utilisateur depuis Supabase
   */
    const fetchProfile = async (userId: string, retryCount = 0) => {
        if (!userId || !mounted.current) return;
        
        // Prevent duplicate parallel fetches for the same user
        if (fetchingProfileFor.current === userId && retryCount === 0) {
            console.log('[Auth] Already fetching profile for:', userId);
            return;
        }

        fetchingProfileFor.current = userId;
        console.log(`[Auth] Checking profile for: ${userId} (attempt ${retryCount + 1})`);
        
        try {
            const { data, error } = await Promise.race([
                supabase
                    .from("profiles")
                    .select("*")
                    .eq("user_id", userId)
                    .limit(1)
                    .then(res => ({ data: res.data?.[0] || null, error: res.error })),
                new Promise<any>((_, reject) => 
                    setTimeout(() => reject(new Error("Profile fetch timeout")), 15000)
                )
            ]);

            if (error) {
                console.error("[Auth] Error fetching profile:", error);
                throw error;
            }

            if (mounted.current) {
                if (data) {
                    console.log('[Auth] Profile updated for:', userId);
                    setProfile(data);
                } else {
                    console.log('[Auth] No profile found for:', userId);
                }
            }
            fetchingProfileFor.current = null;
        } catch (err) {
            console.error("[Auth] Profile fetch failed or timed out:", err);
            
            // Auto-retry once after 2 seconds if under retry limit
            if (retryCount < 1 && mounted.current) {
                console.log('[Auth] Retrying profile fetch in 2s...');
                setTimeout(() => fetchProfile(userId, retryCount + 1), 2000);
            } else {
                fetchingProfileFor.current = null;
            }
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
        
        // SYNC METADATA: If profile is missing name/photo, but session has them, update profile!
        const metadata = session.user.user_metadata;
        const googleName = metadata?.full_name || metadata?.name;
        const googlePhoto = metadata?.avatar_url || metadata?.picture;

        if ((!profile?.full_name && googleName) || (!profile?.avatar_url && googlePhoto)) {
            console.log('[Auth] Syncing profile metadata from session...');
            const { error: syncError } = await (supabase
                .from('profiles') as any)
                .update({
                    full_name: profile?.full_name || googleName,
                    avatar_url: profile?.avatar_url || googlePhoto
                })
                .eq('user_id', session.user.id);
            
            if (syncError) console.error('[Auth] Sync error:', syncError);
            else await fetchProfile(session.user.id);
        }

        // Add a race to prevent hanging forever
        try {
            await Promise.race([
                fetchProfile(session.user.id),
                new Promise((_, reject) => 
                    setTimeout(() => reject(new Error("Refresh profile timeout")), 15000)
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
