// Text-to-speech using the voices built into the phone. Free and offline.
// iPhone quirks handled here:
//  - speech must first start inside a tap, so we "unlock" it on the first touch
//  - speak() straight after cancel() is silently dropped, so we wait a moment
//  - long texts can stall, so we queue one sentence at a time
//  - the voice list loads late, so we keep asking for it
import { settings } from './store.js';

const synth = typeof window !== 'undefined' ? window.speechSynthesis : null;
let voices = [];
let unlocked = false;
let session = 0; // bumps on every new speak/stop so stale queues stop

function loadVoices() {
  if (!synth) return [];
  const all = synth.getVoices() || [];
  voices = all.filter((v) => v.lang && v.lang.toLowerCase().replace('_', '-').startsWith('es'));
  return voices;
}
if (synth) {
  loadVoices();
  synth.addEventListener?.('voiceschanged', loadVoices);
  synth.onvoiceschanged = loadVoices;
  // Unlock audio on the very first tap anywhere in the app.
  const unlock = () => {
    if (unlocked) return;
    unlocked = true;
    try {
      const u = new SpeechSynthesisUtterance(' ');
      u.volume = 0;
      synth.speak(u);
    } catch { /* ignore */ }
    loadVoices();
  };
  window.addEventListener('touchend', unlock, { capture: true, once: true });
  window.addEventListener('click', unlock, { capture: true, once: true });
}

export const canSpeak = () => !!synth;
export const spanishVoices = () => (voices.length ? voices : loadVoices());

// How natural a voice sounds. iOS puts the quality in the voice ID:
// com.apple.voice.premium.es-ES.Marisol, ...enhanced..., ...compact...
// "Eloquence" and novelty voices (Eddy, Flo, Grandma...) are the robotic ones.
const NOVELTY = /eloquence|eddy|flo|grandma|grandpa|reed|rocko|sandy|shelley|albert|bad news|bahh|bells|boing|bubbles|cellos|good news|jester|organ|superstar|trinoids|whisper|wobble|zarvox/i;
export function voiceQuality(v) {
  const id = `${v.voiceURI} ${v.name}`.toLowerCase();
  if (NOVELTY.test(id)) return -1;
  if (id.includes('premium')) return 3;
  if (id.includes('enhanced')) return 2;
  if (id.includes('compact')) return 1;
  return 1.5; // unknown quality, e.g. a Siri or Android voice
}
export const qualityLabel = (v) => ({ '-1': 'robotic', 1: 'basic', 1.5: '', 2: 'enhanced', 3: 'premium' }[voiceQuality(v)] || '');

const PREFERRED = { spain: ['marisol', 'mónica', 'monica', 'jorge'], ca: ['paulina', 'juan', 'marisol'] };
const norm = (l) => l.toLowerCase().replace('_', '-');

export function pickVoice() {
  const s = settings();
  const all = spanishVoices();
  if (s.voiceURI) {
    const v = all.find((x) => x.voiceURI === s.voiceURI);
    if (v) return v;
  }
  const region = s.region === 'ca' ? 'ca' : 'spain';
  const langs = region === 'ca' ? ['es-mx', 'es-us', 'es-419', 'es-co', 'es-es'] : ['es-es', 'es-mx', 'es-us'];
  const names = PREFERRED[region];
  const score = (v) => {
    const li = langs.indexOf(norm(v.lang));
    const ni = names.findIndex((n) => v.name.toLowerCase().includes(n));
    // The right accent beats one step of quality, but never a robotic voice.
    const native = region === 'spain' ? norm(v.lang) === 'es-es' : norm(v.lang) !== 'es-es';
    return voiceQuality(v) * 100 + (native ? 110 : 0) + (li === -1 ? 0 : (langs.length - li) * 10) + (ni === -1 ? 0 : names.length - ni);
  };
  return [...all].sort((a, b) => score(b) - score(a))[0] || null;
}

function chunks(text) {
  return text
    .replace(/\s+/g, ' ')
    .split(/(?<=[.!?…:;»])\s+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

export function speak(text, { onend, onstart, onerror } = {}) {
  if (!synth || !text) { onend?.(); return; }
  const my = ++session;
  const parts = chunks(text);
  const voice = pickVoice();
  const lang = voice ? voice.lang : (settings().region === 'ca' ? 'es-MX' : 'es-ES');
  let started = false;

  const next = (i) => {
    if (my !== session) return; // a newer speak/stop took over
    if (i >= parts.length) { onend?.(); return; }
    const u = new SpeechSynthesisUtterance(parts[i]);
    if (voice) u.voice = voice;
    u.lang = lang;
    u.rate = settings().rate || 0.9;
    u.volume = 1;
    u.onstart = () => { if (!started) { started = true; onstart?.(); } };
    u.onend = () => next(i + 1);
    u.onerror = (e) => {
      if (my !== session) return;
      if (e.error === 'interrupted' || e.error === 'canceled') return;
      onerror?.(e.error || 'error');
      onend?.();
    };
    synth.speak(u);
  };

  const busy = synth.speaking || synth.pending;
  if (busy) synth.cancel();
  try { synth.resume(); } catch { /* ignore */ }
  if (busy) setTimeout(() => next(0), 120); // iOS drops speak() right after cancel()
  else next(0);
}

export function stop() {
  session++;
  try { synth?.cancel(); } catch { /* ignore */ }
}
export const speaking = () => !!synth?.speaking;

// For the Ajustes test button: reports what actually happened,
// plus every Spanish voice the phone lets web apps use.
export function voiceReport() {
  const list = spanishVoices();
  if (!list.length) return 'No Spanish voices reported yet. Tap "Try it" once, then look again.';
  return [...list]
    .sort((a, b) => voiceQuality(b) - voiceQuality(a))
    .map((v) => `${v.name} · ${v.lang}${qualityLabel(v) ? ` · ${qualityLabel(v)}` : ''}`)
    .join('\n');
}

export function diagnose(cb) {
  const v = pickVoice();
  const info = `${spanishVoices().length} Spanish voice(s)${v ? `, using ${v.name}${qualityLabel(v) ? ` (${qualityLabel(v)})` : ''}` : ''}`;
  let done = false;
  const finish = (msg) => { if (!done) { done = true; cb(msg); } };
  speak('Hola, ¿qué tal? Vamos a practicar un poco.', {
    onstart: () => finish(`Playing · ${info}. If you can't hear it, check the silent switch and volume.`),
    onerror: (e) => finish(`Speech error (${e}) · ${info}`),
  });
  setTimeout(() => finish(`Nothing started · ${info}. Try tapping again.`), 2500);
}
