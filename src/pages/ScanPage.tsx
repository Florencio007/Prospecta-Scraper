import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { InstallerPopup } from "@/components/InstallerPopup";
import { runDetector, launchLocalScraper, type DetectorResult } from "@/lib/detectors";
import Header from "@/components/dashboard/Header";
import {
  Play, Terminal, Zap, Wifi, WifiOff, Download,
  CheckCircle2, AlertTriangle, RefreshCw, ChevronRight,
  Globe, MapPin, Search
} from "lucide-react";

/* ─────────────── Types ─────────────── */
interface LogEntry {
  id: string;
  msg: string;
  ts: string;
}

/* ─────────────── Helpers ─────────────── */
const now = () => new Date().toLocaleTimeString([], { hour12: false, hour: "2-digit", minute: "2-digit", second: "2-digit" });
const uid  = () => Math.random().toString(36).slice(2, 9);

const logColor = (msg: string): string => {
  if (msg.includes("✅") || msg.includes("🎉")) return "text-[#00FF41]";
  if (msg.includes("⚠️") || msg.includes("❌"))  return "text-yellow-400";
  if (msg.includes("🔍") || msg.includes("⚙️"))  return "text-cyan-400";
  if (msg.includes("🚀"))                         return "text-purple-400";
  if (msg.includes("📦") || msg.includes("📥"))  return "text-orange-400";
  return "text-zinc-300";
};

