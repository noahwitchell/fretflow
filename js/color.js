// Pitch → colour (the synesthesia layer).
import { mod12, fifthsIndex } from './theory.js';

// Chromatic map, kept from the original FretFlow prototype so trained associations carry over (C = red).
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

// ---- colour-theory layer ---------------------------------------------------
export const getMap = () => map;
// slot (0-11) of a note around the current colour wheel
export const wheelPos = pc => (map === 'fifths' ? fifthsIndex(pc) : mod12(pc));

const near = (a, b, tol = 22) => Math.abs(a - b) <= tol;
const hueDist = (a, b) => { const d = Math.abs(a - b) % 360; return d > 180 ? 360 - d : d; };

// Name the colour-theory scheme a set of notes makes on the wheel.
export function schemeFor(pcs) {
  const hs = [...new Set(pcs.map(mod12))].map(hue).sort((a, b) => a - b);
  const n = hs.length;
  if (n === 1) return { name: 'Monochrome', blurb: 'One colour.' };
  if (n === 2) {
    const d = hueDist(hs[0], hs[1]);
    if (d <= 45) return { name: 'Analogous pair', blurb: 'Neighbouring colours, blending softly.' };
    if (d >= 150) return { name: 'Complementary', blurb: 'Opposite colours: maximum contrast.' };
    return { name: 'Contrasting pair', blurb: `Colours ${Math.round(d)}° apart.` };
  }
  const gaps = hs.map((h, i) => (i === n - 1 ? hs[0] + 360 - h : hs[i + 1] - h));
  const maxGap = Math.max(...gaps), span = 360 - maxGap;
  const even = 360 / n;
  if (gaps.every(g => near(g, even, 20))) {
    return {
      3: { name: 'Triad', blurb: 'Three colours evenly spaced: balanced, with no colour in charge.' },
      4: { name: 'Square', blurb: 'Four colours evenly spaced: every colour has an equal rival.' },
    }[n] || { name: 'Even spread', blurb: 'Colours spaced evenly around the wheel.' };
  }
  if (span <= 100) return { name: 'Analogous', blurb: 'A tight run of neighbouring colours: unified and calm.' };
  if (n === 3) {
    const s = [...gaps].sort((a, b) => a - b);
    if (s[0] <= 75 && near(s[1], s[2], 35) && s[1] >= 120) return { name: 'Split complementary', blurb: 'One colour set against the two neighbours of its opposite.' };
  }
  if (n === 4 && near(gaps[0], gaps[2], 20) && near(gaps[1], gaps[3], 20)) {
    return { name: 'Rectangle', blurb: 'Two complementary pairs.' };
  }
  // a tight cluster plus one outlier
  for (let i = 0; i < n; i++) {
    const rest = hs.filter((_, j) => j !== i);
    const rg = rest.map((h, k) => (k === rest.length - 1 ? rest[0] + 360 - h : rest[k + 1] - h));
    const rspan = 360 - Math.max(...rg);
    const away = Math.min(...rest.map(h => hueDist(h, hs[i])));
    if (rspan <= 75 && away >= 75) return { name: 'Analogous + accent', blurb: 'A family of neighbouring colours with one contrasting accent.' };
  }
  return { name: 'Wide spread', blurb: `Colours spread across ${Math.round(span)}° of the wheel.` };
}

// Soft background built from the key's colours.
export function keyGlow(pcs) {
  const n = pcs.length;
  return pcs.map((pc, i) => {
    const x = (i / (n - 1)) * 100;
    return `radial-gradient(45% 35% at ${x.toFixed(0)}% ${i % 2 ? 100 : 0}%, ${noteColor(pc, 4, 0.13)} 0%, transparent 100%)`;
  }).join(', ');
}
