import { useNavigate, useLocation } from "react-router-dom";
import { Mail, Layout } from "lucide-react";
import { useLanguage } from "@/hooks/useLanguage";

interface CampaignsSubNavProps {
    activeTab: "campaigns" | "templates";
    onTabChange: (tab: "campaigns" | "templates") => void;
}

const CampaignsSubNav = ({ activeTab, onTabChange }: CampaignsSubNavProps) => {
    const { t } = useLanguage();

    return (
        <div className="flex justify-start items-center gap-8 border-b border-border/10 mb-8">
            <button
                onClick={() => onTabChange("campaigns")}
                className={`flex items-center gap-2 px-1 py-3 text-sm font-bold transition-all relative ${activeTab === "campaigns"
                    ? "text-emerald-500"
                    : "text-muted-foreground hover:text-foreground"
                    }`}
            >
                <Mail size={18} />
                <span>{t("campaigns")}</span>
                {activeTab === "campaigns" && (
                    <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-emerald-500 rounded-full" />
                )}
            </button>

            <button
                onClick={() => onTabChange("templates")}
                className={`flex items-center gap-2 px-1 py-3 text-sm font-bold transition-all relative ${activeTab === "templates"
                    ? "text-emerald-500"
                    : "text-muted-foreground hover:text-foreground"
                    }`}
            >
                <Layout size={18} />
                <span>{t("templates")}</span>
                {activeTab === "templates" && (
                    <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-emerald-500 rounded-full" />
                )}
            </button>
        </div>
    );
};

export default CampaignsSubNav;
