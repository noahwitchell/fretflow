// Circle of fifths: majors outside, relative minors inside, diminished at the core.
// The current key lights up as a 3-wide wedge; the wheel turns so the key sits at the top.
import { state, on, set } from '../store.js';
import * as T from '../theory.js';
import * as C from '../color.js';
import { selectChord, playMidi } from '../actions.js';

let el, svg, ring, rot = 0, anim = null, playhead = -1, drag = null, justDragged = false, seenKey = null, toastT = 0;
const ROLES = {
  major: ['home', 'leads to V', 'soft', 'away', 'tension', 'sad home', 'very tense'],
  minor: ['home', 'tense', 'bright', 'away', 'soft', 'lift', 'step up'],
};

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

// Which key sits in the lit wedge at the top for a given rotation.
function keyAtRot(r) {
  const k = T.mod12(Math.round(-r / 30));
  const majorTonic = T.mod12(k * 7);
  return { tonic: state.key.mode === 'minor' ? T.mod12(majorTonic + 9) : majorTonic, mode: state.key.mode };
}
const angleOf = (e) => {
  const b = svg.getBoundingClientRect();
  return (Math.atan2(e.clientY - (b.top + b.height / 2), e.clientX - (b.left + b.width / 2)) * 180) / Math.PI;
};

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

// The 7 notes of the key, and the 7 chords stacked from them (every other note).
function strip(key) {
  const flats = T.usesFlats(key);
  const sc = T.scalePcs(key), dia = T.diatonic(key, state.sevenths);
  const sel = T.chordPcs(state.chord);
  const cols = sc.map((pc, i) => {
    const c = dia[i], on = sel.includes(pc);
    const isSel = T.sameChord(c, state.chord) || (state.chord.root === c.root && T.FAMILY[state.chord.type] === T.FAMILY[c.type]);
    return `<div class="fcol">
      <button class="fnote ${on ? 'on' : ''}" data-note="${pc}" style="--c:${C.noteColor(pc)}"><small>${i + 1}</small>${T.noteName(pc, flats)}${on ? `<i>${T.degreeInChord(pc, state.chord)}</i>` : ''}</button>
      <button class="fchord ${isSel ? 'on' : ''}" data-fi="${i}" style="--c:${C.noteColor(c.root)}"><span class="rn">${T.romanFor(c, key)}</span><b>${T.chordName(c, flats)}</b><small>${ROLES[key.mode][i]}</small></button>
    </div>`;
  }).join('');
  el.querySelector('.family').innerHTML = `<div class="fhead"><b>${T.keyName(key)}</b> uses these 7 notes · each chord below stacks every other one</div><div class="fgrid">${cols}</div>`;
}

// When the key changes, say exactly which note changed.
function keyToast(key) {
  const id = `${key.tonic}:${key.mode}`;
  if (seenKey === null) { seenKey = { id, key }; return; }
  if (seenKey.id === id) return;
  const a = new Set(T.scalePcs(seenKey.key)), b = new Set(T.scalePcs(key));
  const out = [...a].filter(p => !b.has(p)), inn = [...b].filter(p => !a.has(p));
  const fa = T.usesFlats(seenKey.key), fb = T.usesFlats(key);
  let msg;
  if (!out.length) msg = `${T.keyName(key)} uses the same 7 notes as ${T.keyName(seenKey.key)}, just a different home.`;
  else if (out.length === 1) msg = `${T.keyName(key)} = ${T.keyName(seenKey.key)} with one note changed: <b>${T.noteName(out[0], fa)} → ${T.noteName(inn[0], fb)}</b>`;
  else msg = `${T.keyName(key)}: ${out.length} notes differ from ${T.keyName(seenKey.key)} (${out.map(p => T.noteName(p, fa)).join(' ')} → ${inn.map(p => T.noteName(p, fb)).join(' ')})`;
  seenKey = { id, key };
  const t = el.querySelector('.wtoast');
  t.innerHTML = msg; t.classList.add('show');
  clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove('show'), 3500);
}

