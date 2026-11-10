// Chord Clock: the 12 notes as a clock face. A chord is a shape; transposing = rotating it.
import { state } from '../store.js';
import * as T from '../theory.js';
import * as C from '../color.js';
import { selectChord, playMidi } from '../actions.js';
import * as A from '../audio.js';

// Notes in the order you tapped them. The first one is the root (and the lowest note).
let el, built = [], synced = '';
const ck = c => `${c.root}:${c.type}`;

// One fixed pitch per note: the root sits between G3 and F♯4 and every other note stacks
// upward from it, so a note sounds the same when tapped and when the chord plays back.
const rootMidi = r => 55 + T.mod12(r - 7);
const pitchOf = pc => (built.length ? rootMidi(built[0]) + T.mod12(pc - built[0]) : rootMidi(pc));

// Name the tapped notes from the first-tapped root; if they only spell a chord on another
// root, it's that chord with your root in the bass, written as a slash chord (G7/D).
function nameNotes(flats) {
  if (built.length < 2) return null;
  const root = built[0];
  const hit = T.identifyAny(built, root);
  if (!hit) return null;
  if (hit.root === root) return { chord: hit, label: T.chordName(hit, flats), sub: T.CHORD_TYPES[hit.type].name };
  return {
    chord: hit, slash: true,
    label: `${T.chordName(hit, flats)}/${T.noteName(root, flats)}`,
    sub: `${T.chordName(hit, flats)} over a ${T.noteName(root, flats)} bass`,
  };
}
const R = 150;
// position follows the colour map, so the clock IS the colour wheel
const slot = (s, r = R) => {
  const a = (s / 12) * Math.PI * 2;
  return [r * Math.sin(a), -r * Math.cos(a)];
};
const pos = (pc, r = R) => slot(C.wheelPos(pc), r);

function hueRing() {
  // thin ring of the actual note colours, blended between slots
  let out = '';
  const byslot = [...Array(12).keys()].map(s => [...Array(12).keys()].find(pc => C.wheelPos(pc) === s));
  for (let i = 0; i < 96; i++) {
    const s0 = i / 8, a0 = (s0 / 12) * Math.PI * 2, a1 = ((s0 + 1 / 8) / 12) * Math.PI * 2;
    const lo = Math.floor(s0) % 12; // arc i spans slot-0.5 … so floor(s0) is its slot
    const p = (r, a) => `${(r * Math.sin(a)).toFixed(1)} ${(-r * Math.cos(a)).toFixed(1)}`;
    out += `<path d="M${p(R + 32, a0 - Math.PI / 12)} A${R + 32} ${R + 32} 0 0 1 ${p(R + 32, a1 - Math.PI / 12 + 0.002)}" stroke="${C.noteColor(byslot[lo], 4, 0.55)}" stroke-width="5" fill="none"/>`;
  }
  return `<g class="hue-ring">${out}</g>`;
}

