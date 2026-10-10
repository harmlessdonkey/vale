import { conjugate } from '../js/conjugator.js';

// [verb, tense, person, expected]
const cases = [
  ['hablar', 'presente', 'tu', 'hablas'], ['hablar', 'presente', 'vos', 'hablás'],
  ['hablar', 'preterito', 'yo', 'hablé'], ['hablar', 'subj_imperfecto', 'nos', 'habláramos'],
  ['comer', 'imperfecto', 'nos', 'comíamos'], ['vivir', 'presente', 'vosotros', 'vivís'],
  ['vivir', 'imperativo', 'vos', 'viví'], ['hablar', 'imperativo', 'tu', 'habla'],
  ['hablar', 'imperativo', 'vosotros', 'hablad'], ['comer', 'perfecto', 'el', 'ha comido'],
  ['ser', 'presente', 'vos', 'sos'], ['ser', 'imperfecto', 'nos', 'éramos'], ['ser', 'imperativo', 'tu', 'sé'],
  ['ir', 'preterito', 'ellos', 'fueron'], ['ir', 'subj_imperfecto', 'nos', 'fuéramos'], ['ir', 'progresivo', 'yo', 'estoy yendo'],
  ['irse', 'imperativo', 'nos', 'vámonos'], ['irse', 'imperativo', 'tu', 'vete'], ['irse', 'imperativo', 'vosotros', 'idos'],
  ['estar', 'preterito', 'yo', 'estuve'], ['estar', 'subj_presente', 'tu', 'estés'],
  ['tener', 'presente', 'yo', 'tengo'], ['tener', 'presente', 'tu', 'tienes'], ['tener', 'presente', 'vos', 'tenés'],
  ['tener', 'preterito', 'el', 'tuvo'], ['tener', 'futuro', 'yo', 'tendré'], ['tener', 'subj_presente', 'nos', 'tengamos'],
  ['tener', 'imperativo', 'tu', 'ten'], ['tener', 'imperativo', 'vos', 'tené'], ['tener', 'subj_imperfecto', 'yo', 'tuviera'],
  ['detener', 'imperativo', 'tu', 'detén'], ['mantener', 'presente', 'el', 'mantiene'], ['obtener', 'preterito', 'yo', 'obtuve'],
  ['componer', 'perfecto', 'yo', 'he compuesto'], ['proponer', 'futuro', 'nos', 'propondremos'],
  ['hacer', 'preterito', 'el', 'hizo'], ['hacer', 'perfecto', 'nos', 'hemos hecho'], ['hacer', 'imperativo', 'tu', 'haz'],
  ['deshacer', 'perfecto', 'yo', 'he deshecho'],
  ['decir', 'presente', 'yo', 'digo'], ['decir', 'presente', 'el', 'dice'], ['decir', 'preterito', 'ellos', 'dijeron'],
  ['decir', 'progresivo', 'yo', 'estoy diciendo'], ['decir', 'futuro', 'tu', 'dirás'], ['decir', 'imperativo', 'tu', 'di'],
  ['venir', 'presente', 'el', 'viene'], ['venir', 'preterito', 'yo', 'vine'], ['venir', 'progresivo', 'yo', 'estoy viniendo'],
  ['poder', 'presente', 'yo', 'puedo'], ['poder', 'presente', 'nos', 'podemos'], ['poder', 'preterito', 'yo', 'pude'],
  ['poder', 'condicional', 'yo', 'podría'], ['querer', 'preterito', 'yo', 'quise'], ['querer', 'futuro', 'yo', 'querré'],
  ['saber', 'presente', 'yo', 'sé'], ['saber', 'subj_presente', 'yo', 'sepa'], ['saber', 'preterito', 'el', 'supo'],
  ['caber', 'presente', 'yo', 'quepo'], ['ver', 'preterito', 'el', 'vio'], ['ver', 'presente', 'vosotros', 'veis'],
  ['ver', 'imperfecto', 'yo', 'veía'], ['ver', 'perfecto', 'yo', 'he visto'], ['ver', 'subj_presente', 'yo', 'vea'],
  ['dar', 'presente', 'yo', 'doy'], ['dar', 'subj_presente', 'el', 'dé'], ['dar', 'preterito', 'el', 'dio'],
  ['dar', 'presente', 'vosotros', 'dais'], ['dar', 'presente', 'vos', 'das'],
  ['oír', 'presente', 'tu', 'oyes'], ['oír', 'preterito', 'el', 'oyó'], ['oír', 'preterito', 'tu', 'oíste'],
  ['oír', 'subj_presente', 'yo', 'oiga'], ['oír', 'futuro', 'yo', 'oiré'], ['oír', 'perfecto', 'yo', 'he oído'],
  ['leer', 'preterito', 'ellos', 'leyeron'], ['leer', 'preterito', 'nos', 'leímos'], ['leer', 'progresivo', 'yo', 'estoy leyendo'],
  ['leer', 'perfecto', 'yo', 'he leído'], ['creer', 'subj_imperfecto', 'yo', 'creyera'],
  ['caer', 'presente', 'yo', 'caigo'], ['caer', 'preterito', 'el', 'cayó'],
  ['traer', 'preterito', 'ellos', 'trajeron'], ['traer', 'progresivo', 'yo', 'estoy trayendo'],
  ['construir', 'presente', 'yo', 'construyo'], ['construir', 'presente', 'nos', 'construimos'],
  ['construir', 'preterito', 'el', 'construyó'], ['construir', 'preterito', 'yo', 'construí'],
  ['construir', 'subj_presente', 'nos', 'construyamos'], ['construir', 'progresivo', 'yo', 'estoy construyendo'],
  ['conocer', 'presente', 'yo', 'conozco'], ['conocer', 'subj_presente', 'nos', 'conozcamos'],
  ['conducir', 'preterito', 'yo', 'conduje'], ['traducir', 'preterito', 'ellos', 'tradujeron'], ['traducir', 'presente', 'yo', 'traduzco'],
  ['vencer', 'presente', 'yo', 'venzo'], ['coger', 'presente', 'yo', 'cojo'], ['coger', 'subj_presente', 'el', 'coja'],
  ['buscar', 'preterito', 'yo', 'busqué'], ['buscar', 'subj_presente', 'el', 'busque'], ['llegar', 'preterito', 'yo', 'llegué'],
  ['empezar', 'preterito', 'yo', 'empecé'], ['empezar', 'presente', 'yo', 'empiezo'], ['empezar', 'subj_presente', 'el', 'empiece'],
  ['almorzar', 'presente', 'yo', 'almuerzo'], ['almorzar', 'subj_presente', 'nos', 'almorcemos'],
  ['jugar', 'presente', 'yo', 'juego'], ['jugar', 'subj_presente', 'yo', 'juegue'], ['jugar', 'subj_presente', 'nos', 'juguemos'],
  ['averiguar', 'preterito', 'yo', 'averigüé'],
  ['pensar', 'presente', 'ellos', 'piensan'], ['pensar', 'presente', 'nos', 'pensamos'], ['pensar', 'presente', 'vos', 'pensás'],
  ['volver', 'perfecto', 'yo', 'he vuelto'], ['devolver', 'presente', 'yo', 'devuelvo'], ['resolver', 'perfecto', 'yo', 'he resuelto'],
  ['dormir', 'preterito', 'el', 'durmió'], ['dormir', 'progresivo', 'yo', 'estoy durmiendo'], ['dormir', 'subj_presente', 'nos', 'durmamos'],
  ['morir', 'perfecto', 'el', 'ha muerto'],
  ['pedir', 'presente', 'yo', 'pido'], ['pedir', 'preterito', 'ellos', 'pidieron'], ['pedir', 'subj_presente', 'nos', 'pidamos'],
  ['sentir', 'preterito', 'el', 'sintió'], ['sentir', 'subj_presente', 'nos', 'sintamos'], ['sentir', 'presente', 'yo', 'siento'],
  ['seguir', 'presente', 'yo', 'sigo'], ['seguir', 'presente', 'tu', 'sigues'], ['seguir', 'preterito', 'el', 'siguió'],
  ['seguir', 'subj_presente', 'yo', 'siga'], ['seguir', 'progresivo', 'yo', 'estoy siguiendo'],
  ['elegir', 'presente', 'yo', 'elijo'], ['elegir', 'subj_presente', 'nos', 'elijamos'],
  ['reír', 'presente', 'yo', 'río'], ['sonreír', 'presente', 'el', 'sonríe'], ['reír', 'preterito', 'ellos', 'rieron'],
  ['teñir', 'preterito', 'el', 'tiñó'], ['teñir', 'progresivo', 'yo', 'estoy tiñendo'],
  ['adquirir', 'presente', 'yo', 'adquiero'], ['adquirir', 'presente', 'nos', 'adquirimos'],
  ['oler', 'presente', 'yo', 'huelo'], ['oler', 'presente', 'nos', 'olemos'],
  ['escribir', 'perfecto', 'yo', 'he escrito'], ['describir', 'perfecto', 'yo', 'he descrito'], ['abrir', 'perfecto', 'yo', 'he abierto'],
  ['descubrir', 'perfecto', 'yo', 'he descubierto'], ['romper', 'perfecto', 'yo', 'he roto'], ['poner', 'perfecto', 'yo', 'he puesto'],
  ['levantarse', 'presente', 'yo', 'me levanto'], ['levantarse', 'imperativo', 'tu', 'levántate'],
  ['levantarse', 'imperativo', 'nos', 'levantémonos'], ['levantarse', 'imperativo', 'vosotros', 'levantaos'],
  ['levantarse', 'imperativo', 'el', 'levántese'], ['levantarse', 'imperativo', 'vos', 'levantate'],
  ['sentarse', 'imperativo', 'tu', 'siéntate'], ['sentarse', 'imperativo', 'ellos', 'siéntense'],
  ['vestirse', 'imperativo', 'vosotros', 'vestíos'], ['ponerse', 'imperativo', 'tu', 'ponte'],
  ['levantarse', 'perfecto', 'yo', 'me he levantado'], ['ducharse', 'progresivo', 'tu', 'te estás duchando'],
  ['haber', 'presente', 'el', 'ha'], ['haber', 'subj_presente', 'yo', 'haya'],
  ['salir', 'presente', 'yo', 'salgo'], ['salir', 'futuro', 'yo', 'saldré'], ['salir', 'imperativo', 'tu', 'sal'],
  ['valer', 'futuro', 'el', 'valdrá'], ['andar', 'preterito', 'yo', 'anduve'],
  ['servir', 'presente', 'yo', 'sirvo'], ['repetir', 'preterito', 'el', 'repitió'],
  ['cocer', 'presente', 'yo', 'cuezo'], ['torcer', 'subj_presente', 'nos', 'torzamos'],
  ['preferir', 'preterito', 'ellos', 'prefirieron'], ['divertirse', 'presente', 'yo', 'me divierto'],
];

let fail = 0;
for (const [v, t, p, exp] of cases) {
  const got = conjugate(v).forms[t]?.[p];
  if (got !== exp) { fail++; console.log(`FAIL ${v} ${t} ${p}: got "${got}", expected "${exp}"`); }
}
console.log(`${cases.length - fail}/${cases.length} passed`);
for (const v of ['tener', 'pedir', 'conocer', 'buscar', 'hablar', 'leer', 'construir']) {
  const c = conjugate(v);
  console.log(v, '|', c.tags.join(', '));
}
console.log(conjugate('pedir').notes.map((n) => '  - ' + n.text).join('\n'));
process.exit(fail ? 1 : 0);
