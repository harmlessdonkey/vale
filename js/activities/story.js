// Story activity: a fresh graded story on demand, built from your words.
import { getState, settings, setSettings, addStory, updateStory, uid, findBySpanish } from '../store.js';
import { story as genStory, lookup, hasKey, TOPICS, AIError } from '../claude.js';
import { TENSE_BY_ID, PERSON_LABEL } from '../conjugator.js';
import { cardKey, verbKey, record, recentMisses, isDue } from '../srs.js';
import { addWord, verbOf } from '../items.js';
import { speak, stop, canSpeak } from '../speech.js';
import { h, mount, icon, toast, relTime } from '../ui.js';

const TOPIC_LABEL = { sorpresa: 'Sorpréndeme', viaje: 'Viaje', dia: 'Día a día', comida: 'Comida', trabajo: 'Trabajo', dialogo: 'Diálogo' };
const LOADING = ['Escribiendo tu historia…', 'Buscando las palabras justas…', 'Eligiendo un buen final…'];

function chooseTargets() {
  const items = getState().items.filter((i) => i.status !== 'pending');
  const byId = Object.fromEntries(items.map((i) => [i.id, i]));
  const chosen = new Map();
  const add = (it) => { if (it && !chosen.has(it.id)) chosen.set(it.id, it); };
  // 1. things you got wrong lately
  for (const k of [...recentMisses('card:'), ...recentMisses('verb:')]) {
    if (chosen.size >= 3) break;
    add(byId[k.split(':')[1]]);
  }
  // 2. a phrase or two
  items.filter((i) => i.type === 'phrase').slice(0, 6).sort(() => Math.random() - 0.5).slice(0, 2).forEach(add);
  // 3. newest words
  for (const it of items) { if (chosen.size >= 8) break; add(it); }
  // 4. anything due
  for (const it of items) { if (chosen.size >= 10) break; if (isDue(cardKey(it.id))) add(it); }
  return [...chosen.values()];
}

export default {
  id: 'story',
  title: 'Historia',
  blurb: 'A fresh short story using your words and tenses',
  icon: 'sparkle',
  status() {
    if (!hasKey()) return { label: 'Needs API key', ready: false };
    return { label: `${getState().stories.length} read`, ready: true };
  },
  start(root, ctx) { setup(root, ctx); },
};

function setup(root, ctx) {
  const s = settings();
  const chip = (key, label, cur, on) => h('button', { class: `chip-btn ${cur === key ? 'on' : ''}`, onclick: () => on(key) }, label);
  const topicRow = h('div', { class: 'chip-row' });
  const lenRow = h('div', { class: 'chip-row' });
  const renderChips = () => {
    topicRow.replaceChildren(...Object.keys(TOPICS).map((k) => chip(k, TOPIC_LABEL[k], settings().storyTopic, (v) => { setSettings({ storyTopic: v }); renderChips(); })));
    lenRow.replaceChildren(chip('short', 'Corta', settings().storyLength, (v) => { setSettings({ storyLength: v }); renderChips(); }), chip('long', 'Larga', settings().storyLength, (v) => { setSettings({ storyLength: v }); renderChips(); }));
  };
  renderChips();
  const targets = chooseTargets();
  const past = getState().stories;

  mount(root,
    h('section', { class: 'card' },
      h('h3', {}, 'Tema'), topicRow,
      h('h3', {}, 'Longitud'), lenRow,
      h('p', { class: 'muted small' }, 'Tenses: ', s.tenses.map((t) => TENSE_BY_ID[t]?.es).join(', ') || 'none ticked', ' · ',
        h('a', { href: '#/settings' }, 'change')),
      targets.length ? h('p', { class: 'muted small' }, `Will try to use: ${targets.map((t) => t.es).join(', ')}`) : h('p', { class: 'muted small' }, 'Add some words and the stories will start using them.'),
      h('button', { class: 'btn primary big', disabled: !hasKey() || !s.tenses.length, onclick: () => generate(root, ctx, targets) }, icon('sparkle', 20), 'Nueva historia'),
      !hasKey() ? h('p', { class: 'warn small' }, 'Add your Claude API key in Ajustes to generate stories.') : null),
    past.length ? h('section', { class: 'card' },
      h('h3', {}, 'Earlier stories'),
      h('div', { class: 'list' }, past.slice(0, 10).map((st) => h('button', { class: 'row', onclick: () => read(root, ctx, st) },
        h('span', { class: 'row-main' }, h('span', { class: 'row-title' }, st.title), h('span', { class: 'row-sub' }, relTime(st.created))),
        st.score != null ? h('span', { class: 'pill' }, `${st.score}/${st.questions.length}`) : null)))) : null);
}

