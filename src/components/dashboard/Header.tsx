import { useState, useEffect, useRef } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useLanguage } from "@/hooks/useLanguage";
import { useNavigate, useLocation } from "react-router-dom";
import { LogOut, Menu, X } from "lucide-react";
import { Logo } from "@/components/Logo";
import { DarkModeToggle } from "@/components/DarkModeToggle";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";

/**
 * Composant d'en-tête (Navbar)
 * Gère la navigation principale, le changement de langue, le thème sombre et le profil utilisateur.
 */
const Header = () => {
  const { profile, signOut } = useAuth();
  const { language, setLanguage, t } = useLanguage();
  const navigate = useNavigate();
  const location = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [isVisible, setIsVisible] = useState(true);
  const lastScrollY = useRef(0);

  // Smart sticky behavior
  useEffect(() => {
    const handleScroll = () => {
      const currentScrollY = window.scrollY;
      // Show if scrolling up, hide if scrolling down (and outside threshold)
      if (currentScrollY > lastScrollY.current && currentScrollY > 64) {
        setIsVisible(false);
      } else {
        setIsVisible(true);
      }
      lastScrollY.current = currentScrollY;
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  // Configuration des éléments de navigation
  const navItems = [
    { label: t("dashboard"), path: "/dashboard" },
    { label: t("prospects"), path: "/prospects" },
    { label: t("campaigns"), path: "/campaigns" },
    { label: t("reports"), path: "/reports" },
    { label: t("settings"), path: "/settings" },
  ];

  /**
   * Gère la déconnexion de l'utilisateur
   */
  const handleSignOut = async () => {
    await signOut();
    navigate("/login");
  };

  return (
    <header className={`sticky top-0 z-40 border-b bg-card transition-all duration-300 ${
      isVisible ? "translate-y-0 opacity-100" : "-translate-y-full opacity-0"
    }`}>
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6">
        <div className="flex items-center gap-2 cursor-pointer" onClick={() => navigate("/dashboard")}>
          <Logo size="md" />
          <span className="text-xl font-bold text-primary dark:text-white tracking-tight">Prospecta</span>
        </div>

        {/* Desktop nav */}
        <nav className="hidden md:flex items-center gap-1">
          {navItems.map((item) => (
            <button
              key={item.path}
              onClick={() => navigate(item.path)}
              className={`px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                (location.pathname === item.path || (item.path === "/prospects" && location.pathname === "/finder"))
                ? "text-emerald-500 bg-emerald-500/10 shadow-sm shadow-emerald-500/10"
                : "text-muted-foreground hover:text-emerald-500 hover:bg-emerald-500/5"
                }`}
            >
              {item.label}
            </button>
          ))}
        </nav>

        <div className="flex items-center gap-2">
          <Button variant="ghost" className="hidden sm:flex h-9 px-3 gap-2 border border-accent/20 bg-accent/5 hover:bg-accent/10 rounded-full" onClick={() => navigate("/pricing")}>
            <span className="h-2 w-2 rounded-full bg-accent animate-pulse" />
            <span className="text-xs font-bold text-foreground">Starter</span>
          </Button>

          <Select value={language} onValueChange={(value) => setLanguage(value as "fr" | "en")}>
            <SelectTrigger className="w-24 h-9 text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="fr">🇫🇷 FR</SelectItem>
              <SelectItem value="en">🇬🇧 EN</SelectItem>
            </SelectContent>
          </Select>

          <DarkModeToggle />

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="flex h-9 w-9 items-center justify-center rounded-full bg-accent text-accent-foreground text-sm font-medium">
                {profile?.initials || "?"}
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={handleSignOut} className="text-destructive">
                <LogOut className="mr-2 h-4 w-4" />
                {t("logout")}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Mobile menu toggle */}
          <button className="md:hidden" onClick={() => setMobileOpen(!mobileOpen)}>
            {mobileOpen ? <X size={24} /> : <Menu size={24} />}
          </button>
        </div>
      </div>

      {/* Mobile nav */}
      {mobileOpen && (
        <nav className="md:hidden border-t bg-card px-4 py-2 animate-fade-in">
          {navItems.map((item) => (
            <button
              key={item.path}
              onClick={() => {
                navigate(item.path);
                setMobileOpen(false);
              }}
              className={`block w-full text-left px-3 py-2 rounded-md text-sm font-medium ${location.pathname === item.path
                ? "text-emerald-500 bg-emerald-500/10"
                : "text-muted-foreground"
                }`}
            >
              {item.label}
            </button>
          ))}
        </nav>
      )}
    </header>
  );
};

export default Header;
