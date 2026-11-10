// Moves: how chords connect. Your chord sits on the 12-note ring; five cards offer the classic
// next steps, each saying which notes stay and which move. Tapping one slides the moving note
// on the ring (and in your ears) and makes that chord the new centre. Your path is a trail.
import { state, set, on } from '../store.js';
import * as T from '../theory.js';
import * as C from '../color.js';
import * as A from '../audio.js';
import { playChord } from '../actions.js';

let el, trail = [], last = null, raf = 0;
const R = 118;

const triad = c => ({ root: c.root, type: T.FAMILY[c.type] === 'min' || T.FAMILY[c.type] === 'dim' ? 'min' : 'maj' });
const pcsOf = c => [...new Set(T.chordPcs(c))];
const ang = pc => (C.wheelPos(pc) / 12) * Math.PI * 2;
const xy = (a, r = R) => [r * Math.sin(a), -r * Math.cos(a)];
const signed = (a, b) => { let d = T.mod12(b - a); if (d > 6) d -= 12; return d; };

// What changes between two chords: shared notes, and each moving note paired with where it goes.
function diff(a, b) {
  const pa = pcsOf(a), pb = pcsOf(b);
  const shared = pa.filter(p => pb.includes(p));
  let outs = pa.filter(p => !pb.includes(p)), ins = pb.filter(p => !pa.includes(p));
  const pairs = [];
  while (outs.length && ins.length) {
    let best = null;
    outs.forEach(o => ins.forEach(i => { const d = signed(o, i); if (!best || Math.abs(d) < Math.abs(best[2])) best = [o, i, d]; }));
    pairs.push(best);
    outs = outs.filter(o => o !== best[0]); ins = ins.filter(i => i !== best[1]);
  }
  return { shared, pairs };
}

function movesFor(c) {
  const t = triad(c), p = T.plr(t), maj = t.type === 'maj';
  return [
    { id: 'R', title: maj ? 'Relative minor' : 'Relative major', blurb: maj ? 'Its sad twin: the closest relative there is.' : 'Its bright twin: the closest relative there is.', to: p.R },
    { id: 'P', title: maj ? 'Flip to minor' : 'Flip to major', blurb: 'Same root, only the middle note slides. Instant mood swap.', to: p.P },
    { id: 'L', title: 'Half-step neighbour', blurb: 'One note slides a half step: a soft, dreamy shift.', to: p.L },
    { id: 'V', title: 'Up a fifth', blurb: 'Builds tension: from there, coming back here feels like home.', to: { root: T.mod12(t.root + 7), type: t.type } },
    { id: 'IV', title: 'Down a fifth', blurb: 'Steps away from home, opening up.', to: { root: T.mod12(t.root + 5), type: t.type } },
  ];
}

function moveText(d, flats) {
  const mv = d.pairs.map(([o, i, s]) => `${T.noteName(o, flats)} → ${T.noteName(i, flats)} <small>(${s > 0 ? 'up' : 'down'} ${Math.abs(s) === 1 ? 'a half step' : Math.abs(s) === 2 ? 'a whole step' : Math.abs(s) + ' half steps'})</small>`).join('<br>');
  const keep = d.shared.length ? `keeps ${d.shared.map(p => T.noteName(p, flats)).join(' ')}` : 'keeps nothing';
  return `${mv}<div class="keep">${keep}</div>`;
}

function ringSvg(cur) {
  const flats = T.usesFlats(state.key);
  const pcs = pcsOf(cur);
  let nodes = '';
  for (let pc = 0; pc < 12; pc++) {
    const [x, y] = xy(ang(pc));
    const on = pcs.includes(pc), moved = last && last.d.pairs.some(p => p[1] === pc), kept = last && last.d.shared.includes(pc);
    nodes += `<g class="mnode ${on ? 'on' : ''} ${moved ? 'moved' : ''} ${kept && on ? 'kept' : ''}" transform="translate(${x.toFixed(1)},${y.toFixed(1)})">
      <circle r="${on ? 21 : 15}" fill="${C.noteColor(pc, 4, on ? 1 : 0.16)}"/><text dy="4">${T.noteName(pc, flats)}</text></g>`;
  }
  let ghost = '', arrows = '';
  if (last) {
    const gp = pcsOf(last.from).map(pc => xy(ang(pc)).map(v => v.toFixed(1)).join(',')).join(' ');
    ghost = `<polygon points="${gp}" class="mghost"/>`;
    last.d.pairs.forEach(([o, i, s]) => {
      // arrow along the outside of the ring from the old note to the new one
      let a0 = ang(o), a1 = ang(i);
      let da = a1 - a0; if (da > Math.PI) da -= 2 * Math.PI; if (da < -Math.PI) da += 2 * Math.PI;
      const r = R + 34, p0 = xy(a0 + Math.sign(da) * 0.12, r), p1 = xy(a1 - Math.sign(da) * 0.12, r);
      arrows += `<path class="marrow" d="M${p0[0].toFixed(1)} ${p0[1].toFixed(1)} A${r} ${r} 0 0 ${da > 0 ? 1 : 0} ${p1[0].toFixed(1)} ${p1[1].toFixed(1)}" marker-end="url(#ah)"/>`;
    });
  }
  return `<svg viewBox="-175 -175 350 350" class="moves-ring">
    <defs><marker id="ah" viewBox="0 0 10 10" refX="6" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse"><path d="M0 0 L10 5 L0 10z" fill="#fff"/></marker></defs>
    <circle r="${R}" class="ring"/>
    ${ghost}
    <polygon class="mshape" points="" style="fill:${C.noteColor(cur.root, 4, 0.25)};stroke:${C.noteColor(cur.root, 5, 0.95)}"/>
    ${arrows}${nodes}
    <text class="mname" y="-2">${T.chordName(cur, flats)}</text>
    <text class="msub" y="18">${last ? `from ${T.chordName(last.from, flats)}: ${last.d.shared.length} stay, ${last.d.pairs.length} move` : T.CHORD_TYPES[cur.type].name}</text>
  </svg>`;
}

