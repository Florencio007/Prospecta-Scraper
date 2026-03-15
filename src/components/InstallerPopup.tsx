import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Download, CheckCircle2, Monitor, Apple, Terminal, ArrowRight, Info } from "lucide-react";
import { markInstallerDone } from "@/lib/detectors";

interface InstallerPopupProps {
  open: boolean;
  onClose: () => void;
  onInstallConfirmed: () => void;
}

const INSTALLER_BASE = "https://prospecta-scraper.vercel.app";

const platforms = [
  {
    id: "windows",
    label: "Windows",
    icon: Monitor,
    url: `${INSTALLER_BASE}/installer.exe`,
    color: "bg-blue-600 hover:bg-blue-500",
    badge: ".exe · 100 MB",
  },
  {
    id: "mac",
    label: "macOS",
    icon: Apple,
    url: `${INSTALLER_BASE}/installer.dmg`,
    color: "bg-zinc-700 hover:bg-zinc-600",
    badge: ".dmg · 100 MB",
  },
  {
    id: "linux",
    label: "Linux",
    icon: Terminal,
    url: `${INSTALLER_BASE}/installer.AppImage`,
    color: "bg-orange-700 hover:bg-orange-600",
    badge: ".AppImage · 100 MB",
  },
];

export const InstallerPopup = ({ open, onClose, onInstallConfirmed }: InstallerPopupProps) => {
  const handleConfirm = () => {
    markInstallerDone();
    onInstallConfirmed();
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="sm:max-w-md bg-[#0a0a0a] border border-[#00FF41]/30 text-white shadow-[0_0_40px_rgba(0,255,65,0.15)]">
        <DialogHeader>
          <div className="flex items-center gap-3 mb-1">
            <div className="p-2 rounded-lg bg-[#00FF41]/10 border border-[#00FF41]/20">
              <Download className="h-5 w-5 text-[#00FF41]" />
            </div>
            <DialogTitle className="text-[#00FF41] font-mono text-lg">
              🚀 Installer Prospecta Agent
            </DialogTitle>
          </div>
          <DialogDescription className="text-zinc-400 font-mono text-sm leading-relaxed">
            Le scraping avancé nécessite l'<span className="text-[#00FF41]">agent local Prospecta</span> (Node.js + Playwright).
            Installation rapide — moins de 2 minutes.
          </DialogDescription>
        </DialogHeader>

        {/* Étapes */}
        <div className="space-y-2 py-2">
          {["1. Téléchargez l'installeur ci-dessous", "2. Lancez-le et suivez les étapes", "3. Revenez ici et cliquez « J'ai installé »"].map((step, i) => (
            <div key={i} className="flex items-center gap-3 p-2 rounded-lg bg-white/5 border border-white/5">
              <span className="text-[#00FF41] font-mono font-bold text-sm w-4 shrink-0">{i + 1}</span>
              <span className="text-zinc-300 text-sm font-mono">{step.slice(3)}</span>
            </div>
          ))}
        </div>

        {/* Boutons de téléchargement */}
        <div className="grid grid-cols-1 gap-2">
          {platforms.map((p) => {
            const Icon = p.icon;
            return (
              <a
                key={p.id}
                href={p.url}
                download
                className={`flex items-center justify-between px-4 py-3 rounded-lg text-white font-mono text-sm transition-colors ${p.color} group`}
              >
                <div className="flex items-center gap-3">
                  <Icon className="h-4 w-4" />
                  <span>📥 {p.label}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="text-[10px] border-white/20 text-white/60 font-mono">
                    {p.badge}
                  </Badge>
                  <ArrowRight className="h-3 w-3 opacity-60 group-hover:translate-x-1 transition-transform" />
                </div>
              </a>
            );
          })}
        </div>

        {/* Note info */}
        <div className="flex items-start gap-2 p-3 bg-blue-950/30 rounded-lg border border-blue-900/30">
          <Info className="h-4 w-4 text-blue-400 shrink-0 mt-0.5" />
          <p className="text-blue-300 text-xs font-mono leading-relaxed">
            L'agent tourne en local sur le port <span className="text-white">3737</span>. Aucune donnée ne quitte votre machine.
          </p>
        </div>

        {/* Bouton confirmation */}
        <Button
          onClick={handleConfirm}
          className="w-full bg-[#00FF41] text-black hover:bg-[#00DD38] font-mono font-bold transition-all hover:shadow-[0_0_20px_rgba(0,255,65,0.4)]"
        >
          <CheckCircle2 className="mr-2 h-4 w-4" />
          ✅ J'ai installé — Lancer le scan !
        </Button>
      </DialogContent>
    </Dialog>
  );
};
