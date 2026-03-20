const { chromium } = require('playwright');
const fs = require('fs');

/**
 * ═══════════════════════════════════════════════════════════════════════════════
 *  SCRAPER COMPLET D'ENTREPRISES — Google Search → Sites Officiels Uniquement
 * ═══════════════════════════════════════════════════════════════════════════════
 *
 *  Sources : Google Search (résultats organiques)
 *  Filtre  : Plateformes / portails / réseaux sociaux EXCLUS automatiquement
 *  Cibles  : Tous types d'entreprises (hôtels, restaurants, cliniques, agences…)
 *
 *  Données extraites :
 *  ┌─ CONTACTS ──────────────────────────────────────────────────────────────────
 *  │  Téléphones, Emails, WhatsApp, Adresse physique, Code postal
 *  ├─ DIRIGEANTS / ÉQUIPE ───────────────────────────────────────────────────────
 *  │  Noms, Titres/Postes, Pages "À propos" scrapées
 *  ├─ HORAIRES D'OUVERTURE ──────────────────────────────────────────────────────
 *  │  Lundi→Dimanche, Mentions spéciales (jours fériés, vacances)
 *  ├─ AVIS & RÉPUTATION ─────────────────────────────────────────────────────────
 *  │  Note Google (Knowledge Panel), Notes Trustpilot/autres si présentes
 *  │  Widgets d'avis embarqués dans le site
 *  ├─ RÉSEAUX SOCIAUX ───────────────────────────────────────────────────────────
 *  │  Facebook, Instagram, LinkedIn, Twitter/X, YouTube, TikTok, Pinterest
 *  ├─ TECHNOLOGIES ──────────────────────────────────────────────────────────────
 *  │  CMS, Frameworks, Analytics, Outils de chat, Pixels publicitaires
 *  ├─ PRODUITS / SERVICES ───────────────────────────────────────────────────────
 *  │  Listes de services, Tarifs détectés, Menus, Catalogues
 *  ├─ IDENTITÉ & SEO ────────────────────────────────────────────────────────────
 *  │  Nom, Slogan, Meta description, OG tags, Structured Data (JSON-LD)
 *  └─ LOCALISATION ──────────────────────────────────────────────────────────────
 *     GPS (iframe Maps ou JSON-LD), Adresse, Code postal, Ville, Pays
 *
 *  Usage :
 *    node scraper_google_search_complet.cjs [query] [location] [max_results]
 *
 *  Exemples :
 *    node scraper_google_search_complet.cjs "hotel" "Antananarivo" 20
 *    node scraper_google_search_complet.cjs "restaurant" "Paris" 15
 *    node scraper_google_search_complet.cjs "clinique dentaire" "Lyon" 10
 *    node scraper_google_search_complet.cjs "agence immobiliere" "Casablanca" 25
 *    node scraper_google_search_complet.cjs "cabinet avocat" "Dakar" 12
 *
 *  Output : last_google_search_results.json
 * ═══════════════════════════════════════════════════════════════════════════════
 */

// ── Arguments CLI ─────────────────────────────────────────────────────────────
const QUERY = process.argv[2] && process.argv[2] !== 'undefined' ? process.argv[2] : 'hotel';
const LOCATION = process.argv[3] && process.argv[3] !== 'undefined' ? process.argv[3] : 'Antananarivo';
const MAX_RESULTS = parseInt(process.argv[4] || '20', 10);
const PROSPECT_TYPE = process.argv[5] || 'tous';
const SELECTED_FIELDS = process.argv[6] || '';

// Déduction dynamique du code pays (gl) et langue (hl)
const getRegionConfig = (loc) => {
    const l = loc.toLowerCase();
    if (l.includes('madagascar') || l.includes(' mg') || l.includes(', mg')) return { gl: 'mg', hl: 'fr' };
    if (l.includes('france') || l.includes(' fr') || l.includes(', fr')) return { gl: 'fr', hl: 'fr' };
    if (l.includes('belgique') || l.includes(' be')) return { gl: 'be', hl: 'fr' };
    if (l.includes('suisse') || l.includes(' ch')) return { gl: 'ch', hl: 'fr' };
    if (l.includes('canada') || l.includes(' ca')) return { gl: 'ca', hl: 'fr' };
    if (l.includes('maroc') || l.includes(' ma')) return { gl: 'ma', hl: 'fr' };
    if (l.includes('tunisie') || l.includes(' tn')) return { gl: 'tn', hl: 'fr' };
    if (l.includes('algérie') || l.includes(' dz')) return { gl: 'dz', hl: 'fr' };
    if (l.includes('réunion') || l.includes(' re')) return { gl: 're', hl: 'fr' };
    return { gl: 'mg', hl: 'fr' }; // Défaut Madagascar si non spécifié (context Prospecta)
};

const REGION = getRegionConfig(LOCATION);

const CONFIG = {
    maxResults: MAX_RESULTS,
    outputFile: require('path').join(__dirname, 'last_google_search_results.json'),
    headless: false,
    delayBetweenSites: 1800,
    maxGooglePages: Math.ceil(MAX_RESULTS / 10) + 3,
    // Requêtes Google complémentaires pour enrichir les résultats
    searchVariants: [
        `${QUERY} ${LOCATION}`,
        `${QUERY} ${LOCATION} site officiel`,
        `${QUERY} ${LOCATION} contact`,
    ],
};

