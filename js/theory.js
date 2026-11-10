// Music theory core: notes, chords, keys, voicing. No DOM, no audio.

export const mod12 = n => ((n % 12) + 12) % 12;

const SHARP = ['C', 'C♯', 'D', 'D♯', 'E', 'F', 'F♯', 'G', 'G♯', 'A', 'A♯', 'B'];
const FLAT = ['C', 'D♭', 'D', 'E♭', 'E', 'F', 'G♭', 'G', 'A♭', 'A', 'B♭', 'B'];
const FLAT_MAJOR_TONICS = new Set([5, 10, 3, 8, 1]); // F B♭ E♭ A♭ D♭

export const DEGREE_NAMES = ['1', '♭2', '2', '♭3', '3', '4', '♭5', '5', '♭6', '6', '♭7', '7'];

export function usesFlats(key) {
  const major = key.mode === 'minor' ? mod12(key.tonic + 3) : key.tonic;
  return FLAT_MAJOR_TONICS.has(major);
}
export const noteName = (pc, flats = false) => (flats ? FLAT : SHARP)[mod12(pc)];
export const keyName = key => `${noteName(key.tonic, usesFlats(key))} ${key.mode}`;
export const midiName = (m, flats) => noteName(m, flats) + (Math.floor(m / 12) - 1);

export const CHORD_TYPES = {
  maj:   { name: 'Major',           sym: '',        iv: [0, 4, 7],          deg: ['1', '3', '5'],             feel: 'Bright, stable, resolved. Home base.' },
  min:   { name: 'Minor',           sym: 'm',       iv: [0, 3, 7],          deg: ['1', '♭3', '5'],            feel: 'Only the 3rd moves from major: it drops a half step. Darker, inward.' },
  dim:   { name: 'Diminished',      sym: '°',       iv: [0, 3, 6],          deg: ['1', '♭3', '♭5'],           feel: 'Minor with the 5th lowered too. Two stacked minor 3rds: tense, wants to move.' },
  aug:   { name: 'Augmented',       sym: '+',       iv: [0, 4, 8],          deg: ['1', '3', '♯5'],            feel: 'Major with the 5th raised. Two stacked major 3rds: dreamy, unresolved.' },
  sus2:  { name: 'Sus 2',           sym: 'sus2',    iv: [0, 2, 7],          deg: ['1', '2', '5'],             feel: 'The 3rd steps down to the 2nd. Open and airy, neither major nor minor.' },
  sus4:  { name: 'Sus 4',           sym: 'sus4',    iv: [0, 5, 7],          deg: ['1', '4', '5'],             feel: 'The 3rd steps up to the 4th. Tension that wants to fall back to the 3rd.' },
  five:  { name: 'Power',           sym: '5',       iv: [0, 7],             deg: ['1', '5'],                  feel: 'No 3rd at all. Punchy and ambiguous.' },
  dom7:  { name: 'Dominant 7',      sym: '7',       iv: [0, 4, 7, 10],      deg: ['1', '3', '5', '♭7'],       feel: 'Major plus a ♭7. The bluesy pull back home (V7 → I).' },
  maj7:  { name: 'Major 7',         sym: 'maj7',    iv: [0, 4, 7, 11],      deg: ['1', '3', '5', '7'],        feel: 'Major plus the 7th, a half step under the root. Lush, reflective.' },
  min7:  { name: 'Minor 7',         sym: 'm7',      iv: [0, 3, 7, 10],      deg: ['1', '♭3', '5', '♭7'],      feel: 'Minor plus a ♭7. Smooth, soulful groove chord.' },
  m7b5:  { name: 'Half-diminished', sym: 'ø7',      iv: [0, 3, 6, 10],      deg: ['1', '♭3', '♭5', '♭7'],     feel: 'Diminished triad plus a ♭7. The ii chord of minor keys.' },
  dim7:  { name: 'Diminished 7',    sym: '°7',      iv: [0, 3, 6, 9],       deg: ['1', '♭3', '♭5', '𝄫7'],     feel: 'Every note a minor 3rd apart: perfectly symmetrical, maximum tension.' },
  mmaj7: { name: 'Minor-major 7',   sym: 'm(maj7)', iv: [0, 3, 7, 11],      deg: ['1', '♭3', '5', '7'],       feel: 'Dark minor 3rd under a sharp major 7th. The spy-movie chord.' },
  sus47: { name: '7sus4',           sym: '7sus4',   iv: [0, 5, 7, 10],      deg: ['1', '4', '5', '♭7'],       feel: 'Dominant 7 with the 3rd pushed up to the 4th. Floating, modern.' },
  maj6:  { name: 'Major 6',         sym: '6',       iv: [0, 4, 7, 9],       deg: ['1', '3', '5', '6'],        feel: 'Major plus the 6th. Warm, vintage, sweet.' },
  min6:  { name: 'Minor 6',         sym: 'm6',      iv: [0, 3, 7, 9],       deg: ['1', '♭3', '5', '6'],       feel: 'Minor plus a natural 6th. Film-noir, Dorian colour.' },
  add9:  { name: 'Add 9',           sym: 'add9',    iv: [0, 4, 7, 14],      deg: ['1', '3', '5', '9'],        feel: 'Major plus the 9th (the 2nd, an octave up). Shimmer without a 7th.' },
  dom9:  { name: 'Dominant 9',      sym: '9',       iv: [0, 4, 7, 10, 14],  deg: ['1', '3', '5', '♭7', '9'],  feel: 'Dominant 7 with a 9th on top. Funk and soul.' },
  maj9:  { name: 'Major 9',         sym: 'maj9',    iv: [0, 4, 7, 11, 14],  deg: ['1', '3', '5', '7', '9'],   feel: 'Major 7 with a 9th. Glassy, neo-soul.' },
  min9:  { name: 'Minor 9',         sym: 'm9',      iv: [0, 3, 7, 10, 14],  deg: ['1', '♭3', '5', '♭7', '9'], feel: 'Minor 7 with a 9th. Deep and velvety.' },
  s9:    { name: '7♯9',             sym: '7♯9',     iv: [0, 4, 7, 10, 15],  deg: ['1', '3', '5', '♭7', '♯9'], feel: 'Dominant 7 with a ♯9: the minor 3rd rubbing against the major 3rd.' },
};

