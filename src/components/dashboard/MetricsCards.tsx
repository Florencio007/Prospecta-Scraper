import { useEffect, useState } from "react";
import { TrendingUp, MessageCircle, Send, ArrowUp } from "lucide-react";
import { useLanguage } from "@/hooks/useLanguage";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

const MetricsCards = () => {
  const { t } = useLanguage();
  const { user } = useAuth();
  const [metrics, setMetrics] = useState({
    totalProspects: 0,
    openRate: 0,
    clickRate: 0,
    messagesSent: 0,
    searchUsage: 0,
    replyRate: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user?.id) return;

    const fetchMetrics = async () => {
      try {
        // Count total prospects
        const { count: prospectsCount } = await supabase
          .from('prospects')
          .select('*', { count: 'exact', head: true })
          .eq('user_id', user.id);

        // Fetch aggregate campaign stats
        const { data: campaigns, error: campaignError } = await supabase
            .from('email_campaigns')
            .select('sent_count, opened_count, clicked_count')
            .eq('user_id', user.id);

        let totalSent = 0;
        let totalOpened = 0;
        let totalClicked = 0;

        if (campaigns) {
            campaigns.forEach((c: any) => {
                totalSent += (c.sent_count || 0);
                totalOpened += (c.opened_count || 0);
                totalClicked += (c.clicked_count || 0);
            });
        }

        // Fetch total replies (received messages)
        const { count: repliesCount } = await supabase
          .from('email_messages')
          .select('*', { count: 'exact', head: true })
          .eq('user_id', user.id)
          .eq('direction', 'received');

        // Fetch profile for search usage
        const { data: profile } = await supabase
          .from('profiles')
          .select('search_usage')
          .eq('id', user.id)
          .single();

        const openRate = totalSent > 0 ? (totalOpened / totalSent) * 100 : 0;
        const clickRate = totalSent > 0 ? (totalClicked / totalSent) * 100 : 0;
        const replyRate = totalSent > 0 ? ((repliesCount || 0) / totalSent) * 100 : 0;

        setMetrics({
          totalProspects: prospectsCount || 0,
          openRate: openRate,
          clickRate: clickRate,
          messagesSent: totalSent,
          searchUsage: (profile as any)?.search_usage || 0,
          replyRate: replyRate,
        });
      } catch (error) {
        console.error('Error fetching metrics:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchMetrics();
  }, [user?.id]);

  const metricsData = [
    {
      label: "Recherches",
      value: loading ? "..." : metrics.searchUsage.toLocaleString(),
      icon: TrendingUp,
      color: "text-slate-500",
    },
    {
      label: "Messages Envoyés",
      value: loading ? "..." : metrics.messagesSent.toLocaleString(),
      icon: ArrowUp,
      color: "text-blue-600",
    },
    {
      label: "Taux d'ouverture",
      value: loading ? "..." : `${metrics.openRate.toFixed(1)}%`,
      icon: MessageCircle,
      color: "text-violet-600",
    },
    {
      label: "Taux de clic",
      value: loading ? "..." : `${metrics.clickRate.toFixed(1)}%`,
      icon: Send,
      color: "text-amber-500",
    },
    {
      label: "Taux de réponse",
      value: loading ? "..." : `${metrics.replyRate.toFixed(1)}%`,
      icon: MessageCircle,
      color: "text-emerald-500",
    },
    {
      label: "Total Prospects",
      value: loading ? "..." : metrics.totalProspects.toLocaleString(),
      icon: Send,
      color: "text-rose-500",
    },
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-6 mb-8">
      {metricsData.map((m) => (
        <div
          key={m.label}
          className="rounded-lg border bg-card p-6 shadow-sm hover:shadow-md transition-shadow duration-200"
        >
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-xs font-medium text-muted-foreground tracking-wider uppercase">{m.label}</h3>
            <m.icon className={m.color} size={20} />
          </div>
          <div className="text-3xl font-bold text-primary mb-1">{m.value}</div>
          {/* <div className={`text-sm flex items-center gap-1 ${m.trendUp ? "text-accent" : "text-muted-foreground"}`}>
            {m.trendUp && <ArrowUp size={14} />}
            <span>{m.trend}</span>
          </div> */}
        </div>
      ))}
    </div>
  );
};

export default MetricsCards;
