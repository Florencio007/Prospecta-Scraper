import React, { useEffect, useState } from 'react';
import { useApiKeys, ApiProvider, ApiKey } from '@/hooks/useApiKeys';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { useToast } from '@/hooks/use-toast';
import { 
    Eye, EyeOff, ExternalLink, CheckCircle2, XCircle, Clock, 
    AlertTriangle, Key, Server, Trash2, Mail, ShieldCheck, 
    MailCheck, MailWarning, Settings2, RefreshCw, Save 
} from 'lucide-react';
import { LoadingLogo } from '@/components/LoadingLogo';
import { ConfirmDialog } from './ConfirmDialog';
import { testEmailSend, testSmtpConnection } from '@/services/emailService';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Sparkles, Brain, Cpu, Zap } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Switch } from '@/components/ui/switch';
import { testImapConnection } from '@/services/emailService';

const PROVIDERS_CONFIG = [
    /* openai is now handled by AiModelCard */
    {
        id: 'google_maps' as ApiProvider,
        name: 'Google Maps / Places',
        icon: '🗺️',
        description: 'Prospection automatique via Google Business (GMB)',
        keyLabel: 'Google Maps API Key',
        keyPlaceholder: 'AIza...',
        docsUrl: 'https://console.cloud.google.com/apis/credentials',
        required: false,
    },
    {
        id: 'facebook' as ApiProvider,
        name: 'Facebook / Meta',
        icon: '📘',
        description: 'Prospection via Facebook Ads et pages Business',
        keyLabel: 'Access Token',
        keyPlaceholder: 'EAAxx...',
        hasSecret: true,
        secretLabel: 'App Secret',
        docsUrl: 'https://developers.facebook.com/tools/accesstoken/',
        required: false,
    },
    {
        id: 'linkedin' as ApiProvider,
        name: 'LinkedIn',
        icon: '💼',
        description: 'Prospection et enrichissement de profils LinkedIn',
        keyLabel: 'Client ID',
        keyPlaceholder: '86xxx...',
        hasSecret: true,
        secretLabel: 'Client Secret',
        docsUrl: 'https://www.linkedin.com/developers/apps',
        required: false,
    },
    {
        id: 'twilio' as ApiProvider,
        name: 'Twilio (WhatsApp / SMS)',
        icon: '📱',
        description: 'Envoi de messages WhatsApp et SMS automatisés',
        keyLabel: 'Account SID',
        keyPlaceholder: 'ACxx...',
        hasSecret: true,
        secretLabel: 'Auth Token',
        docsUrl: 'https://console.twilio.com/',
        required: false,
    },
];

const MaintenanceCard = () => {
    const [isClearing, setIsClearing] = useState(false);
    const { toast } = useToast();

    const handleClearCache = async () => {
        setIsClearing(true);
        try {
            // Unregister all service workers
            if ('serviceWorker' in navigator) {
                const registrations = await navigator.serviceWorker.getRegistrations();
                for (const registration of registrations) {
                    await registration.unregister();
                }
            }

            // Clear all caches
            if ('caches' in window) {
                const cacheNames = await caches.keys();
                for (const cacheName of cacheNames) {
                    await caches.delete(cacheName);
                }
            }

            // Clear localStorage (optional but safer for "nuclear" fix)
            // localStorage.clear(); // We might want to keep session, so maybe just specific keys or none.
            
            toast({
                title: "Cache vidé",
                description: "L'application va redémarrer pour appliquer les mises à jour.",
            });

            // Reload after a short delay
            setTimeout(() => {
                window.location.href = window.location.origin + '/?updated=' + Date.now();
            }, 1500);
        } catch (error) {
            console.error("Failed to clear cache:", error);
            window.location.reload();
        }
    };

    return (
        <Card className="border-amber-500/20 bg-amber-500/5 backdrop-blur-sm">
            <CardHeader>
                <CardTitle className="flex items-center gap-2 text-amber-600 dark:text-amber-400">
                    <Zap size={20} /> Maintenance & Mise à jour
                </CardTitle>
                <CardDescription>
                    Si vous rencontrez des erreurs de chargement ou si une mise à jour ne s'affiche pas, videz le cache local.
                </CardDescription>
            </CardHeader>
            <CardContent>
                <Button 
                    variant="outline" 
                    className="w-full border-amber-500/50 hover:bg-amber-500/10 text-amber-700 dark:text-amber-300 font-bold"
                    onClick={handleClearCache}
                    disabled={isClearing}
                >
                    {isClearing ? "Nettoyage en cours..." : "Vider le cache et Forcer la mise à jour"}
                </Button>
            </CardContent>
        </Card>
    );
};


