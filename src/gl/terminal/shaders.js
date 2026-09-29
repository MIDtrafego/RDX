// Shaders do terminal 3D. Cada peça tem duas versões:
//   sólida  -> o objeto "pintado", que aparece onde o mouse revela
//   malha   -> o mesmo objeto só em linhas, o holograma
// As duas usam a mesma geometria, então a malha é a malha de verdade do objeto.

export const COMUM = /* glsl */ `
  uniform float uCurva;
  uniform float uTempo;
  uniform float uConstrucao;

  const vec3 VERDE = vec3(0.29, 0.87, 0.50);
  const vec3 CIANO = vec3(0.13, 0.89, 0.84);
  const vec3 LIMA  = vec3(0.80, 0.97, 0.18);

  // a tela é curva: as bordas vêm na direção de quem olha
  vec3 curvar(vec3 p) {
    float a = p.x / uCurva;
    float r = uCurva - p.z;
    return vec3(sin(a) * r, p.y, uCurva - cos(a) * r);
  }
  vec3 curvarNormal(vec3 n, float x) {
    float a = x / uCurva;
    float c = cos(a), s = sin(a);
    return vec3(n.x * c - n.z * s, n.y, n.x * s + n.z * c);
  }

  float hash(vec2 p) {
    return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
  }

  float sdCaixa(vec2 p, vec2 b, float r) {
    vec2 q = abs(p) - b + r;
    return length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - r;
  }

  // linha com espessura em px de tela, a partir de uma distância em unidades da cena
  float traco(float d, float espessura, float e) {
    return 1.0 - smoothstep(espessura * 0.5, espessura * 0.5 + 1.0, abs(d) / e);
  }

  // a malha nasce do centro para fora, célula por célula
  float nascer(vec3 t) {
    float r = length(t.xy / vec2(640.0, 430.0));
    float h = hash(floor(t.xy / 46.0));
    return smoothstep(0.0, 0.16, uConstrucao * 1.7 - r - h * 0.30);
  }

  // A onda do holograma, igual à malha do capacete no site de referência: as LINHAS
  // aparecem no topo, a frente desce e o que ficou para trás vai apagando. A forma foi
  // medida quadro a quadro lá. O ritmo é o que o Yuri pediu: uma onda por segundo, com a
  // frente levando 0,84 s para descer e o topo apagando enquanto ela desce.
  const float PERIODO = 1.00;   // de uma onda até a próxima
  const float DESCIDA = 0.84;   // tempo que a frente leva do topo até embaixo
  const float RASTRO  = 0.17;   // quanto tempo o que ficou para trás leva para apagar
  const float REPOUSO = 0.0;    // o quanto a malha continua visível fora da onda
  // A onda é só da malha. A tela pintada aparece pelo líquido (mouse e revelação automática).
  // Acima de zero, a onda passaria a trazer também a tela pintada.
  const float TELA_NA_ONDA = 0.0;

  // 0..1: quanto a onda está acesa neste ponto
  float pulso(vec3 t) {
    float v = clamp(0.5 - t.y / 780.0, 0.0, 1.0);        // 0 no topo, 1 embaixo
    float desde = mod(uTempo, PERIODO) - v * DESCIDA;    // tempo desde que a frente passou aqui
    float aceso = smoothstep(0.0, 0.07, desde) * exp(-max(desde, 0.0) / RASTRO);
    aceso += exp(-(desde + PERIODO) / RASTRO);           // resto da onda anterior
    return min(aceso, 1.0);
  }

  // quanto a malha aparece neste ponto: é a onda, mais a frente de construção na entrada
  float vida(vec3 t, float nasc) {
    float frente = nasc * (1.0 - nasc) * 4.0;
    return REPOUSO + (1.0 - REPOUSO) * pulso(t) + frente * 1.6;
  }

  float tela(vec3 t, float nasc) {
    return pulso(t) * nasc * TELA_NA_ONDA;
  }

  // linha no limite do que a tela consegue desenhar. abaixo disso ela quebra em pontinhos
  float fino(float d, float e) {
    return 1.0 - smoothstep(0.0, 0.62, abs(d) / e);
  }

  // No site de referência o fundo é claro e a linha é preta. Aqui o fundo é escuro,
  // então a linha é o inverso: quase branca, neutra, com um fio de verde.
  vec3 corHolo(vec3 t) {
    return mix(vec3(0.84, 0.97, 0.91), vec3(0.78, 0.95, 1.0), clamp(t.y / 780.0 + 0.5, 0.0, 1.0));
  }
`;

