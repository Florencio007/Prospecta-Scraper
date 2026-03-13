import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CreditCard, Smartphone, Wallet, Lock, Check, Loader2, AlertCircle } from "lucide-react";
import { useLanguage } from "@/hooks/useLanguage";
import { useToast } from "@/hooks/use-toast";
import { CinetPayService } from "@/lib/cinetpay"; // Add this

interface PaymentModalProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    planName: string;
    price: string;
    onSuccess: () => void;
}

const PaymentModal = ({ open, onOpenChange, planName, price, onSuccess }: PaymentModalProps) => {
    const { t } = useLanguage();
    const { toast } = useToast();
    const [method, setMethod] = useState<"card" | "paypal" | "mvola" | "orange">("card");
    const [processing, setProcessing] = useState(false);
    const [step, setStep] = useState<"method" | "details" | "validation">("method");



    useEffect(() => {
        CinetPayService.initialize();
    }, []);

    const handlePayment = async () => {
        setProcessing(true);

        const cinetPayApiKey = import.meta.env.VITE_CINETPAY_API_KEY;
        const cinetPaySiteId = import.meta.env.VITE_CINETPAY_SITE_ID;

        // CHECK IF CINETPAY KEYS ARE PRESENT
        if (cinetPayApiKey && cinetPaySiteId && cinetPayApiKey !== "your_cinetpay_api_key") {
            try {
                await CinetPayService.checkout({
                    transaction_id: `txn_${Date.now()}`,
                    amount: parseInt(price.replace(/\D/g, '')), // Extract number from price string
                    currency: 'MGA',
                    channels: 'ALL',
                    description: `Abonnement ${planName}`,
                });
                // Success is handled by CinetPay Service resolution or webhook usually, 
                // but our checkout returns promise resolve on ACCEPTED
                setProcessing(false);
                onSuccess();
                onOpenChange(false);
                toast({
                    title: t("paymentSuccess"),
                    description: t("paymentSuccessDesc"),
                });
            } catch (error: any) {
                setProcessing(false);
                console.error("CinetPay Error:", error);
                toast({
                    variant: "destructive",
                    title: t("paymentFailed"),
                    description: error?.message || t("paymentFailedDesc"),
                });
            }
        } else {
            // FALLBACK TO SIMULATION
            setTimeout(() => {
                setProcessing(false);
                onSuccess();
                onOpenChange(false);
                toast({
                    title: t("paymentSuccess"),
                    description: t("paymentSuccessDesc"),
                });
            }, 2000);
        }
    };

    const methods = [
        {
            id: "card",
            name: t("creditCard"),
            icon: <CreditCard className="h-6 w-6" />,
            color: "bg-blue-500",
        },
        {
            id: "paypal",
            name: t("paypal"),
            icon: <Wallet className="h-6 w-6" />,
            color: "bg-[#003087]",
        },
        {
            id: "orange",
            name: t("orangeMoney"),
            icon: <Smartphone className="h-6 w-6" />,
            color: "bg-[#FF7900]",
        },
        {
            id: "mvola",
            name: t("mvola"),
            icon: <Smartphone className="h-6 w-6" />,
            color: "bg-[#009e49]",
        },
    ];

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[500px]">
                <DialogHeader>
                    <DialogTitle>{t("securePayment")}</DialogTitle>
                    <DialogDescription>
                        {planName} - <span className="font-bold text-foreground">{price}</span>
                    </DialogDescription>
                </DialogHeader>

                <div className="py-4">
                    {step === "method" && (
                        <div className="grid grid-cols-2 gap-4">
                            {methods.map((m) => (
                                <div
                                    key={m.id}
                                    onClick={() => {
                                        setMethod(m.id as any);
                                        setStep("details");
                                    }}
                                    className={`cursor-pointer rounded-lg border-2 p-4 flex flex-col items-center justify-center gap-2 transition-all hover:bg-accent/5 ${method === m.id ? "border-accent bg-accent/5" : "border-muted"
                                        }`}
                                >
                                    <div className={`p-2 rounded-full text-white ${m.color}`}>
                                        {m.icon}
                                    </div>
                                    <span className="font-medium text-sm">{m.name}</span>
                                </div>
                            ))}
                        </div>
                    )}

                    {step === "details" && (
                        <div className="space-y-4 animate-fade-in">
                            <div className="flex items-center gap-2 mb-4 text-sm text-muted-foreground">
                                <Button variant="ghost" size="sm" onClick={() => setStep("method")} className="h-auto p-0 hover:bg-transparent">
                                    &lt; {t("change")}
                                </Button>
                                <span>{t("payWith").replace("{method}", methods.find(m => m.id === method)?.name || "")}</span>
                            </div>

                            {(method === "card") && (
                                <div className="space-y-3">
                                    <div className="space-y-1">
                                        <Label>{t("cardNumber")}</Label>
                                        <Input placeholder="0000 0000 0000 0000" />
                                    </div>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="space-y-1">
                                            <Label>{t("expiryDate")}</Label>
                                            <Input placeholder="MM/YY" />
                                        </div>
                                        <div className="space-y-1">
                                            <Label>{t("cvc")}</Label>
                                            <Input placeholder="123" />
                                        </div>
                                    </div>
                                </div>
                            )}

                            {(method === "mvola" || method === "orange") && (
                                <div className="space-y-4">
                                    <div className="bg-muted p-4 rounded-lg flex items-start gap-3">
                                        <AlertCircle className="h-5 w-5 text-accent mt-0.5" />
                                        <div className="space-y-1">
                                            <p className="font-medium text-sm">{t("simulationMode")}</p>
                                            <p className="text-xs text-muted-foreground">
                                                {t("ussdInstruction").replace("{code}", method === "mvola" ? "#111*1*2#" : "#144*3*1#")}
                                            </p>
                                            <p className="text-sm font-bold mt-2 text-foreground">
                                                {t("sendToNumber").replace("{number}", method === "mvola" ? "+261 34 96 555 32" : "+261 32 60 778 24")}
                                            </p>
                                        </div>
                                    </div>
                                    <div className="space-y-1">
                                        <Label>{t("phoneNum")}</Label>
                                        <Input placeholder="+261 3..." />
                                    </div>
                                </div>
                            )}

                            {method === "paypal" && (
                                <div className="text-center py-8">
                                    <Loader2 className="h-8 w-8 animate-spin mx-auto text-accent mb-2" />
                                    <p className="text-sm text-muted-foreground">{t("processing")}</p>
                                </div>
                            )}

                            <Button
                                onClick={handlePayment}
                                disabled={processing}
                                className="w-full bg-accent text-accent-foreground hover:bg-accent/90 mt-4"
                            >
                                {processing ? (
                                    <>
                                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                        {t("processing")}
                                    </>
                                ) : (
                                    <>
                                        <Lock className="mr-2 h-4 w-4" />
                                        {t("pay")} {price}
                                    </>
                                )}
                            </Button>
                        </div>
                    )}
                </div>
            </DialogContent>
        </Dialog>
    );
};

export default PaymentModal;
