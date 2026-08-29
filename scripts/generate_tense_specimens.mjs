/* ============================================================
   generate_tense_specimens.mjs
   Builds the Tense Tagger specimen bank: generates sentences with the
   SHARED engines, runs each through an AI editor that judges BOTH
   plausibility and fitness-as-a-specimen, and inserts the survivors
   into the tense_specimens table.

   The engine is imported, not duplicated — so the bank can never drift
   from what the live component would generate.

   ── Requirements ────────────────────────────────────────────
     • Node 18+ (global fetch).
     • One npm dep:  npm i pg
     • Env vars (already in your shell for other scripts):
         ANTHROPIC_API_KEY   — same key the app marks with
         SUPABASE_DB         — your Postgres connection string
                               (the same one your psycopg2 scripts use)
   ── Usage ───────────────────────────────────────────────────
     node scripts/generate_tense_specimens.mjs            # full run, all buckets
     node scripts/generate_tense_specimens.mjs --dry      # generate + filter + PRINT, no DB writes
     node scripts/generate_tense_specimens.mjs --lang=es  # one language
     node scripts/generate_tense_specimens.mjs --level=B1 # one level
     node scripts/generate_tense_specimens.mjs --target=500
     node scripts/generate_tense_specimens.mjs --model=claude-haiku-4-5-20251001

   ── The filter ──────────────────────────────────────────────
   The filter is told WHICH TENSE each sentence is a specimen for, and
   asks two questions rather than one:
     1. Plausibility — could this happen, would anyone say it? This is
        where grammatically flawless nonsense gets caught ("Cuando abrió
        el restaurante, el cliente ya había dormido").
     2. Fitness — is it a CLEAR example of the stated tense? If a fluent
        speaker would reach for a different tense, the answer key is
        wrong and the learner gets marked down for agreeing with the
        native speaker. That is worse than an ugly sentence.
   Rejections come back with a short reason, which --dry prints. Tune the
   prompt from those reasons, not from guesswork.
   ============================================================ */

import pg from 'pg';
import { makeGenerated, tenseName } from '../src/lib/tenseEngineEn.js';
import { makeES, TIEMPO_ES } from '../src/lib/tenseEngineEs.js';

const { Client } = pg;

// ── config ──────────────────────────────────────────────────
// Opus by default. The filter's job is a plausibility judgement, and that is
// exactly where a cheaper model waves through grammatical-but-absurd sentences.
// At ~450 input / ~200 output tokens per 20-sentence call, a full six-bucket
// rebuild costs a few dollars — the model is not the place to economise here.
// Override with --model= to A/B a cheaper one against a --dry sample.
const DEFAULT_MODEL = 'claude-opus-5';
const BATCH = 20;            // sentences per AI filter call
const DEFAULT_TARGET = 1500; // survivors wanted per (language, level)
const INSERT_CHUNK = 500;    // rows per INSERT statement

const BUCKETS = [
  { language: 'en', level: 'A2' }, { language: 'en', level: 'B1' },
  { language: 'en', level: 'B2' }, { language: 'en', level: 'C1' },
  { language: 'es', level: 'A2' }, { language: 'es', level: 'B1' },
];

/* ⚠️ SPANISH REBUILD — the ES engine now covers EIGHT tiempos (perfecto,
   pluscuamperfecto, futuro and condicional were added). The existing ES rows
   only cover the original four, so a rebuild is needed:

     node scripts/generate_tense_specimens.mjs --lang=es --dry     # eyeball first
     node scripts/generate_tense_specimens.mjs --lang=es

   ORDER MATTERS: deploy the app FIRST, then run this. New-tiempo rows would
   break a previously deployed TenseTaggerES, which only knows four tiempos and
   would render a chip row with no correct answer in it. The inserts are
   ON CONFLICT DO NOTHING against (language, level, sentence), so re-running is
   safe and additive — old rows are kept, not replaced. */

// ── args ────────────────────────────────────────────────────
const args = process.argv.slice(2);
const DRY = args.includes('--dry');
const arg = k => { const a = args.find(x => x.startsWith(`--${k}=`)); return a ? a.split('=')[1] : null; };
const onlyLang = arg('lang');
const onlyLevel = arg('level');
const TARGET = arg('target') ? parseInt(arg('target'), 10) : DEFAULT_TARGET;
const MODEL = arg('model') || DEFAULT_MODEL;

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
const DB_URL = process.env.SUPABASE_DB;
if (!ANTHROPIC_API_KEY) { console.error('Missing ANTHROPIC_API_KEY'); process.exit(1); }
if (!DRY && !DB_URL) { console.error('Missing SUPABASE_DB (or pass --dry)'); process.exit(1); }

let client = null;
const sleep = ms => new Promise(r => setTimeout(r, ms));