// ───────────── caixas instanciadas (velas, pavios, volume, barras) ─────────────
export const CAIXA_VERTICE = /* glsl */ `
  ${COMUM}
  attribute vec3 iCentro;
  attribute vec3 iTamanho;
  attribute vec3 iCor;
  attribute vec2 iLuz;      // x: brilho   y: opacidade
  varying vec3 vCor;
  varying vec2 vLuz;
  varying vec3 vLocal;
  varying vec3 vTam;
  varying vec3 vNormalO;
  varying vec3 vNormalV;
  varying vec3 vTerm;
  void main() {
    vec3 t = position * iTamanho + iCentro;
    vTerm = t;
    vLocal = position;
    vTam = iTamanho;
    vNormalO = normal;
    vNormalV = normalize(normalMatrix * curvarNormal(normal, t.x));
    vCor = iCor;
    vLuz = iLuz;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(curvar(t), 1.0);
  }
`;

const CAIXA_VARIAVEIS = /* glsl */ `
  varying vec3 vCor;
  varying vec2 vLuz;
  varying vec3 vLocal;
  varying vec3 vTam;
  varying vec3 vNormalO;
  varying vec3 vNormalV;
  varying vec3 vTerm;

  // distância até a quina mais próxima, medida sobre a face
  float ateAQuina(vec3 no) {
    vec3 d = (0.5 - abs(vLocal)) * vTam;
    return min(mix(d.x, 1.0e4, no.x), min(mix(d.y, 1.0e4, no.y), mix(d.z, 1.0e4, no.z)));
  }
`;

export const CAIXA_SOLIDA = /* glsl */ `
  ${COMUM}
  ${CAIXA_VARIAVEIS}
  void main() {
    vec3 no = abs(vNormalO);
    // cada face recebe uma luz diferente: é isso que dá volume
    float face = no.z * 1.0 + no.x * 0.46 + no.y * (vNormalO.y > 0.0 ? 0.86 : 0.30);
    float grad = mix(0.78, 1.12, vLocal.y + 0.5);
    float q = ateAQuina(no);
    float e = fwidth(q) + 1.0e-4;
    float quina = 1.0 - smoothstep(0.0, 1.7 * e, q);

    vec3 cor = vCor * face * grad * vLuz.x;
    cor += vCor * quina * 0.30 * vLuz.x;
    cor += vec3(1.0) * pow(max(normalize(vNormalV).z, 0.0), 8.0) * 0.05;
    gl_FragColor = vec4(cor * vLuz.y, vLuz.y);
  }
`;

