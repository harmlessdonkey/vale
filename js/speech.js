// Text-to-speech using the voices built into the phone. Free and offline.
import { settings } from './store.js';

const synth = typeof window !== 'undefined' ? window.speechSynthesis : null;
let voices = [];

function loadVoices() {
  if (!synth) return [];
  voices = synth.getVoices().filter((v) => v.lang && v.lang.toLowerCase().startsWith('es'));
  return voices;
}
if (synth) {
  loadVoices();
  synth.addEventListener?.('voiceschanged', loadVoices);
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

export function speak(text, { onend } = {}) {
  if (!synth) return;
  synth.cancel();
  const u = new SpeechSynthesisUtterance(text);
  const v = pickVoice();
  if (v) { u.voice = v; u.lang = v.lang; } else u.lang = settings().region === 'ca' ? 'es-MX' : 'es-ES';
  u.rate = settings().rate || 0.9;
  if (onend) { u.onend = onend; u.onerror = onend; }
  synth.speak(u);
}
export const stop = () => synth?.cancel();
export const speaking = () => !!synth?.speaking;
