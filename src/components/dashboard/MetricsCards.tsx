import { useEffect, useState } from "react";
import { TrendingUp, MessageCircle, Send, ArrowUp } from "lucide-react";
import { useLanguage } from "@/hooks/useLanguage";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

interface MetricsCardsProps {
  period?: string;
}

const MetricsCards = ({ period = "all" }: MetricsCardsProps) => {
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
        let dateFilter = new Date(0); // For "all"
        const now = new Date();
        if (period === "today") dateFilter = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        else if (period === "week") {
          const first = now.getDate() - now.getDay();
          dateFilter = new Date(now.setDate(first));
          dateFilter.setHours(0, 0, 0, 0);
        } else if (period === "month") dateFilter = new Date(now.getFullYear(), now.getMonth(), 1);

        // Count total prospects
        let prospectsQuery = supabase
          .from('prospects')
          .select('*', { count: 'exact', head: true })
          .eq('user_id', user.id);
        
        if (period !== "all") prospectsQuery = prospectsQuery.gte('created_at', dateFilter.toISOString());
        const { count: prospectsCount } = await prospectsQuery;

        // Fetch aggregate campaign stats
        // We need email_events to accurately filter by date since campaigns don't have per-day sent stats
        let eventsQuery = supabase
            .from('email_events')
            .select('event_type')
            .eq('user_id', user.id);
            
        if (period !== "all") eventsQuery = eventsQuery.gte('created_at', dateFilter.toISOString());
        const { data: events, error: eventsError } = await eventsQuery;

        let totalSent = 0;
        let totalOpened = 0;
        let totalClicked = 0;

        if (events) {
            events.forEach((e: any) => {
                if (e.event_type === 'sent') totalSent++;
                if (e.event_type === 'opened') totalOpened++;
                if (e.event_type === 'clicked') totalClicked++;
            });
        }

        // Fetch total replies (received messages)
        let repliesQuery = supabase
          .from('email_messages')
          .select('*', { count: 'exact', head: true })
          .eq('user_id', user.id)
          .eq('direction', 'received');
          
        if (period !== "all") repliesQuery = repliesQuery.gte('created_at', dateFilter.toISOString());
        const { count: repliesCount } = await repliesQuery;

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
  }, [user?.id, period]);

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
