// ════════════════════════════════════════════════════════════════════════
//  MODO DEMONSTRAÇÃO DO ATUALIZADOR (?demo=…)
//  ---------------------------------------------------------------------
//  Troca o `navigator.serial` por uma controladora FALSA e o esptool por um
//  gravador que só conta o tempo, pra percorrer os cinco passos da página
//  sem pedal nenhum (conferência visual, prints, treino). O protocolo do
//  canal de controle é o mesmo do firmware (USB_CONTROL.h): "> METODO /rota"
//  → "< STATUS json". Nada aqui é carregado fora do ?demo.
//
//  Variantes (valor do ?demo):
//    1        BFMiDi S3 8SW+ na 15.1, atualização disponível, porta do ROM já
//             autorizada (caminho feliz)
//    auth     idem, mas a porta nova exige a autorização do usuário (o S2 de
//             verdade sempre cai aqui na primeira vez)
//    same     controladora já na versão publicada
//    s2       BFMiDi 3 7S (ESP32-S2, DEVICE USB-C)
//    boot     controladora já em modo de gravação (sem identificação)
//    legacy   firmware antigo, sem /version
//    mute     a porta abre mas a controladora não responde ao PING
//    fail     o chip não responde ao esptool (erro depois do reset)
//  USB HOST (as placas BFMiDi 3/S3 têm um; a falsa nasce na 3.5, publicada 3.7):
//    hostok   host já na versão publicada
//    hostmute host que nunca respondeu à controladora
//    hostonly controladora em dia, só o host desatualizado
//  Em `auth` a porta do ROM do host também exige a autorização.
//    wrongport o USB Host já aparece no PC (modo computador, 303A:1001) e a
//             janela de portas entrega ELE primeiro quando a página procura a
//             controladora — a página tem que recusar (4 MB) e pedir de novo.
//    hostdirect só o host no PC (porta HOST, já em modo de gravação, 303A:0009,
//             sem autorização), sem controladora na DEVICE — a gravação direta
//             das FERRAMENTAS; `boot` serve pra testar Sair do modo de gravação
//             e Identificar o chip, e `1` o Reiniciar a controladora.
// ════════════════════════════════════════════════════════════════════════

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const enc = new TextEncoder();

let MODE = '1';
let pubVersion = '15.2';
const ports = [];            // portas "plugadas" (o que getPorts devolve, se autorizadas)
const listeners = { connect: [], disconnect: [] };
function emit(kind, port) { listeners[kind].forEach((fn) => { try { fn({ target: port }); } catch { } }); }

// ─── dados da controladora falsa ──────────────────────────────────────────
function profile() {
  const base = {
    board: 'BFMIDI-S3 8SW+', chip: 's3', fw: '15.1', webapp: '15.1+a4712d827f87',
    id: 'B55BCC', mac: '30EDA0B55BCC', serial: 'BFX-261023-141501', appPid: 0x80c2, romPid: 0x0009,
  };
  if (MODE === 's2') Object.assign(base, { board: 'BFMIDI-3 7S', chip: 's2', fw: '14.9', webapp: '14.9+9e2f8fdf5186', romPid: 0x0002, id: 'A1F3C2', serial: '' });
  if (MODE === 'same') Object.assign(base, { fw: pubVersion, webapp: pubVersion + '+9984e06117c4' });
  if (MODE === 'legacy') Object.assign(base, { fw: '', webapp: '', board: 'BFMIDI-2 NANO', chip: 's2', romPid: 0x0002, serial: '', id: '' });
  if (MODE === 'hostonly') Object.assign(base, { fw: pubVersion, webapp: pubVersion + '+9984e06117c4' });
  return base;
}
const HOST_PUB = '3.7';
export function hostManifest() {
  return { version: HOST_PUB, files: [
    { path: 'bootloader.bin', address: 0, size: 13616 }, { path: 'partition-table.bin', address: 32768, size: 3072 },
    { path: 'app.bin', address: 65536, size: 915552 } ] };
}

