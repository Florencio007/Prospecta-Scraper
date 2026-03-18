import React, { useState, useEffect } from "react";
import {
    Mail,
    Shield,
    Send,
    Pause,
    Play,
    Trash2,
    Edit,
    BarChart3,
    Clock,
    AlertTriangle,
    CheckCircle,
    Users,
    Settings,
    Info,
    Zap,
    RefreshCcw,
    Plus,
    Sparkles,
    X,
    UserPlus,
    Loader2,
    LayoutGrid,
    List as ListIcon
} from "lucide-react";
import CampaignCard from "./CampaignCard";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { useLanguage } from "@/hooks/useLanguage";
import { supabase } from "@/integrations/supabase/client";
import { triggerN8nWorkflow } from "@/integrations/n8n";
import { LoadingLogo } from "@/components/LoadingLogo";
import { ConfirmDialog } from "./ConfirmDialog";
import AddRecipientDialog from "./AddRecipientDialog";
import EditTemplateDialog from "./EditTemplateDialog";
import EditCampaignDialog from "./EditCampaignDialog";
import ManageRecipientsDialog from "./ManageRecipientsDialog";

// --- Types ---
export interface Campaign {
    id: string;
    name: string;
    description: string;
    status: "active" | "paused" | "completed" | "draft";
    sent_count: number;
    opened_count: number;
    clicked_count: number;
    bounced_count: number;
    unsubscribed_count: number;
    daily_limit: number;
    sent_today: number;
    start_date: string;
    end_date: string | null;
    spam_score: number;
    warmup_day: number;
    from_name: string;
    from_email: string;
    subject: string;
    tags: string[];
    schedule: string;
    throttle_min: number;
    throttle_max: number;
    total_contacts?: number;
}

// --- Icons Helper ---

// --- Utility Functions ---
function pct(a: number, b: number) { return b > 0 ? ((a / b) * 100).toFixed(1) : "0.0"; }
function spamColor(score: number) {
    if (score <= 20) return "text-emerald-500";
    if (score <= 50) return "text-amber-500";
    return "text-destructive";
}

// --- Sub-components ---

function ProgressBar({ value, max = 100, colorClass = "bg-emerald-500" }: { value: number, max?: number, colorClass?: string }) {
    const percentage = Math.min(Math.max((value / max) * 100, 0), 100);
    return (
        <div className="bg-slate-200 dark:bg-slate-800 rounded-full h-1.5 w-full overflow-hidden">
            <div
                className={`${colorClass} h-full transition-all duration-500`}
                style={{ width: `${percentage}%` }}
            />
        </div>
    );
}

function StatCard({ label, value, sub, colorClass = "text-emerald-500", IconComponent }: any) {
    return (
        <Card className="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 shadow-sm transition-all hover:border-slate-300 dark:hover:border-slate-700">
            <CardContent className="p-4 flex flex-col gap-1">
                <div className="flex justify-between items-start">
                    <span className="text-[10px] text-slate-500 dark:text-slate-400 font-bold uppercase tracking-wider">{label}</span>
                    {IconComponent && <IconComponent size={14} className={`${colorClass} opacity-70`} />}
                </div>
                <div className={`text-2xl font-mono font-bold ${colorClass}`}>{value}</div>
                {sub && <div className="text-[10px] text-slate-500 font-medium">{sub}</div>}
            </CardContent>
        </Card>
    );
}

function SpamMeter({ score }: { score: number }) {
    const colorClass = spamColor(score);
    const label = score <= 20 ? "Excellent" : score <= 50 ? "Attention" : "Danger";
    return (
        <div className="flex flex-col gap-2">
            <div className="flex justify-between items-center text-[10px] font-bold uppercase">
                <span className="text-slate-500 dark:text-slate-400">Score Anti-Spat</span>
                <span className={`text-[10px] ${colorClass}`}>{score}/100 — {label}</span>
            </div>
            <ProgressBar value={score} colorClass={score <= 20 ? "bg-emerald-500" : score <= 50 ? "bg-amber-500" : "bg-destructive"} />
            <div className="text-[10px] text-slate-500 italic">Plus bas = meilleure délivrabilité</div>
        </div>
    );
}

