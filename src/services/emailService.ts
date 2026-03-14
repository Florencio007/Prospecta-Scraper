export interface SendEmailParams {
    brevoApiKey: string;
    to: { email: string; name?: string };
    from: { email: string; name: string };
    replyTo?: string;
    subject: string;
    htmlContent: string;
    textContent?: string;
    tags?: string[];
    campaignId?: string;
}

export interface BrevoResponse {
    messageId?: string;
    error?: string;
}

// Test email sending
export async function testEmailSend(provider: string, payload: any): Promise<BrevoResponse> {
    try {
        if (provider === 'smtp') {
            // For SMTP, we reuse the generic send-smtp endpoint because it's transparent.
            // payload is expected to be SmtpEmailParams-like
            const response = await fetch('/api/email/send-smtp', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    smtpHost: payload.smtpHost,
                    smtpPort: payload.smtpPort,
                    smtpUser: payload.smtpUser,
                    smtpPass: payload.smtpPass,
                    to: payload.to[0],
                    from: payload.sender,
                    subject: payload.subject,
                    htmlContent: payload.htmlContent,
                    isTest: true // Optional flag for backend if needed
                }),
            });
            if (!response.ok) {
                const err = await response.json();
                return { error: err.error || "Erreur SMTP" };
            }
            return await response.json();

        } else {
            // Brevo
            const response = await fetch('/api/email/test', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ brevoApiKey: payload, to: payload.to }), // Legacy signature fallback
            });

            if (!response.ok) {
                const err = await response.json();
                return { error: err.error || (err instanceof Error ? err.message : "Une erreur inconnue s'est produite") };
            }

            const data = await response.json();
            return { messageId: data.messageId };
        }
    } catch (err) {
        return { error: `Erreur de connexion : ${(err as Error).message}` };
    }
}
export async function sendSingleEmail(params: SendEmailParams): Promise<BrevoResponse> {
    try {
        // #region agent log
        fetch('http://127.0.0.1:7525/ingest/d5461618-61cd-4a83-9f42-892bccf07283', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-Debug-Session-Id': 'ef6e8d',
            },
            body: JSON.stringify({
                sessionId: 'ef6e8d',
                runId: 'pre-fix',
                hypothesisId: 'H1',
                location: 'src/services/emailService.ts:65',
                message: 'sendSingleEmail called',
                data: {
                    toEmail: params.to?.email,
                    fromEmail: params.from?.email,
                    hasBrevoKey: !!params.brevoApiKey,
                    campaignId: params.campaignId,
                },
                timestamp: Date.now(),
            }),
        }).catch(() => { });
        // #endregion agent log

        const response = await fetch('/api/email/send', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(params),
        });
        if (!response.ok) {
            const err = await response.json();

            // #region agent log
            fetch('http://127.0.0.1:7525/ingest/d5461618-61cd-4a83-9f42-892bccf07283', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-Debug-Session-Id': 'ef6e8d',
                },
                body: JSON.stringify({
                    sessionId: 'ef6e8d',
                    runId: 'pre-fix',
                    hypothesisId: 'H2',
                    location: 'src/services/emailService.ts:72',
                    message: 'sendSingleEmail backend error response',
                    data: {
                        status: response.status,
                        errorMessage: (err as any)?.error || (err as any)?.message || null,
                    },
                    timestamp: Date.now(),
                }),
            }).catch(() => { });
            // #endregion agent log

            return { error: err.error || `Erreur Serveur ${response.status}` };
        }
        const data = await response.json();

        // #region agent log
        fetch('http://127.0.0.1:7525/ingest/d5461618-61cd-4a83-9f42-892bccf07283', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-Debug-Session-Id': 'ef6e8d',
            },
            body: JSON.stringify({
                sessionId: 'ef6e8d',
                runId: 'pre-fix',
                hypothesisId: 'H3',
                location: 'src/services/emailService.ts:76',
                message: 'sendSingleEmail success response',
                data: {
                    messageId: (data as any)?.messageId ?? null,
                },
                timestamp: Date.now(),
            }),
        }).catch(() => { });
        // #endregion agent log

        return { messageId: data.messageId };
    } catch (err) {
        // #region agent log
        fetch('http://127.0.0.1:7525/ingest/d5461618-61cd-4a83-9f42-892bccf07283', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-Debug-Session-Id': 'ef6e8d',
            },
            body: JSON.stringify({
                sessionId: 'ef6e8d',
                runId: 'pre-fix',
                hypothesisId: 'H4',
                location: 'src/services/emailService.ts:78',
                message: 'sendSingleEmail threw',
                data: {
                    errorMessage: (err as Error)?.message ?? String(err),
                },
                timestamp: Date.now(),
            }),
        }).catch(() => { });
        // #endregion agent log

        return { error: `Erreur de connexion au serveur backend : ${(err as Error).message}` };
    }
}

