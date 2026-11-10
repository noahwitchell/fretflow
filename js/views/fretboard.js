// Fretboard: chord tones across the whole neck. Vertical (chord-chart style) on narrow screens.
import { state } from '../store.js';
import * as T from '../theory.js';
import * as C from '../color.js';
import { playMidi } from '../actions.js';

let el;
const FRETS = 15, INLAYS = [3, 5, 7, 9, 15];

function render() {
  const key = state.key, flats = T.usesFlats(key), chord = state.chord;
  const cpcs = T.chordPcs(chord), scale = new Set(T.scalePcs(key));
  const vertical = el.clientWidth < 620;
  const SG = vertical ? 46 : 34, FG = vertical ? 46 : 54, PAD = 58;
  // s = string index 0 (high e) … 5 (low E); in vertical mode low E is on the left like a chord chart
  const P = (s, f) => vertical ? [PAD + (5 - s) * SG, PAD + f * FG] : [PAD + f * FG, PAD + s * SG];
  const fretX = f => f === 0 ? -0.55 : f - 0.5; // dots sit between fret wires; open strings above the nut

  let g = '';
  // fret wires
  for (let f = 0; f <= FRETS; f++) {
    const [x1, y1] = P(0, f + 0.0), [x2, y2] = P(5, f);
    g += `<line class="${f === 0 ? 'nut' : 'fret'}" x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}"/>`;
    if (f > 0) {
      const [lx, ly] = vertical ? [PAD - 20, PAD + (f - 0.5) * FG + 4] : [PAD + (f - 0.5) * FG, PAD + 5 * SG + 24];
      g += `<text class="fnum" x="${lx}" y="${ly}">${f}</text>`;
    }
  }
  // inlays
  const mid = 2.5;
  INLAYS.forEach(f => { const [x, y] = P(mid, fretX(f)); g += `<circle class="inlay" cx="${x}" cy="${y}" r="5"/>`; });
  [1.5, 3.5].forEach(s => { const [x, y] = P(s, fretX(12)); g += `<circle class="inlay" cx="${x}" cy="${y}" r="5"/>`; });
  // strings
  for (let s = 0; s < 6; s++) {
    const [x1, y1] = P(s, 0), [x2, y2] = P(s, FRETS);
    g += `<line class="string" style="stroke-width:${0.8 + s * 0.35}" x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}"/>`;
    const [nx, ny] = vertical ? [x1, 14] : [12, y1 + 4];
    g += `<text class="sname" x="${nx}" y="${ny}">${T.STRING_NAMES[s]}</text>`;
  }
  // notes
  for (let s = 0; s < 6; s++) for (let f = 0; f <= FRETS; f++) {
    const midi = T.TUNING[s] + f, pc = T.mod12(midi);
    const [x, y] = P(s, fretX(f));
    const inChord = cpcs.includes(pc);
    g += `<rect class="hit" data-midi="${midi}" x="${x - 20}" y="${y - 16}" width="40" height="32"/>`;
    if (inChord) {
      const label = state.labels === 'degree' ? T.degreeInChord(pc, chord) : T.noteName(pc, flats);
      g += `<g class="fdot ${pc === chord.root ? 'root' : ''}" transform="translate(${x},${y})" pointer-events="none">
        <circle r="13" fill="${C.midiColor(midi)}"/><text dy="4">${label}</text></g>`;
    } else if (state.scaleDots && scale.has(pc)) {
      g += `<circle class="sdot" cx="${x}" cy="${y}" r="4" fill="${C.noteColor(pc, 4, 0.45)}" pointer-events="none"/>`;
    }
  }
  const [wx, wy] = vertical ? [PAD * 2 + 5 * SG, PAD * 2 + FRETS * FG] : [PAD * 2 + FRETS * FG, PAD * 2 + 5 * SG + 10];
  el.querySelector('.stage').innerHTML = `<div class="neck-scroll ${vertical ? 'v' : 'h'}">
    <svg class="neck" viewBox="0 0 ${wx} ${wy}" width="${wx}" height="${wy}">${g}</svg></div>`;
}

export default {
  id: 'fretboard',
  mount(root) {
    el = root;
    el.innerHTML = `<div class="stage"></div>
      <p class="hint">Every place the chord's notes live on the neck (standard tuning). Small dots are the rest of the key. Tap anywhere to hear that fret.</p>`;
    el.addEventListener('click', e => {
      const h = e.target.closest('.hit');
      if (h) playMidi(+h.dataset.midi);
    });
    let lastV = null;
    new ResizeObserver(() => {
      const v = el.clientWidth < 620;
      if (v !== lastV && el.classList.contains('active')) { lastV = v; render(); }
    }).observe(el);
  },
  render,
};
