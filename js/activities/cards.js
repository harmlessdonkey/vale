// A handful of quick cards: words and phrases, two buttons, no grading scales.
import { getState, settings } from '../store.js';
import { cardKey, record, get } from '../srs.js';
import { notesBox, regionalBox, tagChips, articleFor, speakBtn, TYPE_LABEL } from '../items.js';
import { speak } from '../speech.js';
import { h, mount, shuffle } from '../ui.js';

function pool() {
  return getState().items.filter((i) => i.status !== 'pending' && i.en);
}

export default {
  id: 'cards',
  title: 'Tarjetas',
  blurb: 'A few quick cards: Got it or Not yet',
  icon: 'cards',
  status() {
    const p = pool();
    if (!p.length) return { label: 'Add some words', ready: false };
    const now = Date.now();
    const n = p.filter((i) => !get(cardKey(i.id)) || get(cardKey(i.id)).due <= now).length;
    return { label: n ? `${n} due` : 'All caught up', ready: true, count: n };
  },
  start(root, ctx) { run(root, ctx); },
};

function buildQueue() {
  const now = Date.now();
  const size = settings().sessionSize || 10;
  const p = pool();
  const due = p.filter((i) => get(cardKey(i.id)) && get(cardKey(i.id)).due <= now).sort((a, b) => get(cardKey(a.id)).due - get(cardKey(b.id)).due);
  const fresh = p.filter((i) => !get(cardKey(i.id)));
  let q = [...due, ...fresh].slice(0, size);
  if (!q.length) q = shuffle(p).slice(0, Math.min(5, p.length)); // extra practice
  return shuffle(q).map((it) => ({ it, reverse: (get(cardKey(it.id))?.box || 0) >= 2 && Math.random() < 0.35 }));
}

function run(root, ctx) {
  const queue = buildQueue();
  if (!queue.length) {
    mount(root, h('section', { class: 'card center' }, h('p', {}, 'Add some words first.'), h('button', { class: 'btn', onclick: () => ctx.nav('#/') }, 'Home')));
    return;
  }
  const retried = new Set();
  let idx = 0; let got = 0; let seen = 0;

  const show = () => {
    if (idx >= queue.length) return summary();
    const { it, reverse } = queue[idx];
    const art = articleFor(it);
    const esText = art ? `${art} ${it.es}` : it.es;
    const back = h('div', { class: 'card-back', hidden: true },
      reverse ? h('div', { class: 'flash-answer' }, esText, speakBtn(it.es)) : h('div', { class: 'flash-answer' }, it.en),
      it.literal ? h('p', { class: 'muted small' }, `Literally: ${it.literal}`) : null,
      it.gender ? h('p', { class: 'muted small' }, it.gender === 'm' ? 'masculine' : it.gender === 'f' ? 'feminine' : 'masculine or feminine') : null,
      tagChips(it),
      notesBox(it),
      regionalBox(it),
      it.example ? h('div', { class: 'example' }, h('p', {}, it.example.es, ' ', speakBtn(it.example.es)), h('p', { class: 'muted small' }, it.example.en)) : null,
      it.type === 'verb' ? h('a', { class: 'small', href: `#/item/${it.id}` }, 'See conjugation') : null);
    const grade = (ok) => {
      seen++; if (ok) got++;
      record(cardKey(it.id), ok);
      if (!ok && !retried.has(it.id)) { retried.add(it.id); queue.push({ it, reverse: false }); }
      idx++; show();
    };
    const actions = h('div', { class: 'grade' },
      h('button', { class: 'btn notyet', onclick: () => grade(false) }, 'Not yet'),
      h('button', { class: 'btn gotit', onclick: () => grade(true) }, 'Got it'));
    actions.hidden = true;
    const reveal = h('button', { class: 'btn primary big', onclick: () => {
      back.hidden = false; actions.hidden = false; reveal.hidden = true;
      if (reverse && settings().autoSpeak !== false) speak(it.es);
    } }, 'Mostrar');

    mount(root,
      h('div', { class: 'progress' }, h('div', { class: 'bar', style: { width: `${(idx / queue.length) * 100}%` } })),
      h('section', { class: 'card flash' },
        h('div', { class: 'muted small' }, `${TYPE_LABEL[it.type] || 'Word'}${reverse ? ' · say it in Spanish' : ''}`),
        reverse ? h('div', { class: 'flash-front' }, it.en)
          : h('div', { class: 'flash-front' }, esText, speakBtn(it.es)),
        back),
      reveal, actions);
    if (!reverse && settings().autoSpeak !== false) speak(it.es);
  };

  const summary = () => {
    mount(root, h('section', { class: 'card center' },
      h('div', { class: 'big-emoji', 'aria-hidden': 'true' }, '✨'),
      h('h2', {}, `${got} / ${seen}`),
      h('p', {}, 'Missed ones come back soon and turn up in your next story.'),
      h('button', { class: 'btn primary big', onclick: () => run(root, ctx) }, 'Más'),
      h('button', { class: 'btn ghost', onclick: () => ctx.nav('#/') }, 'Home')));
  };
  show();
}
