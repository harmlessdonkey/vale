// Verb pattern data for the conjugator.
// Stem-changing verbs can't be predicted from spelling, so they are listed.

const list = (s) => s.trim().split(/\s+/);

export const STEM_CHANGES = {
  'e>ie': list(`
    pensar empezar comenzar cerrar encerrar despertar sentar calentar confesar gobernar
    recomendar atravesar apretar merendar tropezar quebrar sembrar manifestar temblar
    acertar enterrar nevar negar fregar regar renegar plegar desplegar concertar
    entender perder querer defender encender tender extender atender descender ascender
    sentir mentir preferir divertir convertir advertir sugerir hervir herir referir
    invertir consentir requerir digerir arrepentir presentir desmentir`),
  'o>ue': list(`
    contar encontrar costar mostrar demostrar probar aprobar comprobar recordar soñar
    sonar volar almorzar acostar colgar descolgar rogar forzar esforzar soltar tostar
    renovar apostar acordar consolar rodar avergonzar poder volver devolver envolver
    revolver resolver disolver mover conmover promover remover llover doler soler morder
    torcer retorcer cocer dormir morir`),
  'e>i': list(`
    pedir servir repetir seguir conseguir perseguir proseguir vestir medir despedir
    impedir competir elegir corregir gemir rendir teñir reñir ceñir concebir derretir
    expedir investir`),
  'u>ue': ['jugar'],
  'i>ie': ['adquirir', 'inquirir'],
};

// Verbs ending in vowel + cer/cir that do NOT take -zco.
export const NOT_ZC = ['hacer', 'decir', 'cocer', 'recocer', 'escocer', 'mecer'];

// Irregular base verbs. Compounds (detener, componer, sonreír...) reuse these.
export const IRREG = {
  ser: {
    full: true,
    pres: ['soy', 'eres', 'es', 'somos', 'sois', 'son'], presVos: 'sos',
    pret: ['fui', 'fuiste', 'fue', 'fuimos', 'fuisteis', 'fueron'],
    imperf: ['era', 'eras', 'era', 'éramos', 'erais', 'eran'],
    subj: ['sea', 'seas', 'sea', 'seamos', 'seáis', 'sean'],
    impTu: 'sé', impVos: 'sé', ger: 'siendo', pp: 'sido',
  },
  estar: {
    pres: ['estoy', 'estás', 'está', 'estamos', 'estáis', 'están'],
    pretStem: 'estuv',
    subj: ['esté', 'estés', 'esté', 'estemos', 'estéis', 'estén'],
    impTu: 'está', impVos: 'está',
  },
  ir: {
    full: true,
    pres: ['voy', 'vas', 'va', 'vamos', 'vais', 'van'], presVos: 'vas',
    pret: ['fui', 'fuiste', 'fue', 'fuimos', 'fuisteis', 'fueron'],
    imperf: ['iba', 'ibas', 'iba', 'íbamos', 'ibais', 'iban'],
    subj: ['vaya', 'vayas', 'vaya', 'vayamos', 'vayáis', 'vayan'],
    impTu: 've', impVos: 'andá', impNos: 'vamos', impVosotros: 'id', ger: 'yendo', pp: 'ido',
  },
  haber: {
    full: true,
    pres: ['he', 'has', 'ha', 'hemos', 'habéis', 'han'], presVos: 'has',
    pretStem: 'hub', fut: 'habr',
    subj: ['haya', 'hayas', 'haya', 'hayamos', 'hayáis', 'hayan'],
    impTu: null, impVos: null,
  },
  dar: {
    pres: ['doy', 'das', 'da', 'damos', 'dais', 'dan'], presVos: 'das',
    pret: ['di', 'diste', 'dio', 'dimos', 'disteis', 'dieron'],
    subj: ['dé', 'des', 'dé', 'demos', 'deis', 'den'],
  },
  ver: {
    yo: 'veo',
    pret: ['vi', 'viste', 'vio', 'vimos', 'visteis', 'vieron'],
    imperf: ['veía', 'veías', 'veía', 'veíamos', 'veíais', 'veían'],
    ger: 'viendo', pp: 'visto',
  },
  saber: { yo: 'sé', pretStem: 'sup', fut: 'sabr', subjStem: 'sep' },
  caber: { yo: 'quepo', pretStem: 'cup', fut: 'cabr' },
  tener: { yo: 'tengo', stem: 'e>ie', pretStem: 'tuv', fut: 'tendr', impTu: 'ten' },
  venir: { yo: 'vengo', stem: 'e>ie', pretStem: 'vin', fut: 'vendr', impTu: 'ven', ger: 'viniendo' },
  poner: { yo: 'pongo', pretStem: 'pus', fut: 'pondr', impTu: 'pon', pp: 'puesto' },
  hacer: { yo: 'hago', pretStem: 'hic', pret3: 'hizo', fut: 'har', impTu: 'haz', pp: 'hecho' },
  decir: { yo: 'digo', stem: 'e>i', pretStem: 'dij', pretJ: true, fut: 'dir', impTu: 'di', pp: 'dicho', ger: 'diciendo' },
  salir: { yo: 'salgo', fut: 'saldr', impTu: 'sal' },
  traer: { yo: 'traigo', pretStem: 'traj', pretJ: true },
  caer: { yo: 'caigo' },
  valer: { yo: 'valgo', fut: 'valdr' },
  'oír': {
    pres: ['oigo', 'oyes', 'oye', 'oímos', 'oís', 'oyen'], presVos: 'oís',
    yo: 'oigo', impTu: 'oye',
  },
  poder: { stem: 'o>ue', pretStem: 'pud', fut: 'podr', ger: 'pudiendo' },
  querer: { stem: 'e>ie', pretStem: 'quis', fut: 'querr' },
  andar: { pretStem: 'anduv' },
  'reír': {
    stem: 'e>i',
    pres: ['río', 'ríes', 'ríe', 'reímos', 'reís', 'ríen'], presVos: 'reís',
    pret: ['reí', 'reíste', 'rió', 'reímos', 'reísteis', 'rieron'],
    subj: ['ría', 'rías', 'ría', 'riamos', 'riais', 'rían'],
    impTu: 'ríe', ger: 'riendo', pp: 'reído',
  },
  oler: {
    stem: 'o>ue',
    pres: ['huelo', 'hueles', 'huele', 'olemos', 'oléis', 'huelen'],
    subj: ['huela', 'huelas', 'huela', 'olamos', 'oláis', 'huelan'],
    impTu: 'huele',
  },
};

// Bases whose prefixed compounds conjugate the same way (detener, sonreír...).
export const COMPOUND_BASES = ['tener', 'poner', 'venir', 'hacer', 'decir', 'traer', 'salir', 'caer', 'valer', 'oír', 'reír'];

// Irregular past participles matched by ending.
export const PP_SUFFIX = [
  ['scribir', 'scrito'], ['brir', 'bierto'], ['olver', 'uelto'], ['morir', 'muerto'],
  ['poner', 'puesto'], ['hacer', 'hecho'], ['decir', 'dicho'], ['imprimir', 'impreso'],
];
export const PP_EXACT = { romper: 'roto', ver: 'visto', prever: 'previsto', 'freír': 'frito' };
