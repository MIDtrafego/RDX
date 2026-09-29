# Mede o servidor da imagem e reconstrói a caixa em 3D, para o site girar o gabinete de verdade.
#
#   1. acha a silhueta pelo canal alfa e tira dela as arestas de fora (retas ajustadas ao casco)
#   2. cruza as retas para achar os cantos; os cantos de dentro (que o alfa não mostra) são marcados à mão
#   3. ajusta uma caixa reta + câmera de perspectiva aos 7 cantos (mínimos quadrados)
#   4. desenha a conferência e as faces retificadas, e gera o mapa de relevo
#
# As duas imagens de conferência saem na pasta temporária do sistema (ou na pasta passada como
# primeiro argumento), para não sujar o projeto:
#   _conferir-servidor.png               os 7 cantos medidos (amarelo) e a caixa ajustada (ciano) sobre a imagem
#   _faces-servidor.png                  faces direita e esquerda retificadas, com régua de 0 a 1 (para marcar o relevo)
#   img/servidor-relevo.png              R = relevo (128 = na face, menor = para dentro, maior = para fora)
#                                        G = quanto o metal brilha (0 nas luzes e no vidro escuro)
#
# No fim imprime o bloco MEDIDAS, que vai colado em src/gl/servidor3d.js.
#
# Uso: python ferramentas/medir-servidor.py [pasta das imagens de conferência]
import json
import os
import sys
import tempfile

import numpy as np
from PIL import Image, ImageDraw, ImageFilter
from scipy.optimize import least_squares
from scipy.spatial import ConvexHull
from scipy import ndimage

RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
IMG = os.path.join(RAIZ, "img")
CONF = sys.argv[1] if len(sys.argv) > 1 else tempfile.gettempdir()

srv = Image.open(os.path.join(IMG, "servidor.webp")).convert("RGBA")
L, A = srv.size
px = np.array(srv).astype(np.float32) / 255.0
alfa = px[..., 3]

# ───────────── 1. silhueta ─────────────
ys, xs = np.nonzero(alfa > 0.5)
pontos = np.stack([xs, ys], 1).astype(np.float64)
casco = pontos[ConvexHull(pontos).vertices]


def reta_do_casco(p0, p1, folga=9.0, miolo=0.12):
    """Ajusta uma reta aos vértices do casco que ficam perto do segmento p0-p1 (sem as pontas chanfradas)."""
    p0, p1 = np.array(p0, float), np.array(p1, float)
    d = p1 - p0
    comp = np.linalg.norm(d)
    d /= comp
    n = np.array([-d[1], d[0]])
    rel = casco - p0
    ao_longo = rel @ d / comp
    fora = np.abs(rel @ n)
    usa = casco[(ao_longo > miolo) & (ao_longo < 1 - miolo) & (fora < folga)]
    if len(usa) < 2:
        usa = np.array([p0, p1])
    centro = usa.mean(0)
    _, _, vt = np.linalg.svd(usa - centro)
    return centro, vt[0]


def cruzar(r0, r1):
    (c0, d0), (c1, d1) = r0, r1
    m = np.array([d0, -d1]).T
    t = np.linalg.solve(m, c1 - c0)
    return c0 + d0 * t[0]


# chute de olho (lido na imagem com régua); as retas de fora corrigem os cantos de fora
CHUTE = {
    "T": (417, 27), "TL": (36, 168), "TR": (890, 170),
    "BL": (27, 1052), "BR": (894, 1105), "BF": (547, 1161),
    "CB": (425, 1018),
}
topo_esq = reta_do_casco(CHUTE["TL"], CHUTE["T"])
topo_dir = reta_do_casco(CHUTE["T"], CHUTE["TR"])
lado_esq = reta_do_casco(CHUTE["TL"], CHUTE["BL"], miolo=0.02)
lado_dir = reta_do_casco(CHUTE["TR"], CHUTE["BR"], miolo=0.02)
fundo_esq = reta_do_casco((60, 1078), CHUTE["BF"], miolo=0.05)
fundo_dir = reta_do_casco(CHUTE["BF"], (880, 1127), miolo=0.05)

# arestas de dentro, marcadas à mão: a base da face esquerda e a base da face direita
base_esq = (np.array(CHUTE["BL"], float), np.array(CHUTE["CB"], float) - np.array(CHUTE["BL"], float))
base_dir = (np.array(CHUTE["CB"], float), np.array(CHUTE["BR"], float) - np.array(CHUTE["CB"], float))