export const TYPE_ROWS = [
  ['maj', 'min', 'dim', 'aug', 'sus2', 'sus4', 'five'],
  ['dom7', 'maj7', 'min7', 'm7b5', 'dim7', 'mmaj7', 'sus47', 'maj6', 'min6'],
  ['add9', 'dom9', 'maj9', 'min9', 's9'],
];

// Which triad "family" a chord type belongs to (for the wheel rings).
export const FAMILY = {
  maj: 'maj', aug: 'maj', dom7: 'maj', maj7: 'maj', maj6: 'maj', add9: 'maj', dom9: 'maj', maj9: 'maj', s9: 'maj',
  sus2: 'maj', sus4: 'maj', sus47: 'maj', five: 'maj',
  min: 'min', min7: 'min', mmaj7: 'min', min6: 'min', min9: 'min',
  dim: 'dim', m7b5: 'dim', dim7: 'dim',
};

export const MODES = { major: [0, 2, 4, 5, 7, 9, 11], minor: [0, 2, 3, 5, 7, 8, 10] };
export const scalePcs = key => MODES[key.mode].map(s => mod12(key.tonic + s));
export const chordPcs = c => CHORD_TYPES[c.type].iv.map(v => mod12(c.root + v));
export const sameChord = (a, b) => !!a && !!b && a.root === b.root && a.type === b.type;
export const fifthsIndex = pc => mod12(pc * 7); // C=0 G=1 D=2 … F=11

export function chordName(c, flats) {
  return noteName(c.root, flats) + CHORD_TYPES[c.type].sym;
}

// Degree label of a pitch class inside a chord ("1", "♭3", "5"…).
export function degreeInChord(pc, c) {
  const t = CHORD_TYPES[c.type];
  const i = t.iv.findIndex(v => mod12(c.root + v) === mod12(pc));
  return i >= 0 ? t.deg[i] : DEGREE_NAMES[mod12(pc - c.root)];
}

function identify(ivs) {
  const want = ivs.join();
  for (const [k, t] of Object.entries(CHORD_TYPES)) {
    const s = [...new Set(t.iv.map(mod12))].sort((a, b) => a - b).join();
    if (s === want) return k;
  }
  return null;
}

