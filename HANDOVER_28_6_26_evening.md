# HANDOVER — 28 June 2026 (evening)

Shipped **Tense Tagger** — a new grammar activity that tests recognition *and* production of English tenses, with a teacher-facing confusion matrix. Built from design → clickable prototype → live repo in one session. Everything below is verified against the live DB, the filesystem, and Vercel this session, not memory.

> Morning session (month-end content alignment) is in `HANDOVER_28_6_26.md`. This is a separate, later piece of work.

---

## 🎯 What shipped: Tense Tagger 🏷️

A self-contained activity under **Exercises → Activities**. Two-part loop per item:

1. **Recognition** — a sentence is shown with its verb phrase highlighted ("the specimen"); the student tags it across **Time** (past/present/future), **Aspect** (simple/continuous/perfect/perfect continuous) and **Voice** (active/passive). The unchosen buttons on each axis *are* the distractors, so none are hand-authored.
2. **Production** — on a correct tag, the student writes their own sentence in that tense to earn a ⭐️.

**Why it can't be memorised:** every recognition sentence is **generated client-side**. The grammar is composed from the tags (an auxiliary chain built from `time + perfect? + progressive? + voice`), so the answer key falls out for free — no labelling, no AI, infinite variety.

**Level gating** (pills A2/B1/B2/C1, defaults to the student's profile level):
- A2: Time + Aspect{simple, continuous}, active only.
- B1: + Voice, + perfect aspect.
- B2: + perfect continuous, all voices.
- C1: everything, **plus a second question** — "what time does it *actually* refer to?" — which fires the form-vs-meaning teaching moment (present continuous for future, present simple for timetables, unreal past, etc.) from a small curated bank mixed in (~45% of C1 items).

---

## 🟢 Where it lives + the three-point registration

It's an **Activities** tile (`category='practice'`), registered the canonical way in `src/ExerciseList.jsx`:
- `ACTIVE_EXERCISES` → `'Tense Tagger'`
- `EXERCISE_ICONS` → `'Tense Tagger': '🏷️'`
- render branch → `else if (t === 'Tense Tagger') exerciseComponent = <TenseTagger profile={{ level: userLevel, tracks: userTracks }} />`
- DB `exercises` row → title `Tense Tagger`, category `practice`, level `A1-C2`, tracks `{general}`, `recommended_order` 8.

Title key is **identical across all four** (verified: DB title is exactly `[Tense Tagger]`, 12 chars, no whitespace). So a "Soon" badge here is **cache lag**, not drift — hard-refresh / reopen the PWA.

---

## 🗄️ Database (live now — no deploy needed)

**`tense_attempts`** (new) — the recognition record, the thing that drives teaching. Mirrors the `sc_sentences` write pattern exactly: direct client insert, RLS = student owns insert/select, teacher reads all.

```
id uuid pk | student_id uuid → profiles(id) cascade | language | level | sentence | verb_phrase
answer jsonb | picks jsonb | is_correct | is_mismatch | function_answer | function_picked
input_method | attempted_at
```
Verified live: 14 columns, RLS on, 3 policies.

**Two teacher views** (`security_invoker = on`, so RLS governs them — teacher sees all, student sees own):
- `tense_axis_accuracy` — % correct per dimension, per student.
- `tense_confusion` — **the confusion matrix**: per axis, "correct was X, they tagged Y, N times". This is the lesson-planning artifact.

Reading the data:
```sql
-- one student
select axis, correct_value, picked_value, n from tense_confusion
  where student_id = 'STUDENT_UUID' order by n desc;
-- whole class, rolled up
select axis, correct_value, picked_value, sum(n) as n
  from tense_confusion group by 1,2,3 order by n desc;
```

**Stars:** a passed production writes to `stars` with `source='tense_tagger'`, `subtype='production'`, **no `dedupe_key`** (repeatable, like rpe/topic_practice). `stars.source` is unconstrained, so no enum change was needed.

---

## 💻 Code (deployed — commit `bb6cf44`, Vercel READY)

- `src/components/TenseTagger.jsx` — **new**. Generator + tagger + C1 second question + client-side structural production check + the `tense_attempts`/`stars` inserts. Pure inline styles, emoji (no Tailwind, no lucide — neither is in the stack).
- `src/ExerciseList.jsx` — registered the tile (4 edits above).
- `src/components/PracticePage.jsx` — **reverted**; the first cut wrongly lived on the Practise page. Clean revert, no residue.

Two production deploys landed this session and both are READY: `caded94` (initial, Practise page) then `bb6cf44` (moved to Activities + the fixes below). `bb6cf44` is current production. Function count unchanged at 8 — **no serverless function was added** (production marking is client-side for now; see ship 2).

---

## 🐛 Fixes made during live testing (all verified)

Real-device testing surfaced four issues, all fixed and re-verified by running the generator 2,400× (0 bad sentences) and unit-testing the checker:

1. **Nonsense sentence** — "…will have been buying the tickets by next year." → **dropped future perfect continuous** entirely, and restricted perfect continuous to durative activity verbs + a duration phrase + no object ("I have been working for ages").
2. **Unnatural** — "The news was being watched last night." → **continuous passive restricted to process verbs** (clean/cook/serve/prepare/build/paint/fix/deliver). Now: "Breakfast was being served", "The wall is being painted".
3. **Unnatural** — "The car will be being driven next week." → **dropped future continuous passive** outright.
4. **Correct answer rejected** — "We will have been there by then" failed the future-perfect check. Root cause: the checker excluded any `been`, but `been` is a legit **main-verb** participle. Fixed to exclude only `been + V-ing` (the continuous). Verified: "will have been there" passes; "has been working" still correctly fails *present perfect*.

Plus: **Enter submits** the production sentence (the Tense Tagger box; `SentenceChallenge.jsx` already had this).

---

## ⚠️ Known limitations / fine-tune candidates for tomorrow

- **Present/past SIMPLE active production soft-passes.** Those tenses have no clean structural signature without lemma knowledge, so the checker accepts and shows "(structure looks right — AI naturalness check comes later)". This is the exact seam **ship 2** closes.
- **Lexicon is bundled in the component** (~38 verbs, everyday + hospitality). Moving it to a Supabase table is the obvious next step so it grows without a deploy.
- **Semantic pruning is heuristic** — three sets in the component: `ACTIVITY` (perfect-continuous), `PROCESS_PASSIVE` (continuous passive), `PUNCTUAL` (excluded from continuous). If any odd pairing shows up, adjust the set membership; that's the lever.
- **Modality is deliberately not generated.** Forcing time/aspect tags onto modal sentences ("should delay" — advice or obligation?) produced defensible-but-arguable answers, which breaks the "no defensible distractors" rule. Planned as its own item type (tag the modal *function*), not a fourth axis.

---

## 🧭 Ship 2 / on the horizon (design decided, not built)

- **AI naturalness layer for production.** Add a `tense` context to `mark-free.js` (reuse it — **do not add a function**, Vercel is at the 8/12-ish cap) so the AI confirms the soft-passed simple tenses read naturally. Two-layer: client structural check first, AI second.
- **Harvest produced sentences to `sc_sentences`** (`source='tense_tagger'`, target = tense name) so they flow into `student_sentences` + the tagging classifier like every other surface.
- **Surface `tense_confusion` in the teacher dashboard** (currently SQL-only).
- **Spanish track** — a *different engine* (a conjugator, not the auxiliary chain), A2/B1 only, headline drill = **pretérito vs imperfecto**, plus presente vs presente continuo. Drops voice, modality, and the second question.
- **RPE slot** — drop one recognition-only Tense Tagger item per round (no production ⭐️ inside RPE).

---

## 🛠️ Gotchas learned this session

- **`been` is a main-verb participle too.** Any structural check for the perfect must not blanket-exclude `been` — only `been + V-ing` marks the continuous.
- **Activities tab = `ExerciseList` `category='practice'`** (the tab is labelled "Activities", `getSectionLabel('practice')` returns "Practice" for the breadcrumb — cosmetic).
- **"Soon" badge** = title not in the *deployed* `ACTIVE_EXERCISES`, **or** browser/PWA cache. Check deploy state (Vercel) and title equality before assuming drift.
- **This app has no Tailwind and no lucide-react** — inline styles + emoji only. New components must follow suit.
- **`security_invoker = on` views** let teacher RLS do the work — no need to REVOKE.

---

## ✅ Verified live state

- `tense_attempts`: 14 cols, RLS on, 3 policies. Views `tense_axis_accuracy` + `tense_confusion` present.
- `exercises` row `b05a149c-…`: title `Tense Tagger`, category `practice`, order 8, clean.
- Vercel: `bb6cf44` READY in production. All three code files parse clean (esbuild). Generator: 0 bad sentences / 2,400 samples.

---

## 🪞 Bigger picture

Same shape as always — **build the smallest honest increment, verify at the root, stage the rest.** Tense Tagger ships the full recognise→produce loop *and* the teaching record (the confusion matrix James actually wanted), while the AI-naturalness layer, the sentence harvest, Spanish, and the RPE slot are named and deferred rather than half-built. The live-test bugs got root-cause fixes (the `been` participle, the unnatural-form pruning) and were re-verified by running the generator, not by eyeballing. The lexicon-in-DB migration is the obvious next efficiency lever; the AI layer is the obvious next quality lever.
