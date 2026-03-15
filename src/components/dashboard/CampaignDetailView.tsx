import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
    Users,
    BarChart3,
    Mail,
    Target,
    TrendingUp,
    Calendar,
    MoreVertical,
    X,
    Search,
    Filter,
    ArrowUpRight,
    ExternalLink,
    Phone
} from "lucide-react";
import { LoadingLogo } from "@/components/LoadingLogo";
import { useLanguage } from "@/hooks/useLanguage";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { useState } from "react";
import { Progress } from "@/components/ui/progress";

interface Campaign {
    id: string;
    name: string;
    description: string;
    status: "active" | "paused" | "completed";
    progress: number;
    contacts: number;
    conversions: number;
    conversionRate: number;
    startDate: string;
    endDate: string | null;
}

interface CampaignDetailViewProps {
    campaign: Campaign | null;
    isOpen: boolean;
    onOpenChange: (open: boolean) => void;
}

const CampaignDetailView = ({ campaign, isOpen, onOpenChange }: CampaignDetailViewProps) => {
    const { t } = useLanguage();
    const [searchTerm, setSearchTerm] = useState("");

    const { data: prospects = [], isLoading: isLoadingProspects } = useQuery({
        queryKey: ["campaign_prospects", campaign?.id],
        queryFn: async () => {
            if (!campaign) return [];

            const { data, error } = await supabase
                .from("campaign_prospects")
                .select(`
          prospect_id,
          prospects (
            id,
            source,
            status,
            score,
            prospect_data (
              name,
              company,
              position,
              email,
              phone
            )
          )
        `)
                .eq("campaign_id", campaign.id);

            if (error) throw error;

            return data.map((item: any) => {
                const p = item.prospects;
                // prospect_data peut être un tableau ou un objet unique (contrainte UNIQUE sur prospect_id)
                const d = Array.isArray(p.prospect_data)
                    ? (p.prospect_data[0] || {})
                    : (p.prospect_data || {});
                return {
                    id: p.id,
                    name: d.name || p.name || "Inconnu",
                    company: d.company || p.company || "Inconnu",
                    position: d.position || "N/A",
                    email: d.email || p.email || "N/A",
                    phone: d.phone || p.phone || "N/A",
                    status: p.status,
                    score: p.score
                };
            });
        },
        enabled: !!campaign && isOpen,
    });

    const filteredProspects = prospects.filter((p: any) =>
        p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        p.company.toLowerCase().includes(searchTerm.toLowerCase()) ||
        p.email.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const getStatusVariant = (status: string) => {
        switch (status) {
            case "active": return "default";
            case "paused": return "secondary";
            case "completed": return "outline";
            default: return "outline";
        }
    };

    return (
        <Dialog open={isOpen} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-5xl p-0 overflow-hidden bg-white text-slate-900 border-slate-200 shadow-2xl rounded-3xl h-[85vh] flex flex-col">
                <DialogHeader className="p-8 pb-4 flex flex-row items-start justify-between border-b border-slate-100">
                    <div className="space-y-1">
                        <div className="flex items-center gap-3">
                            <div className="h-12 w-12 rounded-2xl bg-accent/20 flex items-center justify-center text-accent shadow-lg shadow-accent/5">
                                <Target size={24} />
                            </div>
                            <div>
                                <DialogTitle className="text-2xl font-black tracking-tight">{campaign?.name || t("campaignDetails")}</DialogTitle>
                                <div className="flex items-center gap-2 mt-1">
                                    <Badge variant={getStatusVariant(campaign?.status || "")} className="text-[10px] uppercase tracking-wider font-bold">
                                        {campaign?.status && t(campaign.status)}
                                    </Badge>
                                    <span className="text-slate-500 text-xs flex items-center gap-1">
                                        <Calendar size={12} />
                                        {campaign?.startDate && new Date(campaign.startDate).toLocaleDateString()}
                                    </span>
                                </div>
                            </div>
                        </div>
                    </div>
                    <p className="text-slate-500 text-sm max-w-md hidden md:block italic">
                        {campaign?.description}
                    </p>
                </DialogHeader>

                <div className="flex-1 overflow-y-auto scrollbar-thin scrollbar-thumb-slate-200 p-8 space-y-8">
                    {/* Stats Grid */}
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                        <div className="bg-slate-50 p-5 rounded-2xl border border-slate-100 group hover:border-accent/30 transition-all">
                            <div className="flex justify-between items-start mb-2">
                                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{t("contacts")}</span>
                                <Users size={16} className="text-blue-500 opacity-50 group-hover:opacity-100 transition-opacity" />
                            </div>
                            <div className="text-3xl font-black text-slate-900">{prospects.length}</div>
                            <div className="text-[10px] text-slate-400 mt-1">
                                {t("associatedProspects")}
                            </div>
                        </div>

                        <div className="bg-slate-50 p-5 rounded-2xl border border-slate-100 group hover:border-accent/30 transition-all">
                            <div className="flex justify-between items-start mb-2">
                                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{t("progress")}</span>
                                <BarChart3 size={16} className="text-accent opacity-50 group-hover:opacity-100 transition-opacity" />
                            </div>
                            <div className="text-3xl font-black text-slate-900">{campaign?.progress || 0}%</div>
                            <Progress value={campaign?.progress || 0} className="h-1 mt-3 bg-slate-200" />
                            <div className="text-[10px] text-slate-400 mt-1">
                                {prospects.length} / {campaign?.contacts || 0} {t("contacts")}
                            </div>
                        </div>

                        <div className="bg-slate-50 p-5 rounded-2xl border border-slate-100 group hover:border-accent/30 transition-all">
                            <div className="flex justify-between items-start mb-2">
                                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{t("conversionsShort")}</span>
                                <ArrowUpRight size={16} className="text-emerald-500 opacity-50 group-hover:opacity-100 transition-opacity" />
                            </div>
                            <div className="text-3xl font-black text-slate-900">{campaign?.conversions || 0}</div>
                            <div className="text-[10px] text-slate-400 mt-1">
                                {prospects.length > 0
                                    ? `${Math.round(((campaign?.conversions || 0) / prospects.length) * 100)}% ${t("conversionRate") || "de conversion"}`
                                    : t("interestedProspects")}
                            </div>
                        </div>

                        <div className="bg-slate-50 p-5 rounded-2xl border border-slate-100 group hover:border-accent/30 transition-all">
                            <div className="flex justify-between items-start mb-2">
                                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{t("rate")}</span>
                                <TrendingUp size={16} className="text-purple-500 opacity-50 group-hover:opacity-100 transition-opacity" />
                            </div>
                            <div className="text-3xl font-black text-slate-900">{campaign?.conversionRate || 0}%</div>
                            <div className="text-[10px] text-slate-400 mt-1">{t("conversionRate") || "Taux de conversion"}</div>
                        </div>
                    </div>

                    {/* Prospects List */}
                    <div className="space-y-4">
                        <div className="flex items-center justify-between">
                            <h3 className="text-lg font-bold flex items-center gap-2">
                                <Users size={20} className="text-accent" />
                                {t("associatedProspects")}
                                <Badge className="ml-2 bg-accent/20 text-accent border-none">{prospects.length}</Badge>
                            </h3>
                            <div className="relative w-64">
                                <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                                <Input
                                    placeholder={t("searchProspect")}
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                    className="pl-9 h-9 bg-slate-50 border-slate-200 text-xs rounded-xl focus:ring-accent/50"
                                />
                            </div>
                        </div>

                        <div className="bg-white rounded-2xl border border-slate-100 overflow-hidden shadow-sm">
                            {isLoadingProspects ? (
                                <div className="flex flex-col items-center justify-center py-20 space-y-4">
                                    <LoadingLogo size="lg" message="Chargement des détails..." />
                                    <p className="text-slate-500 text-sm animate-pulse">{t("loadingProspects")}</p>
                                </div>
                            ) : filteredProspects.length === 0 ? (
                                <div className="flex flex-col items-center justify-center py-20 text-center px-4">
                                    <div className="h-16 w-16 bg-slate-800/50 rounded-full flex items-center justify-center mb-4 text-slate-600">
                                        <Users size={32} />
                                    </div>
                                    <h4 className="text-slate-300 font-bold mb-1">{t("noProspectsFound")}</h4>
                                    <p className="text-slate-500 text-xs max-w-xs">{t("addProspectsToSeeThemHere")}</p>
                                </div>
                            ) : (
                                <table className="w-full text-left border-collapse">
                                    <thead>
                                        <tr className="bg-slate-50 border-b border-slate-100">
                                            <th className="px-6 py-3 text-[10px] font-bold text-slate-400 uppercase tracking-wider">{t("name")}</th>
                                            <th className="px-6 py-3 text-[10px] font-bold text-slate-400 uppercase tracking-wider">{t("company")}</th>
                                            <th className="px-6 py-3 text-[10px] font-bold text-slate-400 uppercase tracking-wider">{t("email")}</th>
                                            <th className="px-6 py-3 text-[10px] font-bold text-slate-400 uppercase tracking-wider">{t("phone") || "Téléphone"}</th>
                                            <th className="px-6 py-3 text-[10px] font-bold text-slate-400 uppercase tracking-wider text-center">{t("status")}</th>
                                            <th className="px-6 py-3 text-[10px] font-bold text-slate-400 uppercase tracking-wider text-right">{t("actions")}</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {filteredProspects.map((p: any) => (
                                            <tr key={p.id} className="border-b border-slate-50 hover:bg-slate-50/50 transition-colors group">
                                                <td className="px-6 py-4">
                                                    <div className="flex items-center gap-3">
                                                        <div className="h-8 w-8 rounded-full bg-slate-100 flex items-center justify-center text-[10px] font-bold text-slate-500">
                                                            {p.name.charAt(0)}
                                                        </div>
                                                        <div>
                                                            <div className="text-sm font-bold text-slate-900">{p.name}</div>
                                                            <div className="text-[10px] text-slate-500">{p.position}</div>
                                                        </div>
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4">
                                                    <div className="text-xs text-slate-600">{p.company}</div>
                                                </td>
                                                <td className="px-6 py-4">
                                                    <div className="text-xs text-slate-600 flex items-center gap-1 group-hover:text-accent transition-colors">
                                                        <Mail size={12} className="opacity-50" />
                                                        {p.email}
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4">
                                                    <div className="text-xs text-slate-600 flex items-center gap-1">
                                                        <Phone size={12} className="opacity-50" />
                                                        {p.phone}
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4 text-center">
                                                    <Badge variant="outline" className="text-[9px] px-1.5 py-0 border-slate-200 text-slate-500 capitalize">
                                                        {p.status}
                                                    </Badge>
                                                </td>
                                                <td className="px-6 py-4 text-right">
                                                    <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-400 hover:text-slate-900 hover:bg-slate-100 rounded-full">
                                                        <ExternalLink size={14} />
                                                    </Button>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            )}
                        </div>
                    </div>
                </div>

                <div className="p-4 bg-slate-50 border-t border-slate-100 flex justify-end gap-3">
                    <Button
                        variant="ghost"
                        onClick={() => onOpenChange(false)}
                        className="text-slate-500 hover:text-slate-900"
                    >
                        {t("close")}
                    </Button>
                    <Button className="bg-accent hover:bg-accent/90 text-white font-bold rounded-xl px-6">
                        {t("exportCampaignData")}
                    </Button>
                </div>
            </DialogContent>
        </Dialog>
    );
};

export default CampaignDetailView;
