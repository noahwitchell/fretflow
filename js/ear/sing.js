// Sing: recall a note from memory with no reference, sing it, see how many cents off you are.
// This directly measures your internal anchors, and the Progress tab tracks them tightening.
import * as T from '../theory.js';
import * as C from '../color.js';
import * as A from '../audio.js';
import { data, save, logSing, unlocked } from './log.js';
import { startMic, stopMic, micActive, centsFromPc, freqToMidi, getMicStream } from './pitch.js';
import { micSession } from '../audio.js';
import { seg } from './ui.js';

let el, target = null, mode = 'idle', samples = [], lastF = null, lastWash = 0;

function fb(msg, cls = '') { const f = el.querySelector('.ear-fb'); f.innerHTML = msg; f.className = `ear-fb ${cls}`; }

function pickTarget() {
  const pl = data.opts.singPool === 'adaptive' ? unlocked() : [...Array(12).keys()];
  let pc; do { pc = pl[Math.floor(Math.random() * pl.length)]; } while (pl.length > 1 && pc === target);
  target = pc; mode = 'ready'; samples = [];
  paint();
  const anchor = data.anchors[pc];
  fb(`Sing or hum <b>${T.noteName(pc)}</b> from memory, any octave.${anchor ? `<br><span class="dim">Anchor: ${anchor}</span>` : ''}`);
}

// ---- microphone permission ---------------------------------------------------
let micState = 'unknown'; // 'granted' | 'prompt' | 'denied' | 'error' | 'unsupported' | 'unknown'
let micErr = '';
const classify = err => { micErr = `${err.name}${err.message ? ': ' + err.message : ''}`; return err.name === 'NotAllowedError' || err.name === 'SecurityError' ? 'denied' : 'error'; };

async function checkMic() {
  if (!navigator.mediaDevices?.getUserMedia) { micState = 'unsupported'; return paintMic(); }
  try {
    const p = await navigator.permissions.query({ name: 'microphone' });
    micState = p.state;
    p.onchange = () => { micState = p.state; paintMic(); };
  } catch { /* older Safari can't report it; we'll find out when asking */ }
  paintMic();
}

// Asking for the stream is what makes the phone show its permission prompt.
async function askMic() {
  try {
    const s = await getMicStream();
    s.getTracks().forEach(t => t.stop());
    micSession(false);
    micState = 'granted';
    fb('Microphone on. Tap 🎤 Sing it when you have a note.', 'good');
  } catch (err) {
    micState = classify(err);
  }
  paintMic();
  return micState === 'granted';
}

function unblockSteps() {
  const ua = navigator.userAgent;
  const ios = /iPhone|iPad|iPod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const android = /Android/.test(ua);
  const app = window.matchMedia('(display-mode: standalone)').matches || navigator.standalone;
  if (ios) return `<ol>
      <li>Open the iPhone <b>Settings</b> app → <b>Apps</b> → <b>Safari</b>.</li>
      <li>Scroll to <b>Settings for Websites</b> → <b>Microphone</b> → choose <b>Ask</b> (or Allow).</li>
      <li>Check <b>Settings → Screen Time → Content &amp; Privacy Restrictions → Microphone</b> isn't set to Don't Allow.</li>
      <li>${app ? 'Swipe FretFlow away in the app switcher, reopen it' : 'Reload this page'}, then tap <b>Try again</b> below and choose Allow.</li>
    </ol><p class="dim small">On iOS 17 or older, Microphone is under Settings → Safari directly.</p>`;
  if (android) return `<ol>
      <li>${app ? 'Long-press the FretFlow icon → <b>App info</b> → <b>Permissions</b>' : 'Tap the icon left of the address bar → <b>Permissions</b>'} → <b>Microphone</b> → <b>Allow</b>.</li>
      <li>Come back and tap <b>Try again</b>.</li></ol>`;
  return `<ol><li>Click the icon at the left of the address bar → <b>Microphone</b> → <b>Allow</b>.</li><li>Click <b>Try again</b>.</li></ol>`;
}

function paintMic() {
  const box = el.querySelector('.mic-box');
  if (!box) return;
  if (micState === 'granted') { box.innerHTML = '<span class="mic-ok">🎤 Microphone on</span>'; return; }
  if (micState === 'denied') {
    box.innerHTML = `<div class="mic-warn"><b>🎤 Microphone is blocked</b>
      <p class="dim small">Websites can't open Settings for you, so here's where the switch is:</p>${unblockSteps()}${micErr ? `<p class="dim small">(${micErr})</p>` : ''}
      <button class="btn primary" data-act="allow">Try again</button></div>`;
    return;
  }
  if (micState === 'error') {
    box.innerHTML = `<div class="mic-warn"><b>🎤 The microphone didn't start</b>
      <p class="dim small">The phone said: <code>${micErr}</code></p>
      <ol><li>Swipe FretFlow away in the app switcher and reopen it.</li><li>Make sure no other app (a call, voice memo, music app recording) is using the mic.</li><li>Tap <b>Try again</b>.</li></ol>
      <button class="btn primary" data-act="allow">Try again</button></div>`;
    return;
  }
  if (micState === 'unsupported') {
    box.innerHTML = `<div class="mic-warn"><b>🎤 No microphone available here</b><p class="dim small">This browser has no microphone access at all. Open FretFlow in Safari (iPhone) or Chrome, over https.</p></div>`;
    return;
  }
  box.innerHTML = `<div class="mic-ask"><span>Sing mode listens through your microphone. Nothing is recorded or sent anywhere.</span>
    <button class="btn primary" data-act="allow">🎤 Allow microphone</button></div>`;
}

