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
import { Eye, EyeOff, ExternalLink, CheckCircle2, XCircle, Clock, AlertTriangle, Key, Server, Trash2 } from 'lucide-react';
import { LoadingLogo } from '@/components/LoadingLogo';
import { ConfirmDialog } from './ConfirmDialog';
import { testEmailSend, testSmtpConnection } from '@/services/emailService';

const PROVIDERS_CONFIG = [
    {
        id: 'openai' as ApiProvider,
        name: 'OpenAI',
        icon: '🤖',
        description: 'Moteur de l\'assistant IA et génération de contenu email',
        keyLabel: 'Clé API OpenAI',
        keyPlaceholder: 'sk-...',
        docsUrl: 'https://platform.openai.com/api-keys',
        required: false,
    },
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

// ---- SMTP Configuration Card ----
const SmtpCard = ({ existingConfig, onUpdate }: { existingConfig?: ApiKey; onUpdate: () => void }) => {
    const { saveKey, deleteKey } = useApiKeys();
    const { toast } = useToast();

    const parseSmtp = (raw?: string) => {
        if (!raw) return { host: '', port: '587', user: '', pass: '' };
        try { return JSON.parse(raw); } catch { return { host: raw, port: '587', user: '', pass: '' }; }
    };

    const saved = parseSmtp(existingConfig?.api_key);
    const [host, setHost] = useState(saved.host || '');
    const [port, setPort] = useState(String(saved.port || '587'));
    const [user, setUser] = useState(saved.user || '');
    const [pass, setPass] = useState(saved.pass || '');
    const [showPass, setShowPass] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [isTesting, setIsTesting] = useState(false);
    const [isDeleting, setIsDeleting] = useState(false);
    const [testEmail, setTestEmail] = useState('');
    const [isSendingTest, setIsSendingTest] = useState(false);
    const [isTestSuccess, setIsTestSuccess] = useState(existingConfig?.last_test_status === 'success');
    const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);

    useEffect(() => {
        const s = parseSmtp(existingConfig?.api_key);
        setHost(s.host || ''); setPort(String(s.port || '587')); setUser(s.user || ''); setPass(s.pass || '');
        // Only set the initial DB test success status if we don't already have one locally
        setIsTestSuccess((prev) => prev || existingConfig?.last_test_status === 'success');
    }, [existingConfig]);

    // Reset test success if credentials changed
    useEffect(() => {
        setIsTestSuccess(false);
    }, [host, port, user, pass]);

    const handleSave = async () => {
        if (!host || !user || !pass) {
            toast({ title: 'Erreur', description: 'Host, email et mot de passe sont requis.', variant: 'destructive' }); return;
        }
        setIsSaving(true);
        const cfg = JSON.stringify({ host, port: parseInt(port) || 587, user, pass });
        const ok = await saveKey('smtp' as ApiProvider, cfg, 'Serveur SMTP');
        setIsSaving(false);
        if (ok) { toast({ title: 'SMTP Sauvegardé', description: 'Configuration SMTP enregistrée.' }); onUpdate(); }
        else { toast({ title: 'Erreur', description: 'Impossible de sauvegarder.', variant: 'destructive' }); }
    };

    const handleTest = async () => {
        if (!host || !user || !pass) {
            toast({ title: 'Erreur', description: 'Remplissez tous les champs avant de tester.', variant: 'destructive' }); return;
        }
        setIsTesting(true);
        const result = await testSmtpConnection(host, parseInt(port) || 587, user, pass);
        setIsTesting(false);
        if (result.ok) {
            toast({ title: '✅ Connexion SMTP réussie !', description: result.message });
            setIsTestSuccess(true);
        }
        else { toast({ title: 'Échec SMTP', description: result.message, variant: 'destructive' }); }
        // Note: Do NOT call onUpdate() here. Testing a connection doesn't save it to DB,
        // and calling onUpdate() triggers a parent re-render that might destroy our local isTestSuccess state.
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
                sender: { email: existingConfig?.api_key ? parseSmtp(existingConfig.api_key).user : user, name: 'Prospecta AI' },
                subject: 'Test de configuration SMTP - Prospecta',
                htmlContent: '<h1>Félicitations !</h1><p>Votre configuration SMTP fonctionne parfaitement sur Prospecta AI.</p>'
            };

            // Re-use testEmailSend but pass the smtp id since it now handles both internally given the provider logic
            const success = await testEmailSend('smtp', formData);
            if (success) {
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

    const handleDelete = async () => {
        setIsDeleteDialogOpen(true);
    };

    const confirmDelete = async () => {
        setIsDeleting(true);
        await deleteKey('smtp' as ApiProvider);
        setIsDeleting(false);
        setHost(''); setUser(''); setPass('');
        setIsDeleteDialogOpen(false);
        toast({ title: 'SMTP Supprimé' }); onUpdate();
    };

    const gmailGuide = 'https://support.google.com/accounts/answer/185833';

    return (
        <Card className="border-2 border-emerald-500/30 shadow-[0_0_15px_rgba(52,211,153,0.08)] col-span-1 md:col-span-2">
            <CardHeader className="pb-3 bg-emerald-500/5 rounded-t-lg">
                <div className="flex justify-between items-start">
                    <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-xl bg-emerald-500 flex items-center justify-center">
                            <Server size={20} className="text-white" />
                        </div>
                        <div>
                            <CardTitle className="text-lg flex items-center gap-2">
                                Email SMTP (Sans API)
                                <Badge className="bg-emerald-500 text-white text-[10px] h-5">Recommandé</Badge>
                            </CardTitle>
                            <CardDescription className="text-xs">Envoyez via Gmail, OVH, ou votre propre serveur — 0 API, tracking d'ouverture inclus</CardDescription>
                        </div>
                    </div>
                    {existingConfig && (
                        <Badge variant={existingConfig.last_test_status === 'success' ? 'default' : 'secondary'}>
                            {existingConfig.last_test_status === 'success' ? <><CheckCircle2 className="w-3 h-3 mr-1" />Connecté</> : 'Non testé'}
                        </Badge>
                    )}
                </div>
            </CardHeader>
            <CardContent className="space-y-4 pt-4">
                <div className="grid grid-cols-3 gap-4">
                    <div className="col-span-2 space-y-1">
                        <Label className="text-xs font-semibold">Serveur SMTP (Host)</Label>
                        <Input placeholder="smtp.gmail.com" value={host} onChange={e => setHost(e.target.value)} className="bg-slate-50 dark:bg-slate-900 font-mono text-sm" />
                    </div>
                    <div className="space-y-1">
                        <Label className="text-xs font-semibold">Port</Label>
                        <Input placeholder="587" value={port} onChange={e => setPort(e.target.value)} className="bg-slate-50 dark:bg-slate-900 font-mono text-sm" />
                    </div>
                </div>
                <div className="space-y-1">
                    <Label className="text-xs font-semibold">Email (utilisateur)</Label>
                    <Input type="email" placeholder="votre@gmail.com" value={user} onChange={e => setUser(e.target.value)} className="bg-slate-50 dark:bg-slate-900 text-sm" />
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
                <div className="bg-blue-50 dark:bg-blue-950/30 p-3 rounded-lg border border-blue-100 dark:border-blue-900 text-[11px] text-blue-700 dark:text-blue-300">
                    <strong>Gmail :</strong> Activez la 2FA, puis créez un "Mot de passe d'application" (App Password). Utilisez ce mot de passe ici, pas votre mot de passe habituel.
                </div>

                <Accordion type="single" collapsible className="w-full">
                    <AccordionItem value="guide" className="border-none">
                        <AccordionTrigger className="text-sm font-semibold py-2 hover:no-underline">
                            Guide de Connexion — Comment obtenir votre mot de passe ?
                        </AccordionTrigger>
                        <AccordionContent className="text-sm space-y-4 pt-1">
                            <div>
                                <p className="font-medium text-foreground mb-2">Gmail / Google Workspace</p>
                                <ol className="list-decimal list-inside space-y-1 text-muted-foreground">
                                    <li>Allez dans <a href="https://myaccount.google.com/security" target="_blank" rel="noopener noreferrer" className="text-emerald-600 dark:text-emerald-400 underline">Sécurité Google</a>.</li>
                                    <li>Activez la &quot;Validation en 2 étapes&quot; si ce n&apos;est pas fait.</li>
                                    <li>Cherchez &quot;Mots de passe d&apos;application&quot; dans la barre de recherche.</li>
                                    <li>Créez-en un nom &quot;Prospecta&quot; et copiez le code à 16 caractères.</li>
                                </ol>
                                <Alert className="mt-2 bg-slate-50 dark:bg-slate-900/50 border-slate-200 dark:border-slate-800">
                                    <AlertTitle className="text-xs">Host &amp; Port</AlertTitle>
                                    <AlertDescription className="text-xs">Host: smtp.gmail.com — Port: 587 (TLS)</AlertDescription>
                                </Alert>
                            </div>
                            <div>
                                <p className="font-medium text-foreground mb-2">Outlook / Hotmail</p>
                                <ol className="list-decimal list-inside space-y-1 text-muted-foreground">
                                    <li>Allez dans les paramètres de sécurité Microsoft.</li>
                                    <li>Si &quot;2FA&quot; est actif, créez un mot de passe d&apos;application.</li>
                                    <li>Sinon, utilisez votre mot de passe habituel.</li>
                                </ol>
                                <Alert className="mt-2 bg-slate-50 dark:bg-slate-900/50 border-slate-200 dark:border-slate-800">
                                    <AlertTitle className="text-xs">Host &amp; Port</AlertTitle>
                                    <AlertDescription className="text-xs">Host: smtp-mail.outlook.com — Port: 587</AlertDescription>
                                </Alert>
                            </div>
                        </AccordionContent>
                    </AccordionItem>
                </Accordion>

                {isTestSuccess && (
                    <div className="pt-4 border-t border-slate-200 dark:border-slate-800 animate-in fade-in slide-in-from-top-2 duration-300">
                        <Label className="text-xs mb-2 block font-semibold text-emerald-600 dark:text-emerald-400">2. Envoyer un email de test (Recommandé)</Label>
                        <div className="flex gap-2">
                            <Input
                                placeholder="Email de destination pour le test..."
                                value={testEmail}
                                onChange={(e) => setTestEmail(e.target.value)}
                                className="flex-1 text-sm bg-slate-50 dark:bg-slate-900"
                            />
                            <Button
                                variant="secondary"
                                onClick={handleSendTestEmail}
                                disabled={isSendingTest || !testEmail}
                                className="whitespace-nowrap font-medium text-xs bg-slate-200 hover:bg-slate-300 dark:bg-slate-800 dark:hover:bg-slate-700"
                            >
                                {isSendingTest ? <LoadingLogo size="sm" /> : null}
                                Envoyer
                            </Button>
                        </div>
                    </div>
                )}
            </CardContent>
            <CardFooter className="bg-slate-50 dark:bg-slate-900/50 flex justify-between rounded-b-lg border-t px-6 py-4">
                <div />
                <div className="flex gap-2">
                    {existingConfig && (
                        <Button variant="ghost" size="sm" onClick={handleDelete} disabled={isDeleting} className="text-destructive hover:bg-destructive/10">Supprimer</Button>
                    )}
                    <Button variant="outline" size="sm" onClick={handleTest} disabled={isTesting || !host}>
                        {isTesting ? <LoadingLogo size="sm" /> : 'Tester la connexion'}
                    </Button>
                    <Button size="sm" onClick={handleSave} disabled={isSaving || !host} className="bg-emerald-600 hover:bg-emerald-700 text-white">
                        {isSaving ? <LoadingLogo size="sm" /> : null} Sauvegarder
                    </Button>
                </div>
            </CardFooter>

            <ConfirmDialog
                isOpen={isDeleteDialogOpen}
                onOpenChange={setIsDeleteDialogOpen}
                onConfirm={confirmDelete}
                title="Supprimer la configuration SMTP ?"
                description="Êtes-vous sûr de vouloir supprimer ces paramètres ? Vos campagnes ne pourront plus envoyer d'emails tant qu'une nouvelle configuration n'est pas configurée."
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
                    {PROVIDERS_CONFIG.map((config) => (
                        <ApiKeyCard
                            key={config.id}
                            providerConfig={config}
                            existingKey={keys.find(k => k.provider === config.id)}
                            onUpdate={fetchKeys}
                        />
                    ))}
                </div>
            )}
        </div>
    );
};
