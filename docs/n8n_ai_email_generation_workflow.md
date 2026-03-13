# n8n Workflow - AI_EMAIL_GENERATION

Ce document décrit le workflow n8n à créer pour la génération automatique d'emails personnalisés.

## Configuration

1. **Créer un nouveau workflow dans n8n**
2. **Nom du workflow**: `AI_EMAIL_GENERATION`
3. **Trigger**: Webhook (POST)

## Structure du Workflow

### 1. Webhook Trigger
- **Method**: POST
- **Path**: `/ai-email-generation`
- **Response Mode**: Wait for Webhook Response

### 2. Extract Data (Code Node)
```javascript
const prospectData = $input.item.json.prospectData;
const userServiceDescription = $input.item.json.userServiceDescription;
const campaignContext = $input.item.json.campaignContext;

return [{
  json: {
    prospectData,
    userServiceDescription,
    campaignContext
  }
}];
```

### 3. Build AI Prompt (Code Node)
```javascript
const { prospectData, userServiceDescription, campaignContext } = $input.item.json;

const prompt = `Tu es un expert en cold email B2B. Génère un email personnalisé pour:

PROSPECT:
- Nom: ${prospectData.name}
- Entreprise: ${prospectData.company}
- Secteur: ${prospectData.industry}
- Intelligence Web: ${JSON.stringify(prospectData.webIntelligence)}

SERVICE DE L'UTILISATEUR:
${userServiceDescription}

CONTEXTE CAMPAGNE:
- Nom: ${campaignContext.name}
- Description: ${campaignContext.description}

Génère un email qui:
1. Félicite le prospect pour une réalisation spécifique (basée sur l'intelligence web)
2. Fait le lien avec le service proposé
3. Propose une valeur concrète
4. Termine par un CTA clair

IMPORTANT: Réponds UNIQUEMENT avec un objet JSON au format suivant (sans markdown, sans backticks):
{"subject": "...", "body": "..."}`;

return [{
  json: {
    prompt
  }
}];
```

### 4. OpenAI / Claude Node
- **Model**: GPT-4 ou Claude 3.5 Sonnet
- **Prompt**: `{{ $json.prompt }}`
- **Temperature**: 0.7
- **Max Tokens**: 1000

### 5. Parse Response (Code Node)
```javascript
const aiResponse = $input.item.json.message.content;

try {
  // Remove markdown code blocks if present
  const cleanResponse = aiResponse.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
  const parsed = JSON.parse(cleanResponse);
  
  return [{
    json: {
      subject: parsed.subject,
      body: parsed.body
    }
  }];
} catch (error) {
  // Fallback if parsing fails
  return [{
    json: {
      subject: "Découvrez notre solution",
      body: aiResponse
    }
  }];
}
```

### 6. Respond to Webhook
- **Response Body**: `{{ $json }}`
- **Status Code**: 200

## Variables d'Environnement

Ajouter dans le fichier `.env`:
```
VITE_N8N_WEBHOOK_AI_EMAIL_GENERATION=https://votre-instance-n8n.com/webhook/ai-email-generation
```

## Test du Workflow

Payload de test:
```json
{
  "prospectData": {
    "name": "Jean Dupont",
    "company": "TechCorp Madagascar",
    "industry": "E-commerce",
    "webIntelligence": {
      "services": ["Vente en ligne", "Livraison"],
      "brandValues": ["#Innovation", "#Service Client"]
    }
  },
  "userServiceDescription": "Nous créons des assistants IA intelligents pour les e-commerces malgaches, permettant d'automatiser le SAV et les commandes via Messenger et WhatsApp.",
  "campaignContext": {
    "name": "Prospection Q1 2026",
    "description": "Campagne de prospection pour les e-commerces"
  }
}
```

Réponse attendue:
```json
{
  "subject": "Bonjour TechCorp Madagascar - Automatisez votre SAV",
  "body": "Bonjour Jean,\n\nJe suis impressionné par votre engagement envers l'innovation et le service client chez TechCorp Madagascar...\n\n[Email personnalisé généré par l'IA]"
}
```