MEDIDO = {
    "T": cruzar(topo_esq, topo_dir),
    "TL": cruzar(topo_esq, lado_esq),
    "TR": cruzar(topo_dir, lado_dir),
    "BL": cruzar(lado_esq, base_esq),
    "BR": cruzar(lado_dir, base_dir),
    "BF": cruzar(fundo_esq, fundo_dir),
    "CB": np.array(CHUTE["CB"], float),
}
ORDEM = ["T", "TL", "TR", "CB", "BL", "BR", "BF"]

# ───────────── 2. caixa + câmera ─────────────
# Espaço do objeto: x para a direita, y para cima, origem no centro da imagem, 1 unidade = 1 px no
# plano z = 0. A câmera fica em (0, 0, f) olhando para -z. O centro da caixa fica no plano z = 0.
CX, CY = L / 2, A / 2
SINAIS = {   # canto -> (x, y, z) no espaço da caixa, em meias medidas
    "T": (-1, +1, +1), "CB": (-1, -1, +1),
    "TR": (+1, +1, +1), "BR": (+1, -1, +1),
    "TL": (-1, +1, -1), "BL": (-1, -1, -1),
    "BF": (+1, -1, -1),
    "TF": (+1, +1, -1),   # o canto escondido
}


def rotacao(guinada, arfagem, rolagem):
    cy, sy = np.cos(guinada), np.sin(guinada)
    cx, sx = np.cos(arfagem), np.sin(arfagem)
    cz, sz = np.cos(rolagem), np.sin(rolagem)
    ry = np.array([[cy, 0, sy], [0, 1, 0], [-sy, 0, cy]])
    rx = np.array([[1, 0, 0], [0, cx, -sx], [0, sx, cx]])
    rz = np.array([[cz, -sz, 0], [sz, cz, 0], [0, 0, 1]])
    return rz @ rx @ ry


def cantos3d(p):
    f, cx, cy, gui, arf, rol, a, b, h = p
    r = rotacao(gui, arf, rol)
    return {k: np.array([cx, cy, 0.0]) + r @ (np.array(s) * np.array([a, h, b])) for k, s in SINAIS.items()}


def projetar(p3, f):
    k = f / (f - p3[2])
    return np.array([CX + p3[0] * k, CY - p3[1] * k])


def residuo(p):
    c = cantos3d(p)
    return np.concatenate([projetar(c[k], p[0]) - MEDIDO[k] for k in ORDEM])


melhor = None
for f0 in (1200, 2000, 3500):
    for g0 in (0.6, 0.8, 1.0):
        x0 = [f0, 0, 0, g0, -0.15, 0, 300, 300, 500]
        s = least_squares(residuo, x0, bounds=([500, -200, -200, 0.1, -0.8, -0.3, 80, 80, 200],
                                               [20000, 200, 200, 1.5, 0.8, 0.3, 900, 900, 900]))
        if melhor is None or s.cost < melhor.cost:
            melhor = s
p = melhor.x
res = residuo(p).reshape(-1, 2)
erros = np.linalg.norm(res, axis=1)
c3 = cantos3d(p)

print("cantos medidos (px) e erro de reprojeção:")
for k, e in zip(ORDEM, erros):
    print("  %-3s  medido (%7.1f, %7.1f)   ajustado (%7.1f, %7.1f)   erro %5.2f px"
          % (k, MEDIDO[k][0], MEDIDO[k][1], *projetar(c3[k], p[0]), e))
print("erro médio %.2f px   máximo %.2f px   rms %.2f px" % (erros.mean(), erros.max(), np.sqrt((erros ** 2).mean())))
print("câmera da imagem: f = %.0f px   centro (%.1f, %.1f)" % (p[0], p[1], p[2]))
print("giro da caixa: guinada %.1f°  arfagem %.1f°  rolagem %.1f°" % tuple(np.degrees(p[3:6])))
print("medidas: face direita %.0f   face esquerda %.0f   altura %.0f" % (2 * p[6], 2 * p[7], 2 * p[8]))

RIGIDA = {"medio": float(erros.mean()), "maximo": float(erros.max()), "f": float(p[0])}