export const CAIXA_MALHA = /* glsl */ `
  ${COMUM}
  ${CAIXA_VARIAVEIS}
  void main() {
    vec3 no = abs(vNormalO);
    float q = ateAQuina(no);
    float e = fwidth(q) + 1.0e-4;
    float arestas = 1.0 - smoothstep(0.0, 0.66 * e, q);

    // diagonal de cada face, como numa malha triangulada
    vec2 uv2; vec2 dim;
    if (no.z > 0.5) { uv2 = vLocal.xy; dim = vTam.xy; }
    else if (no.x > 0.5) { uv2 = vLocal.zy; dim = vTam.zy; }
    else { uv2 = vLocal.xz; dim = vTam.xz; }
    vec2 p = (uv2 + 0.5) * dim;
    float dd = abs(p.x * dim.y - p.y * dim.x) / max(length(dim), 1.0e-3);
    float ed = fwidth(dd) + 1.0e-4;
    float diagonal = (1.0 - smoothstep(0.0, 0.62 * ed, dd)) * step(7.0, min(dim.x, dim.y));

    float nasc = nascer(vTerm);
    float a = (arestas * 0.80 + diagonal * 0.24) * nasc * vida(vTerm, nasc) * (0.35 + 0.65 * vLuz.y);
    vec3 cor = mix(corHolo(vTerm), vCor, 0.18);

    // a onda traz a peça pintada
    float face = no.z * 1.0 + no.x * 0.46 + no.y * (vNormalO.y > 0.0 ? 0.86 : 0.30);
    vec3 pintada = vCor * face * mix(0.78, 1.12, vLocal.y + 0.5) * vLuz.x;
    float aT = tela(vTerm, nasc) * vLuz.y;
    gl_FragColor = vec4(cor * a + pintada * aT, min(1.0, a * 0.5 + aT));
  }
`;

// ───────────── placas (vidro do terminal, cartões) ─────────────
// A posição da placa dentro do terminal vai por uniform (e não pela posição do objeto),
// porque a curvatura é aplicada no espaço do terminal, antes da transformação do grupo.
export const PLACA_VERTICE = /* glsl */ `
  ${COMUM}
  uniform vec3 uPosicao;
  uniform vec2 uEscalaXY;
  varying vec2 vUv;
  varying vec3 vTerm;
  void main() {
    vUv = uv;
    vTerm = vec3(position.xy * uEscalaXY, position.z) + uPosicao;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(curvar(vTerm), 1.0);
  }
`;

// o vidro do terminal: fundo, área do gráfico com grade, moldura e luz correndo na borda
const VIDRO_CORPO = /* glsl */ `
  ${COMUM}
  uniform vec2 uTam;
  uniform float uRaio;
  uniform vec4 uQuadro;      // área do gráfico: x0, y0, x1, y1
  uniform vec4 uPlot;        // yBase, yTopo, precoMin, precoMax
  uniform float uPasso;      // passo de preço da grade
  uniform vec2 uGradeX;      // passo e deslocamento da grade vertical
  uniform float uVarredura;  // posição x da varredura do motor
  uniform float uVarrendo;   // 0..1
  uniform vec4 uClarao;      // cor + força do clarão ao fechar uma operação
  varying vec2 vUv;
  varying vec3 vTerm;

  // devolve o vidro pintado, já com a cor multiplicada pela opacidade
  vec4 vidro(vec2 p, float d, float e) {
    float dentro = 1.0 - smoothstep(-e, e, d);

    // vidro escuro com um degradê em diagonal
    float g = smoothstep(-0.7, 0.7, p.y / uTam.y + p.x / uTam.x * 0.4);
    vec3 cor = mix(vec3(0.010, 0.030, 0.034), vec3(0.020, 0.078, 0.084), g);
    // reflexo largo que atravessa o vidro
    float faixa = exp(-pow((p.x * 0.55 + p.y * 0.85 - (fract(uTempo * 0.06) * 2200.0 - 1100.0)) / 150.0, 2.0));
    cor += vec3(0.05, 0.16, 0.15) * faixa * 0.35;

    // área do gráfico
    vec2 c = vec2(uQuadro.x + uQuadro.z, uQuadro.y + uQuadro.w) * 0.5;
    vec2 m = vec2(uQuadro.z - uQuadro.x, uQuadro.w - uQuadro.y) * 0.5;
    float dq = sdCaixa(p - c, m, 16.0);
    float noQuadro = 1.0 - smoothstep(-e, e, dq);
    cor = mix(cor, vec3(0.004, 0.016, 0.020), noQuadro * 0.88);

    // grade de preço: acompanha a escala viva do gráfico
    float unPorPreco = (uPlot.y - uPlot.x) / max(uPlot.w - uPlot.z, 1.0);
    float preco = uPlot.z + (p.y - uPlot.x) / unPorPreco;
    float lh = (fract(preco / uPasso - 0.5) - 0.5) * uPasso * unPorPreco;
    float lv = (fract((p.x + uGradeX.y) / uGradeX.x - 0.5) - 0.5) * uGradeX.x;
    float tracejH = step(0.45, fract(p.x / 9.0));
    float tracejV = step(0.45, fract(p.y / 9.0));
    float grade = max(traco(lh, 1.0, e) * tracejH, traco(lv, 1.0, e) * tracejV);
    cor += vec3(0.20, 0.78, 0.74) * grade * 0.30 * noQuadro;
    cor += CIANO * traco(dq, 1.3, e) * 0.34;

    // varredura do motor analisando o mercado
    float vx = (p.x - uVarredura);
    cor += VERDE * exp(-pow(vx / 34.0, 2.0)) * 0.20 * noQuadro * uVarrendo * step(vx, 0.0);
    cor += LIMA * traco(vx, 1.6, e) * 0.85 * noQuadro * uVarrendo;

    // clarão ao bater o alvo ou o stop
    cor += uClarao.rgb * uClarao.a * noQuadro * (0.30 + 0.5 * smoothstep(0.0, 1.0, (p.y - uQuadro.y) / (uQuadro.w - uQuadro.y)));

    // molduras
    cor += CIANO * traco(d + 17.0, 1.0, e) * 0.22;
    float ang = atan(p.y / uTam.y, p.x / uTam.x);
    float corre = exp(-pow(sin((ang - uTempo * 0.45) * 0.5) * 3.2, 2.0));
    float beira = 1.0 - smoothstep(0.0, 5.0, -d);
    cor += mix(CIANO, LIMA, corre) * beira * (0.35 + 0.85 * corre);

    return vec4(cor * dentro, dentro * 0.93);
  }
`;

