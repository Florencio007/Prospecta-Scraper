import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { useLanguage } from "@/hooks/useLanguage";
import { PrivacyPolicyDialog, TermsOfUseDialog } from "./LegalDialogs";
import { Cookie, X, ShieldCheck } from "lucide-react";

const CookieConsent: React.FC = () => {
  const { t } = useLanguage();
  const [isVisible, setIsVisible] = useState(false);
  const [showPrivacy, setShowPrivacy] = useState(false);
  const [showTerms, setShowTerms] = useState(false);

  useEffect(() => {
    const consent = localStorage.getItem("prospecta-cookie-consent");
    if (!consent) {
      // Delay appearance for better UX
      const timer = setTimeout(() => setIsVisible(true), 1500);
      return () => clearTimeout(timer);
    }
  }, []);

  const handleAccept = () => {
    localStorage.setItem("prospecta-cookie-consent", "accepted");
    setIsVisible(false);
  };

  const handleDecline = () => {
    localStorage.setItem("prospecta-cookie-consent", "declined");
    setIsVisible(false);
  };

  if (!isVisible) return null;

  return (
    <>
      <div className="fixed bottom-6 left-6 right-6 md:left-auto md:right-6 md:w-[400px] z-50 animate-in fade-in slide-in-from-bottom-5 duration-500">
        <div className="bg-card/95 backdrop-blur-md border border-primary/20 shadow-2xl rounded-2xl p-5 md:p-6 overflow-hidden relative">
          {/* Decorative background element */}
          <div className="absolute -top-10 -right-10 w-32 h-32 bg-primary/5 rounded-full blur-3xl pointer-events-none" />
          
          <div className="flex items-start gap-4">
            <div className="bg-primary/10 p-2.5 rounded-xl text-primary shrink-0">
              <Cookie size={24} />
            </div>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="font-bold text-lg leading-none">{t("cookieConsentTitle")}</h3>
                <button 
                  onClick={() => setIsVisible(false)}
                  className="text-muted-foreground hover:text-foreground transition-colors md:hidden"
                >
                  <X size={18} />
                </button>
              </div>
              <p className="text-sm text-muted-foreground leading-relaxed">
                {t("cookieConsentDescription")}
              </p>
              
              <div className="flex flex-wrap gap-x-2 text-[11px] font-medium uppercase tracking-wider text-primary/70">
                <button 
                  onClick={() => setShowPrivacy(true)}
                  className="hover:text-primary transition-colors hover:underline"
                >
                  {t("privacyPolicy")}
                </button>
                <span className="text-muted-foreground/30">•</span>
                <button 
                  onClick={() => setShowTerms(true)}
                  className="hover:text-primary transition-colors hover:underline"
                >
                  {t("termsOfUse")}
                </button>
              </div>

              <div className="flex items-center gap-2 pt-2">
                <Button 
                  onClick={handleAccept} 
                  className="flex-1 bg-primary hover:bg-primary/90 text-primary-foreground font-bold rounded-xl"
                >
                  <ShieldCheck size={16} className="mr-2" />
                  {t("cookieConsentAccept")}
                </Button>
                <Button 
                  variant="outline" 
                  onClick={handleDecline}
                  className="flex-1 border-primary/20 hover:bg-primary/5 font-semibold rounded-xl text-xs"
                >
                  {t("cookieConsentDecline")}
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <PrivacyPolicyDialog isOpen={showPrivacy} onClose={() => setShowPrivacy(false)} />
      <TermsOfUseDialog isOpen={showTerms} onClose={() => setShowTerms(false)} />
    </>
  );
};

export default CookieConsent;