// ── one specimen from the right engine ─────────────────────
// `target` is the human-readable tense name, passed to the filter so it can
// judge fitness-as-a-specimen, not just whether the sentence scans.
function makeOne(language, level) {
  if (language === 'es') {
    const it = makeES(level);
    return {
      pre: it.pre, vp: it.vp, post: it.post, sentence: it.sentence,
      answer: { tiempo: it.tense }, target: TIEMPO_ES[it.tense] || it.tense,
    };
  }
  const it = makeGenerated(level);
  if (!it) return null;
  return {
    pre: it.pre, vp: it.vp, post: it.post, sentence: it.pre + it.vp + it.post,
    answer: it.answer, target: tenseName(it),
  };
}

// ── AI editor: plausibility + fitness-as-a-specimen (batched) ────
async function filterBatch(items, language) {
  const lang = language === 'es' ? 'Spanish' : 'English';
  const bad = language === 'es'
    ? ['"Cuando abrió el restaurante, el cliente ya había dormido." — grammatically perfect; nobody has this thought',
       '"Ellos vivieron en Palma el lunes pasado." — a long-running state pinned to a single past moment',
       '"El cocinero ha esperado a los clientes este año." — the time frame makes the action pointless']
    : ['"We will have brought the menu by next year." — the timescale is absurd for the action',
       '"The chef had slept when the restaurant opened." — grammatical, but not a thought anyone has',
       '"They have been owning the hotel since Monday." — a state verb forced into a continuous'];
  const list = items.map((it, i) => `${i + 1}. ${it.sentence}   [${it.target}]`).join('\n');

  const prompt = `You are a language-teaching editor deciding which sentences are fit to show a learner.

Each ${lang} sentence below is a specimen for one specific tense, named in brackets after it. Judge each on TWO questions.

1. PLAUSIBILITY — could this actually happen, and would a real person ever say it? Reject sentences that are grammatically flawless but describe an absurd, pointless or incoherent scenario. This is the most common failure and the main thing you are here to catch:
   • ${bad[0]}
   • ${bad[1]}
   • ${bad[2]}

2. FITNESS AS A SPECIMEN — is this a clear, unambiguous example of the tense in brackets? Reject if a fluent speaker would naturally use a DIFFERENT tense to say this. The bracketed tense is the answer key, so a learner who agrees with the native speaker would be marked wrong — worse than an ugly sentence.

ACCEPT anything plausible and clearly in its stated tense, even if plain or unexciting. Do NOT reject for being dull, short, or for lacking an object. Do NOT reject for regional variation, or for a missing accent or punctuation mark.

Return ONLY a JSON array, one entry per sentence, in order:
[{"keep":true},{"keep":false,"why":"six words maximum"}]
No other text.

Sentences:
${list}`;

  const keepAll = () => items.map(() => ({ keep: true, why: null }));

  for (let attempt = 0; attempt < 3; attempt++) {
    let res;
    try {
      res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-api-key': ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01' },
        body: JSON.stringify({ model: MODEL, max_tokens: 2048, messages: [{ role: 'user', content: prompt }] }),
      });
    } catch (e) {
      console.warn(`  filter network error (${e.message}) — retrying`); await sleep(1000); continue;
    }
    if (res.status === 529 || res.status === 429) { await sleep(1500 + attempt * 1500); continue; }  // transient — back off and retry
    if (!res.ok) {  // hard error (bad key / no credits / bad model id): abort rather than silently bank unfiltered rows
      const body = await res.text().catch(() => '');
      throw new Error(`Anthropic filter returned HTTP ${res.status}. ${body.slice(0, 200)}`);
    }
    const data = await res.json();
    const text = (data.content || []).map(b => b.text || '').join('');
    const m = text.match(/\[[\s\S]*\]/);
    let parsed = null;
    try { parsed = m ? JSON.parse(m[0]) : null; } catch { parsed = null; }
    if (Array.isArray(parsed) && parsed.length === items.length) {
      // tolerate a bare-boolean array too, in case a model ignores the object shape
      return parsed.map(v => (typeof v === 'boolean'
        ? { keep: v, why: null }
        : { keep: v?.keep !== false, why: v?.why || null }));
    }
    console.warn('  filter parse mismatch — keeping this batch');  // rare; safe to keep one batch
    return keepAll();
  }
  console.warn('  filter unavailable after retries — keeping this batch');
  return keepAll();
}

