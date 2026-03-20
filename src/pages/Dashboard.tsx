import { useState, useEffect } from "react";
import { Sparkles, TrendingUp, Users, AlertCircle, Rocket, ShieldAlert } from "lucide-react";
import { useNavigate } from "react-router-dom";
import Header from "@/components/dashboard/Header";
import MetricsCards from "@/components/dashboard/MetricsCards";
import ProspectsList from "@/components/dashboard/ProspectsList";
import UsageTracker from "@/components/dashboard/UsageTracker";
import AIAssistant from "@/components/dashboard/AIAssistant";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useLanguage } from "@/hooks/useLanguage";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { SourceDistributionChart } from "@/components/dashboard/SourceDistributionChart";
import { ProspectGrowthChart } from "@/components/dashboard/ProspectGrowthChart";

/**
 * Page de tableau de bord principal
 * Affiche les métriques clés, les activités récentes et les sources de prospects
 */
const Dashboard = () => {
  const { t } = useLanguage();
  const { user, profile, isAdmin } = useAuth();
  const navigate = useNavigate();

  // États de l'interface
  const [aiOpen, setAiOpen] = useState(false);
  const [aiMode, setAiMode] = useState<"message" | "analysis">("message");
  const [selectedPeriod, setSelectedPeriod] = useState("week"); // Période sélectionnée pour les filtres

  // Données récupérées de la base de données
  const [recentActivity, setRecentActivity] = useState<any[]>([]);
  const [topSources, setTopSources] = useState<any[]>([]);
  const [growthData, setGrowthData] = useState<any[]>([]);

  useEffect(() => {
    if (!user?.id) return;

    const fetchDashboardData = async () => {
      let days = 30; // default for month
      if (selectedPeriod === "today") days = 0; // Only today
      else if (selectedPeriod === "week") days = 7;
      else if (selectedPeriod === "month") days = 30;
      else if (selectedPeriod === "all") days = 90; // Limit charts to 90 days for performance

      const startDate = new Date();
      startDate.setDate(startDate.getDate() - days);
      startDate.setHours(0, 0, 0, 0);

      // Pour les prospects/activités, on prend tout pour "all", mais on coupe pour le graphique
      const filterDateISO = selectedPeriod === "all" ? new Date(0).toISOString() : startDate.toISOString();

      const [{ data: activities }, { data: prospects }, { data: events }, { data: replies }] = await Promise.all([
        supabase
          .from('activity_log')
          .select('*')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false })
          .limit(10),
        supabase
          .from('prospects')
          .select('source, created_at')
          .eq('user_id', user.id)
          .gte('created_at', filterDateISO),
        supabase
          .from('email_events')
          .select('event_type, created_at')
          .eq('user_id', user.id)
          .gte('created_at', filterDateISO),
        supabase
          .from('email_messages')
          .select('created_at')
          .eq('user_id', user.id)
          .eq('direction', 'received')
          .gte('created_at', filterDateISO)
      ]);

      if (activities) {
        const formattedActivities = (activities as any[]).map(activity => {
          const timeAgo = getTimeAgo(new Date(activity.created_at));

          switch (activity.action_type) {
            case 'prospect_added':
              return {
                type: 'prospect',
                text: t("newProspectAdded", { name: activity.metadata?.name || t("prospect") }),
                time: timeAgo,
                color: 'bg-accent'
              };
            case 'campaign_sent':
              return {
                type: 'campaign',
                text: t("campaignSent", { name: activity.metadata?.campaign_name || t("campaign") }),
                time: timeAgo,
                color: 'bg-blue-500'
              };
            case 'export_generated':
              return {
                type: 'export',
                text: t("exportGenerated", { format: activity.metadata?.format || 'CSV' }),
                time: timeAgo,
                color: 'bg-purple-500'
              };
            case 'prospect_converted':
              return {
                type: 'conversion',
                text: t("recentActivityConversion", { name: activity.metadata?.name || t("prospect") }),
                time: timeAgo,
                color: 'bg-emerald-500'
              };
            case 'campaign_created':
              return {
                type: 'campaign',
                text: t("campaignCreated", { name: activity.metadata?.campaign_name || t("campaign") }),
                time: timeAgo,
                color: 'bg-amber-500'
              };
            case 'email_sent':
              return {
                type: 'email',
                text: t("emailSentTo", { recipient: activity.metadata?.recipient || '...' }),
                time: timeAgo,
                color: 'bg-cyan-500'
              };
            case 'login':
              return {
                type: 'auth',
                text: t("loginActivity"),
                time: timeAgo,
                color: 'bg-slate-400'
              };
            default:
              return {
                type: 'other',
                text: activity.action_type.replace('_', ' '),
                time: timeAgo,
                color: 'bg-gray-400'
              };
          }
        });
        setRecentActivity(formattedActivities);
      }

      const eventDaily: Record<string, { sent: number, opened: number, clicked: number, replied: number }> = {};
      if (events) {
        (events as any[]).forEach(e => {
          const dateStr = new Date(e.created_at).toISOString().split('T')[0];
          if (!eventDaily[dateStr]) eventDaily[dateStr] = { sent: 0, opened: 0, clicked: 0, replied: 0 };
          if (e.event_type === 'sent') eventDaily[dateStr].sent++;
          if (e.event_type === 'opened') eventDaily[dateStr].opened++;
          if (e.event_type === 'clicked') eventDaily[dateStr].clicked++;
        });
      }

      if (replies) {
        (replies as any[]).forEach(r => {
          const dateStr = new Date(r.created_at).toISOString().split('T')[0];
          if (!eventDaily[dateStr]) eventDaily[dateStr] = { sent: 0, opened: 0, clicked: 0, replied: 0 };
          eventDaily[dateStr].replied++;
        });
      }

      if (prospects) {
        const sourceCounts: Record<string, number> = {};
        (prospects as any[]).forEach(p => {
          if (p.source) {
            sourceCounts[p.source] = (sourceCounts[p.source] || 0) + 1;
          }
        });

        const total = prospects.length;
        const sources = Object.entries(sourceCounts)
          .map(([name, count]) => ({
            name,
            count,
            percentage: total > 0 ? Math.round((count / total) * 100) : 0,
            icon: getSourceIcon(name)
          }))
          .sort((a, b) => b.count - a.count)
          .slice(0, 4);

        setTopSources(sources);

        // Préparation des données de croissance
        const growth: Record<string, number> = {};
        const now = new Date();

        // Initialiser avec zéro pour toute la plage (limité aux jours d'affichage)
        const displayDays = days === 0 ? 1 : days;
        for (let i = displayDays; i >= 0; i--) {
          const d = new Date();
          d.setDate(now.getDate() - i);
          growth[d.toISOString().split('T')[0]] = 0;
        }

        // Remplir avec les données réelles formatées
        (prospects as any[]).forEach(p => {
          const dateStr = new Date(p.created_at).toISOString().split('T')[0];
          if (growth[dateStr] !== undefined) {
            growth[dateStr]++;
          }
        });

        // Convertir en tableau cumulatif
        let cumulative = 0;
        const growthArray = Object.entries(growth).map(([date, count]) => {
          cumulative += count;
          const dayEvents = eventDaily[date] || { sent: 0, opened: 0, clicked: 0, replied: 0 };
          const openRate = dayEvents.sent > 0 ? Math.round((dayEvents.opened / dayEvents.sent) * 100) : 0;
          const clickRate = dayEvents.sent > 0 ? Math.round((dayEvents.clicked / dayEvents.sent) * 100) : 0;
          const replyRate = dayEvents.sent > 0 ? Math.round((dayEvents.replied / dayEvents.sent) * 100) : 0;
          
          return { 
            date, 
            count: cumulative,
            sentCount: dayEvents.sent,
            openRate,
            clickRate,
            replyRate
          };
        });

        setGrowthData(growthArray);
      }
    };

    fetchDashboardData();
  }, [user?.id, selectedPeriod]);

  /**
   * Formate la date en temps écoulé relatif (ex: 5min, 2h, 1j)
   */
  const getTimeAgo = (date: Date): string => {
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 60) return `${diffMins}${t("unitMin")}`;
    if (diffHours < 24) return `${diffHours}${t("unitHour")}`;
    return `${diffDays}${t("unitDay")}`;
  };

  /**
   * Retourne l'icône correspondante à une source de prospect
   */
  const getSourceIcon = (source: string): string => {
    const icons: Record<string, string> = {
      'LinkedIn': '🔗',
      'Google': '🔍',
      'Facebook': 'f',
      'WhatsApp': '💬',
      'Email': '📧',
      'Instagram': '📷',
    };
    return icons[source] || '🌐';
  };

  const handleOpenAi = (mode: "message" | "analysis" = "message") => {
    setAiMode(mode);
    setAiOpen(true);
  };

  return (
    <div className="min-h-screen bg-secondary">
      <Header />

      <main className="mx-auto max-w-7xl px-4 sm:px-6 pt-20 pb-8">
        {/* Onboarding Reminder */}
        {profile && !profile.onboarding_completed && (
          <div className="mb-8 animate-in fade-in slide-in-from-top-4 duration-500">
            <Card className="bg-accent/5 border-dashed border-accent/40 shadow-sm overflow-hidden relative group">
              <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                <Rocket size={80} className="rotate-12" />
              </div>
              <CardContent className="p-6">
                <div className="flex flex-col sm:flex-row items-center justify-between gap-6">
                  <div className="flex items-start gap-4">
                    <div className="w-12 h-12 rounded-full bg-accent/10 flex items-center justify-center shrink-0">
                      <Sparkles className="text-accent w-6 h-6 animate-pulse" />
                    </div>
                    <div>
                      <h3 className="text-lg font-bold text-foreground">Optimisez vos résultats !</h3>
                      <p className="text-muted-foreground text-sm max-w-md mt-1">
                        Complétez votre profil pour permettre à notre IA de personnaliser vos recherches et de doubler vos taux de conversion.
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <Button
                      onClick={() => navigate("/onboarding")}
                      className="bg-accent text-accent-foreground hover:bg-accent/90 shadow-md transform hover:scale-105 transition-all"
                    >
                      <Rocket size={16} className="mr-2" />
                      Compléter mon profil
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Admin Dashboard Access */}
        {isAdmin && (
          <div className="mb-8 animate-in fade-in slide-in-from-top-4 duration-500">
            <Card className="bg-emerald-500/5 border border-emerald-500/20 shadow-sm overflow-hidden relative group">
              <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                <Users size={80} className="rotate-12 text-emerald-500" />
              </div>
              <CardContent className="p-6">
                <div className="flex flex-col sm:flex-row items-center justify-between gap-6">
                  <div className="flex items-start gap-4">
                    <div className="w-12 h-12 rounded-full bg-emerald-500/10 flex items-center justify-center shrink-0">
                      <ShieldAlert className="text-emerald-500 w-6 h-6" />
                    </div>
                    <div>
                      <h3 className="text-lg font-bold text-foreground">Accès Administration</h3>
                      <p className="text-muted-foreground text-sm max-w-md mt-1">
                        Vous avez des privilèges d'administrateur. Accédez au tableau de bord pour gérer les utilisateurs, voir les statistiques globales et surveiller l'activité.
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <Button
                      onClick={() => navigate("/admin")}
                      className="bg-emerald-500 text-white hover:bg-emerald-600 shadow-md transform hover:scale-105 transition-all"
                    >
                      Ouvrir l'Administration
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Header Section */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-foreground">{t("dashboard")}</h1>
            <p className="text-muted-foreground font-light mt-1">{t("activityAtGlance")}</p>
          </div>
          <Button
            onClick={() => handleOpenAi("analysis")}
            className="bg-accent text-accent-foreground hover:bg-accent/90"
          >
            <Sparkles size={18} className="mr-2" />
            <span className="hidden sm:inline">Analyse Stratégique</span>
          </Button>
        </div>

        {/* Period Selector */}
        <div className="flex gap-2 mb-8">
          {["today", "week", "month", "all"].map((period) => (
            <Button
              key={period}
              variant={selectedPeriod === period ? "default" : "outline"}
              size="sm"
              onClick={() => setSelectedPeriod(period)}
              className={selectedPeriod === period ? "bg-accent text-accent-foreground" : ""}
            >
              {period === "today" && t("today")}
              {period === "week" && t("thisWeek")}
              {period === "month" && t("thisMonth")}
              {period === "all" && t("allTime")}
            </Button>
          ))}
        </div>

        {/* Metrics Cards */}
        <MetricsCards period={selectedPeriod} />

        {/* Main Content Grid */}
        <div className="grid lg:grid-cols-3 gap-6 mt-8">
          {/* Left Column - Prospects List */}
          <div className="lg:col-span-2 space-y-6">
            <Card className="bg-white border-none shadow-sm overflow-hidden">
              <CardContent className="p-6">
                <ProspectGrowthChart data={growthData} />
              </CardContent>
            </Card>
            <ProspectsList />
          </div>

          {/* Right Column - Activity & Sources */}
          <div className="space-y-6">
            {/* Recent Activity */}
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0">
                <CardTitle className="text-lg">{t("recentActivity")}</CardTitle>
                <Button variant="ghost" size="sm" onClick={() => handleOpenAi("analysis")} className="text-[10px] font-bold uppercase text-accent hover:text-accent hover:bg-accent/5 h-8">
                  <Sparkles size={12} className="mr-1" /> Analyser
                </Button>
              </CardHeader>
              <CardContent>
                <div className="space-y-4 max-h-[300px] overflow-y-auto pr-2 scrollbar-hide">
                  {recentActivity.length > 0 ? (
                    recentActivity.map((activity, idx) => (
                      <div key={idx} className="flex items-start gap-3 pb-3 border-b border-accent/5 last:border-0 last:pb-0">
                        <div className={`w-2 h-2 rounded-full ${activity.color} mt-2 shrink-0 shadow-[0_0_8px_rgba(0,0,0,0.1)]`} />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm text-foreground font-medium leading-tight">{activity.text}</p>
                          <p className="text-[10px] text-muted-foreground mt-1 flex items-center gap-1">
                             <TrendingUp className="h-3 w-3 opacity-50" /> {activity.time}
                          </p>
                        </div>
                      </div>
                    ))
                  ) : (
                    <p className="text-sm text-muted-foreground text-center py-4">
                      {t("noRecentActivity")}
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Top Sources */}
            <Card>
              <CardContent className="p-6">
                <SourceDistributionChart
                  data={topSources.map((s, i) => ({
                    ...s,
                    color: [
                      "#F43F5E", // Rose
                      "#2563EB", // Blue
                      "#7C3AED", // Violet
                      "#F59E0B", // Amber
                      "#10B981", // Emerald
                      "#06B6D4", // Cyan
                      "#84CC16", // Lime
                    ][i % 8]
                  }))}
                />

                <div className="space-y-4 mt-6">
                  {topSources.length > 0 ? (
                    topSources.map((source, idx) => (
                      <div key={idx}>
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <span className="text-lg">{source.icon}</span>
                            <span className="text-sm font-medium text-foreground">{source.name}</span>
                          </div>
                          <div className="text-right">
                            <div className="text-sm font-bold text-foreground">{source.count}</div>
                            <div className="text-xs text-muted-foreground">{source.percentage}%</div>
                          </div>
                        </div>
                        <div className="w-full bg-secondary rounded-full h-1.5 shadow-inner">
                          <div
                            className="h-1.5 rounded-full transition-all duration-700 ease-out"
                            style={{
                              width: `${source.percentage}%`,
                              backgroundColor: [
                                "#F43F5E",
                                "#2563EB",
                                "#7C3AED",
                                "#F59E0B",
                                "#10B981",
                                "#06B6D4",
                                "#84CC16",
                              ][idx % 8]
                            }}
                          />
                        </div>
                      </div>
                    ))
                  ) : (
                    <p className="text-sm text-muted-foreground text-center py-4">
                      {t("noSourcesAvailable")}
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Usage Tracker */}
            <UsageTracker />
          </div>
        </div>
      </main>

      <AIAssistant
        open={aiOpen}
        onClose={() => setAiOpen(false)}
        initialMode={aiMode}
      />
    </div>
  );
};

export default Dashboard;
