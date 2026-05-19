// Tidal Survive — procedural ocean ambience + SFX.
// Public API matches Penguin Rescue: unlockAudio / playSfx / startBgm / stopBgm.

type SfxKey =
  | 'splash'        // step into water
  | 'thunk'         // pick up plank
  | 'thud'          // drop boulder
  | 'plank_drop'    // drop plank
  | 'boulder_lift'  // pick up boulder
  | 'paddle'        // pick up paddle (tide buffer)
  | 'tide_warn'     // 1.5s before tide — low rumble warning
  | 'tide_rise'     // water level +1 (rising)
  | 'tide_ebb'      // water level back to 0 (draining/retreating)
  | 'shark_roar'    // shark lunge / kill
  | 'heartbeat'     // in-water danger pulse
  | 'gull_cry'      // ambient seagull
  | 'foot_dry'      // soft footstep on dry tile
  | 'carry_grunt'   // boulder-carry effort
  | 'ready'         // READY beep
  | 'go'            // GO! beep
  | 'game_over';

let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let bgmGain: GainNode | null = null;
let bgmTimer: number | null = null;
let bgmRunning = false;

function ensureCtx(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  if (!ctx) {
    const AC: typeof AudioContext | undefined =
      (window as any).AudioContext || (window as any).webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = 0.75;
    master.connect(ctx.destination);
  }
  return ctx;
}

export async function unlockAudio() {
  const c = ensureCtx();
  if (c && c.state === 'suspended') await c.resume();
}

// ---------- helpers ----------
function envelope(node: GainNode, peak: number, attack: number, decay: number, t0: number) {
  node.gain.setValueAtTime(0, t0);
  node.gain.linearRampToValueAtTime(peak, t0 + attack);
  node.gain.exponentialRampToValueAtTime(0.0001, t0 + attack + decay);
}

function tone(freq: number, type: OscillatorType, dur: number, peak: number, t0: number, glideTo?: number, dst?: AudioNode) {
  if (!ctx || !master) return;
  const osc = ctx.createOscillator();
  const g = ctx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t0);
  if (glideTo !== undefined) osc.frequency.exponentialRampToValueAtTime(Math.max(20, glideTo), t0 + dur);
  envelope(g, peak, 0.01, dur, t0);
  osc.connect(g).connect(dst ?? master);
  osc.start(t0);
  osc.stop(t0 + dur + 0.05);
}

