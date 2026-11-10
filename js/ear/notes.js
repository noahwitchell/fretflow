// Notes: absolute pitch quiz. Adaptive unlocking, noise between notes, varied timbre and
// reaction time. Everything stays dark until you find the right note: the colour is the reward.
// A miss lets you try again; only the first guess counts toward your score.
import * as T from '../theory.js';
import * as C from '../color.js';
import * as A from '../audio.js';
import { data, save, logNote, unlocked, levelProgress, UNLOCK_ORDER } from './log.js';
import { ring, seg, pct, PLAIN } from './ui.js';

let el, mystery = null, answered = false, misses = [], t0 = 0, streak = 0, sess = { n: 0, ok: 0 }, last = null, busy = false;
const RANGES = { '4': [4, 4], '3-5': [3, 5], '2-6': [2, 6] };
const NATURALS = [0, 2, 4, 5, 7, 9, 11];

function pool() {
  const p = data.opts.pool;
  if (p === 'adaptive') return unlocked();
  if (p === 'naturals') return NATURALS;
  return [...Array(12).keys()];
}

function fb(msg, cls = '') { const f = el.querySelector('.ear-fb'); f.innerHTML = msg; f.className = `ear-fb ${cls}`; }

function playMystery() {
  // 'mystery' never lights the screen; the colour only comes with the right answer
  A.playNote(mystery.midi, { source: 'mystery', dur: 2.4, timbre: mystery.timbre });
}

function newNote() {
  if (busy) return;
  const pl = pool(), [lo, hi] = RANGES[data.opts.range];
  let pc, oct, guard = 0;
  do {
    pc = pl[Math.floor(Math.random() * pl.length)];
    oct = lo + Math.floor(Math.random() * (hi - lo + 1));
  } while (pl.length > 1 && last && pc === last.pc && guard++ < 20);
  const timbre = data.opts.timbre === 'mix' ? A.TIMBRES[Math.floor(Math.random() * 3)] : data.opts.timbre;
  mystery = { pc, midi: (oct + 1) * 12 + pc, timbre };
  answered = false; misses = [];
  const delay = data.opts.noise && last ? A.scramble(0.7) + 0.35 : 0;
  busy = true;
  fb(delay ? 'Clearing your ears…' : '');
  setTimeout(() => {
    busy = false;
    playMystery(); t0 = performance.now();
    fb(`Which note? <span class="dim">${mystery.timbre}</span>`);
    paint();
  }, delay * 1000);
  paint();
}

function guess(pc) {
  if (!mystery || busy) return newNote();
  if (answered) return A.playNote(60 + pc, { timbre: mystery.timbre }); // free play after solving
  const want = mystery.pc, ok = pc === want;
  if (misses.includes(pc)) return;
  const first = misses.length === 0;
  const rt = performance.now() - t0;
  let newPc = null;
  if (first) {
    sess.n++; if (ok) sess.ok++;
    streak = ok ? streak + 1 : 0;
    newPc = logNote(want, pc, rt, false);
  }
  if (!ok) {
    // stay dark: hear what you picked, then the mystery note again, and try again
    misses.push(pc);
    A.stopAll();
    A.playNote(mystery.midi - want + pc, { dur: 0.9, vel: 0.45, timbre: mystery.timbre, source: 'mystery' });
    setTimeout(() => playMystery(), 750);
    const anchor = data.anchors[want];
    fb(`Not ${T.noteName(pc)}. Listen again and try another.${misses.length >= 2 && anchor ? `<br><span class="dim">Hint, your anchor: ${anchor}</span>` : ''}`, 'bad');
    paint(null, misses);
    return;
  }
  // right: the reward. Colour floods in with the note.
  answered = true; last = mystery;
  A.stopAll();
  A.playNote(mystery.midi, { dur: 2, timbre: mystery.timbre, source: 'reveal' });
  const speed = rt < 1500 ? 'fast' : rt < 3000 ? 'ok' : 'slow';
  fb(first ? `✓ ${T.midiName(mystery.midi)} <span class="rt ${speed}">${(rt / 1000).toFixed(1)}s</span>` : `✓ ${T.midiName(mystery.midi)}, found on try ${misses.length + 1}`, 'good');
  if (newPc !== null) setTimeout(() => fb(`🎉 Unlocked <b>${T.noteName(newPc)}</b>. Listen to it a few times first.`, 'good'), 900);
  paint(want, misses);
  if (newPc === null) setTimeout(() => { if (answered && el.classList.contains('on')) newNote(); }, 1400);
}

