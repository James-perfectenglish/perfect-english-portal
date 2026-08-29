/* ============================================================
   Tense Tagger — Spanish generation engine (shared)
   Extracted from TenseTaggerES.jsx so the live component (fallback
   path) and the bank generator share ONE source of truth.
   A conjugator, not an auxiliary chain. Pure JS, no React.

   EIGHT tiempos: the original four (presente, presente_continuo,
   preterito, imperfecto) plus perfecto, pluscuamperfecto, futuro
   and condicional. The subjuntivo is deliberately absent — it needs
   a trigger clause ("Espero que…"), so the highlighted verb sits in
   a subordinate clause and the template shape is different. It is a
   separate job.

   Two tiempos need a sentence FRAME to read naturally:
     • pluscuamperfecto — an anchor clause ("Cuando llegué, … ya
       había salido"), because the past-before-the-past needs a past
       to sit before.
     • condicional — an optional hypothetical opener ("Con más
       tiempo, …"), which keeps it out of plain-future territory.
   Frames prefix `pre`, so `vp` stays the highlighted span and the
   bank's pre/vp/post round-trip is unchanged.

   ⚠️ CONTENT NOTE FOR JAMES: every conjugated form here is checked
   against the hand-authored tables in src/lib/verbConjugatorEs.js
   (the reference students actually read), including the -ído accent
   rule and the shared future/conditional stems. The adverbial sets
   and the frames are first drafts on your turf.
   ============================================================ */

import { axisAllows } from './tenseFocus.js';

const END = {
  ar: { pres: ['o', 'as', 'a', 'amos', 'áis', 'an'], pret: ['é', 'aste', 'ó', 'amos', 'asteis', 'aron'], imp: ['aba', 'abas', 'aba', 'ábamos', 'abais', 'aban'], ger: 'ando' },
  er: { pres: ['o', 'es', 'e', 'emos', 'éis', 'en'], pret: ['í', 'iste', 'ió', 'imos', 'isteis', 'ieron'], imp: ['ía', 'ías', 'ía', 'íamos', 'íais', 'ían'], ger: 'iendo' },
  ir: { pres: ['o', 'es', 'e', 'imos', 'ís', 'en'], pret: ['í', 'iste', 'ió', 'imos', 'isteis', 'ieron'], imp: ['ía', 'ías', 'ía', 'íamos', 'íais', 'ían'], ger: 'iendo' },
};
const ESTAR_PRES = ['estoy', 'estás', 'está', 'estamos', 'estáis', 'están'];
const HABER_PRES = ['he', 'has', 'ha', 'hemos', 'habéis', 'han'];
const HABER_IMP  = ['había', 'habías', 'había', 'habíamos', 'habíais', 'habían'];
const FUT_END    = ['é', 'ás', 'á', 'emos', 'éis', 'án'];
const COND_END   = ['ía', 'ías', 'ía', 'íamos', 'íais', 'ían'];
const IMP_SPECIAL = {
  ser: ['era', 'eras', 'era', 'éramos', 'erais', 'eran'],
  ir: ['iba', 'ibas', 'iba', 'íbamos', 'ibais', 'iban'],
  ver: ['veía', 'veías', 'veía', 'veíamos', 'veíais', 'veían'],
};
const stemOf = inf => inf.slice(0, -2);
const reg = (inf, type, key) => END[type][key].map(e => stemOf(inf) + e);

// -ar → -ado; -er/-ir → -ido, but -ído when the stem ends in a vowel
// (leer → leído, traer → traído). `part` overrides the lot.
function participioOf(v) {
  if (v.part) return v.part;
  const stem = stemOf(v.inf);
  if (v.type === 'ar') return stem + 'ado';
  return stem + (/[aeou]$/.test(stem) ? 'ído' : 'ido');
}
// futuro and condicional share one stem: the whole infinitive, or an
// irregular stem (tener → tendr-, hacer → har-).
const futStemOf = v => v.futStem || v.inf;