# ───────────── 2b. três planos passando pelas arestas medidas ─────────────
# A arte não é uma caixa perfeita em perspectiva (a caixa reta acima erra vários px). Como a
# textura é projetada, o que importa é cada aresta da malha cair EXATAMENTE em cima da aresta da
# imagem. Então cada canto fica preso no raio da câmera que passa pelo ponto medido, e o que se
# ajusta é só a profundidade: as três faces visíveis viram três planos que se cruzam nas arestas
# medidas. Erro de reprojeção: zero, por construção. O ajuste procura a forma mais parecida com
# uma caixa reta (arestas paralelas e iguais, faces em esquadro).
# A câmera usada é a do SITE na janela de referência (1440 x 900: o servidor tem 810 px de altura,
# escala 810/1182, então a câmera fica a 1500 / escala unidades do objeto). Deixando a distância
# livre, o ajuste foge para uma lente muito longa (a arte é quase ortográfica) e, trazida para a
# câmera do site, a caixa ficaria achatada, quase um plano. Presa na câmera do site, a forma fica
# com as faces em esquadro e o custo vai para as arestas do fundo, um pouco mais compridas.
F_REF = 1500 / (810 / A)
PESO_ESQUADRO = 6.0


def raio(nome, z, f):
    m = MEDIDO[nome]
    x, y = m[0] - CX, CY - m[1]
    t = 1 - z / f
    return np.array([x * t, y * t, z])


def no_plano(nome, plano, f):
    n, c = plano
    m = MEDIDO[nome]
    dire = np.array([m[0] - CX, CY - m[1], -f])
    cam = np.array([0, 0, f])
    return cam + dire * ((c - n @ cam) / (n @ dire))


def plano_de(a, b, c, para):
    n = np.cross(b - a, c - a)
    n /= np.linalg.norm(n)
    if n @ (para - a) < 0:
        n = -n
    return n, n @ a


def montar(q):
    zcb, zt, zbl, zbr = q
    f = F_REF
    cam = np.array([0, 0, f])
    c = {"CB": raio("CB", zcb, f), "T": raio("T", zt, f), "BL": raio("BL", zbl, f), "BR": raio("BR", zbr, f)}
    pl = {
        "direita": plano_de(c["CB"], c["T"], c["BR"], cam),
        "esquerda": plano_de(c["CB"], c["T"], c["BL"], cam),
        "baixo": plano_de(c["CB"], c["BL"], c["BR"], cam),
    }
    c["TR"] = no_plano("TR", pl["direita"], f)
    c["TL"] = no_plano("TL", pl["esquerda"], f)
    c["BF"] = no_plano("BF", pl["baixo"], f)
    return c, pl


def un(v):
    return v / np.linalg.norm(v)


def desvio(q):
    c, _ = montar(q)
    v = [c["T"] - c["CB"], c["TL"] - c["BL"], c["TR"] - c["BR"]]
    r = [c["BR"] - c["CB"], c["TR"] - c["T"], c["BF"] - c["BL"]]
    e = [c["BL"] - c["CB"], c["TL"] - c["T"], c["BF"] - c["BR"]]
    out = []
    for g in (v, r, e):
        m = np.linalg.norm(g[0])
        out += list((g[1] - g[0]) / m) + list((g[2] - g[0]) / m)
    out += [PESO_ESQUADRO * un(v[0]) @ un(r[0]), PESO_ESQUADRO * un(v[0]) @ un(e[0]), PESO_ESQUADRO * un(r[0]) @ un(e[0])]
    out.append(sum(k[2] for k in c.values()) / 7 / 300)
    return np.array(out)


sol = least_squares(desvio, [250, 250, -100, -100])
q = sol.x
F = F_REF
c3, planos = montar(q)
# o canto escondido fecha o paralelepípedo
c3["TF"] = c3["TL"] + c3["TR"] - c3["T"]
centro = sum(c3[k] for k in SINAIS) / 8
reproj = max(np.linalg.norm(projetar(c3[k], F) - MEDIDO[k]) for k in ORDEM)

print()
print("três planos pelas arestas medidas:")
print("  câmera de referência (site, 1440 x 900): f = %.1f" % F)
for k in ORDEM + ["TF"]:
    print("  %-3s (%8.1f, %8.1f, %8.1f)" % (k, *c3[k]))