// Backup pequeno no formato do firmware (presets + sw_params), o suficiente
// pra extrair, fatiar e devolver.
function fakeBackup(p) {
  const presets = {};
  const sw = {};
  const names = ['CLEAN', 'CRUNCH', 'LEAD', 'AMBIENT', 'SOLO', 'MUTE'];
  for (let i = 0; i < 12; i++) {
    const tag = String.fromCharCode(65 + Math.floor(i / 6)) + ((i % 6) + 1);
    presets[tag] = `name=${names[i % 6]} ${tag}|pc=${i}|ch=1|bg_color=3|tag_color=11|layer2=0`;
    sw[tag] = `v=3\nsw1.fx1:num=50|ch=1|start=1|color=0\nsw2.fx1:num=55|ch=1|start=0|color=4`;
  }
  return { version: 3, board: p.board, presets, sw_params: sw };
}
// MIDIA com cota, pra reproduzir "o backup volta mas os icones se perdem":
// a controladora falsa comeca com a midia DO USUARIO (3 imagens, 6 icones
// fora dos slots de fabrica) e, depois da gravacao, volta com o PACOTE DE
// FABRICA assado (13 imagens + 10 icones = ~457 KB) dentro da cota de 490 KB
// do S2 (?demo=s2; no S3 a cota e de 2436 KB e tudo cabe). Sem apagar as
// sobras, os 3 ultimos icones do usuario nao cabem.
const mediaQuota = () => (profile().chip === 's2' ? 490 : 2436) * 1024;   // cota unica por chip, como o firmware
const USER_MEDIA = { img: { 0: 20480, 1: 20480, 2: 20480 }, icon: { 10: 12288, 11: 12288, 12: 12288, 13: 12288, 14: 12288, 15: 12288 } };
function factoryMedia() {
  const m = { img: {}, icon: {} };
  for (let i = 0; i < 13; i++) m.img[i] = 23552;
  for (let i = 0; i < 10; i++) m.icon[i] = 16180;
  return m;
}
const mediaTotal = (m) => Object.values(m.img).reduce((a, b) => a + b, 0) + Object.values(m.icon).reduce((a, b) => a + b, 0);
function b64(bytes) { let s = ''; for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000)); return btoa(s); }
const TINY_JPEG = b64(new Uint8Array(900).map((_, i) => (i * 37) & 0xff));

