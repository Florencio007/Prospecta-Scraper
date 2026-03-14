// background.js - Pilote le scraping en arrière-plan

let activeScrapeTab = null;
let currentVercelTab = null;

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.command === "START_SCRAPE") {
        console.log("Démarrage du scraping demandé par :", sender.tab?.url);
        console.log("Params reçus:", request.params);
        currentVercelTab = sender.tab?.id;
        
        startScrapingProcess(request.params)
            .then(data => {
                console.log("Scraping réussi, envoi de la réponse.");
                sendResponse({ requestId: request.requestId, data });
            })
            .catch(error => {
                console.error("Erreur Scraping:", error);
                sendResponse({ requestId: request.requestId, error: error.message });
            });
        
        return true; // Indique une réponse asynchrone
    }
});

async function startScrapingProcess(params) {
    const { keyword, location, type, channel = "unknown" } = params;
    
    emitProgress(`Initialisation du canal [${(channel || "unknown").toUpperCase()}]...`, 5, "info");

    return new Promise(async (resolve, reject) => {
        try {
            let searchUrl = "";
            let command = "";

            switch (channel) {
                case "linkedin":
                    searchUrl = `https://www.linkedin.com/search/results/people/?keywords=${encodeURIComponent(keyword + (location ? ' ' + location : ''))}`;
                    command = "EXTRACT_LINKEDIN_DATA";
                    break;
                case "google_maps":
                    searchUrl = `https://www.google.com/maps/search/${encodeURIComponent(keyword + ' ' + (location || ''))}`;
                    command = "EXTRACT_GMAPS_DATA";
                    break;
                case "facebook":
                    searchUrl = `https://www.facebook.com/search/top/?q=${encodeURIComponent(keyword)}`;
                    command = "EXTRACT_FACEBOOK_DATA";
                    break;
                case "pages_jaunes":
                    searchUrl = `https://www.pagesjaunes.fr/annuaire/chercherlespros?quoiqui=${encodeURIComponent(keyword)}&ou=${encodeURIComponent(location || '')}`;
                    command = "EXTRACT_PJ_DATA";
                    break;
                case "pappers":
                    searchUrl = `https://www.pappers.fr/recherche?q=${encodeURIComponent(keyword + ' ' + (location || ''))}`;
                    command = "EXTRACT_PAPPERS_DATA";
                    break;
                case "societe":
                    searchUrl = `https://www.societe.com/cgi-bin/search?champs=${encodeURIComponent(keyword)}`;
                    command = "EXTRACT_SOCIETE_DATA";
                    break;
                case "infogreffe":
                    searchUrl = `https://www.infogreffe.fr/recherche-entreprise-dirigeant/resultats-recherche-entreprise-dirigeant.html?phrase=${encodeURIComponent(keyword)}`;
                    command = "EXTRACT_INFOGREFFE_DATA";
                    break;
                default:
                    return reject(new Error("Canal de scraping non supporté par l'extension."));
            }

            emitProgress(`Ouverture de ${channel} (Visible)...`, 10, "info");
            
            // On ouvre l'onglet en ACTIVE: TRUE pour que le client voie le scraping
            activeScrapeTab = await chrome.tabs.create({ url: searchUrl, active: true });
            
            // Attente du chargement
            setTimeout(async () => {
                emitProgress("Démarrage de l'extraction native...", 20, "info");
                
                try {
                    await chrome.scripting.executeScript({
                        target: { tabId: activeScrapeTab.id },
                        files: ['content-scraper.js']
                    });
                    
                    chrome.tabs.sendMessage(activeScrapeTab.id, { 
                        command: command,
                        params: params 
                    }, (extractionResponse) => {
                        // On ferme l'onglet à la fin (ou on pourrait le laisser ouvert si le client préfère)
                        if (activeScrapeTab) {
                            // chrome.tabs.remove(activeScrapeTab.id); // Optionnel : Décommenter pour fermer l'onglet
                            activeScrapeTab = null;
                        }

                        if (extractionResponse && extractionResponse.error) {
                            reject(new Error(extractionResponse.error));
                        } else {
                            emitProgress(`Scraping ${channel} terminé !`, 100, "success");
                            resolve(extractionResponse?.data || []);
                        }
                    });

                } catch (e) {
                    reject(e);
                }
            }, 6000); 

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
