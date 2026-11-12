// Sing: recall a note from memory with no reference, sing it, see how many cents off you are.
// This directly measures your internal anchors, and the Progress tab tracks them tightening.
import * as T from '../theory.js';
import * as C from '../color.js';
import * as A from '../audio.js';
import { data, save, logSing, unlocked } from './log.js';
import { startMic, stopMic, micActive, centsFromPc, freqToMidi, getMicStream } from './pitch.js';
import { micSession } from '../audio.js';
import { seg } from './ui.js';

// One continuous session: the mic stays on, you get a note, you sing and can slide into it.
// Holding within tolerance for ~0.5 s counts as found: colour reward, the real note, next note.
// Your FIRST steady pitch is what gets logged: that's the honest measure of your inner anchor.
let el, target = null, mode = 'idle', phase = 'listen', lastF = null, lastWash = 0;
let frames = [], voiced = 0, first = null, tStart = 0, gateUntil = 0, nextT = 0, sess = { n: 0, firstAbs: 0, firstN: 0 };
const tol = () => +(data.opts.singTol || 30);

function fb(msg, cls = '') { const f = el.querySelector('.ear-fb'); f.innerHTML = msg; f.className = `ear-fb ${cls}`; }

function pickTarget() {
  const pl = data.opts.singPool === 'adaptive' ? unlocked() : [...Array(12).keys()];
  let pc; do { pc = pl[Math.floor(Math.random() * pl.length)]; } while (pl.length > 1 && pc === target);
  return pc;
}

