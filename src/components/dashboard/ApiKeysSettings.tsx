import React, { useEffect, useState } from 'react';
import { useApiKeys, ApiProvider, ApiKey } from '@/hooks/useApiKeys';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { Eye, EyeOff, ExternalLink, Loader2, CheckCircle2, XCircle, Clock, AlertTriangle, Key } from 'lucide-react';

const PROVIDERS_CONFIG = [
    {
        id: 'brevo' as ApiProvider,
        name: 'Brevo (Sendinblue)',
        icon: '📧',
        description: 'Envoi des campagnes email — jusqu\'à 300 emails/jour gratuits',
        keyLabel: 'Clé API Brevo',
        keyPlaceholder: 'xkeysib-...',
        docsUrl: 'https://app.brevo.com/settings/keys/api',
        required: true,
    },
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

    useEffect(() => {
        setApiKey(existingKey?.api_key || '');
        setApiSecret(existingKey?.api_secret || '');
        setLabel(existingKey?.label || providerConfig.name);
    }, [existingKey, providerConfig.name]);

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
        const result = await testKey(providerConfig.id);
        setIsTesting(false);

        if (result.ok) {
            toast({ title: "Test réussi", description: result.message });
        } else {
            toast({ title: "Échec du test", description: result.message, variant: "destructive" });
        }
        onUpdate();
    };

    const handleDelete = async () => {
        if (!confirm(`Êtes-vous sûr de vouloir supprimer la configuration de ${providerConfig.name} ?`)) return;
        setIsDeleting(true);
        const success = await deleteKey(providerConfig.id);
        setIsDeleting(false);

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
                                {isTesting ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Tester'}
                            </Button>
                        </>
                    )}
                    <Button variant="default" size="sm" onClick={handleSave} disabled={isSaving || !apiKey} className="bg-accent hover:bg-accent/90">
                        {isSaving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                        Sauvegarder
                    </Button>
                </div>
            </CardFooter>
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

    const hasBrevoKey = keys.some(k => k.provider === 'brevo' && k.is_active);

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

            {!hasBrevoKey && !loading && (
                <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 text-amber-800 dark:text-amber-300 p-4 rounded-lg flex gap-3 items-start animate-in fade-in">
                    <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5" />
                    <div>
                        <h4 className="font-semibold text-sm">Configuration requise pour les campagnes email</h4>
                        <p className="text-sm mt-1 opacity-90">
                            Vous devez configurer votre clé API Brevo pour activer l'envoi de vos campagnes email. L'inscription est gratuite et vous donne droit à 300 emails/jour.
                        </p>
                    </div>
                </div>
            )}

            {loading ? (
                <div className="flex justify-center p-12">
                    <Loader2 className="w-8 h-8 animate-spin text-accent" />
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
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
