import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Download, RefreshCcw, Monitor, Apple } from "lucide-react";
import { Logo } from "@/components/Logo";

const RELEASE_URL = "https://github.com/Florencio007/Prospecta-Scraper/releases/tag/v1.0.0";

const downloads = [
  { 
    os: "Windows", 
    filename: "Prospecta.Agent.Setup.1.0.0.exe", 
    icon: "/windows-logo.jpg",
    description: "Version 1.0.0 - Windows 10/11",
    label: "Télécharger pour Windows"
  },
  { 
    os: "macOS", 
    filename: "Prospecta.Agent-1.0.0.dmg", 
    icon: "/apple-logo.png",
    description: "Intel & Apple Silicon (M1/M2/M3)",
    label: "Télécharger pour Mac"
  },
];

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}

export const AgentInstallModal = ({ open, onOpenChange }: Props) => (
  <Dialog open={open} onOpenChange={onOpenChange}>
    <DialogContent className="sm:max-w-[500px] p-0 overflow-hidden border-none shadow-2xl bg-[#0b0f1a] text-white max-h-[90vh] overflow-y-auto rounded-3xl">
      <div className="p-5 space-y-4">
        {/* Header with Logo */}
        <div className="flex flex-col items-center text-center space-y-2">
          <Logo size="md" className="mb-0.5" />
          <div className="space-y-1">
            <DialogTitle className="text-xl font-bold tracking-tight text-white leading-tight">
              Activez la puissance de Prospecta
            </DialogTitle>
            <DialogDescription className="text-[13px] text-zinc-400 max-w-[360px] mx-auto leading-relaxed">
              Le moteur de recherche Prospecta nécessite l'agent local pour garantir une extraction ultra-rapide et sécurisée directement sur votre machine.
            </DialogDescription>
          </div>
        </div>

        {/* Steps */}
        <div className="grid grid-cols-3 gap-3 pb-1 border-b border-white/[0.03]">
          {[
            { n: "1", title: "Télécharger", desc: "Votre système" },
            { n: "2", title: "Installer", desc: "Lancez l'agent" },
            { n: "3", title: "Scanner", desc: "Actualisez" },
          ].map(({ n, title, desc }) => (
            <div key={n} className="flex flex-col items-center text-center space-y-0.5">
              <div className="w-6 h-6 rounded-full bg-accent/20 flex items-center justify-center text-accent font-bold text-[10px] mb-0.5">
                {n}
              </div>
              <p className="font-semibold text-[12px] text-zinc-200">{title}</p>
              <p className="text-[9px] text-zinc-500 leading-tight">{desc}</p>
            </div>
          ))}
        </div>

        {/* Download Buttons */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {/* Windows */}
          <a
            href="https://github.com/Florencio007/Prospecta-Scraper/releases/download/v1.0.0/Prospecta.Agent.Setup.1.0.0.exe"
            target="_blank"
            rel="noopener noreferrer"
            className="flex flex-col items-center p-3.5 rounded-2xl border border-white/5 bg-white/[0.03] hover:bg-accent/10 hover:border-accent/40 transition-all duration-300 group text-center space-y-2"
          >
            <div className="w-9 h-9 bg-zinc-800/50 rounded-lg flex items-center justify-center overflow-hidden group-hover:scale-105 transition-transform duration-300 border border-white/5">
              <img src="/windows-logo.png" alt="Windows" className="w-5 h-5 object-contain" />
            </div>
            <div className="space-y-0.5">
              <p className="text-[13px] font-bold text-zinc-200">Windows</p>
              <p className="text-[9px] text-zinc-500 uppercase tracking-wider">Win 10/11 x64</p>
            </div>
            <div className="flex items-center gap-1.5 text-[10px] font-bold text-accent pt-0.5">
              <Download size={11} />
              <span>DÉMARRER</span>
            </div>
          </a>

          {/* macOS */}
          <div className="flex flex-col p-3.5 rounded-2xl border border-white/5 bg-white/[0.03] space-y-2 text-center shadow-lg">
            <div className="flex flex-col items-center space-y-2">
              <div className="w-9 h-9 bg-zinc-800/50 rounded-lg flex items-center justify-center overflow-hidden border border-white/5">
                <img src="/apple-logo.png" alt="macOS" className="w-5 h-5 object-contain" />
              </div>
              <div className="space-y-0.5">
                <p className="text-[13px] font-bold text-zinc-200">macOS</p>
                <p className="text-[9px] text-zinc-500 uppercase tracking-wider">Silicon & Intel</p>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-1.5 pt-1">
              <a
                href="https://github.com/Florencio007/Prospecta-Scraper/releases/download/v1.0.0/Prospecta.Agent-1.0.0-arm64.dmg"
                className="text-[9px] bg-accent text-white font-black py-1.5 rounded-lg transition-all hover:bg-accent/90 flex items-center justify-center gap-1 shadow-lg shadow-accent/20"
              >
                M1/M2/M3
              </a>
              <a
                href="https://github.com/Florencio007/Prospecta-Scraper/releases/download/v1.0.0/Prospecta.Agent-1.0.0.dmg"
                className="text-[9px] bg-zinc-800 text-zinc-300 font-black py-1.5 rounded-lg transition-all hover:bg-zinc-700 flex items-center justify-center gap-1 border border-white/5"
              >
                INTEL
              </a>
            </div>
          </div>
        </div>

        {/* Footer actions */}
        <div className="flex flex-col items-center space-y-3 pt-4">
          <Button
            onClick={() => window.location.reload()}
            className="w-full h-12 bg-accent text-white hover:bg-accent/90 rounded-2xl font-black text-sm shadow-[0_8px_20px_-6px_rgba(34,197,94,0.5)] transition-all hover:translate-y-[-2px] active:translate-y-[1px] gap-2 border-none"
          >
            <RefreshCcw size={16} />
            J'AI FINI L'INSTALLATION
          </Button>
          <p className="text-[9px] text-zinc-600 font-mono tracking-tighter uppercase">
            v1.0.0 Stable · Connexion locale sécurisée · Prospecta AI
          </p>
        </div>
      </div>
    </DialogContent>
  </Dialog>
);

export default AgentInstallModal;
