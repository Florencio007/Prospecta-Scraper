#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────
#  setup.sh — Prospectator Installer
#  Installe les dépendances et lance le build
#  Usage : ./setup.sh [mac|win|all]
# ─────────────────────────────────────────────────────────────────
set -e
cd "$(dirname "$0")"

TARGET="${1:-all}"
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

echo ""
echo "  ██████╗ ██████╗  ██████╗ ███████╗██████╗ ███████╗ ██████╗████████╗ █████╗"
echo "  ██╔══██╗██╔══██╗██╔═══██╗██╔════╝██╔══██╗██╔════╝██╔════╝╚══██╔══╝██╔══██╗"
echo "  ██████╔╝██████╔╝██║   ██║███████╗██████╔╝█████╗  ██║        ██║   ███████║"
echo "  ██╔═══╝ ██╔══██╗██║   ██║╚════██║██╔═══╝ ██╔══╝  ██║        ██║   ██╔══██║"
echo "  ██║     ██║  ██║╚██████╔╝███████║██║     ███████╗╚██████╗   ██║   ██║  ██║"
echo "  ╚═╝     ╚═╝  ╚═╝ ╚═════╝ ╚══════╝╚═╝     ╚══════╝ ╚═════╝   ╚═╝   ╚═╝  ╚═╝"
echo "  Agent Installer — Build Script"
echo ""

# ── Vérifications ───────────────────────────────────────────────
echo -e "${YELLOW}▶ Vérification de Node.js...${NC}"
if ! command -v node &> /dev/null; then
  echo -e "${RED}✗ Node.js non trouvé. Installez Node.js 18+ depuis https://nodejs.org${NC}"
  exit 1
fi
NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VERSION" -lt 18 ]; then
  echo -e "${RED}✗ Node.js 18+ requis. Version actuelle : $(node -v)${NC}"
  exit 1
fi
echo -e "${GREEN}✓ Node.js $(node -v)${NC}"

# ── Installation npm ─────────────────────────────────────────────
echo -e "${YELLOW}▶ Installation des dépendances npm...${NC}"
npm install
echo -e "${GREEN}✓ Dépendances installées${NC}"

# ── Vérification des icônes ───────────────────────────────────────
echo -e "${YELLOW}▶ Vérification des icônes...${NC}"
if [ ! -f "assets/icon.icns" ] && [ "$(uname)" = "Darwin" ]; then
  echo -e "${YELLOW}⚠ assets/icon.icns manquant — génération depuis icon.png...${NC}"
  if [ -f "assets/icon.png" ]; then
    mkdir -p /tmp/prospecta_iconset.iconset
    sips -z 16 16     assets/icon.png --out /tmp/prospecta_iconset.iconset/icon_16x16.png     &>/dev/null
    sips -z 32 32     assets/icon.png --out /tmp/prospecta_iconset.iconset/icon_16x16@2x.png  &>/dev/null
    sips -z 64 64     assets/icon.png --out /tmp/prospecta_iconset.iconset/icon_32x32@2x.png  &>/dev/null
    sips -z 128 128   assets/icon.png --out /tmp/prospecta_iconset.iconset/icon_128x128.png   &>/dev/null
    sips -z 256 256   assets/icon.png --out /tmp/prospecta_iconset.iconset/icon_128x128@2x.png &>/dev/null
    sips -z 512 512   assets/icon.png --out /tmp/prospecta_iconset.iconset/icon_256x256@2x.png &>/dev/null
    cp assets/icon.png /tmp/prospecta_iconset.iconset/icon_512x512@2x.png
    iconutil -c icns /tmp/prospecta_iconset.iconset -o assets/icon.icns
    echo -e "${GREEN}✓ icon.icns généré${NC}"
  else
    echo -e "${YELLOW}⚠ icon.png absent — build sans icône custom${NC}"
  fi
fi

# ── Build ────────────────────────────────────────────────────────
echo ""
echo -e "${YELLOW}▶ Build cible : ${TARGET}${NC}"
echo ""

case "$TARGET" in
  mac)
    echo "  Building macOS DMG..."
    npm run build:mac
    echo -e "${GREEN}✓ DMG généré dans dist/${NC}"
    ls -lh dist/*.dmg 2>/dev/null || true
    ;;
  win)
    echo "  Building Windows EXE..."
    npm run build:win
    echo -e "${GREEN}✓ EXE généré dans dist/${NC}"
    ls -lh dist/*.exe 2>/dev/null || true
    ;;
  all)
    echo "  Building macOS + Windows + Linux..."
    npm run build:all
    echo -e "${GREEN}✓ Tous les installeurs générés dans dist/${NC}"
    ls -lh dist/ 2>/dev/null || true
    ;;
  *)
    echo -e "${RED}Cible inconnue : $TARGET${NC}"
    echo "Usage : ./setup.sh [mac|win|all]"
    exit 1
    ;;
esac

echo ""
echo -e "${GREEN}✅ Build terminé !${NC}"
echo ""
echo "  Fichiers générés dans dist/ :"
ls dist/ 2>/dev/null | sed 's/^/    /' || echo "    (aucun fichier)"
echo ""
