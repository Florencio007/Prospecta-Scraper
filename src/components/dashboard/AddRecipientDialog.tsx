import { useState, useEffect } from "react";
import { Search, Loader2, Users, Check, Plus, UserPlus } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";

interface Prospect {
    id: string;
    name: string;
    company: string;
    email: string;
    initials: string;
}

interface AddRecipientDialogProps {
    isOpen: boolean;
    onClose: () => void;
    onSelected: (prospectIds: string[]) => void;
    onManualAdd: (data: { first_name: string, last_name: string, email: string, company: string }) => Promise<void>;
    alreadyAddedIds?: string[];
}

export default function AddRecipientDialog({ isOpen, onClose, onSelected, onManualAdd, alreadyAddedIds = [] }: AddRecipientDialogProps) {
    const { user } = useAuth();
    const { toast } = useToast();
    const [prospects, setProspects] = useState<Prospect[]>([]);
    const [loading, setLoading] = useState(false);
    const [searchTerm, setSearchTerm] = useState("");
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
    const [isSaving, setIsSaving] = useState(false);

    // Manual form state
    const [manualData, setManualData] = useState({
        first_name: "",
        last_name: "",
        email: "",
        company: ""
    });

    useEffect(() => {
        if (isOpen && user) {
            fetchProspects();
            setSelectedIds(new Set());
            setManualData({ first_name: "", last_name: "", email: "", company: "" });
        }
    }, [isOpen, user]);

    const fetchProspects = async () => {
        setLoading(true);
        try {
            const { data, error } = await supabase
                .from("prospects")
                .select("*, prospect_data(*)")
                .eq("user_id", user?.id)
                .order("created_at", { ascending: false });

            if (error) throw error;

            const flattened = data?.map((p: any) => {
                const pd = Array.isArray(p.prospect_data) ? (p.prospect_data[0] || {}) : (p.prospect_data || {});
                return {
                    id: p.id,
                    name: pd.name || p.name || 'Nom inconnu',
                    company: pd.company || p.company || 'Entreprise inconnue',
                    email: pd.email || p.email || '',
                    initials: pd.initials || p.initials || (pd.name || p.name || 'N').substring(0, 2).toUpperCase()
                };
            }) || [];

            const available = flattened.filter(p => !alreadyAddedIds.includes(p.id));
            setProspects(available);
        } catch (error) {
            console.error("Error fetching prospects:", error);
        } finally {
            setLoading(false);
        }
    };

    const toggleSelect = (id: string) => {
        const next = new Set(selectedIds);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        setSelectedIds(next);
    };

    const toggleSelectAll = () => {
        if (selectedIds.size === filteredProspects.length) {
            setSelectedIds(new Set());
        } else {
            setSelectedIds(new Set(filteredProspects.map(p => p.id)));
        }
    };

    const filteredProspects = prospects.filter(p =>
        p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        p.company.toLowerCase().includes(searchTerm.toLowerCase()) ||
        p.email.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const handleConfirmSelection = () => {
        onSelected(Array.from(selectedIds));
        onClose();
    };

    const handleManualSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!manualData.email) {
            toast({ title: "Email requis", variant: "destructive" });
            return;
        }
        setIsSaving(true);
        try {
            await onManualAdd(manualData);
            toast({ title: "Destinataire ajouté" });
            onClose();
        } catch (err: any) {
            toast({ title: "Erreur", description: err.message, variant: "destructive" });
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="max-w-xl bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 p-0 overflow-hidden outline-none flex flex-col h-[80vh] max-h-[700px]">
                <div className="p-6 pb-2">
                    <DialogHeader>
                        <DialogTitle className="text-xl font-black flex items-center gap-2">
                            <Plus className="text-emerald-500" size={20} /> Ajouter des destinataires
                        </DialogTitle>
                        <DialogDescription className="text-slate-500 text-xs mt-1 uppercase font-bold tracking-widest">
                            Ajoutez des contacts à votre campagne
                        </DialogDescription>
                    </DialogHeader>
                </div>

                <Tabs defaultValue="prospects" className="flex-1 flex flex-col overflow-hidden">
                    <div className="px-6 border-b border-slate-100 dark:border-slate-800">
                        <TabsList className="bg-transparent h-12 gap-6 p-0">
                            <TabsTrigger 
                                value="prospects" 
                                className="data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-emerald-500 rounded-none h-full px-0 text-xs font-bold uppercase tracking-tighter"
                            >
                                <Users size={14} className="mr-2" /> Depuis Prospects
                            </TabsTrigger>
                            <TabsTrigger 
                                value="manual" 
                                className="data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-emerald-500 rounded-none h-full px-0 text-xs font-bold uppercase tracking-tighter"
                            >
                                <UserPlus size={14} className="mr-2" /> Entrée Manuelle
                            </TabsTrigger>
                        </TabsList>
                    </div>

                    <TabsContent value="prospects" className="flex-1 flex flex-col overflow-hidden m-0">
                        <div className="p-6 pb-2">
                            <div className="relative">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                                <Input
                                    placeholder="Rechercher par nom, entreprise ou email..."
                                    className="pl-10 h-11 bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800 focus:border-emerald-500"
                                    value={searchTerm}
                                    onChange={e => setSearchTerm(e.target.value)}
                                />
                            </div>
                        </div>

                        <div className="flex-1 overflow-y-auto px-6 py-2 scrollbar-hide">
                            {loading ? (
                                <div className="flex flex-col items-center justify-center py-20 gap-3">
                                    <Loader2 className="h-8 w-8 animate-spin text-emerald-500" />
                                    <p className="text-sm text-slate-500 font-medium">Récupération de vos prospects...</p>
                                </div>
                            ) : filteredProspects.length === 0 ? (
                                <div className="flex flex-col items-center justify-center py-20 text-center gap-3">
                                    <div className="h-16 w-16 rounded-full bg-slate-50 dark:bg-slate-800 flex items-center justify-center text-slate-400">
                                        <Users size={32} />
                                    </div>
                                    <p className="text-slate-600 dark:text-slate-400 font-medium">Aucun prospect trouvé</p>
                                    <p className="text-xs text-slate-500">Essayez un autre terme ou ajoutez de nouveaux prospects.</p>
                                </div>
                            ) : (
                                <div className="space-y-1 mt-2">
                                    <div className="flex items-center gap-3 p-3 mb-2 bg-slate-50 dark:bg-slate-950 rounded-lg cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors" onClick={toggleSelectAll}>
                                        <Checkbox checked={selectedIds.size === filteredProspects.length && filteredProspects.length > 0} />
                                        <span className="text-xs font-bold uppercase text-slate-500 tracking-tighter">Tout sélectionner ({filteredProspects.length})</span>
                                    </div>
                                    {filteredProspects.map(p => (
                                        <div
                                            key={p.id}
                                            className={`flex items-center gap-4 p-3 rounded-xl border transition-all cursor-pointer group ${selectedIds.has(p.id) ? 'bg-emerald-500/5 border-emerald-500/20' : 'bg-white dark:bg-slate-900 border-slate-100 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700'}`}
                                            onClick={() => toggleSelect(p.id)}
                                        >
                                            <Checkbox checked={selectedIds.has(p.id)} />
                                            <div className="h-10 w-10 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center font-bold text-slate-600 dark:text-slate-400 text-xs shrink-0 group-hover:bg-emerald-500/10 group-hover:text-emerald-500 transition-colors">
                                                {p.initials}
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <div className="font-bold text-sm text-slate-900 dark:text-slate-100 truncate">{p.name}</div>
                                                <div className="text-[10px] text-slate-500 font-medium truncate uppercase tracking-tighter">{p.company} • {p.email || 'Pas d\'email'}</div>
                                            </div>
                                            {selectedIds.has(p.id) && <Check size={16} className="text-emerald-500 shrink-0" />}
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>

                        <div className="p-6 bg-slate-50 dark:bg-slate-950 border-t border-slate-200 dark:border-slate-800 flex justify-between items-center">
                            <div className="text-xs font-bold text-slate-500">
                                {selectedIds.size} sélectionné{selectedIds.size > 1 ? 's' : ''}
                            </div>
                            <div className="flex gap-3">
                                <Button variant="ghost" onClick={onClose} className="text-slate-500 font-bold">
                                    Annuler
                                </Button>
                                <Button
                                    onClick={handleConfirmSelection}
                                    disabled={selectedIds.size === 0}
                                    className="bg-emerald-600 hover:bg-emerald-700 text-white font-black px-8 gap-2"
                                >
                                    <Plus size={16} /> Ajouter ({selectedIds.size})
                                </Button>
                            </div>
                        </div>
                    </TabsContent>

                    <TabsContent value="manual" className="flex-1 flex flex-col m-0 p-6">
                        <form onSubmit={handleManualSubmit} className="space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label htmlFor="first_name" className="text-xs font-bold uppercase tracking-tighter">Prénom</Label>
                                    <Input 
                                        id="first_name" 
                                        value={manualData.first_name} 
                                        onChange={e => setManualData({...manualData, first_name: e.target.value})}
                                        className="h-11 bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800 focus:border-emerald-500"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="last_name" className="text-xs font-bold uppercase tracking-tighter">Nom</Label>
                                    <Input 
                                        id="last_name" 
                                        value={manualData.last_name} 
                                        onChange={e => setManualData({...manualData, last_name: e.target.value})}
                                        className="h-11 bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800 focus:border-emerald-500"
                                    />
                                </div>
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="email" className="text-xs font-bold uppercase tracking-tighter">Email (Requis)</Label>
                                <Input 
                                    id="email" 
                                    type="email" 
                                    required
                                    value={manualData.email} 
                                    onChange={e => setManualData({...manualData, email: e.target.value})}
                                    className="h-11 bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800 focus:border-emerald-500"
                                    placeholder="ex: contact@entreprise.com"
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="company" className="text-xs font-bold uppercase tracking-tighter">Entreprise</Label>
                                <Input 
                                    id="company" 
                                    value={manualData.company} 
                                    onChange={e => setManualData({...manualData, company: e.target.value})}
                                    className="h-11 bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800 focus:border-emerald-500"
                                />
                            </div>

                            <div className="pt-6 border-t border-slate-100 dark:border-slate-800 flex justify-end gap-3 mt-auto">
                                <Button type="button" variant="ghost" onClick={onClose} className="text-slate-500 font-bold">
                                    Annuler
                                </Button>
                                <Button
                                    type="submit"
                                    disabled={isSaving || !manualData.email}
                                    className="bg-emerald-600 hover:bg-emerald-700 text-white font-black px-8 gap-2"
                                >
                                    {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus size={16} />}
                                    Ajouter manuellement
                                </Button>
                            </div>
                        </form>
                    </TabsContent>
                </Tabs>
            </DialogContent>
        </Dialog>
    );
}
