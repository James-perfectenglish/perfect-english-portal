/* ============================================================
   generate_tense_specimens.mjs
   Builds the Tense Tagger specimen bank: generates sentences with the
   SHARED engines, runs each through an AI "does this scan?" naturalness
   filter (same Haiku model the app marks with), and inserts the
   survivors into the tense_specimens table.

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
   ============================================================ */

import pg from 'pg';
import { makeGenerated } from '../src/lib/tenseEngineEn.js';
import { makeES } from '../src/lib/tenseEngineEs.js';

const { Client } = pg;

// ── config ──────────────────────────────────────────────────
const MODEL = 'claude-haiku-4-5-20251001';
const BATCH = 20;            // sentences per AI filter call
const DEFAULT_TARGET = 1500; // survivors wanted per (language, level)
const INSERT_CHUNK = 500;    // rows per INSERT statement

const BUCKETS = [
  { language: 'en', level: 'A2' }, { language: 'en', level: 'B1' },
  { language: 'en', level: 'B2' }, { language: 'en', level: 'C1' },
  { language: 'es', level: 'A2' }, { language: 'es', level: 'B1' },
];

// ── args ────────────────────────────────────────────────────
const args = process.argv.slice(2);
const DRY = args.includes('--dry');
const arg = k => { const a = args.find(x => x.startsWith(`--${k}=`)); return a ? a.split('=')[1] : null; };
const onlyLang = arg('lang');
const onlyLevel = arg('level');
const TARGET = arg('target') ? parseInt(arg('target'), 10) : DEFAULT_TARGET;

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
const DB_URL = process.env.SUPABASE_DB;
if (!ANTHROPIC_API_KEY) { console.error('Missing ANTHROPIC_API_KEY'); process.exit(1); }
if (!DRY && !DB_URL) { console.error('Missing SUPABASE_DB (or pass --dry)'); process.exit(1); }

let client = null;
const sleep = ms => new Promise(r => setTimeout(r, ms));

// ── one specimen from the right engine ─────────────────────
function makeOne(language, level) {
  if (language === 'es') {
    const it = makeES(level);
    return { pre: it.pre, vp: it.vp, post: it.post, sentence: it.sentence, answer: { tiempo: it.tense } };
  }
  const it = makeGenerated(level);
  if (!it) return null;
  return { pre: it.pre, vp: it.vp, post: it.post, sentence: it.pre + it.vp + it.post, answer: it.answer };
}

// ── AI naturalness filter (batched) ────────────────────────
async function filterBatch(sentences, language) {
  const lang = language === 'es' ? 'Spanish' : 'English';
  const example = language === 'es'
    ? 'e.g. reject "Yo traje el menú el año que viene" — a fluent speaker would not say that'
    : 'e.g. reject "We will have brought the menu by next year" — a fluent speaker would not say that';
  const list = sentences.map((s, i) => `${i + 1}. ${s}`).join('\n');
  const prompt = `You are a strict but fair language-teaching editor. For each numbered ${lang} sentence, decide whether it is NATURAL, idiomatic ${lang} that a teacher would be happy to show a learner. Reject ONLY sentences that are grammatically fine but read oddly — implausible scenarios, awkward collocations, or things a fluent speaker would never say (${example}). Accept anything that sounds normal, even if a little plain.

Return ONLY a JSON array of booleans, one per sentence in order (true = keep, false = reject). No other text.

Sentences:
${list}`;

  for (let attempt = 0; attempt < 3; attempt++) {
    let res;
    try {
      res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-api-key': ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01' },
        body: JSON.stringify({ model: MODEL, max_tokens: 1024, messages: [{ role: 'user', content: prompt }] }),
      });
    } catch (e) {
      console.warn(`  filter network error (${e.message}) — retrying`); await sleep(1000); continue;
    }
    if (res.status === 529 || res.status === 429) { await sleep(1500 + attempt * 1500); continue; }  // transient — back off and retry
    if (!res.ok) {  // hard error (bad key / no credits / bad request): abort rather than silently bank unfiltered rows
      const body = await res.text().catch(() => '');
      throw new Error(`Anthropic filter returned HTTP ${res.status}. ${body.slice(0, 200)}`);
    }
    const data = await res.json();
    const text = (data.content || []).map(b => b.text || '').join('');
    const m = text.match(/\[[\s\S]*\]/);
    const verdicts = m ? JSON.parse(m[0]) : null;
    if (Array.isArray(verdicts) && verdicts.length === sentences.length) return verdicts.map(Boolean);
    console.warn('  filter parse mismatch — keeping this batch');  // rare; safe to keep one batch
    return sentences.map(() => true);
  }
  console.warn('  filter unavailable after retries — keeping this batch');
  return sentences.map(() => true);
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
  const maxAttempts = TARGET * 6;

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

    const verdicts = await filterBatch(batch.map(c => c.sentence), language);
    batch.forEach((c, i) => { if (verdicts[i]) survivors.push(c); else rejected++; });
    process.stdout.write(`\r  ${language} ${level}: kept ${survivors.length}/${TARGET}  (rejected ${rejected})   `);
  }
  process.stdout.write('\n');

  if (DRY) {
    console.log('  [dry] sample of kept:');
    survivors.slice(0, 8).forEach(c => console.log(`    ${c.sentence}`));
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
