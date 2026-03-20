import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { 
    Mail, 
    BarChart3, 
    MousePointer2, 
    AlertCircle, 
    Play, 
    Pause, 
    Settings, 
    Users, 
    Zap,
    Clock,
    MoreHorizontal,
    Trash2
} from 'lucide-react';
import { EmailCampaign } from '@/hooks/useEmailCampaigns';
import { 
    DropdownMenu, 
    DropdownMenuContent, 
    DropdownMenuItem, 
    DropdownMenuTrigger, 
    DropdownMenuSeparator 
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface CampaignCardProps {
    campaign: EmailCampaign;
    onSelect: () => void;
    onToggle: (e: React.MouseEvent) => void;
    onEdit: (e: React.MouseEvent) => void;
    onDelete: (e: React.MouseEvent) => void;
    isSelected: boolean;
    key?: any;
}

const CampaignCard = ({ 
    campaign, 
    onSelect, 
    onToggle, 
    onEdit, 
    onDelete, 
    isSelected 
}: CampaignCardProps) => {
    
    const pct = (value: number, total: number) => {
        if (!total || total === 0) return 0;
        return Math.round((value / total) * 100);
    };

    const openRate = pct(campaign.opened_count, campaign.sent_count);
    const clickRate = pct(campaign.clicked_count, campaign.opened_count);
    const deliveryRate = pct(campaign.sent_count - (campaign.bounced_count || 0), campaign.sent_count);
    
    const dailyProgress = pct(campaign.sent_today, campaign.daily_limit);
    
    // Status styles
    const statusConfig = {
        active: { 
            label: 'Actif', 
            color: 'bg-emerald-500', 
            bgColor: 'bg-emerald-500/10', 
            textColor: 'text-emerald-500',
            pulse: true 
        },
        paused: { 
            label: 'En pause', 
            color: 'bg-amber-500', 
            bgColor: 'bg-amber-500/10', 
            textColor: 'text-amber-500',
            pulse: false 
        },
        draft: { 
            label: 'Brouillon', 
            color: 'bg-blue-500', 
            bgColor: 'bg-blue-500/10', 
            textColor: 'text-blue-500',
            pulse: false 
        },
        completed: { 
            label: 'Terminé', 
            color: 'bg-slate-500', 
            bgColor: 'bg-slate-500/10', 
            textColor: 'text-slate-500',
            pulse: false 
        }
    }[campaign.status as keyof typeof statusConfig] || { 
        label: campaign.status, 
        color: 'bg-slate-500', 
        bgColor: 'bg-slate-500/10', 
        textColor: 'text-slate-500',
        pulse: false 
    };

    return (
        <Card 
            className={cn(
                "group relative overflow-hidden transition-all duration-300 hover:shadow-2xl hover:scale-[1.02] cursor-pointer border-border/40",
                "bg-gradient-to-br from-white/80 to-white/40 dark:from-slate-900/80 dark:to-slate-900/40 backdrop-blur-xl",
                isSelected ? "ring-2 ring-emerald-500/50 border-emerald-500/50 shadow-emerald-500/10" : "hover:border-emerald-500/30"
            )}
            onClick={onSelect}
        >
            {/* Background Decorative Element */}
            <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/5 rounded-full -mr-16 -mt-16 blur-3xl transition-all group-hover:bg-emerald-500/10"></div>
            
            <CardContent className="p-5">
                {/* Header: Title & Status */}
                <div className="flex justify-between items-start mb-4">
                    <div className="flex-1 min-w-0">
                        <h3 className="text-base font-bold text-foreground truncate group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors">
                            {campaign.name}
                        </h3>
                        <div className="flex items-center gap-2 mt-1">
                            <div className={cn(
                                "h-2 w-2 rounded-full",
                                statusConfig.color,
                                statusConfig.pulse && "animate-pulse shadow-[0_0_8px_rgba(16,185,129,0.6)]"
                            )}></div>
                            <span className={cn("text-[10px] font-bold uppercase tracking-wider", statusConfig.textColor)}>
                                {statusConfig.label}
                            </span>
                        </div>
                    </div>
                    
                    <div className="flex items-center gap-1">
                        <Button 
                            variant="ghost" 
                            size="icon" 
                            className="h-8 w-8 text-slate-400 hover:text-emerald-500 hover:bg-emerald-50 dark:hover:bg-emerald-950/30 transition-colors"
                            onClick={(e) => { e.stopPropagation(); onToggle(e); }}
                            title={campaign.status === 'active' ? 'Mettre en pause' : 'Lancer'}
                        >
                            {campaign.status === 'active' ? <Pause size={16} /> : <Play size={16} />}
                        </Button>
                        <Button 
                            variant="ghost" 
                            size="icon" 
                            className="h-8 w-8 text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors"
                            onClick={(e) => { e.stopPropagation(); onDelete(e); }}
                            title="Supprimer"
                        >
                            <Trash2 size={16} />
                        </Button>
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                                <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full hover:bg-emerald-500/10 hover:text-emerald-600">
                                    <MoreHorizontal size={16} />
                                </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-48 p-1 rounded-xl">
                                <DropdownMenuItem onClick={onEdit} className="rounded-lg gap-2">
                                    <Settings size={14} /> Paramètres
                                </DropdownMenuItem>
                            </DropdownMenuContent>
                        </DropdownMenu>
                    </div>
                </div>

                {/* Metrics Grid */}
                <div className="grid grid-cols-3 gap-3 mb-5">
                    <div className="space-y-1">
                        <div className="flex items-center gap-1.5 text-muted-foreground">
                            <Mail size={12} className="text-blue-500" />
                            <span className="text-[10px] font-medium uppercase tracking-tight">Ouverts</span>
                        </div>
                        <div className="flex items-baseline gap-1">
                            <span className="text-lg font-black text-foreground">{openRate}%</span>
                            <span className="text-[10px] text-muted-foreground/60">({campaign.opened_count || 0})</span>
                        </div>
                    </div>
                    
                    <div className="space-y-1">
                        <div className="flex items-center gap-1.5 text-muted-foreground">
                            <MousePointer2 size={12} className="text-purple-500" />
                            <span className="text-[10px] font-medium uppercase tracking-tight">Clics</span>
                        </div>
                        <div className="flex items-baseline gap-1">
                            <span className="text-lg font-black text-foreground">{clickRate}%</span>
                            <span className="text-[10px] text-muted-foreground/60">({campaign.clicked_count || 0})</span>
                        </div>
                    </div>

                    <div className="space-y-1 text-right">
                        <div className="flex items-center justify-end gap-1.5 text-muted-foreground">
                            <BarChart3 size={12} className="text-emerald-500" />
                            <span className="text-[10px] font-medium uppercase tracking-tight">Envoyés</span>
                        </div>
                        <div className="text-lg font-black text-foreground">{campaign.sent_count || 0}</div>
                    </div>
                </div>

                {/* Daily Progress & Stats */}
                <div className="space-y-3 pt-4 border-t border-border/40">
                    <div className="flex justify-between items-center text-[10px]">
                        <div className="flex items-center gap-1.5 font-bold text-muted-foreground uppercase tracking-wider">
                            <Zap size={10} className="text-amber-500" />
                            Limite Quotidienne
                        </div>
                        <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400">
                            {campaign.sent_today} / {campaign.daily_limit}
                        </span>
                    </div>
                    
                    <div className="relative h-1.5 w-full bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                        <div 
                            className={cn(
                                "absolute top-0 left-0 h-full transition-all duration-500 rounded-full",
                                dailyProgress > 90 ? "bg-red-500" : dailyProgress > 70 ? "bg-amber-500" : "bg-emerald-500"
                            )}
                            style={{ width: `${Math.min(100, dailyProgress)}%` }}
                        />
                    </div>

                    <div className="flex items-center justify-between text-[10px] text-muted-foreground pt-1">
                        <div className="flex items-center gap-1">
                            <Users size={10} />
                            <span>{campaign.total_recipients || 0} prospects</span>
                        </div>
                        <div className="flex items-center gap-1">
                            <Clock size={10} />
                            <span>{campaign.last_sent_at ? 'Actif' : 'Jamais lancé'}</span>
                        </div>
                    </div>
                </div>
            </CardContent>
            
            {/* Quick Hover Action Bar - Optional */}
            <div className="absolute bottom-0 left-0 w-full h-1 bg-emerald-500 scale-x-0 group-hover:scale-x-100 transition-transform duration-500 origin-left"></div>
        </Card>
    );
};

export default CampaignCard;
