import { useState, useEffect, useRef } from "react";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Mail, Sparkles, Loader2, Save, X, MessageSquare, Send, Bot, User, Edit } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface Message {
    role: 'user' | 'assistant';
    content: string;
}

interface EditTemplateDialogProps {
    isOpen: boolean;
    onClose: () => void;
    campaign: {
        id: string;
        subject: string;
        body_html?: string;
    } | null;
    onSave: (id: string, updates: { subject: string; body_html: string }) => Promise<void>;
    isGeneratingAI?: boolean;
    onGenerateAI?: (subject: string) => Promise<{ subject: string; body: string } | void>;
    onRefineAI?: (subject: string, body: string, prompt: string, history: any[]) => Promise<{ subject: string; body: string; message?: string } | void>;
}

export default function EditTemplateDialog({ 
    isOpen, 
    onClose, 
    campaign, 
    onSave,
    isGeneratingAI,
    onGenerateAI,
    onRefineAI
}: EditTemplateDialogProps) {
    const [subject, setSubject] = useState("");
    const [body, setBody] = useState("");
    const [isSaving, setIsSaving] = useState(false);
    const [chatInput, setChatInput] = useState("");
    const [messages, setMessages] = useState<Message[]>([]);
    const [activeTab, setActiveTab] = useState("editor");
    const scrollRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (campaign) {
            setSubject(campaign.subject || "");
            setBody(campaign.body_html || "");
        }
    }, [campaign, isOpen]);

    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
    }, [messages]);

    const handleSave = async () => {
        if (!campaign) return;
        setIsSaving(true);
        try {
            await onSave(campaign.id, { subject, body_html: body });
            onClose();
        } finally {
            setIsSaving(false);
        }
    };

    const handleAI = async () => {
        if (!onGenerateAI) return;
        const result = await onGenerateAI(subject);
        if (result) {
            setSubject(result.subject);
            setBody(result.body);
        }
    };

    const handleRefine = async () => {
        console.log("[handleRefine] Start");
        if (!onRefineAI || !chatInput.trim()) {
            console.log("[handleRefine] Early return (missing prop or empty input)", { hasProp: !!onRefineAI, input: chatInput });
            return;
        }
        
        const userMsg = chatInput.trim();
        setChatInput("");
        setMessages(prev => [...prev, { role: 'user', content: userMsg }]);
        
        console.log("[handleRefine] Calling onRefineAI");
        try {
            const result = await onRefineAI(subject, body, userMsg, messages);
            console.log("[handleRefine] onRefineAI returned:", result);
            if (result) {
                setSubject(result.subject);
                setBody(result.body);
                setMessages(prev => [...prev, { role: 'assistant', content: result.message || "J'ai mis à jour le template selon votre demande. Vous pouvez le voir dans l'onglet Éditeur." }]);
            }
        } catch (err) {
            console.error("[handleRefine] Error caught:", err);
        }
        console.log("[handleRefine] End");
    };

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="sm:max-w-[800px] h-[80vh] bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-900 dark:text-slate-100 p-0 overflow-hidden outline-none flex flex-col">
                <div className="p-6 border-b border-slate-200 dark:border-slate-800">
                    <DialogHeader>
                        <div className="flex justify-between items-center">
                            <DialogTitle className="text-xl font-black flex items-center gap-2 font-outfit">
                                <Mail className="text-emerald-500" size={20} /> Modifier le Template
                            </DialogTitle>
                        </div>
                    </DialogHeader>
                </div>

                <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col overflow-hidden">
                    <div className="px-6 border-b border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/50">
                        <TabsList className="bg-transparent h-12 gap-6">
                            <TabsTrigger value="editor" className="data-[state=active]:bg-transparent data-[state=active]:text-emerald-500 border-b-2 border-transparent data-[state=active]:border-emerald-500 rounded-none h-12 px-0 text-xs font-bold uppercase tracking-widest">
                                <Edit className="w-3.5 h-3.5 mr-2" /> Éditeur
                            </TabsTrigger>
                            <TabsTrigger value="chat" className="data-[state=active]:bg-transparent data-[state=active]:text-emerald-500 border-b-2 border-transparent data-[state=active]:border-emerald-500 rounded-none h-12 px-0 text-xs font-bold uppercase tracking-widest">
                                <MessageSquare className="w-3.5 h-3.5 mr-2" /> Chatbot IA
                            </TabsTrigger>
                        </TabsList>
                    </div>

                    <div className="flex-1 overflow-hidden">
                        <TabsContent value="editor" className="h-full m-0 p-6 overflow-y-auto outline-none">
                            <div className="space-y-6">
                                <div className="space-y-2">
                                    <Label className="text-[10px] uppercase font-black text-slate-500 tracking-tighter">Objet de l'email</Label>
                                    <div className="flex gap-2">
                                        <Input
                                            placeholder="🚀 Boostez vos ventes"
                                            className="bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800 focus:border-emerald-500 h-11 font-medium font-outfit"
                                            value={subject}
                                            onChange={e => setSubject(e.target.value)}
                                        />
                                        {onGenerateAI && (
                                            <Button
                                                type="button"
                                                variant="outline"
                                                size="sm"
                                                onClick={handleAI}
                                                disabled={isGeneratingAI}
                                                className="h-11 border-dashed border-emerald-500/30 text-emerald-500 hover:bg-emerald-500/10 gap-2 font-outfit"
                                            >
                                                {isGeneratingAI ? <Loader2 className="animate-spin h-4 w-4" /> : <Sparkles className="h-4 w-4" />}
                                                Régénérer
                                            </Button>
                                        )}
                                    </div>
                                </div>

                                <div className="space-y-2">
                                    <Label className="text-[10px] uppercase font-black text-slate-500 tracking-tighter">Message (HTML)</Label>
                                    <Textarea
                                        placeholder="Bonjour {{prenom}}, ..."
                                        className="bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800 focus:border-emerald-500 min-h-[300px] leading-relaxed font-outfit text-sm"
                                        value={body}
                                        onChange={e => setBody(e.target.value)}
                                    />
                                    <p className="text-[10px] text-slate-500 italic">
                                        Supporte les variables: {'{{prenom}}'}, {'{{nom}}'}, {'{{entreprise}}'}
                                    </p>
                                </div>
                            </div>
                        </TabsContent>

                        <TabsContent value="chat" className="h-full m-0 flex flex-col outline-none">
                            <div ref={scrollRef} className="flex-1 overflow-y-auto p-6 space-y-4 scroll-smooth">
                                {messages.length === 0 && (
                                    <div className="h-full flex flex-col items-center justify-center text-center opacity-50 space-y-3">
                                        <Bot size={48} className="text-emerald-500" />
                                        <p className="text-sm font-medium">Discutez avec l'IA pour améliorer votre email.<br/>Ex: "Rends le ton plus pro" ou "Sois plus direct".</p>
                                    </div>
                                )}
                                {messages.map((m, i) => (
                                    <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                                        <div className={`max-w-[80%] p-3 rounded-2xl text-xs font-medium leading-relaxed ${
                                            m.role === 'user' 
                                            ? 'bg-emerald-600 text-white rounded-tr-none' 
                                            : 'bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 rounded-tl-none border border-slate-200 dark:border-slate-700'
                                        }`}>
                                            <div className="flex items-center gap-2 mb-1 opacity-70">
                                                {m.role === 'user' ? <User size={12} /> : <Bot size={12} />}
                                                <span className="uppercase tracking-widest font-black text-[9px]">{m.role === 'user' ? 'Vous' : 'Prospecta AI'}</span>
                                            </div>
                                            {m.content}
                                        </div>
                                    </div>
                                ))}
                                {isGeneratingAI && (
                                    <div className="flex justify-start">
                                        <div className="bg-slate-100 dark:bg-slate-800 p-4 rounded-2xl rounded-tl-none border border-slate-200 dark:border-slate-700">
                                            <Loader2 className="w-4 h-4 animate-spin text-emerald-500" />
                                        </div>
                                    </div>
                                )}
                            </div>
                            <div className="p-4 bg-slate-50 dark:bg-slate-950 border-t border-slate-200 dark:border-slate-800">
                                <div className="relative">
                                    <Input 
                                        placeholder="Améliorez votre email ici..."
                                        value={chatInput}
                                        onChange={e => setChatInput(e.target.value)}
                                        onKeyDown={e => e.key === 'Enter' && handleRefine()}
                                        className="pr-12 bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 h-12 rounded-xl focus:ring-emerald-500 focus:border-emerald-500"
                                    />
                                    <Button 
                                        size="icon"
                                        onClick={handleRefine}
                                        disabled={isGeneratingAI || !chatInput.trim()}
                                        className="absolute right-1 top-1 h-10 w-10 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg transition-all"
                                    >
                                        <Send size={18} />
                                    </Button>
                                </div>
                            </div>
                        </TabsContent>
                    </div>
                </Tabs>

                <DialogFooter className="p-6 bg-slate-50 dark:bg-slate-950 border-t border-slate-200 dark:border-slate-800 flex justify-end gap-3">
                    <Button
                        variant="ghost"
                        onClick={onClose}
                        className="text-slate-600 dark:text-slate-400 font-bold hover:bg-slate-200 dark:hover:bg-slate-800"
                    >
                        Annuler
                    </Button>
                    <Button
                        onClick={handleSave}
                        disabled={isSaving}
                        className="bg-emerald-600 hover:bg-emerald-700 text-white font-black h-11 px-10 gap-2 shadow-[0_0_20px_rgba(16,185,129,0.2)] font-outfit"
                    >
                        {isSaving ? <Loader2 className="animate-spin h-4 w-4" /> : <Save size={16} />}
                        Enregistrer les modifications
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