// ---- SMTP Configuration Card ----
const SmtpCard = ({ existingConfig, onUpdate }: { existingConfig?: ApiKey; onUpdate: () => void }) => {
    const { deleteKey } = useApiKeys();
    const { toast } = useToast();

    const [host, setHost] = useState('');
    const [port, setPort] = useState('587');
    const [user, setUser] = useState('');
    const [pass, setPass] = useState('');
    const [fromEmail, setFromEmail] = useState('');
    
    // IMAP Settings
    const [imapHost, setImapHost] = useState('');
    const [imapPort, setImapPort] = useState('993');
    const [imapEnabled, setImapEnabled] = useState(false);
    const [imapSecure, setImapSecure] = useState(true);

    const [showPass, setShowPass] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [isTesting, setIsTesting] = useState(false);
    const [isTestingImap, setIsTestingImap] = useState(false);
    const [isDeleting, setIsDeleting] = useState(false);
    const [testEmail, setTestEmail] = useState('');
    const [isSendingTest, setIsSendingTest] = useState(false);
    const [isTestSuccess, setIsTestSuccess] = useState(false);
    const [isImapTestSuccess, setIsImapTestSuccess] = useState(false);
    const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);

    const fetchSmtpSettings = async () => {
        try {
            const { data: { user: currentUser } } = await supabase.auth.getUser();
            if (!currentUser) return;

            const { data, error } = await supabase
                .from('smtp_settings')
                .select('*')
                .eq('user_id', currentUser.id)
                .maybeSingle();

            if (data) {
                setHost(data.host || '');
                setPort(String(data.port || '587'));
                setUser(data.username || '');
                setPass(data.password || '');
                setFromEmail(data.from_email || data.username || '');
                setImapHost(data.imap_host || '');
                setImapPort(String(data.imap_port || '993'));
                setImapEnabled(data.imap_enabled || false);
                setImapSecure(data.imap_secure !== false);
            }
        } catch (err) {
            console.error("Error fetching smtp settings:", err);
        }
    };

    useEffect(() => {
        fetchSmtpSettings();
    }, []);

    const handleSave = async () => {
        if (!host || !user || !pass) {
            toast({ title: 'Erreur', description: 'Host, email et mot de passe sont requis.', variant: 'destructive' }); return;
        }
        setIsSaving(true);
        try {
            const { data: { user: currentUser } } = await supabase.auth.getUser();
            if (!currentUser) throw new Error("Utilisateur non connecté");

            const { error } = await supabase
                .from('smtp_settings')
                .upsert({
                    user_id: currentUser.id,
                    host,
                    port: parseInt(port) || 587,
                    username: user,
                    password: pass,
                    from_email: fromEmail || user,
                    imap_host: imapHost,
                    imap_port: parseInt(imapPort) || 993,
                    imap_enabled: imapEnabled,
                    imap_secure: imapSecure,
                }, { onConflict: 'user_id' });

            if (error) throw error;
            toast({ title: 'Configuration Email Sauvegardée', description: 'Vos paramètres SMTP et IMAP ont été enregistrés.' });
            onUpdate();
        } catch (err: any) {
            toast({ title: 'Erreur', description: err.message || 'Impossible de sauvegarder.', variant: 'destructive' });
        } finally {
            setIsSaving(false);
        }
    };

    const handleTestSmtp = async () => {
        if (!host || !user || !pass) {
            toast({ title: 'Erreur', description: 'Remplissez tous les champs SMTP avant de tester.', variant: 'destructive' }); return;
        }
        setIsTesting(true);
        const result = await testSmtpConnection(host, parseInt(port) || 587, user, pass);
        setIsTesting(false);
        if (result.ok) {
            toast({ title: '✅ Connexion SMTP réussie !', description: result.message });
            setIsTestSuccess(true);
        }
        else { toast({ title: 'Échec SMTP', description: result.message, variant: 'destructive' }); }
    };

    const handleTestImap = async () => {
        if (!imapHost || !user || !pass) {
            toast({ title: 'Erreur', description: 'Remplissez le host IMAP et vos identifiants.', variant: 'destructive' }); return;
        }
        setIsTestingImap(true);
        const result = await testImapConnection(imapHost, parseInt(imapPort) || 993, user, pass);
        setIsTestingImap(false);
        if (result.ok) {
            toast({ title: '✅ Connexion IMAP réussie !', description: result.message });
            setIsImapTestSuccess(true);
        }
        else { toast({ title: 'Échec IMAP', description: result.message, variant: 'destructive' }); }
    };

    const handleSendTestEmail = async () => {
        if (!testEmail || !testEmail.includes('@')) {
            toast({ title: 'Erreur', description: 'Email invalide', variant: 'destructive' });
            return;
        }
        setIsSendingTest(true);
        try {
            const formData = {
                smtpHost: host,
                smtpPort: port,
                smtpUser: user,
                smtpPass: pass,
                to: [{ email: testEmail, name: 'Test User' }],
                sender: { email: fromEmail || user, name: 'Prospecta' },
                subject: 'Test de configuration SMTP - Prospecta',
                htmlContent: '<h1>Félicitations !</h1><p>Votre configuration SMTP fonctionne parfaitement sur Prospecta (Prospecta Motor).</p>'
            };

            const success = await testEmailSend('smtp', formData);
            if (success && !('error' in success)) {
                toast({ title: 'Email envoyé !', description: 'Vérifiez votre boîte de réception.' });
                setTestEmail('');
            } else {
                throw new Error("Erreur d'envoi SMTP");
            }
        } catch (error: any) {
            toast({ title: 'Erreur d\'envoi', description: error.message || "Impossible d'envoyer l'email", variant: 'destructive' });
        } finally {
            setIsSendingTest(false);
        }
    };

    const confirmDelete = async () => {
        setIsDeleting(true);
        try {
            const { data: { user: currentUser } } = await supabase.auth.getUser();
            if (currentUser) {
                await supabase.from('smtp_settings').delete().eq('user_id', currentUser.id);
            }
            await deleteKey('smtp' as ApiProvider); // Delete legacy if exists
            
            setHost(''); setUser(''); setPass(''); setImapHost('');
            setIsDeleteDialogOpen(false);
            toast({ title: 'Paramètres Email Supprimés' });
            onUpdate();
        } catch (err) {
             console.error(err);
        } finally {
            setIsDeleting(false);
        }
    };

    const gmailGuide = 'https://support.google.com/accounts/answer/185833';

    return (
        <Card className="border-2 border-emerald-500/30 shadow-[0_0_15px_rgba(52,211,153,0.08)] col-span-1 md:col-span-2">
            <CardHeader className="pb-3 bg-emerald-500/5 rounded-t-lg">
                <div className="flex justify-between items-start">
                    <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-xl bg-emerald-500 flex items-center justify-center">
                            <Mail size={20} className="text-white" />
                        </div>
                        <div>
                            <CardTitle className="text-lg flex items-center gap-2">
                                Configuration Email (SMTP & IMAP)
                                <Badge className="bg-emerald-500 text-white text-[10px] h-5">Recommandé</Badge>
                            </CardTitle>
                            <CardDescription className="text-xs">Envoyez via SMTP et recevez vos réponses via IMAP (Gmail, Outlook, etc.)</CardDescription>
                        </div>
                    </div>
                </div>
            </CardHeader>
            <CardContent className="space-y-6 pt-4">
                {/* SMTP SECTION */}
                <div className="space-y-4">
                    <div className="flex items-center gap-2 text-emerald-600 font-semibold text-sm">
                        <MailCheck size={16} /> Configuration Envoi (SMTP)
                    </div>
                    
                    <div className="grid grid-cols-4 gap-4">
                        <div className="col-span-3 space-y-1">
                            <Label className="text-xs font-semibold">Serveur SMTP (Host)</Label>
                            <Input placeholder="smtp.gmail.com" value={host} onChange={e => setHost(e.target.value)} className="bg-slate-50 dark:bg-slate-900 font-mono text-sm" />
                        </div>
                        <div className="space-y-1">
                            <Label className="text-xs font-semibold">Port</Label>
                            <Input placeholder="587" value={port} onChange={e => setPort(e.target.value)} className="bg-slate-50 dark:bg-slate-900 font-mono text-sm" />
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1">
                            <Label className="text-xs font-semibold">Email / Utilisateur</Label>
                            <Input type="email" placeholder="votre@gmail.com" value={user} onChange={e => setUser(e.target.value)} className="bg-slate-50 dark:bg-slate-900 text-sm" />
                        </div>
                        <div className="space-y-1">
                            <Label className="text-xs font-semibold">Nom d'expéditeur (Optionnel)</Label>
                            <Input placeholder="Votre Nom ou Société" value={fromEmail} onChange={e => setFromEmail(e.target.value)} className="bg-slate-50 dark:bg-slate-900 text-sm" />
                        </div>
                    </div>

                    <div className="space-y-1">
                        <div className="flex justify-between">
                            <Label className="text-xs font-semibold">Mot de passe / App Password</Label>
                            <a href={gmailGuide} target="_blank" rel="noopener noreferrer" className="text-[10px] text-emerald-600 hover:underline flex items-center">Guide Gmail <ExternalLink className="w-3 h-3 ml-1" /></a>
                        </div>
                        <div className="relative">
                            <Input type={showPass ? 'text' : 'password'} placeholder="••••••••••••" value={pass} onChange={e => setPass(e.target.value)} className="pr-10 bg-slate-50 dark:bg-slate-900 font-mono text-sm" />
                            <Button type="button" variant="ghost" size="icon" className="absolute right-0 top-0 h-full px-3" onClick={() => setShowPass(!showPass)}>
                                {showPass ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                            </Button>
                        </div>
                    </div>
                    
                    <div className="flex gap-2">
                         <Button variant="outline" size="sm" className="w-full text-xs" onClick={handleTestSmtp} disabled={isTesting || !host}>
                            {isTesting ? <RefreshCw className="w-3 h-3 mr-2 animate-spin" /> : <ShieldCheck className="w-3 h-3 mr-2" />}
                            Tester SMTP
                        </Button>
                    </div>
                </div>

                <div className="h-px bg-slate-200 dark:bg-slate-800" />

                {/* IMAP SECTION */}
                <div className="space-y-4">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 text-blue-600 font-semibold text-sm">
                            <Settings2 size={16} /> Configuration Réception (IMAP)
                        </div>
                        <div className="flex items-center gap-2">
                            <span className="text-[10px] text-muted-foreground">{imapEnabled ? 'Activé' : 'Désactivé'}</span>
                            <Switch checked={imapEnabled} onCheckedChange={setImapEnabled} />
                        </div>
                    </div>

                    {imapEnabled && (
                        <div className="space-y-4 animate-in fade-in slide-in-from-top-2 duration-300">
                            <div className="grid grid-cols-4 gap-4">
                                <div className="col-span-3 space-y-1">
                                    <Label className="text-xs font-semibold">Serveur IMAP (Host)</Label>
                                    <Input placeholder="imap.gmail.com" value={imapHost} onChange={e => setImapHost(e.target.value)} className="bg-slate-50 dark:bg-slate-900 font-mono text-sm" />
                                </div>
                                <div className="space-y-1">
                                    <Label className="text-xs font-semibold">Port</Label>
                                    <Input placeholder="993" value={imapPort} onChange={e => setImapPort(e.target.value)} className="bg-slate-50 dark:bg-slate-900 font-mono text-sm" />
                                </div>
                            </div>
                            
                            <div className="flex items-center gap-4">
                                <div className="flex items-center gap-2">
                                    <Switch id="imap-secure" checked={imapSecure} onCheckedChange={setImapSecure} />
                                    <Label htmlFor="imap-secure" className="text-xs">Connexion Sécurisée (SSL/TLS)</Label>
                                </div>
                            </div>

                            <div className="flex gap-2">
                                <Button variant="outline" size="sm" className="w-full text-xs" onClick={handleTestImap} disabled={isTestingImap || !imapHost}>
                                    {isTestingImap ? <RefreshCw className="w-3 h-3 mr-2 animate-spin" /> : <MailCheck className="w-3 h-3 mr-2" />}
                                    Tester IMAP
                                </Button>
                            </div>
                            
                            <Alert className="bg-blue-50/50 dark:bg-blue-900/10 border-blue-200 dark:border-blue-800">
                                <AlertTriangle className="h-3 w-3 text-blue-600" />
                                <AlertDescription className="text-[10px] text-blue-700 dark:text-blue-300">
                                    L'activation de l'IMAP permet à Prospecta de lire vos réponses reçues et de les afficher dans l'Inbox.
                                </AlertDescription>
                            </Alert>
                        </div>
                    )}
                </div>

                {isTestSuccess && (
                    <div className="pt-4 border-t border-slate-200 dark:border-slate-800 animate-in fade-in slide-in-from-top-2 duration-300">
                        <Label className="text-xs mb-2 block font-semibold text-emerald-600 dark:text-emerald-400">Envoyer un email de test</Label>
                        <div className="flex gap-2">
                            <Input
                                placeholder="Email de destination..."
                                value={testEmail}
                                onChange={(e) => setTestEmail(e.target.value)}
                                className="flex-1 text-sm bg-slate-50 dark:bg-slate-900"
                            />
                            <Button
                                variant="secondary"
                                onClick={handleSendTestEmail}
                                disabled={isSendingTest || !testEmail}
                                className="whitespace-nowrap font-medium text-xs"
                            >
                                {isSendingTest ? <RefreshCw className="w-3 h-3 animate-spin mr-2" /> : null}
                                Envoyer
                            </Button>
                        </div>
                    </div>
                )}
            </CardContent>
            <CardFooter className="bg-slate-50 dark:bg-slate-900/50 flex justify-between rounded-b-lg border-t px-6 py-4">
                <div />
                <div className="flex gap-2">
                    <Button variant="ghost" size="sm" onClick={() => setIsDeleteDialogOpen(true)} disabled={isDeleting} className="text-destructive hover:bg-destructive/10">Supprimer</Button>
                    <Button size="sm" onClick={handleSave} disabled={isSaving || !host} className="bg-emerald-600 hover:bg-emerald-700 text-white min-w-[120px]">
                        {isSaving ? <RefreshCw className="w-3 h-3 animate-spin mr-2" /> : <Save size={16} className="mr-2" />}
                        Sauvegarder
                    </Button>
                </div>
            </CardFooter>

            <ConfirmDialog
                isOpen={isDeleteDialogOpen}
                onOpenChange={setIsDeleteDialogOpen}
                onConfirm={confirmDelete}
                title="Supprimer la configuration Email ?"
                description="Êtes-vous sûr de vouloir supprimer ces paramètres ? Vos campagnes et votre Inbox ne seront plus synchronisées."
                confirmText="Supprimer"
            />
        </Card>
    );
};

