# Icônes à remplacer avant le build

## Fichiers requis

| Fichier | Format | Taille | Usage |
|---------|--------|--------|-------|
| `icon.png` | PNG | 512×512 | Linux + fallback |
| `icon.icns` | ICNS | 1024×1024 (multi-size) | macOS DMG |
| `icon.ico` | ICO | 256×256 | Windows EXE |
| `tray-icon.png` | PNG | 16×16 ou 32×32 | Tray menu |

## Créer icon.icns depuis Mac

```bash
mkdir icon.iconset
sips -z 16 16     icon.png --out icon.iconset/icon_16x16.png
sips -z 32 32     icon.png --out icon.iconset/icon_16x16@2x.png
sips -z 64 64     icon.png --out icon.iconset/icon_32x32@2x.png
sips -z 128 128   icon.png --out icon.iconset/icon_128x128.png
sips -z 256 256   icon.png --out icon.iconset/icon_128x128@2x.png
sips -z 512 512   icon.png --out icon.iconset/icon_256x256@2x.png
cp icon.png       icon.iconset/icon_512x512@2x.png
iconutil -c icns icon.iconset -o icon.icns
```

## Créer icon.ico

Utilise https://convertio.co/png-ico/ avec icon.png
Ou depuis Linux : `convert icon.png -resize 256x256 icon.ico` (ImageMagick)

## En attendant

electron-builder accepte icon.png sur toutes les plateformes si .icns et .ico sont absents
(qualité moindre mais ça compile quand même)
