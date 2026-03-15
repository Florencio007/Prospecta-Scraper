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
    <DialogContent className="sm:max-w-[550px] p-0 overflow-hidden border-none shadow-2xl bg-background text-foreground">
      <div className="p-8 space-y-8">
        {/* Header with Logo */}
        <div className="flex flex-col items-center text-center space-y-4">
          <Logo size="xl" className="mb-2" />
          <div className="space-y-2">
            <DialogTitle className="text-2xl font-bold tracking-tight">
              Activez la puissance de Prospecta
            </DialogTitle>
            <DialogDescription className="text-base text-muted-foreground max-w-[400px] mx-auto leading-relaxed">
              Le moteur de recherche Prospecta nécessite l'agent local pour garantir une extraction ultra-rapide et sécurisée directement sur votre machine.
            </DialogDescription>
          </div>
        </div>

        {/* Steps */}
        <div className="grid grid-cols-3 gap-4 pb-4">
          {[
            { n: "1", title: "Télécharger", desc: "Choisissez votre système" },
            { n: "2", title: "Installer", desc: "Lancez l'exécutable" },
            { n: "3", title: "Scanner", desc: "Rechargez la page" },
          ].map(({ n, title, desc }) => (
            <div key={n} className="flex flex-col items-center text-center space-y-1">
              <div className="w-8 h-8 rounded-full bg-accent/20 flex items-center justify-center text-accent font-bold text-sm mb-1">
                {n}
              </div>
              <p className="font-semibold text-sm">{title}</p>
              <p className="text-[11px] text-muted-foreground leading-tight">{desc}</p>
            </div>
          ))}
        </div>

        {/* Download Buttons */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {downloads.map(({ os, filename, icon, description, label }) => (
            <a
              key={os}
              href={RELEASE_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="flex flex-col items-center p-5 rounded-2xl border bg-card hover:bg-accent/5 hover:border-accent/40 transition-all duration-300 group text-center space-y-3"
            >
              <div className="w-12 h-12 bg-muted rounded-xl flex items-center justify-center overflow-hidden group-hover:scale-110 transition-transform duration-300">
                <img src={icon} alt={os} className="w-8 h-8 object-contain mix-blend-multiply dark:mix-blend-normal" />
              </div>
              <div className="space-y-1">
                <p className="text-sm font-bold">{os}</p>
                <p className="text-[10px] text-muted-foreground line-clamp-1">{description}</p>
              </div>
              <div className="flex items-center gap-2 text-xs font-semibold text-accent pt-1">
                <Download size={14} />
                <span>{label}</span>
              </div>
            </a>
          ))}
        </div>

        {/* Footer actions */}
        <div className="flex flex-col items-center space-y-4 pt-4 border-t">
          <Button
            size="lg"
            variant="default"
            onClick={() => window.location.reload()}
            className="w-full sm:w-auto px-10 rounded-full font-bold shadow-lg shadow-accent/20 transition-all hover:scale-105 active:scale-95 gap-2"
          >
            <RefreshCcw size={18} />
            J'ai fini l'installation, recharger
          </Button>
          <p className="text-[11px] text-muted-foreground">
            Version 1.0.0 Stable · Connexion sécurisée locale · Support 24/7
          </p>
        </div>
      </div>
    </DialogContent>
  </Dialog>
);

export default AgentInstallModal;
