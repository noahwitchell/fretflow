// Pitch → colour (the synesthesia layer).
import { mod12, fifthsIndex } from './theory.js';

// Chromatic map, kept from the original FretFlow so trained associations carry over (C = red).
const CHROMA_HUE = [0, 28, 54, 88, 134, 168, 192, 218, 248, 276, 304, 334];
const CHROMA_SAT = [88, 92, 94, 82, 82, 84, 90, 90, 84, 86, 88, 88];
export const COLOR_NAMES = ['Crimson', 'Sunset orange', 'Gold', 'Chartreuse', 'Emerald', 'Mint',
  'Aqua', 'Ocean blue', 'Indigo', 'Amethyst', 'Magenta', 'Rose'];

let map = 'chromatic';
export const setColorMap = m => { map = m; };

export function hue(pc) {
  pc = mod12(pc);
  return map === 'fifths' ? fifthsIndex(pc) * 30 : CHROMA_HUE[pc];
}
const sat = pc => (map === 'fifths' ? 86 : CHROMA_SAT[mod12(pc)]);
const light = oct => Math.max(24, Math.min(78, 30 + (oct - 1) * 8)); // oct 4 = 54%

export const noteColor = (pc, oct = 4, a = 1) => `hsla(${hue(pc)}, ${sat(pc)}%, ${light(oct)}%, ${a})`;
export const midiColor = (m, a = 1) => noteColor(m, Math.floor(m / 12) - 1, a);
export const colorName = pc => {
  if (map === 'chromatic') return COLOR_NAMES[mod12(pc)];
  return `Hue ${hue(pc)}°`;
};

export function noteWash(m) {
  const c = midiColor(m, 0.62), c2 = midiColor(m, 0.18);
  return `radial-gradient(120% 90% at 50% 30%, ${c} 0%, ${c2} 55%, transparent 100%)`;
}

export function chordWash(pcs, oct = 4) {
  const n = pcs.length;
  const layers = pcs.map((pc, i) => {
    const a = (i / n) * Math.PI * 2 - Math.PI / 2;
    const x = 50 + Math.cos(a) * 32, y = 40 + Math.sin(a) * 28;
    return `radial-gradient(70% 60% at ${x.toFixed(0)}% ${y.toFixed(0)}%, ${noteColor(pc, oct, 0.5)} 0%, transparent 70%)`;
  });
  return layers.join(', ');
}

export function chordGradient(pcs, a = 0.9) {
  if (pcs.length === 1) return noteColor(pcs[0], 4, a);
  return `linear-gradient(120deg, ${pcs.map(pc => noteColor(pc, 4, a)).join(', ')})`;
}

let timer = null;
export function wash(bg, hold) {
  const el = document.getElementById('wash');
  el.style.background = bg;
  el.classList.add('on');
  el.style.opacity = '1';
  clearTimeout(timer);
  if (!hold) timer = setTimeout(() => { el.classList.remove('on'); el.style.opacity = '0'; }, 1300);
}
export function clearWash() {
  const el = document.getElementById('wash');
  el.classList.remove('on');
  el.style.opacity = '0';
}
