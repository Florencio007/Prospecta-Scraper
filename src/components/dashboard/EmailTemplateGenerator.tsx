import { useState } from "react";
import { Sparkles, Copy, Save, Check, Wand2, MessageSquare, Flame, Info, Briefcase, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useLanguage } from "@/hooks/useLanguage";
import { generateEmailTemplate } from "@/services/openaiService";
import { useAuth } from "@/hooks/useAuth";
import { useApiKeys } from "@/hooks/useApiKeys";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";

const TONES = [
  { id: "Professionnel", label: "Professionnel", icon: Briefcase },
  { id: "Chaleureux", label: "Chaleureux", icon: MessageSquare },
  { id: "Urgent", label: "Urgent", icon: Flame },
  { id: "Informatif", label: "Informatif", icon: Info },
];

const SEQUENCE_TYPES = [
  { id: "Premier contact", label: "Email de premier contact" },
  { id: "Relance douce", label: "Relance douce" },
  { id: "Relance directe", label: "Relance directe" },
  { id: "Dernière tentative", label: "Dernière tentative" },
  { id: "Remerciement", label: "Remerciement" },
];

const EmailTemplateGenerator = () => {
  const { t } = useLanguage();
  const { user } = useAuth();
  const { getKeyByProvider } = useApiKeys();
  const { toast } = useToast();

  const [isGenerating, setIsGenerating] = useState(false);
  const [tone, setTone] = useState("Professionnel");
  const [sequenceType, setSequenceType] = useState("Premier contact");
  const [description, setDescription] = useState("");
  const [campaignName, setCampaignName] = useState("");
  const [generatedTemplate, setGeneratedTemplate] = useState<{ subject: string; body: string } | null>(null);
  const [copied, setCopied] = useState(false);
  const [isSaveDialogOpen, setIsSaveDialogOpen] = useState(false);
  const [templateName, setTemplateName] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  const handleGenerate = async () => {
    if (!user) return;
    
    setIsGenerating(true);
    try {
      const apiKey = await getKeyByProvider('openai');
      if (!apiKey) {
        throw new Error("Clé OpenAI manquante. Veuillez la configurer dans les paramètres.");
      }

      const result = await generateEmailTemplate(
        user.id, 
        campaignName || sequenceType, 
        description, 
        apiKey,
        tone,
        sequenceType
      );
      
      setGeneratedTemplate(result);
      toast({
        title: "Template généré",
        description: "Votre template a été créé avec succès par l'IA.",
      });
    } catch (err: unknown) {
      toast({
        title: "Erreur",
        description: (err instanceof Error ? err.message : "Une erreur inconnue s'est produite"),
        variant: "destructive",
      });
    } finally {
      setIsGenerating(false);
    }
  };

  const handleCopy = () => {
    if (!generatedTemplate) return;
    const text = `Objet: ${generatedTemplate.subject}\n\n${generatedTemplate.body.replace(/<[^>]*>/g, '')}`;
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    toast({
      title: "Copié",
      description: "Le template a été copié dans le presse-papier.",
    });
  };

  const handleSave = async () => {
    if (!user || !generatedTemplate || !templateName.trim()) return;

    setIsSaving(true);
    try {
      console.log("Attempting to save template to email_library...", {
        user_id: user.id,
        name: templateName.trim(),
      });
      
      const { error } = await (supabase.from('email_library') as any).insert({
        user_id: user.id,
        name: templateName.trim(),
        subject: generatedTemplate.subject,
        body_html: generatedTemplate.body
      });
 
      if (error) {
        console.error("Supabase Save Error:", error);
        throw error;
      }

      toast({
        title: "Template sauvegardé",
        description: `Le template "${templateName}" a été ajouté à votre bibliothèque.`,
      });
      setIsSaveDialogOpen(false);
      setTemplateName("");
    } catch (err: unknown) {
      toast({
        title: "Erreur lors de la sauvegarde",
        description: (err instanceof Error ? err.message : "Une erreur inconnue s'est produite"),
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="animate-in fade-in duration-700 slide-in-from-bottom-2">
      <div className="grid lg:grid-cols-2 gap-10 items-start">
        {/* Form Side */}
        <Card className="border-slate-200 dark:border-slate-800 bg-white/50 dark:bg-slate-900/50 backdrop-blur-sm overflow-hidden shadow-xl shadow-slate-200/50 dark:shadow-none">
          <CardHeader className="border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/50 p-6">
            <CardTitle className="text-lg font-bold flex items-center gap-2">
              <Sparkles className="text-emerald-500" size={18} />
              Générer un template avec IA
            </CardTitle>
          </CardHeader>
          <CardContent className="p-8 space-y-8">
            <div className="space-y-4">
              <Label className="text-[10px] uppercase font-black text-slate-500 tracking-widest">Type de séquence</Label>
              <Select value={sequenceType} onValueChange={setSequenceType}>
                <SelectTrigger className="h-12 bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-800 focus:ring-emerald-500 font-bold">
                  <SelectValue placeholder="Choisir un type" />
                </SelectTrigger>
                <SelectContent>
                  {SEQUENCE_TYPES.map(type => (
                    <SelectItem key={type.id} value={type.id} className="font-medium">{type.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-4">
              <Label className="text-[10px] uppercase font-black text-slate-500 tracking-widest">Ton de l'email</Label>
              <div className="flex flex-wrap gap-3">
                {TONES.map(t => {
                  const Icon = t.icon;
                  const isActive = tone === t.id;
                  return (
                    <button
                      key={t.id}
                      onClick={() => setTone(t.id)}
                      className={`flex items-center gap-2 px-4 py-2.5 rounded-full text-xs font-bold transition-all border ${
                        isActive 
                        ? "bg-emerald-600 border-emerald-600 text-white shadow-lg shadow-emerald-500/20 scale-105" 
                        : "bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:border-emerald-500/50"
                      }`}
                    >
                      <Icon size={14} />
                      {t.label}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="space-y-4">
              <Label className="text-[10px] uppercase font-black text-slate-500 tracking-widest">Informations sur le prospect (optionnel)</Label>
              <Textarea 
                placeholder="Ex: Entreprise Tech cherchant à automatiser ses ventes, budget flexible..."
                className="min-h-[120px] bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-800 focus:ring-emerald-500 resize-none p-4 text-sm leading-relaxed font-medium"
                value={description}
                onChange={e => setDescription(e.target.value)}
              />
            </div>

            <Button 
              onClick={handleGenerate}
              disabled={isGenerating}
              className="w-full h-14 bg-emerald-600 hover:bg-emerald-700 text-white font-black rounded-xl text-base gap-3 shadow-[0_10px_30px_rgba(16,185,129,0.2)] transition-all active:scale-95"
            >
              {isGenerating ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : (
                <Wand2 size={20} />
              )}
              Générer le template
            </Button>
          </CardContent>
        </Card>

        {/* Result Side */}
        <div className="space-y-6">
          {generatedTemplate ? (
            <div className="animate-in fade-in slide-in-from-right-10 duration-500">
              <div className="flex items-center justify-between mb-4 px-2">
                <div className="flex items-center gap-2 text-emerald-500 font-bold text-xs uppercase tracking-widest">
                  <Sparkles size={14} />
                  Résultat IA
                </div>
                <div className="flex gap-2">
                  <Button variant="ghost" size="sm" onClick={handleCopy} className="h-9 px-4 text-xs font-bold gap-2 text-slate-600 dark:text-slate-400 hover:bg-emerald-500/10 hover:text-emerald-500">
                    {copied ? <Check size={14} /> : <Copy size={14} />}
                    Copier
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => setIsSaveDialogOpen(true)} className="h-9 px-4 text-xs font-bold gap-2 text-slate-600 dark:text-slate-400 hover:bg-emerald-500/10 hover:text-emerald-500">
                    <Save size={14} />
                    Sauvegarder
                  </Button>
                </div>
              </div>

              <Card className="border-emerald-500/20 bg-white dark:bg-slate-900 overflow-hidden shadow-2xl shadow-emerald-500/5 rounded-3xl">
                <CardContent className="p-8 space-y-6">
                  <div className="pb-6 border-b border-slate-100 dark:border-slate-800">
                    <p className="text-[10px] uppercase font-black text-slate-400 mb-2 tracking-tighter">Objet de l'email</p>
                    <p className="text-lg font-bold text-slate-900 dark:text-white font-outfit">
                      {generatedTemplate.subject}
                    </p>
                  </div>
                  <div>
                    <p className="text-[10px] uppercase font-black text-slate-400 mb-3 tracking-tighter">Corps du message</p>
                    <div 
                      className="text-slate-700 dark:text-slate-300 text-sm leading-relaxed space-y-4 whitespace-pre-wrap font-medium"
                      dangerouslySetInnerHTML={{ __html: generatedTemplate.body }}
                    />
                  </div>
                </CardContent>
              </Card>
            </div>
          ) : (
            <div className="h-full min-h-[500px] border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-[2.5rem] flex flex-col items-center justify-center text-center p-10 bg-slate-50/50 dark:bg-slate-900/50 transition-all">
              <div className="w-20 h-20 bg-slate-100 dark:bg-slate-800 rounded-3xl flex items-center justify-center mb-6 text-slate-400 shadow-inner">
                <Wand2 size={40} className="opacity-20 animate-pulse" />
              </div>
              <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-2">Prêt à créer ?</h3>
              <p className="text-sm text-slate-500 dark:text-slate-400 max-w-xs leading-relaxed font-medium">
                Utilisez le formulaire à gauche pour générer un template de prospection percutant en quelques secondes.
              </p>
            </div>
          )}
        </div>
      </div>

      <Dialog open={isSaveDialogOpen} onOpenChange={setIsSaveDialogOpen}>
        <DialogContent className="sm:max-w-md border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 rounded-[2rem]">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold flex items-center gap-2">
              <Save className="text-emerald-500" size={20} />
              Sauvegarder le template
            </DialogTitle>
            <DialogDescription className="text-slate-500 dark:text-slate-400 font-medium">
              Donnez un nom à votre template pour le retrouver facilement plus tard.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="name" className="text-[10px] uppercase font-black text-slate-500 tracking-widest">
                Nom du template
              </Label>
              <Input
                id="name"
                placeholder="Ex: Premier Contact Tech"
                value={templateName}
                onChange={(e) => setTemplateName(e.target.value)}
                className="h-12 bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800 focus:ring-emerald-500 font-bold"
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleSave();
                }}
              />
            </div>
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="ghost"
              onClick={() => setIsSaveDialogOpen(false)}
              className="h-12 px-6 font-bold text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl"
            >
              Annuler
            </Button>
            <Button
              onClick={handleSave}
              disabled={isSaving || !templateName.trim()}
              className="h-12 px-8 bg-emerald-600 hover:bg-emerald-700 text-white font-black rounded-xl shadow-lg shadow-emerald-500/20"
            >
              {isSaving ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Save className="mr-2" size={18} />
              )}
              Confirmer la sauvegarde
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default EmailTemplateGenerator;
