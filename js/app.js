import { getState, settings, setSettings, getItem, deleteItem, onChange, resetAll } from './store.js';
import { TENSES } from './conjugator.js';
import { hasKey, ping, AIError } from './claude.js';
import { addWord, enrichItem, verbOf, notesBox, regionalBox, tagChips, conjExplorer, articleFor, speakBtn, TYPE_LABEL } from './items.js';
import { spanishVoices, canSpeak, stop as stopSpeech, diagnose } from './speech.js';
import { ACTIVITIES, getActivity } from './activities/index.js';
import { cardKey, get as srsGet } from './srs.js';
import { h, mount, icon, toast, relTime } from './ui.js';

export const VERSION = '1.3';

async function forceUpdate() {
  try {
    const regs = await navigator.serviceWorker?.getRegistrations?.() || [];
    await Promise.all(regs.map((r) => r.unregister()));
    const keys = await caches?.keys?.() || [];
    await Promise.all(keys.map((k) => caches.delete(k)));
  } catch { /* ignore */ }
  location.reload();
}

const main = document.getElementById('main');
const titleEl = document.getElementById('title');
const backBtn = document.getElementById('back');
const tabs = document.querySelectorAll('.tabbar a');

const nav = (hash) => { if (location.hash === hash) route(); else location.hash = hash; };
const ctx = { nav };

backBtn.addEventListener('click', () => (history.length > 1 ? history.back() : nav('#/')));

// ---------------- add box ----------------
function addBox({ compact = false } = {}) {
  const input = h('input', {
    type: 'text', class: 'add-input', placeholder: 'Add a word, verb or phrase…', 'aria-label': 'New word',
    autocapitalize: 'off', autocomplete: 'off', autocorrect: 'off', spellcheck: 'false', lang: 'es',
  });
  let type = 'auto';
  const types = [['auto', 'Auto'], ['verb', 'Verbo'], ['noun', 'Palabra'], ['phrase', 'Frase']];
  const typeRow = h('div', { class: 'chip-row tight' });
  const paintTypes = () => typeRow.replaceChildren(...types.map(([k, l]) => h('button', { type: 'button', class: `chip-btn sm ${type === k ? 'on' : ''}`, onclick: () => { type = k; paintTypes(); } }, l)));
  paintTypes();
  const enInput = h('input', { type: 'text', class: 'add-en', placeholder: 'English meaning (no API key yet)', 'aria-label': 'English meaning', hidden: hasKey() });
  const paste = h('button', { type: 'button', class: 'icon-btn', 'aria-label': 'Paste', onclick: async () => {
    try { const t = await navigator.clipboard.readText(); if (t) { input.value = t.trim().split('\n')[0].slice(0, 80); input.focus(); } } catch { toast('Paste not allowed here. Long-press the box and choose Paste.'); }
  } }, icon('paste', 20));
  const form = h('form', { class: `add-box ${compact ? 'compact' : ''}`, onsubmit: async (e) => {
    e.preventDefault();
    const v = input.value.trim();
    if (!v) return;
    const it = await addWord(v, type, enInput.value.trim());
    input.value = ''; enInput.value = ''; type = 'auto'; paintTypes();
    if (it) {
      toast(hasKey() ? `Added "${it.es}". Writing notes…` : `Added "${it.es}"`, 'good');
      if (!compact) route();
    }
  } },
  h('div', { class: 'add-row' }, input, paste, h('button', { class: 'btn primary', type: 'submit', 'aria-label': 'Add' }, icon('plus', 20))),
  typeRow, enInput);
  return form;
}

// ---------------- views ----------------
function viewHome() {
  setChrome('Vale', false, 'home');
  const s = getState();
  const recent = s.items.slice(0, 5);
  const hour = new Date().getHours();
  const greet = hour < 12 ? 'Buenos días' : hour < 20 ? 'Buenas tardes' : 'Buenas noches';
  mount(main,
    h('header', { class: 'hello' }, h('h1', {}, `${greet}`), h('p', { class: 'muted' }, s.items.length ? `${s.items.length} words and phrases in your collection` : 'Add your first word to get started')),
    !hasKey() ? h('a', { class: 'banner', href: '#/settings' }, h('strong', {}, 'Add your Claude API key'), ' to unlock stories and smart notes. Verbs and cards work without it.') : null,
    addBox(),
    h('div', { class: 'acts' }, ACTIVITIES.map((a) => {
      const st = a.status();
      return h('button', { class: `act ${st.ready ? '' : 'dim'} act-${a.id}`, onclick: () => nav(`#/act/${a.id}`) },
        h('span', { class: 'act-icon' }, icon(a.icon, 26)),
        h('span', { class: 'act-text' }, h('span', { class: 'act-title' }, a.title), h('span', { class: 'act-blurb' }, a.blurb)),
        h('span', { class: `act-status ${st.count ? 'hot' : ''}` }, st.label));
    })),
    recent.length ? h('section', { class: 'card' },
      h('div', { class: 'card-head' }, h('h3', {}, 'Recién añadidas'), h('a', { href: '#/library', class: 'small' }, 'All')),
      h('div', { class: 'list' }, recent.map(itemRow))) : null,
    h('p', { class: 'muted small center' }, `v${VERSION}`));
}