function WarmupTimeline() {
    const days = [
        { day: 1, limit: 20, desc: "Rodage doux" },
        { day: 2, limit: 40, desc: "Progression" },
        { day: 3, limit: 70, desc: "Montée en charge" },
        { day: 4, limit: 100, desc: "Mi-parcours" },
        { day: 5, limit: 140, desc: "Accélération" },
        { day: 6, limit: 170, desc: "Quasi-plein" },
        { day: 7, limit: 200, desc: "Plein régime ✓" },
    ];
    return (
        <Card className="bg-slate-50/50 dark:bg-slate-950/50 border-slate-200 dark:border-slate-800">
            <CardHeader className="p-4 pb-2">
                <CardTitle className="text-sm font-bold flex items-center gap-2 text-slate-800 dark:text-slate-200">
                    <Zap size={16} className="text-amber-500" /> Plan de Warm-up (7 jours)
                </CardTitle>
            </CardHeader>
            <CardContent className="p-4 pt-0 flex flex-col gap-3">
                <p className="text-[10px] text-slate-600 dark:text-slate-400 leading-relaxed">
                    Le warm-up progressif évite les blocages des GSP (Gmail, etc.) et maximise la délivrabilité.
                </p>
                {days.map(d => (
                    <div key={d.day} className="flex items-center gap-2">
                        <div className="w-12 text-[10px] text-slate-500 font-bold uppercase">Jour {d.day}</div>
                        <div className="flex-1">
                            <ProgressBar value={d.limit} max={200} colorClass={d.limit >= 200 ? "bg-emerald-500" : "bg-blue-500"} />
                        </div>
                        <div className="w-8 text-[10px] text-right font-bold text-blue-400">{d.limit}</div>
                    </div>
                ))}
            </CardContent>
        </Card>
    );
}

// --- Main Manager Component ---

interface EmailCampaignManagerProps {
    campaigns: Campaign[];
    isLoading: boolean;
    onRefresh: () => void;
    user: any;
    onLaunchBatch?: (id: string, onProgress?: (sent: number, total: number) => void) => Promise<{ sent: number; errors?: number; error?: string; completed?: boolean }>;
    onAddProspects?: (campaignId: string, prospectIds: string[]) => void;
    onUpdateTemplate?: (id: string, updates: { subject: string; body_html: string }) => Promise<void>;
    onUpdateCampaign?: (id: string, updates: any) => Promise<void>;
    onGetRecipients?: (id: string) => Promise<any[]>;
    onRemoveRecipient?: (campaignId: string, recipientId: string) => Promise<boolean>;
    onManualAdd?: (campaignId: string, data: { first_name: string, last_name: string, email: string, company: string }) => Promise<void>;
    isGeneratingAI?: boolean;
    onGenerateAI?: (name: string, context: string) => Promise<{ subject: string; body: string } | void>;
    onRefineAI?: (subject: string, body: string, prompt: string, history: any[]) => Promise<{ subject: string; body: string; message?: string } | void>;
}

