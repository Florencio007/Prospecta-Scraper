import { useState, useEffect } from "react";
import {
    Plus,
    Send,
    Shield,
    CheckCircle,
    AlertTriangle,
    Zap,
    Sparkles,
    Loader2,
    ChevronRight,
    ChevronLeft,
    Clock,
    X,
    Wand2,
    Mail,
} from "lucide-react";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useLanguage } from "@/hooks/useLanguage";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { checkSpamScore } from "@/services/emailService";
import { useApiKeys } from "@/hooks/useApiKeys";



// --- Helper Components ---

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

function SpamMeter({ score }: { score: number }) {
    return (
        <div className="flex flex-col gap-2 bg-slate-50 dark:bg-slate-950 p-3 rounded-lg border border-slate-200 dark:border-slate-800">
            <div className="flex justify-between items-center text-[10px] font-bold uppercase">
                <span className="text-slate-500 dark:text-slate-400">Score Anti-Spam</span>
                <span className={score <= 20 ? "text-emerald-500" : score <= 50 ? "text-amber-500" : "text-destructive"}>
                    {score}/100
                </span>
            </div>
            <ProgressBar value={score} colorClass={score <= 20 ? "bg-emerald-500" : score <= 50 ? "bg-amber-500" : "bg-destructive"} />
        </div>
    );
}

// --- Main Drawer/Modal Component ---

interface CreateCampaignDialogProps {
    isOpen: boolean;
    onClose: () => void;
    onSubmit: (data: any) => void;
    isGeneratingAI?: boolean;
    onGenerateAI?: (name: string, context: string, tone?: string, sequenceType?: string) => Promise<{ subject: string, body: string } | void>;
}

