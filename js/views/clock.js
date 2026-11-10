// Chord Clock: the 12 notes as a clock face. A chord is a shape; transposing = rotating it.
import { state } from '../store.js';
import * as T from '../theory.js';
import * as C from '../color.js';
import { selectChord, playMidi } from '../actions.js';

let el;
const R = 150;
const pos = (pc, r = R) => {
  const a = (pc / 12) * Math.PI * 2;
  return [r * Math.sin(a), -r * Math.cos(a)];
};

function render() {
  const key = state.key, flats = T.usesFlats(key), chord = state.chord;
  const pcs = T.chordPcs(chord);
  const scale = new Set(T.scalePcs(key));
  const shapePts = [...new Set(pcs)].sort((a, b) => a - b).map(pc => pos(pc, R).map(v => v.toFixed(1)).join(',')).join(' ');

  // intervals between neighbouring chord tones, shown along the shape's sides
  const sorted = [...new Set(pcs)].sort((a, b) => T.mod12(a - chord.root) - T.mod12(b - chord.root));
  let sides = '';
  if (sorted.length > 1) {
    sorted.forEach((pc, i) => {
      const next = sorted[(i + 1) % sorted.length];
      const gap = T.mod12(next - pc) || 12;
      const mid = pc + gap / 2;
      const [x, y] = pos(mid, R * 0.62);
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

  el.querySelector('.stage').innerHTML = `
    <svg viewBox="-200 -200 400 400" class="clock">
      <circle r="${R}" class="ring"/>
      ${pcs.length > 1 ? `<polygon points="${shapePts}" class="shape" style="fill:${C.noteColor(chord.root, 4, 0.22)};stroke:${C.noteColor(chord.root, 5, 0.95)}"/>` : ''}
      ${sides}
      ${notes}
      <text class="center-name" y="-4">${T.chordName(chord, flats)}</text>
      <text class="center-sub" y="18">${T.CHORD_TYPES[chord.type].name}</text>
    </svg>`;
}

export default {
  id: 'clock',
  mount(root) {
    el = root;
    el.innerHTML = `<div class="stage"></div>
      <p class="hint">Tap a note to make it the root. The shape <b>is</b> the chord: every major chord is the same triangle, minor is its mirror. Numbers = half-steps between notes.</p>`;
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
