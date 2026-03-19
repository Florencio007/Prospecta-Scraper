import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import Header from "@/components/dashboard/Header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { LoadingLogo } from "@/components/LoadingLogo";
import { Shield, Users, Mail, Calendar, Search, Database, Send, MessageSquareText, Activity } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/components/ui/use-toast";

// Type pour la vue SQL
interface AdminUserStat {
  user_id: string;
  full_name: string | null;
  email: string | null;
  role: string | null;
  plan_type: string | null;
  created_at: string;
  search_usage: number | null;
  search_limit: number | null;
  total_prospects: number;
  total_campaigns: number;
  total_emails_sent: number;
  total_ai_messages: number;
}

/**
 * Page d'administration
 * Permet de visualiser et gérer les utilisateurs du système ainsi que leur activité détaillée.
 */
const Admin = () => {
  const { profile } = useAuth();
  const { toast } = useToast();
  const [stats, setStats] = useState<AdminUserStat[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchStats();
  }, []);

  const fetchStats = async () => {
    setIsLoading(true);
    try {
      // On interroge la vue sql créée: admin_user_stats
      const { data, error } = await supabase
        .from('admin_user_stats' as any)
        .select('*')
        .order('created_at', { ascending: false });

      if (error) {
        // Fallback en cas où la vue n'est pas encore créée
        throw error;
      }
      setStats(data || []);
    } catch (error: any) {
      console.error("Error fetching admin stats:", error);
      toast({
        title: "Erreur de chargement",
        description: "Impossible de charger les statistiques. Assurez-vous que la vue SQL `admin_user_stats` a bien été exécutée dans Supabase.",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  // KPIs globaux
  const totalUsers = stats.length;
  const totalSearches = stats.reduce((sum, s) => sum + (s.search_usage || 0), 0);
  const totalProspects = stats.reduce((sum, s) => sum + (s.total_prospects || 0), 0);
  const totalEmailsSent = stats.reduce((sum, s) => sum + (s.total_emails_sent || 0), 0);
  const totalAiMessages = stats.reduce((sum, s) => sum + (s.total_ai_messages || 0), 0);

  return (
    <div className="min-h-screen bg-background pb-20">
      <Header />
      <main className="mx-auto max-w-7xl px-4 pt-24 sm:px-6">
        <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-primary dark:text-white flex items-center gap-2">
              <Shield className="h-8 w-8 text-emerald-500" />
              Panneau d'Administration
            </h1>
            <p className="mt-1 text-muted-foreground">Vue d'ensemble de l'activité de tous les utilisateurs.</p>
          </div>
          <div className="flex items-center gap-3">
             <Badge variant="outline" className="px-3 py-1 border-accent/20 bg-accent/5 text-accent font-medium rounded-full">
              Mode Administrateur Actif
             </Badge>
          </div>
        </div>

        {/* --- KPIs GLOBAUX --- */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5 mb-8">
          <Card className="border-accent/10 bg-accent/5 shadow-none rounded-2xl relative overflow-hidden">
            <div className="absolute -right-4 -top-4 opacity-10"><Users size={80} /></div>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Utilisateurs Inscrits</CardTitle>
              <Users className="h-4 w-4 text-accent" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{totalUsers}</div>
              <p className="text-xs text-muted-foreground mt-1">Comptes actifs sur la plateforme</p>
            </CardContent>
          </Card>
          
          <Card className="border-blue-500/10 bg-blue-500/5 shadow-none rounded-2xl relative overflow-hidden">
            <div className="absolute -right-4 -top-4 opacity-10"><Search size={80} /></div>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Recherches Effectuées</CardTitle>
              <Search className="h-4 w-4 text-blue-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{totalSearches}</div>
              <p className="text-xs text-muted-foreground mt-1">Requêtes moteur générées</p>
            </CardContent>
          </Card>

          <Card className="border-emerald-500/10 bg-emerald-500/5 shadow-none rounded-2xl relative overflow-hidden">
            <div className="absolute -right-4 -top-4 opacity-10"><Database size={80} /></div>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Prospects Sourcés</CardTitle>
              <Database className="h-4 w-4 text-emerald-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{totalProspects}</div>
              <p className="text-xs text-muted-foreground mt-1">Profils extraits et enregistrés</p>
            </CardContent>
          </Card>

          <Card className="border-purple-500/10 bg-purple-500/5 shadow-none rounded-2xl relative overflow-hidden">
            <div className="absolute -right-4 -top-4 opacity-10"><Send size={80} /></div>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Emails Envoyés</CardTitle>
              <Send className="h-4 w-4 text-purple-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{totalEmailsSent}</div>
              <p className="text-xs text-muted-foreground mt-1">Dans les campagnes cold email</p>
            </CardContent>
          </Card>

          <Card className="border-orange-500/10 bg-orange-500/5 shadow-none rounded-2xl relative overflow-hidden">
            <div className="absolute -right-4 -top-4 opacity-10"><MessageSquareText size={80} /></div>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Interactions IA</CardTitle>
              <MessageSquareText className="h-4 w-4 text-orange-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{totalAiMessages}</div>
              <p className="text-xs text-muted-foreground mt-1">Messages traités par Prospecta AI</p>
            </CardContent>
          </Card>
        </div>

        {/* --- TABLEAU DETAILLÉ --- */}
        <Card className="border-accent/10 shadow-sm rounded-2xl overflow-hidden">
          <CardHeader className="bg-muted/30 pb-4 border-b border-accent/10">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Activity className="h-5 w-5 text-accent" />
                  Activité Détaillée par Utilisateur
                </CardTitle>
                <CardDescription>Vue complète de l'usage et des métriques pour chaque compte configuré.</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {isLoading ? (
              <div className="flex h-64 flex-col items-center justify-center">
                <LoadingLogo size="md" message="Analyse des données d'activité..." />
              </div>
            ) : stats.length === 0 ? (
              <div className="flex h-64 flex-col items-center justify-center text-muted-foreground">
                <p>Aucune donnée trouvée ou la vue `admin_user_stats` n'existe pas.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="hover:bg-transparent bg-muted/20 border-accent/10">
                      <TableHead className="py-4 pl-6">Utilisateur</TableHead>
                      <TableHead>Abonnement</TableHead>
                      <TableHead>Recherches (Quota)</TableHead>
                      <TableHead className="text-center">Prospects Extraits</TableHead>
                      <TableHead className="text-center">Campagnes / Mails</TableHead>
                      <TableHead className="text-center">Activité IA</TableHead>
                      <TableHead className="pr-6">Date Inscription</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {stats.map((p) => {
                      const searchUsage = p.search_usage || 0;
                      const searchLimit = p.search_limit || 100; // par défaut
                      const searchPercentage = Math.min(100, Math.round((searchUsage / searchLimit) * 100));
                      let progressColor = "bg-emerald-500";
                      if (searchPercentage > 75) progressColor = "bg-amber-500";
                      if (searchPercentage > 90) progressColor = "bg-red-500";

                      return (
                        <TableRow key={p.user_id} className="group hover:bg-accent/5 transition-colors border-accent/5">
                          <TableCell className="py-4 pl-6">
                            <div className="flex items-center gap-3">
                              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-accent/10 border border-accent/30 text-accent font-bold uppercase">
                                {p.full_name ? p.full_name.substring(0, 2) : p.email ? p.email.substring(0, 2) : "?"}
                              </div>
                              <div className="flex flex-col">
                                <span className="font-semibold text-sm flex items-center gap-2">
                                  {p.full_name || "Sans nom"}
                                  {p.role === 'admin' && (
                                    <Badge variant="outline" className="h-5 px-1.5 text-[9px] uppercase border-emerald-500 text-emerald-600">Admin</Badge>
                                  )}
                                </span>
                                <span className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                                  <Mail className="h-3 w-3" />
                                  {p.email}
                                </span>
                              </div>
                            </div>
                          </TableCell>
                          
                          <TableCell>
                            <Badge variant="secondary" className="rounded-full px-3 capitalize font-medium">
                              {p.plan_type || "free"}
                            </Badge>
                          </TableCell>

                          <TableCell>
                            <div className="w-full max-w-[150px] space-y-1.5">
                              <div className="flex justify-between text-xs font-medium">
                                <span>{searchUsage} réa.</span>
                                <span>/ {searchLimit}</span>
                              </div>
                              <Progress value={searchPercentage} className={`h-1.5 ${progressColor}`} />
                            </div>
                          </TableCell>

                          <TableCell className="text-center font-mono">
                            <div className="flex flex-col items-center justify-center">
                              <span className="text-sm font-semibold">{p.total_prospects.toLocaleString()}</span>
                              <span className="text-[10px] text-muted-foreground">Profils</span>
                            </div>
                          </TableCell>

                          <TableCell className="text-center font-mono">
                            <div className="flex flex-col items-center justify-center">
                              <span className="text-sm font-semibold text-purple-600 dark:text-purple-400">
                                {p.total_emails_sent.toLocaleString()} env.
                              </span>
                              <span className="text-[10px] text-muted-foreground">
                                ds {p.total_campaigns} camp.
                              </span>
                            </div>
                          </TableCell>

                          <TableCell className="text-center font-mono">
                            <div className="flex items-center justify-center gap-1.5 text-orange-600 dark:text-orange-400">
                              <MessageSquareText className="h-3 w-3" />
                              <span className="text-sm font-semibold">{p.total_ai_messages}</span>
                            </div>
                          </TableCell>

                          <TableCell className="pr-6">
                            <div className="flex items-center gap-2 text-muted-foreground text-xs">
                              <Calendar className="h-3 w-3" />
                              <span>{new Date(p.created_at).toLocaleDateString()}</span>
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
};

export default Admin;