export const VIDRO_SOLIDO = /* glsl */ `
  ${VIDRO_CORPO}
  void main() {
    vec2 p = (vUv - 0.5) * uTam;
    float d = sdCaixa(p, uTam * 0.5, uRaio);
    float e = (fwidth(p.x) + fwidth(p.y)) * 0.7071 + 1.0e-4;
    gl_FragColor = vidro(p, d, e);
  }
`;

// o vidro em malha: a grade fina fica fixa e a onda traz o vidro pintado
export const VIDRO_MALHA = /* glsl */ `
  ${VIDRO_CORPO}
  uniform float uCelula;
  uniform float uPeso;
  void main() {
    vec2 p = (vUv - 0.5) * uTam;
    float d = sdCaixa(p, uTam * 0.5, uRaio);
    float e = (fwidth(p.x) + fwidth(p.y)) * 0.7071 + 1.0e-4;
    float dentro = 1.0 - smoothstep(-e, e, d);

    vec2 g = vTerm.xy / uCelula;
    vec2 dg = abs(fract(g - 0.5) - 0.5) * uCelula;
    float quadros = max(fino(dg.x, e), fino(dg.y, e));
    float dd = abs(fract(g.x + g.y - 0.5) - 0.5) * uCelula * 0.7071;
    float a = (quadros * 0.34 + fino(dd, e) * 0.17) * dentro * uPeso + fino(d + 0.5, e) * 0.85;

    float nasc = nascer(vTerm);
    float v = vida(vTerm, nasc);
    vec4 linhas = vec4(corHolo(vTerm) * a * v, a * v * 0.5) * nasc;
    vec4 pintado = vidro(p, d, e) * tela(vTerm, nasc);
    gl_FragColor = linhas * (1.0 - pintado.a) + pintado;
  }
`;

