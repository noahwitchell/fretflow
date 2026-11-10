// Things the user does that touch sound + state. Views call these.
import { state, set, emit } from './store.js';
import * as T from './theory.js';
import * as A from './audio.js';

let lastVoicing = null;

export function chordMidis(c) {
  const v = T.voice(c, lastVoicing);
  lastVoicing = v.notes;
  return [v.bass, ...v.notes];
}

export function playChord(c, style = 'strum') {
  const midis = chordMidis(c);
  if (style === 'arp' || style === 'both') {
    // chord tones one at a time, low to high (skip the doubled bass root)
    const tones = midis.slice(1);
    tones.forEach((m, i) => A.playNote(m, { at: i * 0.3, dur: 1.4 }));
    if (style === 'arp') return;
    const at = tones.length * 0.3 + 0.15;
    midis.forEach((m, i) => A.playNote(m, { at: at + i * 0.03, notify: false, vel: i === 0 ? 0.7 : 0.55 }));
    setTimeout(() => emit('chordSound', c), at * 1000);
    return;
  }
  const gap = style === 'strum' ? 0.03 : 0;
  midis.forEach((m, i) => A.playNote(m, { at: i * gap, notify: false, vel: i === 0 ? 0.7 : 0.55 }));
  emit('chordSound', c);
}

export function selectChord(c, { play = true, style = state.tapSound || 'both' } = {}) {
  set({ chord: { root: c.root, type: c.type } });
  if (play) { A.stopAll(); playChord(c, style); } // cut the last chord so quick taps don't pile up
}

export const playMidi = (m, opts) => A.playNote(m, opts);

// Progression
let timer = null, idx = -1;
export const isPlaying = () => timer !== null;

export function addToProg(c) { set({ prog: [...state.prog, { root: c.root, type: c.type }] }); }
export function removeFromProg(i) { set({ prog: state.prog.filter((_, j) => j !== i) }); }
export function clearProg() { stopProg(); set({ prog: [] }); }

export function playProg() {
  stopProg();
  if (!state.prog.length) return;
  idx = -1; lastVoicing = null;
  step();
}
function step() {
  idx++;
  if (idx >= state.prog.length) {
    if (!state.loop) { stopProg(); return; }
    idx = 0;
  }
  const c = state.prog[idx];
  set({ chord: { ...c } });
  playChord(c, 'strum');
  emit('playhead', idx);
  const bar = (4 * 60) / state.tempo;
  // a lighter re-strum on beat 3 keeps the pulse going
  const midis = T.voice(c, lastVoicing).notes;
  midis.forEach((m, i) => A.playNote(m, { at: bar / 2 + i * 0.02, vel: 0.32, notify: false, dur: 1.4 }));
  timer = setTimeout(step, bar * 1000);
}
export function stopProg() {
  if (timer) clearTimeout(timer);
  timer = null; idx = -1;
  emit('playhead', -1);
}
