// Ear tab: a shell holding the five training modes.
import notes from '../ear/notes.js';
import degrees from '../ear/degrees.js';
import sing from '../ear/sing.js';
import imagine from '../ear/imagine.js';
import progress from '../ear/progress.js';

const MODES = [notes, degrees, sing, imagine, progress];
let el, cur = 'notes';

function show(id) {
  MODES.forEach(m => {
    const pane = el.querySelector(`[data-pane="${m.id}"]`);
    const on = m.id === id;
    if (!on && pane.classList.contains('on')) m.hide?.();
    pane.classList.toggle('on', on);
    if (on) m.show?.();
  });
  el.querySelectorAll('.ear-modes button').forEach(b => b.classList.toggle('on', b.dataset.mode === id));
  cur = id;
}

export default {
  id: 'ear',
  mount(root) {
    el = root;
    el.innerHTML = `<div class="ear-modes seg-ctl">${MODES.map(m => `<button data-mode="${m.id}">${m.label}</button>`).join('')}</div>
      ${MODES.map(m => `<div class="ear-pane" data-pane="${m.id}"></div>`).join('')}`;
    MODES.forEach(m => m.mount(el.querySelector(`[data-pane="${m.id}"]`)));
    el.querySelector('.ear-modes').addEventListener('click', e => {
      const b = e.target.closest('[data-mode]');
      if (b) show(b.dataset.mode);
    });
    show(cur);
  },
  render() { MODES.find(m => m.id === cur)?.show?.(); },
  leave() { MODES.forEach(m => m.hide?.()); },
};