function forms(v) {
  const t = v.type;
  return {
    presente: v.pres || reg(v.inf, t, 'pres'),
    preterito: v.pret || reg(v.inf, t, 'pret'),
    imperfecto: IMP_SPECIAL[v.inf] || reg(v.inf, t, 'imp'),
    gerundio: v.ger || (stemOf(v.inf) + END[t].ger),
    participio: participioOf(v),
  };
}
// p = person index 0..5 (yo, tú, él, nosotros, vosotros, ellos)
function vpFor(v, tense, p) {
  const f = forms(v);
  if (tense === 'presente') return f.presente[p];
  if (tense === 'preterito') return f.preterito[p];
  if (tense === 'imperfecto') return f.imperfecto[p];
  if (tense === 'presente_continuo') return ESTAR_PRES[p] + ' ' + f.gerundio;
  if (tense === 'perfecto') return HABER_PRES[p] + ' ' + f.participio;
  if (tense === 'pluscuamperfecto') return HABER_IMP[p] + ' ' + f.participio;
  if (tense === 'futuro') return futStemOf(v) + FUT_END[p];
  if (tense === 'condicional') return futStemOf(v) + COND_END[p];
  return '?';
}

/* `skip` — tiempos this verb reads badly in, whatever the filter says.
   ser + a fixed complement ("de Madrid") is the clear case: "he sido de
   Madrid" / "seré de Madrid" are not sentences a teacher would show. */
