// content-scraper.js - Injecté directement sur LinkedIn / Target Site

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.command === "EXTRACT_LINKEDIN_DATA") {
        console.log("Prospecta Native Agent: Extraction lancée sur cette page");
        
        extractLinkedInData(request.params)
            .then(data => sendResponse({ data }))
            .catch(error => sendResponse({ error: error.message }));
            
        return true; // Async response
    }
});

async function extractLinkedInData(params) {
    const prospects = [];
    const maxResults = params.maxLimit || 10;
    
    // Fonction utilitaire pour simuler un délai humain (Anti-Ban)
    const sleep = (ms) => new Promise(res => setTimeout(res, ms));

    // Scroll progressif vers le bas pour charger les images et lazy-components
    for (let i = 0; i < 3; i++) {
        window.scrollTo(0, document.body.scrollHeight / 3 * (i + 1));
        await sleep(800 + Math.random() * 500); 
    }

    // Récupération globale des cartes profils sur la recherche LinkedIn
    const profileCards = document.querySelectorAll('li.reusable-search__result-container');
    
    if (profileCards.length === 0) {
        throw new Error("Aucun profil trouvé sur la page ou blocage de sécurité LinkedIn.");
    }

    for (let i = 0; i < Math.min(profileCards.length, maxResults); i++) {
        const card = profileCards[i];
        
        // Extraction avec sélecteurs DOM précis de LinkedIn
        const nameEl = card.querySelector('span[dir="ltr"] span[aria-hidden="true"]');
        const titleEl = card.querySelector('div.entity-result__primary-subtitle');
        const locationEl = card.querySelector('div.entity-result__secondary-subtitle');
        const linkEl = card.querySelector('.app-aware-link');
        const imgEl = card.querySelector('img');

        const name = nameEl ? nameEl.innerText.trim() : 'Nom Inconnu';
        // On ignore les "Membres LinkedIn" hors réseau réseau
        if (name === "Utilisateur LinkedIn" || name === "LinkedIn Member") continue;

        const prospect = {
            id: 'li_' + Math.random().toString(36).substr(2, 9),
            name: name,
            title: titleEl ? titleEl.innerText.trim() : '',
            location: locationEl ? locationEl.innerText.trim() : '',
            profileUrl: linkEl ? linkEl.href.split('?')[0] : '', // Clean query params
            photoUrl: imgEl ? imgEl.src : '',
            company: extractCompanyFromTitle(titleEl ? titleEl.innerText : ''),
            source: 'linkedin',
            status: 'draft',
            createdAt: new Date().toISOString()
        };

        prospects.push(prospect);

        // Envoyer un event en temps réel au background (qui le renvoie à Vercel)
        chrome.runtime.sendMessage({
            type: "PROSPECT_FOUND",
            prospect: prospect
        });

        await sleep(300); // 300ms entre chaque extraction de carte pour faire humain
    }

    return prospects;
}

// Extraction basique de l'entreprise (heuristique)
function extractCompanyFromTitle(title) {
    if (!title) return '';
    const parts = title.split(/ à | at | @ | - /i);
    if (parts.length > 1) {
        return parts[parts.length - 1].trim();
    }
    return '';
}