function nextNote() {
  clearTimeout(nextT);
  target = pickTarget();
  frames = []; voiced = 0; first = null; phase = 'listen';
  tStart = performance.now(); gateUntil = tStart + 300;
  const anchor = data.anchors[target];
  fb(`Sing <b>${T.noteName(target)}</b> from memory, any octave. Slide until you lock on.${anchor ? `<br><span class="dim">Anchor: ${anchor}</span>` : ''}`);
  paint();
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
    fb('Microphone on. Tap ▶ Start singing.', 'good');
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

async function ensureMic() {
  try {
    if (!micActive()) await startMic(onPitch, onStatus);
    micState = 'granted'; paintMic();
    return true;
  } catch (err) {
    micState = classify(err); paintMic();
    fb('The microphone is blocked: see the steps above.', 'bad');
    return false;
  }
}

async function startSession() {
  if (!(await ensureMic())) return;
  mode = 'session'; sess = { n: 0, firstAbs: 0, firstN: 0 };
  nextNote();
}
async function startFree() {
  if (!(await ensureMic())) return;
  clearTimeout(nextT);
  mode = 'free'; target = null;
  fb('Live: sing anything and watch its note and colour.');
  paint();
}
function stop() { clearTimeout(nextT); stopMic(); mode = 'idle'; target = null; paint(); fb('Stopped. Tap ▶ Start singing for another round.'); }

// Live input level + plain-language trouble report, so you can see whether the mic hears you.
let quietSince = 0;
function onStatus(st) {
  const box = el.querySelector('.m-diag'), bar = el.querySelector('.lvl span');
  if (!box) return;
  if (st.error) { box.innerHTML = `Mic stopped: <code>${st.error}</code>. Tap ■ Stop, then ▶ Start again.`; box.className = 'm-diag bad'; return; }
  const db = st.level > 0 ? 20 * Math.log10(st.level) : -100;
  if (bar) bar.style.width = `${Math.max(0, Math.min(100, (db + 60) * (100 / 54)))}%`;
  const now = performance.now();
  if (st.level > 0.005) quietSince = now;
  let msg = '', cls = 'm-diag';
  if (st.dead) { msg = `The mic is on but sends only silence (audio ${st.ctx}, mic ${st.track}). Tap ■ Stop, swipe FretFlow away in the app switcher, reopen, and start again. If it keeps happening, tell Claude this line.`; cls += ' bad'; }
  else if (st.track === 'muted') { msg = 'Another app has the microphone (a call, Voice Memos, dictation). Close it and start again.'; cls += ' bad'; }
  else if (now - quietSince > 3000) msg = 'Hearing very little: sing louder or bring the phone closer.';
  if (box.dataset.msg !== msg) { box.dataset.msg = msg; box.innerHTML = msg; box.className = cls; }
}

function refC() {
  if (mode === 'session' && phase === 'listen' && first === null) first = 'hint'; // C before singing = relative pitch, no memory score
  gateUntil = Math.max(gateUntil, performance.now() + 1600);
  A.playNote(60, { dur: 1.4, source: 'mystery' });
  if (mode === 'session' && phase === 'listen') fb(`That's <b>C</b>. Now find ${T.noteName(target)} from it and lock on.`);
}

function median(a) { const s = [...a].sort((x, y) => x - y); return s[s.length >> 1]; }

function onPitch(f) {
  lastF = f;
  meter(f);
  const now = performance.now();
  if (mode === 'free') {
    if (f && now - lastWash > 180) { lastWash = now; C.wash(C.noteWash(Math.round(freqToMidi(f))), false); }
    return;
  }
  if (mode !== 'session' || phase !== 'listen' || now < gateUntil) return;
  if (!f) { voiced = 0; return; }
  voiced++;
  const c = centsFromPc(f, target);
  frames.push(c); frames = frames.slice(-40);

  // first steady pitch (~0.25 s) = what your memory gave you, before any correcting
  if (first === null && voiced >= 8) {
    const last8 = frames.slice(-8);
    if (Math.max(...last8) - Math.min(...last8) < 60) {
      first = median(last8);
      logSing(target, first);
      sess.firstAbs += Math.abs(first); sess.firstN++;
    }
  }
  // found: ~0.5 s held inside the tolerance band
  if (voiced >= 15 && frames.slice(-15).every(x => Math.abs(x) <= tol())) return found(f, median(frames.slice(-15)));

  // coaching while you slide
  if (voiced >= 5) {
    const m = median(frames.slice(-5));
    const hint = Math.abs(m) <= tol() ? 'hold it…' : m < 0 ? `a little flat: go <b>up</b> ↑` : `a little sharp: go <b>down</b> ↓`;
    const firstTxt = typeof first === 'number' ? `<span class="dim">first try ${first > 0 ? '+' : ''}${Math.round(first)}¢ · </span>` : '';
    fb(`${firstTxt}${hint}`, Math.abs(m) <= tol() ? 'good' : '');
  }
}

function found(f, cents) {
  phase = 'reward'; sess.n++;
  const real = Math.round(freqToMidi(f) - cents / 100); // the real note in the octave you sang
  const secs = ((performance.now() - tStart) / 1000).toFixed(1);
  const ft = typeof first === 'number' ? `First try was <b>${first > 0 ? '+' : ''}${Math.round(first)}¢</b>` : 'Found with a hint';
  fb(`✓ Locked on ${T.noteName(target)} in ${secs}s. ${ft}. Here's the real one…`, 'good');
  C.wash(C.noteWash(real), false); // the colour is the reward
  gateUntil = performance.now() + 2700; // don't let the mic hear the speaker
  A.playNote(real, { at: 0.15, dur: 2, source: 'reveal' });
  paint(true);
  nextT = setTimeout(() => { if (mode === 'session') nextNote(); }, 2600);
}

function hearIt() {
  if (mode !== 'session' || phase !== 'listen') return;
  if (first === null) first = 'hint'; // a hint before you sang: no memory score this round
  gateUntil = performance.now() + 2300;
  A.playNote(60 + target - (target > 6 ? 12 : 0), { dur: 2, source: 'mystery' });
  fb(`Here's ${T.noteName(target)}: now sing it back and lock on.`);
}

function skip() {
  if (mode !== 'session') return;
  phase = 'reward';
  gateUntil = performance.now() + 2500;
  A.playNote(60 + target - (target > 6 ? 12 : 0), { dur: 2, source: 'mystery' });
  fb(`That was ${T.noteName(target)}. Next one coming…`, 'bad');
  nextT = setTimeout(() => { if (mode === 'session') nextNote(); }, 2300);
}

function meter(f) {
  const m = el.querySelector('.meter');
  if (!m) return;
  if (!f) { m.querySelector('.m-note').textContent = '–'; return; }
  const midi = freqToMidi(f), near = Math.round(midi);
  // in the test, the detected note stays uncoloured until you lock on
  m.querySelector('.m-note').textContent = T.midiName(near);
  m.querySelector('.m-note').style.color = mode === 'free' ? C.midiColor(near) : '';
  const cents = mode === 'free' || target == null ? (midi - near) * 100 : centsFromPc(f, target);
  const clamp = Math.max(-300, Math.min(300, cents));
  m.querySelector('.needle').style.left = `${50 + (clamp / 300) * 50}%`;
  m.querySelector('.m-cents').textContent = `${cents > 0 ? '+' : ''}${Math.round(cents)}¢${mode === 'free' ? '' : target != null ? ` from ${T.noteName(target)}` : ''}`;
}

function paint(lit = false) {
  const o = data.opts;
  const recent = data.sing.slice(-10);
  const avg = recent.length ? Math.round(recent.reduce((s, r) => s + Math.abs(r.cents), 0) / recent.length) : null;
  const btns = mode === 'session'
    ? `<button class="btn" data-act="refc">Ref C</button><button class="btn" data-act="hear">Hear it</button><button class="btn" data-act="skip">Skip</button><button class="btn ghost" data-act="stop">■ Stop</button>`
    : mode === 'free'
      ? `<button class="btn primary" data-act="start">▶ Start singing</button><button class="btn ghost" data-act="stop">■ Stop</button>`
      : `<button class="btn primary" data-act="start">▶ Start singing</button><button class="btn ghost" data-act="free">Live tuner</button>`;
  el.querySelector('.ear-controls').innerHTML = `
    <div class="row">${seg('singPool', [['adaptive', 'My unlocked notes'], ['all', 'All 12']], o.singPool)}</div>
    <div class="row">${seg('singTol', [['15', 'Strict ±15¢'], ['30', 'Normal ±30¢'], ['50', 'Easy ±50¢']], o.singTol || 30)}</div>
    <div class="row">${btns}</div>`;
  const zone = (tol() / 300) * 50;
  el.querySelector('.sing-stage').innerHTML = `
    <div class="target ${lit ? 'lit' : ''}" style="--c:${lit && target != null ? C.noteColor(target) : 'hsla(222,14%,24%,1)'}">${target != null ? T.noteName(target) : mode === 'free' ? '♪' : '?'}</div>
    <div class="meter"><div class="m-note">–</div><div class="bar"><span class="zone" style="left:${50 - zone}%;width:${zone * 2}%"></span><span class="mid"></span><span class="needle"></span></div><div class="m-cents"></div><div class="lvl" title="Microphone level"><span></span></div><div class="m-diag"></div></div>
    <div class="dim small">${mode === 'session' && sess.n ? `This session: ${sess.n} found${sess.firstN ? ` · first tries average ${Math.round(sess.firstAbs / sess.firstN)}¢ off` : ''}. ` : ''}${avg != null ? `Last ${recent.length} first tries: ${avg}¢ average.` : 'Do this first thing, before you hear any music: that tests your memory, not your last song.'}</div>`;
  meter(lastF);
}

// for testing: feed a frequency as if the mic heard it
export const _feed = f => onPitch(f);

export default {
  id: 'sing', label: 'Sing',
  mount(root) {
    el = root;
    el.innerHTML = `<div class="mic-box"></div><div class="ear-controls"></div><div class="sing-stage"></div><div class="ear-fb">Tap ▶ Start singing: notes keep coming as you find them. Sing from memory, then slide until you lock on.</div>`;
    el.addEventListener('click', e => {
      const sc = e.target.closest('.seg-ctl[data-name] button');
      if (sc) { data.opts[sc.closest('.seg-ctl').dataset.name] = sc.dataset.v; save(); paint(); return; }
      const act = e.target.closest('[data-act]')?.dataset.act;
      if (act === 'allow') askMic();
      if (act === 'start') startSession();
      if (act === 'free') startFree();
      if (act === 'refc') refC();
      if (act === 'hear') hearIt();
      if (act === 'skip') skip();
      if (act === 'stop') stop();
    });
    paint();
  },
  show() { paint(); checkMic(); },
  hide() { if (micActive() || mode !== 'idle') stop(); },
};