function noiseBurst(dur: number, peak: number, t0: number, lp = 2000, dst?: AudioNode) {
  if (!ctx || !master) return;
  const buf = ctx.createBuffer(1, Math.ceil(ctx.sampleRate * dur), ctx.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  const src = ctx.createBufferSource();
  src.buffer = buf;
  const filt = ctx.createBiquadFilter();
  filt.type = 'lowpass';
  filt.frequency.value = lp;
  const g = ctx.createGain();
  envelope(g, peak, 0.005, dur, t0);
  src.connect(filt).connect(g).connect(dst ?? master);
  src.start(t0);
  src.stop(t0 + dur + 0.05);
}

// Bandpass-filtered noise burst — used for bubbles (high-Q narrow band) and
// vocal-like grunts (lower wider band).
function noiseBand(dur: number, peak: number, t0: number, centerHz: number, q: number) {
  if (!ctx || !master) return;
  const buf = ctx.createBuffer(1, Math.ceil(ctx.sampleRate * dur), ctx.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  const src = ctx.createBufferSource();
  src.buffer = buf;
  const filt = ctx.createBiquadFilter();
  filt.type = 'bandpass';
  filt.frequency.value = centerHz;
  filt.Q.value = q;
  const g = ctx.createGain();
  envelope(g, peak, 0.003, dur, t0);
  src.connect(filt).connect(g).connect(master);
  src.start(t0);
  src.stop(t0 + dur + 0.05);
}

// Wave-whoosh noise — bandpass-filtered white noise whose center frequency
// SWEEPS over the duration. With a soft attack/decay this gives the classic
// "shhhhh" wave-rolling sound. Use fromHz < toHz for an incoming swell, and
// fromHz > toHz for a receding wave.
function noiseSweep(t0: number, dur: number, peak: number, fromHz: number, toHz: number, q = 1.2) {
  if (!ctx || !master) return;
  const buf = ctx.createBuffer(1, Math.ceil(ctx.sampleRate * dur), ctx.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  const src = ctx.createBufferSource();
  src.buffer = buf;
  const filt = ctx.createBiquadFilter();
  filt.type = 'bandpass';
  filt.Q.value = q;
  filt.frequency.setValueAtTime(fromHz, t0);
  filt.frequency.exponentialRampToValueAtTime(Math.max(40, toHz), t0 + dur * 0.7);
  const g = ctx.createGain();
  // Soft attack (30% of dur), gentle peak hold, long exponential decay.
  // Specifically NOT percussive — water doesn't crack, it builds and recedes.
  g.gain.setValueAtTime(0, t0);
  g.gain.linearRampToValueAtTime(peak, t0 + dur * 0.3);
  g.gain.setValueAtTime(peak, t0 + dur * 0.55);
  g.gain.exponentialRampToValueAtTime(0.0005, t0 + dur);
  src.connect(filt).connect(g).connect(master);
  src.start(t0);
  src.stop(t0 + dur + 0.05);
}

// Single bubble pop — short bandpass blip with a quick frequency drop.
function bubble(t0: number, centerHz: number, peak = 0.18) {
  if (!ctx || !master) return;
  const o = ctx.createOscillator();
  o.type = 'sine';
  o.frequency.setValueAtTime(centerHz * 1.5, t0);
  o.frequency.exponentialRampToValueAtTime(centerHz * 0.6, t0 + 0.07);
  const filt = ctx.createBiquadFilter();
  filt.type = 'bandpass';
  filt.frequency.value = centerHz;
  filt.Q.value = 8;
  const g = ctx.createGain();
  g.gain.setValueAtTime(0, t0);
  g.gain.linearRampToValueAtTime(peak, t0 + 0.005);
  g.gain.exponentialRampToValueAtTime(0.0008, t0 + 0.1);
  o.connect(filt).connect(g).connect(master);
  o.start(t0);
  o.stop(t0 + 0.12);
}

// ---------- SFX ----------
export function playSfx(key: SfxKey) {
  const c = ensureCtx();
  if (!c || !master) return;
  if (c.state === 'suspended') c.resume();
  const t = c.currentTime;
  switch (key) {
    case 'splash':
      // BUBBLES + low slosh. The voice should be unmistakably aqueous.
      // 6 pop bubbles staggered + sub-100Hz body for the water mass.
      tone(95, 'sine', 0.22, 0.18, t, 55);                  // low slosh
      noiseBand(0.18, 0.12, t, 380, 0.6);                    // wet wash
      bubble(t + 0.00, 900, 0.16);
      bubble(t + 0.04, 1300, 0.14);
      bubble(t + 0.09, 700, 0.18);
      bubble(t + 0.14, 1600, 0.10);
      bubble(t + 0.20, 1100, 0.12);
      bubble(t + 0.27, 800, 0.08);
      break;
    case 'thunk':
      // PLANK PICKUP — crisp wood TOCK. Single mid pluck, no body.
      tone(320, 'triangle', 0.06, 0.30, t, 280);             // wood pluck
      noiseBand(0.03, 0.10, t, 4500, 2.0);                   // dry brittle tick
      break;
    case 'plank_drop':
      // PLANK DROP — CLACK. Two-tap wood smack, mid-high register.
      tone(380, 'square', 0.04, 0.30, t,        300);
      tone(260, 'square', 0.05, 0.26, t + 0.05, 200);
      noiseBand(0.04, 0.08, t, 3500, 1.4);
      break;
    case 'boulder_lift':
      // BOULDER PICKUP — HEAVE grunt. Down-sweep saw + vocal-band noise.
      tone(280, 'sawtooth', 0.22, 0.20, t, 150);
      noiseBand(0.26, 0.12, t + 0.02, 380, 1.5);             // grunt body
      tone(220, 'sawtooth', 0.18, 0.10, t + 0.06, 130);
      break;
    case 'thud':
      // BOULDER DROP — deep THUMP. Sub-bass body + sharp crack on top.
      tone(40, 'sine', 0.60, 0.55, t, 30);                   // sub
      tone(110, 'triangle', 0.18, 0.35, t, 70);              // body
      noiseBand(0.05, 0.20, t, 5500, 2.5);                   // crack
      noiseBurst(0.30, 0.10, t + 0.03, 600);                 // long rumble tail
      break;
    case 'paddle':
      // Cheery upward chirp — "buffered!"
      tone(720, 'triangle', 0.10, 0.18, t, 1200);
      tone(1200, 'triangle', 0.12, 0.14, t + 0.08, 1900);
      break;
    case 'tide_warn':
      // Building low rumble — tide coming
      tone(70, 'sine', 0.7, 0.18, t, 55);
      noiseBurst(0.5, 0.12, t + 0.1, 380);
      break;
    case 'tide_rise':
      // Wave rolling in — pure "shhhhh" whoosh. Bandpass noise SWEEPS from
      // low-mid (200Hz) up to bright high (2800Hz) over 1.8s with a soft
      // attack and long decay. No discrete tones, no percussive crests —
      // sounds like actual water rolling onto a beach.
      noiseSweep(t, 1.8, 0.28, 220, 2800, 1.0);
      // A second, quieter, broader pass layered behind for body — gives the
      // wave some low-end "rumble" without sounding mechanical.
      noiseSweep(t + 0.10, 1.5, 0.10, 120, 700, 0.5);
      break;
    case 'tide_ebb':
      // Wave receding — mirror of rise. Sweeps from bright high (2800Hz)
      // DOWN to low (160Hz) with a longer tail because retreating water
      // takes longer to settle. Same "shhhh" character.
      noiseSweep(t, 2.2, 0.24, 2800, 200, 1.0);
      noiseSweep(t + 0.10, 2.0, 0.09, 1200, 100, 0.5);
      break;
    case 'heartbeat':
      // Pair of low thumps
      tone(58, 'sine', 0.10, 0.22, t, 42);
      tone(58, 'sine', 0.10, 0.20, t + 0.18, 42);
      break;
    case 'foot_dry':
      noiseBurst(0.04, 0.05, t, 2200);
      break;
    case 'carry_grunt':
      tone(180, 'sawtooth', 0.18, 0.10, t, 120);
      noiseBurst(0.16, 0.04, t + 0.02, 900);
      break;
    case 'ready':
      tone(720, 'triangle', 0.18, 0.16, t, 720);
      break;
    case 'go':
      tone(880, 'square', 0.10, 0.20, t, 1200);
      tone(1320, 'square', 0.14, 0.16, t + 0.06, 1500);
      break;
    case 'shark_roar':
      // Aggressive low growl + splash
      tone(160, 'sawtooth', 0.32, 0.32, t, 70);
      tone(80, 'square', 0.40, 0.18, t + 0.02, 50);
      noiseBurst(0.42, 0.20, t, 1400);
      break;
    case 'gull_cry':
      tone(1700, 'sawtooth', 0.10, 0.10, t, 1300);
      tone(1400, 'sawtooth', 0.14, 0.10, t + 0.08, 1700);
      tone(1900, 'sawtooth', 0.10, 0.08, t + 0.20, 1500);
      break;
    case 'game_over':
      // Sinking / drowning chord
      tone(660, 'sawtooth', 0.40, 0.20, t,          440);
      tone(440, 'sawtooth', 0.50, 0.20, t + 0.20,   280);
      tone(280, 'sawtooth', 0.70, 0.22, t + 0.50,   140);
      noiseBurst(1.0, 0.18, t + 0.10, 800);
      break;
  }
}

// ---------- BGM ----------
//
// Tidal Survive BGM is a low ocean ambience with a slow swell envelope.
// • Bass drone — sine pad at ~55 Hz with a 0.6 Hz LFO, very subtle
// • Swell — filtered noise wash with a 12–24s breath envelope (per MEMORY rule:
//   never a continuous drone — real silent gaps between swells)
// • Distant melody — pentatonic minor (A-C-D-E-G), one note every 4-7s, slow
// • Occasional bell tone for a "buoy" feel
//
// All voices route through bgmGain so volume + stop are unified.

let bgmSwellTimer: number | null = null;
let bgmMelodyTimer: number | null = null;

const PENTA_MINOR = [0, 3, 5, 7, 10]; // A minor pentatonic (semitone offsets from A)
const A_HZ = 220; // A3
function semi(offset: number): number { return A_HZ * Math.pow(2, offset / 12); }

function startDrone(volume: number) {
  if (!ctx || !bgmGain) return;
  // Two detuned sine pads + LFO on filter for a slow breathing low end.
  const o1 = ctx.createOscillator();
  o1.type = 'sine';
  o1.frequency.value = 55;
  const o2 = ctx.createOscillator();
  o2.type = 'sine';
  o2.frequency.value = 55.4; // tiny detune for movement
  const filt = ctx.createBiquadFilter();
  filt.type = 'lowpass';
  filt.frequency.value = 220;
  filt.Q.value = 0.4;
  const lfo = ctx.createOscillator();
  lfo.frequency.value = 0.07; // 14s period
  const lfoGain = ctx.createGain();
  lfoGain.gain.value = 90;
  lfo.connect(lfoGain).connect(filt.frequency);
  const g = ctx.createGain();
  g.gain.value = volume * 0.55;
  o1.connect(filt);
  o2.connect(filt);
  filt.connect(g).connect(bgmGain);
  o1.start(); o2.start(); lfo.start();
  // park for shutdown
  (bgmGain as any).__drone__ = { o1, o2, lfo, g };
}

function scheduleSwell() {
  if (!ctx || !bgmGain || !bgmRunning) return;
  // One full swell cycle = rise (5-8s) → hold (8-16s) → fall (6-10s) → silence (7-16s)
  const c = ctx;
  const rise = 5 + Math.random() * 3;
  const hold = 8 + Math.random() * 8;
  const fall = 6 + Math.random() * 4;
  const silence = 7 + Math.random() * 9;
  const total = rise + hold + fall + silence;

  // Build a long noise buffer for the swell body
  const dur = rise + hold + fall;
  const buf = c.createBuffer(1, Math.ceil(c.sampleRate * dur), c.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  const src = c.createBufferSource();
  src.buffer = buf;
  const lp = c.createBiquadFilter();
  lp.type = 'lowpass';
  lp.frequency.value = 1200;
  lp.Q.value = 0.5;
  const hp = c.createBiquadFilter();
  hp.type = 'highpass';
  hp.frequency.value = 120;
  const g = c.createGain();
  const peak = 0.12 + Math.random() * 0.06;
  const t0 = c.currentTime;
  g.gain.setValueAtTime(0, t0);
  g.gain.linearRampToValueAtTime(peak, t0 + rise);
  g.gain.setValueAtTime(peak, t0 + rise + hold);
  g.gain.linearRampToValueAtTime(0, t0 + rise + hold + fall);
  src.connect(hp).connect(lp).connect(g).connect(bgmGain);
  src.start(t0);
  src.stop(t0 + dur + 0.1);

  // Queue next swell after the full silence gap
  bgmSwellTimer = window.setTimeout(scheduleSwell, total * 1000) as unknown as number;
}

function scheduleMelody() {
  if (!ctx || !bgmGain || !bgmRunning) return;
  const c = ctx;
  // Pick a random pentatonic note, octave 4 or 5
  const noteSm = PENTA_MINOR[Math.floor(Math.random() * PENTA_MINOR.length)] + (Math.random() < 0.4 ? 12 : 0);
  const freq = semi(noteSm + 12); // up an octave overall

  const o = c.createOscillator();
  o.type = 'triangle';
  o.frequency.value = freq;
  const g = c.createGain();
  const peak = 0.045 + Math.random() * 0.02;
  const t = c.currentTime;
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(peak, t + 0.6);
  g.gain.exponentialRampToValueAtTime(0.0006, t + 3.5);
  // Soft delay for "across the bay" feel
  const delay = c.createDelay(0.5);
  delay.delayTime.value = 0.36;
  const fb = c.createGain();
  fb.gain.value = 0.28;
  const wet = c.createGain();
  wet.gain.value = 0.5;
  o.connect(g);
  g.connect(bgmGain);
  g.connect(delay);
  delay.connect(fb);
  fb.connect(delay);
  delay.connect(wet);
  wet.connect(bgmGain);
  o.start(t);
  o.stop(t + 4.0);

  // Next melody pluck after 4–7s
  const next = 4 + Math.random() * 3;
  bgmMelodyTimer = window.setTimeout(scheduleMelody, next * 1000) as unknown as number;
}

export function startBgm(volume = 0.08) {
  const c = ensureCtx();
  if (!c || !master) return;
  if (c.state === 'suspended') c.resume();
  stopBgm();

  bgmGain = c.createGain();
  bgmGain.gain.value = 0;
  bgmGain.connect(master);
  bgmGain.gain.linearRampToValueAtTime(volume, c.currentTime + 1.0);

  bgmRunning = true;
  startDrone(volume);
  // First swell starts after a short delay so onset feels organic
  bgmSwellTimer = window.setTimeout(scheduleSwell, 1200) as unknown as number;
  bgmMelodyTimer = window.setTimeout(scheduleMelody, 3500) as unknown as number;

  // Maintain a heartbeat so future-self can hook into BGM state if needed.
  bgmTimer = window.setInterval(() => { /* idle */ }, 1000) as unknown as number;
}

export function stopBgm() {
  bgmRunning = false;
  if (bgmTimer !== null) { window.clearInterval(bgmTimer); bgmTimer = null; }
  if (bgmSwellTimer !== null) { window.clearTimeout(bgmSwellTimer); bgmSwellTimer = null; }
  if (bgmMelodyTimer !== null) { window.clearTimeout(bgmMelodyTimer); bgmMelodyTimer = null; }
  if (bgmGain && ctx) {
    const drone = (bgmGain as any).__drone__;
    bgmGain.gain.cancelScheduledValues(ctx.currentTime);
    bgmGain.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.5);
    const g = bgmGain;
    setTimeout(() => {
      if (drone) {
        try { drone.o1.stop(); drone.o2.stop(); drone.lfo.stop(); } catch {}
      }
      g.disconnect();
    }, 800);
    bgmGain = null;
  }
}
