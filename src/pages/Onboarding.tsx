import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { Building2, Target, MessageSquare, ArrowRight, ArrowLeft, CheckCircle2, Zap, FastForward } from "lucide-react";
import { useLanguage } from "@/hooks/useLanguage";
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
    AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

const Onboarding = () => {
    const { user, refreshProfile } = useAuth();
    const { t } = useLanguage();
    const navigate = useNavigate();
    const { toast } = useToast();
    const [step, setStep] = useState(1);
    const [loading, setLoading] = useState(false);

    const [formData, setFormData] = useState({
        company_name: "",
        company_type: "",
        industry: "",
        company_size: "",
        target_audience: "",
        target_city: "",
        target_channel: "",
        value_prop: "",
        communication_tone: "",
        objectives: "",
        expectations: "",
        business_activity: "",
    });

    const updateField = (field: string, value: string) => {
        setFormData((prev) => ({ ...prev, [field]: value }));
    };

    const handleNext = () => setStep((s) => s + 1);
    const handleBack = () => {
        console.log("Onboarding: handleBack from step", step);
        setStep((s) => s - 1);
    };

    const handleSubmit = async () => {
        if (!user || loading) {
            console.log("Submit blocked:", { noUser: !user, loading });
            return;
        }

        console.log("Submitting onboarding data:", formData);
        setLoading(true);

        try {
            // Add timeout logic for the database update
            const updatePromise = supabase
                .from("profiles")
                .update({
                    company_name: formData.company_name,
                    company_type: formData.company_type,
                    industry: formData.industry,
                    company_size: formData.company_size,
                    target_audience: formData.target_audience,
                    target_city: formData.target_city,
                    target_channel: formData.target_channel,
                    value_prop: formData.value_prop,
                    communication_tone: formData.communication_tone,
                    objectives: formData.objectives,
                    expectations: formData.expectations,
                    user_service_description: formData.business_activity,
                    onboarding_completed: true,
                })
                .eq("user_id", user.id);

            const { error } = await Promise.race([
                updatePromise,
                new Promise((_, reject) =>
                    setTimeout(() => reject(new Error("Update timeout")), 8000)
                )
            ]) as any;

            if (error) {
                console.error("Supabase update error:", error);
                throw error;
            }

            console.log("Profile updated successfully");

            // Try to refresh but don't let it block navigation if it's slow
            try {
                await refreshProfile();
            } catch (err) {
                console.warn("Refresh profile failed during submit:", err);
            }

            toast({
                title: "Bienvenue sur Prospecta !",
                description: "Votre profil a été configuré avec succès.",
            });

            console.log("Navigating to dashboard...");
            navigate("/dashboard");
        } catch (error: any) {
            console.error("Onboarding submission failed:", error);

            const isTimeout = error.message === "Update timeout";

            toast({
                title: isTimeout ? "Connexion lente" : "Erreur",
                description: isTimeout
                    ? "La sauvegarde prend du temps, essayez de rafraîchir la page si vous n'êtes pas redirigé."
                    : error.message,
                variant: "destructive",
            });

            // If it's a timeout, maybe it worked anyway, try to navigate
            if (isTimeout) {
                console.log("Timeout fallback: attempting navigation anyway");
                navigate("/dashboard");
            }
        } finally {
            setLoading(false);
        }
    };

    const steps = [
        { title: t("identity") || "Identité", icon: <Building2 className="w-5 h-5" /> },
        { title: t("target") || "Cible (ICP)", icon: <Target className="w-5 h-5" /> },
        { title: t("value") || "Valeur", icon: <MessageSquare className="w-5 h-5" /> },
        { title: t("objectives") || "Objectifs", icon: <Zap className="w-5 h-5" /> },
    ];

    return (
        <div className="min-h-screen bg-secondary flex flex-col items-center justify-center p-4">
            <div className="w-full max-w-2xl">
                {/* Progress Bar */}
                <div className="flex justify-between mb-8 px-2">
                    {steps.map((s, i) => (
                        <div key={i} className="flex flex-col items-center gap-2">
                            <div
                                className={`w-10 h-10 rounded-full flex items-center justify-center transition-all duration-300 ${step > i + 1 ? "bg-accent text-accent-foreground" : step === i + 1 ? "bg-primary text-primary-foreground scale-110 shadow-lg" : "bg-muted text-muted-foreground"
                                    }`}
                            >
                                {step > i + 1 ? <CheckCircle2 className="w-6 h-6" /> : s.icon}
                            </div>
                            <span className={`text-xs font-medium ${step === i + 1 ? "text-primary" : "text-muted-foreground"}`}>{s.title}</span>
                        </div>
                    ))}
                </div>

                <div key={step} className="animate-in fade-in slide-in-from-right-4 duration-500">
                    <Card className="shadow-xl border-none ring-1 ring-black/5">
                        <CardHeader className="text-center">
                            {step === 1 && (
                                <>
                                    <CardTitle className="text-2xl">{t("tellUsMore") || "Parlez-nous de vous"}</CardTitle>
                                    <CardDescription>{t("letStartBases") || "Commençons par les bases de votre activité."}</CardDescription>
                                </>
                            )}
                            {step === 2 && (
                                <>
                                    <CardTitle className="text-2xl">{t("yourIdealClient") || "Votre client idéal"}</CardTitle>
                                    <CardDescription>{t("whoReachPriority") || "Qui souhaitez-vous atteindre en priorité ?"}</CardDescription>
                                </>
                            )}
                            {step === 3 && (
                                <>
                                    <CardTitle className="text-2xl">{t("yourOffer") || "Votre offre"}</CardTitle>
                                    <CardDescription>{t("whatMakesUnique") || "Dites-nous ce qui vous rend unique."}</CardDescription>
                                </>
                            )}
                            {step === 4 && (
                                <>
                                    <CardTitle className="text-2xl">{t("objectivesAndExpectations") || "Objectifs & Attentes"}</CardTitle>
                                    <CardDescription>{t("helpUsPersonalize") || "Aidez-nous à personnaliser votre expérience."}</CardDescription>
                                </>
                            )}
                        </CardHeader>
                        <CardContent className="space-y-6 pt-4">
                            {step === 1 && (
                                <>
                                    <div className="space-y-2">
                                        <Label>{t("companyName")}</Label>
                                        <Input placeholder="ex: Mon Entreprise" value={formData.company_name} onChange={(e) => updateField("company_name", e.target.value)} />
                                    </div>
                                    <div className="space-y-2">
                                        <Label>{t("businessActivity")}</Label>
                                        <Textarea
                                            placeholder={t("businessActivityPlaceholder")}
                                            value={formData.business_activity}
                                            onChange={(e) => updateField("business_activity", e.target.value)}
                                            className="min-h-[80px]"
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <Label>{t("companyType")}</Label>
                                        <Select value={formData.company_type} onValueChange={(v) => updateField("company_type", v)}>
                                            <SelectTrigger><SelectValue placeholder={t("selectPlaceholder")} /></SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="freelance">Freelance / Indépendant</SelectItem>
                                                <SelectItem value="pme">PME Local</SelectItem>
                                                <SelectItem value="agence">Agence Marketing</SelectItem>
                                                <SelectItem value="startup">Startup Tech</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>
                                    <div className="space-y-2">
                                        <Label>{t("industry")}</Label>
                                        <Input placeholder={t("industryPlaceholder")} value={formData.industry} onChange={(e) => updateField("industry", e.target.value)} />
                                    </div>
                                    <div className="space-y-2">
                                        <Label>{t("companySize")}</Label>
                                        <Select value={formData.company_size} onValueChange={(v) => updateField("company_size", v)}>
                                            <SelectTrigger><SelectValue placeholder={t("selectPlaceholder")} /></SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="1">1 personne</SelectItem>
                                                <SelectItem value="2-10">2 à 10 personnes</SelectItem>
                                                <SelectItem value="11-50">11 à 50 personnes</SelectItem>
                                                <SelectItem value="51+">Plus de 50 personnes</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>
                                </>
                            )}

                            {step === 2 && (
                                <>
                                    <div className="space-y-2">
                                        <Label>{t("targetAudience")}</Label>
                                        <Select value={formData.target_audience} onValueChange={(v) => updateField("target_audience", v)}>
                                            <SelectTrigger><SelectValue placeholder={t("selectPlaceholder")} /></SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="b2b">B2B (Entreprises)</SelectItem>
                                                <SelectItem value="b2c">B2C (Particuliers)</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>
                                    <div className="space-y-2">
                                        <Label>{t("targetCity")}</Label>
                                        <Input placeholder={t("targetCityPlaceholder")} value={formData.target_city} onChange={(e) => updateField("target_city", e.target.value)} />
                                    </div>
                                    <div className="space-y-2">
                                        <Label>{t("targetChannel")}</Label>
                                        <Select value={formData.target_channel} onValueChange={(v) => updateField("target_channel", v)}>
                                            <SelectTrigger><SelectValue placeholder={t("selectPlaceholder")} /></SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="whatsapp">WhatsApp</SelectItem>
                                                <SelectItem value="facebook">Facebook</SelectItem>
                                                <SelectItem value="linkedin">LinkedIn</SelectItem>
                                                <SelectItem value="email">Email</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>
                                </>
                            )}

                            {step === 3 && (
                                <>
                                    <div className="space-y-2">
                                        <Label>{t("valuePropLabel")}</Label>
                                        <Textarea
                                            placeholder={t("valuePropPlaceholder")}
                                            className="min-h-[100px]"
                                            value={formData.value_prop}
                                            onChange={(e) => updateField("value_prop", e.target.value)}
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <Label>{t("communicationTone")}</Label>
                                        <Select value={formData.communication_tone} onValueChange={(v) => updateField("communication_tone", v)}>
                                            <SelectTrigger><SelectValue placeholder={t("selectPlaceholder")} /></SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="professionnel">Professionnel & Formel</SelectItem>
                                                <SelectItem value="amical">Amical & Décontracté</SelectItem>
                                                <SelectItem value="persuasif">Direct & Persuasif</SelectItem>
                                                <SelectItem value="empathique">Doux & Empathique</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>
                                </>
                            )}

                            {step === 4 && (
                                <>
                                    <div className="space-y-2">
                                        <Label>{t("whatAreYourObjectives") || "Quels sont vos objectifs ?"}</Label>
                                        <Textarea
                                            placeholder={t("objectivesPlaceholder") || "Ex: Trouver 10 nouveaux clients par mois..."}
                                            className="min-h-[100px]"
                                            value={formData.objectives}
                                            onChange={(e) => updateField("objectives", e.target.value)}
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <Label>{t("whatAreYourExpectations") || "Quelles sont vos attentes vis-à-vis de Prospecta ?"}</Label>
                                        <Textarea
                                            placeholder={t("expectationsPlaceholder") || "Ex: Simplicité, gain de temps..."}
                                            className="min-h-[100px]"
                                            value={formData.expectations}
                                            onChange={(e) => updateField("expectations", e.target.value)}
                                        />
                                    </div>
                                </>
                            )}
                        </CardContent>
                        <CardFooter className="flex justify-between gap-4 pt-6 border-t mt-4">
                            <Button
                                variant="outline"
                                onClick={handleBack}
                                disabled={step === 1 || loading}
                                className="border-accent/20 hover:bg-accent/5"
                            >
                                <ArrowLeft className="w-4 h-4 mr-2" /> Retour
                            </Button>
                            <div className="flex gap-2">
                                <AlertDialog>
                                    <AlertDialogTrigger asChild>
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            disabled={loading}
                                            className="text-muted-foreground mr-2 h-9 underline decoration-dotted underline-offset-4"
                                        >
                                            {t("skipAll")}
                                        </Button>
                                    </AlertDialogTrigger>
                                    <AlertDialogContent>
                                        <AlertDialogHeader>
                                            <AlertDialogTitle>{t("skipAll")}</AlertDialogTitle>
                                            <AlertDialogDescription>
                                                {t("skipAllStepWarningDesc")}
                                            </AlertDialogDescription>
                                        </AlertDialogHeader>
                                        <AlertDialogFooter>
                                            <AlertDialogCancel>{t("goBackAndFill")}</AlertDialogCancel>
                                            <AlertDialogAction
                                                onClick={() => {
                                                    console.log("Skip all confirmed");
                                                    handleSubmit();
                                                }}
                                                className="bg-accent text-accent-foreground hover:bg-accent/90"
                                            >
                                                {t("continueAnyway")}
                                            </AlertDialogAction>
                                        </AlertDialogFooter>
                                    </AlertDialogContent>
                                </AlertDialog>

                                <AlertDialog>
                                    <AlertDialogTrigger asChild>
                                        <Button variant="outline" disabled={loading} className="text-muted-foreground border-dashed">
                                            <FastForward className="w-4 h-4 mr-2" /> {t("skip")}
                                        </Button>
                                    </AlertDialogTrigger>
                                    <AlertDialogContent>
                                        <AlertDialogHeader>
                                            <AlertDialogTitle>{t("skipStepWarningTitle")}</AlertDialogTitle>
                                            <AlertDialogDescription>
                                                {t("skipStepWarningDesc")}
                                            </AlertDialogDescription>
                                        </AlertDialogHeader>
                                        <AlertDialogFooter>
                                            <AlertDialogCancel>{t("goBackAndFill")}</AlertDialogCancel>
                                            <AlertDialogAction
                                                onClick={() => {
                                                    console.log("Skip step confirmed, current step:", step);
                                                    if (step < 4) {
                                                        handleNext();
                                                    } else {
                                                        handleSubmit();
                                                    }
                                                }}
                                                className="bg-accent text-accent-foreground hover:bg-accent/90"
                                            >
                                                {t("continueAnyway")}
                                            </AlertDialogAction>
                                        </AlertDialogFooter>
                                    </AlertDialogContent>
                                </AlertDialog>

                                {step < 4 ? (
                                    <Button onClick={handleNext} className="bg-primary text-primary-foreground hover:bg-primary/90 min-w-[120px]">
                                        Suivant <ArrowRight className="w-4 h-4 ml-2" />
                                    </Button>
                                ) : (
                                    <Button onClick={handleSubmit} disabled={loading} className="bg-accent text-accent-foreground hover:bg-accent/90 min-w-[120px]">
                                        {loading ? "Chargement..." : "Terminer"} <CheckCircle2 className="w-4 h-4 ml-2" />
                                    </Button>
                                )}
                            </div>
                        </CardFooter>
                    </Card>
                </div>
            </div>
        </div>
    );
};

export default Onboarding;
