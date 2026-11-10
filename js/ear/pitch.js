// Microphone pitch detection (YIN-style), for the Sing mode.
import { audio } from '../audio.js';

let stream = null, src = null, an = null, raf = 0, buf = null, frame = 0;

export async function startMic(onPitch) {
  const c = audio();
  stream = await navigator.mediaDevices.getUserMedia({
    audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false },
  });
  src = c.createMediaStreamSource(stream);
  an = c.createAnalyser(); an.fftSize = 2048;
  src.connect(an);
  buf = new Float32Array(an.fftSize);
  const loop = () => {
    raf = requestAnimationFrame(loop);
    if (frame++ % 2) return; // ~30 checks a second is plenty
    an.getFloatTimeDomainData(buf);
    onPitch(detect(buf, c.sampleRate));
  };
  loop();
}

export function stopMic() {
  cancelAnimationFrame(raf);
  if (stream) stream.getTracks().forEach(t => t.stop());
  if (src) src.disconnect();
  stream = src = an = null;
}

export const micActive = () => !!stream;

// Returns frequency in Hz, or null when there's no clear pitch.
export function detect(x, sr) {
  let rms = 0;
  for (let i = 0; i < x.length; i++) rms += x[i] * x[i];
  if (Math.sqrt(rms / x.length) < 0.012) return null;
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