// ─── a porta falsa ────────────────────────────────────────────────────────
class FakePort {
  constructor(pid, label) {
    this.pid = pid; this.label = label;
    this.connected = true; this.granted = true;
    this.readable = null; this.writable = null;
    this._rc = null; this._open = false; this._baud = 0; this._buf = '';
    this._dtr = false; this._rts = false;
  }
  getInfo() { return { usbVendorId: 0x303a, usbProductId: this.pid }; }
  async open({ baudRate }) {
    if (this._open) throw new DOMException('Failed to open serial port: already open', 'InvalidStateError');
    if (!this.connected) throw new DOMException('Failed to open serial port.', 'NetworkError');
    this._open = true; this._baud = baudRate;
    const self = this;
    this.readable = new ReadableStream({
      start(c) { self._rc = c; },
      cancel() { self._rc = null; },
    });
    this.writable = new WritableStream({
      write(chunk) { self._onWrite(chunk); },
    });
    await sleep(60);
  }
  async setSignals({ dataTerminalReady, requestToSend }) {
    if (!this._open) throw new DOMException('closed', 'InvalidStateError');
    // DTR=0/RTS=1 seguido de DTR=1/RTS=1 é a sequência que põe o CDC do
    // arduino-esp32 em modo download. No `auth`/`s2` ela "não pega" (como num
    // driver que não repassa os sinais) e a página cai no 1200 bps touch.
    const prev = `${this._dtr ? 1 : 0}${this._rts ? 1 : 0}`;
    this._dtr = !!dataTerminalReady; this._rts = !!requestToSend;
    const now = `${this._dtr ? 1 : 0}${this._rts ? 1 : 0}`;
    if (prev === '01' && now === '11' && this.pid !== 0x0009 && this.pid !== 0x0002 && this.pid !== 0x1001) {
      if (MODE !== 'auth' && MODE !== 's2') setTimeout(() => world.resetToRom(this), 250);
    }
  }
  async close() {
    this._open = false;
    try { if (this._rc) this._rc.close(); } catch { }
    this._rc = null; this.readable = null; this.writable = null;
    if (this._baud === 1200 && this.pid !== 0x0009 && this.pid !== 0x0002 && this.pid !== 0x1001) {
      setTimeout(() => world.resetToRom(this), 250);   // 1200 bps touch
    }
    await sleep(40);
  }
  _send(line) { try { if (this._rc) this._rc.enqueue(enc.encode(line + '\n')); } catch { } }
  _onWrite(chunk) {
    this._buf += new TextDecoder().decode(chunk);
    let nl;
    while ((nl = this._buf.indexOf('\n')) >= 0) {
      const line = this._buf.slice(0, nl).trim(); this._buf = this._buf.slice(nl + 1);
      this._handle(line);
    }
  }
  _handle(line) {
    if (MODE === 'mute') return;                      // controladora que não fala
    const m = /^>\s*(\S+)\s*(\S*)\s*([\s\S]*)$/.exec(line);
    if (!m) return;
    const [, method, pathQ] = m;
    const delay = 25 + Math.random() * 40;
    setTimeout(() => {
      if (method === 'PING') return this._send('< PONG');
      const [path, query] = pathQ.split('?');
      const q = Object.fromEntries(new URLSearchParams(query || ''));
      const p = profile();
      const ok = (obj) => this._send('< 200 ' + JSON.stringify(obj));
      const nf = () => this._send('< 404 {"error":"not found"}');
      if (method === 'GET') {
        if (path === '/version') return MODE === 'legacy' ? nf() : ok({ fw: p.fw, webapp: p.webapp, chip: p.chip, board: p.board, ota: p.chip === 's3', running: 'ota_0' });
        if (path === '/config/global') return ok({ version: 1, chip: p.chip, board: p.board, led_brightness: 40 });
        if (path === '/ping') return ok({ ok: true, product: 'BFMIDI', device_id: p.id, mac: p.mac, via_ap: false });
        if (path === '/hardtest/cert') return p.serial ? ok({ supported: 1, present: 1, serial: p.serial, date: '23/10/2026 14:15', by: 'ADM BFX' }) : nf();
        if (path === '/usb_host/status') {
          const h = world.host;
          if (!q.cached && h.state === 'app' && h.seen !== false) h.lastSeen = Date.now();   // pedido novo: o host responde
          const age = Date.now() - h.lastSeen;
          return ok({ online: h.state === 'app' && h.seen !== false && age < 3000, protocol_ok: true, last_seen_ms: age,
            mode: 3, mode_label: 'AUTOMATICO', status_text: h.state === 'app' ? 'USB MIDI: 0 conectados' : '',
            host_version: h.seen === false ? '' : h.version, status_seen: h.seen !== false, bridge_flash: true,
            manufacturer: 'BFFX', product: 'BFMIDI USB Host', last_ack: h.lastAck, pending_update: false, restart: h.restart || '',
            devices_reported: true, devices: h.state === 'app' ? [{ kind: 'midi', index: 0, port: 3, vid: '84EF', pid: '0184', ready: true, manufacturer: 'Valeton', product: 'GP5' }] : [] });
        }
        if (path === '/backup') {
          const json = enc.encode(JSON.stringify(fakeBackup(p)));
          const CH = 1200, seq = +(q.seq || 0), off = seq * CH, end = Math.min(off + CH, json.length);
          return ok({ seq, fin: end >= json.length ? 1 : 0, data: b64(json.subarray(off, end)) });
        }
        if (path === '/img/list' || path === '/icon/list') {
          const kind = path.startsWith('/img') ? 'img' : 'icon', n = kind === 'img' ? 40 : 60;
          const t = world.media[kind];
          return ok({ count: n, slots: Array.from({ length: n }, (_, i) => ({ slot: i, exists: !!t[i], size: t[i] || 0 })), media_total: mediaTotal(world.media), media_max: mediaQuota() });
        }
        if (path === '/img/read' || path === '/icon/read') return ok({ slot: +q.slot, size: 900, data: TINY_JPEG });
        if (path === '/upedal') return ok(+q.n === 1 ? { name: 'MEU DELAY', cc: { 20: 'Mix', 21: 'Time' }, pc: {} } : { name: '', cc: {}, pc: {} });
        return nf();
      }
      if (method === 'POST') {
        if (path === '/update/screen') return ok({ ok: true });
        if (path === '/usb_host/restart') {
          const h = world.host;
          h.restart = 'sent';
          setTimeout(() => { h.restart = 'ok'; h.lastAck = 0; h.lastSeen = Date.now(); }, 400);
          setTimeout(() => { h.state = 'rom'; }, 900);
          setTimeout(() => { h.state = 'app'; h.restart = 'done'; h.lastAck = 255; h.lastSeen = Date.now(); }, 3200);
          return ok({ sent: true, request_id: 9 });
        }
        if (path === '/usb_host/update_mode') {
          world.hostToRom();
          return ok({ sent: true, request_id: 7 });
        }
        if (path === '/img/upload' || path === '/icon/upload') {
          const kind = path.startsWith('/img') ? 'img' : 'icon', slot = +q.slot;
          if (q.seq === '0') {
            // o tamanho "de verdade" e o que o usuario tinha naquele slot (o
            // demo manda 900 B); a cota e a do firmware: tudo menos o slot
            // que vai ser substituido
            const size = (USER_MEDIA[kind] && USER_MEDIA[kind][slot]) || 900;
            const base = mediaTotal(world.media) - (world.media[kind][slot] || 0);
            if (base + size > mediaQuota()) return this._send('< 400 {"error":"upload begin falhou (quota/fs)"}');
            world.media[kind][slot] = size;
          }
          return ok({ ok: true, slot, persisted: true });
        }
        if (path === '/img/delete' || path === '/icon/delete') {
          const kind = path.startsWith('/img') ? 'img' : 'icon';
          delete world.media[kind][+q.slot];
          return ok({ ok: true, slot: +q.slot });
        }
        if (path === '/upedal') return ok({ ok: true, persisted: true });
        if (path === '/restore') return ok({ applied: q.fin === '1' ? 12 : 0, rejected: 0, persisted: true });
        return nf();
      }
      nf();
    }, delay);
  }
}

