/**
 * tunnel.js — Expose le serveur Express localement via localtunnel (HTTPS public)
 * 
 * Ce script est nécessaire pour que le pixel de tracking d'ouverture email fonctionne :
 * quand un destinataire ouvre son email, son client mail doit pouvoir charger le pixel
 * depuis une URL publique (pas localhost).
 *
 * Usage : node server/tunnel.js
 * Ou via npm : npm run backend:tunnel
 */

import localtunnel from 'localtunnel';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = parseInt(process.env.PORT || '3001', 10);
const TUNNEL_URL_FILE = path.resolve(__dirname, '../.tunnel-url');

async function startTunnel() {
    console.log(`\n🌐 Démarrage du tunnel localtunnel sur le port ${PORT}...`);
    console.log('   (Cela peut prendre quelques secondes)\n');

    let tunnel;
    let attempts = 0;
    const maxAttempts = 3;

    while (attempts < maxAttempts) {
        try {
            tunnel = await localtunnel({ port: PORT });
            break;
        } catch (err) {
            attempts++;
            if (attempts >= maxAttempts) {
                console.error('❌ Impossible de démarrer localtunnel après', maxAttempts, 'tentatives.');
                console.error('   Erreur:', err.message);
                console.error('\n💡 Solutions alternatives:');
                console.error('   1. Installez ngrok: https://ngrok.com/download');
                console.error('      Puis: ngrok http 3001');
                console.error('   2. Ajoutez SERVER_PUBLIC_URL dans votre .env avec l\'URL ngrok');
                process.exit(1);
            }
            console.log(`   Tentative ${attempts}/${maxAttempts} échouée, nouvel essai...`);
            await new Promise(r => setTimeout(r, 2000));
        }
    }

    const tunnelUrl = tunnel.url;

    // Écrire l'URL dans un fichier pour que app.js puisse la lire
    fs.writeFileSync(TUNNEL_URL_FILE, tunnelUrl, 'utf-8');

    // Définir la variable d'environnement pour ce process (et ses enfants)
    process.env.SERVER_PUBLIC_URL = tunnelUrl;

    console.log('╔══════════════════════════════════════════════════════════╗');
    console.log('║           🚀 TUNNEL LOCALTUNNEL ACTIF                    ║');
    console.log('╠══════════════════════════════════════════════════════════╣');
    console.log(`║  URL publique : ${tunnelUrl.padEnd(42)} ║`);
    console.log('╠══════════════════════════════════════════════════════════╣');
    console.log('║  ✅ Le tracking d\'ouverture email est maintenant actif   ║');
    console.log('║  ✅ Les pixels de tracking seront visibles par les       ║');
    console.log('║     destinataires depuis leurs messageries               ║');
    console.log('╚══════════════════════════════════════════════════════════╝\n');
    console.log('📋 Copiez cette URL dans votre .env si vous voulez la fixer:');
    console.log(`   SERVER_PUBLIC_URL=${tunnelUrl}\n`);

    tunnel.on('close', () => {
        console.log('\n⚠️  Tunnel fermé. Le tracking d\'ouverture ne fonctionnera plus.');
        // Nettoyer le fichier URL
        try { fs.unlinkSync(TUNNEL_URL_FILE); } catch {}
    });

    tunnel.on('error', (err) => {
        console.error('❌ Erreur tunnel:', err.message);
    });

    // Nettoyage à la fermeture
    const cleanup = () => {
        try { fs.unlinkSync(TUNNEL_URL_FILE); } catch {}
        tunnel.close();
        process.exit(0);
    };

    process.on('SIGINT', cleanup);
    process.on('SIGTERM', cleanup);

    return tunnelUrl;
}

startTunnel().catch(err => {
    console.error('❌ Erreur fatale tunnel:', err.message);
    process.exit(1);
});
