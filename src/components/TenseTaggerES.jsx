import { useState } from 'react';
import { supabase } from '../supabaseClient';

/* ============================================================
   Tense Tagger 🏷️ — Spanish track (native-English learners of Spanish)
   A different engine from the English version: a conjugator, not an
   auxiliary chain. Single axis (Tiempo) across four tenses — the
   pretérito/imperfecto and presente/presente-continuo contrasts.
   Recognition attempts write to tense_attempts (language='es',
   axis 'tiempo'); production is marked by the AI (mark-free.js,
   type:'tense', language:'es') and harvested to sc_sentences. On an
   AI outage, production soft-passes (Spanish endings are too
   irregular to regex safely, so we never wrongly deny a star).
   A2/B1 only; futuro is a fast-follow.
   ============================================================ */

/* ---------- palette (matches the app / English Tense Tagger) ---------- */
const PG = 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)';
const C = {
  page: '#f8f9fa', card: 'white', line: '#e2e8f0',
  ink: '#2C3E50', slate: '#4a5568', muted: '#718096', faint: '#a0aec0',
  brand: '#667eea', brandDark: '#553C9A',
  good: '#276749', goodBg: '#f0fff4', goodLine: '#38a169',
  bad: '#c53030', badBg: '#fff5f5', badLine: '#e53e3e',
  mark: '#fef3c7',
};

/* ============================================================
   CONJUGATION ENGINE
   Regular -ar/-er/-ir by rule; irregular/stem-change verbs carry
   explicit pres/pret/ger overrides; imperfecto is rule-based except
   ser/ir/ver. Verified form-by-form against the full paradigm.
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

/* ---------- verbs ----------
   min: A2|B1 · cont: can take presente continuo (activity verb)
   objs: natural complements; ser/estar use invariant predicates so
   subject-agreement never breaks across persons. */
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

// display labels (Spanish — the metalanguage Spanish learners use) + AI target names
const TIEMPO_LABEL = { presente: 'Presente', presente_continuo: 'Presente continuo', preterito: 'Pretérito', imperfecto: 'Imperfecto' };
const TIEMPO_ES = { presente: 'presente', presente_continuo: 'presente continuo', preterito: 'pretérito', imperfecto: 'imperfecto' };

// production scaffold: the form of each tense + a one-line use note (shown in produce mode)
const FORMULAS_ES = {
  presente:          { formula: 'stem + -o, -as, -a, -amos, -áis, -an  (hablo, comes, vive)', use: 'habits and general facts' },
  presente_continuo: { formula: 'estar + gerundio  (estoy hablando, está comiendo)', use: 'an action happening right now' },
  preterito:         { formula: 'stem + -é, -aste, -ó…  (hablé, comió)', use: 'a completed, finished past action' },
  imperfecto:        { formula: 'stem + -aba / -ía…  (hablaba, comía)', use: 'an ongoing or habitual past action' },
};

/* ---------- helpers ---------- */
const rand = a => a[Math.floor(Math.random() * a.length)];
const cap = s => s.charAt(0).toUpperCase() + s.slice(1);

function makeES(level) {
  const pool = VERBS.filter(v => (level === 'B1' ? true : v.min === 'A2'));
  const tense = rand(TENSES);
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

/* ---------- small UI bits (shared look with the English tagger) ---------- */
function chipStyle(state) {
  const map = {
    idle: { background: 'white', color: C.slate, border: `1.5px solid ${C.line}` },
    selected: { background: C.brand, color: 'white', border: `1.5px solid ${C.brand}` },
    correct: { background: C.goodBg, color: C.good, border: `1.5px solid ${C.goodLine}` },
    wrong: { background: C.badBg, color: C.bad, border: `1.5px solid ${C.badLine}` },
    answer: { background: 'white', color: C.good, border: `1.5px solid ${C.goodLine}` },
  }[state];
  return {
    ...map, padding: '0.5rem 0.85rem', borderRadius: '9px', fontSize: '0.78rem',
    fontWeight: 600, letterSpacing: '0.02em', cursor: 'pointer', transition: 'all 0.12s',
  };
}
const cardStyle = { background: C.card, border: `1px solid ${C.line}`, borderRadius: '16px', padding: '1.25rem', marginBottom: '1rem' };
const labelStyle = { fontSize: '0.7rem', fontWeight: 700, color: C.faint, textTransform: 'uppercase', letterSpacing: '0.5px' };

function StatusPill({ tone, children }) {
  const t = {
    ai: { bg: '#EDE9FE', fg: '#553C9A', bd: '#C4B5FD' },
    good: { bg: C.goodBg, fg: C.good, bd: C.goodLine },
    bad: { bg: C.badBg, fg: C.bad, bd: C.badLine },
    warn: { bg: '#fffaf0', fg: '#b7791f', bd: '#f6e05e' },
  }[tone] || { bg: '#edf2f7', fg: C.slate, bd: C.line };
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: '0.35rem', padding: '4px 12px',
      borderRadius: '20px', fontSize: '0.78rem', fontWeight: 600,
      background: t.bg, color: t.fg, border: `1px solid ${t.bd}`,
    }}>{children}</span>
  );
}