function itemRow(it) {
  const v = verbOf(it);
  const art = articleFor(it);
  const sub = it.status === 'pending' ? 'Writing notes…' : it.status === 'error' ? 'Notes failed, tap to retry' : (it.en || TYPE_LABEL[it.type]);
  const flag = v && !v.regular ? v.tags[0] : (it.regional?.length ? 'Regional' : (it.notes?.length ? 'Note' : null));
  return h('button', { class: 'row', onclick: () => nav(`#/item/${it.id}`) },
    h('span', { class: 'row-main' },
      h('span', { class: 'row-title' }, art ? h('span', { class: 'muted' }, `${art} `) : null, it.es),
      h('span', { class: `row-sub ${it.status === 'pending' ? 'pulse' : ''}` }, sub)),
    flag ? h('span', { class: 'pill' }, flag) : null);
}

let libFilter = 'all'; let libQuery = '';
function viewLibrary() {
  setChrome('Palabras', false, 'library');
  const list = h('div', { class: 'list' });
  const filters = [['all', 'Todo'], ['verb', 'Verbos'], ['word', 'Palabras'], ['phrase', 'Frases']];
  const fRow = h('div', { class: 'chip-row' });
  const paint = () => {
    fRow.replaceChildren(...filters.map(([k, l]) => h('button', { class: `chip-btn ${libFilter === k ? 'on' : ''}`, onclick: () => { libFilter = k; paint(); } }, l)));
    const q = libQuery.toLowerCase();
    const items = getState().items.filter((i) => {
      if (libFilter === 'verb' && i.type !== 'verb') return false;
      if (libFilter === 'phrase' && i.type !== 'phrase') return false;
      if (libFilter === 'word' && ['verb', 'phrase'].includes(i.type)) return false;
      return !q || i.es.toLowerCase().includes(q) || (i.en || '').toLowerCase().includes(q);
    });
    list.replaceChildren(...(items.length ? items.map(itemRow) : [h('p', { class: 'muted center pad' }, 'Nothing here yet.')]));
  };
  const search = h('input', { type: 'search', class: 'search', placeholder: 'Search', 'aria-label': 'Search words', value: libQuery, oninput: (e) => { libQuery = e.target.value; paint(); } });
  paint();
  mount(main, addBox(), search, fRow, h('section', { class: 'card flush' }, list));
}

function viewItem(id) {
  const it = getItem(id);
  if (!it) { nav('#/library'); return; }
  setChrome(TYPE_LABEL[it.type] || 'Word', true);
  const art = articleFor(it);
  const r = srsGet(cardKey(it.id));
  mount(main,
    h('section', { class: 'card item-hero' },
      h('div', { class: 'item-es' }, art ? h('span', { class: 'muted' }, `${art} `) : null, it.es, speakBtn(it.es)),
      it.status === 'pending' ? h('p', { class: 'muted pulse' }, 'Writing notes…') : h('p', { class: 'item-en' }, it.en || h('span', { class: 'muted' }, 'No translation yet')),
      it.literal ? h('p', { class: 'muted small' }, `Literally: ${it.literal}`) : null,
      it.gender ? h('p', { class: 'muted small' }, it.gender === 'm' ? 'Masculine' : it.gender === 'f' ? 'Feminine' : 'Masculine or feminine') : null,
      tagChips(it),
      it.status === 'error' ? h('p', { class: 'bad small' }, it.error || 'Could not get notes.') : null),
    notesBox(it),
    regionalBox(it),
    it.example ? h('section', { class: 'card example' },
      h('p', {}, it.example.es, ' ', speakBtn(it.example.es)),
      h('p', { class: 'muted small' }, it.example.en)) : null,
    conjExplorer(it),
    h('section', { class: 'card' },
      r ? h('p', { class: 'muted small' }, `Reviewed ${r.seen}× · missed ${r.wrong}× · next ${r.due <= Date.now() ? 'now' : new Date(r.due).toLocaleDateString()}`) : h('p', { class: 'muted small' }, `Added ${relTime(it.created)}`),
      h('div', { class: 'row-actions' },
        hasKey() ? h('button', { class: 'btn', onclick: async (e) => { e.target.disabled = true; await enrichItem(it.id, it.es, it.type); route(); } }, icon('sparkle', 18), 'Refresh notes') : null,
        h('button', { class: 'btn danger', onclick: () => { if (confirm(`Delete "${it.es}"?`)) { deleteItem(it.id); nav('#/library'); } } }, icon('trash', 18), 'Delete'))));
}

