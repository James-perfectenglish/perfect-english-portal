/* ============================================================
   Tense Tagger — Spanish generation engine (shared)
   Extracted verbatim from TenseTaggerES.jsx so the live component
   (fallback path) and the bank generator share ONE source of truth.
   A conjugator, not an auxiliary chain. Pure JS, no React.
   ============================================================ */

const END = {
  ar: { pres: ['o', 'as', 'a', 'amos', 'áis', 'an'], pret: ['é', 'aste', 'ó', 'amos', 'asteis', 'aron'], imp: ['aba', 'abas', 'aba', 'ábamos', 'abais', 'aban'], ger: 'ando' },
  er: { pres: ['o', 'es', 'e', 'emos', 'éis', 'en'], pret: ['í', 'iste', 'ió', 'imos', 'isteis', 'ieron'], imp: ['ía', 'ías', 'ía', 'íamos', 'íais', 'ían'], ger: 'iendo' },
  ir: { pres: ['o', 'es', 'e', 'imos', 'ís', 'en'], pret: ['í', 'iste', 'ió', 'imos', 'isteis', 'ieron'], imp: ['ía', 'ías', 'ía', 'íamos', 'íais', 'ían'], ger: 'iendo' },
};
const ESTAR_PRES = ['estoy', 'estás', 'está', 'estamos', 'estáis', 'están'];
const IMP_SPECIAL = {
  ser: ['era', 'eras', 'era', 'éramos', 'erais', 'eran'],
  ir: ['iba', 'ibas', 'iba', 'íbamos', 'ibais', 'iban'],
  ver: ['veía', 'veías', 'veía', 'veíamos', 'veíais', 'veían'],
};
const stemOf = inf => inf.slice(0, -2);
const reg = (inf, type, key) => END[type][key].map(e => stemOf(inf) + e);