/* ---------- component ---------- */
export default function TenseTaggerES({ profile }) {
  const [level, setLevel] = useState(() => startLevel(profile));
  const [item, setItem] = useState(() => makeES(startLevel(profile)));
  const [phase, setPhase] = useState('tag'); // tag | produce | done
  const [pick, setPick] = useState(null);
  const [graded, setGraded] = useState(false);
  const [draft, setDraft] = useState('');
  const [prod, setProd] = useState(null);
  const [checking, setChecking] = useState(false);
  const [stars, setStars] = useState(0);
  const [tagged, setTagged] = useState(0);

  const label = TIEMPO_LABEL[item.tense];
  const correct = graded && pick === item.tense;

  function reset(toLevel = level) {
    setItem(makeES(toLevel)); setPhase('tag'); setPick(null);
    setGraded(false); setDraft(''); setProd(null);
  }
  function changeLevel(l) { setLevel(l); reset(l); }

  async function logAttempt() {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const ok = pick === item.tense;
      await supabase.from('tense_attempts').insert({
        student_id: user.id, language: 'es', level,
        sentence: item.sentence, verb_phrase: item.vp,
        answer: { tiempo: item.tense }, picks: { tiempo: pick },
        is_correct: ok, is_mismatch: false,
        function_answer: null, function_picked: null,
      });
    } catch (e) { console.warn('TenseTaggerES: tense_attempts insert failed', e); }
  }

  async function awardStar(sentence, aiFeedback) {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { error } = await supabase.from('stars').insert({
        student_id: user.id, source: 'tense_tagger', subtype: 'production',
        context: { tense: TIEMPO_ES[item.tense], sentence, language: 'es', level, input_method: 'text', ai_feedback: aiFeedback || '' },
      });
      if (error && error.code !== '23505') console.warn('TenseTaggerES: could not save star:', error);
    } catch (e) { console.warn('TenseTaggerES: could not save star:', e); }
  }

  // Harvest every production submission (pass AND fail), like every other record surface.
  async function harvestSentence(sentence, isCorrect, aiFeedback) {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { error } = await supabase.from('sc_sentences').insert({
        student_id: user.id, source: 'tense_tagger', target: TIEMPO_ES[item.tense], sentence,
        is_correct: isCorrect, ai_feedback: aiFeedback || null,
        input_method: 'text', language: 'es', level,
      });
      if (error) console.warn('TenseTaggerES: sc_sentences insert failed', error);
    } catch (e) { console.warn('TenseTaggerES: sc_sentences insert failed', e); }
  }

  function checkTag() {
    if (!pick) return;
    setGraded(true);
    const ok = pick === item.tense;
    logAttempt();
    if (ok) { setTagged(n => n + 1); setPhase('produce'); }
  }

  // AI is the arbiter (mark-free.js, type:'tense', language:'es'); on an AI outage
  // we soft-pass (award the star) rather than risk denying a correct Spanish answer.
  async function checkProduction() {
    const sentence = draft.trim();
    if (!sentence || checking) return;

    const softPass = () => {
      setProd({ ok: true, layer: 'soft' });
      harvestSentence(sentence, true, null);
      awardStar(sentence, null); setStars(s => s + 1); setPhase('done');
    };

    setChecking(true); setProd(null);
    try {
      const res = await fetch('/api/mark-free', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'tense', sentence, tenseName: TIEMPO_ES[item.tense], level, language: 'es' }),
      });
      const data = res.ok ? await res.json() : null;
      if (data && (data.valid === true || data.valid === false)) {
        const ok = data.valid === true;
        const feedback = data.feedback || data.reason || '';
        setProd({ ok, layer: 'ai', feedback });
        harvestSentence(sentence, ok, feedback);
        if (ok) { awardStar(sentence, feedback); setStars(s => s + 1); setPhase('done'); }
      } else {
        softPass();
      }
    } catch (e) {
      softPass();
    } finally {
      setChecking(false);
    }
  }

  return (
    <div style={{ width: '100%', minHeight: '80vh', background: C.page, padding: '1rem', boxSizing: 'border-box' }}>
      <div style={{ maxWidth: '600px', margin: '0 auto' }}>

        {/* header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
          <div style={{ ...labelStyle, color: C.muted, display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            Tense Tagger 🏷️ 🇪🇸
          </div>
          <div style={{ color: C.brandDark, fontWeight: 700, fontSize: '0.95rem' }}>⭐️ {stars}</div>
        </div>

        {/* level pills */}
        <div style={{ display: 'flex', gap: '0.4rem', marginBottom: '1rem' }}>
          {['A2', 'B1'].map(l => (
            <button key={l} onClick={() => changeLevel(l)} style={{
              padding: '0.35rem 0.9rem', borderRadius: '999px', fontSize: '0.8rem', fontWeight: 600,
              letterSpacing: '0.04em', cursor: 'pointer', transition: 'all 0.12s',
              background: level === l ? C.ink : 'transparent', color: level === l ? 'white' : C.muted,
              border: `1px solid ${level === l ? C.ink : C.line}`,
            }}>{l}</button>
          ))}
        </div>

        {/* specimen */}
        <div style={{ ...cardStyle, padding: '1.5rem' }}>
          <div style={{ ...labelStyle, marginBottom: '0.75rem' }}>Sentence</div>
          <p style={{ fontSize: '1.4rem', lineHeight: 1.45, color: C.ink, margin: 0, fontWeight: 400 }}>
            {item.pre}
            <span style={{ background: C.mark, padding: '1px 5px', borderRadius: '5px', fontWeight: 700 }}>{item.vp}</span>
            {item.post}
          </p>
        </div>

        {/* TAG phase */}
        {phase === 'tag' && (
          <div style={cardStyle}>
            <div style={{ ...labelStyle, marginBottom: '0.75rem' }}>🏷️ Which tense is the verb?</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', marginBottom: graded ? '0.75rem' : '1rem' }}>
              {TENSES.map(t => {
                const picked = pick === t;
                let state = picked ? 'selected' : 'idle';
                if (graded) {
                  if (t === item.tense) state = picked ? 'correct' : 'answer';
                  else if (picked) state = 'wrong';
                }
                return (
                  <button key={t} disabled={graded} onClick={() => setPick(t)} style={chipStyle(state)}>
                    {TIEMPO_LABEL[t]}{state === 'correct' ? ' ✓' : state === 'wrong' ? ' ✕' : ''}
                  </button>
                );
              })}
            </div>

            {!graded && (
              <button onClick={checkTag} disabled={!pick} style={{
                width: '100%', padding: '0.85rem', borderRadius: '10px', border: 'none',
                background: pick ? PG : '#cbd5e0', color: 'white', fontSize: '0.95rem', fontWeight: 700,
                cursor: pick ? 'pointer' : 'not-allowed',
              }}>Check</button>
            )}

            {graded && !correct && (
              <div>
                <div style={{ color: C.bad, fontSize: '0.88rem', marginBottom: '0.75rem', lineHeight: 1.5 }}>
                  Not quite — the answer is in green. This one is the <b>{label}</b>.
                </div>
                <button onClick={() => reset()} style={{
                  width: '100%', padding: '0.85rem', borderRadius: '10px', border: 'none',
                  background: C.ink, color: 'white', fontSize: '0.95rem', fontWeight: 700, cursor: 'pointer',
                }}>↻ New sentence</button>
              </div>
            )}
          </div>
        )}

        {/* recognition success banner */}
        {correct && phase !== 'tag' && (
          <div style={{
            background: C.goodBg, border: `1px solid ${C.goodLine}`, borderRadius: '12px',
            color: C.good, fontSize: '0.9rem', padding: '0.75rem 1rem', marginBottom: '1rem',
          }}>✅ Tagged correctly — <b>{label}</b>.</div>
        )}

        {/* PRODUCE phase */}
        {phase === 'produce' && (
          <div style={cardStyle}>
            <div style={{ ...labelStyle, marginBottom: '0.6rem' }}>✏️ Your turn — earn the star</div>
            <div style={{ fontSize: '1rem', color: C.ink, marginBottom: '0.75rem' }}>
              Now write your own Spanish sentence in the <b>{label}</b>.
            </div>
            {FORMULAS_ES[item.tense] && (
              <div style={{ background: '#f7fafc', border: `1px solid ${C.line}`, borderRadius: '10px', padding: '0.6rem 0.8rem', marginBottom: '0.75rem' }}>
                <span style={{ fontFamily: 'ui-monospace, SFMono-Regular, monospace', fontSize: '0.82rem', fontWeight: 600, color: C.ink }}>{FORMULAS_ES[item.tense].formula}</span>
                <span style={{ display: 'block', marginTop: '0.3rem', fontSize: '0.8rem', color: C.muted, lineHeight: 1.4 }}>{FORMULAS_ES[item.tense].use}</span>
              </div>
            )}
            <textarea value={draft} onChange={e => { setDraft(e.target.value); setProd(null); }} rows={2} autoFocus
              placeholder="Escribe una frase…" autoCorrect="off" autoCapitalize="off" spellCheck={false} disabled={checking}
              onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey && draft.trim()) { e.preventDefault(); checkProduction(); } }}
              style={{
                width: '100%', padding: '0.85rem', fontSize: '1rem', boxSizing: 'border-box', resize: 'none',
                fontFamily: 'inherit', borderRadius: '10px', backgroundColor: '#f7f7ff',
                border: `2px solid ${prod && !prod.ok ? C.badLine : C.brand}`, color: '#2d3748', WebkitTextFillColor: '#2d3748',
              }} />

            {checking && (
              <div style={{ marginTop: '0.6rem' }}>
                <StatusPill tone="ai">🤖 AI is checking…</StatusPill>
              </div>
            )}
            {!checking && prod && !prod.ok && (
              <div style={{ marginTop: '0.6rem' }}>
                <StatusPill tone="bad">🤖 Not yet</StatusPill>
                <div style={{ color: C.bad, fontSize: '0.85rem', marginTop: '0.5rem', lineHeight: 1.5 }}>{prod.feedback}</div>
              </div>
            )}

            <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.75rem' }}>
              <button onClick={checkProduction} disabled={!draft.trim() || checking} style={{
                flex: 1, padding: '0.85rem', borderRadius: '10px', border: 'none',
                background: draft.trim() && !checking ? PG : '#cbd5e0', color: 'white', fontSize: '0.95rem', fontWeight: 700,
                cursor: draft.trim() && !checking ? 'pointer' : 'not-allowed',
              }}>{checking ? '🤖 Checking…' : '⭐️ Submit for a star'}</button>
              <button onClick={() => reset()} disabled={checking} style={{
                padding: '0.85rem 1rem', borderRadius: '10px', background: 'transparent', color: C.muted,
                border: `1px solid ${C.line}`, fontSize: '0.9rem', cursor: checking ? 'not-allowed' : 'pointer',
              }}>Skip</button>
            </div>
          </div>
        )}

        {/* DONE phase */}
        {phase === 'done' && (
          <div style={{ ...cardStyle, textAlign: 'center', padding: '1.5rem' }}>
            <div style={{ fontSize: '2.5rem', marginBottom: '0.25rem' }}>⭐️</div>
            <div style={{ fontSize: '1.05rem', fontWeight: 700, color: C.ink, marginBottom: '0.25rem' }}>Star earnt</div>
            <div style={{ color: C.muted, fontSize: '0.88rem', marginBottom: '0.25rem' }}>
              You recognised <i>and</i> produced the {label}.
            </div>
            {prod?.layer === 'ai' && (
              <div style={{ marginBottom: '0.6rem' }}><StatusPill tone="ai">🤖 AI checked</StatusPill></div>
            )}
            {prod?.layer === 'ai' && prod.feedback && (
              <div style={{ color: C.good, fontSize: '0.88rem', marginBottom: '0.75rem', lineHeight: 1.5 }}>{prod.feedback}</div>
            )}
            {prod?.layer === 'soft' && (
              <div style={{ marginBottom: '0.75rem' }}><StatusPill tone="warn">⚠️ AI unavailable — star awarded</StatusPill></div>
            )}
            <button onClick={() => reset()} style={{
              width: '100%', padding: '0.85rem', borderRadius: '10px', border: 'none', marginTop: '0.5rem',
              background: C.ink, color: 'white', fontSize: '0.95rem', fontWeight: 700, cursor: 'pointer',
            }}>↻ New sentence</button>
          </div>
        )}

        <div style={{ textAlign: 'center', color: C.faint, fontSize: '0.75rem', marginTop: '0.5rem' }}>
          {tagged} tagged · {stars} star{stars === 1 ? '' : 's'} earnt
        </div>
      </div>
    </div>
  );
}