function viewActivity(id) {
  const a = getActivity(id);
  if (!a) { nav('#/'); return; }
  setChrome(a.title, true);
  const root = h('div', { class: 'activity' });
  mount(main, root);
  a.start(root, ctx);
}

function viewSettings() {
  setChrome('Ajustes', false, 'settings');
  const s = settings();
  const keyInput = h('input', { type: 'password', class: 'field', value: s.apiKey, placeholder: 'sk-ant-…', autocomplete: 'off', 'aria-label': 'Claude API key',
    onchange: (e) => setSettings({ apiKey: e.target.value.trim() }) });
  const showKey = h('button', { class: 'btn ghost sm', type: 'button', onclick: () => { keyInput.type = keyInput.type === 'password' ? 'text' : 'password'; } }, 'Show');
  const testOut = h('span', { class: 'small' });
  const test = h('button', { class: 'btn sm', onclick: async () => {
    setSettings({ apiKey: keyInput.value.trim() });
    testOut.textContent = 'Testing…'; testOut.className = 'small muted';
    try { await ping(); testOut.textContent = 'Working ✓'; testOut.className = 'small good'; } catch (e) { testOut.textContent = e instanceof AIError ? e.message : e.message; testOut.className = 'small bad'; }
  } }, 'Test');

  const seg = (key, opts) => h('div', { class: 'seg' }, opts.map(([v, l]) => h('button', { class: settings()[key] === v ? 'on' : '', onclick: () => { setSettings({ [key]: v }); viewSettings(); } }, l)));

  const groups = [...new Set(TENSES.map((t) => t.group))];
  const tenseList = h('div', { class: 'tense-list' }, groups.map((g) => [
    h('div', { class: 'group-label' }, g),
    TENSES.filter((t) => t.group === g).map((t) => {
      const cb = h('input', { type: 'checkbox', checked: s.tenses.includes(t.id), onchange: (e) => {
        const set = new Set(settings().tenses);
        if (e.target.checked) set.add(t.id); else set.delete(t.id);
        setSettings({ tenses: TENSES.map((x) => x.id).filter((x) => set.has(x)) });
      } });
      return h('label', { class: 'check' }, cb, h('span', {}, h('span', { class: 'check-title' }, t.es), h('span', { class: 'muted small' }, t.en)));
    }),
  ]));

  const voices = spanishVoices();
  const voiceSel = h('select', { class: 'field', 'aria-label': 'Voice', onchange: (e) => setSettings({ voiceURI: e.target.value }) },
    h('option', { value: '' }, 'Automatic (matches region)'),
    voices.map((v) => h('option', { value: v.voiceURI, selected: v.voiceURI === s.voiceURI }, `${v.name} (${v.lang})`)));
  const rate = h('input', { type: 'range', min: '0.6', max: '1.2', step: '0.05', value: String(s.rate), 'aria-label': 'Speed', onchange: (e) => setSettings({ rate: Number(e.target.value) }) });

  const models = [['claude-sonnet-5-5', 'Sonnet (best stories)'], ['claude-haiku-5-5', 'Haiku (fastest, cheapest)']];
  const modelSel = h('select', { class: 'field', 'aria-label': 'Model', onchange: (e) => setSettings({ model: e.target.value }) },
    models.map(([v, l]) => h('option', { value: v, selected: s.model === v }, l)),
    !models.some(([v]) => v === s.model) ? h('option', { value: s.model, selected: true }, s.model) : null);

  mount(main,
    h('section', { class: 'card' },
      h('h3', {}, 'Región'),
      seg('region', [['spain', '🇪🇸 España'], ['ca', '🇭🇳🇸🇻🇳🇮 Centroamérica']]),
      h('p', { class: 'muted small' }, s.region === 'ca' ? 'Shows vos forms (vos tenés), uses ustedes instead of vosotros, and writes stories in Central American Spanish.' : 'Uses tú and vosotros and Spain vocabulary.')),
    h('section', { class: 'card' },
      h('h3', {}, 'Nivel'),
      seg('level', [['A2', 'A2'], ['B1', 'B1'], ['B2', 'B2']]),
      h('p', { class: 'muted small' }, 'How hard the stories and examples should be.')),
    h('section', { class: 'card' },
      h('h3', {}, 'Tenses I know'),
      h('p', { class: 'muted small' }, 'Ticked tenses go into verb drills and are the only ones stories will use.'),
      tenseList),
    h('section', { class: 'card' },
      h('h3', {}, 'Claude API'),
      h('div', { class: 'add-row' }, keyInput, showKey),
      h('div', { class: 'row-actions' }, test, testOut),
      h('label', { class: 'field-label' }, 'Model', modelSel),
      h('p', { class: 'muted small' }, 'Your key stays on this phone. Set a monthly spend limit in the Anthropic console to be safe.')),
    h('section', { class: 'card' },
      h('h3', {}, 'Voz'),
      canSpeak() ? [h('label', { class: 'field-label' }, 'Voice', voiceSel),
        h('label', { class: 'field-label' }, 'Speed', rate),
        h('label', { class: 'check' }, h('input', { type: 'checkbox', checked: s.autoSpeak !== false, onchange: (e) => setSettings({ autoSpeak: e.target.checked }) }), h('span', {}, h('span', { class: 'check-title' }, 'Read cards aloud automatically'))),
        (() => {
          const out = h('p', { class: 'muted small' });
          return h('div', {},
            h('button', { class: 'btn sm', onclick: () => { out.textContent = 'Starting…'; diagnose((m) => { out.textContent = m; }); } }, icon('speaker', 18), 'Try it'),
            out);
        })()]
        : h('p', { class: 'muted small' }, 'Speech is not available in this browser.')),
    h('section', { class: 'card' },
      h('h3', {}, 'Session'),
      h('label', { class: 'field-label' }, 'Cards per round',
        h('select', { class: 'field', onchange: (e) => setSettings({ sessionSize: Number(e.target.value) }) }, [5, 10, 15, 20].map((n) => h('option', { value: n, selected: s.sessionSize === n }, n)))),
      h('button', { class: 'btn danger sm', onclick: () => { if (confirm('Delete all words, progress and stories on this phone?')) { resetAll(); toast('Everything reset'); nav('#/'); } } }, 'Reset everything')),
    h('div', { class: 'center pad' },
      h('p', { class: 'muted small' }, `Vale version ${VERSION}`),
      h('button', { class: 'btn ghost sm', onclick: forceUpdate }, 'Check for updates')));
}

