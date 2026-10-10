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

function pickVoice() {
  const s = settings();
  const all = spanishVoices();
  if (s.voiceURI) {
    const v = all.find((x) => x.voiceURI === s.voiceURI);
    if (v) return v;
  }
  const prefs = s.region === 'ca' ? ['es-mx', 'es-us', 'es-419', 'es-co', 'es-es'] : ['es-es', 'es-mx', 'es-us'];
  for (const p of prefs) {
    const v = all.find((x) => x.lang.toLowerCase().replace('_', '-') === p);
    if (v) return v;
  }
  return all[0] || null;
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

// For the Ajustes test button: reports what actually happened.
export function diagnose(cb) {
  const v = pickVoice();
  const info = `${spanishVoices().length} Spanish voice(s)${v ? `, using ${v.name}` : ''}`;
  let done = false;
  const finish = (msg) => { if (!done) { done = true; cb(msg); } };
  speak('Hola, ¿qué tal? Vamos a practicar un poco.', {
    onstart: () => finish(`Playing · ${info}. If you can't hear it, check the silent switch and volume.`),
    onerror: (e) => finish(`Speech error (${e}) · ${info}`),
  });
  setTimeout(() => finish(`Nothing started · ${info}. Try tapping again.`), 2500);
}