// ── Blacklist — plateformes / portails / agrégateurs (500+ domaines) ─────────
const BLACKLIST = new Set([

    // ═══ OTA & RÉSERVATION HÔTELS (mondial) ═══
    'booking.com', 'hotels.com', 'expedia.com', 'expedia.fr', 'expedia.co.uk',
    'agoda.com', 'trivago.com', 'trivago.fr', 'trivago.de', 'trivago.es',
    'hostelworld.com', 'hotelscombined.com', 'kayak.com', 'kayak.fr', 'kayak.co.uk',
    'priceline.com', 'orbitz.com', 'travelocity.com', 'lastminute.com',
    'voyage-prive.com', 'wotif.com', 'cheaptickets.com', 'cheapflights.com',
    'skyscanner.com', 'skyscanner.fr', 'skyscanner.net',
    'momondo.com', 'momondo.fr', 'bravofly.com',
    'accorhotels.com', 'marriott.com', 'hilton.com', 'ihg.com', 'hyatt.com',
    'wyndhamhotels.com', 'bestwestern.com', 'choicehotels.com', 'radissonhotels.com',
    'melia.com', 'nh-hotels.com', 'novotel.com', 'ibis.com',
    'hrs.com', 'hrs.de', 'hotel.de', 'hotel.info',
    'hoteltonight.com', 'hotelscheap.org', 'hotelguides.com',
    'directrooms.com', 'roomkey.com', 'travelclick.com',
    'prestigia.com', 'hotelsclick.com', 'venere.com',
    'laterooms.com', 'superbreak.com', 'ebookers.com',
    'travelzoo.com', 'travelup.com', 'flightnetwork.com',
    'gotogate.com', 'destinia.com', 'liligo.com', 'odigeo.com',
    'opodo.com', 'opodo.fr', 'edreams.com', 'edreams.fr',
    'govoyages.com', 'promovacances.com', 'anyway.com',
    'fr.hotels.com', 'en.hotels.com',

    // ═══ AVIS & NOTES ═══
    'tripadvisor.com', 'tripadvisor.fr', 'tripadvisor.co.uk', 'tripadvisor.de',
    'tripadvisor.es', 'tripadvisor.it', 'tripadvisor.com.au',
    'yelp.com', 'yelp.fr', 'yelp.co.uk', 'yelp.de', 'yelp.es',
    'trustpilot.com', 'trustpilot.fr', 'trustpilot.de', 'trustpilot.co.uk',
    'avis-verifies.com', 'verified-reviews.com', 'verified-reviews.fr',
    'google.com', 'google.fr', 'google.co.uk', 'google.de', 'google.es',
    'google.mg', 'google.com.au', 'google.ca', 'google.be', 'google.ch',
    'foursquare.com', 'swarmapp.com',
    'opinionatedabout.com', 'resellerratings.com',
    'sitejabber.com', 'reviewcenter.com', 'mouthshut.com',
    'customeraffairs.com', 'complaintsboard.com',
    'judysbook.com', 'insiderpages.com', 'rateitall.com',

    // ═══ RESTAURANTS & LIVRAISON ═══
    'thefork.com', 'thefork.fr', 'thefork.co.uk', 'thefork.es',
    'lafourchette.com', 'opentable.com', 'opentable.co.uk',
    'zomato.com', 'deliveroo.com', 'deliveroo.fr', 'deliveroo.co.uk',
    'ubereats.com', 'just-eat.fr', 'just-eat.co.uk', 'just-eat.com',
    'justeat.fr', 'justeat.co.uk', 'takeaway.com',
    'doordash.com', 'grubhub.com', 'menulog.com.au',
    'glovo.com', 'rappi.com', 'foodpanda.com',
    'happycow.net', 'zenchef.com', 'resy.com',
    'eatigo.com', 'chope.co', 'quandoo.fr', 'quandoo.com',
    'restopolitan.com', 'resto.fr', 'menupages.com',

    // ═══ RÉSEAUX SOCIAUX ═══
    'facebook.com', 'instagram.com', 'twitter.com', 'x.com', 'linkedin.com',
    'tiktok.com', 'youtube.com', 'pinterest.com', 'pinterest.fr',
    'snapchat.com', 'reddit.com', 'threads.net',
    'mastodon.social', 'bluesky.social', 'bsky.app',
    'tumblr.com', 'flickr.com', 'vimeo.com', 'dailymotion.com',
    'whatsapp.com', 'telegram.org', 't.me', 'signal.org',
    'discord.com', 'slack.com', 'skype.com',
    'clubhouse.com', 'clubhouse.io',
    'medium.com', 'substack.com', 'beehiiv.com',
    'quora.com', 'stackoverflow.com', 'stackexchange.com',
    'twitch.tv', 'kick.com', 'mixer.com',
    'weibo.com', 'wechat.com', 'qq.com', 'douyin.com',
    'vk.com', 'ok.ru', 'mail.ru',
    'xing.com', 'viadeo.com',
    'lnkd.in',

    // ═══ ANNUAIRES FRANCE ═══
    'pagesjaunes.fr', 'annuaire.fr', 'pagesblanches.fr',
    'societe.com', 'verif.com', 'infogreffe.fr', 'pappers.fr',
    'kompass.com', 'kompass.fr', 'europages.fr', 'europages.com',
    'infobel.com', 'infobel.fr', 'cylex.fr', 'cylex.com',
    'manageo.fr', 'sirene.fr', 'hellopro.fr', 'sortlist.fr',
    'hotelier.pro', 'chambre-commerce.fr', 'cci.fr',
    'annuaire-inversé.fr', '118712.fr', '118218.fr', '118000.fr',
    'justacoté.fr', 'hoodspot.fr', 'central-test.com',
    'decideurs.com', 'score3.fr', 'societeinfo.com',
    'nomination.fr', 'dirigeant.com', 'corporama.com',
    'companyz.fr', 'siren.fr', 'rncs.fr',
    'bizz.fr', 'biz.fr', 'pro.fr',
    'chambre-metiers.fr', 'artisanat.fr',

    // ═══ ANNUAIRES INTERNATIONAL ═══
    'yellowpages.com', 'yellowpages.ca', 'yp.com',
    'whitepages.com', '411.com', 'superpages.com',
    'manta.com', 'chamberofcommerce.com', 'dun.com',
    'dnb.com', 'hoovers.com', 'zoominfo.com',
    'crunchbase.com', 'angellist.com', 'wellfound.com',
    'bizbuysell.com', 'bizquest.com',
    'hotfrog.com', 'brownbook.net', 'n49.ca',
    'canpages.ca', 'Canada411.ca',
    'businessdirectory.com.au', 'truelocal.com.au',
    'locanto.com', 'gumtree.com', 'gumtree.com.au',
    'yelp.com.au',
    'cylex.co.uk', 'yell.com', 'scoot.co.uk', 'thomsonlocal.com',
    'touchlocal.com', 'ufindus.com',
    'gelbeseiten.de', 'dasoertliche.de', 'meinestadt.de',
    'paginegialle.it', 'paginebianche.it',
    'paginasamarillas.com', 'guialocal.com',
    'edicypages.com', 'europages.co.uk',
    'worldbusinessdirectory.com', 'worlddb.com',

    // ═══ ANNUAIRES AFRIQUE & MADAGASCAR ═══
    'madadeal.com', 'moov.mg', 'orange.mg',
    'madagascar-tourisme.com', 'madagascar.travel',
    'moramora.mg', 'habari.mg', 'gasynet.com',
    'annuaire-madagascar.com', 'madainfo.mg',
    'madagascar-contacts.com', 'yellowpages.mg',
    'africa-business.com', 'africabusiness.com',
    'africanews.com', 'businessafrica.net',
    'companiesafrica.com', 'africandirectory.com',
    'yellowpages.africa', 'biznairobi.com',
    'biztanzania.com', 'yellpages.co.za',
    'cylex.co.za', 'yellosa.co.za',
    'businessdirectory.co.za', 'yellowpages.co.za',
    'jumia.com', 'jumia.mg', 'jumia.fr',
    'tonaton.com', 'jiji.ng', 'jiji.com',
    'afribaba.com', 'afrikrea.com',
    'reseaux-afrique.com', 'africa24.com',

    // ═══ MÉDIAS & PRESSE ═══
    'wikipedia.org', 'wikivoyage.org', 'wikimedia.org', 'wikidata.org',
    'wiktionary.org', 'wikinews.org',
    'lemonde.fr', 'lefigaro.fr', 'lci.fr', 'bfmtv.com', '20minutes.fr',
    'liberation.fr', 'lexpress.fr', 'lepoint.fr', 'lobs.fr',
    'nouvelobs.com', 'challenges.fr', 'capital.fr',
    'latribune.fr', 'lesechos.fr', 'bfmbusiness.com',
    'journaldunet.com', '01net.com', 'zdnet.fr',
    'numerama.com', 'nextinpact.com', 'pcmag.com',
    'techcrunch.com', 'theverge.com', 'wired.com',
    'forbes.com', 'bloomberg.com', 'businessinsider.com',
    'reuters.com', 'apnews.com', 'afp.com',
    'bbc.com', 'bbc.co.uk', 'cnn.com', 'nytimes.com',
    'theguardian.com', 'huffpost.com', 'huffingtonpost.fr',
    'ledevoir.com', 'lapresse.ca', 'rue89.com',
    'mediapart.fr', 'arretsurimages.net',
    'midi-madagasikara.mg', 'lexpressmada.com',
    'newsmada.com', 'tribunemada.com', 'matv.mg',
    'rfi.fr', 'france24.com', 'tv5monde.com',
    'voaafrique.com', 'dw.com', 'dw.fr',
    'jeune-afrique.com', 'lepoint-afrique.com',
    'afrik.com', 'afrikarabia.com',

    // ═══ CARTES & NAVIGATION ═══
    'maps.google.com', 'google.com/maps', 'maps.apple.com',
    'openstreetmap.org', 'osm.org', 'waze.com',
    'here.com', 'tomtom.com', 'bing.com/maps',
    'mappy.com', 'viamichelin.fr', 'viamichelin.com',
    'maps.me', 'mapy.cz', 'citymapper.com',
    'komoot.com', 'wikiloc.com',

    // ═══ HÉBERGEMENT & LOCATION COURTE DURÉE ═══
    'airbnb.com', 'airbnb.fr', 'airbnb.co.uk', 'airbnb.de',
    'vrbo.com', 'homeaway.com', 'homeaway.fr',
    'gites-de-france.com', 'clevacances.com',
    'abritel.fr', 'holidaylettings.co.uk',
    'holidayrentals.co.uk', 'rentbyowner.com',
    'flipkey.com', 'housetrip.com',
    'atraveo.com', 'interhome.fr', 'interhome.com',
    'rentalia.com', 'toprural.fr',
    'campingcar-infos.com', 'camping-car.com',
    'campingcar.com', 'park4night.com',
    'campercontact.com', 'rvparky.com',
    'camping.fr', 'huttopia.com',

    // ═══ E-COMMERCE & MARKETPLACES ═══
    'amazon.com', 'amazon.fr', 'amazon.co.uk', 'amazon.de',
    'amazon.es', 'amazon.it', 'amazon.ca', 'amazon.com.au',
    'ebay.com', 'ebay.fr', 'ebay.co.uk', 'ebay.de',
    'leboncoin.fr', 'vinted.fr', 'vinted.com',
    'aliexpress.com', 'aliexpress.fr', 'alibaba.com',
    'wish.com', 'shein.com', 'temu.com',
    'cdiscount.com', 'fnac.com', 'darty.com', 'ldlc.com',
    'boulanger.com', 'rueducommerce.fr',
    'rakuten.fr', 'priceminister.com',
    'mercadolibre.com', 'mercadolivre.com',
    'jumia.com', 'konga.com', 'takealot.com',
    'shopee.com', 'lazada.com', 'tokopedia.com',
    'etsy.com', 'redbubble.com', 'society6.com',
    'esty.fr', 'artisanat-france.com',
    'backmarket.fr', 'backmarket.com', 'swappie.com',
    'refurbed.fr', 'rebuy.de',

    // ═══ EMPLOI & RECRUTEMENT ═══
    'indeed.com', 'indeed.fr', 'indeed.co.uk',
    'linkedin.com', 'glassdoor.com', 'glassdoor.fr',
    'monster.fr', 'monster.com', 'cadremploi.fr',
    'apec.fr', 'pole-emploi.fr', 'francetravail.fr',
    'jobijoba.com', 'regionsjob.com', 'hellowork.com',
    'welcometothejungle.com', 'jobteaser.com',
    'l-expert-comptable.com', 'talents.com',
    'staffme.co', 'malt.fr', 'malt.com',
    'upwork.com', 'freelance.com', 'fiverr.com',
    'peopleperhour.com', 'toptal.com', 'guru.com',
    'freelancer.com', 'workana.com',
    'jobrapido.fr', 'jobrapido.com',
    'talent.io', 'hired.com', 'remoteok.com',
    'weworkremotely.com', 'remote.co',

    // ═══ IMMOBILIER ═══
    'seloger.com', 'leboncoin.fr', 'pap.fr',
    'logic-immo.com', 'bienici.com', 'superimmo.com',
    'fnaim.fr', 'orpi.com', 'century21.fr',
    'laforet.com', 'guy-hoquet.com', 'square-habitat.fr',
    'foncia.com', 'nexity.fr', 'bouygues-immobilier.com',
    'meilleursagents.com', 'efficity.com',
    'rightmove.co.uk', 'zoopla.co.uk', 'onthemarket.com',
    'zillow.com', 'trulia.com', 'redfin.com', 'realtor.com',
    'immobilier.notaires.fr', 'adimmo.net',
    'explorimmo.com', 'drimki.fr',
    'immo-entre-particuliers.com',
    'appartager.com', 'colocation.fr',
    'immonot.com', 'foncier.fr',

    // ═══ TOURISME & VOYAGE ═══
    'lonelyplanet.com', 'routard.com', 'tripadvisor.com',
    'petitfute.com', 'michelin.com', 'viamichelin.com',
    'tourisme.fr', 'tourisme.gouv.fr',
    'atout-france.fr', 'france.fr',
    'visitbrussels.be', 'visitflanders.com',
    'spain.info', 'turismo.es',
    'italia.it', 'enit.it',
    'visitlondon.com', 'visitbritain.com',
    'germany.travel', 'deutschland.de',
    'myswitzerland.com', 'austria.info',
    'visitportugal.com', 'visitgreece.gr',
    'morocco.com', 'visitmorocco.com',
    'southafrica.net', 'southafrica.com',
    'discover-madagascar.com', 'visitafrica.com',
    'geo.fr', 'nationalgeographic.com',
    'voyageons-autrement.com', 'ecotourisme.fr',
    'lonelyplanet.fr', 'rough-guides.com',
    'fodors.com', 'frommers.com',
    'travelfish.org', 'wikitravel.org',
    'travel.gc.ca', 'state.gov/travel',

    // ═══ SANTÉ & MÉDECINE ═══
    'doctolib.fr', 'doctolib.de', 'doctolib.it',
    'maiia.com', 'mondocteur.fr', 'livi.fr',
    'ameli.fr', 'has-sante.fr', 'ansm.sante.fr',
    'sante.fr', 'whocc.no', 'who.int',
    'vidal.fr', 'eurekasante.fr', 'passeportsante.net',
    'sante-sur-le-net.com', 'allodocteurs.fr',
    'practo.com', '1mg.com', 'netmeds.com',
    'zocdoc.com', 'healthgrades.com',
    'webmd.com', 'mayoclinic.org', 'medlineplus.gov',
    'drugs.com', 'rxlist.com',

    // ═══ GOUVERNEMENT & INSTITUTIONS ═══
    'service-public.fr', 'legifrance.gouv.fr',
    'elysee.fr', 'premier-ministre.gouv.fr',
    'impots.gouv.fr', 'ameli.fr', 'caf.fr',
    'urssaf.fr', 'rsi.fr', 'msa.fr',
    'justice.gouv.fr', 'interieur.gouv.fr',
    'diplomatie.gouv.fr', 'tresor.gouv.fr',
    'insee.fr', 'inpi.fr', 'bodacc.fr',
    'europa.eu', 'ec.europa.eu', 'europarl.europa.eu',
    'un.org', 'oecd.org', 'worldbank.org', 'imf.org',
    'who.int', 'unesco.org', 'unicef.org', 'undp.org',
    'wto.org', 'iaea.org',
    'gouv.mg', 'primature.mg', 'presidence.mg',
    'tresor.mg', 'finances.mg', 'commerce.mg',

    // ═══ FORMATION & ÉDUCATION ═══
    'coursera.org', 'udemy.com', 'openclassrooms.com',
    'edx.org', 'skillshare.com', 'lynda.com',
    'linkedin.com/learning', 'pluralsight.com',
    'codecademy.com', 'datacamp.com', 'udacity.com',
    'mooc.fr', 'fun-mooc.fr', 'class-central.com',
    'khanacademy.org', 'duolingo.com', 'babbel.com',
    'busuu.com', 'rosettastone.com',
    'enseignementsup-recherche.gouv.fr',
    'parcoursup.fr', 'onisep.fr', 'cidj.com',
    'campusfrance.org',

    // ═══ TECH & DÉVELOPPEMENT ═══
    'github.com', 'gitlab.com', 'bitbucket.org',
    'stackoverflow.com', 'stackexchange.com',
    'npmjs.com', 'pypi.org', 'rubygems.org',
    'packagist.org', 'crates.io', 'nuget.org',
    'docker.com', 'hub.docker.com',
    'aws.amazon.com', 'azure.microsoft.com',
    'cloud.google.com', 'digitalocean.com',
    'heroku.com', 'netlify.com', 'vercel.com',
    'cloudflare.com', 'fastly.com', 'akamai.com',
    'wordpress.com', 'wordpress.org',
    'wix.com', 'squarespace.com', 'webflow.com',
    'shopify.com', 'bigcommerce.com', 'magento.com',
    'prestashop.com', 'woocommerce.com',
    'w3schools.com', 'developer.mozilla.org', 'mdn.io',
    'css-tricks.com', 'smashingmagazine.com',

    // ═══ FINANCE & BANQUE ═══
    'banque-france.fr', 'amf-france.org',
    'service-public.fr', 'economie.gouv.fr',
    'banquepopulaire.fr', 'caisse-epargne.fr',
    'societegenerale.fr', 'bnpparibas.fr',
    'creditagricole.fr', 'lcl.fr',
    'hsbc.fr', 'hsbc.com', 'bpifrance.fr',
    'ing.fr', 'fortuneo.fr', 'boursorama.com',
    'revolut.com', 'n26.com', 'qonto.com',
    'paypal.com', 'paypal.fr', 'stripe.com',
    'visa.com', 'mastercard.com', 'amex.fr',
    'westernunion.com', 'moneygram.com',
    'payoneer.com', 'wise.com', 'transferwise.com',
    'boursorama.com', 'degiro.fr', 'trade-republic.fr',
    'binance.com', 'coinbase.com', 'kraken.com',

    // ═══ PETITES ANNONCES & OCCASIONS ═══
    'leboncoin.fr', 'vinted.fr', 'vinted.com',
    'lacentrale.fr', 'largusdoccasion.fr',
    'autoscout24.fr', 'autoscout24.com',
    'caradisiac.com', 'largus.fr',
    'paruvendu.fr', 'lbc.co.uk', 'preloved.co.uk',
    'freecycle.org', 'recycler.com',
    'olx.com', 'olx.pl', 'olx.br',
    'mercari.com', 'depop.com', 'poshmark.com',
    'trademe.co.nz', 'gumtree.com.au',
    'avito.ma', 'avito.ru', 'avito.kz',
    'dubizzle.com', 'opensouq.com',

    // ═══ AGRÉGATEURS & COMPARATEURS ═══
    'google.com', 'bing.com', 'yahoo.com',
    'duckduckgo.com', 'qwant.com', 'ecosia.org',
    'yandex.com', 'yandex.ru', 'baidu.com',
    'ask.com', 'aol.com',
    'comparateur-assurance.com', 'assurland.com',
    'meilleurtaux.com', 'panorabanques.com',
    'lesfurets.com', 'lelynx.fr', 'hyperassur.com',
    'idealo.fr', 'idealo.com', 'shopping.com',
    'pricespy.co.uk', 'getpricelist.com',
    'kelkoo.fr', 'kelkoo.com', 'ciao.fr',
    'shopbot.ca', 'nextag.com',
    'rtings.com', 'wirecutter.com', 'thewirecutter.com',
    'clubic.com', '01net.com',

    // ═══ ÉVÉNEMENTIEL & BILLETTERIE ═══
    'eventbrite.com', 'eventbrite.fr',
    'billetweb.fr', 'weezevent.com', 'helloasso.com',
    'ticketmaster.fr', 'ticketmaster.com',
    'fnacspectacles.com', 'digitick.com',
    'festicket.com', 'bandsintown.com', 'songkick.com',
    'meetup.com', 'eventful.com',

    // ═══ AUTRES PORTAILS GÉNÉRAUX ═══
    'groupon.com', 'groupon.fr', 'groupon.co.uk',
    'dealabs.com', 'hotukdeals.com',
    'rakuten.fr', 'rakuten.com',
    'valassis.com', 'coupons.com',
    'dianomi.com', 'outbrain.com', 'taboola.com',
    'marmiton.org', '750g.com', 'cuisineaz.com',
    'allrecipes.com', 'food.com', 'epicurious.com',
    'demotivateur.fr', 'topito.com',
    'buzzfeed.com', '9gag.com', 'ifunny.co',
    'archive.org', 'web.archive.org',
    'pastebin.com', 'hastebin.com',
    'slideshare.net', 'scribd.com', 'issuu.com',
    'academia.edu', 'researchgate.net',
    'semanticscholar.org', 'pubmed.ncbi.nlm.nih.gov',
]);