print("  erro de reprojeção máximo: %.4f px" % reproj)
ang = lambda a, b: np.degrees(np.arccos(np.clip(planos[a][0] @ planos[b][0], -1, 1)))
print("  ângulo entre as normais: direita/esquerda %.1f°  direita/baixo %.1f°  esquerda/baixo %.1f°"
      % (ang("direita", "esquerda"), ang("direita", "baixo"), ang("esquerda", "baixo")))
compr = lambda a, b: np.linalg.norm(c3[a] - c3[b])
print("  alturas: meio %.0f  esquerda %.0f  direita %.0f" % (compr("T", "CB"), compr("TL", "BL"), compr("TR", "BR")))
print("  larguras da face direita: base %.0f  topo %.0f  fundo %.0f" % (compr("BR", "CB"), compr("TR", "T"), compr("BF", "BL")))
print("  larguras da face esquerda: base %.0f  topo %.0f  fundo %.0f" % (compr("BL", "CB"), compr("TL", "T"), compr("BF", "BR")))
print("  centro do gabinete (%.1f, %.1f, %.1f)" % tuple(centro))

# faces escondidas: plano por três cantos, normal para fora
escondidas = {
    "cima": plano_de(c3["T"], c3["TL"], c3["TR"], 2 * c3["T"] - c3["CB"]),
    "fundo_dir": plano_de(c3["TR"], c3["BR"], c3["BF"], 2 * c3["BR"] - c3["CB"]),
    "fundo_esq": plano_de(c3["TL"], c3["BL"], c3["BF"], 2 * c3["BL"] - c3["CB"]),
}


# na cena do site a câmera fica a D unidades do objeto (D = 1500 / escala). Para a vista de frente
# continuar idêntica, a profundidade é multiplicada por k = D / f. Aqui: até que giro cada face
# escondida continua escondida, para três tamanhos de janela
def girar(gui, arf, pe):
    # guinada em volta do "em pé" do gabinete (a aresta do meio), arfagem em volta do x da tela
    kx = np.array([[0, -pe[2], pe[1]], [pe[2], 0, -pe[0]], [-pe[1], pe[0], 0]])
    rg = np.eye(3) + np.sin(gui) * kx + (1 - np.cos(gui)) * (kx @ kx)
    cx, sx = np.cos(arf), np.sin(arf)
    rx = np.array([[1, 0, 0], [0, cx, -sx], [0, sx, cx]])
    return rx @ rg


print()
for nome_j, alt in (("1440x900", 810), ("1920x1080", 972), ("390x844", 557)):
    D = 1500 / (alt / A)
    k = D / F
    esc = np.array([1, 1, k])
    piv = centro * esc
    cam = np.array([0, 0, D])
    pe = un((c3["T"] - c3["CB"]) * esc)
    nd, ne = planos["direita"][0] / esc, planos["esquerda"][0] / esc
    entre = np.degrees(np.arccos(un(nd) @ un(ne)))
    linhas = []
    for nome, (n, cc) in escondidas.items():
        ns = un(n / esc)
        p0 = c3["TF"] * esc if nome != "fundo_esq" else c3["TL"] * esc
        aparece = []
        for gui in np.radians(np.arange(-30, 30.5, 0.5)):
            for arf in np.radians(np.arange(-20, 20.5, 0.5)):
                r = girar(gui, arf, pe)
                cam_obj = r.T @ (cam - piv) + piv
                if ns @ (cam_obj - p0) > 0:
                    aparece.append((np.degrees(gui), np.degrees(arf)))
        ap = np.array(aparece) if aparece else np.zeros((0, 2))
        # menor giro, num eixo só, que já mostra a face
        so_gui = ap[np.abs(ap[:, 1]) < 0.01][:, 0] if len(ap) else []
        so_arf = ap[np.abs(ap[:, 0]) < 0.01][:, 1] if len(ap) else []
        lim_g = min(so_gui, key=abs) if len(so_gui) else None
        lim_a = min(so_arf, key=abs) if len(so_arf) else None
        linhas.append("%s: guinada %s  arfagem %s" % (nome, "%+.1f°" % lim_g if lim_g is not None else "nunca",
                                                       "%+.1f°" % lim_a if lim_a is not None else "nunca"))
    print("janela %-9s D = %.0f  k = %.3f  ângulo entre as faces na cena %.1f°" % (nome_j, D, k, 180 - entre))
    for l in linhas:
        print("    aparece a partir de  " + l)

p = np.array([F])   # daqui para baixo, a projeção usa a câmera da imagem


