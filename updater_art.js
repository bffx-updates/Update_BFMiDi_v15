// ════════════════════════════════════════════════════════════════════════
//  ILUSTRAÇÕES DO ATUALIZADOR (out/2026)
//  ---------------------------------------------------------------------
//  Porte em JavaScript puro dos desenhos do editor
//  (webApp/components/hostupdateart.jsx): CLOSE-UP de UMA porta por vez,
//  nunca a controladora inteira — cada modelo tem as portas num lado e o
//  usuário copiaria a posição do desenho. A porta DEVICE é USB-C na BFMiDi 1,
//  2 e 3 e USB-B na BFMiDi S3 (`deviceC` escolhe); antes de saber o modelo,
//  o passo 1 ALTERNA os dois conectores no mesmo quadro.
//
//  As peças são desenhadas em coordenadas "de pedal" (porta em y = PORT_Y)
//  e ampliadas K vezes em volta da porta. Só preenchimento chapado + CSS
//  (classes `ar-*`, no index.html); sem <defs>/ids, porque dois desenhos
//  podem estar montados ao mesmo tempo (a transição entre passos).
//
//  MOVIMENTO só em CSS. Sem `prefers-reduced-motion: no-preference` cada
//  desenho fica parado na pose que explica o passo.
//
//  TRANSFORM: `transform` de CSS num elemento SVG substitui o atributo
//  `transform` — por isso o zoom (atributo) fica num <g> de fora e a
//  animação (CSS) sempre num <g> de dentro, sem atributo próprio.
// ════════════════════════════════════════════════════════════════════════

const PORT_Y = 64;
const K = 2.6;
const CX = 160;
const CY = 104;
const ARROW_X = CX + 74;
const VIEWBOX = '0 0 320 200';

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

function tag(x, label, hot) {
  const w = label.length * 5.4 + 9;
  return `<g class="ar-tag${hot ? ' is-hot' : ''}">
    <rect x="${x - w / 2}" y="84" width="${w}" height="10" rx="1.6"/>
    <text x="${x}" y="91.4" text-anchor="middle">${esc(label)}</text></g>`;
}

function portUsbB(x) {
  return `<g class="ar-port">
    <rect class="ar-hole" x="${x - 8}" y="${PORT_Y - 7}" width="16" height="14" rx="2"/>
    <path class="ar-metal" d="M${x - 5} ${PORT_Y + 4} V${PORT_Y - 2} L${x - 3} ${PORT_Y - 4} H${x + 3} L${x + 5} ${PORT_Y - 2} V${PORT_Y + 4} Z"/>
    <rect class="ar-hole" x="${x - 2.6}" y="${PORT_Y - 1.4}" width="5.2" height="3.6" rx=".6"/></g>`;
}
function portUsbC(x) {
  return `<g class="ar-port">
    <rect class="ar-hole" x="${x - 9}" y="${PORT_Y - 4.2}" width="18" height="8.4" rx="4.2"/>
    <rect class="ar-metal" x="${x - 5.6}" y="${PORT_Y - 1}" width="11.2" height="2" rx="1"/></g>`;
}

// Plugues apontando pra baixo, já na pose ENCAIXADA; as animações os tiram
// de lá subindo.
function plugUsbC(x, cls) {
  return `<g class="ar-plug ${cls || ''}">
    <path class="ar-cable" d="M${x} -60 V40"/>
    <rect class="ar-boot" x="${x - 8.5}" y="36" width="17" height="22" rx="5.5"/>
    <rect class="ar-boot-hi" x="${x - 6}" y="38.5" width="3" height="16" rx="1.5"/>
    <rect class="ar-tip" x="${x - 6.4}" y="57" width="12.8" height="9.5" rx="3"/></g>`;
}
function plugUsbB(x, cls) {
  return `<g class="ar-plug ${cls || ''}">
    <path class="ar-cable" d="M${x} -60 V36"/>
    <rect class="ar-boot" x="${x - 10}" y="30" width="20" height="26" rx="4"/>
    <rect class="ar-boot-hi" x="${x - 7.5}" y="33" width="3" height="19" rx="1.5"/>
    <path class="ar-tip" d="M${x - 7} 55 H${x + 7} V64 L${x + 5} 67 H${x - 5} L${x - 7} 64 Z"/></g>`;
}
const plugFor = (deviceC) => (deviceC ? plugUsbC : plugUsbB);