// The 7 chords built from a key's scale.
export function diatonic(key, sevenths = false) {
  const sc = scalePcs(key);
  return sc.map((root, i) => {
    const tones = (sevenths ? [0, 2, 4, 6] : [0, 2, 4]).map(k => sc[(i + k) % 7]);
    const ivs = [...new Set(tones.map(t => mod12(t - root)))].sort((a, b) => a - b);
    return { root, type: identify(ivs), degree: i };
  });
}

export function isDiatonic(c, key) {
  const sc = new Set(scalePcs(key));
  return chordPcs(c).every(p => sc.has(p));
}

const ROMAN = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII'];
const LOWER = new Set(['min', 'dim', 'min7', 'm7b5', 'dim7', 'mmaj7', 'min6', 'min9']);
const ROMAN_SUFFIX = {
  maj: '', min: '', dim: '°', aug: '+', dom7: '7', maj7: 'maj7', min7: '7', m7b5: 'ø7', dim7: '°7',
  mmaj7: '(maj7)', sus2: 'sus2', sus4: 'sus4', five: '5', maj6: '6', min6: '6', add9: 'add9',
  dom9: '9', maj9: 'maj9', min9: '9', s9: '7♯9', sus47: '7sus4',
};

export function romanFor(c, key) {
  const steps = MODES[key.mode];
  const rel = mod12(c.root - key.tonic);
  let i = steps.indexOf(rel), acc = '';
  if (i < 0) {
    i = steps.indexOf(mod12(rel + 1));
    if (i >= 0) acc = '♭'; else { i = steps.indexOf(mod12(rel - 1)); acc = '♯'; }
  }
  let r = ROMAN[i];
  if (LOWER.has(c.type)) r = r.toLowerCase();
  return acc + r + ROMAN_SUFFIX[c.type];
}

// Neo-Riemannian neighbours: each shares two notes with the chord, one note moves by step.
export function plr(c) {
  if (c.type === 'maj') return {
    P: { root: c.root, type: 'min' }, R: { root: mod12(c.root + 9), type: 'min' }, L: { root: mod12(c.root + 4), type: 'min' },
  };
  if (c.type === 'min') return {
    P: { root: c.root, type: 'maj' }, R: { root: mod12(c.root + 3), type: 'maj' }, L: { root: mod12(c.root + 8), type: 'maj' },
  };
  return null;
}

// Pick a guitar-range voicing close to the previous one (smooth voice leading).
export function voice(c, prev = null) {
  const iv = CHORD_TYPES[c.type].iv;
  const base = 52 + mod12(c.root - 4); // root between E3 and D#4
  const cands = [];
  for (let inv = 0; inv < iv.length; inv++) {
    for (let oct = -1; oct <= 0; oct++) {
      const notes = iv.map((v, i) => base + v + (i < inv ? 12 : 0) + oct * 12).sort((a, b) => a - b);
      if (notes[0] < 50 || notes[notes.length - 1] > 79) continue;
      cands.push(notes);
    }
  }
  if (!cands.length) cands.push(iv.map(v => base + v));
  let best = cands[0];
  if (prev && prev.length) {
    let bestCost = Infinity;
    for (const n of cands) {
      const cost = n.reduce((s, m) => s + Math.min(...prev.map(p => Math.abs(p - m))), 0)
        + prev.reduce((s, p) => s + Math.min(...n.map(m => Math.abs(p - m))), 0);
      if (cost < bestCost) { bestCost = cost; best = n; }
    }
  } else {
    best = cands.find(n => n[0] === base || n[0] === base - 12) || cands[0];
  }
  const bass = 40 + mod12(c.root - 4); // E2..D#3
  return { bass, notes: best };
}

// Guitar
export const TUNING = [64, 59, 55, 50, 45, 40]; // high e → low E
export const STRING_NAMES = ['e', 'B', 'G', 'D', 'A', 'E'];

// Name any set of pitch classes as a chord (any root). Prefers `preferRoot` when it fits.
export function identifyAny(pcs, preferRoot = null) {
  const want = [...new Set(pcs.map(mod12))].sort((a, b) => a - b).join();
  const hits = [];
  for (const root of [...new Set(pcs.map(mod12))]) {
    for (const [type, t] of Object.entries(CHORD_TYPES)) {
      const s = [...new Set(t.iv.map(v => mod12(root + v)))].sort((a, b) => a - b).join();
      if (s === want) hits.push({ root, type });
    }
  }
  return hits.find(h => h.root === preferRoot) || hits[0] || null;
}