// ── Utilitaires ───────────────────────────────────────────────────────────────
const sleep = ms => new Promise(r => setTimeout(r, ms));
const cleanTxt = t => t ? t.replace(/[\uE000-\uF8FF\u2000-\u200B\uFEFF\u00A0]/g, '').trim() : '';

function getRootDomain(url) {
    try { return new URL(url).hostname.replace(/^www\./, ''); } catch { return url; }
}

function isOfficialSite(url) {
    if (!url || !url.startsWith('http')) return false;
    const d = getRootDomain(url);
    if (BLACKLIST.has(d)) return false;
    if ([...BLACKLIST].some(b => d.endsWith('.' + b))) return false;
    // Exclure les sous-domaines de plateformes connues
    if (d.includes('booking') || d.includes('tripadvisor') || d.includes('trivago')) return false;
    return true;
}

function emitLog(msg, pct) {
    console.log(msg);
    process.stdout.write(`PROGRESS:${JSON.stringify({ percentage: pct ?? null, message: msg })}\n`);
}

function emitResult(r) {
    process.stdout.write(`RESULT:${JSON.stringify(r)}\n`);
}

// ─────────────────────────────────────────────────────────────────────────────
//  MODULE 1 — COLLECTE DES URLs DEPUIS GOOGLE SEARCH
// ─────────────────────────────────────────────────────────────────────────────

