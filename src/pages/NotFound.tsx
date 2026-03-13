import { useLocation, useNavigate } from "react-router-dom";
import { useEffect } from "react";
import { useLanguage } from "@/hooks/useLanguage";
import { Button } from "@/components/ui/button";

const NotFound = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { t } = useLanguage();

  useEffect(() => {
    console.error("404 Error: User attempted to access non-existent route:", location.pathname);
  }, [location.pathname]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted">
      <div className="text-center p-8 bg-card rounded-lg shadow-sm border animate-fade-in">
        <h1 className="mb-4 text-7xl font-black text-accent">{t("error404")}</h1>
        <p className="mb-6 text-xl text-muted-foreground font-medium">{t("pageNotFound")}</p>
        <Button
          onClick={() => navigate("/")}
          className="bg-accent text-accent-foreground hover:bg-accent/90 px-8 py-6 rounded-xl font-bold shadow-lg shadow-accent/20"
        >
          {t("returnHome")}
        </Button>
      </div>
    </div>
  );
};

export default NotFound;
