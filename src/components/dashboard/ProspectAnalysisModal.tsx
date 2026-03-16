import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Prospect } from "@/types/prospect";
import { useLanguage } from "@/hooks/useLanguage";

interface Props {
  prospect: Prospect | null;
  onClose: () => void;
}

const ProspectAnalysisModal = ({ prospect, onClose }: Props) => {
  const { t, language } = useLanguage();

  if (!prospect) return null;

  const scoreColor =
    prospect.score >= 71 ? "bg-accent" : prospect.score >= 41 ? "bg-orange-400" : "bg-destructive";

  const interestTags: Record<string, { label: string; className: string }[]> = {
    fr: [
      { label: "Tech", className: "bg-blue-100 text-blue-800" },
      { label: "SaaS", className: "bg-green-100 text-green-800" },
      { label: "Marketing", className: "bg-purple-100 text-purple-800" },
    ],
    en: [
      { label: "Tech", className: "bg-blue-100 text-blue-800" },
      { label: "SaaS", className: "bg-green-100 text-green-800" },
      { label: "Marketing", className: "bg-purple-100 text-purple-800" },
    ]
  };

  const tags = interestTags[language as keyof typeof interestTags] || interestTags.fr;
  const approach = t("defaultApproach");

  return (
    <Dialog open={!!prospect} onOpenChange={() => onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-primary">{t("aiAnalysisOf").replace("{name}", prospect.name)}</DialogTitle>
        </DialogHeader>

        <div className="space-y-5 pt-2">
          <div>
            <h4 className="text-sm font-medium text-muted-foreground mb-2">{t("qualificationScore")}</h4>
            <div className="w-full bg-secondary rounded-full h-3">
              <div
                className={`h-3 rounded-full transition-all ${scoreColor}`}
                style={{ width: `${prospect.score}%` }}
              />
            </div>
            <p className="text-sm mt-1 text-primary font-medium">
              {prospect.score}/100 —{" "}
              {prospect.score >= 71
                ? t("highQualified")
                : prospect.score >= 41
                  ? t("promising")
                  : t("toNurture")}
            </p>
          </div>

          <div>
            <h4 className="text-sm font-medium text-muted-foreground mb-2">{t("detectedInterests")}</h4>
            <div className="flex flex-wrap gap-2">
              {tags.map((t) => (
                <span key={t.label} className={`px-3 py-1 rounded-full text-xs font-medium ${t.className}`}>
                  {t.label}
                </span>
              ))}
            </div>
          </div>

          <div>
            <h4 className="text-sm font-medium text-muted-foreground mb-2">{t("recommendedApproach")}</h4>
            <p className="text-sm text-primary leading-relaxed">{approach}</p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default ProspectAnalysisModal;
