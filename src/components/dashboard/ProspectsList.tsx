import { useEffect, useState } from "react";
import { Sparkles, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import type { Tables } from "@/integrations/supabase/types";
import ProspectAnalysisModal from "./ProspectAnalysisModal";
import { useLanguage } from "@/hooks/useLanguage";
import { useToast } from "@/hooks/use-toast";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

type Prospect = Tables<"prospects">;

const ProspectsList = () => {
  const { user } = useAuth();
  const { t } = useLanguage();
  const { toast } = useToast();
  const [prospects, setProspects] = useState<Prospect[]>([]);
  const [selectedProspect, setSelectedProspect] = useState<Prospect | null>(null);
  const [loading, setLoading] = useState(true);
  const [deleteId, setDeleteId] = useState<string | null>(null);

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

  const handleDelete = async () => {
    if (!deleteId) return;
    try {
      const { error } = await supabase.from("prospects").delete().eq("id", deleteId);
      if (error) throw error;
      toast({ title: t("success"), description: t("prospectDeleted") });
      setProspects(prev => prev.filter(p => p.id !== deleteId));
      setDeleteId(null);
    } catch (error: any) {
      toast({ title: t("error"), description: error.message, variant: "destructive" });
    }
  };

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
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={() => setSelectedProspect(p)}
                    className="flex items-center gap-2 text-accent hover:bg-accent/10 px-3 py-2 rounded-lg transition-colors text-sm font-medium"
                    title={t("analyze")}
                  >
                    <Sparkles size={16} />
                    <span className="hidden sm:inline">{t("analyze")}</span>
                  </button>
                  <button
                    onClick={() => setDeleteId(p.id)}
                    className="p-2 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-lg transition-colors"
                    title={t("delete")}
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
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

      <AlertDialog open={!!deleteId} onOpenChange={o => !o && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("irreversibleDeletion")}</AlertDialogTitle>
            <AlertDialogDescription>{t("deleteConfirmation")}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("cancel")}</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive">
              {t("delete")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};

export default ProspectsList;
