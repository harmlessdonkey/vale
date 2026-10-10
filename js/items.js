// Adding words and the shared word/verb display components.
import { addItem, updateItem, findBySpanish, settings } from './store.js';
import { conjugate, TENSES, TENSE_BY_ID, PERSON_LABEL, isVerbLike } from './conjugator.js';
import { enrich, hasKey } from './claude.js';
import { speak } from './speech.js';
import { h, icon, toast } from './ui.js';

export const TYPE_LABEL = { verb: 'Verb', noun: 'Noun', adjective: 'Adjective', adverb: 'Adverb', phrase: 'Phrase', other: 'Word' };

export function guessType(text) {
  const t = text.trim();
  if (/\s/.test(t)) return 'phrase';
  if (isVerbLike(t)) return 'verb';
  return 'other';
}

export async function addWord(text, typeHint = 'auto', manualEn = '') {
  const clean = text.trim().replace(/\s+/g, ' ');
  if (!clean) return null;
  const dup = findBySpanish(clean);
  if (dup) { toast(`"${dup.es}" is already in your words`); return dup; }
  const type = typeHint !== 'auto' ? typeHint : guessType(clean);
  const item = addItem({ es: clean, en: manualEn, type, status: hasKey() ? 'pending' : 'manual' });
  if (hasKey()) enrichItem(item.id, clean, typeHint);
  return item;
}

export async function enrichItem(id, text, typeHint) {
  updateItem(id, { status: 'pending' });
  try {
    const r = await enrich(text, typeHint);
    const es = (r.spanish || text).trim();
    const dup = findBySpanish(es);
    updateItem(id, {
      es: dup && dup.id !== id ? text : es,
      en: r.english || '',
      type: r.type || 'other',
      gender: r.gender && r.gender !== 'none' ? r.gender : null,
      literal: r.literal || '',
      notes: (r.notes || []).filter(Boolean),
      regional: (r.regional || []).filter((x) => x && x.note),
      example: r.example?.es ? r.example : null,
      stemHint: r.stem_change && r.stem_change !== 'none' ? r.stem_change : null,
      status: 'ok',
    });
  } catch (e) {
    updateItem(id, { status: 'error', error: e.message });
    toast(e.message, 'bad');
  }
}

const cache = new Map();
export function verbOf(item) {
  if (item.type !== 'verb') return null;
  const key = `${item.es}|${item.stemHint || ''}`;
  if (!cache.has(key)) {
    try { cache.set(key, conjugate(item.es, { stemChange: item.stemHint })); } catch { cache.set(key, null); }
  }
  return cache.get(key);
}

export function articleFor(item) {
  if (item.type !== 'noun' || !item.gender) return '';
  if (item.gender === 'm') return 'el';
  if (item.gender === 'f') return 'la';
  return 'el / la';
}

export function personsFor(tense, region = settings().region) {
  const base = region === 'ca' ? ['yo', 'vos', 'tu', 'el', 'nos', 'ellos'] : ['yo', 'tu', 'el', 'nos', 'vosotros', 'ellos'];
  return tense === 'imperativo' ? base.filter((p) => p !== 'yo') : base;
}

export function speakBtn(text, label = 'Listen') {
  return h('button', { class: 'icon-btn', 'aria-label': `${label}: ${text}`, onclick: (e) => { e.stopPropagation(); speak(text); } }, icon('speaker', 20));
}

// The "remember this" box. If a tense is given, only notes relevant to it.
export function notesBox(item, { tense = null, title = 'Remember' } = {}) {
  const v = verbOf(item);
  const lines = [];
  if (v) {
    for (const n of v.notes) {
      if (tense ? n.tenses.includes(tense) : !n.text.startsWith('Imperfect subjunctive is built')) lines.push(n.text);
    }
  }
  if (!tense) for (const n of item.notes || []) lines.push(n);
  if (!lines.length) return null;
  return h('div', { class: 'callout' },
    h('div', { class: 'callout-title' }, icon('sparkle', 16), title),
    h('ul', {}, lines.map((l) => h('li', {}, l))));
}

export function regionalBox(item) {
  if (!item.regional?.length) return null;
  return h('div', { class: 'callout regional' },
    h('div', { class: 'callout-title' }, 'Regional'),
    h('ul', {}, item.regional.map((r) => h('li', {}, h('strong', {}, `${r.where}: `), r.note))));
}

export function tagChips(item) {
  const v = verbOf(item);
  const tags = v ? v.tags : [];
  if (!tags.length) return null;
  return h('div', { class: 'chips' }, tags.map((t) => h('span', { class: `chip ${t.startsWith('Regular') ? 'muted' : ''}` }, t)));
}

export function conjTable(item, tense) {
  const v = verbOf(item);
  if (!v) return null;
  const forms = v.forms[tense];
  if (!forms) return h('p', { class: 'muted small' }, 'No commands for this verb.');
  const region = settings().region;
  const rows = personsFor(tense, region).map((p) => {
    const f = forms[p];
    if (!f) return null;
    const isVos = p === 'vos' && ['presente', 'imperativo'].includes(tense);
    return h('div', { class: `conj-row ${isVos ? 'vos' : ''}` },
      h('span', { class: 'conj-p' }, PERSON_LABEL[p]),
      h('span', { class: 'conj-f' }, f),
      h('button', { class: 'icon-btn sm', 'aria-label': `Listen: ${f}`, onclick: () => speak(f) }, icon('speaker', 16)));
  });
  return h('div', { class: 'conj' }, rows);
}

export function conjExplorer(item) {
  const v = verbOf(item);
  if (!v) return null;
  const ticked = settings().tenses;
  const order = [...TENSES.filter((t) => ticked.includes(t.id)), ...TENSES.filter((t) => !ticked.includes(t.id))];
  let current = order[0].id;
  const tableWrap = h('div');
  const desc = h('p', { class: 'muted small tense-desc' });
  const tabs = h('div', { class: 'tense-tabs', role: 'tablist' });
  const render = () => {
    tabs.replaceChildren(...order.map((t) => h('button', {
      class: `tense-tab ${t.id === current ? 'on' : ''} ${ticked.includes(t.id) ? 'ticked' : ''}`,
      role: 'tab', 'aria-selected': String(t.id === current),
      onclick: () => { current = t.id; render(); },
    }, t.es)));
    desc.textContent = `${TENSE_BY_ID[current].en}${ticked.includes(current) ? '' : ' · not in your rotation yet'}`;
    tableWrap.replaceChildren(conjTable(item, current) || '', notesBox(item, { tense: current, title: 'For this tense' }) || '');
  };
  render();
  return h('section', { class: 'card' },
    h('h3', {}, 'Conjugation'),
    h('p', { class: 'muted small' }, `Gerund ${v.gerund} · participle ${v.participle}`),
    tabs, desc, tableWrap);
}
