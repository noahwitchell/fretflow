// Degrees: relative pitch in context. A cadence sets the key, a note plays, you name its
// scale degree, then it resolves home so you hear its pull.
import { state } from '../store.js';
import * as T from '../theory.js';
import * as C from '../color.js';
import * as A from '../audio.js';
import { data, save, logDeg } from './log.js';
import { ring, seg, pct } from './ui.js';

let el, q = null, answered = false, busy = false, sess = { n: 0, ok: 0 };
const SOLFEGE = ['Do', 'Ra', 'Re', 'Me', 'Mi', 'Fa', 'Fi', 'So', 'Le', 'La', 'Te', 'Ti'];

function fb(msg, cls = '') { const f = el.querySelector('.ear-fb'); f.innerHTML = msg; f.className = `ear-fb ${cls}`; }

function keyFor() {
  if (data.opts.degKey === 'same') return { ...state.key };
  return { tonic: Math.floor(Math.random() * 12), mode: state.key.mode };
}

// I–IV–V–I (i–iv–V–i in minor) so the ear locks onto home.
function cadence(key) {
  const d = T.diatonic(key);
  const V = key.mode === 'minor' ? { root: T.mod12(key.tonic + 7), type: 'maj' } : d[4];
  const seq = [d[0], d[3], V, d[0]];
  let prev = null;
  seq.forEach((c, i) => {
    const v = T.voice(c, prev); prev = v.notes;
    [v.bass, ...v.notes].forEach(m => A.playNote(m, { at: i * 0.55, dur: 1, vel: 0.45, notify: false }));
  });
  return seq.length * 0.55 + 0.5;
}

function degreePool(key) {
  if (data.opts.degSet === 'chromatic') return [...Array(12).keys()];
  return T.MODES[key.mode];
}

function newQ(sameKey = false) {
  if (busy) return;
  const key = sameKey && q ? q.key : keyFor();
  const pl = degreePool(key);
  const deg = pl[Math.floor(Math.random() * pl.length)];
  const midi = 60 + T.mod12(key.tonic + deg) + (Math.random() < 0.3 ? -12 : 0);
  q = { key, deg, midi }; answered = false; busy = true;
  fb(`Key of <b>${T.keyName(key)}</b>…`);
  paint();
  const wait = cadence(key);
  setTimeout(() => {
    busy = false;
    A.playNote(midi, { dur: 2.2, source: 'mystery' });
    fb('Which degree?');
  }, wait * 1000);
}

// Walk the note to the nearest tonic by scale steps (chromatic notes step in first).
function resolve() {
  const steps = T.MODES[q.key.mode];
  let rel = q.deg, path = [];
  if (!steps.includes(rel)) { rel = steps.includes(rel - 1) ? rel - 1 : rel + 1; path.push(rel); }
  let i = steps.indexOf(rel);
  if (i <= 3) { while (i > 0) { i--; path.push(steps[i]); } }
  else { while (i < 7) { i++; path.push(i === 7 ? 12 : steps[i]); } }
  const base = q.midi - q.deg;
  [q.deg, ...path].forEach((d, n) => A.playNote(base + d, { at: 0.2 + n * 0.32, dur: n === path.length ? 1.6 : 0.5 }));
}

function guess(deg) {
  if (!q || busy) return newQ();
  if (answered) return A.playNote(q.midi - q.deg + deg, { dur: 1.2 });
  answered = true;
  const ok = deg === q.deg;
  sess.n++; if (ok) sess.ok++;
  logDeg(q.deg, deg);
  const nm = T.noteName(q.key.tonic + q.deg, T.usesFlats(q.key));
  fb(ok ? `✓ ${T.DEGREE_NAMES[q.deg]} (${SOLFEGE[q.deg]}) = ${nm}` : `✗ It was <b>${T.DEGREE_NAMES[q.deg]}</b> (${SOLFEGE[q.deg]}) = ${nm}`, ok ? 'good' : 'bad');
  resolve();
  C.wash(C.noteWash(q.midi), false);
  paint(q.deg, ok ? null : deg);
}

function paint(correct = null, wrong = null) {
  const key = q?.key || keyFor();
  const allowed = new Set(degreePool(key));
  const items = [...Array(12).keys()].map(d => {
    const p = data.deg[d];
    return {
      k: d, label: T.DEGREE_NAMES[d], sub: `${SOLFEGE[d]}${p && p.n ? ' · ' + pct(p.ok, p.n) : ''}`,
      color: answered && d === q?.deg ? C.noteColor(key.tonic + d) : `hsla(220, 12%, ${d === 0 ? 40 : 26}%, 1)`,
      disabled: !allowed.has(d), cls: `${d === correct ? 'correct' : ''} ${d === wrong ? 'wrong' : ''}`,
    };
  });
  el.querySelector('.ring-slot').innerHTML = ring(items, `<div class="ear-big">${pct(sess.ok, sess.n)}</div><div class="ear-small">${sess.ok}/${sess.n}</div>`);
}

function controls() {
  const o = data.opts;
  el.querySelector('.ear-controls').innerHTML = `
    <div class="row">${seg('degKey', [['same', `Key: ${T.keyName(state.key)}`], ['random', 'New key each time']], o.degKey)}</div>
    <div class="row">${seg('degSet', [['diatonic', 'Scale notes'], ['chromatic', 'All 12']], o.degSet)}</div>
    <div class="row">
      <button class="btn primary" data-act="new">▶ New</button>
      <button class="btn" data-act="again">↻ Again</button>
      <button class="btn ghost" data-act="key">Replay key</button>
    </div>`;
}

export default {
  id: 'degrees', label: 'Degrees',
  mount(root) {
    el = root;
    el.innerHTML = `<div class="ear-controls"></div><div class="ring-slot ear-ring-wrap"></div>
      <div class="ear-fb">A short chord sequence sets the key, then one note plays. Name its place in the key.</div>`;
    el.addEventListener('click', e => {
      const b = e.target.closest('.ear-btn'); if (b) return guess(+b.dataset.k);
      const sc = e.target.closest('.seg-ctl[data-name] button');
      if (sc) { data.opts[sc.closest('.seg-ctl').dataset.name] = sc.dataset.v; save(); q = null; answered = false; controls(); paint(); return; }
      const act = e.target.closest('[data-act]')?.dataset.act;
      if (act === 'new') newQ(data.opts.degKey === 'same');
      if (act === 'again' && q && !busy) A.playNote(q.midi, { dur: 2, source: answered ? 'play' : 'mystery' });
      if (act === 'key' && q && !busy) cadence(q.key);
    });
    controls(); paint();
  },
  show() { controls(); paint(); },
};
