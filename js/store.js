// App state + a tiny event bus. Saved to localStorage so the phone remembers where you were.
const SAVE_KEY = 'fretflow.v2';

const defaults = {
  key: { tonic: 0, mode: 'major' },
  chord: { root: 0, type: 'maj' },
  prog: [],
  view: 'wheel',
  labels: 'note',        // 'note' | 'degree'
  colorMode: 'flash',    // 'flash' | 'hold' | 'off'
  colorMap: 'chromatic', // 'chromatic' | 'fifths'
  sevenths: false,
  tapSound: 'both',     // 'both' | 'arp' | 'strum'
  tempo: 90,
  loop: true,
  ear: { range: '4', pool: 'chromatic', blind: true, stats: {} },
};

function load() {
  try { return JSON.parse(localStorage.getItem(SAVE_KEY)) || {}; } catch { return {}; }
}
const saved = load();
export const state = { ...structuredClone(defaults), ...saved, ear: { ...defaults.ear, ...(saved.ear || {}) } };

const bus = new Map();
export function on(evt, fn) { if (!bus.has(evt)) bus.set(evt, new Set()); bus.get(evt).add(fn); }
export function emit(evt, data) { (bus.get(evt) || []).forEach(fn => fn(data)); }

let saveTimer = null;
export function set(patch) {
  Object.assign(state, patch);
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => { try { localStorage.setItem(SAVE_KEY, JSON.stringify(state)); } catch {} }, 150);
  emit('change', patch);
}