// Slide the moving corners of the shape from their old notes to their new ones.
function animateShape(cur) {
  const poly = el.querySelector('.mshape');
  const target = pcsOf(cur);
  const start = last ? target.map(pc => { const p = last.d.pairs.find(q => q[1] === pc); return p ? p[0] : pc; }) : target;
  const t0 = performance.now(), D = last ? 650 : 0;
  cancelAnimationFrame(raf);
  const frame = now => {
    const k = D ? Math.min(1, (now - t0) / D) : 1, e = k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2;
    poly.setAttribute('points', target.map((pc, i) => {
      let a0 = ang(start[i]), a1 = ang(pc), da = a1 - a0;
      if (da > Math.PI) da -= 2 * Math.PI; if (da < -Math.PI) da += 2 * Math.PI;
      return xy(a0 + da * e).map(v => v.toFixed(1)).join(',');
    }).join(' '));
    if (k < 1) raf = requestAnimationFrame(frame);
  };
  raf = requestAnimationFrame(frame);
}

function render() {
  const cur = triad(state.chord), flats = T.usesFlats(state.key);
  if (!trail.length || !T.sameChord(trail[trail.length - 1], cur)) {
    if (!(last && T.sameChord(last.to, cur))) last = null; // chosen elsewhere: no arrows
    trail.push(cur); trail = trail.slice(-12);
  }
  const cards = movesFor(cur).map(m => {
    const d = diff(cur, m.to), dia = T.isDiatonic(m.to, state.key);
    return `<button class="mcard" data-move="${m.id}" style="--c:${C.noteColor(m.to.root)}">
      <div class="mtop"><b>${T.chordName(m.to, flats)}</b><span class="rn ${dia ? '' : 'out'}">${T.romanFor(m.to, state.key)}</span><span class="dots">${'●'.repeat(d.shared.length)}${'○'.repeat(3 - d.shared.length)}</span></div>
      <div class="mtitle">${m.title}</div>
      <div class="mmove">${moveText(d, flats)}</div>
      <div class="mblurb">${m.blurb}</div></button>`;
  }).join('');
  el.querySelector('.mtrail').innerHTML = `<span class="lbl">Path</span>${trail.map((c, i) => `<button class="tchip ${i === trail.length - 1 ? 'on' : ''}" data-ti="${i}" style="--c:${C.noteColor(c.root)}">${T.chordName(c, flats)}</button>`).join('<span class="arr">→</span>')}
    ${trail.length > 1 ? '<button class="btn small" data-use>Use as progression</button><button class="btn small ghost" data-reset>Restart</button>' : ''}`;
  el.querySelector('.mstage').innerHTML = ringSvg(cur);
  el.querySelector('.mcards').innerHTML = cards;
  animateShape(cur);
  const tr = el.querySelector('.mtrail'); tr.scrollLeft = tr.scrollWidth;
}

function go(to, from) {
  const d = diff(from, to);
  last = { from, to, d };
  A.stopAll();
  // hear the move: each moving note slides old → new, then the new chord
  d.pairs.forEach(([o, , s], k) => {
    const base = 57 + T.mod12(o - 9);           // A3..G#4
    A.playNote(base, { at: k * 0.05, dur: 0.6, vel: 0.5 });
    A.playNote(base + s, { at: 0.35 + k * 0.05, dur: 0.9, vel: 0.55 });
  });
  set({ chord: { ...to } });
  setTimeout(() => playChord(to, state.tapSound), 800);
}

export default {
  id: 'moves',
  mount(root) {
    el = root;
    el.innerHTML = `<div class="mtrail"></div><div class="mstage stage"></div><div class="mcards"></div>`;
    el.addEventListener('click', e => {
      const card = e.target.closest('[data-move]');
      if (card) {
        const cur = triad(state.chord);
        const m = movesFor(cur).find(x => x.id === card.dataset.move);
        return go(m.to, cur);
      }
      const t = e.target.closest('[data-ti]');
      if (t) { const c = trail[+t.dataset.ti]; trail = trail.slice(0, +t.dataset.ti); last = null; set({ chord: { ...c } }); playChord(c, state.tapSound); return; }
      if (e.target.closest('[data-use]')) { set({ prog: trail.map(c => ({ ...c })) }); return; }
      if (e.target.closest('[data-reset]')) { trail = []; last = null; render(); }
    });
  },
  render,
};