// Plugue de um APARELHO (TONEX, hub…) na porta HOST: outra cor de capa e um
// pedalzinho na ponta do cabo, pra não confundir com o cabo do computador.
function plugGear(x, cls) {
  return `<g class="ar-plug is-gear ${cls || ''}">
    <path class="ar-cable" d="M${x} 14 V40"/>
    <rect class="ar-gear" x="${x - 17}" y="-8" width="34" height="22" rx="4"/>
    <circle class="ar-gear-knob" cx="${x - 7}" cy="3" r="3.4"/>
    <circle class="ar-gear-knob" cx="${x + 7}" cy="3" r="3.4"/>
    <rect class="ar-boot" x="${x - 8.5}" y="36" width="17" height="22" rx="5.5"/>
    <rect class="ar-tip" x="${x - 6.4}" y="57" width="12.8" height="9.5" rx="3"/></g>`;
}

// O close-up: a borda da controladora atravessando o quadro inteiro (cortada
// dos dois lados — nada diz onde a porta fica), a porta no meio, o rótulo
// embaixo e `inner` (plugue, dados) nas mesmas coordenadas, em x = 0.
// `port` = 'device' (USB-C ou USB-B conforme `deviceC`) ou 'host' (sempre
// USB-C, em todas as placas).
function close(deviceC, cls, inner, port) {
  const host = port === 'host';
  const usbC = host ? true : deviceC;
  return `<g class="ar-close${cls ? ' ' + cls : ''}">
    <g transform="translate(${CX} ${CY}) scale(${K}) translate(0 ${-PORT_Y})">
      <rect class="ar-top" x="-80" y="78" width="160" height="60"/>
      <rect class="ar-face" x="-80" y="44" width="160" height="36"/>
      <path class="ar-face-lip" d="M-80 80.5 H80"/>
      <rect class="ar-target" x="${host ? -14 : -13}" y="${PORT_Y - 12}" width="${host ? 28 : 26}" height="24" rx="7"/>
      ${usbC ? portUsbC(0) : portUsbB(0)}
      ${tag(0, host ? 'HOST' : 'DEVICE', true)}
      ${inner || ''}
    </g></g>`;
}

// Close da TELA da controladora: acesa (os ícones do LIVE) ou apagada.
function screen(lit, cls) {
  return `<g class="ar-screenbox${lit ? ' is-lit' : ''}">
    <rect class="ar-top" x="-10" y="-10" width="340" height="220"/>
    <rect class="ar-bezel" x="58" y="26" width="204" height="138" rx="14"/>
    <rect class="ar-screen" x="68" y="36" width="184" height="118" rx="8"/>
    ${lit ? `<g class="ar-screen-lit${cls ? ' ' + cls : ''}">
      <rect class="ar-screen-glow" x="68" y="36" width="184" height="118" rx="8"/>
      <rect class="ar-tile is-a" x="80" y="48" width="48" height="40" rx="6"/>
      <rect class="ar-tile is-b" x="136" y="48" width="48" height="40" rx="6"/>
      <rect class="ar-tile is-c" x="192" y="48" width="48" height="40" rx="6"/>
      <rect class="ar-tile is-d" x="80" y="102" width="48" height="40" rx="6"/>
      <rect class="ar-tile is-e" x="136" y="102" width="48" height="40" rx="6"/>
      <rect class="ar-tile is-f" x="192" y="102" width="48" height="40" rx="6"/></g>` : ''}
  </g>`;
}

function arrows(x, y, dir) {
  const d = dir === 'up' ? 'M-8 4 L0 -4 L8 4' : 'M-8 -4 L0 4 L8 -4';
  return `<g transform="translate(${x} ${y})"><g class="ar-arrows is-${dir}">
    <path class="ar-arrow a1" d="${d}" transform="translate(0 -10)"/>
    <path class="ar-arrow a2" d="${d}"/>
    <path class="ar-arrow a3" d="${d}" transform="translate(0 10)"/></g></g>`;
}

function badge(x, y, kind, cls, big) {
  return `<g transform="translate(${x} ${y}) scale(${big ? 1.9 : 1.3})"><g class="ar-badge is-${kind} ${cls || ''}">
    <circle r="11"/>
    ${kind === 'ok' ? '<path d="M-5 0.5 L-1.5 4 L5.5 -3.5"/>' : '<path d="M-4 -4 L4 4 M4 -4 L-4 4"/>'}
  </g></g>`;
}