// ---- SMTP (sans API externe) ----
export interface SmtpEmailParams {
    smtpHost: string;
    smtpPort: number;
    smtpUser: string;
    smtpPass: string;
    to: { email: string; name?: string };
    from: { email: string; name: string };
    replyTo?: string;
    subject: string;
    htmlContent: string;
    recipientId?: string; // for open tracking
}

export async function sendSingleEmailSmtp(params: SmtpEmailParams): Promise<BrevoResponse> {
    try {
        const response = await fetch('/api/email/send-smtp', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(params),
        });
        if (!response.ok) {
            const err = await response.json();
            return { error: err.error || `Erreur SMTP ${response.status}` };
        }
        const data = await response.json();
        return { messageId: data.messageId };
    } catch (err) {
        return { error: `Erreur de connexion SMTP : ${(err as Error).message}` };
    }
}

export async function testSmtpConnection(host: string, port: number, user: string, pass: string): Promise<{ ok: boolean; message: string }> {
    try {
        const response = await fetch('/api/email/smtp-test', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ host, port, user, pass }),
        });
        const data = await response.json();
        return response.ok
            ? { ok: true, message: data.message }
            : { ok: false, message: data.error };
    } catch (err) {
        return { ok: false, message: `Erreur réseau : ${(err as Error).message}` };
    }
}

// Personnalisation du template avec les variables
export function personalizeTemplate(
    template: string,
    variables: Record<string, string>
): string {
    return template.replace(/\{\{(\w+)\}\}/g, (_, key) => variables[key] || '');
}

// Calcule le délai warm-up selon le jour
export function getWarmupLimit(currentDay: number, dailyLimit: number): number {
    const warmupSchedule = [0.10, 0.20, 0.35, 0.50, 0.70, 0.85, 1.0];
    const dayIndex = Math.min(Math.max(0, currentDay - 1), warmupSchedule.length - 1);
    return Math.floor(dailyLimit * warmupSchedule[dayIndex]);
}

// Délai aléatoire entre throttleMin et throttleMax secondes
export function randomThrottle(minSeconds: number, maxSeconds: number): Promise<void> {
    const ms = (Math.random() * (maxSeconds - minSeconds) + minSeconds) * 1000;
    return new Promise(resolve => setTimeout(resolve, ms));
}

// Vérifie le score anti-spam d'un sujet et d'un corps d'email
const SPAM_KEYWORDS = [
    'gratuit', 'urgent', 'gagnez', 'cliquez ici', 'offre limitée',
    'argent facile', '100%', 'félicitations', 'vous avez gagné',
    'act now', 'free money', 'click here', 'winner', 'promotion',
    'extra income', 'guaranteed', 'no cost', 'no obligation'
];

export function checkSpamScore(subject: string, body: string): { score: number; issues: string[] } {
    const text = (subject + ' ' + body).toLowerCase();
    const issues: string[] = [];
    let score = 0;

    SPAM_KEYWORDS.forEach(kw => {
        if (text.includes(kw.toLowerCase())) {
            issues.push(`Mot-clé spam détecté: "${kw}"`);
            score += 10;
        }
    });

    if ((subject.match(/!/g) || []).length > 2) {
        issues.push('Trop de points d\'exclamation dans le sujet');
        score += 15;
    }

    if (subject === subject.toUpperCase() && subject.length > 5) {
        issues.push('Sujet entièrement en majuscules');
        score += 20;
    }

    if (!body.includes('{{lien_desabonnement}}') && !body.toLowerCase().includes('désabonner')) {
        issues.push('Lien de désinscription manquant');
        score += 25;
    }

    return { score: Math.min(score, 100), issues };
}
