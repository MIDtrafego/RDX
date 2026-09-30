# Prepara as imagens das seções (Assets/1.png a 7.png, geradas pelo Yuri) para o site.
# Recorta na proporção de cada espaço, reduz e grava em img/. Os originais não são alterados.
#
# Uso: python ferramentas/preparar-imagens.py
import os

from PIL import Image

RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ASSETS = os.path.join(RAIZ, "Assets")
SAIDA = os.path.join(RAIZ, "img")

# origem, nome no site, proporção (largura / altura), largura final, onde ancorar o recorte (0 a 1)
IMAGENS = [
    ("1.png", "secao-01-continuo", 3 / 4, 720, (0.5, 0.5)),
    ("2.png", "secao-02-latencia", 3 / 4, 900, (0.5, 0.5)),
    ("3.png", "secao-03-tempo-real", 3 / 4, 720, (0.5, 0.5)),
    ("4.png", "secao-04-descansa", 4 / 5, 900, (0.5, 0.45)),
    ("5.png", "secao-05-core-a", 2 / 3, 900, (0.5, 0.5)),
    ("6.png", "secao-06-core-b", 2 / 3, 900, (0.5, 0.5)),
]


def recortar(im, proporcao, ancora):
    w, h = im.size
    if w / h > proporcao:
        nw, nh = int(round(h * proporcao)), h
    else:
        nw, nh = w, int(round(w / proporcao))
    x = int(round((w - nw) * ancora[0]))
    y = int(round((h - nh) * ancora[1]))
    return im.crop((x, y, x + nw, y + nh))


for origem, nome, proporcao, largura, ancora in IMAGENS:
    im = recortar(Image.open(os.path.join(ASSETS, origem)).convert("RGB"), proporcao, ancora)
    im = im.resize((largura, int(round(largura / proporcao))), Image.LANCZOS)
    destino = os.path.join(SAIDA, nome + ".webp")
    im.save(destino, "WEBP", quality=82, method=6)
    print("%-26s %4d x %4d  %5.0f KB" % (nome + ".webp", im.width, im.height, os.path.getsize(destino) / 1024))

# capa de compartilhamento: 1200 x 630, em JPEG, que é o que todo aplicativo de mensagem aceita
capa = recortar(Image.open(os.path.join(ASSETS, "7.png")).convert("RGB"), 1200 / 630, (0.5, 0.5))
capa = capa.resize((1200, 630), Image.LANCZOS)
destino = os.path.join(SAIDA, "rdx-capa.jpg")
capa.save(destino, "JPEG", quality=86, optimize=True, progressive=True)
print("%-26s %4d x %4d  %5.0f KB" % ("rdx-capa.jpg", 1200, 630, os.path.getsize(destino) / 1024))