function laptop(x, y) {
  return `<g class="ar-laptop" transform="translate(${x} ${y})">
    <rect x="-19" y="0" width="38" height="24" rx="3"/>
    <rect class="ar-laptop-scr" x="-15.5" y="3.2" width="31" height="17.6" rx="1.2"/>
    <path d="M-25 26.5 H25 L21 31 H-21 Z"/></g>`;
}
// Laptop + o tracejado até o cabo (para ANTES do plugue; a capa do USB-B é
// mais larga que a do USB-C).
function laptopLink(deviceC, dir) {
  return laptop(70, 6) +
    `<path class="ar-dash${dir === 'up' ? ' is-up' : ''}" d="${deviceC ? 'M98 20 H146' : 'M98 20 H126'}"/>`;
}

// Nuvem (a internet) acima do laptop, com o tracejado descendo até ele.
function cloud(x, y) {
  return `<g class="ar-cloud" transform="translate(${x} ${y}) scale(1.9)">
    <path d="M-14 8 a7 7 0 0 1 2 -13.6 a9 9 0 0 1 17 -2 a7 7 0 0 1 8 9.6 a5.5 5.5 0 0 1 -2 11 H-12 a5 5 0 0 1 -2 -5 Z"/>
    <path class="ar-cloud-arrow" d="M0 -4 V7 M-3.5 3.5 L0 7 L3.5 3.5"/></g>`;
}

function chip(x, y, s, cls) {
  return `<g transform="translate(${x} ${y}) scale(${s || 1})"><g class="ar-chip ${cls || ''}">
    <g class="ar-chip-halo-wrap"><circle class="ar-chip-halo" r="20"/></g>
    <rect x="-11" y="-11" width="22" height="22" rx="3.5"/>
    <path class="ar-chip-pins" d="M-6 -11 V-15 M0 -11 V-15 M6 -11 V-15 M-6 11 V15 M0 11 V15 M6 11 V15 M-11 -6 H-15 M-11 0 H-15 M-11 6 H-15 M11 -6 H15 M11 0 H15 M11 6 H15"/>
    <path class="ar-chip-arrow" d="M0 -6 V4 M-4 0.5 L0 4.5 L4 0.5"/></g></g>`;
}

// Dados descendo (computador → controladora) ou subindo pelo cabo.
function dataDots(dir) {
  return `<g class="ar-data${dir === 'up' ? ' is-up' : ''}">
    <circle class="d1" cx="0" cy="-40" r="2.4"/>
    <circle class="d2" cx="0" cy="-40" r="2.4"/>
    <circle class="d3" cx="0" cy="-40" r="2.4"/></g>`;
}

function svg(kind, body) {
  return `<svg class="ar is-${kind}" viewBox="${VIEWBOX}" focusable="false" aria-hidden="true">${body}</svg>`;
}

