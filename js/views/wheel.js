// Circle of fifths: majors outside, relative minors inside, diminished at the core.
// The current key lights up as a 3-wide wedge; the wheel turns so the key sits at the top.
import { state, on } from '../store.js';
import * as T from '../theory.js';
import * as C from '../color.js';
import { selectChord } from '../actions.js';

let el, svg, ring, rot = 0, anim = null, playhead = -1;

const RINGS = [
  { fam: 'maj', type: 'maj', r1: 130, r2: 196, root: k => T.mod12(k * 7) },
  { fam: 'min', type: 'min', r1: 82, r2: 130, root: k => T.mod12(k * 7 + 9) },
  { fam: 'dim', type: 'dim', r1: 44, r2: 82, root: k => T.mod12(k * 7 + 11) },
];
const deg = d => (d * Math.PI) / 180;
const pt = (r, a) => `${(r * Math.sin(a)).toFixed(2)} ${(-r * Math.cos(a)).toFixed(2)}`;
const sector = (r1, r2, a0, a1) =>
  `M${pt(r2, a0)} A${r2} ${r2} 0 0 1 ${pt(r2, a1)} L${pt(r1, a1)} A${r1} ${r1} 0 0 0 ${pt(r1, a0)}Z`;

function build() {
  let segs = '';
  RINGS.forEach((ring, ri) => {
    for (let k = 0; k < 12; k++) {
      const a0 = deg(k * 30 - 15), a1 = deg(k * 30 + 15), mid = deg(k * 30), rm = (ring.r1 + ring.r2) / 2;
      const x = (rm * Math.sin(mid)).toFixed(1), y = (-rm * Math.cos(mid)).toFixed(1);
      segs += `<g class="seg" data-ring="${ri}" data-k="${k}">
        <path d="${sector(ring.r1, ring.r2, a0, a1)}"/>
        <g transform="translate(${x},${y})"><g class="up"><text class="nm" dy="${ri === 0 ? 0 : 4}"></text><text class="rn" dy="${ri === 0 ? 17 : 0}"></text></g></g>
      </g>`;
    }
  });
  el.querySelector('.stage').innerHTML = `
    <svg viewBox="-205 -205 410 410" class="wheel">
      <g class="ring">${segs}</g>
      <circle r="44" class="hub"/>
      <text class="hub-key" y="-2"></text><text class="hub-mode" y="16"></text>
    </svg>`;
  svg = el.querySelector('svg');
  ring = svg.querySelector('.ring');
}

function setRot(r) {
  rot = r;
  ring.setAttribute('transform', `rotate(${r})`);
  ring.querySelectorAll('.up').forEach(u => u.setAttribute('transform', `rotate(${-r})`));
}

function turnTo(target) {
  let delta = ((target - rot) % 360 + 540) % 360 - 180;
  if (Math.abs(delta) < 0.01) return setRot(target);
  const from = rot, t0 = performance.now(), D = 550;
  cancelAnimationFrame(anim);
  const tick = now => {
    const p = Math.min(1, (now - t0) / D), e = p < 0.5 ? 2 * p * p : 1 - Math.pow(-2 * p + 2, 2) / 2;
    setRot(from + delta * e);
    if (p < 1) anim = requestAnimationFrame(tick);
  };
  anim = requestAnimationFrame(tick);
}

function chordAt(ri, k) {
  const r = RINGS[ri];
  return { root: r.root(k), type: r.type };
}

// With "7ths" on, diatonic chords become their diatonic 7th; others get the usual 7th.
function withSevenths(c) {
  if (!state.sevenths) return c;
  const d7 = T.diatonic(state.key, true).find(d => d.root === c.root && T.FAMILY[d.type] === c.type);
  if (d7 && T.isDiatonic(c, state.key)) return { root: c.root, type: d7.type };
  return { root: c.root, type: { maj: 'dom7', min: 'min7', dim: 'm7b5' }[c.type] };
}

function render() {
  const key = state.key, flats = T.usesFlats(key);
  const majorTonic = key.mode === 'minor' ? T.mod12(key.tonic + 3) : key.tonic;
  const kIdx = T.fifthsIndex(majorTonic);
  const progSet = state.prog.map(c => `${c.root}:${T.FAMILY[c.type]}`);
  const playing = playhead >= 0 && state.prog[playhead] ? state.prog[playhead] : null;

  svg.querySelectorAll('.seg').forEach(g => {
    const ri = +g.dataset.ring, k = +g.dataset.k;
    const c = chordAt(ri, k), shown = withSevenths(c);
    const dia = T.isDiatonic(c, key);
    const tonic = c.root === key.tonic && c.type === (key.mode === 'major' ? 'maj' : 'min');
    const sel = state.chord.root === c.root && T.FAMILY[state.chord.type] === c.type;
    const path = g.querySelector('path');
    path.style.fill = C.noteColor(c.root, dia ? 4 : 3, dia ? 0.88 : 0.2);
    g.classList.toggle('dia', dia);
    g.classList.toggle('tonic', tonic);
    g.classList.toggle('sel', sel);
    g.classList.toggle('inprog', progSet.includes(`${c.root}:${c.type}`));
    g.classList.toggle('beat', !!playing && playing.root === c.root && T.FAMILY[playing.type] === c.type);
    g.querySelector('.nm').textContent = T.chordName(shown, flats);
    g.querySelector('.rn').textContent = dia ? T.romanFor(shown, key) : '';
  });
  svg.querySelector('.hub-key').textContent = T.noteName(key.tonic, flats);
  svg.querySelector('.hub-mode').textContent = key.mode;
  turnTo(-kIdx * 30);
}

export default {
  id: 'wheel',
  mount(root) {
    el = root;
    el.innerHTML = `<div class="stage"></div>
      <p class="hint">Lit chords belong to the key. Neighbours on the wheel share notes, so moving one step sounds smooth and a jump across sounds dramatic.</p>`;
    build();
    setRot(0);
    el.addEventListener('click', e => {
      const g = e.target.closest('.seg');
      if (g) return selectChord(withSevenths(chordAt(+g.dataset.ring, +g.dataset.k)));
      if (e.target.closest('.hub, .hub-key, .hub-mode')) {
        selectChord(withSevenths({ root: state.key.tonic, type: state.key.mode === 'major' ? 'maj' : 'min' }));
      }
    });
    on('playhead', i => { playhead = i; render(); });
  },
  render,
};