export default function EmailCampaignManager({ 
    campaigns, 
    isLoading, 
    onRefresh, 
    user, 
    onLaunchBatch, 
    onAddProspects, 
    onUpdateTemplate, 
    onUpdateCampaign,
    onGetRecipients,
    onRemoveRecipient,
    onManualAdd,
    isGeneratingAI, 
    onGenerateAI, 
    onRefineAI 
}: EmailCampaignManagerProps) {
    const { toast } = useToast();
    const { t } = useLanguage();
    const [selected, setSelected] = useState<Campaign | null>(null);
    const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
    const [campaignToDelete, setCampaignToDelete] = useState<string | null>(null);
    const [filter, setFilter] = useState("all");
    const [isManageRecipientsOpen, setIsManageRecipientsOpen] = useState(false);
    const [isProspectSelectorOpen, setIsProspectSelectorOpen] = useState(false);
    const [isEditTemplateOpen, setIsEditTemplateOpen] = useState(false);
    const [isEditCampaignOpen, setIsEditCampaignOpen] = useState(false);
    const [alreadyAddedIds, setAlreadyAddedIds] = useState<string[]>([]);
    const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');

    useEffect(() => {
        if (isProspectSelectorOpen && selected && onGetRecipients) {
            onGetRecipients(selected.id).then(recs => {
                const ids = recs.map(r => r.prospect_id || r.id).filter(Boolean);
                setAlreadyAddedIds(ids);
            });
        }
    }, [isProspectSelectorOpen, selected, onGetRecipients]);

    const toggleStatus = async (id: string, currentStatus: string) => {
        const newStatus = currentStatus === "active" ? "paused" : "active";
        try {
            const { error } = await (supabase as any).from("email_campaigns").update({ status: newStatus }).eq("id", id);
            if (error) throw error;
            toast({ title: "Statut mis à jour", description: `La campagne est maintenant ${newStatus === 'active' ? 'active' : 'en pause'}.` });
            onRefresh();
        } catch (err: unknown) {
            toast({ title: t("error"), description: (err instanceof Error ? err.message : "Une erreur inconnue s'est produite"), variant: "destructive" });
        }
    };

    const handleDeleteClick = (id: string) => {
        setCampaignToDelete(id);
        setIsDeleteDialogOpen(true);
    };

    const deleteCampaign = async () => {
        if (!campaignToDelete) return;
        try {
            const { error } = await (supabase as any).from("email_campaigns").delete().eq("id", campaignToDelete);
            if (error) throw error;
            toast({ title: "Campagne supprimée", variant: "destructive" });
            if (selected?.id === campaignToDelete) setSelected(null);
            onRefresh();
        } catch (err: unknown) {
            toast({ title: t("error"), description: (err instanceof Error ? err.message : "Une erreur inconnue s'est produite"), variant: "destructive" });
        } finally {
            setIsDeleteDialogOpen(false);
            setCampaignToDelete(null);
        }
    };

    const filtered = filter === "all" ? campaigns : campaigns.filter(c => c.status === filter);

    // Stats Globales
    const totalSent = campaigns.reduce((s, c) => s + (c.sent_count || 0), 0);
    const totalOpened = campaigns.reduce((s, c) => s + (c.opened_count || 0), 0);
    const totalBounced = campaigns.reduce((s, c) => s + (c.bounced_count || 0), 0);
    const activeCampaigns = campaigns.filter(c => c.status === "active").length;

    if (isLoading) {
        return (
            <div className="flex flex-col items-center justify-center py-20 gap-4">
                <LoadingLogo size="md" message="Chargement des campagnes..." />
            </div>
        );
    }

    return (
        <div className="flex flex-col gap-6 font-outfit">

            {/* Global Stats Dashboard */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <StatCard label="Campagnes actives" value={activeCampaigns} IconComponent={Zap} colorClass="text-emerald-500" sub={`${campaigns.length} au total`} />
                <StatCard label="Emails envoyés" value={totalSent.toLocaleString()} IconComponent={Send} colorClass="text-blue-500" sub="Historique complet" />
                <StatCard label="Taux d'ouverture" value={`${pct(totalOpened, totalSent)}%`} IconComponent={BarChart3} colorClass="text-purple-500" sub={`${totalOpened} ouverts`} />
                <StatCard label="Taux de rebond" value={`${pct(totalBounced, totalSent)}%`} IconComponent={AlertTriangle} colorClass={totalBounced / (totalSent || 1) > 0.03 ? "text-red-500" : "text-emerald-500"} sub={`${totalBounced} bounces`} />
            </div>

            {/* Trust Banner */}
            <Card className="bg-emerald-950/20 border-emerald-500/30 overflow-hidden">
                <CardContent className="p-4 flex flex-col md:flex-row items-center gap-4">
                    <div className="bg-emerald-500/20 p-2 rounded-lg">
                        <Shield className="text-emerald-500" size={24} />
                    </div>
                    <div className="flex-1 text-center md:text-left">
                        <CardTitle className="text-sm font-bold text-emerald-500">Protection Anti-Spam Active</CardTitle>
                        <p className="text-[11px] text-emerald-500/70 mt-1 uppercase tracking-tight font-medium">
                            Throttling aléatoire • Warm-up 7 jours • Analyse SPF/DKIM • Limite 200/jour
                        </p>
                    </div>
                    <div className="flex gap-2">
                        <Badge variant="outline" className="bg-emerald-500/10 text-emerald-500 border-emerald-500/50 text-[10px]">WARMUP OK</Badge>
                        <Badge variant="outline" className="bg-emerald-500/10 text-emerald-500 border-emerald-500/50 text-[10px]">THROTTLE ACTIVE</Badge>
                    </div>
                </CardContent>
            </Card>

            {/* Filters */}
            <div className="flex flex-wrap gap-2">
                {[["all", "Toutes"], ["active", "Actives"], ["paused", "Pausées"], ["completed", "Terminées"]].map(([val, label]) => (
                    <Button
                        key={val}
                        variant={filter === val ? "default" : "outline"}
                        size="sm"
                        onClick={() => setFilter(val)}
                        className={`text-xs h-8 ${filter === val ? 'bg-emerald-600 hover:bg-emerald-700 text-white' : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800'}`}
                    >
                        {label}
                    </Button>
                ))}

                <div className="ml-auto flex items-center bg-slate-100 dark:bg-slate-900 p-1 rounded-lg border border-border/50">
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setViewMode('grid')}
                        className={cn(
                            "h-7 px-2 gap-1.5 text-[10px] font-bold uppercase transition-all",
                            viewMode === 'grid' ? "bg-white dark:bg-slate-800 shadow-sm text-emerald-600" : "text-muted-foreground hover:text-foreground"
                        )}
                    >
                        <LayoutGrid size={12} />
                        Grid
                    </Button>
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setViewMode('list')}
                        className={cn(
                            "h-7 px-2 gap-1.5 text-[10px] font-bold uppercase transition-all",
                            viewMode === 'list' ? "bg-white dark:bg-slate-800 shadow-sm text-emerald-600" : "text-muted-foreground hover:text-foreground"
                        )}
                    >
                        <ListIcon size={12} />
                        List
                    </Button>
                </div>
            </div>

            {/* Main Grid: Scrollable list + Detail View */}
            <div className={`grid gap-6 ${selected ? 'md:grid-cols-[1fr_380px]' : 'grid-cols-1'}`}>
                <div className="flex flex-col gap-4">
                    {filtered.length === 0 ? (
                        <div className="text-center py-20 bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 rounded-xl border-dashed">
                            <Mail size={48} className="mx-auto text-slate-400 dark:text-slate-700 mb-4" />
                            <p className="text-slate-600 dark:text-slate-400 font-medium">Aucune campagne à afficher</p>
                            <p className="text-slate-500 dark:text-slate-600 text-sm mt-1">Créez votre première campagne pour commencer</p>
                        </div>
                    ) : (
                        viewMode === 'grid' ? (
                            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                                {filtered.map((c: any) => (
                                    <CampaignCard
                                        key={c.id}
                                        campaign={c}
                                        isSelected={selected?.id === c.id}
                                        onSelect={() => setSelected(c)}
                                        onToggle={(e: any) => { e.stopPropagation(); toggleStatus(c.id, c.status); }}
                                        onEdit={(e: any) => { e.stopPropagation(); setSelected(c); setIsEditCampaignOpen(true); }}
                                        onDelete={(e: any) => { e.stopPropagation(); handleDeleteClick(c.id); }}
                                    />
                                ))}
                            </div>
                        ) : (
                            <div className="flex flex-col gap-3">
                                {filtered.map((c: any) => (
                                    <CampaignRowCard
                                        key={c.id}
                                        campaign={c}
                                        isSelected={selected?.id === c.id}
                                        onSelect={() => setSelected(c)}
                                        onToggle={() => toggleStatus(c.id, c.status)}
                                        onDelete={() => handleDeleteClick(c.id)}
                                    />
                                ))}
                            </div>
                        )
                    )}
                </div>

                {selected && (
                    <div className="top-24 h-fit sticky animate-in slide-in-from-right duration-300">
                        <CampaignDetailSidePanel
                            campaign={selected}
                            onClose={() => setSelected(null)}
                            onLaunchBatch={onLaunchBatch ? async () => {
                                try {
                                    toast({ title: "Lancement en cours", description: "Veuillez patienter..." });
                                    const result = await onLaunchBatch(selected.id);
                                    if (result.error) throw new Error(result.error);
                                    if (result.completed) {
                                        toast({ title: "Campagne terminée", description: "Tous les prospects ont été contactés" });
                                    } else {
                                        toast({ title: "Batch terminé", description: `${result.sent} emails envoyés avec succès. ${result.errors} erreurs.` });
                                    }
                                    onRefresh();
                                } catch (error: any) {
                                    toast({ title: "Erreur", description: error.message, variant: "destructive" });
                                }
                            } : undefined}
                            onAddProspectsClick={() => setIsProspectSelectorOpen(true)}
                            onEditTemplateClick={() => setIsEditTemplateOpen(true)}
                            onEditCampaignClick={() => setIsEditCampaignOpen(true)}
                            onManageRecipientsClick={() => setIsManageRecipientsOpen(true)}
                            onDeleteClick={() => handleDeleteClick(selected.id)}
                        />
                    </div>
                )}

                <EditCampaignDialog 
                    isOpen={isEditCampaignOpen}
                    onClose={() => setIsEditCampaignOpen(false)}
                    campaign={selected}
                    onSave={async (id, updates) => {
                        if (onUpdateCampaign) {
                            await onUpdateCampaign(id, updates);
                            onRefresh();
                        }
                    }}
                />

                <ManageRecipientsDialog 
                    isOpen={isManageRecipientsOpen}
                    onClose={() => setIsManageRecipientsOpen(false)}
                    campaign={selected ? (campaigns.find((c: any) => c.id === selected.id) || selected) : null}
                    getRecipients={onGetRecipients || (async () => [])}
                    onRemove={onRemoveRecipient || (async () => false)}
                />
            </div>

            <AddRecipientDialog
                isOpen={isProspectSelectorOpen}
                onClose={() => setIsProspectSelectorOpen(false)}
                alreadyAddedIds={alreadyAddedIds}
                onSelected={(ids) => {
                    if (selected && onAddProspects) {
                        onAddProspects(selected.id, ids);
                    }
                }}
                onManualAdd={async (data) => {
                    if (selected && onManualAdd) {
                        await onManualAdd(selected.id, data);
                    }
                }}
            />

            <EditTemplateDialog
                isOpen={isEditTemplateOpen}
                onClose={() => setIsEditTemplateOpen(false)}
                campaign={selected ? { id: selected.id, subject: selected.subject, body_html: (selected as any).body_html } : null}
                onSave={async (id, updates) => {
                    if (onUpdateTemplate) {
                        await onUpdateTemplate(id, updates);
                        onRefresh();
                        // Update local selection to reflect changes
                        if (selected && selected.id === id) {
                            setSelected({ ...selected, ...updates } as any);
                        }
                    }
                }}
                isGeneratingAI={isGeneratingAI}
                onGenerateAI={onGenerateAI ? async (subject: string) => {
                   return await onGenerateAI(selected?.name || "", subject);
                } : undefined}
                onRefineAI={onRefineAI}
            />

            {/* Warmup guide if no selection */}
            {!selected && (
                <div className="grid md:grid-cols-2 gap-6 mt-4">
                    <WarmupTimeline />
                    <AntiSpamBestPractices />
                </div>
            )}

            <ConfirmDialog
                isOpen={isDeleteDialogOpen}
                onOpenChange={setIsDeleteDialogOpen}
                onConfirm={deleteCampaign}
                title="Supprimer la campagne ?"
                description="Cette action est irréversible. Toutes les données de prospection liées à cette campagne seront supprimées."
                confirmText="Supprimer définitivement"
            />
        </div>
    );
}