async function generate(root, ctx, targets) {
  const s = settings();
  const msg = h('p', { class: 'loading-msg' }, LOADING[0]);
  let i = 0;
  const timer = setInterval(() => { i = (i + 1) % LOADING.length; msg.textContent = LOADING[i]; }, 2500);
  mount(root, h('div', { class: 'loading' }, h('div', { class: 'spinner' }), msg, h('p', { class: 'muted small' }, 'Usually 10 to 20 seconds')));
  try {
    const r = await genStory({ targets, tenses: s.tenses, topic: s.storyTopic, length: s.storyLength });
    const st = {
      id: uid(), created: Date.now(), title: r.title, paragraphs: r.paragraphs, translation: r.translation || [],
      glossary: r.glossary || [], used: r.used || [], questions: r.questions || [],
      targetIds: targets.map((t) => t.id), tapped: [], answers: {}, score: null, done: false,
    };
    addStory(st);
    read(root, ctx, st);
  } catch (e) {
    mount(root, h('div', { class: 'card' }, h('p', { class: 'bad' }, e instanceof AIError ? e.message : `Something went wrong: ${e.message}`),
      h('button', { class: 'btn', onclick: () => setup(root, ctx) }, 'Back')));
  } finally {
    clearInterval(timer);
  }
}

const norm = (w) => w.toLowerCase();
const strip = (w) => w.normalize('NFD').replace(/[́]/g, '').normalize('NFC');

function read(root, ctx, st) {
  const gloss = new Map();
  for (const g of st.glossary) { gloss.set(norm(g.form), g); gloss.set(strip(norm(g.form)), g); }
  const tapped = new Set(st.tapped || []);
  const sheet = h('div', { class: 'sheet', role: 'dialog', 'aria-modal': 'false' });
  let playing = false;

  const closeSheet = () => { sheet.classList.remove('open'); };
  function showWord(word, sentence, el) {
    const key = norm(word);
    if (!tapped.has(key)) { tapped.add(key); st.tapped = [...tapped]; updateStory(st.id, { tapped: st.tapped }); }
    el.classList.add('tapped');
    const g = gloss.get(key) || gloss.get(strip(key));
    const body = h('div', { class: 'sheet-body' });
    const fill = (g2) => {
      const lib = findBySpanish(g2.lemma || '');
      const tenseLabel = g2.tense && TENSE_BY_ID[g2.tense] ? `${TENSE_BY_ID[g2.tense].es}${g2.person ? ' · ' + (PERSON_LABEL[g2.person] || g2.person) : ''}` : (g2.tense || '');
      mount(body,
        h('div', { class: 'sheet-head' },
          h('div', {}, h('div', { class: 'sheet-word' }, word), g2.lemma && norm(g2.lemma) !== key ? h('div', { class: 'muted small' }, `from ${g2.lemma}`) : null),
          h('button', { class: 'icon-btn', 'aria-label': 'Listen', onclick: () => speak(word) }, icon('speaker'))),
        h('div', { class: 'sheet-en' }, g2.en),
        tenseLabel ? h('div', { class: 'chip' }, tenseLabel) : null,
        g2.note ? h('p', { class: 'small' }, g2.note) : null,
        h('div', { class: 'sheet-actions' },
          lib ? h('button', { class: 'btn', onclick: () => ctx.nav(`#/item/${lib.id}`) }, verbOf(lib) ? 'See conjugation' : 'Open word')
            : g2.lemma ? h('button', { class: 'btn', onclick: async (e) => { e.target.disabled = true; await addWord(g2.lemma); e.target.textContent = 'Added ✓'; } }, icon('plus', 18), `Add "${g2.lemma}"`) : null,
          h('button', { class: 'btn ghost', onclick: closeSheet }, 'Close')));
    };
    if (g) fill(g);
    else {
      mount(body,h('div', { class: 'sheet-word' }, word), h('p', { class: 'muted' }, 'Looking it up…'));
      lookup(word, sentence).then((r) => { const g2 = { form: key, ...r }; st.glossary.push(g2); gloss.set(key, g2); updateStory(st.id, { glossary: st.glossary }); fill(g2); })
        .catch((e) => mount(body,h('div', { class: 'sheet-word' }, word), h('p', { class: 'bad' }, e.message), h('button', { class: 'btn ghost', onclick: closeSheet }, 'Close')));
    }
    sheet.replaceChildren(body);
    sheet.classList.add('open');
  }

  const paraEls = st.paragraphs.map((p, pi) => {
    const sentences = p.split(/(?<=[.!?…»])\s+/);
    const pEl = h('p', { class: 'story-p' });
    for (const sentence of sentences) {
      for (const part of sentence.split(/([A-Za-zÁÉÍÓÚÜÑáéíóúüñ]+)/)) {
        if (!part) continue;
        if (/^[A-Za-zÁÉÍÓÚÜÑáéíóúüñ]+$/.test(part)) {
          const w = h('span', { class: `w ${tapped.has(norm(part)) ? 'tapped' : ''}`, role: 'button', tabindex: '0' }, part);
          w.addEventListener('click', () => showWord(part, sentence, w));
          pEl.append(w);
        } else pEl.append(part);
      }
      pEl.append(' ');
    }
    const tr = h('p', { class: 'story-tr', hidden: true }, st.translation[pi] || '');
    return h('div', {}, pEl, tr);
  });

  const listenBtn = h('button', { class: 'btn', disabled: !canSpeak() }, icon('speaker', 18), 'Escuchar');
  listenBtn.addEventListener('click', () => {
    if (playing) { stop(); playing = false; listenBtn.replaceChildren(icon('speaker', 18), 'Escuchar'); return; }
    playing = true; listenBtn.replaceChildren(icon('stop', 18), 'Parar');
    speak(st.paragraphs.join('\n'), { onend: () => { playing = false; listenBtn.replaceChildren(icon('speaker', 18), 'Escuchar'); } });
  });
  let trOn = false;
  const trBtn = h('button', { class: 'btn ghost', onclick: () => {
    trOn = !trOn; root.querySelectorAll('.story-tr').forEach((e) => { e.hidden = !trOn; });
    trBtn.textContent = trOn ? 'Hide English' : 'Show English';
  } }, 'Show English');

  // questions
  const qWrap = h('section', { class: 'card' }, h('h3', {}, 'Preguntas'));
  st.questions.forEach((q, qi) => {
    const fb = h('p', { class: 'small' });
    const opts = q.options.map((o, oi) => h('button', { class: 'opt', onclick: () => answer(oi) }, o));
    function paint() {
      const a = st.answers[qi];
      if (a == null) return;
      opts.forEach((b, oi) => { b.disabled = true; b.classList.toggle('right', oi === q.answer); b.classList.toggle('wrong', oi === a && a !== q.answer); });
      fb.textContent = (a === q.answer ? '¡Correcto! ' : 'Not quite. ') + (q.explain || '');
      fb.className = `small ${a === q.answer ? 'good' : 'bad'}`;
    }
    function answer(oi) { st.answers[qi] = oi; updateStory(st.id, { answers: st.answers }); paint(); }
    qWrap.append(h('div', { class: 'q' }, h('p', { class: 'q-text' }, `${qi + 1}. ${q.q}`), h('div', { class: 'opts' }, opts), fb));
    paint();
  });

  const finishBtn = h('button', { class: 'btn primary big', onclick: () => finish(root, ctx, st, tapped) }, icon('check', 20), st.done ? 'See summary' : 'Done');

  const article = h('article', { class: 'card story' },
      h('h2', { class: 'story-title' }, st.title),
      h('div', { class: 'row-actions' }, listenBtn, trBtn),
      h('p', { class: 'muted small' }, 'Tap any word you don\'t know.'),
      paraEls);
  article.addEventListener('click', (e) => { if (!sheet.contains(e.target) && !e.target.classList.contains('w')) closeSheet(); });
  mount(root, article, st.questions.length ? qWrap : null, finishBtn, sheet);
}

