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

export function audio() {
  if (!ctx) {
    ctx = new (window.AudioContext || window.webkitAudioContext)();
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -16; comp.ratio.value = 4; comp.attack.value = 0.004;
    out = ctx.createGain(); out.gain.value = 0.9;
    out.connect(comp); comp.connect(ctx.destination);
    const verb = ctx.createConvolver(); verb.buffer = impulse(2.4);
    wet = ctx.createGain(); wet.gain.value = 0.2;
    wet.connect(verb); verb.connect(comp);
  }
  if (ctx.state === 'suspended') ctx.resume();
  return ctx;
}

export function playNote(midi, { at = 0, dur = 2.2, vel = 0.6, notify = true, source = 'play' } = {}) {
  const c = audio();
  const t = c.currentTime + at + 0.01;
  const f = midiFreq(midi);

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