// ─── o "mundo": quem está plugado, reset, volta do app ────────────────────
const world = {
  app: null, rom: null,
  media: { img: Object.assign({}, USER_MEDIA.img), icon: Object.assign({}, USER_MEDIA.icon) },
  // o USB HOST: 'app' (respondendo à controladora) ou 'rom' (no bootloader,
  // visível no PC pela porta HOST como 303A:0009)
  host: { state: 'app', version: MODE === 'hostok' ? HOST_PUB : '3.5', seen: true, lastSeen: 0, lastAck: 255 },
  hostRom: null, strayHost: null, wrongServed: false,
  hostToRom() {
    const h = this.host;
    setTimeout(() => { h.lastAck = 0; h.lastSeen = Date.now(); }, 300);        // o ACK (quadro novo, ack 0)
    setTimeout(() => { h.state = 'rom'; }, 1800);                               // silêncio
    setTimeout(() => {
      this.hostRom = new FakePort(0x0009, 'ESP32-S3');
      this.hostRom.granted = MODE !== 'auth';
      ports.push(this.hostRom);
      if (this.hostRom.granted) emit('connect', this.hostRom);
    }, 3200);
  },
  hostRomToApp() {
    this.host.state = 'rom';   // reiniciando: não responde à controladora até o firmware novo subir (2,5 s)
    if (this.hostRom) {
      this.hostRom.connected = false;
      const i = ports.indexOf(this.hostRom); if (i >= 0) ports.splice(i, 1);
      emit('disconnect', this.hostRom); this.hostRom = null;
    }
    if (this.strayHost) {   // em modo computador a porta 1001 some quando o host volta ao firmware normal
      this.strayHost.connected = false;
      const i = ports.indexOf(this.strayHost); if (i >= 0) ports.splice(i, 1);
      emit('disconnect', this.strayHost); this.strayHost = null;
    }
    setTimeout(() => { this.host.state = 'app'; this.host.version = HOST_PUB; this.host.lastAck = 255; this.host.lastSeen = Date.now(); }, 2500);
  },
  plugApp() {
    const p = profile();
    this.app = new FakePort(p.appPid, 'BFMiDi');
    ports.length = 0;
    if (this.strayHost) ports.push(this.strayHost);   // o host em modo computador continua listado no PC
    ports.push(this.app);
    emit('connect', this.app);
  },
  resetToRom(from) {
    if (!from || from !== this.app || !from.connected) return;
    from.connected = false;
    try { if (from._rc) from._rc.close(); } catch { }
    const i = ports.indexOf(from); if (i >= 0) ports.splice(i, 1);
    emit('disconnect', from);
    setTimeout(() => {
      const p = profile();
      this.rom = new FakePort(p.romPid, 'ROM');
      this.rom.granted = MODE !== 'auth' && MODE !== 's2' && MODE !== 'wrongport';   // precisa de requestPort
      ports.push(this.rom);
      if (this.rom.granted) emit('connect', this.rom);
    }, 1200);
  },
  romToApp() {
    if (this.rom) { this.rom.connected = false; const i = ports.indexOf(this.rom); if (i >= 0) ports.splice(i, 1); emit('disconnect', this.rom); this.rom = null; }
    this.media = factoryMedia();   // a LittleFS gravada traz o pacote de fabrica
    setTimeout(() => this.plugApp(), 1800);
  },
};

