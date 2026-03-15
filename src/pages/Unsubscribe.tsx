import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { CheckCircle, XCircle, Loader2 } from 'lucide-react';
import { logSimpleAudit } from '@/lib/privacy/utils';

const Unsubscribe = () => {
    const [searchParams] = useSearchParams();
    const token = searchParams.get('token');
    const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
    const [email, setEmail] = useState('');

    useEffect(() => {
        if (!token) {
            setStatus('error');
            return;
        }
        handleUnsubscribe();
    }, [token]);

    const handleUnsubscribe = async () => {
        try {
            // Trouver la préférence par token
            const { data: pref, error: findError } = await supabase
                .from('contact_preferences')
                .select('*')
                .eq('unsubscribe_token', token)
                .single() as any;

            if (findError || !pref) {
                console.error('Find error:', findError);
                setStatus('error');
                return;
            }

            // Mettre à jour (opt-out)
            const { error: updateError } = await supabase
                .from('contact_preferences')
                .update({
                    can_contact_email: false,
                    can_contact_sms: false,
                    can_contact_phone: false,
                    unsubscribed_at: new Date().toISOString(),
                })
                .eq('id', (pref as any).id);

            if (updateError) {
                console.error('Update error:', updateError);
                setStatus('error');
                return;
            }

            // Log simple
            await logSimpleAudit('unsubscribe', 'contact_preference', pref.id);

            setEmail((pref as any).email);
            setStatus('success');
        } catch (error) {
            console.error('Unsubscribe error:', error);
            setStatus('error');
        }
    };

    return (
        <div className="min-h-screen bg-secondary flex items-center justify-center p-4">
            <Card className="max-w-md w-full">
                <CardHeader>
                    <CardTitle className="text-center text-2xl">
                        {status === 'loading' && 'Désinscription en cours...'}
                        {status === 'success' && 'Désinscription réussie'}
                        {status === 'error' && 'Erreur'}
                    </CardTitle>
                    <CardDescription className="text-center">
                        {status === 'loading' && 'Veuillez patienter'}
                        {status === 'success' && 'Vous ne recevrez plus d\'emails de notre part'}
                        {status === 'error' && 'Le lien est invalide ou a expiré'}
                    </CardDescription>
                </CardHeader>
                <CardContent className="text-center">
                    {status === 'loading' && (
                        <div className="flex flex-col items-center justify-center py-10 gap-4">
                            <Loader2 className="h-10 w-10 animate-spin text-accent" />
                            <p className="text-sm text-slate-500 font-medium">Traitement de votre demande...</p>
                        </div>
                    )}

                    {status === 'success' && (
                        <div className="space-y-4">
                            <CheckCircle className="h-20 w-20 text-green-500 mx-auto" />
                            <div className="space-y-2">
                                <p className="text-lg font-medium">Vous avez été désinscrit avec succès</p>
                                {email && (
                                    <p className="text-sm text-muted-foreground">
                                        Email: <span className="font-mono font-semibold">{email}</span>
                                    </p>
                                )}
                            </div>
                            <div className="bg-muted p-4 rounded-lg text-sm text-left">
                                <p className="font-semibold mb-2">Ce qui a changé :</p>
                                <ul className="space-y-1 text-muted-foreground">
                                    <li>✓ Vous ne recevrez plus d'emails marketing</li>
                                    <li>✓ Vous ne recevrez plus de SMS</li>
                                    <li>✓ Vous ne serez plus contacté par téléphone</li>
                                </ul>
                            </div>
                            <p className="text-xs text-muted-foreground">
                                Si vous souhaitez vous réinscrire, contactez-nous à{' '}
                                <a href="mailto:contact@prospecta.com" className="text-accent hover:underline">
                                    contact@prospecta.com
                                </a>
                            </p>
                        </div>
                    )}

                    {status === 'error' && (
                        <div className="space-y-4">
                            <XCircle className="h-20 w-20 text-red-500 mx-auto" />
                            <div className="space-y-2">
                                <p className="text-lg font-medium">Lien invalide ou expiré</p>
                                <p className="text-sm text-muted-foreground">
                                    Ce lien de désinscription n'est pas valide ou a déjà été utilisé.
                                </p>
                            </div>
                            <div className="bg-muted p-4 rounded-lg text-sm">
                                <p className="font-semibold mb-2">Besoin d'aide ?</p>
                                <p className="text-muted-foreground mb-2">
                                    Contactez-nous directement pour vous désinscrire :
                                </p>
                                <a
                                    href="mailto:contact@prospecta.com?subject=Désinscription"
                                    className="text-accent hover:underline font-medium"
                                >
                                    contact@prospecta.com
                                </a>
                            </div>
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    );
};

export default Unsubscribe;
