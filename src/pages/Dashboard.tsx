import { useState, useEffect } from "react";
import { Sparkles, TrendingUp, Users, AlertCircle, Rocket } from "lucide-react";
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
  const { user, profile } = useAuth();
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
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      const [{ data: activities }, { data: prospects }, { data: events }] = await Promise.all([
        supabase
          .from('activity_log')
          .select('*')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false })
          .limit(4),
        supabase
          .from('prospects')
          .select('source, created_at')
          .eq('user_id', user.id),
        supabase
          .from('email_events')
          .select('event_type, created_at')
          .eq('user_id', user.id)
          .gte('created_at', thirtyDaysAgo.toISOString())
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
            default:
              return {
                type: 'other',
                text: activity.action_type,
                time: timeAgo,
                color: 'bg-gray-500'
              };
          }
        });
        setRecentActivity(formattedActivities);
      }

      const eventDaily: Record<string, { sent: number, opened: number }> = {};
      if (events) {
        (events as any[]).forEach(e => {
          const dateStr = new Date(e.created_at).toISOString().split('T')[0];
          if (!eventDaily[dateStr]) eventDaily[dateStr] = { sent: 0, opened: 0 };
          if (e.event_type === 'sent') eventDaily[dateStr].sent++;
          if (e.event_type === 'opened') eventDaily[dateStr].opened++;
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
        const days = 30;
        const growth: Record<string, number> = {};
        const now = new Date();

        // Initialiser les derniers 30 jours à 0
        for (let i = days; i >= 0; i--) {
          const d = new Date();
          d.setDate(now.getDate() - i);
          growth[d.toISOString().split('T')[0]] = 0;
        }

        // Remplir avec les données réelles
        (prospects as any[]).forEach(p => {
          const dateStr = new Date(p.created_at).toISOString().split('T')[0];
          if (growth[dateStr] !== undefined) {
            growth[dateStr]++;
          }
        });

        // Convertir en tableau cumulatif pour les prospects + ajouter l'open rate quotidien
        let cumulative = 0;
        const growthArray = Object.entries(growth).map(([date, count]) => {
          cumulative += count;
          const dayEvents = eventDaily[date] || { sent: 0, opened: 0 };
          const openRate = dayEvents.sent > 0 ? Math.round((dayEvents.opened / dayEvents.sent) * 100) : 0;
          
          return { 
            date, 
            count: cumulative,
            openRate: openRate
          };
        });

        setGrowthData(growthArray);
      }
    };

    fetchDashboardData();
  }, [user?.id]);

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
        <MetricsCards />

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
                <div className="space-y-4">
                  {recentActivity.length > 0 ? (
                    recentActivity.map((activity, idx) => (
                      <div key={idx} className="flex items-start gap-3">
                        <div className={`w-2 h-2 rounded-full ${activity.color} mt-2 shrink-0`} />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm text-foreground">{activity.text}</p>
                          <p className="text-xs text-muted-foreground mt-1">{activity.time}</p>
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
                      "hsl(var(--accent))",
                      "#3B82F6",
                      "#8B5CF6",
                      "#10B981",
                      "#F59E0B"
                    ][i % 5]
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
                        <div className="w-full bg-secondary rounded-full h-1.5">
                          <div
                            className="bg-accent h-1.5 rounded-full transition-all duration-300"
                            style={{
                              width: `${source.percentage}%`,
                              backgroundColor: [
                                "hsl(var(--accent))",
                                "#3B82F6",
                                "#8B5CF6",
                                "#10B981",
                                "#F59E0B"
                              ][idx % 5]
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
