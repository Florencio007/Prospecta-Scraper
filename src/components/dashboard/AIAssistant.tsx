import { useState, useMemo, useEffect, useRef, useCallback } from "react";
import { Sparkles, X, RefreshCw, Check, Loader, BarChart3, MessageSquare, History, PieChart, TrendingUp, Send, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useLanguage } from "@/hooks/useLanguage";
import { useAuth } from "@/hooks/useAuth";
import { useApiKeys } from "@/hooks/useApiKeys";
import { useToast } from "@/hooks/use-toast";
import { copywriterAgent, analysteAgent, chatAgent } from "@/lib/ai-agents";
import { supabase } from "@/integrations/supabase/client";

interface Props {
  open: boolean;
  onClose: () => void;
  initialMode?: "message" | "analysis";
}

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

const AIAssistant = ({ open, onClose, initialMode = "message" }: Props) => {
  const { language, t } = useLanguage();
  const { profile, user } = useAuth();
  const { getKeyByProvider } = useApiKeys();
  const { toast } = useToast();
  
  const [activeMode, setActiveMode] = useState<"message" | "analysis">(initialMode);
  const [generating, setGenerating] = useState(false);
  const [analysisReport, setAnalysisReport] = useState("");
  
  // Chat States
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [userInput, setUserInput] = useState("");
  const [loadingHistory, setLoadingHistory] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const strategies = useMemo(() => {
    const industry = profile?.industry || t("others");
    const valueProp = profile?.value_prop || t("solutions");

    if (language === "fr") {
      return [
        { title: t("chatStarterLinkedIn"), prompt: t("chatPromptLinkedIn") + industry },
        { title: t("chatStarterEmail"), prompt: t("chatPromptEmail") + valueProp },
        { title: t("chatStarterTips"), prompt: t("chatPromptTips") }
      ];
    } else {
      return [
        { title: "LinkedIn Hook", prompt: "Generate a LinkedIn hook for a prospect in the " + industry + " sector" },
        { title: "Follow-up Email", prompt: "Write a follow-up email based on my value prop: " + valueProp },
        { title: "Prospecting Tips", prompt: "Give me 3 tips to improve my prospecting today." }
      ];
    }
  }, [language, profile, t]);

  const loadChatHistory = useCallback(async () => {
    if (!user?.id) return;
    setLoadingHistory(true);
    const { data, error } = await supabase
      .from('ai_chat_messages')
      .select('role, content')
      .eq('user_id', user.id)
      .order('created_at', { ascending: true });

    if (error) {
      console.error("Error loading chat history:", error);
    } else if (data) {
      setChatMessages(data as ChatMessage[]);
    }
    setLoadingHistory(false);
  }, [user?.id]);

  useEffect(() => {
    if (open && user?.id) {
      loadChatHistory();
    }
  }, [open, user?.id, loadChatHistory]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [chatMessages]);

  const fetchDashboardData = async () => {
    if (!user?.id) return null;
    
    // Total Prospects
    const { count: totalProspects } = await supabase
      .from('prospects')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user.id);

    // Messages Sent
    const { count: sentCount } = await supabase
      .from('email_events')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .eq('event_type', 'sent');

    // Opened
    const { count: openedCount } = await supabase
      .from('email_events')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .eq('event_type', 'opened');

    // Recent Activity
    const { data: recentActivity } = await supabase
      .from('activity_log')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(5);

    const responseRate = sentCount && sentCount > 0 ? ((openedCount || 0) / sentCount) * 100 : 0;

    return {
      totalProspects: totalProspects || 0,
      responseRate: responseRate.toFixed(1),
      messagesSent: sentCount || 0,
      recentActivity: recentActivity || []
    };
  };

  const handleSendMessage = async (text?: string) => {
    const content = text || userInput;
    if (!content.trim() || !user?.id) return;

    setUserInput("");
    setGenerating(true);

    const newMessages: ChatMessage[] = [...chatMessages, { role: 'user', content }];
    setChatMessages(newMessages);

    // Save to Supabase
    await supabase.from('ai_chat_messages').insert([{
      user_id: user.id,
      role: 'user',
      content
    }]);

    const openaiKey = await getKeyByProvider("openai");
    if (!openaiKey) {
      toast({
        title: "Clé OpenAI manquante",
        description: "Veuillez configurer votre clé OpenAI dans les Paramètres.",
        variant: "destructive"
      });
      setGenerating(false);
      return;
    }

    try {
      const stats = await fetchDashboardData();
      const aiResponse = await chatAgent(openaiKey, newMessages, {
          profile,
          stats: stats || { totalProspects: 0, responseRate: 0, messagesSent: 0 }
      });

      setChatMessages([...newMessages, { role: 'assistant', content: aiResponse }]);

      // Save to Supabase
      await supabase.from('ai_chat_messages').insert([{
        user_id: user.id,
        role: 'assistant',
        content: aiResponse
      }]);
    } catch (err: unknown) {
      toast({
        title: "Erreur IA",
        description: err instanceof Error ? (err instanceof Error ? err.message : "Une erreur inconnue s'est produite") : "Une erreur inconnue s'est produite",
        variant: "destructive"
      });
    } finally {
      setGenerating(false);
    }
  };

  const handleAnalyze = async () => {
    setGenerating(true);
    const openaiKey = await getKeyByProvider("openai");
    if (!openaiKey) {
      toast({
        title: "Clé OpenAI manquante",
        description: "Veuillez configurer votre clé OpenAI dans les Paramètres.",
        variant: "destructive"
      });
      setGenerating(false);
      return;
    }

    try {
      const { data: prospects } = await supabase.from('prospects').select('source').eq('user_id', user?.id);
      const sourceCounts: Record<string, number> = {};
      (prospects as { source?: string }[])?.forEach(p => { if (p.source) sourceCounts[p.source] = (sourceCounts[p.source] || 0) + 1; });
      
      const stats = await fetchDashboardData();
      const data = {
        ...stats,
        topSources: Object.entries(sourceCounts).map(([name, count]) => ({ name, count }))
      };
      
      const report = await analysteAgent(openaiKey, data);
      setAnalysisReport(report);
    } catch (err: unknown) {
      toast({ title: "Erreur d'analyse", description: err instanceof Error ? (err instanceof Error ? err.message : "Une erreur inconnue s'est produite") : "Une erreur inconnue s'est produite", variant: "destructive" });
    } finally {
      setGenerating(false);
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-y-0 right-0 z-50 w-full sm:w-[450px] bg-card border-l shadow-2xl flex flex-col animate-slide-in-right">
      <div className="flex items-center justify-between p-6 border-b bg-accent/5">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-accent flex items-center justify-center text-white shadow-lg shadow-accent/20">
            <Sparkles size={22} />
          </div>
          <div>
            <h2 className="text-lg font-black text-primary">{t("aiAssistantTitle")}</h2>
            <p className="text-[10px] uppercase font-bold text-accent tracking-widest">{t("aiAssistantSubtitle")}</p>
          </div>
        </div>
        <button onClick={onClose} className="h-8 w-8 rounded-full hover:bg-secondary flex items-center justify-center transition-colors">
          <X size={20} className="text-muted-foreground" />
        </button>
      </div>

      <div className="px-6 py-4 border-b bg-secondary/10">
        <Tabs value={activeMode} onValueChange={(v: string) => setActiveMode(v)} className="w-full">
          <TabsList className="grid w-full grid-cols-2 h-11 p-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl">
            <TabsTrigger value="message" className="rounded-lg font-bold text-xs gap-2">
              <MessageSquare size={14} /> {t("chatAssistant")}
            </TabsTrigger>
            <TabsTrigger value="analysis" className="rounded-lg font-bold text-xs gap-2">
              <BarChart3 size={14} /> {t("analysis", "Analyse")}
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      <div className="flex-1 overflow-y-auto flex flex-col min-h-0">
        {activeMode === "message" ? (
          <div className="flex-1 flex flex-col min-h-0 bg-slate-50/50 dark:bg-slate-950/50">
            <div ref={scrollRef} className="flex-1 overflow-y-auto p-6 space-y-4">
              {loadingHistory && (
                <div className="flex justify-center py-4">
                  <LoadingLogo size="xs" compact />
                </div>
              )}
              
              {chatMessages.length === 0 && !loadingHistory && (
                <div className="text-center py-8 space-y-4">
                  <div className="h-16 w-16 rounded-full bg-accent/10 flex items-center justify-center mx-auto text-accent">
                    <MessageSquare size={32} />
                  </div>
                  <h3 className="font-bold">{t("chooseStrategy")}</h3>
                  <div className="flex flex-wrap gap-2 justify-center px-4">
                    {strategies.map((s, i) => (
                      <button
                        key={i}
                        onClick={() => handleSendMessage(s.prompt)}
                        className="text-xs px-3 py-2 rounded-full border border-accent/20 bg-white hover:bg-accent/5 transition-colors font-medium text-accent"
                      >
                        {s.title}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {chatMessages.map((msg, i) => (
                <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'} animate-in fade-in slide-in-from-bottom-2 duration-300`}>
                  <div className={`max-w-[85%] flex gap-3 ${msg.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}>
                    <div className={`h-8 w-8 rounded-lg flex items-center justify-center shrink-0 ${msg.role === 'user' ? 'bg-primary text-white' : 'bg-accent text-white'}`}>
                      {msg.role === 'user' ? <User size={16} /> : <Sparkles size={16} />}
                    </div>
                    <div className={`p-4 rounded-2xl text-sm leading-relaxed shadow-sm ${
                      msg.role === 'user' 
                      ? 'bg-primary text-primary-foreground rounded-tr-none' 
                      : 'bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-tl-none whitespace-pre-wrap'
                    }`}>
                      {msg.role === 'assistant' ? (
                        <div dangerouslySetInnerHTML={{ 
                          __html: (msg.content || "")
                            .replace(/\*\*(.*?)\*\*/g, '<strong class="text-accent font-bold">$1</strong>')
                            .replace(/^\s*[-*]\s+/gm, '• ')
                            .replace(/###?\s+(.*)/g, '<h4 class="font-black uppercase text-xs mt-2">$1</h4>')
                        }} />
                      ) : (
                        msg.content || ""
                      )}
                    </div>
                  </div>
                </div>
              ))}

              {generating && (
                <div className="flex justify-start animate-pulse">
                   <div className="max-w-[85%] flex gap-3">
                      <div className="h-8 w-8 rounded-lg bg-accent flex items-center justify-center text-white shrink-0">
                        <Sparkles size={16} />
                      </div>
                      <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-tl-none">
                        <LoadingLogo size="xs" compact />
                      </div>
                   </div>
                </div>
              )}
            </div>

            <div className="p-4 border-t bg-white dark:bg-slate-900 mt-auto">
              <form 
                onSubmit={(e) => { e.preventDefault(); handleSendMessage(); }}
                className="flex gap-2"
              >
                <Input
                  value={userInput}
                  onChange={(e) => setUserInput(e.target.value)}
                  placeholder={t("chatPlaceholder")}
                  className="rounded-xl border-slate-200 focus-visible:ring-accent h-12"
                  disabled={generating}
                />
                <Button 
                  type="submit" 
                  disabled={!userInput.trim() || generating}
                  className="rounded-xl h-12 w-12 p-0 bg-accent hover:bg-accent/90 shrink-0"
                >
                  <Send size={20} />
                </Button>
              </form>
            </div>
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto p-6 space-y-6 animate-in fade-in slide-in-from-bottom-2">
            {!analysisReport && !generating && (
              <div className="flex flex-col items-center justify-center py-12 text-center space-y-4">
                <div className="h-20 w-20 rounded-full bg-accent/10 flex items-center justify-center text-accent mb-2">
                  <BarChart3 size={40} />
                </div>
                <div>
                  <h3 className="text-lg font-black font-outfit">Besoin d'un conseil ?</h3>
                  <p className="text-xs text-muted-foreground max-w-[250px] mx-auto mt-2 font-medium leading-relaxed">
                    L'IA va analyser vos performances de campagne et vos sources de prospects pour vous donner des recommandations stratégiques.
                  </p>
                </div>
                <Button 
                  onClick={handleAnalyze} 
                  className="bg-emerald-600 hover:bg-emerald-700 text-white font-black rounded-xl px-10 h-12 shadow-lg shadow-emerald-500/20"
                >
                  <Sparkles size={18} className="mr-2" /> Analyser maintenant
                </Button>
              </div>
            )}

            {generating && (
              <div className="flex flex-col items-center justify-center py-20 text-center animate-pulse">
                <div className="h-16 w-16 bg-accent/20 rounded-2xl flex items-center justify-center mb-6 animate-bounce">
                  <LoadingLogo size="md" compact />
                </div>
                <p className="text-lg font-black font-outfit bg-gradient-to-r from-accent to-emerald-500 bg-clip-text text-transparent">Analyse de vos données...</p>
                <p className="text-xs text-muted-foreground mt-2 font-bold uppercase tracking-widest">Calcul des tendances</p>
              </div>
            )}

            {analysisReport && !generating && (
              <div className="space-y-6 animate-in fade-in duration-500">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-black uppercase tracking-widest flex items-center gap-2">
                    <History size={16} className="text-accent" /> Rapport Stratégique
                  </h3>
                  <Button variant="ghost" size="sm" onClick={handleAnalyze} className="h-8 text-[10px] font-black uppercase text-emerald-600 hover:bg-emerald-50">
                    <RefreshCw size={12} className="mr-1" /> Rafraîchir
                  </Button>
                </div>
                <div className="prose prose-sm dark:prose-invert prose-emerald max-w-none">
                  <div className="p-6 rounded-2xl bg-white dark:bg-slate-900 border-2 border-emerald-500/10 shadow-lg font-medium leading-relaxed whitespace-pre-wrap text-sm">
                    {analysisReport}
                  </div>
                </div>
                
                <div className="grid grid-cols-2 gap-3 pb-8">
                   <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800 flex flex-col items-center text-center">
                      <Sparkles className="text-amber-500 mb-2" size={20} />
                      <span className="text-[10px] font-black uppercase opacity-60">Score IA</span>
                      <span className="text-lg font-black text-primary">Excellent</span>
                   </div>
                   <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800 flex flex-col items-center text-center">
                      <TrendingUp className="text-emerald-500 mb-2" size={20} />
                      <span className="text-[10px] font-black uppercase opacity-60">Croissance</span>
                      <span className="text-lg font-black text-primary">+12%</span>
                   </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {activeMode === "analysis" && analysisReport && !generating && (
        <div className="p-6 border-t bg-secondary/20 backdrop-blur-sm">
          <Button
            variant="outline"
            className="w-full rounded-xl h-12 font-black border-2 border-slate-200"
            onClick={() => setAnalysisReport("")}
          >
            Nouvelle Analyse
          </Button>
        </div>
      )}
    </div>
  );
};

export default AIAssistant;