const ApiKeyCard = ({ providerConfig, existingKey, onUpdate }: { providerConfig: any, existingKey?: ApiKey, onUpdate: () => void }) => {
    const { saveKey, testKey, deleteKey } = useApiKeys();
    const { toast } = useToast();
    const [apiKey, setApiKey] = useState(existingKey?.api_key || '');
    const [apiSecret, setApiSecret] = useState(existingKey?.api_secret || '');
    const [label, setLabel] = useState(existingKey?.label || providerConfig.name);
    const [showKey, setShowKey] = useState(false);
    const [showSecret, setShowSecret] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [isTesting, setIsTesting] = useState(false);
    const [isDeleting, setIsDeleting] = useState(false);
    const [testEmail, setTestEmail] = useState('');

    useEffect(() => {
        setApiKey(existingKey?.api_key || '');
        setApiSecret(existingKey?.api_secret || '');
        setLabel(existingKey?.label || providerConfig.name);
    }, [existingKey, providerConfig.name]);

    const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);

    const handleSave = async () => {
        if (!apiKey.trim()) {
            toast({ title: "Erreur", description: "La clé API ne peut pas être vide.", variant: "destructive" });
            return;
        }
        setIsSaving(true);
        const success = await saveKey(providerConfig.id, apiKey, label, apiSecret);
        setIsSaving(false);

        if (success) {
            toast({ title: "Succès", description: `Clé ${providerConfig.name} sauvegardée avec succès.` });
            onUpdate();
        } else {
            toast({ title: "Erreur", description: "Impossible de sauvegarder la clé. Vérifiez si les tables de base de données ont été créées via SQL Editor.", variant: "destructive" });
        }
    };

    const handleTest = async () => {
        setIsTesting(true);

        // Regular API test
        const result = await testKey(providerConfig.id);
        if (result.ok) {
            toast({ title: "Test réussi", description: result.message });
        } else {
            toast({ title: "Échec du test", description: result.message, variant: "destructive" });
        }

        setIsTesting(false);
        onUpdate();
    };

    const handleDelete = async () => {
        setIsDeleteDialogOpen(true);
    };

    const confirmDelete = async () => {
        setIsDeleting(true);
        const success = await deleteKey(providerConfig.id);
        setIsDeleting(false);
        setIsDeleteDialogOpen(false);

        if (success) {
            toast({ title: "Supprimée", description: "Clé API supprimée avec succès." });
            setApiKey('');
            setApiSecret('');
            onUpdate();
        }
    };

    return (
        <Card className={`border ${providerConfig.required && !existingKey ? 'border-destructive/50 shadow-[0_0_10px_rgba(239,68,68,0.1)]' : 'border-slate-200 dark:border-slate-800'}`}>
            <CardHeader className="pb-3">
                <div className="flex justify-between items-start">
                    <div className="flex items-center gap-2">
                        <span className="text-2xl">{providerConfig.icon}</span>
                        <div>
                            <CardTitle className="text-lg flex items-center gap-2">
                                {providerConfig.name}
                                {providerConfig.required && !existingKey && (
                                    <Badge variant="destructive" className="text-[10px] h-5">Requis</Badge>
                                )}
                            </CardTitle>
                            <CardDescription className="text-xs">{providerConfig.description}</CardDescription>
                        </div>
                    </div>
                    {existingKey && (
                        <Badge variant={
                            existingKey.last_test_status === 'success' ? 'default' :
                                existingKey.last_test_status === 'failed' ? 'destructive' : 'secondary'
                        } className="ml-auto">
                            {existingKey.last_test_status === 'success' && <CheckCircle2 className="w-3 h-3 mr-1" />}
                            {existingKey.last_test_status === 'failed' && <XCircle className="w-3 h-3 mr-1" />}
                            {existingKey.last_test_status === 'pending' && <Clock className="w-3 h-3 mr-1" />}
                            {existingKey.last_test_status === 'success' ? 'Connecté' :
                                existingKey.last_test_status === 'failed' ? 'Échec' : 'Non testé'}
                        </Badge>
                    )}
                </div>
            </CardHeader>
            <CardContent className="space-y-4">
                <div className="space-y-2">
                    <div className="flex justify-between">
                        <Label className="text-xs font-semibold">{providerConfig.keyLabel}</Label>
                        <a href={providerConfig.docsUrl} target="_blank" rel="noopener noreferrer" className="text-[10px] text-accent hover:underline flex items-center">
                            Obtenir ma clé <ExternalLink className="w-3 h-3 ml-1" />
                        </a>
                    </div>
                    <div className="relative">
                        <Input
                            type={showKey ? "text" : "password"}
                            placeholder={providerConfig.keyPlaceholder}
                            value={apiKey}
                            onChange={(e) => setApiKey(e.target.value)}
                            className="pr-10 bg-slate-50 dark:bg-slate-900 font-mono text-sm"
                        />
                        <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="absolute right-0 top-0 h-full px-3 text-slate-400 hover:text-slate-600"
                            onClick={() => setShowKey(!showKey)}
                        >
                            {showKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </Button>
                    </div>
                </div>

                {providerConfig.hasSecret && (
                    <div className="space-y-2">
                        <Label className="text-xs font-semibold">{providerConfig.secretLabel}</Label>
                        <div className="relative">
                            <Input
                                type={showSecret ? "text" : "password"}
                                value={apiSecret}
                                onChange={(e) => setApiSecret(e.target.value)}
                                className="pr-10 bg-slate-50 dark:bg-slate-900 font-mono text-sm"
                            />
                            <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                className="absolute right-0 top-0 h-full px-3 text-slate-400 hover:text-slate-600"
                                onClick={() => setShowSecret(!showSecret)}
                            >
                                {showSecret ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                            </Button>
                        </div>
                    </div>
                )}
            </CardContent>
            <CardFooter className="bg-slate-50 dark:bg-slate-900/50 flex justify-between rounded-b-lg border-t border-slate-100 dark:border-slate-800 px-6 py-4">
                {existingKey?.last_tested_at ? (
                    <div className="text-[10px] text-slate-500">
                        Testé le {new Date(existingKey.last_tested_at).toLocaleDateString()}
                    </div>
                ) : <div />}
                <div className="flex gap-2">
                    {existingKey && (
                        <>
                            <Button variant="ghost" size="sm" onClick={handleDelete} disabled={isDeleting} className="text-destructive hover:bg-destructive/10">
                                Supprimer
                            </Button>
                            <Button variant="outline" size="sm" onClick={handleTest} disabled={isTesting || !apiKey}>
                                {isTesting ? <LoadingLogo className="h-4 w-4 animate-spin" /> : 'Tester'}
                            </Button>
                        </>
                    )}
                    <Button variant="default" size="sm" onClick={handleSave} disabled={isSaving || !apiKey} className="bg-accent hover:bg-accent/90">
                        {isSaving ? <LoadingLogo className="mr-2 h-4 w-4 animate-spin" /> : null}
                        Sauvegarder
                    </Button>
                </div>
            </CardFooter>

            <ConfirmDialog
                isOpen={isDeleteDialogOpen}
                onOpenChange={setIsDeleteDialogOpen}
                onConfirm={confirmDelete}
                title={`Supprimer la clé ${providerConfig.name} ?`}
                description={`Cette action supprimera votre clé ${providerConfig.name} de nos serveurs. Vous devrez la rajouter pour réactiver les fonctionnalités liées à ce service.`}
                confirmText="Supprimer la clé"
            />
        </Card>
    );
};

// ---- AI Model Configuration Card ----
const AI_MODEL_PROVIDERS = [
    {
        id: 'openai',
        name: 'OpenAI',
        icon: <img src="/chatgpt-logo.png" className="w-4 h-4 object-contain" alt="OpenAI" />,
        description: 'Solution standard puissante',
        baseUrl: 'https://api.openai.com/v1',
        models: [
            { id: 'gpt-4o-mini', name: 'GPT-4o Mini (Éco)', paid: true },
            { id: 'gpt-4o', name: 'GPT-4o (Premium)', paid: true }
        ],
        docsUrl: 'https://platform.openai.com/api-keys'
    },
    {
        id: 'openrouter',
        name: 'OpenRouter',
        icon: <img src="/openrouter-logo.png" className="w-4 h-4 object-contain" alt="OpenRouter" />,
        description: 'Accédez à tous les modèles (Gemini, Claude, etc.)',
        baseUrl: 'https://openrouter.ai/api/v1',
        models: [
            { id: 'google/gemini-2.0-flash-exp:free', name: 'Gemini 2.0 Flash', free: true },
            { id: 'deepseek/deepseek-r1:free', name: 'DeepSeek R1', free: true },
            { id: 'mistralai/mistral-7b-instruct:free', name: 'Mistral 7B', free: true },
            { id: 'anthropic/claude-3.5-sonnet', name: 'Claude 3.5 Sonnet', paid: true }
        ],
        docsUrl: 'https://openrouter.ai/keys'
    },
    {
        id: 'gemini',
        name: 'Google Gemini',
        icon: <img src="/gemini-logo.png" className="w-4 h-4 object-contain" alt="Gemini" />,
        description: 'Modèles Google via API directe',
        baseUrl: 'https://generativelanguage.googleapis.com/v1beta/openai',
        models: [
            { id: 'gemini-1.5-flash', name: 'Gemini 1.5 Flash', free: true },
            { id: 'gemini-1.5-pro', name: 'Gemini 1.5 Pro', free: true }
        ],
        docsUrl: 'https://aistudio.google.com/app/apikey'
    },
    {
        id: 'groq',
        name: 'Groq',
        icon: <img src="/grok-logo.png" className="w-5 h-5 object-contain" alt="Groq" />,
        description: 'Ultra-rapide, Llama 3 & Mixtral',
        baseUrl: 'https://api.groq.com/openai/v1',
        models: [
            { id: 'llama-3.3-70b-versatile', name: 'Llama 3.3 70B', free: true },
            { id: 'mixtral-8x7b-32768', name: 'Mixtral 8x7B', free: true }
        ],
        docsUrl: 'https://console.groq.com/keys'
    },
    {
        id: 'anthropic',
        name: 'Anthropic Claude',
        icon: <img src="/claud-logo.png" className="w-4 h-4 object-contain" alt="Claude" />,
        description: 'Intelligence supérieure, raisonnement complexe',
        baseUrl: 'https://api.anthropic.com/v1',
        models: [
            { id: 'claude-3-5-sonnet-20240620', name: 'Claude 3.5 Sonnet', paid: true },
            { id: 'claude-3-haiku-20240307', name: 'Claude 3 Haiku', paid: true }
        ],
        docsUrl: 'https://console.anthropic.com/settings/keys'
    }
];

const AiModelCard = ({ existingKey, onUpdate }: { existingKey?: ApiKey, onUpdate: () => void }) => {
    const { saveKey, testKey, deleteKey } = useApiKeys();
    const { toast } = useToast();

    const parseConfig = (raw?: string) => {
        if (!raw) return { provider: 'openai', model: 'gpt-4o-mini', apiKey: '', baseUrl: '' };
        if (!raw.startsWith('{')) return { provider: 'openai', model: 'gpt-4o-mini', apiKey: raw, baseUrl: 'https://api.openai.com/v1' };
        try { return JSON.parse(raw); } catch { return { provider: 'openai', model: 'gpt-4o-mini', apiKey: raw, baseUrl: '' }; }
    };

    const config = parseConfig(existingKey?.api_key);
    const [providerId, setProviderId] = useState(config.provider || 'openai');
    const [modelId, setModelId] = useState(config.model || 'gpt-4o-mini');
    const [apiKey, setApiKey] = useState(config.apiKey || '');
    const [showKey, setShowKey] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [isTesting, setIsTesting] = useState(false);
    const [isDeleting, setIsDeleting] = useState(false);
    const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);

    const provider = AI_MODEL_PROVIDERS.find(p => p.id === providerId) || AI_MODEL_PROVIDERS[0];

    useEffect(() => {
        // Keep model valid when provider changes
        if (!provider.models.find(m => m.id === modelId)) {
            setModelId(provider.models[0].id);
        }
    }, [providerId]);

    const handleSave = async () => {
        if (!apiKey.trim()) {
            toast({ title: "Erreur", description: "La clé API est requise.", variant: "destructive" });
            return;
        }
        setIsSaving(true);
        const fullConfig = JSON.stringify({
            provider: providerId,
            model: modelId,
            apiKey: apiKey,
            baseUrl: provider.baseUrl
        });
        const success = await saveKey('openai' as ApiProvider, fullConfig, `AI: ${provider.name} - ${modelId}`);
        setIsSaving(false);

        if (success) {
            toast({ title: "Modèle IA Configuré", description: `Utilisation de ${modelId} via ${provider.name}.` });
            onUpdate();
        }
    };

    const handleTest = async () => {
        if (!apiKey.trim()) {
            toast({ title: "Erreur", description: "Veuillez entrer une clé API pour tester.", variant: "destructive" });
            return;
        }
        
        setIsTesting(true);
        try {
            // Temporarily save to test with the latest values even if not saved to DB
            const fullConfig = JSON.stringify({
                provider: providerId,
                model: modelId,
                apiKey: apiKey,
                baseUrl: provider.baseUrl
            });
            
            // We need to save it first because testKey reads from DB
            await saveKey('openai' as ApiProvider, fullConfig, `AI: ${provider.name} - ${modelId}`);
            
            const result = await testKey('openai' as ApiProvider);
            
            if (result.ok) {
                toast({ title: "✅ Test réussi !", description: result.message });
            } else {
                toast({ title: "❌ Échec du test", description: result.message, variant: "destructive" });
            }
        } catch (error: any) {
            console.error("Test error:", error);
            toast({ title: "❌ Erreur imprévue", description: error.message || "Une erreur est survenue lors du test.", variant: "destructive" });
        } finally {
            setIsTesting(false);
            onUpdate();
        }
    };

    const handleDelete = async () => {
        setIsDeleteDialogOpen(true);
    };

    const confirmDelete = async () => {
        setIsDeleting(true);
        await deleteKey('openai' as ApiProvider);
        setIsDeleting(false);
        setIsDeleteDialogOpen(false);
        setApiKey('');
        onUpdate();
        toast({ title: "Configuration IA réinitialisée" });
    };

    return (
        <Card className="border-2 border-accent/30 shadow-[0_0_15px_rgba(var(--accent-rgb),0.08)] col-span-1 md:col-span-2">
            <CardHeader className="pb-3 bg-accent/5 rounded-t-lg">
                <div className="flex justify-between items-start">
                    <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-xl bg-accent flex items-center justify-center">
                            <Brain size={20} className="text-white" />
                        </div>
                        <div>
                            <CardTitle className="text-lg flex items-center gap-2">
                                Assistant IA & Modèles
                                <Badge className="bg-accent text-white text-[10px] h-5">Intelligence</Badge>
                            </CardTitle>
                            <CardDescription className="text-xs">Choisissez votre fournisseur LLM et votre modèle préféré</CardDescription>
                        </div>
                    </div>
                </div>
            </CardHeader>
            <CardContent className="space-y-6 pt-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                        <Label className="text-xs font-semibold">Fournisseur d'IA</Label>
                        <Select value={providerId} onValueChange={setProviderId}>
                            <SelectTrigger className="bg-slate-50 dark:bg-slate-900">
                                <SelectValue placeholder="Choisir un fournisseur" />
                            </SelectTrigger>
                            <SelectContent>
                                {AI_MODEL_PROVIDERS.map(p => (
                                    <SelectItem key={p.id} value={p.id}>
                                        <div className="flex items-center gap-2">
                                            {p.icon}
                                            <span className="font-medium">{p.name}</span>
                                        </div>
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    <div className="space-y-2">
                        <Label className="text-xs font-semibold">Modèle sélectionné</Label>
                        <Select value={modelId} onValueChange={setModelId}>
                            <SelectTrigger className="bg-slate-50 dark:bg-slate-900 font-mono text-xs">
                                <SelectValue placeholder="Choisir un modèle" />
                            </SelectTrigger>
                            <SelectContent>
                                {provider.models.map(m => (
                                    <SelectItem key={m.id} value={m.id}>
                                        <div className="flex items-center justify-between w-full gap-4">
                                            <span className="text-xs">{m.name}</span>
                                            {m.free ? (
                                                <Badge className="bg-emerald-500/10 text-emerald-600 border-none text-[9px] h-4">GRATUIT</Badge>
                                            ) : (
                                                <span className="text-[9px] opacity-50 uppercase tracking-tighter">Premium</span>
                                            )}
                                        </div>
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                </div>

                <div className="space-y-2">
                    <div className="flex justify-between">
                        <Label className="text-xs font-semibold">Clé API {provider.name}</Label>
                        <a href={provider.docsUrl} target="_blank" rel="noopener noreferrer" className="text-[10px] text-accent hover:underline flex items-center">
                            Obtenir une clé <ExternalLink className="w-3 h-3 ml-1" />
                        </a>
                    </div>
                    <div className="relative">
                        <Input
                            type={showKey ? "text" : "password"}
                            placeholder={`Coller votre clé API ${provider.name} ici...`}
                            value={apiKey}
                            onChange={(e) => setApiKey(e.target.value)}
                            className="pr-10 bg-slate-50 dark:bg-slate-900 font-mono text-sm"
                        />
                        <Button type="button" variant="ghost" size="icon" className="absolute right-0 top-0 h-full px-3" onClick={() => setShowKey(!showKey)}>
                            {showKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </Button>
                    </div>
                </div>

                <div className="bg-accent/5 p-3 rounded-lg border border-accent/10 text-[11px] text-muted-foreground leading-relaxed">
                    <p className="font-medium text-accent mb-1 flex items-center gap-1">
                        <Sparkles size={11} /> Astuce :
                    </p>
                    {providerId === 'openrouter' 
                        ? "OpenRouter vous permet d'utiliser des modèles gratuits (Gemini Flash, DeepSeek) sans CB." 
                        : providerId === 'gemini' 
                        ? "L'API Gemini est gratuite jusqu'à un certain quota par minute." 
                        : "Utilisez un modèle léger comme GPT-4o Mini pour un coût quasi nul."
                    }
                </div>
            </CardContent>
            <CardFooter className="bg-slate-50 dark:bg-slate-900/50 flex justify-between rounded-b-lg border-t px-6 py-4">
                {existingKey ? (
                    <div className="flex gap-2">
                        <Button variant="ghost" size="sm" onClick={handleDelete} disabled={isDeleting} className="text-destructive hover:bg-destructive/10">Réinitialiser</Button>
                        <Button variant="outline" size="sm" onClick={handleTest} disabled={isTesting || !apiKey}>
                            {isTesting ? <LoadingLogo size="sm" /> : null} Tester la configuration
                        </Button>
                    </div>
                ) : <div />}
                <Button size="sm" onClick={handleSave} disabled={isSaving || !apiKey} className="bg-accent hover:bg-accent/90 text-white">
                    {isSaving ? <LoadingLogo size="sm" /> : null} Sauvegarder la configuration
                </Button>
            </CardFooter>

            <ConfirmDialog
                isOpen={isDeleteDialogOpen}
                onOpenChange={setIsDeleteDialogOpen}
                onConfirm={confirmDelete}
                title="Supprimer la configuration IA ?"
                description="L'intelligence artificielle sera désactivée tant qu'une nouvelle clé n'est pas configurée."
                confirmText="Supprimer"
            />
        </Card>
    );
};

export const ApiKeysSettings = () => {
    const { getKeys } = useApiKeys();
    const [keys, setKeys] = useState<ApiKey[]>([]);
    const [loading, setLoading] = useState(true);

    const fetchKeys = async () => {
        setLoading(true);
        const fetchedKeys = await getKeys();
        setKeys(fetchedKeys);
        setLoading(false);
    };

    useEffect(() => {
        fetchKeys();
    }, []);

    const hasSmtpKey = keys.some(k => k.provider === 'smtp' && k.is_active);

    return (
        <div className="space-y-6">
            <div className="mb-6">
                <h2 className="text-xl font-bold flex items-center gap-2">
                    <Key className="w-5 h-5 text-accent" />
                    Mes clés API & Intégrations
                </h2>
                <p className="text-sm text-muted-foreground mt-1">
                    Vos clés sont stockées de manière sécurisée et liées à votre compte de façon chiffrée. Elles ne sont jamais partagées.
                </p>
            </div>

            {!hasSmtpKey && !loading && (
                <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 text-amber-800 dark:text-amber-300 p-4 rounded-lg flex gap-3 items-start animate-in fade-in">
                    <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5" />
                    <div>
                        <h4 className="font-semibold text-sm">Configuration SMTP requise pour les campagnes</h4>
                        <p className="text-sm mt-1 opacity-90">
                            Configurez SMTP (Gmail, OVH…) pour envoyer vos campagnes email.
                        </p>
                    </div>
                </div>
            )}

            {loading ? (
                <div className="flex justify-center p-12">
                    <LoadingLogo size="md" message="Chargement..." />
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <SmtpCard
                        existingConfig={keys.find(k => k.provider === 'smtp')}
                        onUpdate={fetchKeys}
                    />
                    <AiModelCard 
                        existingKey={keys.find(k => k.provider === 'openai')}
                        onUpdate={fetchKeys}
                    />
                    {PROVIDERS_CONFIG.map((config) => (
                        <ApiKeyCard
                            key={config.id}
                            providerConfig={config}
                            existingKey={keys.find(k => k.provider === config.id)}
                            onUpdate={fetchKeys}
                        />
                    ))}
                    <MaintenanceCard />
                </div>
            )}
        </div>
    );
};
