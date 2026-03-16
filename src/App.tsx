import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "@/hooks/useAuth";
import { LanguageProvider } from "@/hooks/useLanguage";
import { ThemeProvider } from "next-themes";
import ProtectedRoute from "@/components/ProtectedRoute";
import ErrorBoundary from "@/components/ErrorBoundary";
import { lazy, Suspense, useState } from "react";
import { Sparkles } from "lucide-react";
import AIAssistant from "@/components/dashboard/AIAssistant";
import { Button } from "@/components/ui/button";

const Landing = lazy(() => import("./pages/Landing"));
const Login = lazy(() => import("./pages/Login"));
const Dashboard = lazy(() => import("./pages/Dashboard"));
const Prospects = lazy(() => import("./pages/Prospects"));
const Campaigns = lazy(() => import("./pages/Campaigns"));
const Reports = lazy(() => import("./pages/Reports"));
const Settings = lazy(() => import("./pages/Settings"));
const ProspectFinder = lazy(() => import("./pages/ProspectFinder"));
const Pricing = lazy(() => import("./pages/Pricing"));
const Onboarding = lazy(() => import("./pages/Onboarding"));
const Unsubscribe = lazy(() => import("./pages/Unsubscribe"));
const Templates = lazy(() => import("./pages/Templates"));
const NotFound = lazy(() => import("./pages/NotFound"));
const Admin = lazy(() => import("./pages/Admin"));

const queryClient = new QueryClient();

const GlobalAIAssistant = () => {
  const [isOpen, setIsOpen] = useState(false);
  return (
    <>
      <AIAssistant open={isOpen} onClose={() => setIsOpen(false)} />
      <Button
        onClick={() => setIsOpen(true)}
        className="fixed bottom-6 right-6 h-14 w-14 rounded-full bg-accent shadow-2xl shadow-accent/40 z-40 transition-transform hover:scale-110 active:scale-95 group border-0"
      >
        <Sparkles className="text-white h-6 w-6 group-hover:animate-pulse" />
        <span className="absolute -top-1 -right-1 flex h-4 w-4">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
          <span className="relative inline-flex rounded-full h-4 w-4 bg-emerald-500"></span>
        </span>
      </Button>
    </>
  );
};

/**
 * Composant racine de l'application
 * Configure les fournisseurs de contexte (Auth, Langue, Thème, QueryClient)
 * et définit le routage de l'application.
 */
const App = () => (
  <QueryClientProvider client={queryClient}>
    <ThemeProvider attribute="class" defaultTheme="light" enableSystem={false} storageKey="prospecta-theme">
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <AuthProvider>
            <LanguageProvider>
              <Suspense fallback={<div>Loading...</div>}>
                <ErrorBoundary>
                  <Routes>
                    <Route path="/" element={<Landing />} />
                    <Route path="/login" element={<Login />} />
                    <Route
                      path="/dashboard"
                      element={
                        <ProtectedRoute>
                          <Dashboard />
                        </ProtectedRoute>
                      }
                    />
                    <Route
                      path="/prospects"
                      element={
                        <ProtectedRoute>
                          <Prospects />
                        </ProtectedRoute>
                      }
                    />
                    <Route
                      path="/campaigns"
                      element={
                        <ProtectedRoute>
                          <Campaigns />
                        </ProtectedRoute>
                      }
                    />
                    <Route
                      path="/reports"
                      element={
                        <ProtectedRoute>
                          <Reports />
                        </ProtectedRoute>
                      }
                    />
                    <Route
                      path="/settings"
                      element={
                        <ProtectedRoute>
                          <Settings />
                        </ProtectedRoute>
                      }
                    />
                    <Route
                      path="/finder"
                      element={
                        <ProtectedRoute>
                          <ProspectFinder />
                        </ProtectedRoute>
                      }
                    />
                    <Route
                      path="/pricing"
                      element={
                        <ProtectedRoute>
                          <Pricing />
                        </ProtectedRoute>
                      }
                    />
                    <Route
                      path="/onboarding"
                      element={
                        <ProtectedRoute showOnboarding={false}>
                          <Onboarding />
                        </ProtectedRoute>
                      }
                    />
                    <Route path="/unsubscribe" element={<Unsubscribe />} />
                    <Route
                      path="/admin"
                      element={
                        <ProtectedRoute requireAdmin={true}>
                          <Admin />
                        </ProtectedRoute>
                      }
                    />
                    <Route
                      path="/templates"
                      element={<Navigate to="/campaigns" replace />}
                    />
                    <Route path="*" element={<NotFound />} />
                  </Routes>
                  <GlobalAIAssistant />
                </ErrorBoundary>
              </Suspense>
            </LanguageProvider>
          </AuthProvider>
        </BrowserRouter>
      </TooltipProvider>
    </ThemeProvider>
  </QueryClientProvider>
);

export default App;