async function collectGoogleUrls(page, limit) {
    const results = [];      // { url, title, snippet, position }
    const seenDomains = new Set();

    for (const variant of CONFIG.searchVariants) {
        if (results.length >= limit) break;
        let pageNum = 0;

        while (results.length < limit && pageNum < CONFIG.maxGooglePages) {
            const start = pageNum * 10;
            const searchUrl = `https://www.google.com/search?q=${encodeURIComponent(variant)}&start=${start}&num=10&hl=${REGION.hl}&gl=${REGION.gl}`;

            emitLog(`🔍 Google "${variant}" — page ${pageNum + 1}`);
            try {
                await page.goto(searchUrl, { waitUntil: 'domcontentloaded', timeout: 25000 });
                await sleep(1500 + Math.random() * 800);
            } catch (err) {
                emitLog(`   ⚠️ Impossible de charger la page Google : ${err.message}`);
                break;
            }

            // Accepter les cookies Google si présents
            try {
                const consentBtn = page.locator(
                    '#L2AGLb, button[aria-label*="Accepter"], button[aria-label*="Accept all"], form[action*="consent"] button'
                ).first();
                if (await consentBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
                    await consentBtn.click();
                    await sleep(1000);
                }
            } catch (_) { }

            // Extraire les résultats organiques
            const pageResults = await page.evaluate(() => {
                const items = [];
                // Sélecteurs robustes pour les résultats organiques Google
                const cards = document.querySelectorAll(
                    'div.g, div[data-sokoban-container], div.tF2Cxc, div[jscontroller] div[data-hveid]'
                );

                cards.forEach(card => {
                    const linkEl = card.querySelector('a[href^="http"]:not([href*="google"])');
                    const titleEl = card.querySelector('h3');
                    const snippetEl = card.querySelector('.VwiC3b, .yXK7lf, .lEBKkf, .IsZvec span, .st');

                    if (!linkEl || !titleEl) return;
                    const url = linkEl.href;
                    const title = titleEl.textContent?.trim() || '';
                    const snippet = snippetEl?.textContent?.trim() || '';

                    if (url && url.startsWith('http') && title && !url.includes('google.com')) {
                        items.push({ url, title, snippet });
                    }
                });

                return items;
            });

            // Filtrer et dédoublonner par domaine racine
            for (const r of pageResults) {
                const domain = getRootDomain(r.url);
                if (!seenDomains.has(domain) && isOfficialSite(r.url)) {
                    seenDomains.add(domain);
                    results.push({ ...r, position: results.length + 1 });
                    if (results.length >= limit) break;
                }
            }

            emitLog(`   ✅ ${results.length}/${limit} sites officiels collectés`);

            // Page suivante ?
            const hasNext = await page.evaluate(() =>
                !!document.querySelector('#pnnext, a[aria-label="Page suivante"], a[id="pnnext"]')
            );
            if (!hasNext || pageResults.length === 0) break;

            pageNum++;
            await sleep(1200 + Math.random() * 600);
        }
    }

    return results.slice(0, limit);
}

// ─────────────────────────────────────────────────────────────────────────────
//  MODULE 2 — SCRAPING DU SITE OFFICIEL (extraction complète)
// ─────────────────────────────────────────────────────────────────────────────

