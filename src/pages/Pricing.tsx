import { useState } from "react";
import Header from "@/components/dashboard/Header";
import { Button } from "@/components/ui/button";
import { Check, Star, Zap } from "lucide-react";
import { useLanguage } from "@/hooks/useLanguage";
import { Badge } from "@/components/ui/badge";
import PaymentModal from "@/components/payment/PaymentModal";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

const Pricing = () => {
    const { t } = useLanguage();
    const { profile, user, refreshProfile } = useAuth();
    const { toast } = useToast();
    const [billingInterval, setBillingInterval] = useState<"monthly" | "yearly">("monthly");
    const [paymentModalOpen, setPaymentModalOpen] = useState(false);
    const [selectedPlan, setSelectedPlan] = useState<{ name: string; price: string } | null>(null);

    const handleSubscribe = (planName: string, price: string) => {
        setSelectedPlan({ name: planName, price });
        setPaymentModalOpen(true);
    };

    const plans = [
        {
            name: t("starter"),
            price: t("startFree"),
            description: t("starterDesc"),
            features: [
                t("feature50Prospects"),
                t("featureGoogleSearch"),
                t("featureCSVExport"),
                t("featureSupportEmail"),
            ],
            current: profile?.plan_type === "starter",
        },
        {
            name: t("pro"),
            price: billingInterval === "monthly" ? "49 000 Ar" : "490 000 Ar",
            interval: billingInterval === "monthly" ? t("perMonth") : "/an",
            description: t("proDesc"),
            features: [
                t("featureUnlimitedProspects"),
                t("featureAllChannels"),
                t("featureN8nIntegration"),
                t("featureExcelExport"),
                t("featureAdvancedReports"),
                t("featurePrioritySupport"),
                t("aiAssistant"),
            ],
            popular: true,
            current: profile?.plan_type === "pro",
        },
        {
            name: t("enterprise"),
            price: t("enterprisePrice"),
            description: t("enterpriseDesc"),
            features: [
                t("featureAllProPlans"),
                t("featureUnlimitedUsers"),
                t("featureCustomAPI"),
                t("featureDedicatedOnboarding"),
            ],
            current: false,
        },
    ];

    return (
        <div className="min-h-screen bg-secondary">
            <Header />

            <main className="mx-auto max-w-7xl px-4 sm:px-6 pt-20 pb-12">
                <div className="text-center mb-12">
                    <h1 className="text-3xl sm:text-4xl font-bold text-foreground mb-4">{t("pricingTitle")}</h1>
                    <p className="text-xl text-muted-foreground">{t("planSelection")}</p>

                    <div className="flex items-center justify-center mt-6 gap-4">
                        <span className={`text-sm ${billingInterval === "monthly" ? "font-bold" : "text-muted-foreground"}`}>{t("monthly")}</span>
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setBillingInterval(billingInterval === "monthly" ? "yearly" : "monthly")}
                            className="rounded-full px-0 w-12 h-6 relative bg-muted"
                        >
                            <span
                                className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-accent transition-all ${billingInterval === "yearly" ? "translate-x-6" : ""
                                    }`}
                            />
                        </Button>
                        <span className={`text-sm ${billingInterval === "yearly" ? "font-bold" : "text-muted-foreground"}`}>
                            {t("yearly")} <span className="text-accent text-xs">-15%</span>
                        </span>
                    </div>
                </div>

                <div className="grid md:grid-cols-3 gap-8 max-w-6xl mx-auto">
                    {plans.map((plan) => (
                        <div
                            key={plan.name}
                            className={`relative bg-card rounded-2xl p-8 shadow-sm border ${plan.popular ? "border-accent shadow-lg shadow-accent/10" : "border-border"
                                }`}
                        >
                            {plan.popular && (
                                <div className="absolute -top-4 left-1/2 -translate-x-1/2">
                                    <Badge className="bg-accent text-accent-foreground px-4 py-1">
                                        <Star className="w-3 h-3 mr-1 fill-current" />
                                        {t("popular")}
                                    </Badge>
                                </div>
                            )}

                            <div className="mb-6">
                                <h3 className="text-lg font-bold">{plan.name}</h3>
                                <p className="text-sm text-muted-foreground">{plan.description}</p>
                            </div>

                            <div className="mb-6">
                                <span className="text-3xl font-bold">{plan.price}</span>
                                {plan.interval && <span className="text-muted-foreground text-sm">{plan.interval}</span>}
                            </div>

                            <Button
                                onClick={() => plan.name !== t("enterprise") && !plan.current ? handleSubscribe(plan.name, plan.price) : null}
                                variant={plan.popular ? "default" : "outline"}
                                className={`w-full mb-6 ${plan.popular ? "bg-accent text-accent-foreground hover:bg-accent/90" : ""
                                    }`}
                                disabled={plan.current || plan.name === t("enterprise")} // Disable Enterprise for now or redirect to contact
                            >
                                {plan.current ? (
                                    <>
                                        <Check className="w-4 h-4 mr-2" />
                                        {t("currentPlan")}
                                    </>
                                ) : plan.name === t("enterprise") ? (
                                    "Contact Us"
                                ) : (
                                    <>
                                        {plan.popular && <Zap className="w-4 h-4 mr-2" />}
                                        {t("subscribe")}
                                    </>
                                )}
                            </Button>

                            <div className="space-y-4">
                                <p className="text-sm font-medium">{t("planFeatures")}:</p>
                                <ul className="space-y-3">
                                    {plan.features.map((feature) => (
                                        <li key={feature} className="flex items-start text-sm text-muted-foreground">
                                            <Check className="w-4 h-4 mr-2 text-accent flex-shrink-0 mt-0.5" />
                                            {feature}
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        </div>
                    ))}
                </div>
            </main>

            {selectedPlan && (
                <PaymentModal
                    open={paymentModalOpen}
                    onOpenChange={setPaymentModalOpen}
                    planName={selectedPlan.name}
                    price={selectedPlan.price}
                    onSuccess={async () => {
                        if (user && selectedPlan) {
                            const planType = selectedPlan.name === t("pro") ? "pro" : "starter";

                            // 1. Update Profile in DB
                            // Note: If columns don't exist, this might fail silently or throw.
                            // We assume schema has plan_type.
                            const { error: profileError } = await supabase
                                .from("profiles")
                                .update({
                                    // @ts-ignore - Ignoring potentially missing column in types for now
                                    plan_type: planType,
                                    search_limit: planType === "pro" ? 1000 : 50,
                                })
                                .eq("user_id", user.id);

                            if (profileError) {
                                console.error("Error updating profile:", profileError);
                                toast({
                                    variant: "destructive",
                                    title: t("paymentFailed"),
                                    description: "Une erreur est survenue lors de la mise à jour du profil.",
                                });
                                return;
                            }

                            // 2. Refresh Context
                            await refreshProfile();
                        }
                    }}
                />
            )}
        </div>
    );
};

export default Pricing;