// --- Helper Components for the Manager ---

function CampaignRowCard({ campaign, onSelect, onToggle, onDelete, isSelected }: any) {
    const openRate = pct(campaign.opened_count, campaign.sent_count);
    const clickRate = pct(campaign.clicked_count, campaign.opened_count);
    
    const statusConfig = {
        active: { label: 'Actif', color: 'bg-emerald-500', bgColor: 'bg-emerald-500/10', textColor: 'text-emerald-500' },
        paused: { label: 'Pause', color: 'bg-amber-500', bgColor: 'bg-amber-500/10', textColor: 'text-amber-500' },
        draft: { label: 'Draft', color: 'bg-blue-500', bgColor: 'bg-blue-500/10', textColor: 'text-blue-500' },
        completed: { label: 'Fini', color: 'bg-slate-500', bgColor: 'bg-slate-500/10', textColor: 'text-slate-500' }
    }[campaign.status as keyof typeof statusConfig] || { label: campaign.status, color: 'bg-slate-500', bgColor: 'bg-slate-500/10', textColor: 'text-slate-500' };

    return (
        <Card
            className={cn(
                "bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 cursor-pointer transition-all hover:border-emerald-500/50 hover:shadow-md",
                isSelected ? 'ring-2 ring-emerald-500/50 border-emerald-500/50 bg-emerald-50/5 dark:bg-emerald-950/10' : ''
            )}
            onClick={onSelect}
        >
            <CardContent className="p-4">
                <div className="flex items-center gap-4">
                    {/* Status Dot & Title */}
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                        <div className={cn("h-2.5 w-2.5 rounded-full shrink-0", statusConfig.color)}></div>
                        <div className="flex flex-col min-w-0">
                            <span className="text-sm font-bold text-slate-900 dark:text-slate-100 truncate">{campaign.name}</span>
                            <span className={cn("text-[10px] font-bold uppercase tracking-wider", statusConfig.textColor)}>{statusConfig.label}</span>
                        </div>
                    </div>

                    {/* Quick Stats */}
                    <div className="hidden sm:flex items-center gap-6 px-4">
                        <div className="text-center">
                            <div className="text-[10px] text-slate-400 font-bold uppercase">Ouverts</div>
                            <div className="text-sm font-black text-slate-700 dark:text-slate-300">{openRate}%</div>
                        </div>
                        <div className="text-center">
                            <div className="text-[10px] text-slate-400 font-bold uppercase">Clics</div>
                            <div className="text-sm font-black text-slate-700 dark:text-slate-300">{clickRate}%</div>
                        </div>
                        <div className="text-center">
                            <div className="text-[10px] text-slate-400 font-bold uppercase">Total</div>
                            <div className="text-sm font-black text-slate-700 dark:text-slate-300">{campaign.sent_count || 0}</div>
                        </div>
                    </div>

                    {/* Progress Mini bar */}
                    <div className="hidden lg:block w-32 px-4 border-x border-slate-100 dark:border-slate-800">
                         <div className="text-[9px] text-slate-400 font-bold uppercase mb-1">Aujourd'hui</div>
                         <div className="h-1.5 w-full bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                             <div 
                                className="h-full bg-emerald-500" 
                                style={{ width: `${Math.min(100, (campaign.sent_today / (campaign.daily_limit || 1)) * 100)}%` }}
                             />
                         </div>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-1">
                        <Button 
                            variant="ghost" 
                            size="icon" 
                            className="h-8 w-8 text-slate-400 hover:text-emerald-500 hover:bg-emerald-50 dark:hover:bg-emerald-950/30"
                            onClick={(e) => { e.stopPropagation(); onToggle(); }}
                        >
                            {campaign.status === 'active' ? <Pause size={16} /> : <Play size={16} />}
                        </Button>
                        <Button 
                            variant="ghost" 
                            size="icon" 
                            className="h-8 w-8 text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30"
                            onClick={(e) => { e.stopPropagation(); onDelete(); }}
                        >
                            <Trash2 size={16} />
                        </Button>
                    </div>
                </div>
            </CardContent>
        </Card>
    );
}

