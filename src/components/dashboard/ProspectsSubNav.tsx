import { useNavigate, useLocation } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Users, Search, Plus } from "lucide-react";
import { useLanguage } from "@/hooks/useLanguage";

interface ProspectsSubNavProps {
    onNewManual?: () => void;
}

const ProspectsSubNav = ({ onNewManual }: ProspectsSubNavProps) => {
    const navigate = useNavigate();
    const location = useLocation();
    const { t } = useLanguage();

    const isFinder = location.pathname === "/finder";

    return (
        <div className="flex justify-end items-center gap-6 border-b border-border/10">
            <button
                onClick={() => navigate("/prospects")}
                className={`flex items-center gap-2 px-1 py-3 text-sm font-medium transition-all relative ${!isFinder
                    ? "text-emerald-500"
                    : "text-muted-foreground hover:text-foreground"
                    }`}
            >
                <Users size={18} />
                <span>{t("myProspects")}</span>
                {!isFinder && (
                    <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-emerald-500 rounded-full" />
                )}
            </button>

            <button
                onClick={() => navigate("/finder")}
                className={`flex items-center gap-2 px-1 py-3 text-sm font-medium transition-all relative ${isFinder
                    ? "text-emerald-500"
                    : "text-muted-foreground hover:text-foreground"
                    }`}
            >
                <Search size={18} />
                <span>{t("findProspects")}</span>
                {isFinder && (
                    <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-emerald-500 rounded-full" />
                )}
            </button>

            <Button
                onClick={onNewManual}
                className="bg-accent hover:bg-accent/90 text-white rounded-xl h-9 px-4 text-xs font-bold gap-2 ml-auto shadow-sm transition-all active:scale-95"
            >
                <Plus size={16} />
                <span>{t("newProspect")}</span>
            </Button>
        </div>
    );
};

export default ProspectsSubNav;