const VERBS = [
  { inf: 'hablar', type: 'ar', min: 'A2', cont: true, objs: ['con el cliente', 'con el jefe'] },
  { inf: 'trabajar', type: 'ar', min: 'A2', cont: true, objs: [] },
  { inf: 'limpiar', type: 'ar', min: 'A2', cont: true, objs: ['la habitación', 'las mesas', 'el baño'] },
  { inf: 'preparar', type: 'ar', min: 'A2', cont: true, objs: ['el desayuno', 'la comida', 'la sala'] },
  { inf: 'cocinar', type: 'ar', min: 'A2', cont: true, objs: ['la cena', 'el pescado', 'la paella'] },
  { inf: 'reservar', type: 'ar', min: 'A2', cont: true, objs: ['una mesa', 'una habitación'] },
  { inf: 'terminar', type: 'ar', min: 'A2', cont: true, objs: ['el trabajo', 'el turno'] },
  { inf: 'esperar', type: 'ar', min: 'A2', cont: true, objs: ['a los clientes', 'el autobús'] },
  { inf: 'ayudar', type: 'ar', min: 'A2', cont: true, objs: ['a los huéspedes', 'en la cocina'] },
  { inf: 'lavar', type: 'ar', min: 'A2', cont: true, objs: ['los platos', 'las toallas'] },
  { inf: 'llevar', type: 'ar', min: 'A2', cont: true, objs: ['las maletas', 'la comida'] },
  { inf: 'comer', type: 'er', min: 'A2', cont: true, objs: ['en el restaurante', 'el postre'] },
  { inf: 'beber', type: 'er', min: 'A2', cont: true, objs: ['agua', 'un café'] },
  { inf: 'vender', type: 'er', min: 'A2', cont: true, objs: ['entradas', 'recuerdos'] },
  { inf: 'vivir', type: 'ir', min: 'A2', cont: false, objs: ['en Palma', 'cerca del hotel'] },
  { inf: 'abrir', type: 'ir', min: 'A2', cont: true, objs: ['la puerta', 'el bar'], part: 'abierto' },
  { inf: 'escribir', type: 'ir', min: 'A2', cont: true, objs: ['un correo', 'el menú'], part: 'escrito' },
  { inf: 'recibir', type: 'ir', min: 'A2', cont: true, objs: ['a los huéspedes', 'un paquete'] },
  { inf: 'ser', type: 'er', min: 'A2', cont: false, objs: ['de Madrid', 'de Mallorca', 'de aquí'], pres: ['soy', 'eres', 'es', 'somos', 'sois', 'son'], pret: ['fui', 'fuiste', 'fue', 'fuimos', 'fuisteis', 'fueron'], ger: 'siendo', part: 'sido', skip: ['perfecto', 'pluscuamperfecto', 'futuro', 'condicional'] },
  { inf: 'estar', type: 'ar', min: 'A2', cont: false, objs: ['en la cocina', 'en recepción', 'en el bar'], pres: ESTAR_PRES, pret: ['estuve', 'estuviste', 'estuvo', 'estuvimos', 'estuvisteis', 'estuvieron'], ger: 'estando' },
  { inf: 'ir', type: 'ir', min: 'A2', cont: false, objs: ['al mercado', 'a la playa', 'a casa'], pres: ['voy', 'vas', 'va', 'vamos', 'vais', 'van'], pret: ['fui', 'fuiste', 'fue', 'fuimos', 'fuisteis', 'fueron'], ger: 'yendo' },
  { inf: 'tener', type: 'er', min: 'A2', cont: false, objs: ['una reserva', 'tres mesas libres', 'hambre'], pres: ['tengo', 'tienes', 'tiene', 'tenemos', 'tenéis', 'tienen'], pret: ['tuve', 'tuviste', 'tuvo', 'tuvimos', 'tuvisteis', 'tuvieron'], futStem: 'tendr' },
  { inf: 'hacer', type: 'er', min: 'A2', cont: true, objs: ['las camas', 'la comida', 'el café'], pres: ['hago', 'haces', 'hace', 'hacemos', 'hacéis', 'hacen'], pret: ['hice', 'hiciste', 'hizo', 'hicimos', 'hicisteis', 'hicieron'], part: 'hecho', futStem: 'har' },
  { inf: 'ver', type: 'er', min: 'A2', cont: false, objs: ['a los clientes', 'el menú'], pres: ['veo', 'ves', 've', 'vemos', 'veis', 'ven'], pret: ['vi', 'viste', 'vio', 'vimos', 'visteis', 'vieron'], part: 'visto' },
  { inf: 'dar', type: 'ar', min: 'A2', cont: true, objs: ['las llaves', 'la cuenta', 'información'], pres: ['doy', 'das', 'da', 'damos', 'dais', 'dan'], pret: ['di', 'diste', 'dio', 'dimos', 'disteis', 'dieron'] },
  { inf: 'decir', type: 'ir', min: 'B1', cont: true, objs: ['la verdad', 'el precio'], pres: ['digo', 'dices', 'dice', 'decimos', 'decís', 'dicen'], pret: ['dije', 'dijiste', 'dijo', 'dijimos', 'dijisteis', 'dijeron'], ger: 'diciendo', part: 'dicho', futStem: 'dir' },
  { inf: 'venir', type: 'ir', min: 'B1', cont: false, objs: ['al hotel', 'a trabajar'], pres: ['vengo', 'vienes', 'viene', 'venimos', 'venís', 'vienen'], pret: ['vine', 'viniste', 'vino', 'vinimos', 'vinisteis', 'vinieron'], ger: 'viniendo', futStem: 'vendr' },
  { inf: 'poner', type: 'er', min: 'B1', cont: true, objs: ['la mesa', 'las flores', 'música'], pres: ['pongo', 'pones', 'pone', 'ponemos', 'ponéis', 'ponen'], pret: ['puse', 'pusiste', 'puso', 'pusimos', 'pusisteis', 'pusieron'], part: 'puesto', futStem: 'pondr' },
  { inf: 'traer', type: 'er', min: 'B1', cont: true, objs: ['la cuenta', 'más pan'], pres: ['traigo', 'traes', 'trae', 'traemos', 'traéis', 'traen'], pret: ['traje', 'trajiste', 'trajo', 'trajimos', 'trajisteis', 'trajeron'], ger: 'trayendo' },
  { inf: 'servir', type: 'ir', min: 'B1', cont: true, objs: ['el café', 'la cena', 'a los clientes'], pres: ['sirvo', 'sirves', 'sirve', 'servimos', 'servís', 'sirven'], pret: ['serví', 'serviste', 'sirvió', 'servimos', 'servisteis', 'sirvieron'], ger: 'sirviendo' },
  { inf: 'pedir', type: 'ir', min: 'B1', cont: true, objs: ['la cuenta', 'un café', 'el menú'], pres: ['pido', 'pides', 'pide', 'pedimos', 'pedís', 'piden'], pret: ['pedí', 'pediste', 'pidió', 'pedimos', 'pedisteis', 'pidieron'], ger: 'pidiendo' },
  { inf: 'dormir', type: 'ir', min: 'B1', cont: true, objs: [], pres: ['duermo', 'duermes', 'duerme', 'dormimos', 'dormís', 'duermen'], pret: ['dormí', 'dormiste', 'durmió', 'dormimos', 'dormisteis', 'durmieron'], ger: 'durmiendo' },
  { inf: 'leer', type: 'er', min: 'B1', cont: true, objs: ['el menú', 'las reseñas'], pret: ['leí', 'leíste', 'leyó', 'leímos', 'leísteis', 'leyeron'], ger: 'leyendo' },
  { inf: 'llegar', type: 'ar', min: 'B1', cont: false, objs: ['al hotel', 'tarde', 'a tiempo'], pret: ['llegué', 'llegaste', 'llegó', 'llegamos', 'llegasteis', 'llegaron'] },
  { inf: 'pagar', type: 'ar', min: 'B1', cont: true, objs: ['la cuenta', 'la factura', 'en efectivo'], pret: ['pagué', 'pagaste', 'pagó', 'pagamos', 'pagasteis', 'pagaron'] },
  { inf: 'buscar', type: 'ar', min: 'B1', cont: true, objs: ['las llaves', 'al cliente'], pret: ['busqué', 'buscaste', 'buscó', 'buscamos', 'buscasteis', 'buscaron'] },
];

