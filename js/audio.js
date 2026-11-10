// Web Audio synth: a soft plucked tone with a little room reverb.
let ctx = null, out = null, wet = null;
const voices = new Set();
const noteListeners = new Set();

export const midiFreq = m => 440 * Math.pow(2, (m - 69) / 12);
export const onNote = fn => noteListeners.add(fn);

function impulse(sec) {
  const r = ctx.sampleRate, len = Math.floor(r * sec), b = ctx.createBuffer(2, len, r);
  for (let ch = 0; ch < 2; ch++) {
    const d = b.getChannelData(ch);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3.2);
  }
  return b;
}

function build() {
  ctx = new (window.AudioContext || window.webkitAudioContext)();
  const comp = ctx.createDynamicsCompressor();
  comp.threshold.value = -16; comp.ratio.value = 4; comp.attack.value = 0.004;
  out = ctx.createGain(); out.gain.value = 0.9;
  out.connect(comp); comp.connect(ctx.destination);
  const verb = ctx.createConvolver(); verb.buffer = impulse(2.4);
  wet = ctx.createGain(); wet.gain.value = 0.2;
  wet.connect(verb); verb.connect(comp);
  voices.clear();
}

export function audio() {
  if (!ctx || ctx.state === 'closed') build();
  if (ctx.state !== 'running') ctx.resume().catch(() => {});
  return ctx;
}

// iPhone suspends ("interrupts") web audio when the screen locks, and sometimes never lets it
// resume. On every touch and whenever the app comes back, try to resume; if it's still dead a
// moment later, throw the old context away and build a fresh one.
let reviving = false;
export function revive() {
  // play through the ringer/silent switch like a music app (Safari 17+)
  try { if (navigator.audioSession) navigator.audioSession.type = 'playback'; } catch {}
  if (!ctx || reviving) return;
  if (ctx.state === 'running') return;
  reviving = true;
  ctx.resume().catch(() => {});
  setTimeout(() => {
    reviving = false;
    if (ctx && ctx.state !== 'running') {
      try { ctx.close(); } catch {}
      ctx = null;
      build();
      ctx.resume().catch(() => {});
    }
  }, 250);
}

export const TIMBRES = ['guitar', 'piano', 'sine'];

export function playNote(midi, { at = 0, dur = 2.2, vel = 0.6, notify = true, source = 'play', timbre = 'guitar' } = {}) {
  const c = audio();
  const t = c.currentTime + at + 0.01;
  const f = midiFreq(midi);
  if (timbre === 'mix') timbre = TIMBRES[Math.floor(Math.random() * TIMBRES.length)];
  if (timbre !== 'guitar') {
    playSimple(c, f, t, dur, vel, timbre);
    if (notify) setTimeout(() => noteListeners.forEach(fn => fn(midi, source)), Math.max(0, at * 1000));
    return;
  }

  const mk = (type, freq, detune, level) => {
    const o = c.createOscillator(), g = c.createGain();
    o.type = type; o.frequency.value = freq; o.detune.value = detune; g.gain.value = level;
    o.connect(g); return { o, g };
  };
  const parts = [mk('sawtooth', f, -4, 0.3), mk('triangle', f, 5, 0.65), mk('sine', f * 2, 0, 0.12)];

  const lp = c.createBiquadFilter();
  lp.type = 'lowpass'; lp.Q.value = 0.7;
  lp.frequency.setValueAtTime(Math.min(9000, f * 10), t);
  lp.frequency.exponentialRampToValueAtTime(Math.max(220, f * 1.6), t + 0.7);

  const env = c.createGain();
  const amp = vel * 0.2;
  env.gain.setValueAtTime(0.0001, t);
  env.gain.exponentialRampToValueAtTime(amp, t + 0.006);
  env.gain.exponentialRampToValueAtTime(amp * 0.35, t + 0.4);
  env.gain.exponentialRampToValueAtTime(0.0001, t + dur);

  parts.forEach(p => { p.g.connect(lp); p.o.start(t); p.o.stop(t + dur + 0.05); });
  lp.connect(env); env.connect(out); env.connect(wet);

  const v = { env, end: t + dur };
  voices.add(v);
  parts[0].o.onended = () => voices.delete(v);

  if (notify) setTimeout(() => noteListeners.forEach(fn => fn(midi, source)), Math.max(0, at * 1000));
}

export function stopAll() {
  if (!ctx) return;
  const t = ctx.currentTime;
  voices.forEach(v => {
    v.env.gain.cancelScheduledValues(t);
    v.env.gain.setTargetAtTime(0.0001, t, 0.05);
  });
}

// Piano-ish (decaying partials) and pure sine voices.
function playSimple(c, f, t, dur, vel, timbre) {
  const env = c.createGain();
  const partials = timbre === 'piano' ? [[1, 1], [2, 0.45], [3, 0.18], [4, 0.1], [5, 0.04]] : [[1, 1]];
  partials.forEach(([h, a]) => {
    if (f * h > 12000) return;
    const o = c.createOscillator(), g = c.createGain();
    o.type = 'sine'; o.frequency.value = f * h; g.gain.value = a;
    o.connect(g); g.connect(env); o.start(t); o.stop(t + dur + 0.05);
  });
  const amp = vel * (timbre === 'sine' ? 0.22 : 0.18);
  env.gain.setValueAtTime(0.0001, t);
  if (timbre === 'sine') {
    env.gain.exponentialRampToValueAtTime(amp, t + 0.03);
    env.gain.setValueAtTime(amp, t + dur * 0.6);
  } else {
    env.gain.exponentialRampToValueAtTime(amp, t + 0.004);
    env.gain.exponentialRampToValueAtTime(amp * 0.3, t + 0.5);
  }
  env.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  env.connect(out); env.connect(wet);
  const v = { env, end: t + dur }; voices.add(v);
  setTimeout(() => voices.delete(v), (dur + 0.2) * 1000);
}

// A short burst of noise + a random cluster: wipes short-term pitch memory between quiz notes,
// so you can't work out the next note from the last one.
export function scramble(len = 0.8) {
  const c = audio(), t = c.currentTime + 0.01;
  const buf = c.createBuffer(1, Math.floor(c.sampleRate * len), c.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  const src = c.createBufferSource(); src.buffer = buf;
  const bp = c.createBiquadFilter(); bp.type = 'bandpass'; bp.Q.value = 0.6;
  bp.frequency.setValueAtTime(300, t); bp.frequency.exponentialRampToValueAtTime(3000, t + len);
  const g = c.createGain();
  g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.12, t + 0.05);
  g.gain.exponentialRampToValueAtTime(0.0001, t + len);
  src.connect(bp); bp.connect(g); g.connect(out); src.start(t);
  for (let i = 0; i < 4; i++) {
    const m = 48 + Math.floor(Math.random() * 36);
    playNote(m, { at: Math.random() * len * 0.6, dur: 0.25, vel: 0.25, notify: false, timbre: 'piano' });
  }
  return len;
}
