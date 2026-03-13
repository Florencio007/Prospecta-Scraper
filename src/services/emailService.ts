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

// Envoi d'un seul email via le backend proxy (qui appelle ensuite Brevo)
export async function sendSingleEmail(params: SendEmailParams): Promise<BrevoResponse> {
    try {
        const response = await fetch('/api/email/send', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(params),
        });

        if (!response.ok) {
            const err = await response.json();
            return { error: err.error || err.message || `Erreur Serveur ${response.status}` };
        }

        const data = await response.json();
        return { messageId: data.messageId };

    } catch (err) {
        return { error: `Erreur de connexion au serveur backend : ${(err as Error).message}` };
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
