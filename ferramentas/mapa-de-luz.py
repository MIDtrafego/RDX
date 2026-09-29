# Gera o mapa de luz do servidor: acha cada LED da imagem e dá a ele uma identidade,
# para o site animar luz por luz (e não a imagem inteira de uma vez).
#
#   img/servidor-luz.png     R = onde é luz   G = fase do LED (aleatória por LED)   B = tipo (0 LED pequeno, 255 luz grande)
#   img/servidor-brilho.webp a cor das luzes borrada, usada como halo quando o LED acende
#
# Uso: python ferramentas/mapa-de-luz.py   (roda depois do preparar-assets.py)
import os

import numpy as np
from PIL import Image, ImageFilter
from scipy import ndimage

RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
IMG = os.path.join(RAIZ, "img")

srv = Image.open(os.path.join(IMG, "servidor.webp")).convert("RGBA")
a = np.array(srv).astype(np.float32) / 255.0
r, g, b, al = a[..., 0], a[..., 1], a[..., 2], a[..., 3]


def degrau(x, e0, e1):
    t = np.clip((x - e0) / (e1 - e0), 0, 1)
    return t * t * (3 - 2 * t)


# luz = pixel claro, saturado e puxado para o verde ou ciano
v = np.maximum(np.maximum(r, g), b)
mn = np.minimum(np.minimum(r, g), b)
sat = (v - mn) / np.maximum(v, 1e-4)
verde = degrau(g - np.maximum(r * 0.92, b * 0.98), -0.02, 0.06)
luz = degrau(v, 0.42, 0.72) * degrau(sat, 0.16, 0.38) * verde * al

# o miolo das barras de luz é quase branco e escapa do teste de cor: fecha os buracos
cheio = ndimage.binary_fill_holes(luz > 0.45)
luz = np.maximum(luz, cheio.astype(np.float32) * al)

# cada mancha de luz ligada vira um LED com identidade própria
rotulos, n = ndimage.label(luz > 0.45)
areas = ndimage.sum(np.ones_like(luz), rotulos, index=np.arange(1, n + 1))
centros = ndimage.center_of_mass(luz, rotulos, index=np.arange(1, n + 1))

rng = np.random.default_rng(20260929)
fase_de = np.concatenate([[0.0], rng.random(n)])
LIMITE = 260  # px: acima disso é barra de luz, abaixo é LED
tipo_de = np.concatenate([[0.0], (areas > LIMITE).astype(np.float32)])

# espalha a identidade de cada LED para a vizinhança (o halo acompanha o LED mais próximo)
dist, idx = ndimage.distance_transform_edt(rotulos == 0, return_indices=True)
perto = rotulos[idx[0], idx[1]]
fase = fase_de[perto]
tipo = tipo_de[perto]

mapa = np.zeros((srv.height, srv.width, 4), dtype=np.uint8)
mapa[..., 0] = np.clip(luz * 255, 0, 255)
mapa[..., 1] = np.clip(fase * 255, 0, 255)
mapa[..., 2] = np.clip(tipo * 255, 0, 255)
mapa[..., 3] = 255
Image.fromarray(mapa, "RGBA").save(os.path.join(IMG, "servidor-luz.png"), optimize=True)

# halo: a cor das luzes, borrada
cor = np.zeros((srv.height, srv.width, 3), dtype=np.float32)
for c in range(3):
    cor[..., c] = a[..., c] * luz
halo = Image.fromarray(np.clip(cor * 255, 0, 255).astype(np.uint8), "RGB")
largo = np.array(halo.filter(ImageFilter.GaussianBlur(16))).astype(np.float32)
curto = np.array(halo.filter(ImageFilter.GaussianBlur(5))).astype(np.float32)
brilho = np.clip(largo * 1.9 + curto * 0.9, 0, 255).astype(np.uint8)
Image.fromarray(brilho, "RGB").save(os.path.join(IMG, "servidor-brilho.webp"), "WEBP", quality=88, method=6)

# conferência visual: LEDs pequenos em verde, luzes grandes em magenta
conf = np.zeros((srv.height, srv.width, 3), dtype=np.uint8)
base = (np.array(srv.convert("RGB")).astype(np.float32) * 0.35)
conf[...] = base
peq = (rotulos > 0) & (tipo_de[rotulos] < 0.5)
gra = (rotulos > 0) & (tipo_de[rotulos] > 0.5)
conf[peq] = (60, 255, 90)
conf[gra] = (255, 60, 220)
Image.fromarray(conf, "RGB").save(os.path.join(RAIZ, "ferramentas", "_conferir-luz.png"))

print("LEDs encontrados: %d  (pequenos %d, grandes %d)" % (n, int((areas <= LIMITE).sum()), int((areas > LIMITE).sum())))
print("maiores áreas:", sorted(areas.astype(int).tolist())[-8:])
for nome in ("servidor-luz.png", "servidor-brilho.webp"):
    print("%-22s %6.0f KB" % (nome, os.path.getsize(os.path.join(IMG, nome)) / 1024))
