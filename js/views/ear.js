// Ear lab. Quiz: hear a mystery note, name it. Imagine: hear it in your head first, then tap to check.
import { state, set } from '../store.js';
import * as T from '../theory.js';
import * as C from '../color.js';
import { playMidi } from '../actions.js';

let el, mode = 'quiz', mystery = null, answered = false, streak = 0, session = { n: 0, ok: 0 }, imagineOct = 4;

const RANGES = { '4': [4, 4], '3-5': [3, 5], '2-6': [2, 6] };
const NATURALS = [0, 2, 4, 5, 7, 9, 11];
const pool = () => (state.ear.pool === 'naturals' ? NATURALS : [...Array(12).keys()]);

function newNote() {
  const [lo, hi] = RANGES[state.ear.range];
  let m;
  do {
    const pc = pool()[Math.floor(Math.random() * pool().length)];
    const oct = lo + Math.floor(Math.random() * (hi - lo + 1));
    m = (oct + 1) * 12 + pc;
  } while (mystery !== null && m === mystery && pool().length > 1);
  mystery = m; answered = false;
  playMidi(m, { source: 'mystery', dur: 2.4 });
  feedback('Which note was that?', '');
  paint();
}

function guess(pc) {
  if (mode === 'imagine') {
    const m = (imagineOct + 1) * 12 + pc;
    playMidi(m, { dur: 2.4 });
    feedback(`${T.midiName(m)} · ${C.colorName(pc)}`, '');
    return;
  }
  if (mystery === null) return newNote();
  if (answered) return playMidi(60 + pc);
  const want = T.mod12(mystery), ok = pc === want;
  answered = true;
  session.n++; if (ok) session.ok++;
  streak = ok ? streak + 1 : 0;
  const stats = structuredClone(state.ear.stats);
  const s = stats[want] || { n: 0, ok: 0 }; s.n++; if (ok) s.ok++; stats[want] = s;
  set({ ear: { ...state.ear, stats } });
  playMidi(mystery, { dur: 2.2 }); // replay with colour now revealed
  feedback(ok ? `✓ ${T.midiName(mystery)}` : `✗ It was ${T.midiName(mystery)} (you said ${T.noteName(pc)})`, ok ? 'good' : 'bad');
  paint(want, ok ? null : pc);
  if (ok) setTimeout(() => { if (answered && mode === 'quiz') newNote(); }, 1300);
}

function feedback(msg, cls) {
  const f = el.querySelector('.ear-fb');
  f.textContent = msg; f.className = `ear-fb ${cls}`;
}

function paint(correct = null, wrong = null) {
  const ring = el.querySelector('.ear-ring');
  const allowed = new Set(pool());
  const hideLabels = mode === 'imagine' && el.querySelector('#earHide')?.checked;
  ring.innerHTML = [...Array(12).keys()].map(pc => {
    const a = (pc / 12) * Math.PI * 2;
    const x = 50 + 40 * Math.sin(a), y = 50 - 40 * Math.cos(a);
    const st = state.ear.stats[pc];
    const pct = st && st.n ? Math.round((st.ok / st.n) * 100) + '%' : '';
    const dis = mode === 'quiz' && !allowed.has(pc);
    return `<button class="ear-btn ${pc === correct ? 'correct' : ''} ${pc === wrong ? 'wrong' : ''}" data-pc="${pc}" ${dis ? 'disabled' : ''}
      style="left:${x}%;top:${y}%;--c:${C.noteColor(pc, 4)}"><span>${hideLabels ? '?' : T.noteName(pc)}</span>${mode === 'quiz' ? `<small>${pct}</small>` : ''}</button>`;
  }).join('') + `<div class="ear-center">${mode === 'quiz'
    ? `<div class="ear-big">${session.n ? Math.round((session.ok / session.n) * 100) + '%' : '–'}</div><div class="ear-small">${session.ok}/${session.n} · streak ${streak}</div>`
    : `<div class="ear-big">Oct ${imagineOct}</div><div class="ear-small">imagine, then tap</div>`}</div>`;
}

function controls() {
  const e = state.ear;
  const seg = (name, opts, cur) => `<div class="seg-ctl" data-name="${name}">${opts.map(([v, l]) => `<button class="${v === cur ? 'on' : ''}" data-v="${v}">${l}</button>`).join('')}</div>`;
  el.querySelector('.ear-controls').innerHTML = mode === 'quiz' ? `
    <div class="row">${seg('range', [['4', 'Octave 4'], ['3-5', '3–5'], ['2-6', '2–6']], e.range)}
      ${seg('pool', [['naturals', 'White keys'], ['chromatic', 'All 12']], e.pool)}</div>
    <div class="row">
      <button class="btn primary" data-act="new">▶ New note</button>
      <button class="btn" data-act="again">↻ Again</button>
      <button class="btn ghost" data-act="ref">Hear C4</button>
      <label class="chk"><input type="checkbox" id="earBlind" ${e.blind ? 'checked' : ''}> Hide colour until answered</label>
    </div>` : `
    <div class="row">
      <button class="btn" data-act="octdn">◀ Lower</button>
      <button class="btn" data-act="octup">Higher ▶</button>
      <label class="chk"><input type="checkbox" id="earHide"> Hide note names</label>
    </div>`;
}

export default {
  id: 'ear',
  mount(root) {
    el = root;
    el.innerHTML = `
      <div class="ear-tabs seg-ctl"><button class="on" data-mode="quiz">Quiz</button><button data-mode="imagine">Imagine</button></div>
      <div class="ear-controls"></div>
      <div class="ear-ring-wrap"><div class="ear-ring"></div></div>
      <div class="ear-fb">Tap ▶ New note to start.</div>`;
    el.addEventListener('click', e => {
      const m = e.target.closest('[data-mode]');
      if (m) {
        mode = m.dataset.mode;
        el.querySelectorAll('[data-mode]').forEach(b => b.classList.toggle('on', b === m));
        controls(); paint();
        feedback(mode === 'quiz' ? 'Tap ▶ New note to start.' : 'Pick a note, hear it in your head, then tap to check.', '');
        return;
      }
      const b = e.target.closest('.ear-btn');
      if (b) return guess(+b.dataset.pc);
      const sc = e.target.closest('.seg-ctl[data-name] button');
      if (sc) {
        const name = sc.closest('.seg-ctl').dataset.name;
        set({ ear: { ...state.ear, [name]: sc.dataset.v } });
        mystery = null; controls(); paint(); return;
      }
      const act = e.target.closest('[data-act]')?.dataset.act;
      if (act === 'new') newNote();
      if (act === 'again' && mystery !== null) playMidi(mystery, { source: answered ? 'play' : 'mystery', dur: 2.4 });
      if (act === 'ref') playMidi(60);
      if (act === 'octdn') { imagineOct = Math.max(2, imagineOct - 1); paint(); }
      if (act === 'octup') { imagineOct = Math.min(6, imagineOct + 1); paint(); }
    });
    el.addEventListener('change', e => {
      if (e.target.id === 'earBlind') set({ ear: { ...state.ear, blind: e.target.checked } });
      if (e.target.id === 'earHide') paint();
    });
    controls(); paint();
  },
  render() { /* self-managed */ },
};
