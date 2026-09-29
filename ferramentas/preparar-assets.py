# Prepara as imagens da pasta Assets para o site (saída em img).
# Os originais da pasta Assets não são alterados.
#
#   servidor  -> recorte no conteúdo + margem
#   painel    -> recorte + margem para o brilho e "placa limpa": o gráfico, os rótulos do eixo
#                e os números do cabeçalho são apagados, porque o site redesenha tudo isso ao vivo
#
# Uso: python ferramentas/preparar-assets.py
import glob
import json
import os

import numpy as np
from PIL import Image, ImageDraw, ImageFilter

RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ASSETS = os.path.join(RAIZ, "Assets")
SAIDA = os.path.join(RAIZ, "img")
os.makedirs(SAIDA, exist_ok=True)


def achar(trecho):
    for f in glob.glob(os.path.join(ASSETS, "*.png")):
        if trecho in os.path.basename(f):
            return f
    raise SystemExit("não achei a imagem com '%s' em Assets" % trecho)


def fundo_estimado(rgb, bloco, pct):
    """Fundo de baixa frequência de uma região: percentil baixo por bloco, ampliado e suavizado.
    Tira o que é claro e pequeno (velas, texto, grade) e mantém o degradê do vidro."""
    h, w, _ = rgb.shape
    ny, nx = max(1, round(h / bloco)), max(1, round(w / bloco))
    pequeno = np.zeros((ny, nx, 3), dtype=np.float32)
    for j in range(ny):
        for i in range(nx):
            y0, y1 = j * h // ny, (j + 1) * h // ny
            x0, x1 = i * w // nx, (i + 1) * w // nx
            pequeno[j, i] = np.percentile(rgb[y0:y1, x0:x1].reshape(-1, 3), pct, axis=0)
    img = Image.fromarray(np.clip(pequeno, 0, 255).astype(np.uint8), "RGB")
    img = img.resize((w, h), Image.BICUBIC).filter(ImageFilter.GaussianBlur(bloco * 0.35))
    return np.array(img).astype(np.float32)


def limpar(a, caixa, bloco=32, pct=12, raio_tl=0, pena=2.0, repetir_abaixo_de=None):
    """Troca o conteúdo da caixa (x0,y0,x1,y1) pelo fundo estimado, com borda esfumada."""
    x0, y0, x1, y1 = caixa
    regiao = a[y0:y1, x0:x1, :3].astype(np.float32)
    fundo = fundo_estimado(regiao, bloco, pct)
    if repetir_abaixo_de is not None:
        # onde o conteúdo é denso (barras de volume) o percentil pega a cor da barra:
        # repete a última linha boa para baixo
        k = repetir_abaixo_de - y0
        fundo[k:] = fundo[k - 1:k]
    mascara = Image.new("L", (x1 - x0, y1 - y0), 0)
    d = ImageDraw.Draw(mascara)
    m = int(round(pena))
    if raio_tl:
        d.rounded_rectangle((m, m, x1 - x0 - m, y1 - y0 - m), raio_tl, fill=255)
        d.rectangle((m + raio_tl, m, x1 - x0 - m, y1 - y0 - m), fill=255)
        d.rectangle((m, m + raio_tl, x1 - x0 - m, y1 - y0 - m), fill=255)
    else:
        d.rectangle((m, m, x1 - x0 - m, y1 - y0 - m), fill=255)
    mascara = mascara.filter(ImageFilter.GaussianBlur(pena))
    k = (np.array(mascara).astype(np.float32) / 255.0)[..., None]
    a[y0:y1, x0:x1, :3] = np.clip(regiao * (1 - k) + fundo * k, 0, 255).astype(np.uint8)


# ───────────── servidor ─────────────
srv = Image.open(achar("servidor")).convert("RGBA")
al = np.array(srv)[..., 3]
ys, xs = np.where(al > 8)
M = 24
caixa = (max(0, xs.min() - M), max(0, ys.min() - M), min(srv.width, xs.max() + M), min(srv.height, ys.max() + M))
srv = srv.crop(caixa)
srv.save(os.path.join(SAIDA, "servidor.webp"), "WEBP", quality=94, alpha_quality=100, method=6)

# ───────────── painel ─────────────
pan = Image.open(achar("16_30_51")).convert("RGBA")
a = np.array(pan)

# coordenadas na imagem original (1122 x 1402), medidas com régua
GRAFICO = (35, 427, 665, 820)      # interior do gráfico (o site redesenha os eixos)
EIXO = (660, 430, 752, 814)        # rótulos de preço + etiqueta do preço atual
PILULA_VAR = (333, 352, 458, 399)  # "↗ 2,48%"
NUM_PRECO = (482, 349, 591, 381)   # "129.320,45"
NUM_DELTA = (613, 349, 738, 381)   # "+3.125,60"

limpar(a, GRAFICO, bloco=56, pct=8, raio_tl=18, repetir_abaixo_de=690)
limpar(a, EIXO, bloco=40, pct=12)
limpar(a, PILULA_VAR, bloco=20, pct=15)
limpar(a, NUM_PRECO, bloco=16, pct=15)
limpar(a, NUM_DELTA, bloco=16, pct=15)

limpo = Image.fromarray(a, "RGBA")

# recorte com margem: a textura final tem folga em volta para o brilho e para a borda suave
Y0, Y1 = 262, 1111
MARGEM = 40
w, h = pan.width + 2 * MARGEM, (Y1 - Y0) + 2 * MARGEM
tex = Image.new("RGBA", (w, h), (0, 0, 0, 0))
tex.paste(limpo.crop((0, Y0, pan.width, Y1)), (MARGEM, MARGEM))
tex.save(os.path.join(SAIDA, "painel-base.webp"), "WEBP", lossless=True, method=6)

# versão original (sem limpar), no mesmo recorte: serve de comparação
ref = Image.new("RGBA", (w, h), (0, 0, 0, 0))
ref.paste(pan.crop((0, Y0, pan.width, Y1)), (MARGEM, MARGEM))
ref.save(os.path.join(SAIDA, "painel-original.webp"), "WEBP", quality=92, alpha_quality=100, method=6)

medidas = {
    "servidor": {"w": srv.width, "h": srv.height},
    "painel": {"w": w, "h": h, "margem": MARGEM, "dx": MARGEM, "dy": MARGEM - Y0},
}
with open(os.path.join(SAIDA, "medidas.json"), "w", encoding="utf-8") as f:
    json.dump(medidas, f, indent=2)

for nome in sorted(os.listdir(SAIDA)):
    print("%-24s %8.0f KB" % (nome, os.path.getsize(os.path.join(SAIDA, nome)) / 1024))
print(json.dumps(medidas))
