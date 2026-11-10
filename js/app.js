import { state, set, on } from './store.js';
import * as T from './theory.js';
import * as A from './audio.js';
import * as C from './color.js';
import { selectChord, playChord, addToProg, removeFromProg, clearProg, playProg, stopProg, isPlaying, playMidi } from './actions.js';
import clock from './views/clock.js';
import wheel from './views/wheel.js';
import moves from './views/moves.js';
import ear from './views/ear.js';

const VIEWS = [
  { v: clock, label: 'Clock' },
  { v: wheel, label: 'Wheel' },
  { v: moves, label: 'Moves' },
  { v: ear, label: 'Ear' },
];
const $ = s => document.querySelector(s);
if (!VIEWS.some(x => x.v.id === state.view)) state.view = 'clock';

C.setColorMap(state.colorMap);

// ---- colour wash -----------------------------------------------------------
A.onNote((midi, source) => {
  if (state.colorMode === 'off') return;
  if (source === 'mystery') return; // hidden quiz note ('mystery-show' still washes)
  C.wash(C.noteWash(midi), state.colorMode === 'hold');
});
on('chordSound', c => {
  if (state.colorMode === 'off') return;
  C.wash(C.chordWash(T.chordPcs(c)), state.colorMode === 'hold');
});

// ---- views -----------------------------------------------------------------
const main = $('main');
VIEWS.forEach(({ v }) => {
  const sec = document.createElement('section');
  sec.className = 'view'; sec.id = `view-${v.id}`;
  main.appendChild(sec);
  v.mount(sec);
});
$('.tabs').innerHTML = VIEWS.map(({ v, label }) => `<button data-view="${v.id}">${label}</button>`).join('');
$('.tabs').addEventListener('click', e => {
  const b = e.target.closest('[data-view]');
  if (b) set({ view: b.dataset.view });
});

function showView() {
  VIEWS.forEach(({ v }) => {
    const on = v.id === state.view;
    const sec = $(`#view-${v.id}`);
    if (!on && sec.classList.contains('active')) v.leave?.();
    sec.classList.toggle('active', on);
    if (on) v.render();
  });
  document.querySelectorAll('.tabs button').forEach(b => b.classList.toggle('on', b.dataset.view === state.view));
  document.body.classList.toggle('ear-mode', state.view === 'ear');
  document.body.classList.toggle('moves-mode', state.view === 'moves');
  maybeHelp();
}