function render(tempKey = null) {
  const key = tempKey || state.key, flats = T.usesFlats(key);
  const selPcs = new Set(T.chordPcs(state.chord));
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
    // how many notes this chord shares with the selected one: 2 = smooth move, 1 = related
    const shared = sel ? 0 : T.chordPcs(c).filter(p => selPcs.has(p)).length;
    g.classList.toggle('share2', shared >= 2);
    g.classList.toggle('share1', shared === 1);
    g.querySelector('.nm').textContent = T.chordName(shown, flats);
    g.querySelector('.rn').textContent = dia ? T.romanFor(shown, key) : '';
  });
  svg.querySelector('.hub-key').textContent = T.noteName(key.tonic, flats);
  svg.querySelector('.hub-mode').textContent = `${key.mode} ⇄`;
  if (!tempKey && !drag) turnTo(-kIdx * 30);
  strip(key);
  keyToast(key);
}

export default {
  id: 'wheel',
  mount(root) {
    el = root;
    el.innerHTML = `<div class="stage"></div>
      <div class="wtoast"></div>
      <p class="hint"><b>Drag</b> to change key · tap a chord · <span class="k2">gold</span> = shares 2 notes · middle flips major ⇄ minor</p>
      <div class="family"></div>`;
    build();
    setRot(0);
    // drag anywhere on the wheel to turn it; the key is whatever lands in the lit wedge at the top
    svg.addEventListener('pointerdown', e => {
      cancelAnimationFrame(anim);
      drag = { a0: angleOf(e), r0: rot, moved: false, k: null, id: e.pointerId };
    });
    svg.addEventListener('pointermove', e => {
      if (!drag || e.pointerId !== drag.id) return;
      let da = angleOf(e) - drag.a0;
      da = ((da + 540) % 360) - 180;
      if (!drag.moved && Math.abs(da) < 4) return;
      if (!drag.moved) { drag.moved = true; svg.setPointerCapture(e.pointerId); }
      setRot(drag.r0 + da);
      const k = keyAtRot(rot);
      const id = `${k.tonic}`;
      if (id !== drag.k) {
        drag.k = id; render(k);
        playMidi(48 + T.mod12(k.tonic - 0) + (k.tonic > 6 ? -12 : 0) + 12, { dur: 0.9, vel: 0.35 }); // a soft tick of the new home note
      }
    });
    const end = e => {
      if (!drag) return;
      const d = drag; drag = null;
      if (!d.moved) return;
      justDragged = true; setTimeout(() => { justDragged = false; }, 50);
      const k = keyAtRot(rot);
      const target = Math.round(rot / 30) * 30;
      turnTo(target);
      if (k.tonic !== state.key.tonic) set({ key: k }); else render();
    };
    svg.addEventListener('pointerup', end);
    svg.addEventListener('pointercancel', end);

    el.addEventListener('click', e => {
      if (justDragged) return;
      const fc = e.target.closest('[data-fi]');
      if (fc) return selectChord(T.diatonic(state.key, state.sevenths)[+fc.dataset.fi]);
      const fn = e.target.closest('[data-note]');
      if (fn) return playMidi(60 + +fn.dataset.note, { dur: 1.4 });
      const g = e.target.closest('.seg');
      if (g) return selectChord(withSevenths(chordAt(+g.dataset.ring, +g.dataset.k)));
      if (e.target.closest('.hub, .hub-key, .hub-mode')) {
        // flip between the major key and its relative minor (same notes, different home)
        const k = state.key;
        set({ key: k.mode === 'major' ? { tonic: T.mod12(k.tonic + 9), mode: 'minor' } : { tonic: T.mod12(k.tonic + 3), mode: 'major' } });
      }
    });
    on('playhead', i => { playhead = i; render(); });
  },
  render,
};
