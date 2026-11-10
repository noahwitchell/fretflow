// Chord Clock: the 12 notes as a clock face. A chord is a shape; transposing = rotating it.
import { state } from '../store.js';
import * as T from '../theory.js';
import * as C from '../color.js';
import { selectChord, playMidi } from '../actions.js';

let el;
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
  const key = state.key, flats = T.usesFlats(key), chord = state.chord;
  const pcs = T.chordPcs(chord);
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
    const inChord = pcs.includes(pc), isRoot = pc === chord.root, inScale = scale.has(pc);
    const label = state.labels === 'degree' ? (inChord ? T.degreeInChord(pc, chord) : T.DEGREE_NAMES[T.mod12(pc - key.tonic)]) : T.noteName(pc, flats);
    notes += `<g class="cnode ${inChord ? 'on' : ''} ${inScale ? 'scale' : 'out'} ${isRoot ? 'root' : ''}" data-pc="${pc}" transform="translate(${x.toFixed(1)},${y.toFixed(1)})">
      <circle r="${inChord ? 25 : 19}" fill="${C.noteColor(pc, 4, inChord ? 1 : inScale ? 0.38 : 0.14)}"/>
      <text dy="5">${label}</text></g>`;
  }

  el.querySelector('.hint').innerHTML = C.getMap() === 'fifths'
    ? 'Notes in circle-of-fifths order, which is also the colour wheel. Neighbours are a 5th apart, so close colours = consonant notes. Numbers = steps of a 5th (×30° of hue).'
    : 'Tap a note to make it the root. The shape <b>is</b> the chord: every major chord is the same triangle, minor is its mirror. Numbers = half-steps (×30° of hue).';
  el.querySelector('.stage').innerHTML = `
    <svg viewBox="-200 -200 400 400" class="clock">
      ${hueRing()}
      <circle r="${R}" class="ring"/>
      ${pcs.length > 1 ? `<polygon points="${shapePts}" class="shape" style="fill:${C.noteColor(chord.root, 4, 0.22)};stroke:${C.noteColor(chord.root, 5, 0.95)}"/>` : ''}
      ${sides}
      ${notes}
      <text class="center-name" y="-4">${T.chordName(chord, flats)}</text>
      <text class="center-sub" y="18">${T.CHORD_TYPES[chord.type].name}</text>
      <text class="scheme-name" y="38">${scheme.name}</text>
    </svg>`;
}

export default {
  id: 'clock',
  mount(root) {
    el = root;
    el.innerHTML = `<div class="stage"></div>
      <p class="hint"></p>`;
    el.addEventListener('click', e => {
      const g = e.target.closest('.cnode');
      if (!g) return;
      const pc = +g.dataset.pc;
      if (pc === state.chord.root) playMidi(60 + pc);
      else selectChord({ root: pc, type: state.chord.type });
    });
  },
  render,
};
