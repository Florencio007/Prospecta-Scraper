import { useState, useEffect, useMemo } from "react";
import { useAuth } from "@/hooks/useAuth";
import Header from "@/components/dashboard/Header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { LoadingLogo } from "@/components/LoadingLogo";
import { Shield, Users, Mail, Calendar, Search, Database, Send, MessageSquareText, Activity, CreditCard, BarChart3, TrendingUp } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/components/ui/use-toast";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  Legend, 
  ResponsiveContainer,
  Cell,
  PieChart,
  Pie
} from 'recharts';

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
  total_opened: number;
  total_clicked: number;
  total_replies: number;
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
  const [selectedUser, setSelectedUser] = useState<AdminUserStat | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  useEffect(() => {
    fetchStats();
  }, []);

  const handleUserClick = (user: AdminUserStat) => {
    setSelectedUser(user);
    setIsDialogOpen(true);
  };

  const chartData = useMemo(() => {
    return stats.slice(0, 5).map(s => {
      const sent = s.total_emails_sent || 0;
      return {
        name: s.full_name || s.email?.split('@')[0] || "Sans nom",
        recherches: s.search_usage || 0,
        prospects: s.total_prospects || 0,
        emails: sent,
        ouvertures: sent > 0 ? Math.round(((s.total_opened || 0) / sent) * 100) : 0,
        clics: sent > 0 ? Math.round(((s.total_clicked || 0) / sent) * 100) : 0,
        reponses: sent > 0 ? Math.round(((s.total_replies || 0) / sent) * 100) : 0,
      };
    });
  }, [stats]);

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
  const totalOpened = stats.reduce((sum, s) => sum + (s.total_opened || 0), 0);
  const totalClicked = stats.reduce((sum, s) => sum + (s.total_clicked || 0), 0);
  const totalReplies = stats.reduce((sum, s) => sum + (s.total_replies || 0), 0);

  const globalOpenRate = totalEmailsSent > 0 ? (totalOpened / totalEmailsSent) * 100 : 0;
  const globalClickRate = totalEmailsSent > 0 ? (totalClicked / totalEmailsSent) * 100 : 0;
  const globalReplyRate = totalEmailsSent > 0 ? (totalReplies / totalEmailsSent) * 100 : 0;

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
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 mb-8">
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

          <Card className="border-blue-400/10 bg-blue-400/5 shadow-none rounded-2xl relative overflow-hidden">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1">
              <CardTitle className="text-xs font-semibold uppercase text-muted-foreground">Taux Ouverture Moyen</CardTitle>
              <Mail className="h-4 w-4 text-blue-400" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{globalOpenRate.toFixed(1)}%</div>
            </CardContent>
          </Card>

          <Card className="border-orange-500/10 bg-orange-500/5 shadow-none rounded-2xl relative overflow-hidden">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1">
              <CardTitle className="text-xs font-semibold uppercase text-muted-foreground">Taux de Clic Moyen</CardTitle>
              <TrendingUp className="h-4 w-4 text-orange-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{globalClickRate.toFixed(1)}%</div>
            </CardContent>
          </Card>

          <Card className="border-cyan-500/10 bg-cyan-500/5 shadow-none rounded-2xl relative overflow-hidden">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1">
              <CardTitle className="text-xs font-semibold uppercase text-muted-foreground">Taux de Réponse Global</CardTitle>
              <MessageSquareText className="h-4 w-4 text-cyan-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{globalReplyRate.toFixed(1)}%</div>
            </CardContent>
          </Card>
        </div>

        {/* --- GRAPHIQUE ANALYTIQUE --- */}
        {!isLoading && stats.length > 0 && (
          <Card className="mb-8 border-accent/10 shadow-sm rounded-2xl overflow-hidden bg-muted/20">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-lg">
                <BarChart3 className="h-5 w-5 text-accent" />
                Performance Comparative (Top 5 Utilisateurs)
              </CardTitle>
              <CardDescription>Visualisation multicritères de l'activité par utilisateur.</CardDescription>
            </CardHeader>
            <CardContent className="h-[300px] pt-4">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.1} />
                  <XAxis dataKey="name" axisLine={false} tickLine={false} fontSize={10} tick={{ fill: 'currentColor' }} />
                  <YAxis axisLine={false} tickLine={false} fontSize={10} tick={{ fill: 'currentColor' }} />
                  <Tooltip 
                    contentStyle={{ backgroundColor: 'hsl(var(--background))', borderRadius: '12px', border: '1px solid hsl(var(--accent) / 0.1)', fontSize: '12px' }}
                  />
                  <Legend iconType="circle" wrapperStyle={{ fontSize: '12px', paddingTop: '10px' }} />
                  <Bar dataKey="recherches" fill="#64748B" radius={[4, 4, 0, 0]} name="Recherches" />
                  <Bar dataKey="prospects" fill="#F43F5E" radius={[4, 4, 0, 0]} name="Prospects" />
                  <Bar dataKey="emails" fill="#2563EB" radius={[4, 4, 0, 0]} name="Emails" />
                  <Bar dataKey="ouvertures" fill="#7C3AED" radius={[4, 4, 0, 0]} name="Ouverture %" />
                  <Bar dataKey="clics" fill="#F59E0B" radius={[4, 4, 0, 0]} name="Clic %" />
                  <Bar dataKey="reponses" fill="#10B981" radius={[4, 4, 0, 0]} name="Réponse %" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        )}

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
                      <TableHead className="text-center">Performance E-mail</TableHead>
                      <TableHead className="text-center">Taux d'Engagement</TableHead>
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
                        <TableRow 
                          key={p.user_id} 
                          className="group hover:bg-accent/10 transition-colors border-accent/5 cursor-pointer"
                          onClick={() => handleUserClick(p)}
                        >
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
                            <div className="flex flex-col items-center justify-center bg-accent/5 py-1 px-2 rounded-lg border border-accent/5">
                              <div className="flex items-center gap-1 text-xs font-bold text-blue-500">
                                {p.total_emails_sent > 0 ? Math.round((p.total_opened / p.total_emails_sent) * 100) : 0}% <span className="text-[9px] font-normal text-muted-foreground uppercase">ouv.</span>
                              </div>
                              <div className="flex items-center gap-1 text-xs font-bold text-orange-500">
                                {p.total_emails_sent > 0 ? Math.round((p.total_clicked / p.total_emails_sent) * 100) : 0}% <span className="text-[9px] font-normal text-muted-foreground uppercase">clic</span>
                              </div>
                              <div className="flex items-center gap-1 text-xs font-bold text-cyan-500">
                                {p.total_emails_sent > 0 ? Math.round((p.total_replies / p.total_emails_sent) * 100) : 0}% <span className="text-[9px] font-normal text-muted-foreground uppercase">rép.</span>
                              </div>
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

      {/* --- DIALOG DETAILS UTILISATEUR --- */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-2xl rounded-3xl p-0 overflow-hidden border-accent/20">
          {selectedUser && (
            <>
              <DialogHeader className="p-8 bg-accent/5 border-b border-accent/10 text-left">
                <div className="flex items-center gap-4">
                  <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-accent/10 border border-accent/30 text-accent font-bold text-2xl uppercase">
                    {selectedUser.full_name ? selectedUser.full_name.substring(0, 2) : selectedUser.email?.substring(0, 2)}
                  </div>
                  <div>
                    <DialogTitle className="text-2xl font-bold flex items-center gap-2">
                      {selectedUser.full_name || "Utilisateur sans nom"}
                      <Badge variant="secondary" className="uppercase text-[10px]">{selectedUser.plan_type}</Badge>
                    </DialogTitle>
                    <DialogDescription className="text-base flex items-center gap-1.5 mt-1">
                      <Mail className="h-4 w-4" /> {selectedUser.email}
                    </DialogDescription>
                  </div>
                </div>
              </DialogHeader>
              <div className="p-8 space-y-8">
                 {/* Usage Grid */}
                 <div className="grid grid-cols-3 gap-6">
                    <div className="space-y-1">
                      <span className="text-xs text-muted-foreground uppercase font-semibold">Recherches</span>
                      <div className="text-xl font-bold flex items-baseline gap-1">
                        {selectedUser.search_usage} <span className="text-xs font-normal text-muted-foreground">/ {selectedUser.search_limit}</span>
                      </div>
                    </div>
                    <div className="space-y-1">
                      <span className="text-xs text-muted-foreground uppercase font-semibold">Prospects</span>
                      <div className="text-xl font-bold">{selectedUser.total_prospects}</div>
                    </div>
                    <div className="space-y-1">
                      <span className="text-xs text-muted-foreground uppercase font-semibold">Emails</span>
                      <div className="text-xl font-bold">{selectedUser.total_emails_sent}</div>
                    </div>
                 </div>

                 <div className="grid grid-cols-3 gap-6 pt-2 border-t border-accent/5">
                    <div className="space-y-1">
                      <span className="text-[10px] text-muted-foreground uppercase font-bold">Ouverture</span>
                      <div className="text-lg font-bold text-blue-500">
                        {selectedUser.total_emails_sent > 0 ? ((selectedUser.total_opened / selectedUser.total_emails_sent) * 100).toFixed(1) : 0}%
                      </div>
                    </div>
                    <div className="space-y-1">
                      <span className="text-[10px] text-muted-foreground uppercase font-bold">Clics</span>
                      <div className="text-lg font-bold text-orange-500">
                        {selectedUser.total_emails_sent > 0 ? ((selectedUser.total_clicked / selectedUser.total_emails_sent) * 100).toFixed(1) : 0}%
                      </div>
                    </div>
                    <div className="space-y-1">
                      <span className="text-[10px] text-muted-foreground uppercase font-bold">Réponses</span>
                      <div className="text-lg font-bold text-cyan-500">
                        {selectedUser.total_emails_sent > 0 ? ((selectedUser.total_replies / selectedUser.total_emails_sent) * 100).toFixed(1) : 0}%
                      </div>
                    </div>
                 </div>

                 <div className="p-4 bg-muted rounded-2xl border border-accent/10">
                    <div className="flex items-center gap-2 mb-4 text-sm font-semibold">
                       <TrendingUp className="h-4 w-4 text-accent" />
                       Détails du compte
                    </div>
                    <div className="grid grid-cols-2 gap-y-4 text-sm">
                       <div className="text-muted-foreground">ID Utilisateur :</div>
                       <div className="font-mono text-[10px] bg-background px-2 py-1 rounded border truncate">{selectedUser.user_id}</div>
                       
                       <div className="text-muted-foreground">Date d'inscription :</div>
                       <div>{new Date(selectedUser.created_at).toLocaleDateString(undefined, { dateStyle: 'long' })}</div>
                       
                       <div className="text-muted-foreground">Rôle système :</div>
                       <div className="font-semibold uppercase flex items-center gap-2">
                          {selectedUser.role || 'user'}
                          {selectedUser.role === 'admin' && <Shield className="h-3 w-3 text-emerald-500" />}
                       </div>

                       <div className="text-muted-foreground">Dernière activité :</div>
                       <div className="flex items-center gap-1 text-emerald-500 font-medium">
                          <Activity className="h-3 w-3" />
                          En ligne récemment
                       </div>
                    </div>
                 </div>
                 
                 <div className="flex justify-end pt-4">
                    <Badge variant="outline" className="text-muted-foreground border-dashed">
                       Appuyez sur Échap pour fermer
                    </Badge>
                 </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Admin;
