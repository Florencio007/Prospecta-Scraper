import { Progress } from "@/components/ui/progress";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Zap, TrendingUp, Users } from "lucide-react";
import { LoadingLogo } from "@/components/LoadingLogo";
import { useUsage } from "@/hooks/useUsage";
import { useLanguage } from "@/hooks/useLanguage";

const UsageTracker = () => {
    const { usage, loading } = useUsage();
    const { t } = useLanguage();

    if (loading) {
        return (
            <Card className="border-accent/20 bg-accent/5 overflow-hidden flex items-center justify-center p-12">
                <LoadingLogo size="xs" compact />
            </Card>
        );
    }

    if (!usage) return null;

    const prospectPercentage = (usage.current_prospects / usage.prospect_limit) * 100;
    const searchPercentage = (usage.search_usage / usage.search_limit) * 100;

    const getRenewalInfo = () => {
        if (!usage.created_at) return { days: 0, date: "" };

        const createdDate = new Date(usage.created_at);
        const today = new Date();
        const currentMonth = today.getMonth();
        const currentYear = today.getFullYear();

        // Target renewal is the same day of the month
        let renewalDate = new Date(currentYear, currentMonth, createdDate.getDate());

        // If renewal date for this month has passed, move to next month
        if (renewalDate < today) {
            renewalDate = new Date(currentYear, currentMonth + 1, createdDate.getDate());
        }

        const diffTime = Math.abs(renewalDate.getTime() - today.getTime());
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

        return {
            days: diffDays,
            date: renewalDate.toLocaleDateString(undefined, { day: 'numeric', month: 'long' })
        };
    };

    const renewal = getRenewalInfo();

    return (
        <Card className="border-accent/20 bg-accent/5 overflow-hidden">
            <CardHeader className="pb-3 border-b border-accent/10 bg-white/50">
                <div className="flex items-center justify-between">
                    <CardTitle className="text-sm font-bold flex items-center gap-2">
                        < Zap size={16} className="text-accent" /> {t("yourConsumption")}
                    </CardTitle>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-accent text-white uppercase tracking-tighter">
                        {t("plan")} {usage.plan_type}
                    </span>
                </div>
            </CardHeader>
            <CardContent className="pt-6 space-y-6">
                <div className="space-y-2">
                    <div className="flex justify-between text-xs font-semibold">
                        <div className="flex items-center gap-1.5"><Users size={14} className="text-muted-foreground" /> {t("prospectsSaved")}</div>
                        <span className={prospectPercentage > 80 ? "text-destructive" : "text-foreground"}>
                            {usage.current_prospects} / {usage.prospect_limit}
                        </span>
                    </div>
                    <Progress value={prospectPercentage} className="h-2" />
                </div>

                <div className="space-y-2">
                    <div className="flex justify-between text-xs font-semibold">
                        <div className="flex items-center gap-1.5"><Zap size={14} className="text-muted-foreground" /> {t("aiSearches")}</div>
                        <span className={searchPercentage > 80 ? "text-destructive" : "text-foreground"}>
                            {usage.search_usage} / {usage.search_limit}
                        </span>
                    </div>
                    <Progress value={searchPercentage} className="h-2" />
                </div>

                <div className="bg-white/80 rounded-lg p-3 border border-accent/10 flex items-center gap-3">
                    <div className="h-8 w-8 rounded-full bg-accent/20 flex items-center justify-center text-accent">
                        <TrendingUp size={16} />
                    </div>
                    <div>
                        <p className="text-[10px] font-bold text-muted-foreground uppercase">{t("nextRenewal")}</p>
                        <p className="text-xs font-bold">{t("renewalIn").replace("{days}", String(renewal.days)).replace("{date}", renewal.date)}</p>
                    </div>
                </div>
            </CardContent>
        </Card>
    );
};

export default UsageTracker;