// ---- help: a short "what is this for / try this" card per tab ------------------
const HELP = {
  clock: { t: 'Clock: build a chord', b: `
    <p>The 12 notes in a circle. A chord is just a few of them played together.</p>
    <ol><li>Tap <b>Clear notes</b>.</li><li>Tap <b>C</b>, then <b>E</b>, then <b>G</b>. Each note plays alone; the shape grows; the name appears (C major).</li>
    <li>Tap the middle to hear them together.</li><li>Now tap <b>E</b> again to remove it and tap <b>D♯</b>: one note moved a half step and it's C minor.</li></ol>
    <p class="tip">The first note you tap is the root (the lowest note). Same notes from a different first note = a different name.</p>` },
  wheel: { t: 'Wheel: keys and their chord families', b: `
    <p>A <b>key</b> is a set of 7 notes that sound good together. The 7 chords built from those notes are the key's family. They're the lit wedge at the top, and the strip below the wheel.</p>
    <ol><li>Tap the family chords below the wheel left to right. Watch which of the 7 notes light up: each chord uses every other note.</li>
    <li>Try the pop progression: <b>I → V → vi → IV</b> (C, G, Am, F). Tap each, then <b>+ Add</b>, then ▶ at the bottom.</li>
    <li><b>Drag the wheel</b> one click. A banner tells you exactly which single note changed: neighbouring keys differ by one note, which is why they sound related.</li></ol>
    <p class="tip">Outside ring = major chords, middle = minor, centre = diminished. Gold outlines = chords sharing 2 notes with the one you tapped.</p>` },
  moves: { t: 'Moves: how one chord leads to the next', b: `
    <p>Chords feel related when they share notes. Every card is a next chord, showing which notes <b>stay</b> and which <b>move</b> (● = notes kept).</p>
    <ol><li>From C, tap <b>Relative minor</b>: C and E stay, G slides up to A. Hear it slide, see the shape move.</li>
    <li>Keep tapping cards and you're writing a progression. Your path builds up at the top.</li>
    <li>Tap <b>Use as progression</b>, then ▶ at the bottom to play it back.</li></ol>
    <p class="tip">Fewer moving notes = smoother. "Up a fifth" then back "Down a fifth" is the strongest there-and-home move in music.</p>` },
  ear: { t: 'Ear: train your pitch', b: `
    <p><b>Notes</b>: name the note you hear (starts with 3, adds more at 90%). <b>Degrees</b>: hear a key, name the note's place in it. <b>Sing</b>: sing a note from memory and see how close you are. <b>Imagine</b>: hear it in your head, then check. <b>Progress</b>: your stats.</p>
    <p class="tip">10 minutes a day beats an hour once a week. Do a Sing check first thing, before any music.</p>` },
};
let seenHelp = {};
try { seenHelp = JSON.parse(localStorage.getItem('fretflow.help') || '{}'); } catch {}
function showHelp(id = state.view) {
  const h = HELP[id]; if (!h) return;
  $('#help .sheet-body').innerHTML = `<h2>${h.t}</h2>${h.b}<button class="btn wide primary" data-close>Got it</button>`;
  $('#help').classList.remove('hidden');
  seenHelp[id] = 1; try { localStorage.setItem('fretflow.help', JSON.stringify(seenHelp)); } catch {}
}
function maybeHelp() { if (!seenHelp[state.view]) setTimeout(() => showHelp(), 250); }
$('#helpBtn').addEventListener('click', () => showHelp());
$('#help').addEventListener('click', e => { if (e.target.id === 'help' || e.target.closest('[data-close]')) $('#help').classList.add('hidden'); });