const SUBJECTS = [
  { text: 'yo', p: 0 }, { text: 'tú', p: 1 }, { text: 'él', p: 2 }, { text: 'ella', p: 2 },
  { text: 'nosotros', p: 3 }, { text: 'vosotros', p: 4 }, { text: 'ellos', p: 5 }, { text: 'ellas', p: 5 },
  { text: 'el camarero', p: 2 }, { text: 'la recepcionista', p: 2 }, { text: 'el cocinero', p: 2 },
  { text: 'el cliente', p: 2 }, { text: 'el jefe', p: 2 }, { text: 'mi compañera', p: 2 },
  { text: 'los huéspedes', p: 5 }, { text: 'los clientes', p: 5 },
];

// adverbials are all invariant for person/number, so they read naturally with any subject
const ADVERBS = {
  presente: ['', '', 'normalmente', 'siempre', 'a veces', 'todos los días', 'cada día'],
  presente_continuo: ['ahora mismo', 'en este momento', 'ahora'],
  preterito: ['', 'ayer', 'anoche', 'el lunes pasado', 'la semana pasada', 'esta mañana'],
  imperfecto: ['', 'antes', 'siempre', 'todos los días', 'normalmente', 'en aquella época', 'de vez en cuando'],
  // the perfecto lives inside an unfinished period — that is the whole point of it in Spain.
  // ("ya" belongs before the auxiliary, not in final position, so it is not here.)
  perfecto: ['hoy', 'esta mañana', 'esta semana', 'este mes', 'este año'],
  // the anchor frame carries the time reference, so no trailing adverbial
  pluscuamperfecto: [''],
  futuro: ['', 'mañana', 'esta noche', 'pronto', 'la semana que viene', 'el mes que viene', 'el año que viene'],
  condicional: ['', '', 'sin problema', 'con mucho gusto'],
};

/* Sentence frames — prefix `pre`, so `vp` stays the highlighted span.
   `avoidP` keeps the frame's own subject from clashing with the main one
   ("Cuando llegué, yo ya había…" reads as a stutter). */
const FRAMES = {
  pluscuamperfecto: [
    { text: 'Cuando llegué al hotel, ', avoidP: [0] },
    { text: 'Cuando llegamos, ', avoidP: [3] },
    { text: 'Antes de las ocho, ', avoidP: [] },
    { text: 'Para las diez, ', avoidP: [] },
    { text: 'Cuando abrió el restaurante, ', avoidP: [] },
  ],
  condicional: [
    { text: '', avoidP: [] },
    { text: '', avoidP: [] },
    { text: 'Con más tiempo, ', avoidP: [] },
    { text: 'Con más ayuda, ', avoidP: [] },
  ],
};

const TENSES = ['presente', 'presente_continuo', 'preterito', 'imperfecto', 'perfecto', 'pluscuamperfecto', 'futuro', 'condicional'];

// which tiempos are in play at each level. The subjuntivo lands at B2 when
// the trigger-clause generator exists; until then B1 is the ceiling.
const LEVEL_TENSES = {
  A2: ['presente', 'presente_continuo', 'preterito', 'imperfecto', 'perfecto'],
  B1: TENSES,
};