// ─── os quadros ───────────────────────────────────────────────────────────
// plug      passo 1: o cabo do computador entra na DEVICE; alterna USB-C e
//           USB-B porque o modelo ainda não é conhecido (`deviceC` null) —
//           com o modelo conhecido mostra só o conector certo.
// scan      identificando: cabo encaixado, anel pulsando, dados subindo.
// download  baixando o firmware: nuvem → laptop.
// backup    guardando os dados: dados SUBINDO pelo cabo até o laptop.
// boot      reiniciando em modo gravação: o chip "baixa".
// flash     gravando: dados DESCENDO pelo cabo (o anel de % vem por fora).
// restore   devolvendo os dados: dados descendo, selo verde.
// reboot    a tela apaga e volta sozinha.
// done      pronto: tela acesa com o selo.
// fail      falhou: cabo encaixado e o selo vermelho.
// idle      só o close-up com o cabo encaixado (controladora reconhecida).
export function art(kind, opts = {}) {
  const deviceC = opts.deviceC;
  const plug = plugFor(deviceC !== false);
  switch (kind) {
    case 'plug': {
      if (deviceC === true || deviceC === false) {
        return svg(kind,
          close(deviceC, '', plug(0, 'anim-in')) + laptopLink(deviceC) + arrows(ARROW_X, 46, 'down'));
      }
      const lbl = (t1, t2) => `<g class="ar-lbl"><rect x="216" y="10" width="96" height="30" rx="7"/>
        <text x="264" y="23" text-anchor="middle" class="l1">${t1}</text><text x="264" y="34" text-anchor="middle" class="l2">${t2}</text></g>`;
      return svg(kind,
        `<g class="seq-a">${close(true, '', plugUsbC(0, 'anim-in')) + laptopLink(true) + lbl('USB-C', 'BFMiDi 1 · 2 · 3')}</g>` +
        `<g class="seq-b">${close(false, '', plugUsbB(0, 'anim-in anim-late')) + laptopLink(false) + lbl('USB-B', 'BFMiDi S3')}</g>` +
        arrows(ARROW_X, 46, 'down'));
    }
    case 'idle':
      return svg(kind, close(deviceC !== false, '', plug(0, '')) + laptopLink(deviceC !== false));
    case 'scan':
      return svg(kind,
        close(deviceC !== false, '', plug(0, '') + dataDots('up') +
          `<g class="ar-stay-wrap"><circle class="ar-stay" cx="0" cy="${PORT_Y}" r="19"/></g>`) +
        laptopLink(deviceC !== false, 'up'));
    case 'download':
      // A internet e o computador: a controladora não participa deste passo.
      return svg(kind,
        cloud(160, 42) + `<path class="ar-dash is-down" d="M160 54 V92"/>` +
        `<g class="ar-cloud-dots"><circle class="c1" cx="160" cy="56" r="2.6"/><circle class="c2" cx="160" cy="56" r="2.6"/><circle class="c3" cx="160" cy="56" r="2.6"/></g>` +
        `<g transform="translate(160 96) scale(2.3)">${laptop(0, 0)}</g>` +
        `<g class="ar-dl-bar"><rect class="ar-dl-track" x="124" y="176" width="72" height="5" rx="2.5"/><rect class="ar-dl-fill" x="124" y="176" width="72" height="5" rx="2.5"/></g>`);
    case 'backup':
      return svg(kind,
        close(deviceC !== false, '', plug(0, '') + dataDots('up')) +
        laptopLink(deviceC !== false, 'up') + badge(CX + 86, 150, 'ok', 'anim-badge'));
    case 'boot':
      return svg(kind,
        `<rect class="ar-top" x="-10" y="-10" width="340" height="220"/>` + chip(CX, 96, 2.4, 'anim-pulse'));
    case 'flash':
      return svg(kind,
        close(deviceC !== false, '', plug(0, '') + dataDots('down')) +
        laptopLink(deviceC !== false) + chip(262, 150, 1.15, 'anim-pulse is-inside'));
    case 'restore':
      return svg(kind,
        close(deviceC !== false, '', plug(0, '') + dataDots('down')) +
        laptopLink(deviceC !== false) + badge(CX + 86, 150, 'ok', 'anim-badge'));
    case 'reboot':
      return svg(kind, screen(true, 'anim-reboot'));
    case 'done':
      return svg(kind, screen(true, '') + badge(CX, 95, 'ok', '', true));
    case 'fail':
      return svg(kind, close(deviceC !== false, '', plug(0, '')) + badge(CX + 70, 130, 'err', '', true));
    // ── USB HOST (o segundo cabo) ──
    // hostPlug   o pedal/hub SAI da porta HOST e o cabo do computador ENTRA
    //            (sequência no mesmo quadro); o cabo da DEVICE não aparece de
    //            propósito — ele fica onde está.
    // hostWait   cabo do computador na HOST, anel pulsando (procurando a porta).
    // hostFlash  gravando o host: dados descendo pelo cabo da HOST, chip aceso.
    // hostDone   chip do host com o selo verde.
    // hostFail   cabo na HOST e o selo vermelho.
    case 'hostPlug':
      return svg(kind,
        close(true, '', plugGear(0, 'anim-out-first') + plugUsbC(0, 'anim-swap-in'), 'host') +
        laptopLink(true) + arrows(ARROW_X, 46, 'down'));
    case 'hostWait':
      return svg(kind,
        close(true, '', plugUsbC(0, '') +
          `<g class="ar-stay-wrap"><circle class="ar-stay" cx="0" cy="${PORT_Y}" r="19"/></g>`, 'host') +
        laptopLink(true));
    case 'hostFlash':
      return svg(kind,
        close(true, '', plugUsbC(0, '') + dataDots('down'), 'host') +
        laptopLink(true) + chip(262, 150, 1.15, 'anim-pulse is-inside'));
    case 'hostDone':
      return svg(kind,
        `<rect class="ar-top" x="-10" y="-10" width="340" height="220"/>` + chip(CX, 96, 2.4, '') +
        badge(CX + 54, 60, 'ok', '', true));
    case 'hostFail':
      return svg(kind, close(true, '', plugUsbC(0, ''), 'host') + badge(CX + 70, 130, 'err', '', true));
    default:
      return svg('idle', close(true, '', plugUsbC(0, '')));
  }
}