function CampaignDetailSidePanel({ campaign, onClose, onLaunchBatch, onAddProspectsClick, onEditTemplateClick, onEditCampaignClick, onManageRecipientsClick, onDeleteClick }: { campaign: any, onClose: () => void, onLaunchBatch?: () => void, onAddProspectsClick?: () => void, onEditTemplateClick?: () => void, onEditCampaignClick?: () => void, onManageRecipientsClick?: () => void, onDeleteClick?: () => void }) {
    const delivRate = pct(campaign.sent_count - (campaign.bounced_count || 0), campaign.sent_count);
    const openRate = pct(campaign.opened_count, campaign.sent_count);
    const clickRate = pct(campaign.clicked_count, campaign.opened_count);
    const [isLaunching, setIsLaunching] = useState(false);

    const handleLaunch = async () => {
        if (!onLaunchBatch) return;
        setIsLaunching(true);
        await onLaunchBatch();
        setIsLaunching(false);
    };

    return (
        <Card className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl border-slate-200 dark:border-slate-800 shadow-2xl animate-in fade-in slide-in-from-right-4 duration-300 overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/5 rounded-full -mr-16 -mt-16 blur-2xl"></div>
            
            <CardHeader className="p-5 border-b border-slate-200 dark:border-slate-800 flex flex-row items-center justify-between space-y-0 relative z-10">
                <div className="flex flex-col">
                    <CardTitle className="text-base font-bold text-slate-900 dark:text-slate-100">{campaign.name}</CardTitle>
                    <div className="flex items-center gap-1.5 mt-0.5">
                        <div className={cn("h-1.5 w-1.5 rounded-full", campaign.status === 'active' ? "bg-emerald-500 animate-pulse" : "bg-slate-400")}></div>
                        <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">{campaign.status}</span>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    <Button variant="ghost" size="icon" onClick={onClose} className="h-8 w-8 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800">
                        <X size={18} />
                    </Button>
                </div>
            </CardHeader>
            <CardContent className="p-5 flex flex-col gap-6 relative z-10">
                {/* Automation Badge */}
                {campaign.status === 'active' && (
                    <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-3 flex items-start gap-3">
                        <div className="bg-emerald-500/20 p-2 rounded-lg shrink-0">
                            <Zap size={16} className="text-emerald-500 animate-pulse" />
                        </div>
                        <div className="flex-1">
                            <p className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-tight">Automatisation Active</p>
                            <p className="text-[10px] text-emerald-600/70 dark:text-emerald-400/60 leading-none mt-1 font-medium">Envoi automatique toutes les 5 minutes</p>
                            {onLaunchBatch && (
                                <button 
                                    onClick={handleLaunch} 
                                    disabled={isLaunching || campaign.sent_today >= campaign.daily_limit} 
                                    className="text-[9px] text-emerald-600/80 hover:text-emerald-600 font-bold underline mt-2 disabled:opacity-50 block"
                                >
                                    {isLaunching ? <Loader2 className="mr-1 h-3 w-3 animate-spin inline" /> : null}
                                    Déclencher un envoi immédiat
                                </button>
                            )}
                        </div>
                    </div>
                )}

                {/* Primary Actions Grid */}
                <div className="grid grid-cols-2 gap-3">
                    <Button
                        onClick={onAddProspectsClick}
                        className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold h-11 shadow-lg shadow-emerald-500/20 gap-2 transition-all hover:scale-[1.02] active:scale-[0.98] text-xs rounded-xl"
                    >
                        <UserPlus size={16} />
                        Ajouter
                    </Button>
                    <Button
                        onClick={onEditTemplateClick}
                        variant="outline"
                        className="bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 font-bold h-11 shadow-sm gap-2 transition-all hover:scale-[1.02] active:scale-[0.98] text-xs rounded-xl"
                    >
                        <Edit size={16} />
                        Email
                    </Button>
                </div>

                <div className="grid grid-cols-2 gap-3">
                    <Button
                        onClick={onEditCampaignClick}
                        variant="outline"
                        className="bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 font-bold h-11 shadow-sm gap-2 transition-all hover:scale-[1.02] active:scale-[0.98] text-xs rounded-xl"
                    >
                        <Settings size={16} />
                        Paramètres
                    </Button>
                    <Button
                        onClick={onManageRecipientsClick}
                        variant="outline"
                        className="bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 font-bold h-11 shadow-sm gap-2 transition-all hover:scale-[1.02] active:scale-[0.98] text-xs rounded-xl"
                    >
                        <Users size={16} />
                        Liste
                    </Button>
                </div>

                {/* Main Detailed Stats */}
                <div className="grid grid-cols-2 gap-3">
                    <StatCard label="Délivrabilité" value={`${delivRate}%`} IconComponent={CheckCircle} colorClass="text-emerald-500" sub={`${campaign.sent_count - (campaign.bounced_count || 0)} livrés`} />
                    <StatCard label="Taux d'ouverture" value={`${openRate}%`} IconComponent={Mail} colorClass="text-blue-500" sub={`${campaign.opened_count || 0} ouverts`} />
                    <StatCard label="Taux de clic" value={`${clickRate}%`} IconComponent={Zap} colorClass="text-purple-500" sub={`${campaign.clicked_count || 0} clics`} />
                    <StatCard label="Rebonds" value={campaign.bounced_count || 0} IconComponent={AlertTriangle} colorClass="text-red-500" sub={`${pct(campaign.bounced_count || 0, campaign.sent_count)}%`} />
                    <div className="col-span-2">
                        <StatCard label="Désabonnements" value={campaign.unsubscribed_count || 0} IconComponent={Users} colorClass="text-orange-500" sub={`${pct(campaign.unsubscribed_count || 0, campaign.sent_count)}%`} />
                    </div>
                </div>

                {/* Spam Analysis Sidebar */}
                <div className="p-4 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl">
                    <div className="flex items-center gap-2 mb-3">
                        <Shield size={14} className="text-emerald-500" />
                        <span className="text-[10px] font-bold text-slate-800 dark:text-slate-200 uppercase tracking-widest">Analyse Anti-Spam</span>
                    </div>
                    <SpamMeter score={campaign.spam_score || 0} />
                </div>

                {/* Detailed Info Rows */}
                <div className="flex flex-col gap-2">
                    <div className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1">Configuration</div>
                    {[
                        ["Sujet", campaign.subject || 'Non défini'],
                        ["Expéditeur", `${campaign.from_name || ''} <${campaign.from_email || ''}>`],
                        ["Heure d'envoi", campaign.schedule || '--:--'],
                        ["Délai Throttle", `${campaign.throttle_min}-${campaign.throttle_max}s`],
                        ["Warm-up J.", `${campaign.warmup_day || 1}/7`],
                    ].map(([k, v]) => (
                        <div key={k} className="flex justify-between items-center py-2 border-b border-slate-200 dark:border-slate-800/50">
                            <span className="text-[11px] text-slate-500 font-medium">{k}</span>
                            <span className="text-[11px] text-slate-800 dark:text-slate-200 font-bold truncate max-w-[180px]">{v}</span>
                        </div>
                    ))}
                </div>

                {/* Quick View Message Body if needed or other metadata */}
                <div className="bg-slate-50 dark:bg-slate-950 p-3 rounded-lg border border-slate-200 dark:border-slate-800">
                    <div className="text-[10px] font-bold text-slate-500 uppercase mb-2">Description</div>
                    <p className="text-[11px] text-slate-600 dark:text-slate-400 leading-relaxed line-clamp-4 italic">
                        "{campaign.description || 'Aucune description'}"
                    </p>
                </div>
            </CardContent>
        </Card>
    );
}

