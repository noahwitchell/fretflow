// Grid: every note across several octaves (rows = octaves, columns = the 12 notes).
// Tap exact pitches to build a chord in any octave; the panel names it, says which inversion
// it is (what's in the bass), and shows the interval between each stacked note.
import { state, set } from '../store.js';
import * as T from '../theory.js';
import * as C from '../color.js';
import * as A from '../audio.js';
import { selectChord, playMidi, addToProg } from '../actions.js';

let el, notes = [], lowOct = 2, synced = '';
const ROWS = 4;
const ck = c => `${c.root}:${c.type}`;

const IV_NAMES = ['unison', 'minor 2nd', 'major 2nd', 'minor 3rd', 'major 3rd', 'perfect 4th', 'tritone',
  'perfect 5th', 'minor 6th', 'major 6th', 'minor 7th', 'major 7th', 'octave'];
const ivName = d => (d <= 12 ? IV_NAMES[d] : `${IV_NAMES[d - 12]} + octave`);
const INVERSION = ['root position', '1st inversion', '2nd inversion', '3rd inversion', '4th inversion'];

// Name the pitch set; prefer the bass note as root (root position) when that spells a chord.
function analyse() {
  if (notes.length < 2) return null;
  const sorted = [...notes].sort((a, b) => a - b);
  const pcs = [...new Set(sorted.map(T.mod12))];
  const bass = T.mod12(sorted[0]);
  const hit = T.identifyAny(pcs, bass) || null;
  if (!hit) return { sorted, chord: null };
  const t = T.CHORD_TYPES[hit.type];
  const idx = t.iv.findIndex(v => T.mod12(hit.root + v) === bass);
  return { sorted, chord: hit, bassIdx: idx, bassDeg: t.deg[idx] };
}

function loadChord(c) {
  // a chord picked elsewhere arrives in root position around octave 3–4
  const v = T.voice(c);
  notes = v.notes.slice();
}

function render() {
  if (ck(state.chord) !== synced) { loadChord(state.chord); synced = ck(state.chord); }
  const flats = T.usesFlats(state.key);
  const on = new Set(notes);
  const pcsOn = new Set(notes.map(T.mod12));
  let cells = '';
  for (let r = ROWS - 1; r >= 0; r--) {
    const oct = lowOct + r;
    cells += `<span class="goct">${oct}</span>`;
    for (let pc = 0; pc < 12; pc++) {
      const m = (oct + 1) * 12 + pc;
      const sel = on.has(m), echo = !sel && pcsOn.has(pc);
      const black = [1, 3, 6, 8, 10].includes(pc);
      cells += `<button class="gcell ${sel ? 'on' : ''} ${echo ? 'echo' : ''} ${black ? 'blk' : ''}" data-m="${m}" style="--c:${C.midiColor(m)}">${T.noteName(pc, flats)}</button>`;
    }
  }
  el.querySelector('.ggrid').innerHTML = cells;

  const a = analyse();
  let name = '…', sub = 'Tap notes in any octave. The lowest one is the bass.', stack = '';
  if (notes.length === 1) { name = T.midiName(notes[0], flats); sub = 'Add more notes, in any octave.'; }
  if (a) {
    if (a.chord) {
      const base = T.chordName(a.chord, flats);
      const bassName = T.noteName(a.sorted[0], flats);
      name = a.bassIdx > 0 ? `${base}/${bassName}` : base;
      sub = `${T.CHORD_TYPES[a.chord.type].name} · <b>${INVERSION[a.bassIdx] || 'inversion'}</b>${a.bassIdx > 0 ? ` (its ${a.bassDeg} is in the bass)` : ' (root in the bass)'}`;
    } else {
      name = [...new Set(a.sorted.map(m => T.noteName(m, flats)))].join(' ');
      sub = 'Not a named chord (yet)';
    }
    stack = a.sorted.map((m, i) => {
      const chip = `<span class="snote" style="--c:${C.midiColor(m)}">${T.midiName(m, flats)}${a.chord ? `<i>${T.degreeInChord(m, a.chord)}</i>` : ''}</span>`;
      if (i === 0) return chip;
      const d = m - a.sorted[i - 1];
      return `<span class="sgap">${d}<small>${ivName(d)}</small></span>${chip}`;
    }).join('');
  }
  el.querySelector('.ginfo').innerHTML = `
    <div class="gname">${name}</div><div class="gsub">${sub}</div>
    ${stack ? `<div class="gstack"><span class="lbl">low</span>${stack}<span class="lbl">high</span></div>` : ''}
    <div class="gacts">
      <button class="btn" data-g="play" ${notes.length ? '' : 'disabled'}>▶ Hear</button>
      <button class="btn" data-g="up" ${notes.length > 1 ? '' : 'disabled'} title="Move the lowest note up an octave">Invert ↑</button>
      <button class="btn" data-g="down" ${notes.length > 1 ? '' : 'disabled'} title="Move the highest note down an octave">Invert ↓</button>
      <button class="btn ghost" data-g="clear">Clear</button>
      ${a && a.chord ? '<button class="btn primary" data-g="add">+ Add</button>' : ''}
    </div>`;
  el.querySelector('.goctave').innerHTML = `Octaves ${lowOct}–${lowOct + ROWS - 1}
    <button class="btn small" data-g="octdn" ${lowOct <= 1 ? 'disabled' : ''}>▼</button><button class="btn small" data-g="octup" ${lowOct >= 4 ? 'disabled' : ''}>▲</button>`;
}

