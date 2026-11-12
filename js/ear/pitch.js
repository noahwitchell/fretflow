// Microphone pitch detection (YIN-style), for the Sing mode.
import { micSession } from '../audio.js';

let stream = null, src = null, an = null, raf = 0, buf = null, frame = 0;

// Open the mic with the audio session switched to recording; retry once with the session
// left to the system and plain constraints, since iOS can be picky about both.
export async function getMicStream(constraints = { echoCancellation: false, noiseSuppression: false, autoGainControl: false }) {
  micSession(true);
  try {
    return await navigator.mediaDevices.getUserMedia({ audio: constraints });
  } catch (e1) {
    if (e1.name === 'NotAllowedError' && !/session|audio/i.test(e1.message || '')) { micSession(false); throw e1; }
    try { if (navigator.audioSession) navigator.audioSession.type = 'auto'; } catch {}
    try { return await navigator.mediaDevices.getUserMedia({ audio: true }); }
    catch (e2) { micSession(false); throw e2; }
  }
}

// The mic gets its OWN audio context. The playback context is torn down and rebuilt whenever iOS
// interrupts it (lock screen, audio-session switch); a mic wired into that one goes silent for good.
// This one is created on the Start tap (so iOS lets it run), kept awake, and watched: if it only
// ever delivers digital silence, the whole chain is rebuilt once.
let mctx = null, track = null, onP = null, onS = null, zeroSince = 0, rebuilt = false;
const AC = () => window.AudioContext || window.webkitAudioContext;

function wire() {
  src = mctx.createMediaStreamSource(stream);
  an = mctx.createAnalyser(); an.fftSize = 2048;
  const sink = mctx.createGain(); sink.gain.value = 0; // Safari only runs nodes that lead to the speakers
  src.connect(an); an.connect(sink); sink.connect(mctx.destination);
  buf = new Float32Array(an.fftSize);
  track = stream.getAudioTracks()[0];
}

export async function startMic(onPitch, onStatus) {
  onP = onPitch; onS = onStatus || (() => {});
  rebuilt = false;
  mctx = new (AC())();           // inside the tap, so it's allowed to start
  mctx.resume().catch(() => {});
  try { stream = await getMicStream(); }
  catch (e) { try { mctx.close(); } catch {} mctx = null; throw e; }
  try { await mctx.resume(); } catch {}
  wire();
  zeroSince = performance.now();
  cancelAnimationFrame(raf);
  const loop = () => {
    raf = requestAnimationFrame(loop);
    if (!an || frame++ % 2) return; // ~30 checks a second is plenty
    if (mctx.state !== 'running') mctx.resume().catch(() => {});
    an.getFloatTimeDomainData(buf);
    let rms = 0, peak = 0;
    for (let i = 0; i < buf.length; i++) { const v = buf[i]; rms += v * v; if (v > peak) peak = v; else if (-v > peak) peak = -v; }
    rms = Math.sqrt(rms / buf.length);
    const now = performance.now();
    if (peak > 0) zeroSince = now;
    const dead = now - zeroSince > 1500;
    if (dead && !rebuilt) { rebuilt = true; rebuild(); }
    onS({ level: rms, ctx: mctx.state, track: track ? (track.muted ? 'muted' : track.readyState) : 'none', dead, rate: mctx.sampleRate });
    onP(detect(buf, mctx.sampleRate));
  };
  loop();
}

// Fresh stream + fresh context, used once if the first chain only gives zeros.
async function rebuild() {
  try {
    if (stream) stream.getTracks().forEach(t => t.stop());
    if (src) src.disconnect();
    try { mctx.close(); } catch {}
    mctx = new (AC())();
    stream = await getMicStream();
    try { await mctx.resume(); } catch {}
    wire();
    zeroSince = performance.now();
  } catch (e) { onS({ error: `${e.name}: ${e.message}` }); }
}

// A tap anywhere nudges a stalled mic context back to life.
window.addEventListener('pointerdown', () => { if (mctx && mctx.state !== 'running') mctx.resume().catch(() => {}); }, { capture: true });

export function stopMic() {
  cancelAnimationFrame(raf);
  if (stream) stream.getTracks().forEach(t => t.stop());
  if (src) src.disconnect();
  if (stream) micSession(false);
  if (mctx) { try { mctx.close(); } catch {} }
  stream = src = an = mctx = track = null;
}

export const micActive = () => !!stream;

// Returns frequency in Hz, or null when there's no clear pitch.
export function detect(x, sr) {
  let rms = 0;
  for (let i = 0; i < x.length; i++) rms += x[i] * x[i];
  if (Math.sqrt(rms / x.length) < 0.005) return null;
  const W = x.length >> 1, minT = Math.floor(sr / 1100), maxT = Math.min(W - 1, Math.floor(sr / 65));
  const d = new Float32Array(maxT + 1);
  for (let tau = 1; tau <= maxT; tau++) {
    let s = 0;
    for (let i = 0; i < W; i++) { const v = x[i] - x[i + tau]; s += v * v; }
    d[tau] = s;
  }
  // cumulative mean normalised difference
  let run = 0; d[0] = 1;
  for (let tau = 1; tau <= maxT; tau++) { run += d[tau]; d[tau] = run ? (d[tau] * tau) / run : 1; }
  let tau = -1;
  for (let t = minT; t <= maxT; t++) {
    if (d[t] < 0.12) { while (t + 1 <= maxT && d[t + 1] < d[t]) t++; tau = t; break; }
  }
  if (tau < 0) return null;
  // parabolic interpolation for sub-sample accuracy
  const a = d[tau - 1] ?? d[tau], b = d[tau], c = d[tau + 1] ?? d[tau];
  const shift = (a - c) / (2 * (a - 2 * b + c) || 1);
  return sr / (tau + (Number.isFinite(shift) ? shift : 0));
}

export const freqToMidi = f => 69 + 12 * Math.log2(f / 440);

// Cents from the nearest instance of pitch class pc (octave-folded), in -600…600.
export function centsFromPc(f, pc) {
  const m = freqToMidi(f);
  let diff = ((m - pc) % 12 + 12) % 12;
  if (diff >= 6) diff -= 12;
  return diff * 100;
}
