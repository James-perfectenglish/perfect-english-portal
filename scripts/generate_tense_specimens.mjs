/* ============================================================
   generate_tense_specimens.mjs
   Builds the Tense Tagger specimen bank: generates sentences with the
   SHARED engines, runs each through an AI "does this scan?" naturalness
   filter (same Haiku model the app marks with), and inserts the
   survivors into the tense_specimens table.

   The engine is imported, not duplicated — so the bank can never drift
   from what the live component would generate.

   ── Requirements ────────────────────────────────────────────
     • Node 18+ (global fetch). No new npm deps (@supabase/supabase-js
       is already a project dependency).
     • Env vars:
         ANTHROPIC_API_KEY            (same key the app uses)
         SUPABASE_SERVICE_ROLE_KEY    (Supabase dashboard → Settings → API)
   ── Usage ───────────────────────────────────────────────────
     node scripts/generate_tense_specimens.mjs            # full run, all buckets
     node scripts/generate_tense_specimens.mjs --dry      # generate + filter + PRINT, no DB writes
     node scripts/generate_tense_specimens.mjs --lang=es  # one language
     node scripts/generate_tense_specimens.mjs --level=B1 # one level
     node scripts/generate_tense_specimens.mjs --target=500
   ============================================================ */

import { createClient } from '@supabase/supabase-js';
import { makeGenerated } from '../src/lib/tenseEngineEn.js';
import { makeES } from '../src/lib/tenseEngineEs.js';

// ── config ──────────────────────────────────────────────────
const SUPABASE_URL = 'https://dyxmgicedabvmsbuvxny.supabase.co';
const MODEL = 'claude-haiku-4-5-20251001';
const BATCH = 20;            // sentences per AI filter call
const DEFAULT_TARGET = 1500; // survivors wanted per (language, level)

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
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!ANTHROPIC_API_KEY) { console.error('Missing ANTHROPIC_API_KEY'); process.exit(1); }
if (!DRY && !SERVICE_KEY) { console.error('Missing SUPABASE_SERVICE_ROLE_KEY (or pass --dry)'); process.exit(1); }

const sb = DRY ? null : createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });
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
    try {
      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-api-key': ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01' },
        body: JSON.stringify({ model: MODEL, max_tokens: 1024, messages: [{ role: 'user', content: prompt }] }),
      });
      if (res.status === 529) { await sleep(1000 + attempt * 1500); continue; }
      if (!res.ok) { console.warn(`  filter HTTP ${res.status} — keeping batch`); return sentences.map(() => true); }
      const data = await res.json();
      const text = (data.content || []).map(b => b.text || '').join('');
      const m = text.match(/\[[\s\S]*\]/);
      const verdicts = m ? JSON.parse(m[0]) : null;
      if (Array.isArray(verdicts) && verdicts.length === sentences.length) return verdicts.map(Boolean);
      console.warn('  filter parse mismatch — keeping batch');
      return sentences.map(() => true);
    } catch (e) {
      console.warn(`  filter error (${e.message}) — retrying`); await sleep(1000);
    }
  }
  return sentences.map(() => true); // default-keep on persistent failure
}

// ── per-bucket build ───────────────────────────────────────
async function buildBucket(language, level) {
  const seen = new Set();
  const survivors = [];
  let generated = 0, rejected = 0;
  const maxAttempts = TARGET * 6;

  while (survivors.length < TARGET && generated < maxAttempts) {
    // gather a fresh, de-duplicated batch of candidates
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
    console.log(`  [dry] sample of kept:`);
    survivors.slice(0, 8).forEach(c => console.log(`    ${c.sentence}`));
    return survivors.length;
  }

  // insert in chunks; ignore duplicates against the unique index
  let inserted = 0;
  for (let i = 0; i < survivors.length; i += 500) {
    const chunk = survivors.slice(i, i + 500).map(c => ({ language, level, ...c }));
    const { error, count } = await sb
      .from('tense_specimens')
      .upsert(chunk, { onConflict: 'language,level,sentence', ignoreDuplicates: true, count: 'exact' });
    if (error) { console.error('  insert error:', error.message); break; }
    inserted += count ?? chunk.length;
  }
  console.log(`  ${language} ${level}: inserted ${inserted}`);
  return inserted;
}

// ── main ───────────────────────────────────────────────────
(async () => {
  console.log(DRY ? '— DRY RUN (no DB writes) —' : '— generating tense_specimens —');
  const todo = BUCKETS.filter(b => (!onlyLang || b.language === onlyLang) && (!onlyLevel || b.level === onlyLevel));
  let total = 0;
  for (const b of todo) total += await buildBucket(b.language, b.level);
  console.log(`\nDone. ${DRY ? 'Would keep' : 'Inserted'} ${total} specimens across ${todo.length} buckets.`);
})();
