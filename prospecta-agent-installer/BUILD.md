# Prospectator — Build DMG + EXE

## Structure du projet

```
prospecta-installer/
├── src/
│   ├── main.js        ← Process principal Electron
│   ├── preload.js     ← Bridge sécurisé IPC
│   └── index.html     ← Interface utilisateur
├── scripts/
│   ├── server.js                  ← Agent local (copié depuis agent-local/)
│   ├── scraper_linkedin.cjs
│   ├── scraper_facebook.cjs
│   ├── scraper_google.cjs
│   ├── enricher_google.cjs
│   ├── scraper_website_enrich.cjs
│   ├── linkedin_session.cjs
│   └── proxycurl_enricher.cjs
├── assets/
│   ├── icon.icns      ← Icône macOS (1024x1024)
│   ├── icon.ico       ← Icône Windows (256x256)
│   ├── icon.png       ← Icône générique (512x512)
│   └── LICENSE.txt    ← Licence affichée pendant install Windows
├── package.json
└── BUILD.md
```

---

## Prérequis build

```bash
# macOS (pour builder le DMG)
brew install wine  # Optionnel, pour cross-compiler Windows depuis Mac

# Windows (pour builder l'EXE)
# Rien de spécial, Node + npm suffisent
```

---

## Étapes avant le build

### 1. Copier les scripts dans /scripts
```bash
cp ../agent-local/server.js scripts/
cp ../scripts/*.cjs scripts/
```

### 2. Créer les icônes

**Pour macOS (.icns) :**
```bash
# Depuis une image PNG 1024x1024
mkdir icon.iconset
sips -z 16 16     icon.png --out icon.iconset/icon_16x16.png
sips -z 32 32     icon.png --out icon.iconset/icon_16x16@2x.png
sips -z 64 64     icon.png --out icon.iconset/icon_32x32@2x.png
sips -z 128 128   icon.png --out icon.iconset/icon_128x128.png
sips -z 256 256   icon.png --out icon.iconset/icon_128x128@2x.png
sips -z 512 512   icon.png --out icon.iconset/icon_256x256@2x.png
cp icon.png icon.iconset/icon_512x512@2x.png
iconutil -c icns icon.iconset -o assets/icon.icns
```

**Pour Windows (.ico) :**
Utilise https://convertio.co/png-ico/ avec ton PNG 512x512

### 3. Créer assets/LICENSE.txt
```
Prospecta AI Agent Local
Copyright © 2025 Prospecta AI

Ce logiciel est distribué pour usage exclusif avec Prospecta AI.
```

---

## Build

### Installer les dépendances
```bash
cd prospecta-installer
npm install
```

### Builder le DMG (macOS)
```bash
npm run build:mac
# → dist/Prospectator-1.0.0.dmg          (Intel x64)
# → dist/Prospectator-1.0.0-arm64.dmg    (Apple Silicon M1/M2/M3)
```

### Builder le EXE (Windows)
```bash
npm run build:win
# → dist/Prospectator Setup 1.0.0.exe
```

### Builder les deux en même temps (depuis macOS)
```bash
npm run build:all
```

---

## Ce que l'utilisateur voit

### macOS — DMG
1. Télécharge `Prospectator-1.0.0.dmg`
2. Double-clique → fenêtre avec l'icône à glisser dans /Applications
3. Lance l'app depuis /Applications ou le Launchpad
4. L'interface s'ouvre avec les étapes de configuration
5. Clique "Installer l'agent" → Playwright s'installe automatiquement
6. Clique "Démarrer l'agent" → serveur actif sur port 7842
7. Icône dans la barre de menu pour contrôler l'agent

### Windows — EXE
1. Télécharge `Prospectator Setup 1.0.0.exe`
2. Double-clique → installeur NSIS avec interface en français
3. Choisit le dossier d'installation (ou garde le défaut)
4. Raccourci créé sur le Bureau et dans le menu Démarrer
5. Lance "Prospectator" → même interface que macOS
6. Clique "Installer l'agent" → Playwright s'installe
7. Clique "Démarrer l'agent" → serveur actif sur port 7842
8. Icône dans la barre des tâches Windows

---

## Fonctionnement de l'agent installé

```
App Electron lancée
      ↓
Vérifie si Playwright est installé dans %AppData%/ProspectaAgent (Win)
                              ou ~/Library/Application Support/ProspectaAgent (Mac)
      ↓
  Installé → Démarre server.js automatiquement
  Pas installé → Affiche le bouton "Installer l'agent"
      ↓
server.js écoute sur localhost:7842
      ↓
Prospecta AI (cloud) envoie les requêtes de scraping
      ↓
Playwright scrape depuis la machine de l'utilisateur
      ↓
Résultats renvoyés en SSE vers Prospecta AI
```

---

## Héberger les installeurs

Mets les fichiers buildés sur ton serveur à :
```
https://prospecta.soamibango.com/downloads/
├── Prospecta-Agent-mac-x64.dmg
├── Prospecta-Agent-mac-arm64.dmg
└── Prospecta-Agent-win-x64.exe
```

Le modal `AgentDownloadModal.tsx` pointe déjà vers ces URLs via le champ `file` dans `DOWNLOADS`.
