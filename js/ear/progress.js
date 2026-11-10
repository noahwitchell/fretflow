// Progress: practice streak, 14-day chart, which notes get confused, and whether colour helps.
import * as T from '../theory.js';
import * as C from '../color.js';
import { data, day, todayKey, reset } from './log.js';
import { pct } from './ui.js';

let el;

function lastDays(n) {
  const out = [];
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(); d.setDate(d.getDate() - i);
    const k = todayKey(d);
    out.push({ k, label: d.toLocaleDateString(undefined, { weekday: 'narrow' }), d: data.days[k] });
  }
  return out;
}

function streakDays() {
  let s = 0;
  for (let i = 0; ; i++) {
    const d = new Date(); d.setDate(d.getDate() - i);
    const rec = data.days[todayKey(d)];
    const did = rec && (rec.n + rec.deg[0] + rec.sing[0]) > 0;
    if (did) s++; else if (i > 0) break;
    if (i > 400) break;
  }
  return s;
}

function chart() {
  const days = lastDays(14), W = 320, H = 110, bw = W / 14;
  let bars = '', line = [];
  days.forEach((x, i) => {
    const d = x.d, cx = i * bw + bw / 2;
    if (d && d.n) {
      const acc = d.ok / d.n, h = acc * (H - 20);
      bars += `<rect x="${(i * bw + 3).toFixed(1)}" y="${(H - 14 - h).toFixed(1)}" width="${(bw - 6).toFixed(1)}" height="${h.toFixed(1)}" rx="3" fill="var(--accent)" opacity="0.85"/>`;
    }
    if (d && d.sing[0]) {
      const avg = d.sing[1] / d.sing[0];
      line.push(`${cx.toFixed(1)},${(H - 14 - Math.max(0, 1 - avg / 300) * (H - 20)).toFixed(1)}`);
    }
    bars += `<text x="${cx.toFixed(1)}" y="${H - 2}" class="ax">${x.label}</text>`;
  });
  const l = line.length > 1 ? `<polyline points="${line.join(' ')}" class="singline"/>` : '';
  const dots = line.map(p => { const [x, y] = p.split(','); return `<circle cx="${x}" cy="${y}" r="3" class="singdot"/>`; }).join('');
  return `<svg viewBox="0 0 ${W} ${H}" class="pchart">${bars}${l}${dots}</svg>
    <div class="legend"><span><i style="background:var(--accent)"></i>Notes accuracy</span><span><i style="background:#7dd3fc"></i>Sing closeness (higher = closer)</span></div>`;
}

function confusion() {
  const cells = [];
  let max = 1;
  for (let w = 0; w < 12; w++) for (let g = 0; g < 12; g++) if (w !== g) max = Math.max(max, data.conf[w]?.[g] || 0);
  for (let w = 0; w < 12; w++) {
    cells.push(`<span class="hd" style="color:${C.noteColor(w)}">${T.noteName(w)}</span>`);
    for (let g = 0; g < 12; g++) {
      const n = data.conf[w]?.[g] || 0;
      const style = w === g
        ? `background:${n ? C.noteColor(w, 4, 0.35) : 'transparent'}`
        : `background:rgba(248,113,113,${n ? 0.15 + 0.85 * (n / max) : 0})`;
      cells.push(`<span title="${T.noteName(w)} heard as ${T.noteName(g)}: ${n}" style="${style}">${n || ''}</span>`);
    }
  }
  const head = `<span></span>${[...Array(12).keys()].map(g => `<span class="hd" style="color:${C.noteColor(g)}">${T.noteName(g)}</span>`).join('')}`;
  // top 3 mix-ups
  const pairs = [];
  for (let w = 0; w < 12; w++) for (let g = 0; g < 12; g++) if (w !== g && data.conf[w]?.[g]) pairs.push([w, g, data.conf[w][g]]);
  pairs.sort((a, b) => b[2] - a[2]);
  const top = pairs.slice(0, 3).map(([w, g, n]) => `${T.noteName(w)} → ${T.noteName(g)} (${n}×)`).join(', ');
  return `<div class="conf">${head}${cells.join('')}</div>
    <p class="dim small">Rows = the note played, columns = your answer. ${top ? `Most common mix-ups: <b>${top}</b>.` : 'No mistakes logged yet.'}</p>`;
}

function render() {
  const d = day();
  let on = [0, 0], off = [0, 0];
  Object.values(data.days).forEach(x => { on[0] += x.cOn[0]; on[1] += x.cOn[1]; off[0] += x.cOff[0]; off[1] += x.cOff[1]; });
  const mins = Math.round(d.secs / 60);
  el.innerHTML = `
    <div class="pcards">
      <div class="pcard"><b>${streakDays()}</b><span>day streak</span></div>
      <div class="pcard"><b>${mins}<small>/10</small></b><span>minutes today</span></div>
      <div class="pcard"><b>${pct(d.ok, d.n)}</b><span>notes today (${d.n})</span></div>
      <div class="pcard"><b>${d.ok ? (d.rt / d.ok / 1000).toFixed(1) + 's' : '–'}</b><span>avg answer time</span></div>
    </div>
    <h4>Last 14 days</h4>${chart()}
    <h4>Does colour help?</h4>
    <div class="pcards two">
      <div class="pcard"><b>${pct(on[1], on[0])}</b><span>with colour (${on[0]})</span></div>
      <div class="pcard"><b>${pct(off[1], off[0])}</b><span>without colour (${off[0]})</span></div>
    </div>
    <p class="dim small">Uses Notes-mode answers. Compare once both sides have 50+ answers. "Fade as I learn" fills both sides naturally.</p>
    <h4>Mix-ups</h4>${confusion()}
    <h4>Per note</h4>
    <div class="pernote">${[...Array(12).keys()].map(pc => { const p = data.per[pc]; return `<div style="--c:${C.noteColor(pc)}"><b>${T.noteName(pc)}</b><span>${p ? pct(p.ok, p.n) : '–'}</span><small>${p && p.ok ? (p.rt / p.ok / 1000).toFixed(1) + 's' : ''}</small></div>`; }).join('')}</div>
    <p class="dim small">Short daily sessions beat long weekly ones: aim for 10 minutes a day. Do a Sing check first thing, before any music.</p>
    <button class="btn ghost small" data-act="reset">Reset stats</button>`;
}

export default {
  id: 'progress', label: 'Progress',
  mount(root) {
    el = root;
    el.addEventListener('click', e => {
      if (e.target.closest('[data-act="reset"]') && confirm('Reset all ear-training stats? Your anchors and options are kept.')) { reset(); render(); }
    });
    render();
  },
  show() { render(); },
};
