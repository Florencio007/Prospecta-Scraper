#!/usr/bin/env python3
"""
Génère icon.png (512x512) pour Prospectator
Utilisé comme placeholder tant que le vrai logo n'est pas fourni
"""
import struct, zlib, os

def make_png(width, height, pixels_rgb):
    def chunk(name, data):
        c = struct.pack('>I', len(data)) + name + data
        return c + struct.pack('>I', zlib.crc32(name + data) & 0xffffffff)

    raw = b''
    for y in range(height):
        raw += b'\x00'
        for x in range(width):
            raw += bytes(pixels_rgb[y][x])

    sig = b'\x89PNG\r\n\x1a\n'
    ihdr = chunk(b'IHDR', struct.pack('>IIBBBBB', width, height, 8, 2, 0, 0, 0))
    idat = chunk(b'IDAT', zlib.compress(raw))
    iend = chunk(b'IEND', b'')
    return sig + ihdr + idat + iend

W = H = 512
pixels = [[(0, 0, 0)] * W for _ in range(H)]

# Fond dégradé violet foncé → bleu nuit
for y in range(H):
    for x in range(W):
        t = (x + y) / (W + H)
        r = int(15 + t * 20)
        g = int(15 + t * 15)
        b = int(35 + t * 50)
        pixels[y][x] = (r, g, b)

# Cercle de fond (blanc semi-transparent simulé avec gris clair)
cx, cy, radius = W//2, H//2, 180
for y in range(H):
    for x in range(W):
        dist = ((x - cx)**2 + (y - cy)**2) ** 0.5
        if dist < radius:
            blend = 0.15
            r, g, b = pixels[y][x]
            pixels[y][x] = (
                min(255, int(r + (255 - r) * blend)),
                min(255, int(g + (255 - g) * blend)),
                min(255, int(b + (255 - b) * blend)),
            )

# Icône loupe simplifiée
# Cercle de la loupe
lx, ly, lr = W//2 - 30, H//2 - 30, 100
thick = 18
for y in range(H):
    for x in range(W):
        dist = ((x - lx)**2 + (y - ly)**2) ** 0.5
        if lr - thick < dist < lr:
            pixels[y][x] = (91, 91, 255)  # violet Prospecta

# Manche de la loupe
for i in range(90):
    px = lx + int(lr * 0.7) + i
    py = ly + int(lr * 0.7) + i
    for dx in range(-thick//2, thick//2):
        for dy in range(-thick//2, thick//2):
            nx, ny = px + dx, py + dy
            if 0 <= nx < W and 0 <= ny < H:
                pixels[ny][nx] = (91, 91, 255)

out_path = os.path.join(os.path.dirname(__file__), 'icon.png')
with open(out_path, 'wb') as f:
    f.write(make_png(W, H, pixels))

print(f"icon.png généré : {out_path}")