# ───────────── 3. conferência ─────────────
claro = 255 * (px[..., :3] ** 0.55)
comp = Image.fromarray((claro * alfa[..., None] + 70 * (1 - alfa[..., None])).astype(np.uint8), "RGB")
d = ImageDraw.Draw(comp)
ARESTAS = [("T", "TL"), ("T", "TR"), ("T", "CB"), ("TL", "BL"), ("TR", "BR"), ("CB", "BL"), ("CB", "BR"), ("BL", "BF"), ("BR", "BF")]
for a0, a1 in ARESTAS:
    d.line([tuple(projetar(c3[a0], p[0])), tuple(projetar(c3[a1], p[0]))], fill=(0, 230, 255), width=2)
for k in ORDEM:
    x, y = MEDIDO[k]
    d.ellipse([x - 6, y - 6, x + 6, y + 6], outline=(255, 235, 0), width=2)
    d.text((x + 9, y - 6), k, fill=(255, 235, 0))
comp.save(os.path.join(CONF, "_conferir-servidor.png"))


# ───────────── 4. faces retificadas ─────────────
def homografia(orig, dest):
    m = []
    for (x, y), (u, v) in zip(orig, dest):
        m.append([x, y, 1, 0, 0, 0, -u * x, -u * y, -u])
        m.append([0, 0, 0, x, y, 1, -v * x, -v * y, -v])
    _, _, vt = np.linalg.svd(np.array(m, float))
    return vt[-1].reshape(3, 3)


def quad(nomes):
    return [projetar(c3[k], p[0]) for k in nomes]


# (s, t) de 0 a 1: s cresce afastando da aresta do meio, t cresce de baixo para cima
QUAD = {"direita": quad(["CB", "BR", "TR", "T"]), "esquerda": quad(["CB", "BL", "TL", "T"])}
UNID = [(0, 0), (1, 0), (1, 1), (0, 1)]
H_FACE = {k: homografia(UNID, q) for k, q in QUAD.items()}      # (s,t) -> px
H_INV = {k: np.linalg.inv(h) for k, h in H_FACE.items()}        # px -> (s,t)


def aplicar(h, x, y):
    w = h[2, 0] * x + h[2, 1] * y + h[2, 2]
    return (h[0, 0] * x + h[0, 1] * y + h[0, 2]) / w, (h[1, 0] * x + h[1, 1] * y + h[1, 2]) / w


def retificar(nome, larg, alt):
    s, t = np.meshgrid((np.arange(larg) + 0.5) / larg, 1 - (np.arange(alt) + 0.5) / alt)
    x, y = aplicar(H_FACE[nome], s, t)
    fonte = np.array(comp_limpo)
    out = np.zeros((alt, larg, 3), np.uint8)
    for c in range(3):
        out[..., c] = ndimage.map_coordinates(fonte[..., c], [y, x], order=1, mode="constant", cval=70)
    im = Image.fromarray(out, "RGB")
    dd = ImageDraw.Draw(im)
    for i in range(1, 20):
        v = i / 20
        cor = (255, 70, 70) if i % 2 == 0 else (130, 50, 50)
        dd.line([(v * larg, 0), (v * larg, alt)], fill=cor)
        dd.line([(0, (1 - v) * alt), (larg, (1 - v) * alt)], fill=cor)
        if i % 2 == 0:
            dd.text((v * larg + 2, 2), "%.1f" % v, fill=(255, 255, 0))
            dd.text((2, (1 - v) * alt + 2), "%.1f" % v, fill=(255, 255, 0))
    return im


comp_limpo = Image.fromarray((claro * alfa[..., None] + 70 * (1 - alfa[..., None])).astype(np.uint8), "RGB")
escala = 0.62
fd = retificar("direita", int(compr("BR", "CB") * escala), int(compr("T", "CB") * escala))
fe = retificar("esquerda", int(compr("BL", "CB") * escala), int(compr("T", "CB") * escala))
folha = Image.new("RGB", (fe.width + fd.width + 8, max(fe.height, fd.height)), (0, 0, 0))
folha.paste(fe, (0, 0))
folha.paste(fd, (fe.width + 8, 0))
folha.save(os.path.join(CONF, "_faces-servidor.png"))

def arred(v, casas=4):
    return [round(float(x), casas) for x in v]


