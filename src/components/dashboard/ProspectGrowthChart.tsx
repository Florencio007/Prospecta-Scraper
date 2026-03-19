import { Area, AreaChart, CartesianGrid, XAxis, YAxis, ResponsiveContainer } from "recharts";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { useLanguage } from "@/hooks/useLanguage";

interface GrowthData {
  date: string;
  count: number;
  openRate: number;
  clickRate: number;
  replyRate: number;
}

interface ProspectGrowthChartProps {
  data: GrowthData[];
}

export function ProspectGrowthChart({ data }: ProspectGrowthChartProps) {
  const { t } = useLanguage();

  const chartConfig = {
    count: {
      label: "Prospects",
      color: "#F43F5E", // Rose
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
      <CardHeader className="px-0 pt-0">
        <CardTitle className="text-xl font-bold">Activité & Croissance</CardTitle>
        <CardDescription>{t("last30Days")}</CardDescription>
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
                <stop
                  offset="5%"
                  stopColor="#F43F5E"
                  stopOpacity={0.3}
                />
                <stop
                  offset="95%"
                  stopColor="#F43F5E"
                  stopOpacity={0.1}
                />
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
            <Area
              yAxisId="right"
              dataKey="clickRate"
              type="monotone"
              fill="url(#fillClickRate)"
              fillOpacity={0.1}
              stroke="#F59E0B"
              strokeWidth={1.5}
            />
            <Area
              yAxisId="right"
              dataKey="replyRate"
              type="monotone"
              fill="url(#fillReplyRate)"
              fillOpacity={0.1}
              stroke="#10B981"
              strokeWidth={2}
            />
          </AreaChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}
