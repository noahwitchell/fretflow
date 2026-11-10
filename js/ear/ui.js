// Shared bits for the ear modes: the button ring and small controls.
export function ring(items, centerHtml) {
  return `<div class="ear-ring">${items.map((it, i) => {
    const a = ((it.slot ?? i) / 12) * Math.PI * 2;
    const x = 50 + 40 * Math.sin(a), y = 50 - 40 * Math.cos(a);
    return `<button class="ear-btn ${it.cls || ''}" data-k="${it.k}" ${it.disabled ? 'disabled' : ''}
      style="left:${x.toFixed(2)}%;top:${y.toFixed(2)}%;--c:${it.color}"><span>${it.label}</span>${it.sub ? `<small>${it.sub}</small>` : ''}</button>`;
  }).join('')}<div class="ear-center">${centerHtml}</div></div>`;
}

export function seg(name, opts, cur) {
  return `<div class="seg-ctl" data-name="${name}">${opts.map(([v, l]) =>
    `<button class="${String(v) === String(cur) ? 'on' : ''}" data-v="${v}">${l}</button>`).join('')}</div>`;
}

export const pct = (ok, n) => (n ? Math.round((ok / n) * 100) + '%' : '–');