MEDIDAS = {
    "f": round(F, 2),
    "centro": arred(centro, 2),
    "planos": {k: {"n": arred(n, 6), "c": round(float(c), 3)} for k, (n, c) in planos.items()},
    "escondidas": {k: {"n": arred(n, 6), "c": round(float(c), 3)} for k, (n, c) in escondidas.items()},
    "cantos": {k: arred(v, 2) for k, v in c3.items()},
    "medido": {k: arred(MEDIDO[k], 1) for k in ORDEM},
    "caixaRigida": {"erroMedio": round(RIGIDA["medio"], 2), "erroMaximo": round(RIGIDA["maximo"], 2)},
}
print()
print("MEDIDAS =", json.dumps(MEDIDAS))

# ───────────── 5. mapa de relevo ─────────────
# O relevo é marcado nas faces retificadas (s, t de 0 a 1, ver _faces-servidor.png) e levado de
# volta para a imagem. O valor é a distância, em px, que a superfície entra na face (positivo)
# ou salta para fora (negativo), medida na perpendicular da face.
yy, xx = np.mgrid[0:A, 0:L].astype(np.float64)
relevo = np.zeros((A, L), np.float64)
vidro = np.zeros((A, L), np.float64)


def dentro(s, t, s0, s1, t0, t1):
    return (s >= s0) & (s <= s1) & (t >= t0) & (t <= t1)


# face direita: a janela do cilindro
JANELA = (0.115, 0.925, 0.165, 0.855)     # moldura de fora (com as grades)
MIOLO = (0.235, 0.785)                     # entre as grades: onde fica o cilindro
GRADE = 14.0                               # as grades ficam um pouco para dentro
FUNDO = 110.0                              # fundo da janela
CILINDRO = (0.47, 0.37, 88.0)              # centro em s, meia largura em s, quanto salta do fundo
s, t = aplicar(H_INV["direita"], xx + 0.5, yy + 0.5)
na_janela = dentro(s, t, *JANELA)
no_miolo = na_janela & (t >= MIOLO[0]) & (t <= MIOLO[1])
relevo[na_janela] = GRADE
u = np.clip((s - CILINDRO[0]) / CILINDRO[1], -1, 1)
curva = FUNDO - CILINDRO[2] * np.sqrt(1 - u * u)
relevo[no_miolo] = curva[no_miolo]
vidro[no_miolo] = 1

# face esquerda: a barra de luz salta um pouco
BARRA = (0.262, 0.318, 0.185, 0.815)
SALTO = 9.0
s, t = aplicar(H_INV["esquerda"], xx + 0.5, yy + 0.5)
relevo[dentro(s, t, *BARRA)] = -SALTO

relevo = ndimage.gaussian_filter(relevo, 2.2)

# onde o metal brilha: pixel sem cor (cinza), fora das luzes; o vidro brilha menos
r_, g_, b_ = px[..., 0], px[..., 1], px[..., 2]
vmax = np.maximum(np.maximum(r_, g_), b_)
vmin = np.minimum(np.minimum(r_, g_), b_)
sat = (vmax - vmin) / np.maximum(vmax, 1e-4)
luz = np.array(Image.open(os.path.join(IMG, "servidor-luz.png")).convert("RGB")).astype(np.float64)[..., 0] / 255
luz = ndimage.gaussian_filter(ndimage.maximum_filter(luz, 9), 3)
metal = np.clip(1 - sat * 2.2, 0, 1) * np.clip(1 - luz * 1.6, 0, 1) * alfa
metal = metal * (1 - 0.45 * ndimage.gaussian_filter(vidro, 3))
metal = ndimage.gaussian_filter(metal, 1.5)

mapa = np.zeros((A, L, 3), np.uint8)
mapa[..., 0] = np.clip(np.round(128 - relevo), 0, 255)
mapa[..., 1] = np.clip(metal * 255, 0, 255)
mapa[..., 2] = np.clip(ndimage.gaussian_filter(vidro, 2) * 255, 0, 255)
Image.fromarray(mapa, "RGB").save(os.path.join(IMG, "servidor-relevo.png"), optimize=True)
print("relevo: de %.0f (para fora) a %.0f (para dentro) px   servidor-relevo.png %.0f KB"
      % (relevo.min(), relevo.max(), os.path.getsize(os.path.join(IMG, "servidor-relevo.png")) / 1024))

print("conferência em: " + CONF)