// ── insert a chunk of survivors (ON CONFLICT DO NOTHING against the dedup index) ──
async function insertChunk(rows) {
  const cols = ['language', 'level', 'pre', 'vp', 'post', 'sentence', 'answer'];
  const values = [];
  const tuples = rows.map((r, i) => {
    const b = i * cols.length;
    values.push(r.language, r.level, r.pre, r.vp, r.post, r.sentence, JSON.stringify(r.answer));
    return `($${b + 1},$${b + 2},$${b + 3},$${b + 4},$${b + 5},$${b + 6},$${b + 7}::jsonb)`;
  });
  const sql = `INSERT INTO public.tense_specimens (language,level,pre,vp,post,sentence,answer)
               VALUES ${tuples.join(',')}
               ON CONFLICT (language,level,sentence) DO NOTHING`;
  const res = await client.query(sql, values);
  return res.rowCount;
}

// ── per-bucket build ───────────────────────────────────────
async function buildBucket(language, level) {
  const seen = new Set();
  const survivors = [];
  let generated = 0, rejected = 0;
  // Headroom: the two-question filter rejects harder than the old naturalness
  // check, so a bucket needs more attempts to fill. Raise this, not the bar,
  // if a bucket comes up short.
  const maxAttempts = TARGET * 12;
  const keptBy = {}, rejBy = {}, samples = [];

  while (survivors.length < TARGET && generated < maxAttempts) {
    const batch = [];
    while (batch.length < BATCH && generated < maxAttempts) {
      generated++;
      const cand = makeOne(language, level);
      if (!cand || seen.has(cand.sentence)) continue;
      seen.add(cand.sentence);
      batch.push(cand);
    }
    if (!batch.length) break;

    const verdicts = await filterBatch(batch, language);
    batch.forEach((c, i) => {
      if (verdicts[i].keep) {
        survivors.push(c);
        keptBy[c.target] = (keptBy[c.target] || 0) + 1;
      } else {
        rejected++;
        rejBy[c.target] = (rejBy[c.target] || 0) + 1;
        if (samples.length < 25) samples.push({ s: c.sentence, t: c.target, why: verdicts[i].why });
      }
    });
    process.stdout.write(`\r  ${language} ${level}: kept ${survivors.length}/${TARGET}  (rejected ${rejected})   `);
  }
  process.stdout.write('\n');

  // Per-tense keep rate. A tense rejecting far harder than its neighbours means
  // the ENGINE is generating bad specimens for it (wrong adverbials, or a frame
  // that suits few verbs) — fix that rather than paying the filter to bin them.
  const targets = [...new Set([...Object.keys(keptBy), ...Object.keys(rejBy)])].sort();
  console.log('  keep rate by tense:');
  for (const t of targets) {
    const k = keptBy[t] || 0, r = rejBy[t] || 0;
    const pct = (k + r) ? Math.round(k / (k + r) * 100) : 0;
    const flag = (k + r >= 20 && pct < 45) ? '   <-- check the engine for this one' : '';
    console.log(`    ${t.padEnd(28)} ${String(pct).padStart(3)}%   (kept ${k}, rejected ${r})${flag}`);
  }

  if (DRY) {
    console.log('  [dry] sample of KEPT:');
    survivors.slice(0, 8).forEach(c => console.log(`    ${c.sentence}   [${c.target}]`));
    if (samples.length) {
      console.log('  [dry] sample of REJECTED, with reasons:');
      samples.slice(0, 15).forEach(x => console.log(`    ${x.s}   [${x.t}]\n        -> ${x.why || '(no reason given)'}`));
    }
    return survivors.length;
  }

  let inserted = 0;
  for (let i = 0; i < survivors.length; i += INSERT_CHUNK) {
    const chunk = survivors.slice(i, i + INSERT_CHUNK).map(c => ({ language, level, ...c }));
    inserted += await insertChunk(chunk);
  }
  console.log(`  ${language} ${level}: inserted ${inserted}`);
  return inserted;
}

// ── main ───────────────────────────────────────────────────
(async () => {
  console.log(DRY ? '— DRY RUN (no DB writes) —' : '— generating tense_specimens —');
  if (!DRY) {
    client = new Client({ connectionString: DB_URL, ssl: { rejectUnauthorized: false } });
    await client.connect();
  }
  const todo = BUCKETS.filter(b => (!onlyLang || b.language === onlyLang) && (!onlyLevel || b.level === onlyLevel));
  let total = 0, aborted = null;
  try {
    for (const b of todo) total += await buildBucket(b.language, b.level);
  } catch (e) {
    aborted = e;
  } finally {
    if (client) await client.end();
  }
  if (aborted) {
    console.error(`\n\n\u2716 Aborted: ${aborted.message}`);
    console.error('  Nothing further was inserted in this run. Common cause: the Anthropic credit balance ran out — top up at console.anthropic.com (Billing), then re-run, using --lang/--level to target the buckets that did not finish.');
    process.exit(1);
  }
  console.log(`\nDone. ${DRY ? 'Would keep' : 'Inserted'} ${total} specimens across ${todo.length} buckets.`);
})();
