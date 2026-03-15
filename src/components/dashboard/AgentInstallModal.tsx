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
    <DialogContent className="sm:max-w-[550px] p-0 overflow-hidden border-none shadow-2xl bg-background text-foreground max-h-[90vh] overflow-y-auto">
      <div className="p-6 space-y-5">
        {/* Header with Logo */}
        <div className="flex flex-col items-center text-center space-y-3">
          <Logo size="lg" className="mb-1" />
          <div className="space-y-1">
            <DialogTitle className="text-xl font-bold tracking-tight">
              Activez la puissance de Prospecta
            </DialogTitle>
            <DialogDescription className="text-sm text-muted-foreground max-w-[400px] mx-auto leading-relaxed">
              Le moteur de recherche Prospecta nécessite l'agent local pour garantir une extraction ultra-rapide et sécurisée directement sur votre machine.
            </DialogDescription>
          </div>
        </div>

        {/* Steps */}
        <div className="grid grid-cols-3 gap-4 pb-2">
          {[
            { n: "1", title: "Télécharger", desc: "Choisissez votre système" },
            { n: "2", title: "Installer", desc: "Lancez l'exécutable" },
            { n: "3", title: "Scanner", desc: "Rechargez la page" },
          ].map(({ n, title, desc }) => (
            <div key={n} className="flex flex-col items-center text-center space-y-1">
              <div className="w-7 h-7 rounded-full bg-accent/20 flex items-center justify-center text-accent font-bold text-xs mb-0.5">
                {n}
              </div>
              <p className="font-semibold text-[13px]">{title}</p>
              <p className="text-[10px] text-muted-foreground leading-tight">{desc}</p>
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
            className="flex flex-col items-center p-4 rounded-xl border bg-card hover:bg-accent/5 hover:border-accent/40 transition-all duration-300 group text-center space-y-2"
          >
            <div className="w-10 h-10 bg-muted rounded-lg flex items-center justify-center overflow-hidden group-hover:scale-105 transition-transform duration-300">
              <img src="/windows-logo.png" alt="Windows" className="w-6 h-6 object-contain" />
            </div>
            <div className="space-y-0.5">
              <p className="text-sm font-bold">Windows</p>
              <p className="text-[10px] text-muted-foreground">Version 1.0.0 - Win 10/11</p>
            </div>
            <div className="flex items-center gap-1.5 text-[11px] font-semibold text-accent pt-0.5">
              <Download size={12} />
              <span>Télécharger .exe</span>
            </div>
          </a>

          {/* macOS */}
          <div className="flex flex-col p-4 rounded-xl border bg-card space-y-2 text-center">
            <div className="flex flex-col items-center space-y-2">
              <div className="w-10 h-10 bg-muted rounded-lg flex items-center justify-center overflow-hidden">
                <img src="/apple-logo.png" alt="macOS" className="w-6 h-6 object-contain mix-blend-multiply dark:mix-blend-normal" />
              </div>
              <div className="space-y-0.5">
                <p className="text-sm font-bold">macOS</p>
                <p className="text-[10px] text-muted-foreground">Apple Silicon & Intel</p>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2 pt-1">
              <a
                href="https://github.com/Florencio007/Prospecta-Scraper/releases/download/v1.0.0/Prospecta.Agent-1.0.0-arm64.dmg"
                className="text-[10px] bg-accent/10 hover:bg-accent/20 text-accent font-bold py-1.5 rounded-md transition-colors flex items-center justify-center gap-1"
              >
                <Download size={10} /> arm64
              </a>
              <a
                href="https://github.com/Florencio007/Prospecta-Scraper/releases/download/v1.0.0/Prospecta.Agent-1.0.0.dmg"
                className="text-[10px] bg-accent/10 hover:bg-accent/20 text-accent font-bold py-1.5 rounded-md transition-colors flex items-center justify-center gap-1"
              >
                <Download size={10} /> Intel
              </a>
            </div>
          </div>
        </div>

        {/* Footer actions */}
        <div className="flex flex-col items-center space-y-3 pt-3 border-t">
          <Button
            size="default"
            variant="default"
            onClick={() => window.location.reload()}
            className="w-full sm:w-auto px-8 rounded-full font-bold shadow-lg shadow-accent/20 transition-all hover:scale-105 active:scale-95 gap-2"
          >
            <RefreshCcw size={16} />
            J'ai fini, recharger la page
          </Button>
          <p className="text-[10px] text-muted-foreground">
            Version 1.0.0 Stable · Connexion sécurisée locale
          </p>
        </div>
      </div>
    </DialogContent>
  </Dialog>
);

export default AgentInstallModal;
