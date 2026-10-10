// Rule-based Spanish conjugator. No AI involved: accurate and offline.
import { STEM_CHANGES, NOT_ZC, IRREG, COMPOUND_BASES, PP_SUFFIX, PP_EXACT } from './verbdata.js';

export const PERSONS = ['yo', 'tu', 'el', 'nos', 'vosotros', 'ellos'];
export const PERSON_LABEL = {
  yo: 'yo', tu: 'tú', vos: 'vos', el: 'él / ella / usted', nos: 'nosotros',
  vosotros: 'vosotros', ellos: 'ellos / ustedes',
};
export const REFL = { yo: 'me', tu: 'te', vos: 'te', el: 'se', nos: 'nos', vosotros: 'os', ellos: 'se' };

export const TENSES = [
  { id: 'presente', es: 'Presente', en: 'Present', group: 'Indicative' },
  { id: 'preterito', es: 'Pretérito indefinido', en: 'Simple past (preterite)', group: 'Indicative' },
  { id: 'imperfecto', es: 'Imperfecto', en: 'Imperfect (used to / was -ing)', group: 'Indicative' },
  { id: 'futuro', es: 'Futuro', en: 'Future (will)', group: 'Indicative' },
  { id: 'condicional', es: 'Condicional', en: 'Conditional (would)', group: 'Indicative' },
  { id: 'perfecto', es: 'Pretérito perfecto', en: 'Present perfect (have done)', group: 'Compound' },
  { id: 'pluscuamperfecto', es: 'Pluscuamperfecto', en: 'Past perfect (had done)', group: 'Compound' },
  { id: 'progresivo', es: 'Presente progresivo', en: 'Present continuous (am doing)', group: 'Compound' },
  { id: 'subj_presente', es: 'Subjuntivo presente', en: 'Present subjunctive', group: 'Subjunctive' },
  { id: 'subj_imperfecto', es: 'Subjuntivo imperfecto', en: 'Imperfect subjunctive', group: 'Subjunctive' },
  { id: 'imperativo', es: 'Imperativo', en: 'Commands', group: 'Commands' },
];
export const TENSE_BY_ID = Object.fromEntries(TENSES.map((t) => [t.id, t]));

// ---------- accent and syllable helpers ----------
const ACC = { a: 'á', e: 'é', i: 'í', o: 'ó', u: 'ú' };
const UNACC = { 'á': 'a', 'é': 'e', 'í': 'i', 'ó': 'o', 'ú': 'u' };
export const stripAcc = (s) => s.replace(/[áéíóú]/g, (c) => UNACC[c]);
const isVowel = (c) => 'aeiouáéíóúü'.includes(c);
const isStrong = (c) => 'aeoáéóíú'.includes(c); // accented i/u break diphthongs

// Returns vowel nuclei as [start, end) index pairs.
function nuclei(word) {
  const w = word.toLowerCase();
  const out = [];
  let i = 0;
  while (i < w.length) {
    const c = w[i];
    const silentU = c === 'u' && i > 0 && 'gq'.includes(w[i - 1]) && 'eiéí'.includes(w[i + 1] || '');
    if (isVowel(c) && !silentU) {
      let j = i + 1;
      while (j < w.length && isVowel(w[j]) && !(isStrong(w[j]) && isStrong(w[j - 1])) && !'íú'.includes(w[j]) && !'íú'.includes(w[j - 1])) j++;
      out.push([i, j]);
      i = j;
    } else i++;
  }
  return out;
}
function stressIndex(word) {
  const n = nuclei(word);
  for (let k = 0; k < n.length; k++) {
    if (/[áéíóú]/.test(word.slice(n[k][0], n[k][1]))) return k;
  }
  const last = word[word.length - 1];
  if (n.length > 1 && (isVowel(last) || last === 'n' || last === 's')) return n.length - 2;
  return n.length - 1;
}
function accentNucleus(word, k) {
  const [s, e] = nuclei(word)[k];
  const seg = word.slice(s, e);
  let pos = -1;
  for (let i = 0; i < seg.length; i++) if ('aeo'.includes(seg[i])) { pos = i; break; }
  if (pos < 0) pos = seg.length - 1;
  const ch = seg[pos];
  return word.slice(0, s + pos) + (ACC[ch] || ch) + word.slice(s + pos + 1);
}
// Attach an enclitic pronoun keeping the original stress: habla + te -> háblate
export function attach(form, clitic) {
  const orig = stressIndex(form);
  const plain = stripAcc(form) + clitic;
  return stressIndex(plain) === orig ? plain : accentNucleus(plain, orig);
}
// Monosyllables carry no written accent (das, veis, dio)
function mono(form) {
  return nuclei(form).length === 1 ? stripAcc(form) : form;
}