// ---- header + settings sheet ------------------------------------------------
function renderHeader() {
  $('#keyBtn').innerHTML = `<span class="kdot" style="background:${C.noteColor(state.key.tonic)}"></span>${T.keyName(state.key)} ▾`;
  $('#keyglow').style.background = C.keyGlow(T.scalePcs(state.key));
  $('#sevBtn').classList.toggle('on', state.sevenths);
}
$('#keyBtn').addEventListener('click', () => { renderSheet(); $('#sheet').classList.remove('hidden'); });
$('#sevBtn').addEventListener('click', () => set({ sevenths: !state.sevenths }));
$('#sheet').addEventListener('click', e => {
  if (e.target.id === 'sheet' || e.target.closest('[data-close]')) return $('#sheet').classList.add('hidden');
  const b = e.target.closest('[data-set]');
  if (!b) return;
  const [k, raw] = b.dataset.set.split('=');
  const v = isNaN(+raw) ? raw : +raw;
  if (k === 'colorMap') C.setColorMap(v);
  if (k === 'tonic') set({ key: { ...state.key, tonic: v } });
  else if (k === 'mode') set({ key: { ...state.key, mode: v } });
  else set({ [k]: v });
  if (k === 'colorMode' && v === 'off') C.clearWash();
  renderSheet();
});
function renderSheet() {
  const flats = T.usesFlats(state.key);
  const opt = (k, v, label, cur) => `<button data-set="${k}=${v}" class="${cur === v ? 'on' : ''}">${label}</button>`;
  $('#sheet .sheet-body').innerHTML = `
    <h3>Key</h3>
    <div class="grid12">${[...Array(12).keys()].map(pc => `<button data-set="tonic=${pc}" class="${pc === state.key.tonic ? 'on' : ''}" style="--c:${C.noteColor(pc)}">${T.noteName(pc, flats)}</button>`).join('')}</div>
    <div class="seg-ctl">${opt('mode', 'major', 'Major', state.key.mode)}${opt('mode', 'minor', 'Minor', state.key.mode)}</div>
    <div class="palette">${T.scalePcs(state.key).slice().sort((a, b) => C.wheelPos(a) - C.wheelPos(b)).map(pc => `<span style="background:${C.noteColor(pc)}">${T.noteName(pc, flats)}</span>`).join('')}</div>
    <p class="sub">Key palette, in colour-wheel order: <b>${C.schemeFor(T.scalePcs(state.key)).name.toLowerCase()}</b>${state.colorMap === 'fifths' ? ' (a key is always one unbroken sweep of the wheel)' : ' (try "By fifths" to see the key as one unbroken sweep)'}.</p>
    <h3>Labels</h3>
    <div class="seg-ctl">${opt('labels', 'note', 'Note names', state.labels)}${opt('labels', 'degree', 'Degrees (1 ♭3 5)', state.labels)}</div>
    <h3>Colour</h3>
    <div class="seg-ctl">${opt('colorMode', 'flash', 'Flash', state.colorMode)}${opt('colorMode', 'hold', 'Hold', state.colorMode)}${opt('colorMode', 'off', 'Off', state.colorMode)}</div>
    <div class="seg-ctl">${opt('colorMap', 'chromatic', 'Chromatic (C red → B rose)', state.colorMap)}${opt('colorMap', 'fifths', 'By fifths (related = similar)', state.colorMap)}</div>
    <div class="strip">${[...Array(12).keys()].map(pc => `<span style="background:${C.noteColor(pc)}">${T.noteName(pc, flats)}</span>`).join('')}</div>
    <h3>Tapping a chord plays</h3>
    <div class="seg-ctl">${opt('tapSound', 'both', 'Notes, then chord', state.tapSound)}${opt('tapSound', 'arp', 'Notes one by one', state.tapSound)}${opt('tapSound', 'strum', 'Whole chord', state.tapSound)}</div>
    <h3>Progression</h3>
    <div class="seg-ctl">${[70, 90, 110, 130].map(t => opt('tempo', t, `${t} bpm`, state.tempo)).join('')}</div>
    <div class="seg-ctl">${opt('loop', true, 'Loop', state.loop)}${opt('loop', false, 'Play once', state.loop)}</div>
    <button class="btn wide" data-close>Done</button>`;
}

// ---- inspector ------------------------------------------------------------------
function renderInspector() {
  const c = state.chord, key = state.key, flats = T.usesFlats(key), t = T.CHORD_TYPES[c.type];
  const dia = T.isDiatonic(c, key);
  const scheme = C.schemeFor(T.chordPcs(c));
  const midis = T.voice(c).notes;
  const pills = t.iv.map((iv, i) => {
    const pc = T.mod12(c.root + iv);
    return `<button class="pill" data-midi="${midis[i] ?? 60 + pc}" style="--c:${C.noteColor(pc)}"><b>${T.noteName(pc, flats)}</b><small>${t.deg[i]}</small></button>`;
  }).join('');
  const canKey = c.type === 'maj' || c.type === 'min';
  const isKey = canKey && c.root === key.tonic && (c.type === 'maj') === (key.mode === 'major');
  $('#inspector').innerHTML = `
    <div class="insp-top">
      <div class="cname" style="--g:${C.chordGradient(T.chordPcs(c))}">${T.chordName(c, flats)}</div>
      <div class="cmeta"><div><b>${t.name}</b> · <span class="roman ${dia ? '' : 'out'}">${T.romanFor(c, key)} ${dia ? `in ${T.keyName(key)}` : 'outside the key'}</span>
        ${canKey && !isKey ? `<button class="linkbtn" data-makekey>make key</button>` : ''}</div>
        <div class="feel">${t.feel}</div>
        <div class="scheme"><span class="sw">${[...new Set(T.chordPcs(c))].map(pc => `<i style="background:${C.noteColor(pc)}"></i>`).join('')}</span><b>${scheme.name}</b> · ${scheme.blurb}</div></div>
    </div>
    <div class="row2">
      <div class="pills">${pills}</div>
      <div class="acts">
        <button class="btn icon" data-play="tap" title="Play">▶</button>
        <button class="btn primary icon" data-add title="Add to progression">+ Add</button>
      </div>
    </div>
    <div class="types">${T.TYPE_ROWS.flat().map(k => `<button data-type="${k}" class="${k === c.type ? 'on' : ''}">${T.noteName(c.root, flats)}${T.CHORD_TYPES[k].sym || ''}</button>`).join('')}</div>`;
}
$('#inspector').addEventListener('click', e => {
  const c = state.chord;
  const p = e.target.closest('.pill'); if (p) return playMidi(+p.dataset.midi);
  const pl = e.target.closest('[data-play]'); if (pl) { A.stopAll(); return playChord(c, pl.dataset.play === 'tap' ? state.tapSound : pl.dataset.play); }
  if (e.target.closest('[data-add]')) return addToProg(c);
  if (e.target.closest('[data-makekey]')) return set({ key: { tonic: c.root, mode: c.type === 'maj' ? 'major' : 'minor' } });
  const ty = e.target.closest('[data-type]'); if (ty) selectChord({ root: c.root, type: ty.dataset.type });
});

