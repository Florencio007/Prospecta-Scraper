import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Download, RefreshCcw, AlertTriangle, Terminal } from "lucide-react";

const RELEASE_URL = "https://github.com/Florencio007/Prospecta-Scraper/releases/tag/v1.0.0";

const downloads = [
  { os: "Windows", filename: "ProspectaAgent-Setup.exe", icon: "🪟" },
  { os: "Mac",     filename: "ProspectaAgent.dmg",       icon: "🍎" },
  { os: "Linux",   filename: "ProspectaAgent.AppImage",  icon: "🐧" },
];

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}

export const AgentInstallModal = ({ open, onOpenChange }: Props) => (
  <Dialog open={open} onOpenChange={onOpenChange}>
    <DialogContent className="sm:max-w-[500px] bg-[#0d1117] border border-green-500/30 text-green-400 font-mono shadow-[0_0_40px_rgba(34,197,94,0.15)]">
      <DialogHeader className="space-y-2">
        <div className="flex items-center gap-3">
          <Terminal size={20} className="text-green-500" />
          <DialogTitle className="text-green-400 font-mono text-lg">
            [PROSPECTA] Agent Local Requis
          </DialogTitle>
        </div>
        <Badge variant="outline" className="w-fit border-yellow-500/50 text-yellow-400 gap-1.5">
          <AlertTriangle size={12} />
          Agent non détecté sur ce PC
        </Badge>
        <DialogDescription className="text-green-600 font-mono text-sm">
          Le moteur de scraping Playwright doit tourner localement pour lancer les scans.
        </DialogDescription>
      </DialogHeader>

      {/* Steps */}
      <div className="space-y-3 my-2">
        {[
          { n: "01", label: "Téléchargez et installez l'agent ci-dessous" },
          { n: "02", label: "Lancez l'agent (il démarre automatiquement)" },
          { n: "03", label: "Rechargez cette page → le scan sera disponible" },
        ].map(({ n, label }) => (
          <div key={n} className="flex items-center gap-3 text-sm">
            <span className="text-green-500 font-bold text-xs bg-green-500/10 border border-green-500/20 rounded px-1.5 py-0.5">
              {n}
            </span>
            <span className="text-green-300">{label}</span>
          </div>
        ))}
      </div>

      {/* Download buttons */}
      <div className="grid grid-cols-3 gap-2 my-2">
        {downloads.map(({ os, filename, icon }) => (
          <a
            key={os}
            href={`${RELEASE_URL}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex flex-col items-center gap-2 p-3 rounded-lg border border-green-500/20 bg-green-500/5 hover:bg-green-500/10 hover:border-green-500/40 transition-all group"
          >
            <span className="text-2xl">{icon}</span>
            <span className="text-xs font-bold text-green-400 group-hover:text-green-300">{os}</span>
            <div className="flex items-center gap-1 text-green-600 text-[10px]">
              <Download size={10} />
              {filename}
            </div>
          </a>
        ))}
      </div>

      <div className="flex justify-between items-center pt-2 border-t border-green-500/10">
        <span className="text-green-700 text-xs">
          v1.0.0 · ~100MB · Node.js inclus
        </span>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => window.location.reload()}
          className="text-green-500 hover:text-green-300 hover:bg-green-500/10 gap-2 font-mono text-xs"
        >
          <RefreshCcw size={12} />
          Recharger la page
        </Button>
      </div>
    </DialogContent>
  </Dialog>
);

export default AgentInstallModal;
