import { useState } from "react";
import { Area, AreaChart, CartesianGrid, XAxis, YAxis, ResponsiveContainer } from "recharts";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { useLanguage } from "@/hooks/useLanguage";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";

interface GrowthData {
  date: string;
  count: number;
  sentCount: number;
  openRate: number;
  clickRate: number;
  replyRate: number;
}

interface ProspectGrowthChartProps {
  data: GrowthData[];
}

export function ProspectGrowthChart({ data }: ProspectGrowthChartProps) {
  const { t } = useLanguage();
  const [visibleMetrics, setVisibleMetrics] = useState<Record<string, boolean>>({
    count: true,
    sentCount: true,
    openRate: true,
    clickRate: true,
    replyRate: true,
  });

  const toggleMetric = (key: string) => {
    setVisibleMetrics(prev => ({
      ...prev,
      [key]: !prev[key]
    }));
  };

  const chartConfig = {
    count: {
      label: "Prospects",
      color: "#F43F5E", // Rose
    },
    sentCount: {
      label: "Messages Envoyés",
      color: "#2563EB", // Blue
    },
    openRate: {
      label: "Taux d'ouverture (%)",
      color: "#7C3AED", // Violet
    },
    clickRate: {
      label: "Taux de clic (%)",
      color: "#F59E0B", // Amber
    },
    replyRate: {
      label: "Taux de réponse (%)",
      color: "#10B981", // Emerald
    }
  };

  return (
    <Card className="border-none shadow-none bg-transparent">
      <CardHeader className="px-0 pt-0 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <CardTitle className="text-xl font-bold">Activité & Croissance</CardTitle>
          <CardDescription>{t("last30Days")}</CardDescription>
        </div>
        
        <div className="flex flex-wrap gap-x-4 gap-y-2">
          {Object.entries(chartConfig).map(([key, config]) => (
            <div key={key} className="flex items-center space-x-2">
              <Checkbox 
                id={`check-${key}`} 
                checked={visibleMetrics[key]} 
                onCheckedChange={() => toggleMetric(key)}
                style={{ borderColor: config.color, color: config.color }}
                className="data-[state=checked]:bg-[var(--color)]"
              />
              <Label 
                htmlFor={`check-${key}`} 
                className="text-xs font-medium cursor-pointer"
                style={{ color: visibleMetrics[key] ? config.color : 'inherit' }}
              >
                {config.label}
              </Label>
            </div>
          ))}
        </div>
      </CardHeader>
      <CardContent className="px-0 pb-0">
        <ChartContainer config={chartConfig} className="aspect-[4/1.5] w-full">
          <AreaChart
            accessibilityLayer
            data={data}
            margin={{
              left: 12,
              right: 12,
              top: 10,
              bottom: 0,
            }}
          >
            <defs>
              <linearGradient id="fillCount" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#F43F5E" stopOpacity={0.3} />
                <stop offset="95%" stopColor="#F43F5E" stopOpacity={0.1} />
              </linearGradient>
              <linearGradient id="fillSentCount" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#2563EB" stopOpacity={0.3} />
                <stop offset="95%" stopColor="#2563EB" stopOpacity={0.1} />
              </linearGradient>
              <linearGradient id="fillOpenRate" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#7C3AED" stopOpacity={0.2} />
                <stop offset="95%" stopColor="#7C3AED" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="fillClickRate" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#F59E0B" stopOpacity={0.1} />
                <stop offset="95%" stopColor="#F59E0B" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="fillReplyRate" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#10B981" stopOpacity={0.1} />
                <stop offset="95%" stopColor="#10B981" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid vertical={false} strokeDasharray="3 3" opacity={0.1} />
            <XAxis
              dataKey="date"
              tickLine={false}
              axisLine={false}
              tickMargin={8}
              minTickGap={32}
              tickFormatter={(value) => {
                const date = new Date(value);
                return date.toLocaleDateString("fr-FR", {
                  month: "short",
                  day: "numeric",
                });
              }}
            />
            <YAxis yAxisId="left" hide />
            <YAxis yAxisId="right" hide domain={[0, 100]} />
            <ChartTooltip
              cursor={false}
              content={<ChartTooltipContent indicator="dot" />}
            />
            
            {visibleMetrics.count && (
              <Area
                yAxisId="left"
                dataKey="count"
                type="monotone"
                fill="url(#fillCount)"
                fillOpacity={0.4}
                stroke="#F43F5E"
                strokeWidth={2}
                stackId="a"
              />
            )}
            
            {visibleMetrics.sentCount && (
              <Area
                yAxisId="left"
                dataKey="sentCount"
                type="monotone"
                fill="url(#fillSentCount)"
                fillOpacity={0.4}
                stroke="#2563EB"
                strokeWidth={2}
                stackId="b"
              />
            )}
            
            {visibleMetrics.openRate && (
              <Area
                yAxisId="right"
                dataKey="openRate"
                type="monotone"
                fill="url(#fillOpenRate)"
                fillOpacity={0.2}
                stroke="#7C3AED"
                strokeWidth={1.5}
                strokeDasharray="4 4"
              />
            )}
            
            {visibleMetrics.clickRate && (
              <Area
                yAxisId="right"
                dataKey="clickRate"
                type="monotone"
                fill="url(#fillClickRate)"
                fillOpacity={0.1}
                stroke="#F59E0B"
                strokeWidth={1.5}
              />
            )}
            
            {visibleMetrics.replyRate && (
              <Area
                yAxisId="right"
                dataKey="replyRate"
                type="monotone"
                fill="url(#fillReplyRate)"
                fillOpacity={0.1}
                stroke="#10B981"
                strokeWidth={2}
              />
            )}
          </AreaChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}