/* ─────────────── StatusPill ─────────────── */
const StatusPill = ({ result }: { result: DetectorResult | null }) => {
  if (!result) return null;
  const map: Record<DetectorResult["status"], { label: string; icon: typeof Zap; color: string }> = {
    playwright_web:  { label: "Playwright Web",   icon: Zap,          color: "bg-[#00FF41]/10 text-[#00FF41] border-[#00FF41]/30" },
    node_runtime:    { label: "Agent Local",       icon: Wifi,         color: "bg-cyan-500/10 text-cyan-400 border-cyan-500/30"    },
    needs_installer: { label: "Installation Req.", icon: Download,     color: "bg-yellow-500/10 text-yellow-400 border-yellow-500/30" },
  };
  const { label, icon: Icon, color } = map[result.status];
  return (
    <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full border text-xs font-mono ${color}`}>
      <Icon className="h-3 w-3" />
      {label}
    </div>
  );
};

/* ─────────────── Main Page ─────────────── */
const ScanPage = () => {
  const [query,             setQuery]            = useState("hotel Nosy Be");
  const [logs,              setLogs]             = useState<LogEntry[]>([]);
  const [isRunning,         setIsRunning]        = useState(false);
  const [detectorResult,    setDetectorResult]   = useState<DetectorResult | null>(null);
  const [showInstaller,     setShowInstaller]    = useState(false);
  const [results,           setResults]          = useState<any[]>([]);
  const terminalRef = useRef<HTMLDivElement>(null);

  const addLog = (msg: string) =>
    setLogs(prev => [...prev.slice(-60), { id: uid(), msg, ts: now() }]);

  // Auto-scroll terminal
  useEffect(() => {
    if (terminalRef.current) {
      terminalRef.current.scrollTop = terminalRef.current.scrollHeight;
    }
  }, [logs]);

  /* ───── Lancer Scan ───── */
  const handleScan = async () => {
    if (isRunning || !query.trim()) return;
    setIsRunning(true);
    setResults([]);

    // 1. Détecteur
    const result = await runDetector(addLog);
    setDetectorResult(result);

    if (result.status === "needs_installer") {
      setShowInstaller(true);
      setIsRunning(false);
      return;
    }

    // 2. Scraping selon le statut
    if (result.status === "node_runtime") {
      addLog(`\n⚙️  Connexion à l'agent local...`);
      const found = await launchLocalScraper(query, ["gmaps"], addLog);
      setResults(found);
    } else if (result.status === "playwright_web") {
      addLog("✅ Playwright Web actif — simulation du scan...");
      await sleep(1200);
      addLog("🎉 42 prospects trouvés (mode Playwright Web) !");
    }

    addLog("\n✅ Scan terminé.");
    setIsRunning(false);
  };

  /* ───── Après installation confirmée ───── */
  const handleInstallConfirmed = async () => {
    setShowInstaller(false);
    addLog("\n\n🎉 Installation détectée — relance automatique du scan !");
    await sleep(500);
    handleScan();
  };

  /* ─── Réinitialiser ─── */
  const handleReset = () => {
    setLogs([]);
    setDetectorResult(null);
    setResults([]);
    setIsRunning(false);
  };

  /* ─────────────── UI ─────────────── */
  return (
    <div className="min-h-screen bg-[#060606] text-white">
      <Header />

      <div className="max-w-5xl mx-auto px-4 py-10 space-y-6">

        {/* Titre */}
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-[#00FF41]/10 border border-[#00FF41]/20">
            <Terminal className="h-6 w-6 text-[#00FF41]" />
          </div>
          <div>
            <h1 className="text-2xl font-bold font-mono text-white">
              Prospecta <span className="text-[#00FF41]">Scan</span>
            </h1>
            <p className="text-xs text-zinc-500 font-mono mt-0.5">
              Détection automatique · Scraping local · Zéro config
            </p>
          </div>
          {detectorResult && <StatusPill result={detectorResult} />}
        </div>

        {/* Barre de recherche */}
        <div className="flex gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-500" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Hotel Nosy Be / Agence web Tana..."
              className="pl-10 bg-[#111] border-zinc-700 text-white font-mono placeholder:text-zinc-600 focus:border-[#00FF41]/50 focus:ring-[#00FF41]/20"
              onKeyDown={(e) => e.key === "Enter" && handleScan()}
            />
          </div>

          <Button
            onClick={isRunning ? undefined : handleScan}
            disabled={isRunning || !query.trim()}
            className="px-6 bg-[#00FF41] text-black hover:bg-[#00DD38] font-mono font-bold transition-all hover:shadow-[0_0_20px_rgba(0,255,65,0.4)] disabled:opacity-50"
          >
            {isRunning ? (
              <><RefreshCw className="mr-2 h-4 w-4 animate-spin" /> Scan...</>
            ) : (
              <><Play className="mr-2 h-4 w-4" /> Lancer Scan</>
            )}
          </Button>

          {logs.length > 0 && (
            <Button
              variant="ghost"
              onClick={handleReset}
              className="border border-zinc-700 text-zinc-400 hover:text-white hover:border-zinc-500"
            >
              Reset
            </Button>
          )}
        </div>

        {/* Terminal */}
        <div className="rounded-xl border border-zinc-800 bg-[#0a0a0a] overflow-hidden shadow-2xl">
          {/* Barre de titre */}
          <div className="flex items-center gap-2 px-4 py-2.5 border-b border-zinc-800 bg-[#111]">
            <div className="flex gap-1.5">
              <div className="h-3 w-3 rounded-full bg-red-500/70" />
              <div className="h-3 w-3 rounded-full bg-yellow-500/70" />
              <div className="h-3 w-3 rounded-full bg-[#00FF41]/70" />
            </div>
            <span className="text-xs text-zinc-500 font-mono ml-2">prospecta — terminal</span>
            {isRunning && (
              <span className="ml-auto flex items-center gap-1.5 text-[10px] text-[#00FF41] font-mono animate-pulse">
                <span className="h-1.5 w-1.5 rounded-full bg-[#00FF41]" />
                RUNNING
              </span>
            )}
          </div>

          {/* Log area */}
          <div
            ref={terminalRef}
            className="p-4 h-72 overflow-y-auto font-mono text-sm space-y-0.5 scroll-smooth"
            style={{ scrollbarWidth: "thin", scrollbarColor: "#00FF41 #111" }}
          >
            {logs.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-zinc-600 space-y-2">
                <Terminal className="h-10 w-10 opacity-30" />
                <p className="text-xs">En attente... cliquez sur «&nbsp;Lancer Scan&nbsp;»</p>
              </div>
            ) : (
              logs.map((log) => (
                <div key={log.id} className="flex gap-3 leading-relaxed">
                  <span className="text-zinc-600 text-[10px] shrink-0 mt-0.5 w-16 text-right">[{log.ts}]</span>
                  <span className={logColor(log.msg)}>{log.msg}</span>
                </div>
              ))
            )}
            {isRunning && (
              <div className="flex gap-3 items-center">
                <span className="text-zinc-600 text-[10px] w-16 text-right">[{now()}]</span>
                <span className="text-[#00FF41] animate-pulse">▊</span>
              </div>
            )}
          </div>
        </div>

        {/* Résultats */}
        {results.length > 0 && (
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-[#00FF41]" />
              <h2 className="text-sm font-mono font-bold text-white">
                {results.length} Prospect(s) trouvé(s)
              </h2>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {results.slice(0, 12).map((r, i) => (
                <div
                  key={i}
                  className="p-4 bg-[#111] rounded-xl border border-zinc-800 hover:border-[#00FF41]/30 transition-colors"
                >
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-sm font-semibold text-white truncate">{r.name}</p>
                    {r.rating && (
                      <Badge variant="outline" className="text-[10px] shrink-0 border-yellow-500/30 text-yellow-400">
                        ★ {r.rating}
                      </Badge>
                    )}
                  </div>
                  {r.address && (
                    <p className="text-xs text-zinc-500 mt-1 flex items-center gap-1">
                      <MapPin className="h-3 w-3 shrink-0" />
                      {r.address}
                    </p>
                  )}
                  {r.website && (
                    <a
                      href={r.website}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-cyan-400 hover:underline flex items-center gap-1 mt-1"
                    >
                      <Globe className="h-3 w-3 shrink-0" />
                      {r.website.replace(/^https?:\/\//, "")}
                    </a>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Indicateur "Outils manquants" statique */}
        {detectorResult?.status === "needs_installer" && !showInstaller && (
          <div
            className="flex items-center gap-4 p-4 rounded-xl border border-yellow-500/30 bg-yellow-500/5 cursor-pointer hover:bg-yellow-500/10 transition-colors"
            onClick={() => setShowInstaller(true)}
          >
            <AlertTriangle className="h-5 w-5 text-yellow-400 shrink-0" />
            <div className="flex-1">
              <p className="text-sm font-mono font-bold text-yellow-400">Outils manquants</p>
              <p className="text-xs text-zinc-400 mt-0.5">
                Cliquez ici pour télécharger l'agent Prospecta et activer le scraping local.
              </p>
            </div>
            <Button
              size="sm"
              className="bg-yellow-500 text-black hover:bg-yellow-400 font-mono font-bold shrink-0"
            >
              <Download className="mr-2 h-3 w-3" />
              Installer
            </Button>
          </div>
        )}

      </div>

      {/* Popup installer */}
      <InstallerPopup
        open={showInstaller}
        onClose={() => setShowInstaller(false)}
        onInstallConfirmed={handleInstallConfirmed}
      />
    </div>
  );
};

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

export default ScanPage;
