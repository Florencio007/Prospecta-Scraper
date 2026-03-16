import { useNavigate, useLocation } from "react-router-dom";
import { Mail, Layout, Inbox } from "lucide-react";
import { useLanguage } from "@/hooks/useLanguage";
import { useInbox } from "@/hooks/useInbox";

interface CampaignsSubNavProps {
    activeTab: "campaigns" | "templates" | "inbox";
    onTabChange: (tab: "campaigns" | "templates" | "inbox") => void;
}

const CampaignsSubNav = ({ activeTab, onTabChange }: CampaignsSubNavProps) => {
    const { t } = useLanguage();
    const { totalUnread } = useInbox();

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
                onClick={() => onTabChange("inbox")}
                className={`flex items-center gap-2 px-1 py-3 text-sm font-bold transition-all relative ${activeTab === "inbox"
                    ? "text-emerald-500"
                    : "text-muted-foreground hover:text-foreground"
                    }`}
            >
                <Inbox size={18} />
                <div className="flex items-center gap-1.5">
                    <span>{t("inbox")}</span>
                    {totalUnread > 0 && (
                        <span className="flex h-4 w-4 items-center justify-center rounded-full bg-accent text-[10px] text-white animate-pulse">
                            {totalUnread}
                        </span>
                    )}
                </div>
                {activeTab === "inbox" && (
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
