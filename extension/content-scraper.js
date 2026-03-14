// content-scraper.js - Injecté directement sur LinkedIn / Target Site

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    console.log("Prospecta Native Agent: Commande reçue", request.command);
    
    let extractionTask;
    switch (request.command) {
        case "EXTRACT_LINKEDIN_DATA":
            extractionTask = extractLinkedInData(request.params);
            break;
        case "EXTRACT_GMAPS_DATA":
            extractionTask = extractGMapsData(request.params);
            break;
        case "EXTRACT_FACEBOOK_DATA":
            extractionTask = extractFacebookData(request.params);
            break;
        case "EXTRACT_PJ_DATA":
            extractionTask = extractPJData(request.params);
            break;
        case "EXTRACT_PAPPERS_DATA":
            extractionTask = extractPappersData(request.params);
            break;
        case "EXTRACT_SOCIETE_DATA":
            extractionTask = extractSocieteData(request.params);
            break;
        case "EXTRACT_INFOGREFFE_DATA":
            extractionTask = extractInfogreffeData(request.params);
            break;
    }

    if (extractionTask) {
        extractionTask
            .then(data => sendResponse({ data }))
            .catch(error => sendResponse({ error: error.message }));
        return true;
    }
});

// --- GOOGLE MAPS ---
async function extractGMapsData(params) {
    const prospects = [];
    const maxResults = params.maxLimit || 10;
    const sleep = (ms) => new Promise(res => setTimeout(res, ms));

    for (let scroll = 0; scroll < 5; scroll++) {
        const extracted = await Array.from(document.querySelectorAll('a[href*="/maps/place/"]')).map(link => {
            const container = link.closest('[role="feed"] > div') || link.parentElement.parentElement;
            if (!container) return null;
            const nameEl = container.querySelector('.fontHeadlineSmall, h3');
            const name = nameEl ? nameEl.innerText.trim() : '';
            if (!name) return null;
            
            const texts = Array.from(container.querySelectorAll('.W4Efsd > span')).map(s => s.innerText.trim());
            return {
                id: 'gmap_' + Math.random().toString(36).substr(2, 9),
                name,
                category: texts[0] || '',
                phone: texts.find(t => /^\+?[\d\s\-().]{7,}$/.test(t)) || '',
                source: 'google_maps',
                website: container.querySelector('a[data-value="Website"]')?.href || ''
            };
        }).filter(Boolean);

        for (const p of extracted) {
            if (prospects.length >= maxResults) break;
            if (!prospects.find(existing => existing.name === p.name)) {
                prospects.push(p);
                chrome.runtime.sendMessage({ type: "PROSPECT_FOUND", prospect: p });
            }
        }
        
        const feed = document.querySelector('[role="feed"]');
        if (feed) feed.scrollBy(0, 500);
        await sleep(1000);
    }
    return prospects;
}

// --- FACEBOOK ---
async function extractFacebookData(params) {
    const prospects = [];
    const maxResults = params.maxLimit || 10;
    const cards = document.querySelectorAll('[role="article"], [data-testid="search-result"]');
    
    for (let i = 0; i < Math.min(cards.length, maxResults); i++) {
        const card = cards[i];
        const nameEl = card.querySelector('h3, a[role="link"]');
        const linkEl = card.querySelector('a[href*="facebook.com/"]');
        if (!nameEl) continue;

        const p = {
            id: 'fb_' + Math.random().toString(36).substr(2, 9),
            name: nameEl.innerText.trim(),
            profileUrl: linkEl ? linkEl.href : '',
            source: 'facebook'
        };
        prospects.push(p);
        chrome.runtime.sendMessage({ type: "PROSPECT_FOUND", prospect: p });
    }
    return prospects;
}

// --- PAGES JAUNES ---
async function extractPJData(params) {
    const prospects = [];
    const maxResults = params.maxLimit || 10;
    const cards = document.querySelectorAll('article.bi-pjcard, .bi-pjcard');
    
    for (let i = 0; i < Math.min(cards.length, maxResults); i++) {
        const card = cards[i];
        const nameEl = card.querySelector('h3, .denomination-links');
        if (!nameEl) continue;

        const p = {
            id: 'pj_' + Math.random().toString(36).substr(2, 9),
            name: nameEl.innerText.trim(),
            phone: card.querySelector('.num')?.innerText.trim() || '',
            category: card.querySelector('.activite')?.innerText.trim() || '',
            source: 'pages_jaunes'
        };
        prospects.push(p);
        chrome.runtime.sendMessage({ type: "PROSPECT_FOUND", prospect: p });
    }
    return prospects;
}

// --- PAPPERS ---
async function extractPappersData(params) {
    const prospects = [];
    const maxResults = params.maxLimit || 10;
    const links = document.querySelectorAll('a[href*="/entreprise/"]');
    
    for (let i = 0; i < Math.min(links.length, maxResults); i++) {
        const link = links[i];
        const name = link.innerText.trim();
        if (!name || name.length < 2) continue;

        const p = {
            id: 'pappers_' + Math.random().toString(36).substr(2, 9),
            name: name,
            source: 'pappers',
            profileUrl: link.href
        };
        prospects.push(p);
        chrome.runtime.sendMessage({ type: "PROSPECT_FOUND", prospect: p });
    }
    return prospects;
}

// --- SOCIETE.COM ---
async function extractSocieteData(params) {
    const prospects = [];
    const maxResults = params.maxLimit || 10;
    const items = document.querySelectorAll('.Resultats-item, .resultat_item');
    
    for (let i = 0; i < Math.min(items.length, maxResults); i++) {
        const item = items[i];
        const nameEl = item.querySelector('.Denomination, a');
        if (!nameEl) continue;

        const p = {
            id: 'societe_' + Math.random().toString(36).substr(2, 9),
            name: nameEl.innerText.trim(),
            source: 'societe'
        };
        prospects.push(p);
        chrome.runtime.sendMessage({ type: "PROSPECT_FOUND", prospect: p });
    }
    return prospects;
}

// --- INFOGREFFE ---
async function extractInfogreffeData(params) {
    const prospects = [];
    const maxResults = params.maxLimit || 10;
    const rows = document.querySelectorAll('.result-item, tr.odd, tr.even');
    
    for (let i = 0; i < Math.min(rows.length, maxResults); i++) {
        const row = rows[i];
        const nameEl = row.querySelector('.denomination, a');
        if (!nameEl) continue;

        const p = {
            id: 'infogreffe_' + Math.random().toString(36).substr(2, 9),
            name: nameEl.innerText.trim(),
            source: 'infogreffe'
        };
        prospects.push(p);
        chrome.runtime.sendMessage({ type: "PROSPECT_FOUND", prospect: p });
    }
    return prospects;
}

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
