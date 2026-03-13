import { useState, useEffect } from "react";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { 
    Users, 
    Trash2, 
    Search, 
    X, 
    Mail, 
    Building2, 
    MapPin,
    Loader2
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";

interface ManageRecipientsDialogProps {
    isOpen: boolean;
    onClose: () => void;
    campaign: any;
    getRecipients: (id: string) => Promise<any[]>;
    onRemove: (campaignId: string, recipientId: string) => Promise<boolean>;
}

export default function ManageRecipientsDialog({ isOpen, onClose, campaign, getRecipients, onRemove }: ManageRecipientsDialogProps) {
    const { toast } = useToast();
    const [loading, setLoading] = useState(true);
    const [recipients, setRecipients] = useState<any[]>([]);
    const [search, setSearch] = useState("");
    const [deletingId, setDeletingId] = useState<string | null>(null);

    useEffect(() => {
        if (isOpen && campaign) {
            loadRecipients();
        }
    }, [isOpen, campaign]);

    const loadRecipients = async () => {
        setLoading(true);
        const data = await getRecipients(campaign.id);
        setRecipients(data);
        setLoading(false);
    };

    const handleRemove = async (recipientId: string) => {
        if (!campaign) return;
        setDeletingId(recipientId);
        const success = await onRemove(campaign.id, recipientId);
        if (success) {
            setRecipients(prev => prev.filter(r => r.id !== recipientId));
            toast({
                title: "Prospect supprimé",
                description: "Le prospect a été retiré de la campagne."
            });
        }
        setDeletingId(null);
    };

    const filtered = recipients.filter(r => 
        (r.first_name + " " + r.last_name).toLowerCase().includes(search.toLowerCase()) ||
        r.email.toLowerCase().includes(search.toLowerCase()) ||
        (r.company || "").toLowerCase().includes(search.toLowerCase())
    );

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="sm:max-w-[700px] h-[80vh] bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-900 dark:text-slate-100 p-0 overflow-hidden outline-none flex flex-col">
                <div className="p-6 border-b border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/50">
                    <DialogHeader>
                        <div className="flex justify-between items-center">
                            <div>
                                <DialogTitle className="text-xl font-black flex items-center gap-2 font-outfit">
                                    <Users className="text-emerald-500" size={20} /> Destinataires de la Campagne
                                </DialogTitle>
                                <p className="text-xs text-slate-500 dark:text-slate-400 font-bold uppercase tracking-widest mt-1">
                                    {campaign?.name} — {recipients.length} prospects
                                </p>
                            </div>
                        </div>
                    </DialogHeader>
                    
                    <div className="relative mt-6">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                        <Input 
                            placeholder="Rechercher un prospect par nom, email ou entreprise..."
                            className="pl-10 bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-800 h-10 transition-all focus:border-emerald-500 font-medium"
                            value={search}
                            onChange={e => setSearch(e.target.value)}
                        />
                    </div>
                </div>

                <div className="flex-1 overflow-hidden">
                    <ScrollArea className="h-full">
                        {loading ? (
                            <div className="flex flex-col items-center justify-center py-20 gap-4">
                                <Loader2 className="h-8 w-8 animate-spin text-emerald-500" />
                                <p className="text-sm font-medium text-slate-500 uppercase tracking-tighter">Chargement des destinataires...</p>
                            </div>
                        ) : filtered.length === 0 ? (
                            <div className="flex flex-col items-center justify-center py-20 text-slate-400">
                                <Users size={48} className="opacity-10 mb-4" />
                                <p className="text-sm font-bold uppercase tracking-widest">Aucun prospect trouvé</p>
                            </div>
                        ) : (
                            <div className="divide-y divide-slate-100 dark:divide-slate-800/50">
                                {filtered.map((r) => (
                                    <div key={r.id} className="p-4 flex items-center justify-between hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors">
                                        <div className="flex-1 min-w-0 pr-4">
                                            <div className="flex items-center gap-2 mb-1">
                                                <h4 className="text-sm font-bold text-slate-900 dark:text-slate-100 truncate">
                                                    {r.first_name} {r.last_name}
                                                </h4>
                                                <Badge variant="outline" className={`text-[9px] px-1.5 py-0 font-black uppercase ${
                                                    r.status === 'sent' ? 'bg-blue-500/10 text-blue-500 border-blue-500/20' :
                                                    r.status === 'pending' ? 'bg-amber-500/10 text-amber-500 border-amber-500/20' :
                                                    'bg-slate-500/10 text-slate-500 border-slate-500/20'
                                                }`}>
                                                    {r.status}
                                                </Badge>
                                            </div>
                                            <div className="flex flex-wrap items-center gap-3 text-[10px] text-slate-500 font-medium">
                                                <span className="flex items-center gap-1"><Mail size={10} /> {r.email}</span>
                                                {r.company && <span className="flex items-center gap-1"><Building2 size={10} /> {r.company}</span>}
                                                {r.city && <span className="flex items-center gap-1"><MapPin size={10} /> {r.city}</span>}
                                            </div>
                                        </div>
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            onClick={() => handleRemove(r.id)}
                                            disabled={deletingId === r.id}
                                            className="h-9 w-9 text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-500/10"
                                        >
                                            {deletingId === r.id ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
                                        </Button>
                                    </div>
                                ))}
                            </div>
                        )}
                    </ScrollArea>
                </div>

                <div className="p-4 bg-slate-50 dark:bg-slate-950 border-t border-slate-200 dark:border-slate-800 flex justify-end">
                    <Button
                        variant="ghost"
                        onClick={onClose}
                        className="text-slate-600 dark:text-slate-400 font-bold hover:bg-slate-200 dark:hover:bg-slate-800"
                    >
                        Fermer
                    </Button>
                </div>
            </DialogContent>
        </Dialog>
    );
}
