import { getAgentApiUrl } from "@/utils/agentUtils";

export interface SendEmailResponse {
    messageId?: string;
    error?: string;
}

// Test email sending
export async function testEmailSend(provider: string, payload: any): Promise<SendEmailResponse> {
    try {
        if (provider === 'smtp') {
            // For SMTP, we reuse the generic send-smtp endpoint because it's transparent.
            // payload is expected to be SmtpEmailParams-like
            const apiUrl = getAgentApiUrl('/api/email/send-smtp');
            const response = await fetch(apiUrl, {
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
            return { error: "Service non supporté" };
        }
    } catch (err) {
        return { error: `Erreur de connexion : ${(err as Error).message}` };
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

export async function sendSingleEmailSmtp(params: SmtpEmailParams): Promise<SendEmailResponse> {
    const apiUrl = getAgentApiUrl('/api/email/send-smtp');
    console.log(`[sendSingleEmailSmtp] Calling ${apiUrl}...`);
    try {
        const response = await fetch(apiUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(params),
        });
        console.log(`[sendSingleEmailSmtp] Response Status: ${response.status} ${response.statusText}`);
        if (!response.ok) {
            const err = await response.json().catch(() => ({ error: 'Unknown response format' }));
            console.error(`[sendSingleEmailSmtp] Error Data:`, err);
            return { error: err.error || `Erreur SMTP ${response.status}` };
        }
        const data = await response.json();
        console.log(`[sendSingleEmailSmtp] Success Data:`, data);
        return { messageId: data.messageId };
    } catch (err) {
        console.error(`[sendSingleEmailSmtp] Catch Error:`, err);
        return { error: `Erreur de connexion SMTP : ${(err as Error).message}` };
    }
}

export async function testSmtpConnection(host: string, port: number, user: string, pass: string): Promise<{ ok: boolean; message: string }> {
    const apiUrl = getAgentApiUrl('/api/email/smtp-test');
    try {
        const response = await fetch(apiUrl, {
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