// versão em malha de qualquer placa: contorno, grade, diagonais e um fantasma do conteúdo
export const PLACA_MALHA = /* glsl */ `
  ${COMUM}
  uniform vec2 uTam;
  uniform float uRaio;
  uniform float uCelula;
  uniform float uPeso;
  uniform float uContorno;
  uniform float uFantasma;
  uniform float uTela;
  uniform float uOpacidade;
  uniform sampler2D uMapa;
  varying vec2 vUv;
  varying vec3 vTerm;

  void main() {
    vec2 p = (vUv - 0.5) * uTam;
    float d = sdCaixa(p, uTam * 0.5, uRaio);
    float e = (fwidth(p.x) + fwidth(p.y)) * 0.7071 + 1.0e-4;
    float dentro = 1.0 - smoothstep(-e, e, d);

    // a grade usa a posição no terminal, então casa de uma placa para outra
    vec2 g = vTerm.xy / uCelula;
    vec2 dg = abs(fract(g - 0.5) - 0.5) * uCelula;
    float quadros = max(fino(dg.x, e), fino(dg.y, e));
    float dd = abs(fract(g.x + g.y - 0.5) - 0.5) * uCelula * 0.7071;
    float diagonais = fino(dd, e);

    float contorno = fino(d + 0.5, e) * uContorno;
    float a = (quadros * 0.34 + diagonais * 0.17) * dentro * uPeso + contorno * 0.80;

    float fantasma = 0.0;
    vec4 conteudo = vec4(0.0);
    if (uFantasma > 0.0 || uTela > 0.0) {
      conteudo = texture2D(uMapa, vUv);
      fantasma = smoothstep(0.20, 0.85, dot(conteudo.rgb, vec3(0.30, 0.60, 0.10))) * 0.26 * uFantasma * dentro;
    }

    float nasc = nascer(vTerm);
    float v = vida(vTerm, nasc);
    vec3 cor = corHolo(vTerm);
    vec3 rgb = cor * a * v + mix(cor, vec3(1.0), 0.3) * fantasma * v;
    float alfa = (a + fantasma) * v * 0.5;
    vec4 linhas = vec4(rgb, alfa) * nasc;

    // a onda traz o cartão de verdade
    vec4 pintado = conteudo * tela(vTerm, nasc) * uTela;
    gl_FragColor = (linhas * (1.0 - pintado.a) + pintado) * uOpacidade;
  }
`;

// cartão com conteúdo desenhado em canvas
export const CARTAO_SOLIDO = /* glsl */ `
  uniform sampler2D uMapa;
  uniform float uOpacidade;
  varying vec2 vUv;
  void main() {
    gl_FragColor = texture2D(uMapa, vUv) * uOpacidade;
  }
`;

// ───────────── fitas (linhas de preço, alvo, stop) ─────────────
export const FITA_SOLIDA = /* glsl */ `
  uniform vec3 uCor;
  uniform float uOpacidade;
  uniform float uTracejado;   // tamanho do traço em unidades, 0 = contínuo
  uniform vec2 uTam;
  varying vec2 vUv;
  varying vec3 vTerm;
  void main() {
    float x = vUv.x * uTam.x;
    float t = uTracejado > 0.0 ? step(0.5, fract(x / uTracejado)) : 1.0;
    float y = abs(vUv.y - 0.5) * 2.0;
    float a = t * (1.0 - smoothstep(0.55, 1.0, y)) * uOpacidade;
    gl_FragColor = vec4(uCor * a, a);
  }
`;

export const FITA_MALHA = /* glsl */ `
  ${COMUM}
  uniform vec3 uCor;
  uniform float uOpacidade;
  uniform float uTracejado;
  uniform vec2 uTam;
  varying vec2 vUv;
  varying vec3 vTerm;
  void main() {
    float x = vUv.x * uTam.x;
    float t = uTracejado > 0.0 ? step(0.5, fract(x / uTracejado)) : 1.0;
    float nasc = nascer(vTerm);
    float tl = tela(vTerm, nasc);
    float a = t * uOpacidade * nasc * (0.55 * vida(vTerm, nasc) + tl * 0.6);
    gl_FragColor = vec4(mix(corHolo(vTerm), uCor, tl) * a, a * mix(0.5, 1.0, tl));
  }
`;

