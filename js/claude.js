// Thin client for the Claude API, called straight from the phone.
// The key lives only in this device's storage (Settings).
import { settings } from './store.js';
import { TENSE_BY_ID } from './conjugator.js';

const API = 'https://api.anthropic.com/v1/messages';

export const hasKey = () => !!settings().apiKey;

export class AIError extends Error {}

async function callTool({ system, prompt, tool, maxTokens = 1500 }) {
  const s = settings();
  if (!s.apiKey) throw new AIError('Add your Claude API key in Ajustes first.');
  let res;
  try {
    res = await fetch(API, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': s.apiKey,
        'anthropic-version': '2023-06-01',
        'anthropic-dangerous-direct-browser-access': 'true',
      },
      body: JSON.stringify({
        model: s.model || 'claude-sonnet-5-5',
        max_tokens: maxTokens,
        // Newer models don't allow forcing a specific tool, so we ask firmly
        // and fall back to reading JSON from the text if needed.
        system: `${system}\n\nAlways answer by calling the ${tool.name} tool exactly once. Do not reply with plain text.`,
        tools: [tool],
        tool_choice: { type: 'auto' },
        messages: [{ role: 'user', content: prompt }],
      }),
    });
  } catch {
    throw new AIError('No connection. Check your internet and try again.');
  }
  if (!res.ok) {
    let msg = `Claude API error ${res.status}`;
    try { const j = await res.json(); if (j?.error?.message) msg += `: ${j.error.message}`; } catch { /* ignore */ }
    if (res.status === 401) msg = 'The API key was rejected. Check it in Ajustes.';
    if (res.status === 429) msg = 'Rate limited. Wait a moment and try again.';
    if (res.status === 404 && /model/i.test(msg)) msg = 'That model name was not found. Pick another model in Ajustes.';
    throw new AIError(msg);
  }
  const data = await res.json();
  const block = (data.content || []).find((b) => b.type === 'tool_use');
  if (block) return block.input;
  const text = (data.content || []).filter((b) => b.type === 'text').map((b) => b.text).join('');
  const json = text.slice(text.indexOf('{'), text.lastIndexOf('}') + 1);
  try { if (json) return JSON.parse(json); } catch { /* fall through */ }
  throw new AIError('Claude replied in an unexpected format. Try again.');
}

const regionText = (r) => (r === 'ca'
  ? 'Central American Spanish (Honduras, El Salvador, Nicaragua): voseo in informal speech (vos tenés, vos sos), ustedes as plural you, regional vocabulary where natural.'
  : 'Spain Spanish: tú and vosotros, Spain vocabulary (coche, zumo, ordenador).');

// ---------- enrich a new word ----------
const ENRICH_TOOL = {
  name: 'describe_item',
  description: 'Describe a Spanish word or phrase for a learner\'s personal vocabulary list.',
  input_schema: {
    type: 'object',
    properties: {
      type: { type: 'string', enum: ['verb', 'noun', 'adjective', 'adverb', 'phrase', 'other'] },
      spanish: { type: 'string', description: 'Dictionary form in Spanish. Verbs: infinitive (with -se only if the reflexive is the usual meaning). Nouns: singular, no article. If the learner typed English, give the most useful Spanish equivalent.' },
      english: { type: 'string', description: 'Short English meaning, e.g. "to miss (someone)".' },
      gender: { type: 'string', enum: ['m', 'f', 'both', 'none'], description: 'Nouns only, otherwise none.' },
      literal: { type: 'string', description: 'Phrases only: word-for-word English, if it differs from the meaning. Else empty.' },
      notes: {
        type: 'array', items: { type: 'string' }, maxItems: 3,
        description: 'Memory hooks ONLY if genuinely useful: gender exceptions (el problema, el agua), false friends, easily confused words, key collocations or prepositions. One short sentence each. Empty array for ordinary words. Never describe verb conjugation patterns; the app handles those.',
      },
      regional: {
        type: 'array', maxItems: 3,
        items: { type: 'object', properties: { where: { type: 'string' }, note: { type: 'string' } }, required: ['where', 'note'] },
        description: 'Only real differences between Spain and Latin America, especially Central America (e.g. coger is vulgar in much of Latin America, use agarrar/tomar). Empty array if none.',
      },
      example: {
        type: 'object', properties: { es: { type: 'string' }, en: { type: 'string' } }, required: ['es', 'en'],
        description: 'One short, natural everyday sentence using it.',
      },
      stem_change: { type: 'string', enum: ['none', 'e>ie', 'o>ue', 'e>i', 'u>ue', 'i>ie'], description: 'Verbs only: present-tense stem change.' },
    },
    required: ['type', 'spanish', 'english', 'gender', 'notes', 'regional', 'example', 'stem_change'],
  },
};

export async function enrich(text, typeHint) {
  const s = settings();
  return callTool({
    system: `You help an English-speaking ${s.level}-level learner of Spanish build a personal vocabulary list. Be accurate and concise. Use plain English, no em dashes. Example sentences follow ${regionText(s.region)}`,
    prompt: `The learner added: "${text}"${typeHint && typeHint !== 'auto' ? ` (they marked it as a ${typeHint})` : ''}. Describe it.`,
    tool: ENRICH_TOOL,
    maxTokens: 700,
  });
}