// ---- progression tray -----------------------------------------------------------
let playheadIdx = -1;
function renderTray() {
  const flats = T.usesFlats(state.key);
  const chips = state.prog.map((c, i) => `
    <div class="chip ${i === playheadIdx ? 'beat' : ''}" data-i="${i}" style="--g:${C.chordGradient(T.chordPcs(c), 0.55)}">
      <b>${T.chordName(c, flats)}</b><small>${T.romanFor(c, state.key)}</small><span class="x" data-x="${i}">×</span></div>`).join('');
  $('#tray').innerHTML = `
    <button class="btn round ${isPlaying() ? 'on' : ''}" data-prog="play">${isPlaying() ? '■' : '▶'}</button>
    <div class="chips">${chips || '<span class="empty">Tap chords, then <b>+ Add</b> to build a progression</span>'}</div>
    ${state.prog.length ? '<button class="btn ghost" data-prog="clear">Clear</button>' : ''}`;
}
$('#tray').addEventListener('click', e => {
  const x = e.target.closest('[data-x]'); if (x) return removeFromProg(+x.dataset.x);
  const ch = e.target.closest('.chip'); if (ch) return selectChord(state.prog[+ch.dataset.i]);
  const b = e.target.closest('[data-prog]'); if (!b) return;
  if (b.dataset.prog === 'play') { isPlaying() ? stopProg() : playProg(); renderTray(); }
  if (b.dataset.prog === 'clear') clearProg();
});
on('playhead', i => { playheadIdx = i; renderTray(); });

// ---- wiring ---------------------------------------------------------------------
function renderAll() { renderHeader(); renderInspector(); renderTray(); showView(); }
on('change', patch => {
  if ('view' in patch) return showView();
  if ('ear' in patch) return;
  renderAll();
});
renderAll();

// Keep sound alive on iPhone: unlock on touch, and revive after the screen locks/unlocks.
window.addEventListener('pointerdown', () => { A.audio(); A.revive(); }, { capture: true });
document.addEventListener('visibilitychange', () => { if (!document.hidden) A.revive(); });
window.addEventListener('pageshow', () => A.revive());
window.addEventListener('focus', () => A.revive());

// No zooming from quick double taps or pinches: this is an instrument, not a page.
document.addEventListener('gesturestart', e => e.preventDefault());
document.addEventListener('dblclick', e => e.preventDefault(), { passive: false });
// (double-tap zoom itself is switched off by touch-action: manipulation in the CSS)

if ('serviceWorker' in navigator && location.protocol === 'https:') navigator.serviceWorker.register('sw.js');