function changed() {
  const a = analyse();
  if (a && a.chord) { synced = ck(a.chord); selectChord(a.chord, { play: false }); }
  else render();
}

function hear() {
  if (!notes.length) return;
  A.stopAll();
  const s = [...notes].sort((a, b) => a - b);
  s.forEach((m, i) => playMidi(m, { at: i * 0.28, dur: 1.4 }));
  const at = s.length * 0.28 + 0.15;
  s.forEach((m, i) => playMidi(m, { at: at + i * 0.03, dur: 2.4, notify: false }));
}

export default {
  id: 'grid',
  mount(root) {
    el = root;
    el.innerHTML = `<div class="goctave"></div><div class="ggrid"></div><div class="ginfo"></div>`;
    el.addEventListener('click', e => {
      const cell = e.target.closest('.gcell');
      if (cell) {
        const m = +cell.dataset.m;
        if (notes.includes(m)) { notes = notes.filter(x => x !== m); playMidi(m, { dur: 0.8, vel: 0.35 }); }
        else { notes = [...notes, m]; playMidi(m, { dur: 1.6 }); }
        return changed();
      }
      const g = e.target.closest('[data-g]')?.dataset.g;
      if (!g) return;
      const s = [...notes].sort((a, b) => a - b);
      if (g === 'play') hear();
      if (g === 'clear') { notes = []; render(); }
      if (g === 'add') addToProg(state.chord);
      if (g === 'octdn') { lowOct = Math.max(1, lowOct - 1); render(); }
      if (g === 'octup') { lowOct = Math.min(4, lowOct + 1); render(); }
      if (g === 'up' && s.length > 1) {
        // lowest note jumps above the top (next octave up that's above everything)
        let m = s[0]; while (m <= s[s.length - 1]) m += 12;
        notes = [...s.slice(1), m]; changed(); hear();
      }
      if (g === 'down' && s.length > 1) {
        let m = s[s.length - 1]; while (m >= s[0]) m -= 12;
        notes = [m, ...s.slice(0, -1)]; changed(); hear();
      }
      // keep the view on the notes after an inversion
      const lo = Math.floor(Math.min(...notes) / 12) - 1, hi = Math.floor(Math.max(...notes) / 12) - 1;
      if (notes.length && (lo < lowOct || hi > lowOct + ROWS - 1)) { lowOct = Math.max(1, Math.min(4, lo)); render(); }
    });
  },
  render,
};