// ---------- stories ----------
const STORY_TOOL = {
  name: 'story',
  description: 'A short graded-reader story with glossary and questions.',
  input_schema: {
    type: 'object',
    properties: {
      title: { type: 'string' },
      paragraphs: { type: 'array', items: { type: 'string' }, description: 'The story in Spanish, 2 to 4 short paragraphs.' },
      translation: { type: 'array', items: { type: 'string' }, description: 'Natural English translation, one entry per paragraph.' },
      glossary: {
        type: 'array',
        description: 'Every word in the story except the most basic function words (el, la, de, y, que, en, a, un, una, no, se...). One entry per distinct form as it appears.',
        items: {
          type: 'object',
          properties: {
            form: { type: 'string', description: 'Exactly as written in the story, lowercase.' },
            lemma: { type: 'string', description: 'Dictionary form (infinitive for verbs).' },
            en: { type: 'string', description: 'Meaning in this context.' },
            tense: { type: 'string', description: 'Verbs only: one of presente, preterito, imperfecto, futuro, condicional, perfecto, pluscuamperfecto, progresivo, subj_presente, subj_imperfecto, imperativo, infinitivo, gerundio, participio.' },
            person: { type: 'string', description: 'Verbs only: yo, tu, vos, el, nos, vosotros, ellos.' },
            note: { type: 'string', description: 'Optional very short note (idiom, regionalism). Usually empty.' },
          },
          required: ['form', 'lemma', 'en'],
        },
      },
      used: { type: 'array', items: { type: 'string' }, description: 'Which of the target words and phrases you used (dictionary form as given).' },
      questions: {
        type: 'array', minItems: 3, maxItems: 3,
        items: {
          type: 'object',
          properties: {
            q: { type: 'string', description: 'Question in simple Spanish.' },
            options: { type: 'array', items: { type: 'string' }, minItems: 3, maxItems: 4 },
            answer: { type: 'integer', description: 'Index of the correct option.' },
            explain: { type: 'string', description: 'One short sentence in English.' },
          },
          required: ['q', 'options', 'answer', 'explain'],
        },
      },
    },
    required: ['title', 'paragraphs', 'translation', 'glossary', 'used', 'questions'],
  },
};

export const TOPICS = {
  sorpresa: 'anything fun or surprising',
  viaje: 'travelling in Central America: buses, beaches, ruins, markets',
  dia: 'everyday life: shopping, cooking, friends, errands',
  trabajo: 'work life in an office',
  comida: 'food, cafés and restaurants',
  dialogo: 'mostly dialogue between two people',
};

export async function story({ targets, tenses, topic, length }) {
  const s = settings();
  const words = length === 'long' ? '200 to 260' : '110 to 160';
  const tenseList = tenses.map((t) => `${TENSE_BY_ID[t]?.es} (${TENSE_BY_ID[t]?.en})`).join('; ');
  const targetList = targets.map((t) => `- ${t.es} (${t.en || '?'})${t.type === 'phrase' ? ' [phrase]' : ''}`).join('\n');
  return callTool({
    system: `You write short graded-reader stories for an English-speaking ${s.level}-level learner of Spanish. Write natural, engaging Spanish with short sentences and high-frequency vocabulary apart from the target words. Use ${regionText(s.region)}`,
    prompt: `Write a story of ${words} words. Topic: ${TOPICS[topic] || TOPICS.sorpresa}.

Conjugated verbs must use ONLY these tenses: ${tenseList}. Infinitives and gerunds after other verbs are fine. Do not use any other tense.

Work in as many of these target words and phrases as fit naturally (inflect them as needed):
${targetList || '- (none yet: pick useful everyday words)'}

Then give the glossary, the English translation, and 3 comprehension questions.`,
    tool: STORY_TOOL,
    maxTokens: 4000,
  });
}

// ---------- single word lookup inside a story ----------
const LOOKUP_TOOL = {
  name: 'gloss',
  description: 'Explain one word in context.',
  input_schema: {
    type: 'object',
    properties: {
      lemma: { type: 'string' }, en: { type: 'string' },
      tense: { type: 'string' }, person: { type: 'string' }, note: { type: 'string' },
    },
    required: ['lemma', 'en'],
  },
};
export async function lookup(word, sentence) {
  return callTool({
    system: 'You explain Spanish words to a learner. Short answers, plain English.',
    prompt: `Word: "${word}"\nSentence: "${sentence}"\nGive the dictionary form, the meaning here, and for verbs the tense id (presente, preterito, imperfecto, futuro, condicional, perfecto, pluscuamperfecto, progresivo, subj_presente, subj_imperfecto, imperativo) and person (yo, tu, vos, el, nos, vosotros, ellos).`,
    tool: LOOKUP_TOOL,
    maxTokens: 300,
  });
}

export async function ping() {
  return callTool({
    system: 'Reply using the tool.',
    prompt: 'Say hola.',
    tool: { name: 'reply', description: 'Reply', input_schema: { type: 'object', properties: { text: { type: 'string' } }, required: ['text'] } },
    maxTokens: 50,
  });
}
