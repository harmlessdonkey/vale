// Light spaced repetition: things you get right drift further away,
// things you miss come back within minutes and are favoured in stories.
import { getState, save } from './store.js';

const DAY = 86400000;
const INTERVALS = [0, 1, 3, 7, 14, 30, 60]; // days per box

export const cardKey = (itemId) => `card:${itemId}`;
export const verbKey = (itemId, tense) => `verb:${itemId}:${tense}`;

export function get(key) {
  return getState().srs[key] || null;
}

export function record(key, correct, { soft = false } = {}) {
  const srs = getState().srs;
  const now = Date.now();
  const r = srs[key] || { box: 0, due: now, seen: 0, wrong: 0 };
  r.seen += 1;
  r.last = now;
  if (correct) {
    // soft = seen in a story without needing help: only nudge if it was due
    if (!soft || r.due <= now) {
      r.box = Math.min(r.box + 1, INTERVALS.length - 1);
      r.due = now + INTERVALS[r.box] * DAY;
    }
  } else {
    r.wrong += 1;
    r.lastWrong = now;
    r.box = 0;
    r.due = now + 10 * 60000; // back in ten minutes
  }
  srs[key] = r;
  save();
  return r;
}

export const isDue = (key, now = Date.now()) => {
  const r = get(key);
  return !r || r.due <= now;
};
export const isNew = (key) => !get(key);

// Recently missed (last 3 days), newest first
export function recentMisses(prefix, days = 3) {
  const cut = Date.now() - days * DAY;
  return Object.entries(getState().srs)
    .filter(([k, r]) => k.startsWith(prefix) && r.lastWrong && r.lastWrong > cut)
    .sort((a, b) => b[1].lastWrong - a[1].lastWrong)
    .map(([k]) => k);
}
