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
    responseRate: 0,
    messagesSent: 0,
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

        // Count messages sent (from email_events)
        let messagesSentCount = 0;
        let openedCount = 0;

        try {
          const { count: sent } = await supabase
            .from('email_events')
            .select('*', { count: 'exact', head: true })
            .eq('user_id', user.id)
            .eq('event_type', 'sent');
          messagesSentCount = sent || 0;

          const { count: opened } = await supabase
            .from('email_events')
            .select('*', { count: 'exact', head: true })
            .eq('user_id', user.id)
            .eq('event_type', 'opened');
          openedCount = opened || 0;
        } catch (e) {
          console.warn('[Metrics] could not fetch email_events (table might be missing):', e);
        }

        const responseRate = messagesSentCount > 0
          ? (openedCount / messagesSentCount) * 100
          : 0;

        setMetrics({
          totalProspects: prospectsCount || 0,
          responseRate: responseRate,
          messagesSent: messagesSentCount,
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
      label: t("prospects"),
      value: loading ? "..." : metrics.totalProspects.toLocaleString(),
      // trend: t("thisWeekTrend"), // Removed static trend
      // trendUp: true,
      icon: TrendingUp,
    },
    {
      label: t("responseRate"),
      value: loading ? "..." : `${metrics.responseRate.toFixed(1)}%`,
      // trend: t("industryAverage"), // Removed static trend
      // trendUp: metrics.responseRate > 15,
      icon: MessageCircle,
    },
    {
      label: t("messagesSent"),
      value: loading ? "..." : metrics.messagesSent.toLocaleString(),
      // trend: t("openRate"), // Removed static trend
      // trendUp: false,
      icon: Send,
    },
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
      {metricsData.map((m) => (
        <div
          key={m.label}
          className="rounded-lg border bg-card p-6 shadow-sm hover:shadow-md transition-shadow duration-200"
        >
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-xs font-medium text-muted-foreground tracking-wider uppercase">{m.label}</h3>
            <m.icon className="text-accent" size={20} />
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
