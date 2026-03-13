import { useEffect, useState } from "react";
import { Sparkles } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import type { Tables } from "@/integrations/supabase/types";
import ProspectAnalysisModal from "./ProspectAnalysisModal";

import { useLanguage } from "@/hooks/useLanguage";

type Prospect = Tables<"prospects">;

const ProspectsList = () => {
  const { user } = useAuth();
  const { t } = useLanguage();
  const [prospects, setProspects] = useState<Prospect[]>([]);
  const [selectedProspect, setSelectedProspect] = useState<Prospect | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;

    const load = async () => {
      setLoading(true);
      try {
        const { data } = await supabase
          .from("prospects")
          .select("*, prospect_data(*)")
          .eq("user_id", user.id)
          .order("created_at", { ascending: false })
          .limit(10);

        const flattenedData = data?.map(p => ({
          ...p,
          ...(p.prospect_data?.[0] || p.prospect_data || {}),
          id: p.id
        })) || [];

        setProspects(flattenedData);
      } catch (error) {
        console.error("Error loading prospects:", error);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [user]);

  return (
    <>
      <div className="rounded-lg border bg-card shadow-sm">
        <div className="p-6 border-b">
          <h2 className="text-xl font-bold text-foreground">{t("latestProspects")}</h2>
        </div>
        <div className="divide-y">
          {loading ? (
            <div className="p-8 text-center text-muted-foreground">{t("loading")}</div>
          ) : prospects.length > 0 ? (
            prospects.map((p) => (
              <div
                key={p.id}
                className="p-4 sm:p-6 flex items-center justify-between hover:bg-secondary/50 transition-colors"
              >
                <div className="flex items-center gap-4">
                  <div className="flex h-11 w-11 items-center justify-center rounded-full bg-accent text-accent-foreground text-sm font-medium shrink-0">
                    {p.initials}
                  </div>
                  <div>
                    <h3 className="font-medium text-foreground">{p.name}</h3>
                    <p className="text-sm text-foreground">
                      {p.position} @ {p.company} • {p.source}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setSelectedProspect(p)}
                  className="flex items-center gap-2 text-accent hover:bg-accent/10 px-3 py-2 rounded-lg transition-colors text-sm font-medium shrink-0"
                >
                  <Sparkles size={16} />
                  <span className="hidden sm:inline">{t("analyze")}</span>
                </button>
              </div>
            ))
          ) : (
            <div className="p-8 text-center text-muted-foreground">{t("noProspectsFound")}</div>
          )}
        </div>
      </div>

      <ProspectAnalysisModal
        prospect={selectedProspect}
        onClose={() => setSelectedProspect(null)}
      />
    </>
  );
};

export default ProspectsList;
