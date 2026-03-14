// background.js - Pilote le scraping en arrière-plan

let activeScrapeTab = null;
let currentVercelTab = null;

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.command === "START_SCRAPE") {
        console.log("Démarrage du scraping demandé par :", sender.tab?.url);
        currentVercelTab = sender.tab?.id;
        
        startScrapingProcess(request.params)
            .then(data => sendResponse({ requestId: request.requestId, data }))
            .catch(error => sendResponse({ requestId: request.requestId, error: error.message }));
        
        return true; // Indique une réponse asynchrone
    }
});

async function startScrapingProcess(params) {
    const { keyword, location, type } = params;
    
    // Notification UI Vercel : Début
    emitProgress("Initialisation de l'Agent Prospecta Local...", 5, "info");

    return new Promise(async (resolve, reject) => {
        try {
            // Création d'un onglet inactif/minimisé vers LinkedIn
            emitProgress("Ouverture de LinkedIn avec votre session...", 10, "info");
            
            const searchUrl = `https://www.linkedin.com/search/results/people/?keywords=${encodeURIComponent(keyword + (location ? ' ' + location : ''))}`;
            
            activeScrapeTab = await chrome.tabs.create({ url: searchUrl, active: false });
            
            // On attend que la page charge un peu
            setTimeout(async () => {
                emitProgress("Injection du script d'extraction natif...", 20, "info");
                
                try {
                    // Exécute le script de scraping dans l'onglet LinkedIn
                    const results = await chrome.scripting.executeScript({
                        target: { tabId: activeScrapeTab.id },
                        files: ['content-scraper.js']
                    });
                    
                    // Passe les paramètres au script via un message classique
                    chrome.tabs.sendMessage(activeScrapeTab.id, { 
                        command: 'EXTRACT_LINKEDIN_DATA',
                        params: params 
                    }, (extractionResponse) => {
                        // Nettoyage : Ferme l'onglet de scraping à la fin
                        if (activeScrapeTab) {
                            chrome.tabs.remove(activeScrapeTab.id);
                            activeScrapeTab = null;
                        }

                        if (extractionResponse && extractionResponse.error) {
                            reject(new Error(extractionResponse.error));
                        } else {
                            // Succès complet
                            emitProgress("Scraping local terminé avec succès !", 100, "success");
                            resolve(extractionResponse?.data || []);
                        }
                    });

                } catch (e) {
                    if (activeScrapeTab) chrome.tabs.remove(activeScrapeTab.id);
                    reject(e);
                }
            }, 5000); // 5 secondes pour laisser LinkedIn charger (SPA)

        } catch (error) {
            reject(error);
        }
    });
}

// Fonction utilitaire pour envoyer des logs d'UI à l'onglet Vercel
function emitProgress(message, progress, status = "info") {
    if (!currentVercelTab) return;
    chrome.tabs.sendMessage(currentVercelTab, {
        type: "SCRAPE_PROGRESS",
        message,
        progress,
        status
    }).catch(err => {/* Ignore les erreurs si l'onglet est fermé */});
}

// Relai des events depuis le content-scraper (Ex: PROSPECT_FOUND)
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === 'PROSPECT_FOUND' && currentVercelTab) {
        chrome.tabs.sendMessage(currentVercelTab, message).catch(err => {});
    }
});
