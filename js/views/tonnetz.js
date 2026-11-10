// Tonnetz: a note lattice. → is a 5th, ↗ a major 3rd, ↖ a minor 3rd.
// Every triangle is a triad (▲ major, ▼ minor). Triangles sharing an edge share 2 notes.
import { state, on } from '../store.js';
import * as T from '../theory.js';
import * as C from '../color.js';
import { selectChord, playMidi } from '../actions.js';

let el, playhead = -1;
let COLS = 9, ROWS = 7;
const W = 64, H = W * 0.866;

function fit() {
  const st = el.querySelector('.stage');
  const w = st.clientWidth || 360, h = st.clientHeight || 360;
  // aim for nodes ~54px apart on screen so they're easy to tap
  COLS = Math.max(4, Math.min(11, Math.floor(w / 54)));
  ROWS = Math.max(4, Math.min(9, Math.floor(h / 48)));
}

function render() {
  fit();
  const key = state.key, flats = T.usesFlats(key), chord = state.chord;
  const cpcs = new Set(T.chordPcs(chord));
  const scale = new Set(T.scalePcs(key));
  // Centre the lattice on the selected chord's triangle (▲ major rooted at the centre node,
  // ▼ minor whose root sits a major 3rd above it).
  const j0 = Math.floor((ROWS - 1) / 2), i0 = Math.floor((COLS - 1) / 2) - Math.floor(j0 / 2);
  const fam = T.FAMILY[chord.type] === 'min' ? 'min' : 'maj';
  const centreTri = { root: chord.root, type: fam };
  const offset = T.mod12((fam === 'maj' ? chord.root : chord.root - 4) - (7 * i0 + 4 * j0));
  const pcAt = (i, j) => T.mod12(7 * i + 4 * j + offset);

  const nodes = new Map();
  for (let j = 0; j < ROWS; j++) for (let c = 0; c < COLS; c++) {
    const i = c - Math.floor(j / 2);
    nodes.set(`${i},${j}`, { i, j, x: c * W + (j % 2) * W / 2, y: (ROWS - 1 - j) * H, pc: pcAt(i, j) });
  }
  const N = (i, j) => nodes.get(`${i},${j}`);

  // Every note repeats across the lattice. Keep the copy nearest the centre chord at full
  // strength and fade the rest to ghosts, so each note appears once.
  const ca = N(i0, j0), cb = N(i0 + 1, j0), cu = N(i0, j0 + 1), cd = N(i0 + 1, j0 + 1);
  const ctr = fam === 'maj' ? [ca, cb, cu] : [cb, cu, cd];
  const cx0 = ctr.reduce((s, n) => s + n.x, 0) / 3, cy0 = ctr.reduce((s, n) => s + n.y, 0) / 3;
  const best = new Map();
  for (const n of nodes.values()) {
    const d = Math.hypot(n.x - cx0, n.y - cy0);
    if (!best.has(n.pc) || d < best.get(n.pc).d) best.set(n.pc, { d, n });
  }
  for (const n of nodes.values()) n.ghost = best.get(n.pc).n !== n;

  const neigh = T.plr(chord) || {};
  const tag = c => Object.entries(neigh).find(([, n]) => T.sameChord(n, c))?.[0];

  const tris = [];
  for (const n of nodes.values()) {
    const a = n, b = N(n.i + 1, n.j), u = N(n.i, n.j + 1), d = N(n.i + 1, n.j + 1);
    if (b && u) tris.push({ pts: [a, b, u], c: { root: a.pc, type: 'maj' }, ghost: a.ghost || b.ghost || u.ghost, centre: a === ca && fam === 'maj' });
    if (b && u && d) tris.push({ pts: [b, u, d], c: { root: T.mod12(a.pc + 4), type: 'min' }, ghost: b.ghost || u.ghost || d.ghost, centre: a === ca && fam === 'min' });
  }

  let triSvg = '', lbl = '';
  const centroids = [];
  for (const t of tris) {
    const pcs = T.chordPcs(t.c);
    const inChord = t.ghost ? false : pcs.every(p => cpcs.has(p));
    const dia = T.isDiatonic(t.c, key);
    const nb = tag(t.c);
    const cx = (t.pts[0].x + t.pts[1].x + t.pts[2].x) / 3, cy = (t.pts[0].y + t.pts[1].y + t.pts[2].y) / 3;
    centroids.push({ c: t.c, x: cx, y: cy, ghost: t.ghost });
    triSvg += `<polygon class="tri ${inChord ? 'sel' : ''} ${dia ? 'dia' : ''} ${nb && !t.ghost ? 'nb' : ''} ${t.ghost ? 'ghost' : ''}" data-root="${t.c.root}" data-type="${t.c.type}"
      points="${t.pts.map(p => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ')}"
      style="fill:${C.noteColor(t.c.root, 4, t.ghost ? 0.04 : inChord ? 0.75 : dia ? 0.26 : 0.1)}"/>`;
    if (!t.ghost) lbl += `<text class="tri-l ${inChord ? 'sel' : ''} ${dia ? 'dia' : ''}" x="${cx.toFixed(1)}" y="${(cy + 4).toFixed(1)}">${T.chordName(t.c, flats)}</text>`;
    if (nb && !t.ghost) lbl += `<text class="nb-tag" x="${cx.toFixed(1)}" y="${(cy + (t.c.type === 'maj' ? 17 : -9)).toFixed(1)}">${nb}</text>`;
  }

  // progression path: nearest instance of each triad to the previous one
  let path = '';
  const triadProg = state.prog.map(c => ({ root: c.root, type: T.FAMILY[c.type] === 'min' ? 'min' : 'maj', ok: ['maj', 'min'].includes(T.FAMILY[c.type]) }));
  if (triadProg.length > 1) {
    const mid = { x: (COLS * W) / 2, y: ((ROWS - 1) * H) / 2 };
    let prev = mid; const pts = [];
    triadProg.forEach(c => {
      if (!c.ok) return;
      const cands = centroids.filter(o => T.sameChord(o.c, c));
      if (!cands.length) return;
      const best = cands.reduce((a, b) => (Math.hypot(a.x - prev.x, a.y - prev.y) <= Math.hypot(b.x - prev.x, b.y - prev.y) ? a : b));
      pts.push(best); prev = best;
    });
    if (pts.length > 1) {
      path = `<polyline class="ppath" points="${pts.map(p => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ')}"/>` +
        pts.map((p, n) => `<g class="pstep ${n === playhead ? 'beat' : ''}" transform="translate(${p.x.toFixed(1)},${p.y.toFixed(1)})"><circle r="9"/><text dy="3.5">${n + 1}</text></g>`).join('');
    }
  }

  let nodeSvg = '';
  for (const n of nodes.values()) {
    const on = cpcs.has(n.pc), inScale = scale.has(n.pc);
    const label = state.labels === 'degree' ? T.DEGREE_NAMES[T.mod12(n.pc - key.tonic)] : T.noteName(n.pc, flats);
    nodeSvg += `<g class="tnode ${on && !n.ghost ? 'on' : ''} ${inScale ? 'scale' : ''} ${n.ghost ? 'ghost' : ''}" data-pc="${n.pc}" transform="translate(${n.x.toFixed(1)},${n.y.toFixed(1)})">
      <circle r="${on && !n.ghost ? 16 : 12}" fill="${C.noteColor(n.pc, 4, n.ghost ? 0.12 : on ? 1 : inScale ? 0.6 : 0.3)}"/><text dy="4">${label}</text></g>`;
  }

  const w = (COLS - 0.5) * W, h = (ROWS - 1) * H;
  el.querySelector('.stage').innerHTML = `<svg viewBox="${-24} ${-24} ${w + 48} ${h + 48}" class="tonnetz" preserveAspectRatio="xMidYMid meet">
    ${triSvg}${lbl}${path}${nodeSvg}</svg>`;
}

export default {
  id: 'tonnetz',
  mount(root) {
    el = root;
    el.innerHTML = `<div class="stage"></div>
      <p class="hint">Your chord sits in the middle; every note appears once at full strength (the faded copies are the same notes repeating). Each triangle is a chord, ▲ major ▼ minor. The three <b>P R L</b> neighbours share 2 notes: tap one to step there.</p>`;
    el.addEventListener('click', e => {
      const n = e.target.closest('.tnode');
      if (n) return playMidi(60 + +n.dataset.pc);
      const t = e.target.closest('.tri');
      if (t) selectChord({ root: +t.dataset.root, type: t.dataset.type });
    });
    new ResizeObserver(() => { if (el.classList.contains('active')) render(); }).observe(el.querySelector('.stage'));
    on('playhead', i => { playhead = i; if (el.classList.contains('active')) render(); });
  },
  render,
};