async function scrapeFullSite(page, siteInfo) {
    const { url, title, snippet, position } = siteInfo;
    const result = {
        // Infos Google Search
        name: title?.split(' - ')[0]?.split(' | ')[0]?.trim() || title || url, // Nom par défaut
        googleTitle: title,
        googleSnippet: snippet,
        googlePosition: position,
        url,
        domain: getRootDomain(url),
        contacts: { phones: [], emails: [], whatsapp: [], addresses: [], postalCode: '', city: '', country: '' },
        socials: {},
        reputation: { overallRating: null, reviewCount: 0 },
        services: { list: [], categories: [], prices: [] },
    };

    // ── Chargement de la page principale ──────────────────────────────────────
    try {
        await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 25000 });
        await sleep(1800);
    } catch (err) {
        result.loadError = err.message;
        return result;
    }

    // ── Extraction principale ──────────────────────────────────────────────────
    const data = await page.evaluate(() => {
        const body = document.body?.innerText || '';
        const html = document.documentElement.innerHTML;
        const allText = body;

        // ── 1. IDENTITÉ & SEO ────────────────────────────────────────────────────
        const identity = {
            name: '',
            slogan: '',
            pageTitle: document.title?.trim() || '',
            metaDescription: document.querySelector('meta[name="description"]')?.getAttribute('content')?.trim() || '',
            metaKeywords: document.querySelector('meta[name="keywords"]')?.getAttribute('content')?.trim() || '',
            ogTitle: document.querySelector('meta[property="og:title"]')?.getAttribute('content')?.trim() || '',
            ogDescription: document.querySelector('meta[property="og:description"]')?.getAttribute('content')?.trim() || '',
            ogImage: document.querySelector('meta[property="og:image"]')?.getAttribute('content')?.trim() || '',
            twitterCard: document.querySelector('meta[name="twitter:card"]')?.getAttribute('content')?.trim() || '',
            canonical: document.querySelector('link[rel="canonical"]')?.getAttribute('href')?.trim() || '',
            lang: document.documentElement.lang || '',
            favicon: document.querySelector('link[rel="icon"], link[rel="shortcut icon"]')?.getAttribute('href') || '',
        };

        // Nom via h1 ou JSON-LD
        const h1 = document.querySelector('h1');
        if (h1) identity.name = h1.textContent?.trim() || '';

        // Slogan via tagline, balises meta spécifiques, ou sous-titre
        const taglineEl = document.querySelector('.tagline, .slogan, .subtitle, [class*="tagline"], [class*="slogan"]');
        if (taglineEl) identity.slogan = taglineEl.textContent?.trim() || '';

        // ── 2. CONTACTS ──────────────────────────────────────────────────────────
        const contacts = { phones: [], emails: [], whatsapp: [], addresses: [], postalCode: '', city: '', country: '' };

        // Téléphones — liens tel: + regex
        const phoneSet = new Set();
        document.querySelectorAll('a[href^="tel:"]').forEach(a => {
            const n = a.href.replace('tel:', '').replace(/\s/g, '');
            if (n.length >= 7) phoneSet.add(n);
        });
        const phoneRgx = /(?:\+261|00261|0)[\s.\-]?\d{2}[\s.\-]?\d{2}[\s.\-]?\d{3}[\s.\-]?\d{2}|(?:\+\d{1,3}[\s.\-]?)?\(?\d{2,4}\)?[\s.\-]?\d{2,4}[\s.\-]?\d{2,4}[\s.\-]?\d{2,4}/g;
        (allText.match(phoneRgx) || []).forEach(p => {
            if (p.replace(/\D/g, '').length >= 7) phoneSet.add(p.trim());
        });
        contacts.phones = [...phoneSet];

        // Emails — liens mailto: + regex
        const emailSet = new Set();
        document.querySelectorAll('a[href^="mailto:"]').forEach(a => {
            const e = decodeURIComponent(a.href.replace('mailto:', '').split('?')[0]).trim();
            if (e.includes('@') && e.length < 100) emailSet.add(e.toLowerCase());
        });
        (allText.match(/[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/g) || [])
            .forEach(e => emailSet.add(e.toLowerCase()));
        contacts.emails = [...emailSet]
            .filter(e => !['example', 'domain', 'youremail', 'test', 'placeholder', 'sentry', 'noreply'].some(x => e.includes(x)));

        // WhatsApp
        document.querySelectorAll('a[href*="wa.me"], a[href*="api.whatsapp.com"], a[href*="whatsapp.com/send"]').forEach(a => {
            const num = a.href.match(/(?:wa\.me|phone=)\/?([\d]+)/)?.[1];
            if (num) contacts.whatsapp.push(`+${num}`);
        });
        contacts.whatsapp = [...new Set(contacts.whatsapp)];

        // Adresses physiques
        const addrSet = new Set();
        const addrPatterns = [
            /\d{1,4}[\s,]+(?:rue|avenue|boulevard|allée|impasse|route|chemin|place|villa|lot|bp|b\.p\.|lotissement)[^\n\r,]{5,100}/gi,
            /(?:BP|B\.P\.|Boîte Postale)\s*\d+[^\n\r]{0,80}/gi,
            /(?:Antananarivo|Tana|Fianarantsoa|Mahajanga|Toamasina|Toliara|Antsirabe|Manakara)[^\n\r,]{0,80}/gi,
            /\d{3}\s?\d{2,3}[^\d\n\r]{2,30}(?:Madagascar|Mada|MG)\b/gi,
        ];
        addrPatterns.forEach(pat => {
            (allText.match(pat) || []).forEach(a => {
                const c = a.replace(/\s+/g, ' ').trim();
                if (c.length > 8) addrSet.add(c);
            });
        });
        contacts.addresses = [...addrSet];

        // Code postal & ville depuis JSON-LD
        document.querySelectorAll('script[type="application/ld+json"]').forEach(s => {
            try {
                const d = JSON.parse(s.textContent);
                const processLD = (obj) => {
                    if (!obj || typeof obj !== 'object') return;
                    if (obj.postalCode) contacts.postalCode = obj.postalCode;
                    if (obj.addressLocality) contacts.city = obj.addressLocality;
                    if (obj.addressCountry) contacts.country = typeof obj.addressCountry === 'string' ? obj.addressCountry : obj.addressCountry?.name || '';
                    if (Array.isArray(obj['@graph'])) obj['@graph'].forEach(processLD);
                    if (obj.address) processLD(obj.address);
                };
                processLD(d);
            } catch (_) { }
        });

        // ── 3. GPS ────────────────────────────────────────────────────────────────
        let gps = null;

        // a. Iframe Google Maps
        const iframeSrc = document.querySelector('iframe[src*="maps.google"], iframe[src*="google.com/maps"]')?.src || '';
        const gpsIframe = iframeSrc.match(/[?&]q=(-?\d+\.\d+),(-?\d+\.\d+)/)
            || iframeSrc.match(/@(-?\d+\.\d+),(-?\d+\.\d+)/);
        if (gpsIframe) gps = { lat: parseFloat(gpsIframe[1]), lng: parseFloat(gpsIframe[2]) };

        // b. JSON-LD geo
        if (!gps) {
            document.querySelectorAll('script[type="application/ld+json"]').forEach(s => {
                if (gps) return;
                try {
                    const d = JSON.parse(s.textContent);
                    const findGeo = (o) => {
                        if (!o || typeof o !== 'object') return;
                        if (o.geo?.latitude) { gps = { lat: parseFloat(o.geo.latitude), lng: parseFloat(o.geo.longitude) }; return; }
                        if (o.latitude) { gps = { lat: parseFloat(o.latitude), lng: parseFloat(o.longitude) }; return; }
                        if (Array.isArray(o['@graph'])) o['@graph'].forEach(findGeo);
                        if (o.address) findGeo(o.address);
                    };
                    findGeo(d);
                } catch (_) { }
            });
        }

        // c. Meta geo.position
        if (!gps) {
            const geoMeta = document.querySelector('meta[name="geo.position"]')?.getAttribute('content');
            if (geoMeta) {
                const [lat, lng] = geoMeta.split(';').map(parseFloat);
                if (!isNaN(lat) && !isNaN(lng)) gps = { lat, lng };
            }
        }

        // ── 4. RÉSEAUX SOCIAUX (TOUS les liens trouvés) ──────────────────────────
        const socialPatterns = {
            facebook: /(?:https?:\/\/)?(?:www\.)?facebook\.com\/(?!sharer|dialog|share|plugins|tr\?|login)[^\s"'<>\?#\/][^\s"'<>\?#]*/gi,
            instagram: /(?:https?:\/\/)?(?:www\.)?instagram\.com\/(?!p\/|reel\/|explore)[^\s"'<>\?#\/][^\s"'<>\?#]*/gi,
            twitter: /(?:https?:\/\/)?(?:www\.)?(?:twitter|x)\.com\/(?!intent|share|hashtag|home)[^\s"'<>\?#\/][^\s"'<>\?#]*/gi,
            linkedin: /(?:https?:\/\/)?(?:www\.)?linkedin\.com\/(?:company|in|school)\/[^\s"'<>\?#]*/gi,
            youtube: /(?:https?:\/\/)?(?:www\.)?youtube\.com\/(?:channel\/|user\/|@|c\/)[^\s"'<>\?#]*/gi,
            tiktok: /(?:https?:\/\/)?(?:www\.)?tiktok\.com\/@[^\s"'<>\?#]*/gi,
            pinterest: /(?:https?:\/\/)?(?:www\.)?pinterest\.(?:com|fr)\/(?!pin\/)[^\s"'<>\?#\/][^\s"'<>\?#]*/gi,
            snapchat: /(?:https?:\/\/)?(?:www\.)?snapchat\.com\/add\/[^\s"'<>\?#]*/gi,
            threads: /(?:https?:\/\/)?(?:www\.)?threads\.net\/@[^\s"'<>\?#]*/gi,
        };

        // Retourner TOUS les liens uniques par plateforme
        const socials = {};
        for (const [platform, rgx] of Object.entries(socialPatterns)) {
            const matches = html.match(rgx);
            if (matches) {
                const cleaned = [...new Set(
                    matches
                        .map(u => u.replace(/['"\\]/g, '').split('?')[0].replace(/\/$/, '').trim())
                        .filter(u => u.length > 15 && !u.endsWith('/sharer') && !u.endsWith('/share'))
                        .map(u => u.startsWith('http') ? u : 'https://' + u)
                )];
                if (cleaned.length) socials[platform] = cleaned; // tableau de tous les liens
            }
        }

        // ── 4b. LIENS EXTERNES (partenaires, presse, app stores, plateformes…) ──
        const externalLinks = {
            appStores: [],   // Google Play, App Store
            downloads: [],   // PDF, brochures, catalogues
            platforms: [],   // Booking, TripAdvisor, etc.
            partners: [],   // Autres liens externes
        };

        const ownDomain = window.location.hostname.replace(/^www\./, '');

        document.querySelectorAll('a[href^="http"]').forEach(a => {
            const href = a.href;
            const text = a.textContent?.trim() || a.title || '';
            const linkDomain = href.replace(/^https?:\/\//, '').split('/')[0].replace(/^www\./, '');

            // Exclure le domaine propre et les réseaux sociaux déjà capturés
            if (linkDomain === ownDomain) return;
            if (['facebook.com', 'instagram.com', 'twitter.com', 'x.com', 'linkedin.com',
                'youtube.com', 'tiktok.com', 'pinterest.com', 'snapchat.com', 'threads.net'].includes(linkDomain)) return;

            // App Stores
            if (href.includes('play.google.com/store') || href.includes('apps.apple.com') || href.includes('appstore.com')) {
                externalLinks.appStores.push({ url: href, label: text || linkDomain });
                return;
            }

            // Téléchargements (PDF, DOCX, brochures)
            if (/\.(pdf|docx?|xlsx?|pptx?|zip)(\?|$)/i.test(href) || /brochure|catalogue|tarif|menu|guide/i.test(text)) {
                externalLinks.downloads.push({ url: href, label: text || href.split('/').pop() });
                return;
            }

            // Plateformes connues (OTA, annuaires, avis)
            const knownPlatforms = ['booking.com', 'tripadvisor', 'hotels.com', 'airbnb', 'yelp', 'thefork',
                'trustpilot', 'google.com/maps', 'maps.google', 'foursquare', 'zomato', 'opentable'];
            if (knownPlatforms.some(p => href.includes(p))) {
                externalLinks.platforms.push({ url: href, label: text || linkDomain, platform: linkDomain });
                return;
            }

            // Autres liens externes significatifs (partenaires, presse)
            if (text.length > 2) {
                externalLinks.partners.push({ url: href, label: text, domain: linkDomain });
            }
        });

        // Dédoublonner et limiter
        externalLinks.appStores = [...new Map(externalLinks.appStores.map(x => [x.url, x])).values()];
        externalLinks.downloads = [...new Map(externalLinks.downloads.map(x => [x.url, x])).values()];
        externalLinks.platforms = [...new Map(externalLinks.platforms.map(x => [x.url, x])).values()];
        externalLinks.partners = [...new Map(externalLinks.partners.map(x => [x.url, x])).values()];

        // ── 5. HORAIRES D'OUVERTURE ──────────────────────────────────────────────
        const hours = { raw: [], structured: {}, notes: [] };

        // Depuis JSON-LD openingHours
        document.querySelectorAll('script[type="application/ld+json"]').forEach(s => {
            try {
                const d = JSON.parse(s.textContent);
                const extractHours = (o) => {
                    if (!o || typeof o !== 'object') return;
                    if (o.openingHours) {
                        const h = Array.isArray(o.openingHours) ? o.openingHours : [o.openingHours];
                        hours.raw.push(...h);
                    }
                    if (o.openingHoursSpecification) {
                        (Array.isArray(o.openingHoursSpecification) ? o.openingHoursSpecification : [o.openingHoursSpecification])
                            .forEach(spec => {
                                const days = Array.isArray(spec.dayOfWeek) ? spec.dayOfWeek : [spec.dayOfWeek];
                                days.forEach(day => {
                                    hours.structured[day] = `${spec.opens || ''}–${spec.closes || ''}`;
                                });
                            });
                    }
                    if (Array.isArray(o['@graph'])) o['@graph'].forEach(extractHours);
                };
                extractHours(d);
            } catch (_) { }
        });

        // Depuis le HTML (sections horaires visibles)
        const hoursSection = document.querySelector(
            '.hours, .horaires, .opening-hours, .schedule, [class*="hours"], [class*="horaire"], [itemprop="openingHours"]'
        );
        if (hoursSection) {
            const txt = hoursSection.textContent?.replace(/\s+/g, ' ').trim();
            if (txt && txt.length > 5) hours.notes.push(txt);
        }

        // Regex sur le texte brut
        const daysRegex = /(?:lundi|mardi|mercredi|jeudi|vendredi|samedi|dimanche|monday|tuesday|wednesday|thursday|friday|saturday|sunday)[^.\n\r]{5,60}/gi;
        (allText.match(daysRegex) || []).forEach(h => {
            const clean = h.replace(/\s+/g, ' ').trim();
            if (!hours.notes.includes(clean)) hours.notes.push(clean);
        });

        // ── 6. DIRIGEANTS / ÉQUIPE ───────────────────────────────────────────────
        const team = [];

        // Via JSON-LD (Person, Employee, founder…)
        document.querySelectorAll('script[type="application/ld+json"]').forEach(s => {
            try {
                const d = JSON.parse(s.textContent);
                const extractPerson = (o) => {
                    if (!o || typeof o !== 'object') return;
                    if (o['@type'] === 'Person' && o.name) {
                        team.push({ name: o.name, title: o.jobTitle || o.description || '', source: 'json-ld' });
                    }
                    if (o.founder && o.founder.name) team.push({ name: o.founder.name, title: 'Fondateur/trice', source: 'json-ld' });
                    if (Array.isArray(o.employee)) o.employee.forEach(extractPerson);
                    if (Array.isArray(o['@graph'])) o['@graph'].forEach(extractPerson);
                };
                extractPerson(d);
            } catch (_) { }
        });

        // Via HTML (sections équipe typiques)
        const teamSelectors = [
            '.team-member', '.staff-member', '.person', '.employee', '.team-item',
            '[class*="team"] [class*="member"]', '[class*="staff"]', '[class*="equipe"]',
            '.about-team li', '.notre-equipe li',
        ];
        teamSelectors.forEach(sel => {
            document.querySelectorAll(sel).forEach(el => {
                const nameEl = el.querySelector('[class*="name"], h2, h3, h4, strong, .name');
                const roleEl = el.querySelector('[class*="title"], [class*="role"], [class*="poste"], p, small');
                const imgEl = el.querySelector('img');
                const name = nameEl?.textContent?.trim() || '';
                const role = roleEl?.textContent?.trim() || '';
                const photo = imgEl?.src || '';
                if (name && name.length > 2 && !team.find(t => t.name === name))
                    team.push({ name, title: role, photo, source: 'html' });
            });
        });

        // ── 7. PRODUITS & SERVICES ───────────────────────────────────────────────
        const services = { list: [], categories: [], prices: [], menu: [] };

        // Listes de services
        const serviceSelectors = [
            '.service-title', '.service h3', '.service h4',
            '.product-title', '.product h3',
            '[class*="service"] h2', '[class*="service"] h3',
            '[class*="offre"] h3', '[class*="prestation"] h3',
            'section h3', 'section h4',
            '.card-title', '.item-title',
        ];
        serviceSelectors.forEach(sel => {
            document.querySelectorAll(sel).forEach(el => {
                const t = el.textContent?.trim();
                if (t && t.length > 3 && !services.list.includes(t))
                    services.list.push(t);
            });
        });

        // Catégories de navigation = souvent les services
        document.querySelectorAll('nav a, .menu a, header nav a').forEach(a => {
            const t = a.textContent?.trim();
            if (t && t.length > 2) services.categories.push(t);
        });

        // Tarifs
        const priceRgx = /(?:\d[\d\s.,]*\s*(?:Ar|MGA|€|\$|USD|EUR|FCFA|XOF|MAD|DH)|\$\s*\d+|€\s*\d+)\b/gi;
        (allText.match(priceRgx) || []).forEach(p => {
            const clean = p.replace(/\s+/g, ' ').trim();
            if (!services.prices.includes(clean)) services.prices.push(clean);
        });
        // tous les prix

        // ── 8. AVIS & RÉPUTATION ─────────────────────────────────────────────────
        const reputation = { overallRating: '', reviewCount: '', reviews: [], widgets: [] };

        // JSON-LD aggregateRating
        document.querySelectorAll('script[type="application/ld+json"]').forEach(s => {
            try {
                const d = JSON.parse(s.textContent);
                const findRating = (o) => {
                    if (!o || typeof o !== 'object') return;
                    if (o.aggregateRating) {
                        reputation.overallRating = o.aggregateRating.ratingValue?.toString() || '';
                        reputation.reviewCount = o.aggregateRating.reviewCount?.toString() || o.aggregateRating.ratingCount?.toString() || '';
                    }
                    if (Array.isArray(o.review)) {
                        o.review.forEach(r => {
                            reputation.reviews.push({
                                author: r.author?.name || 'Anonyme',
                                rating: r.reviewRating?.ratingValue?.toString() || '',
                                text: r.reviewBody?.trim() || '',
                                date: r.datePublished || '',
                            });
                        });
                    }
                    if (Array.isArray(o['@graph'])) o['@graph'].forEach(findRating);
                };
                findRating(d);
            } catch (_) { }
        });

        // Widgets d'avis HTML
        ['.rating', '.reviews', '[class*="review"]', '[class*="avis"]', '[class*="testimonial"]'].forEach(sel => {
            const el = document.querySelector(sel);
            if (el) {
                const txt = el.textContent?.replace(/\s+/g, ' ').trim();
                if (txt && txt.length > 10) reputation.widgets.push(txt);
            }
        });

        // ── 9. TECHNOLOGIES ──────────────────────────────────────────────────────
        const technologies = { cms: [], frameworks: [], analytics: [], marketing: [], chat: [], other: [] };

        // CMS
        if (html.includes('wp-content') || html.includes('wp-includes') || html.includes('wordpress')) technologies.cms.push('WordPress');
        if (window.Wix || html.includes('static.wixstatic.com') || html.includes('wixsite.com')) technologies.cms.push('Wix');
        if (html.includes('squarespace.com')) technologies.cms.push('Squarespace');
        if (html.includes('webflow.io') || html.includes('webflow.com/assets')) technologies.cms.push('Webflow');
        if (html.includes('shopify')) technologies.cms.push('Shopify');
        if (html.includes('prestashop')) technologies.cms.push('PrestaShop');
        if (html.includes('joomla')) technologies.cms.push('Joomla');
        if (html.includes('drupal')) technologies.cms.push('Drupal');

        // Frameworks
        if (html.includes('__NEXT_DATA__')) technologies.frameworks.push('Next.js');
        if (html.includes('nuxt')) technologies.frameworks.push('Nuxt.js');
        if (html.includes('react')) technologies.frameworks.push('React');
        if (html.includes('vue.js') || html.includes('__vue__') || html.includes('vuejs')) technologies.frameworks.push('Vue.js');
        if (html.includes('angular')) technologies.frameworks.push('Angular');
        if (html.includes('jquery')) technologies.frameworks.push('jQuery');
        if (html.includes('bootstrap')) technologies.frameworks.push('Bootstrap');
        if (html.includes('tailwind')) technologies.frameworks.push('Tailwind CSS');
        if (html.includes('laravel')) technologies.frameworks.push('Laravel');

        // Analytics
        if (html.includes('gtag') || html.includes('google-analytics') || html.includes('UA-') || html.includes('G-')) technologies.analytics.push('Google Analytics');
        if (html.includes('hotjar')) technologies.analytics.push('Hotjar');
        if (html.includes('mixpanel')) technologies.analytics.push('Mixpanel');
        if (html.includes('segment.com')) technologies.analytics.push('Segment');
        if (html.includes('clarity.ms') || html.includes('microsoft clarity')) technologies.analytics.push('Microsoft Clarity');
        if (html.includes('plausible')) technologies.analytics.push('Plausible');

        // Marketing & pixels
        if (html.includes('facebook.net/signals') || html.includes('fbq(') || html.includes('facebook-jssdk')) technologies.marketing.push('Facebook Pixel');
        if (html.includes('ads.google.com') || html.includes('googleadservices')) technologies.marketing.push('Google Ads');
        if (html.includes('mailchimp')) technologies.marketing.push('Mailchimp');
        if (html.includes('hubspot')) technologies.marketing.push('HubSpot');
        if (html.includes('klaviyo')) technologies.marketing.push('Klaviyo');
        if (html.includes('sendinblue') || html.includes('brevo.com')) technologies.marketing.push('Brevo/Sendinblue');

        // Chat
        if (html.includes('crisp.chat') || html.includes('crisp-cdn')) technologies.chat.push('Crisp');
        if (html.includes('tawk.to') || html.includes('tawkto')) technologies.chat.push('Tawk.to');
        if (html.includes('intercom')) technologies.chat.push('Intercom');
        if (html.includes('zendesk')) technologies.chat.push('Zendesk');
        if (html.includes('tidio')) technologies.chat.push('Tidio');
        if (html.includes('drift.com')) technologies.chat.push('Drift');
        if (html.includes('livechat')) technologies.chat.push('LiveChat');

        // ── 10. FORMULAIRES DE CONTACT ────────────────────────────────────────────
        const forms = [];
        document.querySelectorAll('form').forEach(f => {
            const fields = Array.from(f.querySelectorAll('input, textarea, select'))
                .map(el => ({ type: el.type || 'textarea', name: el.name || el.id || el.placeholder || '' }))
                .filter(f => f.name && !['submit', 'button', 'reset', 'hidden'].includes(f.type));
            if (fields.length > 1) {
                forms.push({
                    action: f.action || '',
                    method: f.method || 'GET',
                    hasFile: !!f.querySelector('input[type="file"]'),
                    fields: fields,
                });
            }
        });

        // ── 11. NAVIGATION & PAGES CLÉS ──────────────────────────────────────────
        const navLinks = [];
        document.querySelectorAll('nav a, header a, .menu a, #menu a, .navbar a, .navigation a').forEach(a => {
            const t = a.textContent?.trim();
            const h = a.href;
            if (t && h && t.length > 1 && !h.startsWith('#')
                && !h.includes('facebook') && !h.includes('instagram')
                && !navLinks.find(x => x.text === t))
                navLinks.push({ text: t, href: h });
        });

        // ── 12. CONTENU TEXTUEL PRINCIPAL ─────────────────────────────────────────
        const mainContent = Array.from(
            document.querySelectorAll('main p, article p, .content p, .about p, .description p, .intro p, section p')
        )
            .map(el => el.textContent?.trim())
            .filter(t => t && t.length > 60)
            .join('\n\n');

        // ── 13. STRUCTURED DATA COMPLET ───────────────────────────────────────────
        const structuredData = [];
        document.querySelectorAll('script[type="application/ld+json"]').forEach(s => {
            try { structuredData.push(JSON.parse(s.textContent)); } catch (_) { }
        });

        // ── 14. IMAGES (logo, hero) ───────────────────────────────────────────────
        const images = {
            logo: document.querySelector('.logo img, header img, [class*="logo"] img')?.src || '',
            hero: document.querySelector('.hero img, .banner img, [class*="hero"] img, section:first-of-type img')?.src || '',
        };

        // ── 15. CERTIFICATS & BADGES ─────────────────────────────────────────────
        const certifications = [];
        document.querySelectorAll('img[alt*="certif"], img[alt*="label"], img[alt*="ISO"], img[alt*="badge"], [class*="certif"], [class*="label-"]').forEach(el => {
            const t = el.alt || el.textContent?.trim();
            if (t && !certifications.includes(t)) certifications.push(t);
        });

        return {
            identity, contacts, gps, socials, externalLinks, hours, team,
            services, reputation, technologies, forms, navLinks,
            mainContent, structuredData, images, certifications,
        };
    });

    // ── Enrichissement : visiter la page Contact si elle existe ───────────────
    let contactPageData = null;
    const contactLink = data.navLinks.find(l =>
        /contact|nous joindre|nous trouver|about us|à propos/i.test(l.text)
    );

    if (contactLink && contactLink.href && contactLink.href.startsWith('http')) {
        try {
            emitLog(`   📞 Visite page Contact : ${contactLink.href}`);
            await page.goto(contactLink.href, { waitUntil: 'domcontentloaded', timeout: 18000 });
            await sleep(1200);

            contactPageData = await page.evaluate(() => {
                const body = document.body?.innerText || '';
                const phoneSet = new Set();
                document.querySelectorAll('a[href^="tel:"]').forEach(a => phoneSet.add(a.href.replace('tel:', '')));
                const emailSet = new Set();
                document.querySelectorAll('a[href^="mailto:"]').forEach(a => emailSet.add(a.href.replace('mailto:', '').split('?')[0]));

                const addrSet = new Set();
                const addrRgx = /(?:Antananarivo|Tana|Madagascar|Mada|rue|avenue|boulevard|lot)[^\n\r,]{5,100}/gi;
                (body.match(addrRgx) || []).forEach(a => addrSet.add(a.replace(/\s+/g, ' ').trim()));

                return {
                    extraPhones: [...phoneSet],
                    extraEmails: [...emailSet],
                    extraAddresses: [...addrSet],
                    contactText: body,
                };
            });
        } catch (_) { }
    }

    // ── Assemblage final ───────────────────────────────────────────────────────
    const allPhones = [...new Set([
        ...data.contacts.phones,
        ...(contactPageData?.extraPhones || []),
    ])];

    const allEmails = [...new Set([
        ...data.contacts.emails,
        ...(contactPageData?.extraEmails || []),
    ])];

    const allAddresses = [...new Set([
        ...data.contacts.addresses,
        ...(contactPageData?.extraAddresses || []),
    ])];

    return {
        ...result,
        // ── IDENTITÉ
        name: result.googleTitle?.split(' - ')[0]?.split(' | ')[0]?.trim() || result.googleTitle || data.identity.name || result.name,
        slogan: data.identity.slogan,
        pageTitle: data.identity.pageTitle,
        metaDescription: data.identity.metaDescription || data.identity.ogDescription,
        ogImage: data.identity.ogImage,
        lang: data.identity.lang,
        canonical: data.identity.canonical,
        logo: data.images.logo,

        // ── SOURCE GOOGLE
        googleTitle: result.googleTitle,
        googleSnippet: result.googleSnippet,
        googlePosition: result.googlePosition,
        googleSearchUrl: `https://www.google.com/search?q=${encodeURIComponent(QUERY + ' ' + LOCATION)}`,
        url: result.url,
        domain: result.domain,

        // ── CONTACTS
        contacts: {
            phones: allPhones,
            emails: allEmails,
            whatsapp: data.contacts.whatsapp,
            addresses: allAddresses,
            postalCode: data.contacts.postalCode,
            city: data.contacts.city,
            country: data.contacts.country,
        },

        // ── LOCALISATION
        gps: data.gps,

        // ── RÉSEAUX SOCIAUX (tous les liens trouvés par plateforme)
        socials: data.socials,

        // ── LIENS EXTERNES
        externalLinks: data.externalLinks,

        // ── HORAIRES
        hours: {
            raw: data.hours.raw,
            structured: data.hours.structured,
            notes: data.hours.notes,
        },

        // ── ÉQUIPE
        team: data.team,

        // ── PRODUITS / SERVICES
        services: {
            list: data.services.list,
            categories: data.services.categories,
            prices: data.services.prices,
        },

        // ── RÉPUTATION & AVIS
        reputation: {
            overallRating: data.reputation.overallRating,
            reviewCount: data.reputation.reviewCount,
            reviews: data.reputation.reviews,
            widgets: data.reputation.widgets,
        },

        // ── TECHNOLOGIES
        technologies: data.technologies,

        // ── FORMULAIRES
        forms: data.forms,

        // ── NAVIGATION
        navLinks: data.navLinks,

        // ── CONTENU
        mainContent: data.mainContent,

        // ── STRUCTURED DATA
        structuredData: data.structuredData,

        // ── CERTIFICATIONS
        certifications: data.certifications,

        // ── META
        scrapedAt: new Date().toISOString(),
        platform: 'Site Officiel (Google Search)',
    };
}

// ─────────────────────────────────────────────────────────────────────────────
//  MAIN
// ─────────────────────────────────────────────────────────────────────────────

async function main() {
    console.log('\n╔════════════════════════════════════════════════════════════════╗');
    console.log('║  SCRAPER COMPLET — Google Search → Sites Officiels             ║');
    console.log('╚════════════════════════════════════════════════════════════════╝\n');
    console.log(`🔎 Requête    : "${QUERY} ${LOCATION}"`);
    console.log(`📊 Objectif   : ${MAX_RESULTS} entreprises`);
    console.log(`🚫 Blacklist  : ${BLACKLIST.size} domaines exclus\n`);

    const browser = await chromium.launch({
        headless: false,
        args: [
            '--no-sandbox', '--disable-setuid-sandbox',
            '--lang=fr-FR', '--disable-blink-features=AutomationControlled',
            '--disable-dev-shm-usage',
        ],
    });

    const context = await browser.newContext({
        viewport: { width: 1366, height: 768 },
        userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
        locale: 'fr-FR',
    });
    await context.addInitScript(() => {
        Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
        window.chrome = { runtime: {} };
    });

    const page = await context.newPage();

    try {
        // Phase 1 : Collecter les URLs
        emitLog('🌐 Phase 1 — Collecte des URLs depuis Google Search...', 5);
        const googleResults = await collectGoogleUrls(page, MAX_RESULTS);
        emitLog(`✅ ${googleResults.length} sites officiels identifiés`, 20);

        if (googleResults.length === 0) {
            emitLog('⚠️ Aucun résultat trouvé. Essayez une autre requête.', 100);
            await browser.close(); return;
        }

        // Phase 2 : Scraper chaque site
        const records = [];
        for (let i = 0; i < googleResults.length; i++) {
            const pct = 20 + Math.floor((i / googleResults.length) * 75);
            emitLog(`\n🌐 [${i + 1}/${googleResults.length}] ${googleResults[i].url}`, pct);

            try {
                const record = await scrapeFullSite(page, googleResults[i]);
                records.push(record);
                emitResult(record);

                // Résumé lisible
                const s = record;
                console.log('\n   ┌──────────────────────────────────────────────────────');
                console.log('   │ 📛  ' + s.name);
                console.log('   │ 🌐  ' + s.url);
                console.log('   ├──────────────────────────────────────────────────────');
                console.log('   │ 📞  Tél      : ' + (s.contacts.phones.join(' | ') || '—'));
                console.log('   │ 📧  Email    : ' + (s.contacts.emails.join(' | ') || '—'));
                console.log('   │ 💬  WhatsApp : ' + (s.contacts.whatsapp.join(' | ') || '—'));
                console.log('   │ 📍  Adresse  : ' + (s.contacts.addresses[0] || '—'));
                console.log('   │ 🗺️   GPS      : ' + (s.gps ? s.gps.lat + ', ' + s.gps.lng : '—'));
                console.log('   ├──────────────────────────────────────────────────────');
                const socialsEntries = Object.entries(s.socials || {});
                if (socialsEntries.length) {
                    console.log('   │ 📱  RÉSEAUX SOCIAUX :');
                    for (const [platform, links] of socialsEntries) {
                        const allLinks = Array.isArray(links) ? links : [links];
                        allLinks.forEach(link => console.log('   │     ' + platform.padEnd(12) + ': ' + link));
                    }
                } else {
                    console.log('   │ 📱  Réseaux   : —');
                }
                console.log('   ├──────────────────────────────────────────────────────');
                const el = s.externalLinks || {};
                if ((el.appStores || []).length) console.log('   │ 📲  App Stores  : ' + el.appStores.map(x => x.label || x.url).join(' | '));
                if ((el.downloads || []).length) console.log('   │ 📄  Fichiers    : ' + el.downloads.length + ' — ' + el.downloads.map(x => x.url).join(' | '));
                if ((el.platforms || []).length) console.log('   │ 🔗  Plateformes : ' + el.platforms.map(x => x.platform + ': ' + x.url).join(' | '));
                if ((el.partners || []).length) console.log('   │ 🤝  Partenaires : ' + el.partners.length + ' lien(s) — ' + el.partners.map(x => x.domain).join(', '));
                console.log('   ├──────────────────────────────────────────────────────');
                console.log('   │ ⭐  Note     : ' + (s.reputation.overallRating || '—') + ' (' + (s.reputation.reviewCount || '?') + ' avis)');
                console.log('   │ 🕐  Horaires : ' + (s.hours.notes[0] || '—'));
                console.log('   │ 👥  Équipe   : ' + (s.team.map(t => t.name + (t.title ? ' (' + t.title + ')' : '')).join(', ') || '—'));
                console.log('   │ 📦  Services : ' + (s.services.list.join(', ') || s.services.categories.join(', ') || '—'));
                console.log('   │ 💰  Tarifs   : ' + (s.services.prices.join(' | ') || '—'));
                console.log('   │ 🔧  Techno   : ' + ([...Object.values(s.technologies).flat()].join(', ') || '—'));
                console.log('   └──────────────────────────────────────────────────────');
            } catch (err) {
                emitLog(`   ❌ Erreur : ${err.message}`, pct);
                records.push({ url: googleResults[i].url, name: googleResults[i].title, error: err.message });
            }

            await sleep(CONFIG.delayBetweenSites);
        }

        // Phase 3 : Sauvegarde
        emitLog('\n💾 Sauvegarde...', 97);

        const stats = {
            total: records.length,
            avecTelephone: records.filter(r => r.contacts?.phones?.length).length,
            avecEmail: records.filter(r => r.contacts?.emails?.length).length,
            avecWhatsApp: records.filter(r => r.contacts?.whatsapp?.length).length,
            avecAdresse: records.filter(r => r.contacts?.addresses?.length).length,
            avecGPS: records.filter(r => r.gps).length,
            avecReseaux: records.filter(r => Object.keys(r.socials || {}).length).length,
            avecHoraires: records.filter(r => r.hours?.notes?.length || Object.keys(r.hours?.structured || {}).length).length,
            avecEquipe: records.filter(r => r.team?.length).length,
            avecServices: records.filter(r => r.services?.list?.length || r.services?.categories?.length).length,
            avecAvis: records.filter(r => r.reputation?.overallRating || r.reputation?.reviews?.length).length,
            avecTarifs: records.filter(r => r.services?.prices?.length).length,
            avecFormulaire: records.filter(r => r.forms?.length).length,
            avecAppStore: records.filter(r => r.externalLinks?.appStores?.length).length,
            avecDownloads: records.filter(r => r.externalLinks?.downloads?.length).length,
            avecPlateformes: records.filter(r => r.externalLinks?.platforms?.length).length,
            avecPartenaires: records.filter(r => r.externalLinks?.partners?.length).length,
        };

        const output = {
            scrapedAt: new Date().toISOString(),
            query: `${QUERY} ${LOCATION}`,
            location: LOCATION,
            stats,
            enterprises: records,
        };
        //node scraper_google_search_complet.cjs  
        fs.writeFileSync(CONFIG.outputFile, JSON.stringify(output, null, 2), 'utf8');

        console.log('\n╔════════════════════════════════════════════════════════════════╗');
        console.log('║                     EXTRACTION TERMINÉE                       ║');
        console.log('╠════════════════════════════════════════════════════════════════╣');
        Object.entries(stats).forEach(([k, v]) => {
            const label = k.padEnd(20);
            const bar = '█'.repeat(Math.round((v / stats.total) * 20)).padEnd(20);
            console.log(`║  ${label}: ${String(v).padStart(3)} ${bar} ║`);
        });
        console.log(`╠════════════════════════════════════════════════════════════════╣`);
        console.log(`║  Fichier : ${CONFIG.outputFile.padEnd(52)}║`);
        console.log('╚════════════════════════════════════════════════════════════════╝\n');

        emitLog('🏁 Terminé !', 100);

    } finally {
        await browser.close();
    }
}

main().catch(console.error);
