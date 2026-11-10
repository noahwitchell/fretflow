// Ear-training data: options, anchors, per-note stats, confusion, daily history.
// Kept apart from app state so practice logging never re-renders the chord views.
const KEY = 'fretflow.ear.v1';

// Notes unlock in this order: far apart first, so early notes are easy to tell apart.
export const UNLOCK_ORDER = [0, 6, 9, 3, 4, 10, 2, 8, 7, 1, 11, 5];

const DEFAULT_ANCHORS = {
  4: 'Low / high E string', 9: 'A string (tuning A)', 2: 'D string', 7: 'G string', 11: 'B string',
};

const defaults = () => ({
  opts: {
    pool: 'adaptive', range: '4', timbre: 'guitar', noise: true,
    degKey: 'same', degSet: 'diatonic', singPool: 'adaptive', singTol: '30',
  },
  level: 3,
  sinceLevel: 0,
  per: {},     // pc -> { n, ok, rt }
  conf: {},    // want -> { guess -> n }
  recent: [],  // last answers in Notes mode: { pc, ok }
  deg: {},     // degree (0-11) -> { n, ok }
  sing: [],    // { d, pc, cents }
  days: {},    // 'YYYY-MM-DD' -> day record
  anchors: { ...DEFAULT_ANCHORS },
});

function load() {
  try {
    const d = JSON.parse(localStorage.getItem(KEY));
    if (d) { const base = defaults(); return { ...base, ...d, opts: { ...base.opts, ...d.opts } }; }
  } catch {}
  return defaults();
}
export const data = load();

let t = null;
export function save() {
  clearTimeout(t);
  t = setTimeout(() => { try { localStorage.setItem(KEY, JSON.stringify(data)); } catch {} }, 200);
}
export function reset() {
  const keep = { opts: data.opts, anchors: data.anchors };
  Object.keys(data).forEach(k => delete data[k]);
  Object.assign(data, defaults(), keep);
  save();
}

export const todayKey = (d = new Date()) => d.toLocaleDateString('en-CA');
export function day(k = todayKey()) {
  return (data.days[k] ||= { n: 0, ok: 0, rt: 0, cOn: [0, 0], cOff: [0, 0], deg: [0, 0], sing: [0, 0], secs: 0 });
}

let lastAct = 0;
function tick() {
  const now = Date.now();
  if (lastAct && now - lastAct < 60000) day().secs += (now - lastAct) / 1000;
  lastAct = now;
}

export const unlocked = () => UNLOCK_ORDER.slice(0, data.level);

// Returns the newly unlocked pitch class, if this answer earned a level-up.
export function logNote(want, guess, rtMs, colourShown) {
  tick();
  const ok = want === guess;
  const p = (data.per[want] ||= { n: 0, ok: 0, rt: 0 });
  p.n++; if (ok) { p.ok++; p.rt += rtMs; }
  ((data.conf[want] ||= {})[guess] = (data.conf[want][guess] || 0) + 1);
  const d = day();
  d.n++; if (ok) { d.ok++; d.rt += rtMs; }
  const c = colourShown ? d.cOn : d.cOff; c[0]++; if (ok) c[1]++;

  let unlockedPc = null;
  if (data.opts.pool === 'adaptive') {
    data.recent.push(ok ? 1 : 0);
    data.recent = data.recent.slice(-20);
    data.sinceLevel++;
    const acc = data.recent.reduce((a, b) => a + b, 0) / data.recent.length;
    if (data.level < 12 && data.sinceLevel >= 20 && acc >= 0.9) {
      unlockedPc = UNLOCK_ORDER[data.level];
      data.level++; data.sinceLevel = 0; data.recent = [];
    }
  }
  save();
  return unlockedPc;
}
export function levelProgress() {
  const r = data.recent;
  return { answered: Math.min(data.sinceLevel, 20), acc: r.length ? r.reduce((a, b) => a + b, 0) / r.length : 0 };
}

export function logDeg(want, guess) {
  tick();
  const p = (data.deg[want] ||= { n: 0, ok: 0 });
  p.n++; if (want === guess) p.ok++;
  const d = day(); d.deg[0]++; if (want === guess) d.deg[1]++;
  save();
}

export function logSing(pc, cents) {
  tick();
  data.sing.push({ d: todayKey(), pc, cents: Math.round(cents) });
  data.sing = data.sing.slice(-1000);
  const d = day(); d.sing[0]++; d.sing[1] += Math.abs(cents);
  save();
}