const TIEMPO_LABEL = {
  presente: 'Presente', presente_continuo: 'Presente continuo',
  preterito: 'Pretérito', imperfecto: 'Imperfecto',
  perfecto: 'Pretérito perfecto', pluscuamperfecto: 'Pluscuamperfecto',
  futuro: 'Futuro', condicional: 'Condicional',
};
// lowercase, for the mark-free.js prompt and the star/harvest rows
const TIEMPO_ES = {
  presente: 'presente', presente_continuo: 'presente continuo',
  preterito: 'pretérito', imperfecto: 'imperfecto',
  perfecto: 'pretérito perfecto', pluscuamperfecto: 'pluscuamperfecto',
  futuro: 'futuro', condicional: 'condicional',
};
// matches the groups in tenseExplainEs.js, so the chip rows and the
// Explainer's accordion sections stay in step
const TIEMPO_GROUP = {
  presente: 'present', presente_continuo: 'present',
  preterito: 'past', imperfecto: 'past', perfecto: 'past', pluscuamperfecto: 'past',
  futuro: 'future', condicional: 'future',
};

const rand = a => a[Math.floor(Math.random() * a.length)];
const cap = s => s.charAt(0).toUpperCase() + s.slice(1);

/* Raw intersection of a focus rule with the level's tiempos. May be length 1.
   This is the GENERATION resolver — callers pass an explicit list. */
function tiemposIn(level, allow = null) {
  const base = LEVEL_TENSES[level] || LEVEL_TENSES.B1;
  if (allow == null) return base;
  const narrowed = base.filter(t => axisAllows(t, allow));
  return narrowed.length ? narrowed : base;
}

/* The CHIP resolver. Tiempo is Spanish's only axis, so narrowing to a single
   option leaves no question at all — that falls back to the full level set
   rather than shipping a tap-the-only-button exercise.
   The component feeds THIS list back into makeES, so the pool and the chips
   are the same list by construction and cannot drift. */
function tensesFor(level, allow = null) {
  const narrowed = tiemposIn(level, allow);
  return narrowed.length >= 2 ? narrowed : (LEVEL_TENSES[level] || LEVEL_TENSES.B1);
}

function makeES(level, allow = null) {
  const pool = VERBS.filter(v => (level === 'A2' ? v.min === 'A2' : true));
  const tense = rand(tiemposIn(level, allow));

  let p = pool.filter(v => !(v.skip || []).includes(tense));
  if (tense === 'presente_continuo') p = p.filter(v => v.cont);
  if (!p.length) p = pool;
  const v = rand(p);

  const frameSet = FRAMES[tense];
  const frame = frameSet ? rand(frameSet) : { text: '', avoidP: [] };
  const subjPool = SUBJECTS.filter(s => !frame.avoidP.includes(s.p));
  const subj = rand(subjPool.length ? subjPool : SUBJECTS);

  const vp = vpFor(v, tense, subj.p);
  // `objs` is curated per verb precisely because these verbs need one — dropping
  // it at random produced strandings like "Los clientes lavaron anoche."
  // Verbs that take no object (trabajar, dormir) carry an empty objs array.
  const obj = v.objs.length ? rand(v.objs) : '';
  // a frame already sets the scene; a trailing adverbial on top double-marks it
  let adv = frame.text ? '' : rand(ADVERBS[tense]);
  if (!obj && !adv && !frame.text) adv = rand(ADVERBS[tense].filter(a => a)); // never a bare one-word predicate

  // "ya" is the pluscuamperfecto's natural companion, but not compulsory
  const ya = (tense === 'pluscuamperfecto' && Math.random() < 0.7) ? 'ya ' : '';
  const subjText = frame.text ? subj.text : cap(subj.text);
  const pre = frame.text + subjText + ' ' + ya;
  const post = (obj ? ' ' + obj : '') + (adv ? ' ' + adv : '') + '.';
  return { sentence: pre + vp + post, pre, vp, post, tense, verb: v.inf };
}

function startLevel(profile) {
  const l = (profile?.level || '').toUpperCase();
  return l.startsWith('A') ? 'A2' : 'B1'; // A2/B1 only; higher levels get the B1 pool
}

export {
  makeES, vpFor, TENSES, LEVEL_TENSES, TIEMPO_LABEL, TIEMPO_ES, TIEMPO_GROUP,
  tensesFor, tiemposIn, startLevel,
};