// ---------------- chrome + router ----------------
function setChrome(title, showBack, tab) {
  titleEl.textContent = title;
  backBtn.hidden = !showBack;
  tabs.forEach((t) => t.classList.toggle('on', t.dataset.tab === tab));
  document.title = title === 'Vale' ? 'Vale' : `${title} · Vale`;
}

function route() {
  const hash = location.hash || '#/';
  const [, view, arg] = hash.split('/');
  stopSpeech();
  if (view === 'library') viewLibrary();
  else if (view === 'item') viewItem(arg);
  else if (view === 'act') viewActivity(arg);
  else if (view === 'settings') viewSettings();
  else viewHome();
  main.scrollTop = 0;
  window.scrollTo(0, 0);
}
window.addEventListener('hashchange', route);

// Re-render home/library/item when background notes arrive
let pendingRefresh;
onChange(() => {
  const view = (location.hash || '#/').split('/')[1] || '';
  if (!['', 'library', 'item'].includes(view)) return;
  if (document.activeElement && ['INPUT', 'SELECT', 'TEXTAREA'].includes(document.activeElement.tagName)) return;
  clearTimeout(pendingRefresh);
  pendingRefresh = setTimeout(route, 150);
});

// Optional: ?add=word (from a Shortcut or bookmark)
const params = new URLSearchParams(location.search);
if (params.get('add')) {
  const w = params.get('add');
  history.replaceState(null, '', location.pathname + location.hash);
  addWord(w).then((it) => it && toast(`Added "${it.es}"`, 'good'));
}

route();

if ('serviceWorker' in navigator && location.protocol === 'https:') {
  navigator.serviceWorker.register('sw.js').catch(() => {});
}