export default function CreateCampaignDialog({ isOpen, onClose, onSubmit, isGeneratingAI, onGenerateAI }: CreateCampaignDialogProps) {
    const { t } = useLanguage();
    const [step, setStep] = useState(1);
    const [spamScore, setSpamScore] = useState(0);
    const [form, setForm] = useState({
        name: "",
        fromName: "",
        fromEmail: "",
        subject: "",
        body: "",
        dailyLimit: 200,
        schedule: "08:00",
        throttleMin: 3,
        throttleMax: 7,
        enableWarmup: true,
        tags: "",
        tone: "Professionnel",
        sequenceType: "Premier contact",
    });

    const { getKeys } = useApiKeys();
    const [activeProviders, setActiveProviders] = useState<string[]>([]);
    const [fetchingProviders, setFetchingProviders] = useState(true);

    useEffect(() => {
        if (isOpen) {
            getKeys().then(keys => {
                const active = keys.filter(k => k.is_active).map(k => k.provider);
                setActiveProviders(active);
                setFetchingProviders(false);
            });
        }
    }, [isOpen, getKeys]);

    const isSmtpEnabled = activeProviders.includes('smtp');

    const updateForm = (key: string, value: any) => setForm(prev => ({ ...prev, [key]: value }));

    // Simulate Spam Analysis
    useEffect(() => {
        const { score } = checkSpamScore(form.subject, form.body);
        setSpamScore(score);
    }, [form.subject, form.body]);

    const [emailError, setEmailError] = useState("");

    const validateEmail = (email: string) => {
        const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (email && !regex.test(email)) {
            setEmailError("Format d'email invalide");
            return false;
        }
        setEmailError("");
        return true;
    };

    const handleAI = async () => {
        if (!onGenerateAI) return;
        const result = await onGenerateAI(form.name, "", form.tone, form.sequenceType);
        if (result) {
            setForm(prev => ({ ...prev, subject: result.subject, body: result.body }));
        }
    };

    const isStep1Valid = form.name.trim() !== "" && form.fromEmail.trim() !== "" && !emailError;

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="sm:max-w-[600px] bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-900 dark:text-slate-100 p-0 overflow-hidden outline-none">
                <div className="p-6">
                    <DialogHeader className="mb-6">
                        <div className="flex justify-between items-center">
                            <div>
                                <DialogTitle className="text-xl font-black flex items-center gap-2">
                                    <Mail className="text-emerald-500" size={20} /> Nouvelle Campagne
                                </DialogTitle>
                                <DialogDescription className="text-slate-500 text-xs mt-1 uppercase font-bold tracking-widest flex items-center gap-2">
                                    Étape {step} sur 3
                                    {!fetchingProviders && (
                                        <span className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded text-[10px] lowercase font-medium">
                                            via {isSmtpEnabled ? 'SMTP' : 'aucun service'}
                                        </span>
                                    )}
                                </DialogDescription>
                            </div>
                        </div>
                    </DialogHeader>

                    {/* Stepper info */}
                    <div className="flex gap-1 mb-8">
                        {[1, 2, 3].map(i => (
                            <div key={i} className={`h-1.5 flex-1 rounded-full transition-all duration-500 ${step >= i ? 'bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.3)]' : 'bg-slate-200 dark:bg-slate-800'}`} />
                        ))}
                    </div>

                    <div className="space-y-6 max-h-[60vh] overflow-y-auto pr-2 scrollbar-hide">
                        {step === 1 && (
                            <div className="space-y-5 animate-in fade-in slide-in-from-bottom-4 duration-300">
                                <div className="space-y-2">
                                    <Label className="text-[10px] uppercase font-black text-slate-500 tracking-tighter">Nom de la campagne</Label>
                                    <Input
                                        placeholder="Ex: Prospection PME Antananarivo"
                                        className="bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800 focus:border-emerald-500 h-11"
                                        value={form.name}
                                        onChange={e => updateForm("name", e.target.value)}
                                    />
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <Label className="text-[10px] uppercase font-black text-slate-500 tracking-tighter">Expéditeur (Nom)</Label>
                                        <Input
                                            placeholder="Varatraza Tech"
                                            className="bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800 focus:border-emerald-500 h-11"
                                            value={form.fromName}
                                            onChange={e => updateForm("fromName", e.target.value)}
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <Label className="text-[10px] uppercase font-black text-slate-500 tracking-tighter">Email</Label>
                                        <Input
                                            placeholder="contact@vtech.mg"
                                            className={`bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800 focus:border-emerald-500 h-11 ${emailError ? 'border-red-500 focus:border-red-500' : ''}`}
                                            value={form.fromEmail}
                                            onChange={e => {
                                                updateForm("fromEmail", e.target.value);
                                                validateEmail(e.target.value);
                                            }}
                                            onBlur={e => validateEmail(e.target.value)}
                                        />
                                        {emailError && <p className="text-[10px] text-red-500 font-bold mt-1">{emailError}</p>}
                                    </div>
                                </div>
                                <div className="bg-amber-500/5 p-3 rounded-lg border border-amber-500/20 flex items-start gap-2">
                                    <AlertTriangle size={14} className="text-amber-500 mt-0.5 shrink-0" />
                                    <p className="text-[10px] text-amber-600 dark:text-amber-400 font-medium leading-relaxed">
                                        <span className="font-bold">Important :</span> {
                                            isSmtpEnabled 
                                            ? 'L\'email d\'expédition doit correspondre à votre compte SMTP (ou être un alias autorisé) pour garantir la délivrabilité.'
                                            : 'Veuillez configurer votre compte SMTP dans les paramètres pour pouvoir envoyer des emails.'
                                        }
                                    </p>
                                </div>
                                <div className="space-y-2">
                                    <Label className="text-[10px] uppercase font-black text-slate-500 tracking-tighter">Tags (virgule)</Label>
                                    <Input
                                        placeholder="PME, SaaS, IT"
                                        className="bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800 focus:border-emerald-500 h-11"
                                        value={form.tags}
                                        onChange={e => updateForm("tags", e.target.value)}
                                    />
                                </div>
                            </div>
                        )}

                        {step === 2 && (
                            <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-300 pb-4">
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <Label className="text-[10px] uppercase font-black text-slate-500 tracking-widest">Type de séquence</Label>
                                        <Select value={form.sequenceType} onValueChange={(v) => updateForm("sequenceType", v)}>
                                            <SelectTrigger className="h-10 bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800">
                                                <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {["Premier contact", "Relance douce", "Relance directe", "Dernière tentative"].map(t => (
                                                    <SelectItem key={t} value={t}>{t}</SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                    <div className="space-y-2">
                                        <Label className="text-[10px] uppercase font-black text-slate-500 tracking-widest">Ton souhaité</Label>
                                        <div className="flex gap-1">
                                            {["Pro", "Cool", "Direct"].map(t => (
                                                <Button
                                                    key={t}
                                                    type="button"
                                                    variant="outline"
                                                    size="sm"
                                                    onClick={() => updateForm("tone", t === "Pro" ? "Professionnel" : t === "Cool" ? "Chaleureux" : "Urgent")}
                                                    className={`h-10 flex-1 text-[10px] font-bold ${
                                                        (t === "Pro" && form.tone === "Professionnel") || (t === "Cool" && form.tone === "Chaleureux") || (t === "Direct" && form.tone === "Urgent")
                                                        ? "bg-emerald-500 text-white border-emerald-500"
                                                        : "bg-transparent text-slate-500 border-slate-200"
                                                    }`}
                                                >
                                                  {t}
                                                </Button>
                                            ))}
                                        </div>
                                    </div>
                                </div>

                                <div className="flex justify-between items-end bg-emerald-500/5 p-4 rounded-xl border border-emerald-500/10">
                                    <div className="space-y-1 flex-1">
                                        <h4 className="text-xs font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-2">
                                            <Sparkles size={14} /> Génération IA Premium
                                        </h4>
                                        <p className="text-[10px] text-slate-500">L'IA va créer un message adapté à votre cible et au ton choisi.</p>
                                    </div>
                                    <Button
                                        type="button"
                                        onClick={handleAI}
                                        disabled={isGeneratingAI}
                                        className="h-10 bg-emerald-600 hover:bg-emerald-700 text-white gap-2 px-6 shadow-lg shadow-emerald-500/20"
                                    >
                                        {isGeneratingAI ? <Loader2 className="animate-spin h-4 w-4" /> : <Wand2 className="h-4 w-4" />}
                                        Générer
                                    </Button>
                                </div>

                                <div className="space-y-2">
                                    <Label className="text-[10px] uppercase font-black text-slate-500 tracking-widest">Objet de l'email</Label>
                                    <Input
                                        placeholder="🚀 Boostez vos ventes"
                                        className="bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800 focus:border-emerald-500 h-11 font-medium"
                                        value={form.subject}
                                        onChange={e => updateForm("subject", e.target.value)}
                                    />
                                </div>

                                <div className="space-y-2">
                                    <Label className="text-[10px] uppercase font-black text-slate-500 tracking-widest">Message (HTML)</Label>
                                    <Textarea
                                        placeholder="Bonjour {{prenom}}, ..."
                                        className="bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800 focus:border-emerald-500 min-h-[150px] leading-relaxed text-sm"
                                        value={form.body}
                                        onChange={e => updateForm("body", e.target.value)}
                                    />
                                </div>
                                <SpamMeter score={spamScore} />
                            </div>
                        )}

                        {step === 3 && (
                            <div className="space-y-5 animate-in fade-in slide-in-from-bottom-4 duration-300">
                                <div className="grid grid-cols-3 gap-4">
                                    <div className="space-y-2">
                                        <Label className="text-[10px] uppercase font-black text-slate-500 tracking-tighter">Limite quotidienne</Label>
                                        <Input
                                            type="number"
                                            max={200}
                                            min={0}
                                            className="bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800"
                                            value={form.dailyLimit}
                                            onChange={e => {
                                                const val = e.target.value === "" ? 0 : parseInt(e.target.value);
                                                updateForm("dailyLimit", isNaN(val) ? 0 : val);
                                            }}
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <Label className="text-[10px] uppercase font-black text-slate-500 tracking-tighter">Delai Min (s)</Label>
                                        <Input
                                            type="number"
                                            min={0}
                                            className="bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800"
                                            value={form.throttleMin}
                                            onChange={e => {
                                                const val = e.target.value === "" ? 0 : parseInt(e.target.value);
                                                updateForm("throttleMin", isNaN(val) ? 0 : val);
                                            }}
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <Label className="text-[10px] uppercase font-black text-slate-500 tracking-tighter">Delai Max (s)</Label>
                                        <Input
                                            type="number"
                                            min={0}
                                            className="bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800"
                                            value={form.throttleMax}
                                            onChange={e => {
                                                const val = e.target.value === "" ? 0 : parseInt(e.target.value);
                                                updateForm("throttleMax", isNaN(val) ? 0 : val);
                                            }}
                                        />
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <Label className="text-[10px] uppercase font-black text-slate-500 tracking-tighter">Heure d'envoi</Label>
                                        <Input
                                            type="time"
                                            className="bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800 h-11"
                                            value={form.schedule}
                                            onChange={e => updateForm("schedule", e.target.value)}
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <Label className="text-[10px] uppercase font-black text-slate-500 tracking-tighter">Mode Warm-up</Label>
                                        <Button
                                            type="button"
                                            variant="outline"
                                            onClick={() => updateForm("enableWarmup", !form.enableWarmup)}
                                            className={`w-full h-11 border-slate-200 dark:border-slate-800 justify-start px-3 gap-2 ${form.enableWarmup ? 'text-emerald-500 border-emerald-500/20 bg-emerald-500/5' : 'text-slate-500'}`}
                                        >
                                            {form.enableWarmup ? <CheckCircle className="h-4 w-4" /> : <Clock className="h-4 w-4" />}
                                            {form.enableWarmup ? 'Activé (Recommandé)' : 'Désactivé'}
                                        </Button>
                                    </div>
                                </div>

                                <div className="bg-amber-500/5 p-4 rounded-xl border border-amber-500/20">
                                    <div className="flex items-center gap-2 mb-2">
                                        <Zap size={16} className="text-amber-500" />
                                        <span className="text-xs font-bold text-amber-500 uppercase">Stratégie Délivrabilité</span>
                                    </div>
                                    <p className="text-[10px] text-amber-400/80 leading-relaxed font-medium">
                                        Un throttling de {form.throttleMin}-{form.throttleMax}s simule parfaitement un envoi humain.
                                        {form.enableWarmup ? " Le warm-up étalera la progression sur 7 jours pour habituer les serveurs de réception." : ""}
                                    </p>
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                {/* Footer with Controls */}
                <div className="mt-4 p-6 bg-slate-50 dark:bg-slate-950 flex justify-between items-center border-t border-slate-200 dark:border-slate-800">
                    <Button
                        variant="ghost"
                        onClick={() => step > 1 ? setStep(s => s - 1) : onClose()}
                        className="text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-200 dark:hover:bg-slate-800"
                    >
                        {step === 1 ? 'Annuler' : <><ChevronLeft className="mr-2 h-4 w-4" /> Retour</>}
                    </Button>

                    {step < 3 ? (
                        <Button
                            onClick={() => setStep(s => s + 1)}
                            disabled={step === 1 && !isStep1Valid}
                            className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold h-11 px-8 disabled:opacity-50"
                        >
                            Continuer <ChevronRight className="ml-2 h-4 w-4" />
                        </Button>
                    ) : (
                        <Button
                            onClick={() => onSubmit(form)}
                            className="bg-emerald-600 hover:bg-emerald-700 text-white font-black h-11 px-10 gap-2 shadow-[0_0_20px_rgba(16,185,129,0.2)]"
                        >
                            <Send size={16} /> Lancer la Campagne
                        </Button>
                    )}
                </div>
            </DialogContent>
        </Dialog>
    );
}