function AntiSpamBestPractices() {
    return (
        <Card className="bg-slate-50/50 dark:bg-slate-950/50 border-slate-200 dark:border-slate-800">
            <CardHeader className="p-4 pb-2">
                <CardTitle className="text-sm font-bold flex items-center gap-2 text-slate-800 dark:text-slate-200">
                    <Info size={16} className="text-blue-500" /> Bonnes Pratiques Anti-Spam
                </CardTitle>
            </CardHeader>
            <CardContent className="p-4 pt-1 flex flex-col gap-2">
                {[
                    ["🎯", "200 emails max/jour", "Limite optimale pour protéger votre IP"],
                    ["⏱️", "Délai aléatoire", "Throttle 3-7s pour simuler un humain"],
                    ["📝", "Personnalisation", "Utilisez des balises pour varier le texte"],
                    ["🌡️", "Warm-up progressif", "Monte en charge auto sur 7 jours"],
                    ["✅", "SPF + DKIM", "Authentifiez votre nom de domaine"],
                ].map(([ico, title, desc]) => (
                    <div key={title} className="flex gap-3 py-2 border-b border-slate-200 dark:border-slate-800/50 last:border-0">
                        <span className="text-sm">{ico}</span>
                        <div>
                            <div className="text-[10px] font-bold text-slate-800 dark:text-slate-200 uppercase">{title}</div>
                            <div className="text-[10px] text-slate-500">{desc}</div>
                        </div>
                    </div>
                ))}
            </CardContent>
        </Card>
    );
}
