#!/bin/bash

# start_all.sh — Démarre le serveur Prospecta et le tunnel de tracking
# Usage: ./start_all.sh

echo "----------------------------------------------------"
echo "🚀 Démarrage du système complet Prospecta-Scraper"
echo "----------------------------------------------------"

# Charger les variables d'environnement
if [ -f .env ]; then
  export $(grep -v '^#' .env | xargs)
fi

# Vérifier si Node est installé
if ! command -v node &> /dev/null; then
    echo "❌ Erreur: Node.js n'est pas installé."
    exit 1
fi

# Nettoyer les fichiers temporaires
rm -f .tunnel-url

# Lancer le backend et le tunnel en tâche de fond (ou via concurrently)
# On préfère npm run dev:all:tunnel car il gère déjà les signaux d'arrêt correctement
echo "📡 Initialisation du Backend + Tunnel + Frontend (Vite)..."
npm run dev:all:tunnel

# Note: Ce script reste bloqué sur la commande ci-dessus tant que l'utilisateur n'appuie pas sur Ctrl+C