// ---------- analysis ----------
function findIrregular(base) {
  if (IRREG[base]) return { entry: IRREG[base], prefix: '', of: base };
  for (const b of COMPOUND_BASES) {
    if (base.length > b.length && base.endsWith(b)) return { entry: IRREG[b], prefix: base.slice(0, -b.length), of: b };
  }
  if (base.endsWith('ducir')) {
    const prefix = base.slice(0, -5);
    return { entry: { pretStem: 'duj', pretJ: true }, prefix, of: 'ducir', pattern: true };
  }
  return null;
}
function findStemChange(base) {
  for (const [type, verbs] of Object.entries(STEM_CHANGES)) if (verbs.includes(base)) return type;
  return null;
}

function applyStem(stem, type) {
  if (!type) return stem;
  const [from, to] = type.split('>');
  const idx = stem.lastIndexOf(from);
  if (idx < 0) return stem;
  let rep = to;
  if (type === 'o>ue' && stem[idx - 1] === 'g') rep = 'üe'; // avergüenzo
  return stem.slice(0, idx) + rep + stem.slice(idx + 1);
}
// -ir stem changers: e -> i, o -> u (preterite 3rd person, gerund, subj nos/vos)
function applyIrNarrow(stem, type) {
  if (!type || type === 'i>ie' || type === 'u>ue') return stem;
  const from = type[0];
  const idx = stem.lastIndexOf(from);
  if (idx < 0) return stem;
  return stem.slice(0, idx) + (from === 'e' ? 'i' : 'u') + stem.slice(idx + 1);
}

// ---------- the conjugator ----------
const END = {
  pres: { ar: ['o', 'as', 'a', 'amos', 'áis', 'an'], er: ['o', 'es', 'e', 'emos', 'éis', 'en'], ir: ['o', 'es', 'e', 'imos', 'ís', 'en'] },
  presVos: { ar: 'ás', er: 'és', ir: 'ís' },
  pret: { ar: ['é', 'aste', 'ó', 'amos', 'asteis', 'aron'], er: ['í', 'iste', 'ió', 'imos', 'isteis', 'ieron'] },
  strong: ['e', 'iste', 'o', 'imos', 'isteis', 'ieron'],
  imperf: { ar: ['aba', 'abas', 'aba', 'ábamos', 'abais', 'aban'], er: ['ía', 'ías', 'ía', 'íamos', 'íais', 'ían'] },
  fut: ['é', 'ás', 'á', 'emos', 'éis', 'án'],
  cond: ['ía', 'ías', 'ía', 'íamos', 'íais', 'ían'],
  subj: { ar: ['e', 'es', 'e', 'emos', 'éis', 'en'], er: ['a', 'as', 'a', 'amos', 'áis', 'an'] },
};

export function isVerbLike(word) {
  return /^[a-zñáéíóúü]+(ar|er|ir|ír)(se)?$/i.test(word.trim());
}

