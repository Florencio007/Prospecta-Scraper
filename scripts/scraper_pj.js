const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const fs = require('fs');
const path = require('path');

// Ajout du plugin Stealth pour éviter DataDome / Cloudflare
puppeteer.use(StealthPlugin());

// Paramètres par défaut
const QUOI = process.argv[2] || "plombier";
const OU = process.argv[3] || "Paris";
const MAX_PAGES = parseInt(process.argv[4] || "2", 10);

const OUTPUT_FILE = path.join(__dirname, 'last_pj_results.json');

async function delay(time) {
    return new Promise(function (resolve) {
        setTimeout(resolve, time);
    });
}

(async () => {
    console.log(`🚀 Lancement du Scraper PagesJaunes : "${QUOI}" à "${OU}" (Max ${MAX_PAGES} pages)`);

    // Lancement de Chrome
    let executablePath = undefined;
    if (process.platform === 'darwin') {
        const chromePaths = [
            '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
            '/Applications/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing',
            path.join(process.env.HOME, 'Applications/Google Chrome.app/Contents/MacOS/Google Chrome'),
            '/Applications/Chromium.app/Contents/MacOS/Chromium',
            '/Applications/Brave Browser.app/Contents/MacOS/Brave Browser'
        ];
        for (const p of chromePaths) {
            if (fs.existsSync(p)) {
                executablePath = p;
                console.log(`🔍 Utilisation du navigateur local : ${p}`);
                break;
            }
        }
    }

    if (!executablePath && process.env.PUPPETEER_EXECUTABLE_PATH) {
        executablePath = process.env.PUPPETEER_EXECUTABLE_PATH;
    }

    if (!executablePath) {
        console.error("❌ ERREUR : Aucun navigateur Chrome/Chromium trouvé dans les dossiers standards.");
        console.error("💡 Astuce : Installez Google Chrome ou spécifiez PUPPETEER_EXECUTABLE_PATH.");
        process.exit(1);
    }

    const browser = await puppeteer.launch({
        headless: false, // PagesJaunes bloque souvent les mode headless true.
        executablePath: executablePath,
        defaultViewport: { width: 1280, height: 800 },
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    const page = await browser.newPage();

    // Configurer le User Agent pour paraitre plus "humain"
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');

    try {
        console.log(`🌐 Navigation vers PagesJaunes.fr...`);
        await page.goto('https://www.pagesjaunes.fr/', { waitUntil: 'networkidle2', timeout: 60000 });

        // 1. Accepter les cookies (Didomi)
        try {
            console.log(`🍪 Tentative d'acceptation des cookies...`);
            await page.waitForSelector('#didomi-notice-agree-button', { timeout: 5000 });
            await page.click('#didomi-notice-agree-button');
            await delay(1000); // Attendre la disparition
        } catch (e) {
            console.log(`ℹ️ Pas de bannière de cookies détectée.`);
        }

        // 2. Remplir le formulaire
        console.log(`✍️ Remplissage de la recherche...`);

        await page.waitForSelector('input[id="quoiqui"]');
        await page.type('input[id="quoiqui"]', QUOI, { delay: 100 });

        // Vider d'abord le champ 'Ou' au cas où
        await page.click('input[id="ou"]', { clickCount: 3 });
        await page.keyboard.press('Backspace');
        await page.type('input[id="ou"]', OU, { delay: 100 });

        // Soumettre et attendre le chargement de la première page de résultat
        console.log(`🔍 Lancement de la recherche...`);
        await Promise.all([
            page.click('button[type="submit"], button.search-button'),
            page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 30000 })
        ]).catch(async (e) => {
            console.log("Navigation timeout or error, checking if we are on results page...");
        });

        let allProspects = [];
        let currentPage = 1;

        while (currentPage <= MAX_PAGES) {
            console.log(`\n📄 Analyse de la page ${currentPage}...`);
            await delay(2000); // Pause humaine

            // Défiler vers le bas pour forcer le chargement de tout le contenu (Lazy loading)
            await page.evaluate(async () => {
                await new Promise((resolve) => {
                    let totalHeight = 0;
                    const distance = 300;
                    const timer = setInterval(() => {
                        const scrollHeight = document.body.scrollHeight;
                        window.scrollBy(0, distance);
                        totalHeight += distance;
                        if (totalHeight >= scrollHeight - window.innerHeight) {
                            clearInterval(timer);
                            resolve();
                        }
                    }, 100);
                });
            });

            // 3. Extraire les blocs de résultats
            const results = await page.$$('li.bi-bloc, div.bi-bloc');
            console.log(`Trouvé ${results.length} résultats sur cette page.`);

            for (let i = 0; i < results.length; i++) {
                const element = results[i];
                try {
                    // Clic sur l'élément pour ouvrir ses détails et le numéro (Optionnel, si besoin de révéler le bouton numéro)
                    const showNumberBtn = await element.$('span.icon-telephone');
                    if (showNumberBtn) {
                        try {
                            await showNumberBtn.click();
                            await delay(1000); // Laisser le temps au numéro de s'afficher
                        } catch (e) { } // Ignorer si non cliquable
                    }

                    // Extraire les infos
                    const prospect = await page.evaluate((el) => {
                        const getSafeText = (selector) => {
                            const node = el.querySelector(selector);
                            return node ? node.innerText.trim() : '';
                        };

                        // Certains numéros apparaissent dans .number-contact après clic ou dans l'attribut
                        let num = getSafeText('.number-contact, .tel-contact, .pj-link[title*="Afficher le n°"], .contact-info');
                        // Nettoyer souvent le texte de PagesJaunes
                        num = num.replace("Afficher le n°", "").replace("Opposé aux opérations de prospection", "").trim();

                        return {
                            name: getSafeText('.bi-denomination h3, .bi-denomination a, .denomination-links, [class*="denomination"]'),
                            activity: getSafeText('.bi-activite, .activite, .categorie-pro, [class*="activite"]'),
                            address: getSafeText('.bi-address, .adresse, .place-name, [class*="adresse"]'),
                            phone: num,
                            source: 'PagesJaunes'
                        };
                    }, element);

                    if (prospect.name) {
                        allProspects.push(prospect);
                        console.log(`  ✅ ${prospect.name} | ${prospect.phone || 'Pas de numéro'}`);
                    }
                } catch (e) {
                    console.error("  ❌ Erreur sur l'extraction d'un profil:", e.message);
                }
            }

            if (currentPage >= MAX_PAGES) break;

            // Passer à la page suivante
            const hasNextPage = await page.$('a.next, a#pagination-next');
            if (hasNextPage) {
                console.log(`➡️ Passage à la page suivante...`);
                await Promise.all([
                    page.click('a.next, a#pagination-next'),
                    page.waitForNavigation({ waitUntil: 'networkidle2' })
                ]);
                currentPage++;
            } else {
                console.log(`🛑 Plus de pages suivantes trouvées.`);
                break;
            }
        }

        // 4. Sauvegarde
        fs.writeFileSync(OUTPUT_FILE, JSON.stringify(allProspects, null, 2), 'utf-8');
        console.log(`\n🎉 Succès ! ${allProspects.length} prospects enregistrés dans: \n${OUTPUT_FILE}`);

    } catch (err) {
        console.error("❌ Une erreur majeure est survenue :", err);
    } finally {
        console.log("Fermeture du navigateur.");
        await browser.close();
    }
})();