function giveUp() {
  if (!mystery || answered || busy) return;
  if (!misses.length) { sess.n++; streak = 0; logNote(mystery.pc, -1, performance.now() - t0, false); }
  answered = true; last = mystery;
  A.stopAll();
  A.playNote(mystery.midi, { dur: 2, timbre: mystery.timbre, source: 'mystery' }); // no colour for a give-up
  fb(`It was <b>${T.midiName(mystery.midi)}</b>. No colour this time: find it next round.`, 'bad');
  paint(null, misses, mystery.pc);
}

function paint(correct = null, wrong = [], shown = null) {
  const allowed = new Set(pool());
  const items = [...Array(12).keys()].map(pc => {
    const p = data.per[pc];
    return {
      k: pc, label: T.noteName(pc), color: pc === correct ? C.noteColor(pc) : PLAIN, disabled: !allowed.has(pc), // plain until answered: no colour-matching shortcut
      sub: p && p.n ? pct(p.ok, p.n) : '',
      cls: `${pc === correct ? 'correct' : ''} ${wrong.includes(pc) ? 'wrong' : ''} ${pc === shown ? 'shown' : ''}`,
      slot: C.wheelPos(pc),
    };
  });
  let center = `<div class="ear-big">${pct(sess.ok, sess.n)}</div><div class="ear-small">${sess.ok}/${sess.n} · streak ${streak}</div>`;
  if (data.opts.pool === 'adaptive') {
    const lp = levelProgress();
    center += `<div class="ear-small">${data.level}/12 notes${data.level < 12 ? ` · next: ${T.noteName(UNLOCK_ORDER[data.level])}<br>${lp.answered}/20 at ${Math.round(lp.acc * 100)}% (need 90%)` : ''}</div>`;
  }
  el.querySelector('.ring-slot').innerHTML = ring(items, center);
}

function controls() {
  const o = data.opts;
  el.querySelector('.ear-controls').innerHTML = `
    <div class="row">${seg('pool', [['adaptive', 'Grow (adaptive)'], ['naturals', 'White keys'], ['chromatic', 'All 12']], o.pool)}</div>
    <details class="more"><summary>Options</summary>
      <div class="row">${seg('range', [['4', 'Octave 4'], ['3-5', '3–5'], ['2-6', '2–6']], o.range)}</div>
      <div class="row">${seg('timbre', [['guitar', 'Guitar'], ['piano', 'Piano'], ['sine', 'Pure'], ['mix', 'Mix']], o.timbre)}</div>
      <div class="row">${seg('noise', [['true', 'Noise between notes'], ['false', 'No noise']], o.noise)}</div>
      <p class="dim small">Noise wipes the last note from memory so you name each one on its own, not relative to the previous. The screen stays dark until you find the note; a miss lets you try again, but only your first guess is scored.</p>
    </details>
    <div class="row">
      <button class="btn primary" data-act="new">▶ New note</button>
      <button class="btn" data-act="again">↻ Again</button>
      <button class="btn ghost" data-act="giveup">Show answer</button>
      <button class="btn ghost" data-act="hearall">Hear my notes</button>
    </div>`;
}

export default {
  id: 'notes', label: 'Notes',
  mount(root) {
    el = root;
    el.innerHTML = `<div class="ear-controls"></div><div class="ring-slot ear-ring-wrap"></div><div class="ear-fb">Tap ▶ New note. Answer fast: real pitch memory is instant.</div>`;
    el.addEventListener('click', e => {
      const b = e.target.closest('.ear-btn'); if (b) return guess(+b.dataset.k);
      const sc = e.target.closest('.seg-ctl[data-name] button');
      if (sc) {
        const name = sc.closest('.seg-ctl').dataset.name, v = sc.dataset.v;
        data.opts[name] = v === 'true' ? true : v === 'false' ? false : v;
        save(); mystery = null; controls(); paint();
        if (name === 'pool' || name === 'range') el.querySelector('details.more')?.setAttribute('open', '');
        return;
      }
      const act = e.target.closest('[data-act]')?.dataset.act;
      if (act === 'new') newNote();
      if (act === 'again' && mystery && !busy) playMystery();
      if (act === 'giveup') giveUp();
      if (act === 'hearall') pool().forEach((pc, i) => A.playNote(60 + pc, { at: i * 0.6, dur: 1, timbre: data.opts.timbre === 'mix' ? 'guitar' : data.opts.timbre }));
    });
    controls(); paint();
  },
  show() { controls(); paint(); },
};
