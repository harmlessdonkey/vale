// All data lives in localStorage on the phone.
const KEY = 'vale.v1';

const DEFAULTS = {
  settings: {
    apiKey: '',
    model: 'claude-sonnet-5-5',
    region: 'spain', // 'spain' | 'ca'
    level: 'B1',
    tenses: ['presente', 'preterito', 'perfecto'],
    voiceURI: '',
    rate: 0.9,
    storyLength: 'short',
    storyTopic: 'sorpresa',
    sessionSize: 10,
  },
  items: [],
  srs: {},
  stories: [],
};

let state = load();
const listeners = new Set();

function load() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return structuredClone(DEFAULTS);
    const s = JSON.parse(raw);
    return {
      ...structuredClone(DEFAULTS), ...s,
      settings: { ...DEFAULTS.settings, ...(s.settings || {}) },
    };
  } catch {
    return structuredClone(DEFAULTS);
  }
}

export function save() {
  try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (e) { console.warn('save failed', e); }
  listeners.forEach((fn) => fn(state));
}

export const getState = () => state;
export const settings = () => state.settings;
export function setSettings(patch) { Object.assign(state.settings, patch); save(); }
export function onChange(fn) { listeners.add(fn); return () => listeners.delete(fn); }

export const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);

export function addItem(item) {
  const it = { id: uid(), created: Date.now(), notes: [], regional: [], ...item };
  state.items.unshift(it);
  save();
  return it;
}
export function updateItem(id, patch) {
  const it = state.items.find((i) => i.id === id);
  if (it) { Object.assign(it, patch); save(); }
  return it;
}
export function deleteItem(id) {
  state.items = state.items.filter((i) => i.id !== id);
  for (const k of Object.keys(state.srs)) if (k.split(':')[1] === id) delete state.srs[k];
  save();
}
export const getItem = (id) => state.items.find((i) => i.id === id);
export const findBySpanish = (es) => {
  const n = es.trim().toLowerCase();
  return state.items.find((i) => i.es.toLowerCase() === n);
};

export function addStory(story) {
  state.stories.unshift(story);
  state.stories = state.stories.slice(0, 30);
  save();
}
export function updateStory(id, patch) {
  const s = state.stories.find((x) => x.id === id);
  if (s) { Object.assign(s, patch); save(); }
}

export function resetAll() {
  localStorage.removeItem(KEY);
  state = structuredClone(DEFAULTS);
  save();
}