const fakeSerial = {
  async getPorts() { return ports.filter((p) => p.granted); },
  async requestPort() {
    await sleep(700);   // "a janela do navegador"
    // wrongport: a primeira escolha depois do reset da controladora é o USB
    // Host (a linha errada); só a segunda é o ROM da controladora.
    if (MODE === 'wrongport' && world.rom && !world.rom.granted && !world.wrongServed) { world.wrongServed = true; return world.strayHost; }
    const cand = ports.find((p) => !p.granted) || ports[0];
    if (!cand) throw new DOMException('No port selected by the user.', 'NotFoundError');
    cand.granted = true;
    return cand;
  },
  addEventListener(kind, fn) { if (listeners[kind]) listeners[kind].push(fn); },
  removeEventListener(kind, fn) { if (listeners[kind]) listeners[kind] = listeners[kind].filter((f) => f !== fn); },
};

// ─── esptool falso ────────────────────────────────────────────────────────
export class Transport {
  constructor(port) { this.port = port; }
  async connect() { await sleep(80); }
  async disconnect() { await sleep(40); }
  async waitForUnlock() { }
  async setDTR() { } async setRTS() { }
}
export class ESPLoader {
  constructor({ transport, terminal }) {
    this.transport = transport; this.terminal = terminal;
    this.isHost = transport && (transport.port === world.hostRom || transport.port === world.strayHost);
    const p = profile();
    const name = (this.isHost || p.chip === 's3') ? 'ESP32-S3' : 'ESP32-S2';
    this.chip = { CHIP_NAME: name, getChipDescription: async () => name + ' (QFN56)',
      readMac: async () => (this.isHost ? '34:85:18:7a:2c:e0' : profile().mac.replace(/(..)(?=.)/g, '$1:').toLowerCase()) };
  }
  async getFlashSize() { await sleep(120); return this.isHost ? 4096 : (profile().chip === 's2' ? 4096 : 16384); }
  async main() {
    await sleep(500);
    if (MODE === 'fail') { await sleep(1500); throw new Error('Failed to connect with the device: Timed out waiting for packet header'); }
    const p = profile();
    this.terminal.writeLine(`Chip is ${p.chip === 's2' ? 'ESP32-S2' : 'ESP32-S3 (QFN56) (revision v0.2)'}`);
    this.terminal.writeLine('Features: WiFi, BLE, Embedded PSRAM 8MB');
    this.terminal.writeLine(`MAC: ${profile().mac.replace(/(..)(?=.)/g, '$1:').toLowerCase()}`);
    this.terminal.writeLine('Uploading stub... Running stub... Stub running...');
  }
  async eraseFlash() { await sleep(1800); }
  async writeFlash({ fileArray, reportProgress }) {
    const dur = this.isHost ? [400, 200, 3600] : [500, 250, 4200, 250, 5200];
    for (let i = 0; i < fileArray.length; i++) {
      const total = fileArray[i].data.length || 1000;
      const d = dur[Math.min(i, dur.length - 1)];
      const steps = 40;
      for (let s = 1; s <= steps; s++) { await sleep(d / steps); reportProgress(i, Math.floor(total * s / steps), total); }
      this.terminal.writeLine(`Wrote ${total} bytes at 0x${(i * 0x1000).toString(16)} — hash of data verified.`);
    }
  }
  // O S3 de verdade reinicia pelo watchdog do RTC (WDTCONFIG0): e o que faz o
  // ROM virar app de novo no mundo falso.
  async writeReg(addr) { await sleep(30); if (addr === 0x60008098) setTimeout(() => (this.isHost ? world.hostRomToApp() : world.romToApp()), 200); }
  async after() { await sleep(120); if (this.isHost) world.hostRomToApp(); else world.romToApp(); }
  async hardReset() { await sleep(80); if (this.isHost) { if (world.hostRom) world.hostRomToApp(); } else if (world.rom) world.romToApp(); }
}

