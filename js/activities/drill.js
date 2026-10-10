// Verb drill: type the form, get the pattern called out when you get it right.
import { getState, settings } from '../store.js';
import { TENSE_BY_ID, PERSON_LABEL, stripAcc } from '../conjugator.js';
import { verbKey, record, get, isDue } from '../srs.js';
import { verbOf, notesBox, conjTable, personsFor, speakBtn } from '../items.js';
import { speak } from '../speech.js';
import { h, mount, icon, shuffle, pick } from '../ui.js';

function candidates() {
  const tenses = settings().tenses;
  const out = [];
  for (const it of getState().items) {
    if (it.type !== 'verb' || !verbOf(it)) continue;
    for (const t of tenses) {
      if (!verbOf(it).forms[t]) continue;
      out.push({ it, tense: t, key: verbKey(it.id, t) });
    }
  }
  return out;
}

function dueCount() {
  const now = Date.now();
  return candidates().filter((c) => isDue(c.key, now)).length;
}

function personFor(tense, forms) {
  const region = settings().region;
  let ps = personsFor(tense, region);
  if (region === 'ca') {
    // vos only differs from tú in present and commands
    ps = ['presente', 'imperativo'].includes(tense) ? ps.filter((p) => p !== 'tu') : ps.filter((p) => p !== 'vos');
  }
  return pick(ps.filter((p) => forms[p]));
}

export default {
  id: 'drill',
  title: 'Verbos',
  blurb: 'Quick typed drills on your verbs and ticked tenses',
  icon: 'bolt',
  status() {
    const c = candidates();
    if (!c.length) return { label: getState().items.some((i) => i.type === 'verb') ? 'Tick some tenses' : 'Add a verb first', ready: false };
    const n = dueCount();
    return { label: n ? `${n} due` : 'All caught up', ready: true, count: n };
  },
  start(root, ctx) { run(root, ctx); },
};

function buildQueue() {
  const now = Date.now();
  const size = settings().sessionSize || 10;
  const all = candidates();
  const due = all.filter((c) => get(c.key) && get(c.key).due <= now).sort((a, b) => get(a.key).due - get(b.key).due);
  const fresh = shuffle(all.filter((c) => !get(c.key)));
  let q = [...due, ...fresh].slice(0, size);
  if (q.length < Math.min(5, all.length)) {
    // nothing due: practise the ones that are closest to due anyway
    const rest = all.filter((c) => !q.includes(c)).sort((a, b) => (get(a.key)?.due || 0) - (get(b.key)?.due || 0));
    q = [...q, ...rest].slice(0, Math.min(size, Math.max(5, q.length)));
  }
  return shuffle(q).map((c) => ({ ...c, person: personFor(c.tense, verbOf(c.it).forms[c.tense]) }));
}

const clean = (s) => s.toLowerCase().trim().replace(/\s+/g, ' ');

function run(root, ctx) {
  const queue = buildQueue();
  if (!queue.length) {
    mount(root, h('section', { class: 'card center' },
      h('p', {}, 'Add a verb (try tener or pedir) and tick some tenses in Ajustes.'),
      h('button', { class: 'btn', onclick: () => ctx.nav('#/') }, 'Home')));
    return;
  }
  const retried = new Set();
  let idx = 0; let right = 0; let total = 0;

  const ask = () => {
    if (idx >= queue.length) return summary();
    const qn = queue[idx];
    const v = verbOf(qn.it);
    const forms = v.forms[qn.tense];
    const expected = forms[qn.person];
    const tense = TENSE_BY_ID[qn.tense];
    const input = h('input', {
      class: 'answer', type: 'text', autocapitalize: 'off', autocomplete: 'off', autocorrect: 'off', spellcheck: 'false',
      placeholder: v.reflexive ? 'e.g. me levanto' : 'type the form', 'aria-label': 'Your answer', lang: 'es',
    });
    const insert = (ch) => {
      const s = input.selectionStart ?? input.value.length;
      input.value = input.value.slice(0, s) + ch + input.value.slice(input.selectionEnd ?? s);
      input.focus(); input.setSelectionRange(s + 1, s + 1);
    };
    const accents = h('div', { class: 'accent-keys' }, ['á', 'é', 'í', 'ó', 'ú', 'ñ', 'ü'].map((c) => h('button', { type: 'button', class: 'key', onmousedown: (e) => e.preventDefault(), onclick: () => insert(c) }, c)));
    const feedback = h('div', { class: 'feedback' });
    const checkBtn = h('button', { class: 'btn primary big', type: 'submit' }, 'Comprobar');
    let answered = false;

    const form = h('form', { class: 'drill-form', onsubmit: (e) => {
      e.preventDefault();
      if (answered) { idx++; ask(); return; }
      const a = clean(input.value);
      if (!a) return;
      answered = true;
      const exp = clean(expected);
      const bare = v.reflexive ? exp.split(' ').slice(1).join(' ') : null;
      let ok = a === exp; let msg = '';
      if (!ok && bare && a === bare) { ok = true; msg = `Don't forget the pronoun: ${expected}`; }
      if (!ok && stripAcc(a) === stripAcc(exp)) { ok = true; msg = `Watch the accent: ${expected}`; }
      if (!ok && bare && stripAcc(a) === stripAcc(bare)) { ok = true; msg = `Watch the accent and pronoun: ${expected}`; }
      total++;
      if (ok) right++;
      record(qn.key, ok);
      if (!ok && !retried.has(qn.key)) { retried.add(qn.key); queue.push({ ...qn }); }
      input.disabled = true;
      accents.hidden = true;
      if (settings().autoSpeak !== false) speak(expected);
      mount(feedback,
        h('div', { class: `verdict ${ok ? 'good' : 'bad'}` },
          ok ? [h('span', {}, icon('check', 20), msg ? 'Sí.' : '¡Bien!'), ' '] : h('span', {}, 'Era:'), ' ',
          h('strong', {}, expected), msg && ok ? h('div', { class: 'small' }, msg) : null),
        notesBox(qn.it, { tense: qn.tense, title: ok ? 'Why it looks like that' : 'Remember' }),
        !ok ? conjTable(qn.it, qn.tense) : null);
      checkBtn.textContent = idx + 1 >= queue.length ? 'Finish' : 'Siguiente';
      checkBtn.focus();
    } },
    input, accents, checkBtn);

    mount(root,
      h('div', { class: 'progress', 'aria-label': `Question ${idx + 1} of ${queue.length}` }, h('div', { class: 'bar', style: { width: `${(idx / queue.length) * 100}%` } })),
      h('section', { class: 'card drill' },
        h('div', { class: 'drill-verb' }, qn.it.es, speakBtn(qn.it.es)),
        qn.it.en ? h('div', { class: 'muted' }, qn.it.en) : null,
        h('div', { class: 'drill-tense' }, h('span', { class: 'chip' }, tense.es), h('span', { class: 'muted small' }, tense.en)),
        h('div', { class: 'drill-person' }, PERSON_LABEL[qn.person]),
        form,
        feedback));
    setTimeout(() => input.focus(), 50);
  };

  const summary = () => {
    mount(root, h('section', { class: 'card center' },
      h('div', { class: 'big-emoji', 'aria-hidden': 'true' }, right === total ? '🎉' : '💪'),
      h('h2', {}, `${right} / ${total}`),
      h('p', {}, right === total ? '¡Perfecto!' : 'Anything you missed will come back soon.'),
      h('button', { class: 'btn primary big', onclick: () => run(root, ctx) }, 'Otra ronda'),
      h('button', { class: 'btn ghost', onclick: () => ctx.nav('#/') }, 'Home')));
  };
  ask();
}
