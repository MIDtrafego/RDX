# Vetoriza a logo (Assets/rdx-logo-branco.png, branca em fundo transparente) e grava src/marca-dados.js
# com o contorno de cada peça. A logo chegou só em PNG pequeno (453 x 160): o contorno é tirado do
# canal alfa ampliado, simplificado em retas onde a forma é reta.
#
# Uso: python ferramentas/vetorizar-logo.py
import json
import os

import numpy as np
from PIL import Image, ImageFilter
from skimage import measure

RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ORIGEM = os.path.join(RAIZ, "Assets", "rdx-logo-branco.png")
SAIDA = os.path.join(RAIZ, "src", "marca-dados.js")
SVG = os.path.join(RAIZ, "img", "rdx-logo.svg")
CONFERIR = os.path.join(RAIZ, "ferramentas", "_conferir-logo.png")

AMPLIAR = 8
TOLERANCIA = 0.22   # em px da imagem original: desvio máximo ao trocar curva por reta

im = Image.open(ORIGEM).convert("RGBA")
W, H = im.size
alfa = im.getchannel("A").resize((W * AMPLIAR, H * AMPLIAR), Image.LANCZOS).filter(ImageFilter.GaussianBlur(AMPLIAR * 0.35))
a = np.array(alfa).astype(np.float32) / 255.0
a = np.pad(a, 2)

contornos = measure.find_contours(a, 0.5)
pecas = []
for c in contornos:
    pts = (c[:, ::-1] - 2) / AMPLIAR            # (x, y) na escala da imagem original
    simples = measure.approximate_polygon(pts, TOLERANCIA)
    if len(simples) < 4:
        continue
    xs, ys = simples[:, 0], simples[:, 1]
    area = 0.5 * abs(np.dot(xs, np.roll(ys, 1)) - np.dot(ys, np.roll(xs, 1)))
    if area < 6:
        continue
    pecas.append({
        "pts": simples,
        "area": area,
        "caixa": [float(xs.min()), float(ys.min()), float(xs.max()), float(ys.max())],
    })

# a linha de baixo (TECHNOLOGY) fica separada das letras grandes
CORTE_Y = 125
letras = [p for p in pecas if p["caixa"][1] < CORTE_Y]
texto = [p for p in pecas if p["caixa"][1] >= CORTE_Y]
letras.sort(key=lambda p: p["caixa"][0])
texto.sort(key=lambda p: p["caixa"][0])


def caminho(grupo):
    partes = []
    for p in grupo:
        pts = p["pts"][:-1] if np.allclose(p["pts"][0], p["pts"][-1]) else p["pts"]
        partes.append("M" + " L".join("%.2f %.2f" % (x, y) for x, y in pts) + " Z")
    return " ".join(partes)


dados = {
    "largura": W,
    "altura": H,
    "letras": caminho(letras),
    "assinatura": caminho(texto),
}

with open(SAIDA, "w", encoding="utf-8", newline="\n") as f:
    f.write("// GERADO por ferramentas/vetorizar-logo.py a partir de Assets/rdx-logo-branco.png. Não editar à mão.\n")
    f.write("// letras: contorno de RDX. assinatura: contorno da palavra TECHNOLOGY.\n")
    f.write("export const MARCA = " + json.dumps(dados, indent=2) + ";\n")

# a mesma logo como arquivo .svg, para o topo do site e para quem precisar da marca fora do código
with open(SVG, "w", encoding="utf-8", newline="\n") as f:
    f.write('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 %d %d" fill="#fff" fill-rule="evenodd">' % (W, H))
    f.write('<path d="%s"/><path d="%s"/></svg>\n' % (dados["letras"], dados["assinatura"]))

# conferência: o vetor desenhado por cima da imagem original, ampliado
from PIL import ImageDraw
E = 4
conf = Image.alpha_composite(Image.new("RGBA", (W * E, H * E), (10, 14, 12, 255)), im.resize((W * E, H * E), Image.LANCZOS)).convert("RGB")
d = ImageDraw.Draw(conf)
for p in letras + texto:
    pts = [(x * E, y * E) for x, y in p["pts"]]
    d.line(pts + [pts[0]], fill=(255, 0, 200), width=1)
    for x, y in pts:
        d.ellipse((x - 2, y - 2, x + 2, y + 2), fill=(0, 255, 120))
conf.save(CONFERIR)

print("peças nas letras:", len(letras), "| peças no texto:", len(texto))
for p in letras:
    print("  letra  x %.0f..%.0f  y %.0f..%.0f  %d pontos" % (p["caixa"][0], p["caixa"][2], p["caixa"][1], p["caixa"][3], len(p["pts"])))
print("tamanho do arquivo: %.1f KB" % (os.path.getsize(SAIDA) / 1024))