export function conjugate(input, hint = {}) {
  let inf = input.trim().toLowerCase();
  let reflexive = false;
  if (/(ar|er|ir|ír)se$/.test(inf)) { reflexive = true; inf = inf.slice(0, -2); }
  const cls = inf.endsWith('ar') ? 'ar' : inf.endsWith('er') ? 'er' : 'ir';
  const stem0 = inf.slice(0, -2);
  const ec = cls === 'ar' ? 'ar' : 'er'; // er and ir share many endings

  const irr = findIrregular(inf);
  const E = irr ? irr.entry : {};
  const P = irr ? irr.prefix : '';
  const pre = (s) => (s == null ? s : P + s);
  const preArr = (a) => (a ? a.map((s) => P + s) : null);

  const stemType = E.stem || findStemChange(inf) || hint.stemChange || null;
  const stemFromHint = !E.stem && !findStemChange(inf) && !!hint.stemChange;
  const isUir = cls === 'ir' && /uir$/.test(inf) && !/(g|q)uir$/.test(inf);
  const isZc = /[aeiou]c(er|ir)$/.test(inf) && !NOT_ZC.includes(inf) && !(irr && !irr.pattern && E.yo);
  const vowelStem = cls !== 'ar' && /[aeo]$/.test(stripAcc(stem0)) && !isUir;
  const softEnd = /[ñ]$|ll$/.test(stem0); // teñir: tiñó, tiñendo

  // spelling adjustments keep the consonant sound before the ending
  function spell(stem, ending) {
    const f = stripAcc(ending[0] || '');
    if (cls === 'ar' && f === 'e') {
      if (stem.endsWith('gu')) return stem.slice(0, -2) + 'gü';
      if (stem.endsWith('c')) return stem.slice(0, -1) + 'qu';
      if (stem.endsWith('g')) return stem.slice(0, -1) + 'gu';
      if (stem.endsWith('z')) return stem.slice(0, -1) + 'c';
    }
    if (cls !== 'ar' && (f === 'a' || f === 'o')) {
      if (stem.endsWith('gu') && /guir$/.test(inf)) return stem.slice(0, -1);
      if (stem.endsWith('qu') && /quir$/.test(inf)) return stem.slice(0, -2) + 'c';
      if (stem.endsWith('g')) return stem.slice(0, -1) + 'j';
      if (stem.endsWith('c')) return stem.slice(0, -1) + 'z';
    }
    if (isUir && 'aeo'.includes(f)) return stem + 'y';
    return stem;
  }
  const join = (stem, ending) => {
    let e = ending;
    if (softEnd && /^i[aeoó]/.test(e)) e = e.slice(1);
    return spell(stem, e) + e;
  };

  const tags = [];
  const notes = [];
  const note = (text, tenses) => notes.push({ text, tenses });

  // --- present ---
  const boot = applyStem(stem0, stemType);
  let yoForm = null; let subjBase = null;
  if (E.yo) { yoForm = pre(E.yo); if (yoForm.endsWith('o')) subjBase = yoForm.slice(0, -1); }
  if (isZc) { yoForm = stem0.slice(0, -1) + 'zco'; subjBase = stem0.slice(0, -1) + 'zc'; }
  if (E.subjStem) subjBase = pre(E.subjStem);

  let pres;
  if (E.pres) pres = preArr(E.pres);
  else {
    pres = END.pres[cls].map((e, i) => {
      const st = [0, 1, 2, 5].includes(i) ? boot : stem0;
      return mono(join(st, e));
    });
    if (yoForm) pres[0] = yoForm;
  }
  let presVos = E.presVos ? pre(E.presVos) : mono(join(stem0, END.presVos[cls]));
  if (cls === 'ir' && inf.endsWith('ír')) presVos = stem0 + 'ís';

  // --- preterite ---
  let pret;
  if (E.pret) pret = preArr(E.pret);
  else if (E.pretStem) {
    const ps = pre(E.pretStem);
    pret = END.strong.map((e) => ps + e);
    if (E.pretJ) pret[5] = ps + 'eron';
    if (E.pret3) pret[2] = pre(E.pret3);
  } else {
    pret = END.pret[ec].map((e, i) => {
      let st = stem0;
      if (cls === 'ir' && (i === 2 || i === 5)) st = applyIrNarrow(stem0, stemType);
      let end = e;
      if (vowelStem) {
        if (i === 2) end = 'yó';
        else if (i === 5) end = 'yeron';
        else end = e.replace(/^i/, 'í'); // leíste, leímos
      } else if (isUir) {
        if (i === 2) end = 'yó';
        if (i === 5) end = 'yeron';
      }
      return mono(join(st, end));
    });
  }

  // --- imperfect ---
  const imperf = E.imperf ? preArr(E.imperf) : END.imperf[ec].map((e) => stem0 + e);

  // --- future / conditional ---
  const futStem = E.fut ? pre(E.fut) : stripAcc(inf);
  const fut = END.fut.map((e) => futStem + e);
  const cond = END.cond.map((e) => futStem + e);

  // --- participle / gerund ---
  let pp = PP_EXACT[inf] || null;
  if (!pp && E.pp) pp = pre(E.pp);
  if (!pp) for (const [suf, rep] of PP_SUFFIX) if (inf.endsWith(suf)) { pp = inf.slice(0, -suf.length) + rep; break; }
  const ppIrregular = !!pp;
  if (!pp) pp = cls === 'ar' ? stem0 + 'ado' : stem0 + (vowelStem ? 'ído' : 'ido');

  let ger = E.ger ? pre(E.ger) : null;
  if (!ger) {
    if (cls === 'ar') ger = stem0 + 'ando';
    else if (vowelStem || isUir) ger = stem0 + 'yendo';
    else {
      const st = cls === 'ir' ? applyIrNarrow(stem0, stemType) : stem0;
      ger = join(st, 'iendo');
    }
  }

  // --- present subjunctive ---
  let subj;
  if (E.subj) subj = preArr(E.subj);
  else subj = END.subj[ec].map((e, i) => {
    if (subjBase) return subjBase + e;
    let st = [0, 1, 2, 5].includes(i) ? boot : stem0;
    if (cls === 'ir' && (i === 3 || i === 4)) st = applyIrNarrow(stem0, stemType);
    return mono(join(st, e));
  });

  // --- imperfect subjunctive (from ellos preterite) ---
  const pb = pret[5].slice(0, -3); // hablaron -> habla
  const subjImp = ['ra', 'ras', 'ra', 'ramos', 'rais', 'ran'].map((e, i) => {
    if (i === 3) return pb.slice(0, -1) + (ACC[pb.slice(-1)] || pb.slice(-1)) + e;
    return pb + e;
  });

  // --- imperative (affirmative) ---
  let impTu = 'impTu' in E ? (E.impTu == null ? null : pre(E.impTu)) : pres[2];
  if (irr && irr.of === 'decir' && P) impTu = pres[2]; // predice
  const ACC_IMP = { ten: 'tén', pon: 'pón', ven: 'vén' };
  if (P && ACC_IMP[E.impTu]) impTu = P + ACC_IMP[E.impTu]; // detén, compón
  let impVos = 'impVos' in E ? (E.impVos == null ? null : pre(E.impVos)) : null;
  if (impVos === null && !('impVos' in E)) {
    const v = inf.slice(0, -1);
    impVos = /[áéí]$/.test(v) ? v : mono(v.slice(0, -1) + ACC[v.slice(-1)]);
  }
  const impNos = E.impNos ? pre(E.impNos) : subj[3];
  const impVosotros = E.impVosotros ? pre(E.impVosotros) : inf.slice(0, -1) + 'd';
  const hasImp = E.impTu !== null;

  // ---------- assemble ----------
  const toObj = (arr) => Object.fromEntries(PERSONS.map((p, i) => [p, arr[i]]));
  const R = (p, form) => (reflexive && form ? `${REFL[p]} ${form}` : form);
  const simple = (arr, vosForm) => {
    const o = {};
    PERSONS.forEach((p, i) => { o[p] = R(p, arr[i]); });
    o.vos = R('vos', vosForm ?? arr[1]);
    return o;
  };
  const HAB = { pres: ['he', 'has', 'ha', 'hemos', 'habéis', 'han'], imp: ['había', 'habías', 'había', 'habíamos', 'habíais', 'habían'] };
  const EST = ['estoy', 'estás', 'está', 'estamos', 'estáis', 'están'];
  const compound = (aux, part, vosAux) => {
    const o = {};
    PERSONS.forEach((p, i) => { o[p] = R(p, `${aux[i]} ${part}`); });
    o.vos = R('vos', `${vosAux ?? aux[1]} ${part}`);
    return o;
  };

  let imperativo = null;
  if (hasImp) {
    const r = (form, cl) => (reflexive ? attach(form, cl) : form);
    let nos = impNos; let vosotros = impVosotros;
    if (reflexive) {
      nos = attach(impNos.replace(/s$/, ''), 'nos');
      if (inf === 'ir') vosotros = 'idos';
      else if (impVosotros.endsWith('id')) vosotros = impVosotros.slice(0, -2) + 'íos';
      else vosotros = impVosotros.slice(0, -1) + 'os'; // levantaos, poneos
    }
    imperativo = {
      yo: null,
      tu: impTu ? r(impTu, 'te') : null,
      vos: impVos ? r(impVos, 'te') : null,
      el: r(subj[2], 'se'),
      nos,
      vosotros,
      ellos: r(subj[5], 'se'),
    };
  }

  const forms = {
    presente: simple(pres, presVos),
    preterito: simple(pret),
    imperfecto: simple(imperf),
    futuro: simple(fut),
    condicional: simple(cond),
    perfecto: compound(HAB.pres, pp),
    pluscuamperfecto: compound(HAB.imp, pp),
    progresivo: compound(EST, ger, 'estás'),
    subj_presente: simple(subj),
    subj_imperfecto: simple(subjImp),
    imperativo,
  };

  // ---------- notes: the "remember this" callouts ----------
  const full = (reflexive ? inf + 'se' : inf);
  if (E.full) { tags.push('Irregular'); note(`One of the core irregular verbs: worth learning each tense as a set.`, ['presente', 'preterito', 'imperfecto', 'subj_presente']); }
  if (irr && P && !irr.pattern) { tags.push(`Like ${irr.of}`); note(`Conjugates exactly like ${irr.of}: ${pres[0]}, ${pret[0]}${E.fut ? ', ' + fut[0] : ''}.`, ['presente', 'preterito', 'futuro']); }
  if (irr && irr.pattern) { tags.push('-ducir pattern'); }
  if (stemType) {
    const label = stemType.replace('>', '→');
    tags.push(`Stem change ${label}`);
    note(`Stem-changing ${label} in the "boot" (yo, tú, él, ellos): ${pres[1]}, ${pres[5]}, but ${pres[3]}.${stemFromHint ? ' (pattern suggested by AI, double-check)' : ''}`, ['presente', 'subj_presente']);
    if (cls === 'ir' && !E.pretStem && !E.pret && stemType !== 'i>ie') {
      note(`-ir stem-changer: in the preterite only él and ellos change: ${pret[2]}, ${pret[5]}. Gerund: ${ger}.`, ['preterito', 'progresivo', 'subj_imperfecto']);
      note(`In the subjunctive, nosotros and vosotros also change: ${subj[3]}.`, ['subj_presente']);
    }
  }
  if (E.yo && !E.full && E.yo !== 'veo') {
    tags.push('Irregular yo');
    note(`Irregular yo form: ${pres[0]}.${subjBase ? ` The present subjunctive is built from it: ${subj[0]}, ${subj[3]}.` : ''}`, ['presente', 'subj_presente']);
  }
  if (isZc) { tags.push('-zco'); note(`Vowel + -cer/-cir verbs add z in yo: ${pres[0]}, and in every subjunctive form: ${subj[0]}.`, ['presente', 'subj_presente']); }
  if (isUir) { tags.push('Adds y'); note(`-uir verbs add a y: ${pres[0]}, ${pres[2]} (but ${pres[3]}). Preterite ${pret[2]}, ${pret[5]}.`, ['presente', 'preterito', 'subj_presente']); }
  if (!E.pret && !E.pretStem && !irr) {
    if (cls === 'ar' && /(c|g|z|gu)ar$/.test(inf)) { tags.push('Spelling change'); note(`Spelling change before e to keep the sound: ${pret[0]}, ${subj[0]}.`, ['preterito', 'subj_presente', 'imperativo']); }
    if (cls !== 'ar' && /(g|c|gu)(er|ir)$/.test(inf) && !isZc) { tags.push('Spelling change'); note(`Spelling change before a/o to keep the sound: ${pres[0]}, ${subj[0]}.`, ['presente', 'subj_presente']); }
  }
  if (vowelStem && !E.pret && !E.pretStem) { tags.push('y in preterite'); note(`The i becomes y between vowels: ${pret[2]}, ${pret[5]}, and accents appear: ${pret[1]}. Gerund: ${ger}.`, ['preterito', 'progresivo', 'subj_imperfecto']); }
  if (E.pretStem) {
    tags.push('Irregular preterite');
    note(`Irregular preterite stem ${pre(E.pretStem)}-: ${pret[0]}, ${pret[2]}. These forms never take an accent.`, ['preterito', 'subj_imperfecto']);
    if (E.pretJ) note(`Stem ends in j, so ellos is ${pret[5]} (not ${pret[5].replace('eron', 'ieron')}).`, ['preterito', 'subj_imperfecto']);
  }
  if (E.pret && !E.full) { tags.push('Irregular preterite'); note(`Irregular preterite: ${pret.slice(0, 3).join(', ')}.`, ['preterito']); }
  if (E.fut) { tags.push('Irregular future'); note(`Irregular stem in the future and conditional: ${fut[0]}, ${cond[0]}.`, ['futuro', 'condicional']); }
  if (ppIrregular) { tags.push('Irregular participle'); note(`Irregular participle: ${pp} (he ${pp}, había ${pp}).`, ['perfecto', 'pluscuamperfecto']); }
  if (E.ger) note(`Irregular gerund: ${ger}.`, ['progresivo']);
  if ('impTu' in E && E.impTu && impTu !== pres[2]) note(`Short tú command: ${impTu}.`, ['imperativo']);
  if (E.subj && !E.full) note(`Irregular subjunctive: ${subj[0]}, ${subj[3]}.`, ['subj_presente']);
  if (E.imperf) note(`Irregular imperfect: ${imperf[0]}, ${imperf[3]}.`, ['imperfecto']);
  note(`Imperfect subjunctive is built from the ellos preterite: ${pret[5]} → ${subjImp[0]}.`, ['subj_imperfecto']);
  if (reflexive) { tags.push('Reflexive'); note(`Reflexive: the pronoun goes before the verb (${forms.presente.yo}) but sticks onto commands (${imperativo?.tu || imperativo?.el}).`, ['presente', 'imperativo']); }
  if (!tags.length) tags.push(`Regular -${cls}`);

  return {
    infinitive: full, base: inf, cls, reflexive,
    regular: tags.length === 1 && tags[0].startsWith('Regular'),
    tags, notes, gerund: ger, participle: pp, forms,
  };
}