// ───────────── tubo (média móvel) e aro (espessura do vidro) ─────────────
export const TUBO_VERTICE = /* glsl */ `
  ${COMUM}
  varying vec3 vTerm;
  varying vec3 vNormalV;
  varying vec2 vUv;
  void main() {
    vTerm = position;
    vUv = uv;
    vNormalV = normalize(normalMatrix * curvarNormal(normal, position.x));
    gl_Position = projectionMatrix * modelViewMatrix * vec4(curvar(position), 1.0);
  }
`;

export const TUBO_SOLIDO = /* glsl */ `
  uniform vec3 uCor;
  uniform float uOpacidade;
  varying vec3 vTerm;
  varying vec3 vNormalV;
  varying vec2 vUv;
  void main() {
    float luz = 0.62 + 0.38 * max(normalize(vNormalV).z, 0.0);
    gl_FragColor = vec4(uCor * luz * uOpacidade, uOpacidade);
  }
`;

export const TUBO_MALHA = /* glsl */ `
  ${COMUM}
  uniform vec3 uCor;
  uniform float uOpacidade;
  varying vec3 vTerm;
  varying vec3 vNormalV;
  varying vec2 vUv;
  void main() {
    float nasc = nascer(vTerm);
    float tl = tela(vTerm, nasc);
    // na malha só as quinas do tubo aparecem, como fio
    float quina = 1.0 - smoothstep(0.0, 0.66, abs(fract(vUv.y * 4.0 + 0.5) - 0.5) / (fwidth(vUv.y * 4.0) + 1.0e-4));
    float a = uOpacidade * nasc * (0.55 * quina * vida(vTerm, nasc) + tl * 0.7);
    gl_FragColor = vec4(mix(corHolo(vTerm), uCor, 0.20 + 0.80 * tl) * a, min(1.0, a * mix(0.5, 1.0, tl)));
  }
`;

export const ARO_SOLIDO = /* glsl */ `
  ${COMUM}
  varying vec3 vTerm;
  varying vec3 vNormalV;
  varying vec2 vUv;   // x: posição ao longo do contorno (0..1)   y: profundidade (0 frente, 1 fundo)
  void main() {
    float corre = exp(-pow(sin((vUv.x * 6.2832 - uTempo * 0.45) * 0.5) * 3.2, 2.0));
    float frente = 1.0 - smoothstep(0.0, 0.55, vUv.y);
    vec3 cor = mix(vec3(0.02, 0.10, 0.10), mix(CIANO, LIMA, corre), frente * (0.35 + 0.65 * corre));
    cor += CIANO * (1.0 - smoothstep(0.0, 0.10, abs(vUv.y - 0.5))) * 0.12;
    gl_FragColor = vec4(cor, 1.0);
  }
`;

export const ARO_MALHA = /* glsl */ `
  ${COMUM}
  varying vec3 vTerm;
  varying vec3 vNormalV;
  varying vec2 vUv;
  void main() {
    float e = fwidth(vUv.x) + 1.0e-5;
    float costelas = 1.0 - smoothstep(0.0, 0.62, abs(fract(vUv.x * 120.0 - 0.5) - 0.5) / (e * 120.0));
    float ey = fwidth(vUv.y) + 1.0e-5;
    float bordas = 1.0 - smoothstep(0.0, 0.66, min(vUv.y, 1.0 - vUv.y) / ey);
    float nasc = nascer(vTerm);
    float a = (costelas * 0.32 + bordas * 0.58) * nasc * vida(vTerm, nasc);
    float tl = tela(vTerm, nasc) * (1.0 - smoothstep(0.0, 0.6, vUv.y));
    gl_FragColor = vec4(corHolo(vTerm) * a + mix(CIANO, LIMA, 0.3) * tl * 0.55, min(1.0, a * 0.5 + tl * 0.55));
  }
`;