async function listen(free = false) {
  try {
    if (!micActive()) await startMic(onPitch);
    micState = 'granted'; paintMic();
  } catch (err) {
    micState = classify(err);
    paintMic();
    fb('The microphone is blocked: see the steps above.', 'bad');
    return;
  }
  mode = free ? 'free' : 'listening'; samples = [];
  if (!free) fb('Listening… hold the note steady.');
  else fb('Live: sing anything and watch its note and colour.');
  paint();
}

function stop() { stopMic(); if (mode !== 'done') mode = target != null ? 'ready' : 'idle'; paint(); }

function onPitch(f) {
  lastF = f;
  meter(f);
  if (!f) return;
  const now = performance.now();
  if (now - lastWash > 180) { lastWash = now; C.wash(C.noteWash(Math.round(freqToMidi(f))), false); }
  if (mode !== 'listening') return;
  const c = centsFromPc(f, target);
  samples.push(c);
  // lock in once we have ~0.8 s of steady pitch
  if (samples.length >= 24) {
    const tail = samples.slice(-24).sort((a, b) => a - b);
    const med = tail[12];
    if (tail[20] - tail[3] < 60) finish(med, f);
  }
}

function finish(cents, f) {
  mode = 'done'; stopMic();
  logSing(target, cents);
  const abs = Math.abs(cents);
  const verdict = abs <= 25 ? ['Spot on', 'good'] : abs <= 60 ? ['Close', 'good'] : abs <= 150 ? ['About a semitone off', 'bad'] : ['Off', 'bad'];
  fb(`${verdict[0]}: <b>${cents > 0 ? '+' : ''}${Math.round(cents)} cents</b> ${cents > 0 ? '(sharp)' : cents < 0 ? '(flat)' : ''}<br><span class="dim">Here's the real ${T.noteName(target)}…</span>`, verdict[1]);
  // play the real note in the octave you sang
  const sung = freqToMidi(f);
  const real = Math.round(sung - cents / 100);
  A.playNote(real, { at: 0.3, dur: 2.2 });
  paint();
}

function meter(f) {
  const m = el.querySelector('.meter');
  if (!m) return;
  if (!f) { m.querySelector('.m-note').textContent = '–'; return; }
  const midi = freqToMidi(f), near = Math.round(midi);
  m.querySelector('.m-note').textContent = T.midiName(near);
  m.querySelector('.m-note').style.color = C.midiColor(near);
  const cents = mode === 'free' || target == null ? (midi - near) * 100 : centsFromPc(f, target);
  const clamp = Math.max(-300, Math.min(300, cents));
  m.querySelector('.needle').style.left = `${50 + (clamp / 300) * 50}%`;
  m.querySelector('.m-cents').textContent = `${cents > 0 ? '+' : ''}${Math.round(cents)}¢${mode === 'free' ? '' : target != null ? ` from ${T.noteName(target)}` : ''}`;
}

function paint() {
  const o = data.opts;
  const recent = data.sing.slice(-10);
  const avg = recent.length ? Math.round(recent.reduce((s, r) => s + Math.abs(r.cents), 0) / recent.length) : null;
  el.querySelector('.ear-controls').innerHTML = `
    <div class="row">${seg('singPool', [['adaptive', 'My unlocked notes'], ['all', 'All 12']], o.singPool)}</div>
    <div class="row">
      <button class="btn primary" data-act="target">${target == null ? '▶ Give me a note' : '▶ Next note'}</button>
      ${target != null && mode !== 'listening' ? '<button class="btn" data-act="listen">🎤 Sing it</button>' : ''}
      ${micActive() ? '<button class="btn" data-act="stop">■ Stop mic</button>' : '<button class="btn ghost" data-act="free">Live tuner</button>'}
    </div>`;
  el.querySelector('.sing-stage').innerHTML = `
    <div class="target" style="--c:${target != null ? C.noteColor(target) : 'var(--line)'}">${target != null ? T.noteName(target) : '?'}</div>
    <div class="meter"><div class="m-note">–</div><div class="bar"><span class="mid"></span><span class="needle"></span></div><div class="m-cents"></div></div>
    <div class="dim small">${avg != null ? `Last ${recent.length}: average ${avg}¢ off. Under 50¢ means your inner note is within a quarter-tone.` : 'No sung notes yet. Do this first thing, before you hear any music: that tests your memory, not your last song.'}</div>`;
  meter(lastF);
}

export default {
  id: 'sing', label: 'Sing',
  mount(root) {
    el = root;
    el.innerHTML = `<div class="mic-box"></div><div class="ear-controls"></div><div class="sing-stage"></div><div class="ear-fb">Recall a note with no reference, sing it, and see how close your inner pitch is.</div>`;
    el.addEventListener('click', e => {
      const sc = e.target.closest('.seg-ctl[data-name] button');
      if (sc) { data.opts.singPool = sc.dataset.v; save(); paint(); return; }
      const act = e.target.closest('[data-act]')?.dataset.act;
      if (act === 'target') { if (micActive()) stopMic(); pickTarget(); }
      if (act === 'allow') askMic();
      if (act === 'listen') listen(false);
      if (act === 'free') listen(true);
      if (act === 'stop') stop();
    });
    paint();
  },
  show() { paint(); checkMic(); },
  hide() { if (micActive()) stop(); },
};
