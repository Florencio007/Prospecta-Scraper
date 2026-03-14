import { useState, useEffect } from "react";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Settings, Save, X, Loader2, Clock, CheckCircle, Zap } from "lucide-react";
import { useLanguage } from "@/hooks/useLanguage";

interface EditCampaignDialogProps {
    isOpen: boolean;
    onClose: () => void;
    campaign: any;
    onSave: (id: string, updates: any) => Promise<void>;
}

export default function EditCampaignDialog({ isOpen, onClose, campaign, onSave }: EditCampaignDialogProps) {
    const { t } = useLanguage();
    const [isSaving, setIsSaving] = useState(false);
    const [form, setForm] = useState({
        name: "",
        from_name: "",
        from_email: "",
        daily_limit: 200,
        schedule_time: "08:00",
        throttle_min_seconds: 3,
        throttle_max_seconds: 7,
        enable_warmup: true,
    });

    useEffect(() => {
        if (campaign) {
            setForm({
                name: campaign.name || "",
                from_name: campaign.from_name || "",
                from_email: campaign.from_email || "",
                daily_limit: campaign.daily_limit || 200,
                schedule_time: campaign.schedule_time || "08:00",
                throttle_min_seconds: campaign.throttle_min_seconds || 3,
                throttle_max_seconds: campaign.throttle_max_seconds || 7,
                enable_warmup: campaign.enable_warmup !== false,
            });
        }
    }, [campaign, isOpen]);

    const updateForm = (key: string, value: any) => setForm(prev => ({ ...prev, [key]: value }));

    const handleSave = async () => {
        if (!campaign) return;
        setIsSaving(true);
        try {
            await onSave(campaign.id, form);
            onClose();
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="sm:max-w-[600px] bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-900 dark:text-slate-100 p-0 overflow-hidden outline-none">
                <div className="p-6">
                    <DialogHeader className="mb-6">
                        <DialogTitle className="text-xl font-black flex items-center gap-2 font-outfit">
                            <Settings className="text-emerald-500" size={20} /> Paramètres de la Campagne
                        </DialogTitle>
                    </DialogHeader>

                    <div className="space-y-6 max-h-[60vh] overflow-y-auto pr-2">
                        <div className="space-y-4">
                            <div className="space-y-2">
                                <Label className="text-[10px] uppercase font-black text-slate-500 tracking-tighter">Nom de la campagne</Label>
                                <Input
                                    placeholder="Nom de la campagne"
                                    className="bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800 h-11 transition-all focus:border-emerald-500 font-medium"
                                    value={form.name}
                                    onChange={e => updateForm("name", e.target.value)}
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label className="text-[10px] uppercase font-black text-slate-500 tracking-tighter">Expéditeur (Nom)</Label>
                                    <Input
                                        placeholder="Nom"
                                        className="bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800 h-11 focus:border-emerald-500 font-medium"
                                        value={form.from_name}
                                        onChange={e => updateForm("from_name", e.target.value)}
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label className="text-[10px] uppercase font-black text-slate-500 tracking-tighter">Email d'envoi</Label>
                                    <Input
                                        placeholder="Email"
                                        className="bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800 h-11 focus:border-emerald-500 font-medium"
                                        value={form.from_email}
                                        onChange={e => updateForm("from_email", e.target.value)}
                                    />
                                </div>
                            </div>

                            <div className="grid grid-cols-3 gap-4">
                                <div className="space-y-2">
                                    <Label className="text-[10px] uppercase font-black text-slate-500 tracking-tighter">Limite / jour</Label>
                                        <Input
                                            type="number"
                                            max={200}
                                            min={0}
                                            className="bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800 h-11 focus:border-emerald-500 font-medium"
                                            value={form.daily_limit}
                                            onChange={e => {
                                                const val = e.target.value === "" ? 0 : parseInt(e.target.value);
                                                updateForm("daily_limit", isNaN(val) ? 0 : val);
                                            }}
                                        />
                                </div>
                                <div className="space-y-2">
                                    <Label className="text-[10px] uppercase font-black text-slate-500 tracking-tighter">Throttle Min (s)</Label>
                                        <Input
                                            type="number"
                                            min={0}
                                            className="bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800 h-11 focus:border-emerald-500 font-medium"
                                            value={form.throttle_min_seconds}
                                            onChange={e => {
                                                const val = e.target.value === "" ? 0 : parseInt(e.target.value);
                                                updateForm("throttle_min_seconds", isNaN(val) ? 0 : val);
                                            }}
                                        />
                                </div>
                                <div className="space-y-2">
                                    <Label className="text-[10px] uppercase font-black text-slate-500 tracking-tighter">Throttle Max (s)</Label>
                                        <Input
                                            type="number"
                                            min={0}
                                            className="bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800 h-11 focus:border-emerald-500 font-medium"
                                            value={form.throttle_max_seconds}
                                            onChange={e => {
                                                const val = e.target.value === "" ? 0 : parseInt(e.target.value);
                                                updateForm("throttle_max_seconds", isNaN(val) ? 0 : val);
                                            }}
                                        />
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label className="text-[10px] uppercase font-black text-slate-500 tracking-tighter">Heure d'envoi</Label>
                                    <Input
                                        type="time"
                                        className="bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800 h-11 focus:border-emerald-500 font-bold"
                                        value={form.schedule_time}
                                        onChange={e => updateForm("schedule_time", e.target.value)}
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label className="text-[10px] uppercase font-black text-slate-500 tracking-tighter">Mode Warm-up</Label>
                                    <Button
                                        type="button"
                                        variant="outline"
                                        onClick={() => updateForm("enable_warmup", !form.enable_warmup)}
                                        className={`w-full h-11 border-slate-200 dark:border-slate-800 justify-start px-3 gap-2 font-bold transition-all ${
                                            form.enable_warmup 
                                            ? 'text-emerald-500 border-emerald-500/20 bg-emerald-500/5' 
                                            : 'text-slate-500'
                                        }`}
                                    >
                                        {form.enable_warmup ? <CheckCircle className="h-4 w-4" /> : <Clock className="h-4 w-4" />}
                                        {form.enable_warmup ? 'Activé' : 'Désactivé'}
                                    </Button>
                                </div>
                            </div>

                            <div className="bg-amber-500/5 p-4 rounded-xl border border-amber-500/20 mt-4">
                                <div className="flex items-center gap-2 mb-2">
                                    <Zap size={16} className="text-amber-500" />
                                    <span className="text-xs font-bold text-amber-500 uppercase tracking-wider">Sécurité Anti-Spam</span>
                                </div>
                                <p className="text-[10px] text-amber-600/80 dark:text-amber-400/80 leading-relaxed font-medium">
                                    Ces paramètres influencent directement votre score de délivrabilité. 
                                    Un délai entre {form.throttle_min_seconds}s et {form.throttle_max_seconds}s est recommandé.
                                </p>
                            </div>
                        </div>
                    </div>
                </div>

                <DialogFooter className="p-6 bg-slate-50 dark:bg-slate-950 border-t border-slate-200 dark:border-slate-800 flex justify-end gap-3">
                    <Button
                        variant="ghost"
                        onClick={onClose}
                        className="text-slate-600 dark:text-slate-400 font-bold hover:bg-slate-200 dark:hover:bg-slate-800"
                    >
                        Annuler
                    </Button>
                    <Button
                        onClick={handleSave}
                        disabled={isSaving}
                        className="bg-emerald-600 hover:bg-emerald-700 text-white font-black h-11 px-8 gap-2 shadow-lg shadow-emerald-500/20 transition-all active:scale-95 font-outfit"
                    >
                        {isSaving ? <Loader2 className="animate-spin h-4 w-4" /> : <Save size={16} />}
                        Sauvegarder les modifications
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