function render() {
  const key = state.key, flats = T.usesFlats(key);
  // follow chords chosen elsewhere; otherwise keep the notes tapped here
  if (ck(state.chord) !== synced) { built = [...new Set(T.chordPcs(state.chord))]; synced = ck(state.chord); }
  const pcs = built;
  const nm = nameNotes(flats);
  const root = pcs.length ? pcs[0] : null;
  const chord = { root: root ?? state.chord.root, type: 'maj' };
  const scale = new Set(T.scalePcs(key));
  const scheme = C.schemeFor(pcs);
  // walk the chord tones in wheel order, starting from the root
  const rootSlot = C.wheelPos(chord.root);
  const sorted = [...new Set(pcs)].sort((a, b) => T.mod12(C.wheelPos(a) - rootSlot) - T.mod12(C.wheelPos(b) - rootSlot));
  const shapePts = sorted.map(pc => pos(pc, R).map(v => v.toFixed(1)).join(',')).join(' ');

  // slots between neighbouring chord tones (×30° of hue), along the shape's sides
  let sides = '';
  if (sorted.length > 1) {
    sorted.forEach((pc, i) => {
      const next = sorted[(i + 1) % sorted.length];
      const gap = T.mod12(C.wheelPos(next) - C.wheelPos(pc)) || 12;
      const [x, y] = slot(C.wheelPos(pc) + gap / 2, R * 0.62);
      sides += `<text class="gap" x="${x.toFixed(1)}" y="${y.toFixed(1)}">${gap}</text>`;
    });
  }

  let notes = '';
  for (let pc = 0; pc < 12; pc++) {
    const [x, y] = pos(pc);
    const inChord = pcs.includes(pc), isRoot = pc === root, inScale = scale.has(pc);
    const rel = root != null ? T.DEGREE_NAMES[T.mod12(pc - root)] : '';
    const label = state.labels === 'degree' ? (inChord ? rel : T.DEGREE_NAMES[T.mod12(pc - key.tonic)]) : T.noteName(pc, flats);
    // under each chosen note: its interval from your root ("1" marks the root itself)
    const tag = inChord && state.labels !== 'degree' ? `<text class="rel" dy="17">${isRoot ? 'root' : rel}</text>` : '';
    notes += `<g class="cnode ${inChord ? 'on' : ''} ${inScale ? 'scale' : 'out'} ${isRoot ? 'root' : ''}" data-pc="${pc}" transform="translate(${x.toFixed(1)},${y.toFixed(1)})">
      <circle r="${inChord ? 25 : 19}" fill="${C.noteColor(pc, 4, inChord ? 1 : inScale ? 0.38 : 0.14)}"/>
      <text dy="${tag ? 2 : 5}">${label}</text>${tag}</g>`;
  }

  el.querySelector('.hint').innerHTML = C.getMap() === 'fifths'
    ? 'Notes in circle-of-fifths order (= the colour wheel). Tap notes to build a chord; neighbours are a 5th apart, so close colours = consonant notes. Numbers = steps of a 5th.'
    : 'Tap notes one at a time: the <b>first one is the root</b> (lowest note), each plays alone, and the chord is named from your root. Tap the middle to hear them together. Numbers = half-steps between notes.';
  el.querySelector('.stage').innerHTML = `
    <svg viewBox="-200 -200 400 400" class="clock">
      ${hueRing()}
      <circle r="${R}" class="ring"/>
      ${pcs.length > 1 ? `<polygon points="${shapePts}" class="shape" style="fill:${C.noteColor(chord.root, 4, 0.22)};stroke:${C.noteColor(chord.root, 5, 0.95)}"/>` : ''}
      ${sides}
      ${notes}
      <circle r="62" class="center-hit"/>
      <text class="center-name ${nm && nm.label.length > 7 ? 'long' : ''}" y="-8">${nm ? nm.label : pcs.length ? pcs.map(p => T.noteName(p, flats)).join(' ') : '…'}</text>
      <text class="center-sub" y="14">${nm ? nm.sub : pcs.length < 2 ? 'first note you tap = root' : 'not a named chord'}</text>
      ${pcs.length >= 2 ? `<text class="scheme-name" y="32">${scheme.name}</text><text class="center-play" y="52">▶ hear it</text>` : ''}
    </svg>`;
}

export default {
  id: 'clock',
  mount(root) {
    el = root;
    el.innerHTML = `<div class="clock-tools"><button class="btn small" data-clear>Clear notes</button></div><div class="stage"></div>
      <p class="hint"></p>`;
    el.addEventListener('click', e => {
      if (e.target.closest('[data-clear]')) { built = []; render(); return; }
      if (e.target.closest('.center-hit')) {
        if (!built.length) return;
        A.stopAll();
        // the same pitches you tapped: one at a time from the root upward, then together
        const ms = built.map(pitchOf).sort((a, b) => a - b);
        ms.forEach((m, i) => playMidi(m, { at: i * 0.3, dur: 1.4 }));
        const at = ms.length * 0.3 + 0.15;
        ms.forEach((m, i) => playMidi(m, { at: at + i * 0.03, dur: 2.2, notify: false }));
        return;
      }
      const g = e.target.closest('.cnode');
      if (!g) return;
      const pc = +g.dataset.pc;
      // build note by note: each tap plays just that note (at its fixed pitch) and adds/removes it
      if (built.includes(pc)) { playMidi(pitchOf(pc), { dur: 1.2, vel: 0.4 }); built = built.filter(p => p !== pc); }
      else { built = [...built, pc]; playMidi(pitchOf(pc), { dur: 1.6 }); }
      const nm = nameNotes(false);
      if (nm) { synced = ck(nm.chord); selectChord(nm.chord, { play: false }); }
      else render();
    });
  },
  render,
};
