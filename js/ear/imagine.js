// Imagine: hear a note in your head first, then tap to check. Plus your anchor library.
import * as T from '../theory.js';
import * as C from '../color.js';
import * as A from '../audio.js';
import { data, save } from './log.js';
import { ring, PLAIN } from './ui.js';

let el, oct = 4, prompt = null, hideNames = false, lit = null;

function fb(msg, cls = '') { const f = el.querySelector('.ear-fb'); f.innerHTML = msg; f.className = `ear-fb ${cls}`; }

function paint() {
  const items = [...Array(12).keys()].map(pc => ({
    k: pc, label: hideNames ? '?' : T.noteName(pc), color: pc === lit ? C.noteColor(pc, oct) : PLAIN, slot: C.wheelPos(pc),
    cls: pc === prompt ? 'correct' : '',
  }));
  el.querySelector('.ring-slot').innerHTML = ring(items, `<div class="ear-big">Oct ${oct}</div><div class="ear-small">imagine, then tap</div>`);
}

function anchorsList() {
  el.querySelector('.anchors').innerHTML = `<h4>Anchor library</h4>
    <p class="dim small">Tie each note to a sound you already know by heart: an open string, a riff, a song's first note. Your anchor shows up when you miss that note.</p>
    ${[...Array(12).keys()].map(pc => `<label class="anchor-row"><i style="background:${C.noteColor(pc)}"></i><b>${T.noteName(pc)}</b>
      <input data-pc="${pc}" value="${(data.anchors[pc] || '').replace(/"/g, '&quot;')}" placeholder="e.g. first note of a song you know">
      <button class="btn small ghost" data-hear="${pc}">▶</button></label>`).join('')}`;
}

export default {
  id: 'imagine', label: 'Imagine',
  mount(root) {
    el = root;
    el.innerHTML = `<div class="ear-controls"><div class="row">
        <button class="btn primary" data-act="prompt">▶ Prompt me</button>
        <button class="btn" data-act="dn">◀ Lower</button><button class="btn" data-act="up">Higher ▶</button>
        <label class="chk"><input type="checkbox" id="imHide"> Hide names</label></div></div>
      <div class="ring-slot ear-ring-wrap"></div>
      <div class="ear-fb">Pick a note, hear it in your head, then tap to check.</div>
      <div class="anchors"></div>`;
    el.addEventListener('click', e => {
      const b = e.target.closest('.ear-btn');
      if (b) {
        const pc = +b.dataset.k;
        A.playNote((oct + 1) * 12 + pc, { dur: 2.4 });
        fb(`${T.noteName(pc)}${oct} · ${C.colorName(pc)}${data.anchors[pc] ? ` · <span class="dim">${data.anchors[pc]}</span>` : ''}`);
        if (pc === prompt) prompt = null;
        lit = pc; // its colour shows only after you've heard it
        paint(); return;
      }
      const h = e.target.closest('[data-hear]');
      if (h) { e.preventDefault(); return A.playNote(60 + +h.dataset.hear, { dur: 2 }); }
      const act = e.target.closest('[data-act]')?.dataset.act;
      if (act === 'dn') { oct = Math.max(2, oct - 1); paint(); }
      if (act === 'up') { oct = Math.min(6, oct + 1); paint(); }
      if (act === 'prompt') {
        prompt = Math.floor(Math.random() * 12); lit = null;
        const a = data.anchors[prompt];
        fb(`Imagine <b>${T.noteName(prompt)}</b>${a ? ` <span class="dim">(${a})</span>` : ''}. Hum it, then tap it to check.`);
        paint();
      }
    });
    el.addEventListener('change', e => {
      if (e.target.id === 'imHide') { hideNames = e.target.checked; paint(); }
    });
    el.addEventListener('input', e => {
      const pc = e.target.dataset?.pc;
      if (pc != null) { data.anchors[pc] = e.target.value; save(); }
    });
    paint(); anchorsList();
  },
  show() { paint(); anchorsList(); },
};
