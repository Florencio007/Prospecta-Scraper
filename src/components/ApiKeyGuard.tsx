import React, { useEffect, useState } from 'react';
import { useApiKeys, ApiProvider } from '@/hooks/useApiKeys';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Key, Settings, AlertCircle, Loader2 } from 'lucide-react';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { useAuth } from '@/hooks/useAuth';

interface ApiKeyGuardProps {
    provider: ApiProvider;
    children: React.ReactNode;
    featureName: string;   // Ex: "les campagnes email"
}

export const ApiKeyGuard: React.FC<ApiKeyGuardProps> = ({ provider, children, featureName }) => {
    const { getKeyByProvider } = useApiKeys();
    const { user } = useAuth();
    const [hasKey, setHasKey] = useState<boolean | null>(null);

    useEffect(() => {
        if (!user) return;
        const checkKey = async () => {
            const key = await getKeyByProvider(provider);
            setHasKey(!!key);
        };
        checkKey();
    }, [provider, getKeyByProvider, user]);

    if (hasKey === null) {
        return (
            <div className="flex flex-col items-center justify-center p-12 min-h-[300px]">
                <Loader2 className="h-8 w-8 animate-spin text-accent mb-4" />
                <p className="text-muted-foreground">Vérification de la configuration...</p>
            </div>
        );
    }

    if (!hasKey) {
        const providerNames: Record<ApiProvider, string> = {
            brevo: 'Brevo',
            openai: 'OpenAI',
            google_maps: 'Google Maps',
            facebook: 'Facebook',
            linkedin: 'LinkedIn',
            twilio: 'Twilio'
        };

        return (
            <div className="p-4 md:p-8 flex justify-center">
                <Card className="w-full max-w-lg shadow-md border-amber-200 dark:border-amber-900/50 bg-amber-50/50 dark:bg-amber-950/20">
                    <CardHeader>
                        <div className="flex items-center gap-3 mb-2">
                            <div className="p-2 bg-amber-100 dark:bg-amber-900/50 rounded-full">
                                <AlertCircle className="h-6 w-6 text-amber-600 dark:text-amber-500" />
                            </div>
                            <CardTitle className="text-xl">Configuration requise</CardTitle>
                        </div>
                        <CardDescription className="text-base text-slate-600 dark:text-slate-400">
                            Vous devez configurer votre clé API <strong>{providerNames[provider]}</strong> pour utiliser {featureName}.
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="text-sm text-slate-500 dark:text-slate-400">
                        Prospecta utilise votre propre compte {providerNames[provider]} pour une isolation totale de vos données et un contrôle absolu de vos coûts et de votre réputation.
                    </CardContent>
                    <CardFooter className="flex flex-col sm:flex-row gap-3 pt-4 border-t border-amber-100 dark:border-amber-900/30">
                        <Button asChild className="w-full sm:w-auto bg-accent hover:bg-accent/90">
                            <Link to="/settings?tab=integrations">
                                <Settings className="mr-2 h-4 w-4" />
                                Configurer l'intégration
                            </Link>
                        </Button>
                        <Button asChild variant="outline" className="w-full sm:w-auto">
                            <a href="https://app.brevo.com/settings/keys/api" target="_blank" rel="noopener noreferrer">
                                <Key className="mr-2 h-4 w-4" />
                                Obtenir ma clé
                            </a>
                        </Button>
                    </CardFooter>
                </Card>
            </div>
        );
    }

    return <>{children}</>;
};