function forms(v) {
  const t = v.type;
  return {
    presente: v.pres || reg(v.inf, t, 'pres'),
    preterito: v.pret || reg(v.inf, t, 'pret'),
    imperfecto: IMP_SPECIAL[v.inf] || reg(v.inf, t, 'imp'),
    gerundio: v.ger || (stemOf(v.inf) + END[t].ger),
  };
}
// p = person index 0..5 (yo, tú, él, nosotros, vosotros, ellos)
function vpFor(v, tense, p) {
  const f = forms(v);
  if (tense === 'presente') return f.presente[p];
  if (tense === 'preterito') return f.preterito[p];
  if (tense === 'imperfecto') return f.imperfecto[p];
  if (tense === 'presente_continuo') return ESTAR_PRES[p] + ' ' + f.gerundio;
  return '?';
}

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
  { inf: 'abrir', type: 'ir', min: 'A2', cont: true, objs: ['la puerta', 'el bar'] },
  { inf: 'escribir', type: 'ir', min: 'A2', cont: true, objs: ['un correo', 'el menú'] },
  { inf: 'recibir', type: 'ir', min: 'A2', cont: true, objs: ['a los huéspedes', 'un paquete'] },
  { inf: 'ser', type: 'er', min: 'A2', cont: false, objs: ['de Madrid', 'de Mallorca', 'de aquí'], pres: ['soy', 'eres', 'es', 'somos', 'sois', 'son'], pret: ['fui', 'fuiste', 'fue', 'fuimos', 'fuisteis', 'fueron'], ger: 'siendo' },
  { inf: 'estar', type: 'ar', min: 'A2', cont: false, objs: ['en la cocina', 'en recepción', 'en el bar'], pres: ESTAR_PRES, pret: ['estuve', 'estuviste', 'estuvo', 'estuvimos', 'estuvisteis', 'estuvieron'], ger: 'estando' },
  { inf: 'ir', type: 'ir', min: 'A2', cont: false, objs: ['al mercado', 'a la playa', 'a casa'], pres: ['voy', 'vas', 'va', 'vamos', 'vais', 'van'], pret: ['fui', 'fuiste', 'fue', 'fuimos', 'fuisteis', 'fueron'], ger: 'yendo' },
  { inf: 'tener', type: 'er', min: 'A2', cont: false, objs: ['una reserva', 'tres mesas libres', 'hambre'], pres: ['tengo', 'tienes', 'tiene', 'tenemos', 'tenéis', 'tienen'], pret: ['tuve', 'tuviste', 'tuvo', 'tuvimos', 'tuvisteis', 'tuvieron'] },
  { inf: 'hacer', type: 'er', min: 'A2', cont: true, objs: ['las camas', 'la comida', 'el café'], pres: ['hago', 'haces', 'hace', 'hacemos', 'hacéis', 'hacen'], pret: ['hice', 'hiciste', 'hizo', 'hicimos', 'hicisteis', 'hicieron'] },
  { inf: 'ver', type: 'er', min: 'A2', cont: false, objs: ['a los clientes', 'el menú'], pres: ['veo', 'ves', 've', 'vemos', 'veis', 'ven'], pret: ['vi', 'viste', 'vio', 'vimos', 'visteis', 'vieron'] },
  { inf: 'dar', type: 'ar', min: 'A2', cont: true, objs: ['las llaves', 'la cuenta', 'información'], pres: ['doy', 'das', 'da', 'damos', 'dais', 'dan'], pret: ['di', 'diste', 'dio', 'dimos', 'disteis', 'dieron'] },
  { inf: 'decir', type: 'ir', min: 'B1', cont: true, objs: ['la verdad', 'el precio'], pres: ['digo', 'dices', 'dice', 'decimos', 'decís', 'dicen'], pret: ['dije', 'dijiste', 'dijo', 'dijimos', 'dijisteis', 'dijeron'], ger: 'diciendo' },
  { inf: 'venir', type: 'ir', min: 'B1', cont: false, objs: ['al hotel', 'a trabajar'], pres: ['vengo', 'vienes', 'viene', 'venimos', 'venís', 'vienen'], pret: ['vine', 'viniste', 'vino', 'vinimos', 'vinisteis', 'vinieron'], ger: 'viniendo' },
  { inf: 'poner', type: 'er', min: 'B1', cont: true, objs: ['la mesa', 'las flores', 'música'], pres: ['pongo', 'pones', 'pone', 'ponemos', 'ponéis', 'ponen'], pret: ['puse', 'pusiste', 'puso', 'pusimos', 'pusisteis', 'pusieron'] },
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
};
const TENSES = ['presente', 'presente_continuo', 'preterito', 'imperfecto'];

const TIEMPO_LABEL = { presente: 'Presente', presente_continuo: 'Presente continuo', preterito: 'Pretérito', imperfecto: 'Imperfecto' };
const TIEMPO_ES = { presente: 'presente', presente_continuo: 'presente continuo', preterito: 'pretérito', imperfecto: 'imperfecto' };

const rand = a => a[Math.floor(Math.random() * a.length)];
const cap = s => s.charAt(0).toUpperCase() + s.slice(1);

function makeES(level, only = null) {
  const pool = VERBS.filter(v => (level === 'B1' ? true : v.min === 'A2'));
  const tense = (only && TENSES.includes(only)) ? only : rand(TENSES);
  let p = pool;
  if (tense === 'presente_continuo') p = p.filter(v => v.cont);
  const v = rand(p);
  const subj = rand(SUBJECTS);
  const vp = vpFor(v, tense, subj.p);
  const obj = (v.objs.length && Math.random() < 0.7) ? rand(v.objs) : '';
  let adv = rand(ADVERBS[tense]);
  if (!obj && !adv) adv = rand(ADVERBS[tense].filter(a => a)); // never leave a bare one-word predicate
  const pre = cap(subj.text) + ' ';
  const post = (obj ? ' ' + obj : '') + (adv ? ' ' + adv : '') + '.';
  return { sentence: pre + vp + post, pre, vp, post, tense, verb: v.inf };
}

function startLevel(profile) {
  const l = (profile?.level || '').toUpperCase();
  return l.startsWith('A') ? 'A2' : 'B1'; // A2/B1 only; higher levels get the B1 pool
}

export { makeES, vpFor, TENSES, TIEMPO_LABEL, TIEMPO_ES, startLevel };