function finish(root, ctx, st, tapped) {
  const items = getState().items;
  const tappedLemmas = new Set();
  for (const f of tapped) {
    const g = st.glossary.find((x) => norm(x.form) === f);
    tappedLemmas.add(norm(g?.lemma || f));
    tappedLemmas.add(f);
  }
  const used = new Set((st.used || []).map(norm));
  const struggled = []; const fine = [];
  if (!st.done) {
    for (const id of st.targetIds) {
      const it = items.find((i) => i.id === id);
      if (!it || !used.has(norm(it.es))) continue;
      if (tappedLemmas.has(norm(it.es))) { record(cardKey(it.id), false); struggled.push(it.es); }
      else { record(cardKey(it.id), true, { soft: true }); fine.push(it.es); }
    }
    // verb forms you tapped bring that tense back sooner
    for (const f of tapped) {
      const g = st.glossary.find((x) => norm(x.form) === f);
      const it = g && findBySpanish(g.lemma || '');
      if (it && it.type === 'verb' && g.tense && settings().tenses.includes(g.tense)) record(verbKey(it.id, g.tense), false);
    }
    const score = st.questions.reduce((n, q, i) => n + (st.answers[i] === q.answer ? 1 : 0), 0);
    Object.assign(st, { done: true, score, struggled, fine });
    updateStory(st.id, { done: true, score, struggled, fine });
  }
  mount(root,
    h('section', { class: 'card center' },
      h('div', { class: 'big-emoji', 'aria-hidden': 'true' }, '📖'),
      h('h2', {}, '¡Muy bien!'),
      st.questions.length ? h('p', {}, `Questions: ${st.score} of ${st.questions.length}`) : null,
      h('p', {}, `You checked ${tapped.size} word${tapped.size === 1 ? '' : 's'}.`),
      st.fine?.length ? h('p', { class: 'good small' }, `Knew without help: ${st.fine.join(', ')}`) : null,
      st.struggled?.length ? h('p', { class: 'small' }, `Coming back soon: ${st.struggled.join(', ')}`) : null,
      h('button', { class: 'btn primary big', onclick: () => setup(root, ctx) }, icon('sparkle', 20), 'Otra historia'),
      h('button', { class: 'btn ghost', onclick: () => ctx.nav('#/') }, 'Home')));
}