// Download "do servidor": só conta o tempo (o arquivo de verdade teria MB).
export async function fetchBin(entry, onPct) {
  const d = /firmware|littlefs/.test(entry.file) ? 900 : 200;
  for (let s = 1; s <= 10; s++) { await sleep(d / 10); if (onPct) onPct(s * 10); }
  return 'x'.repeat(Math.max(1024, Math.min(entry.size || 4096, 65536)));
}

export function install(mode) {
  MODE = String(mode || '1');
  if (MODE === 'wrongport') {
    world.strayHost = new FakePort(0x1001, 'USB JTAG/serial debug unit');   // o host em modo computador
    ports.push(world.strayHost);
  }
  world.host.version = MODE === 'hostok' ? HOST_PUB : (MODE === 'legacy' ? '' : '3.5');
  world.host.seen = MODE !== 'hostmute';
  try { Object.defineProperty(navigator, 'serial', { value: fakeSerial, configurable: true }); }
  catch { navigator.serial = fakeSerial; }
  fetch('./version.json').then((r) => r.json()).then((m) => { pubVersion = m.version || pubVersion; }).catch(() => { });
  if (MODE === 'boot') {
    const p = profile();
    world.rom = new FakePort(p.romPid, 'ROM');
    ports.push(world.rom);
  } else if (MODE === 'hostdirect') {
    // só o host, no cabo da porta HOST, já em modo de gravação — sem controladora
    // na DEVICE; a porta ainda precisa da autorização (Ferramentas › gravar direto)
    world.hostRom = new FakePort(0x0009, 'ESP32-S3');
    world.hostRom.granted = false;
    ports.push(world.hostRom);
  } else {
    // a controladora é "plugada" 1,2 s depois de a página abrir, autorizada
    // de uma sessão anterior — a página deve identificá-la sozinha.
    setTimeout(() => world.plugApp(), 1200);
  }
  console.log('[demo] atualizador em modo demonstração:', MODE);
}
