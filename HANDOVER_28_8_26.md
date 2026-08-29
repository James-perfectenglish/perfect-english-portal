# Handover — 28 August 2026

**Session type:** feature build. Spanish Tense Tagger brought up to parity with the English one,
extended from four tiempos to eight, and a **focus mode** added to both languages so a set can be
narrowed to a single teaching contrast.

Everything below is **written to the repo and validated but NOT committed** — James commits and
pushes. See §7 for the deploy order, which matters this time.

---

## 1. What was wrong

**The Explainer/Tagger mismatch was Spanish-only.** `tenseExplainEn.js` has 19 tenses and the EN
engine generates all of them — no gap. `tenseExplainEs.js` had nine tiempos and the engine knew
four. **Perfecto, pluscuamperfecto, futuro, condicional and subjuntivo all carried
`practisable: false`**, so a Spanish student opening those cards got no "Show me a real example"
and no "Practise this". They read the card and hit a wall.

**The ES component never got the English scaffold.** No set of 10, no progress/score strip, no
completion screen, and no `seenTensesRef` — so it demanded a full written production on *every*
correct tag. A wrong answer offered "↻ New sentence" rather than "Next →", so nothing accumulated.

**A live bug, found while doing this:** the old "Practise this" lock generated one tense but still
rendered **every** chip, in both languages. Three correct guesses and a student had the answer for
free, and `tense_attempts` has been recording those as genuine recognitions. Fixed — chips and pool
now come from one function by construction.

**A latent quality issue in the ES engine:** it dropped the curated object 30% of the time
regardless of transitivity, producing strandings like *"Los clientes lavaron anoche."* Objects are
now always supplied to verbs that have them. This improves the original four tiempos too, which
means **the current ES bank is slightly below the new standard** until it is rebuilt.

---

## 2. Focus mode — the design

Each axis is now in one of three states:

| state | value | behaviour |
|---|---|---|
| **mix** | `null` | all the level's options live, axis IS asked |
| **pinned** | a string | axis NOT asked — fixed, shown as context above the sentence |
| **restricted** | array of 2+ | axis IS asked, but only those chips appear |

**The rule that matters: filtering the pool is not enough — the axis has to leave the question.**
Serving only present-tense sentences while leaving past/present/future live makes Time a freebie,
inflates the score and poisons the attempt data. That is exactly the bug described above.

Presets are the primary control (a "Custom" matrix is deliberately not built yet):

- **English:** All tenses · Time only · Simple vs continuous · Present/Past/Future only ·
  Past: simple vs perfect · Active vs passive · Perfect vs perfect continuous (B2+)
- **Spanish:** All tenses · Pretérito vs imperfecto · Presente vs presente continuo ·
  Pretérito vs perfecto · Past tenses only · Present only · Perfecto vs pluscuamperfecto (B1) ·
  Futuro vs condicional (B1)

At C1 the English presets resolve like this (verified, not asserted):

```
All tenses                      asks: Time(3) Type(4) Voice(2)
Time only                       asks: Time(3)              fixed: Type: simple, Voice: active
Simple vs continuous            asks: Time(3) Type(2)      fixed: Voice: active
Future only                     asks: Type(3)              fixed: Time: future, Voice: active
Active vs passive               asks: Voice(2)             fixed: Time: past, Type: simple
Perfect vs perfect continuous   asks: Type(2)              fixed: Time: present, Voice: active
```

Note "Future only" shows **Type(3)**, not 4. Chips come from what is *reachable* once the other
axes are fixed, so the never-generated "future perfect continuous" chip is not offered — a dead
option a student could learn to rule out for free.

### "Practise this" is now a contrast pair, not a lock

Pinning a single tense left nothing to decide. It now pins the surrounding axes and puts the chosen
tense against its nearest contrast — two chips, one real decision, still centred on what they
clicked. ES bridge (B1):

```
presente / presente_continuo → presente vs presente continuo
preterito / imperfecto       → pretérito vs imperfecto
perfecto / pluscuamperfecto  → perfecto vs pluscuamperfecto
futuro / condicional         → futuro vs condicional
```

At A2, where a partner is out of band, it falls back to the tiempo's whole group.

---

## 3. Files changed

| File | Change |
|---|---|
| `src/lib/tenseFocus.js` | **NEW** — shared focus model, presets both languages, bridges, `focusToJson` |
| `src/lib/tenseEngineEs.js` | four new tiempos, frames, participles, future stems, `tiemposIn`/`tensesFor` split |
| `src/lib/tenseEngineEn.js` | `allowedSpecsFocused`, `axisOptionsEn`, `makeGenerated(level, only, focus)` |
| `src/components/TenseTaggerES.jsx` | **rewritten** — parity scaffold + focus + grouped chips |
| `src/components/TenseTagger.jsx` | lock → focus, preset picker, pinned-context line |
| `src/lib/tenseExplainEs.js` | `practisable` flags flipped on the four new tiempos |
| `api/mark-free.js` | ES tense prompt: all eight tiempos + two traps + Peninsular note |
| `scripts/generate_tense_specimens.mjs` | rebuild instructions + deploy-order warning |

**Migration applied** (`add_focus_to_tense_attempts`): `tense_attempts.focus jsonb`, nullable, with
a partial GIN index. `NULL` = unfocused, so every pre-existing row stays directly comparable and no
backfill was needed. Without it a 10/10 on a one-axis set would be silently compared against a
10/10 on three.

---

## 4. The Spanish engine — eight tiempos

Added **perfecto, pluscuamperfecto, futuro, condicional**. Subjuntivo deliberately excluded: it is a
mood, needs a trigger clause (*"Espero que…"*), so the highlighted verb sits in a subordinate clause
and the template shape is different. Separate job; it still carries `practisable: false`.

**Every conjugated form is verified against the hand-authored tables in `verbConjugatorEs.js`** —
the reference students actually read. That includes the `-ído` accent trap (`leído`, `traído`,
where the stem ends in a vowel) and the shared future/conditional stems (`tendr-`, `har-`,
`pondr-`, `dir-`, `vendr-`). Six irregular participles and five future stems were added per-verb.

Two tiempos need a sentence **frame** to read naturally, prefixing `pre` so `vp` stays the
highlighted span and the bank's pre/vp/post round-trip is unchanged:

- **pluscuamperfecto** — an anchor clause, because the past-before-the-past needs a past to sit
  before. *"Para las diez, ellas ya habían pedido la cuenta."*
- **condicional** — an optional hypothetical opener. *"Con más tiempo, el cliente vendría al hotel."*

`ser` is skipped in all four new tiempos — *"he sido de Madrid"* is not a sentence to show a learner.

**Level gating:** A2 = 5 tiempos (adds perfecto), B1 = 8. Pills stay A2/B1. B2 arrives with the
subjuntivo, so no empty promise is shipped.

**Sample from the deployed engine, B1:**

```
presente            Él lee las reseñas siempre.
presente_continuo   Mi compañera está haciendo el café ahora mismo.
preterito           Yo puse las flores el lunes pasado.
imperfecto          Ellas bebían un café de vez en cuando.
perfecto            El cocinero ha llegado al hotel este mes.
pluscuamperfecto    Para las diez, ellas ya habían pedido la cuenta.
futuro              Yo trabajaré el mes que viene.
condicional         Ellas terminarían el trabajo con mucho gusto.
```

⚠️ **The adverbial sets and frames are first drafts on James's turf** and worth a read before the
bank run. The conjugations are checked; the *style* is not.

---

## 5. Validation done

- **Conjugations:** every person of futuro, condicional, perfecto and pluscuamperfecto for the model
  verbs, plus all 13 participle cases, diffed against `verbConjugatorEs.js`. All pass.
- **Shape:** 3,000 generated sentences — `pre + vp + post` round-trips, no doubled spaces, `vp`
  always inside the sentence.
- **Focus, both languages:** every preset × every level asserts (a) the generated pool stays inside
  the chips, and (b) **no dead chips** — every offered option is actually reachable. Plus every
  Practise-this bridge combination yields ≥2 chips including the tense clicked.
- **Builds:** both components validated with esbuild from the repo copies, and the repo files were
  diffed against the sandbox versions with comments stripped — code identical.

---

## 6. Known constraints

- **No Custom matrix UI yet** — presets only, deliberately. When it is built, drive its controls
  from `axisOptionsEn()` so an unsatisfiable combination cannot be assembled; the engine's fallback
  for an impossible focus is to widen the pool, which would reintroduce a chip/pool mismatch. The
  code carries a note at that spot.
- **Curated form≠function items are excluded from focused C1 sets.** They carry fixed tags and
  cannot honour a focus rule. Unfocused C1 is unchanged.
- `tensesFor` (chips) enforces a two-option floor; `tiemposIn` (generation) does not. The component
  feeds the chip list back into `makeES`, so they agree by construction — **do not "simplify" that
  by passing the raw focus to the engine.**

---

## 7. Open items — deploy order matters

1. **Deploy the app FIRST, then rebuild the ES bank.** Running the generator first would insert
   new-tiempo rows that the *currently deployed* `TenseTaggerES` cannot handle — it knows four
   tiempos and would render a chip row with no correct answer in it.
   ```
   node scripts/generate_tense_specimens.mjs --lang=es --dry
   node scripts/generate_tense_specimens.mjs --lang=es
   ```
   Inserts are `ON CONFLICT DO NOTHING`, so the run is additive and safe to repeat. Check the
   Anthropic credit balance first — the script aborts cleanly if it runs out.
2. **In the interim window the new tiempos come from the live conjugator**, unfiltered by the AI
   naturalness pass. `missingRef` in the component detects which tiempos the bank has no rows for
   and tops them up live in proportion, so they stay in rotation rather than vanishing. Quality is
   lower until the bank run; it self-heals afterwards with no code change.
3. **Read the ES adverbials and frames** (§4) before the bank run — cheaper to fix before 1,500
   sentences are filtered than after.
4. Consider whether the pre-focus `tense_attempts` rows should be treated with suspicion given the
   leaking lock (§1). Anything with a `NULL` focus and an unusually high accuracy on one axis may
   have come from a locked session.
5. Subjuntivo — needs a trigger-clause generator. Would unlock B2 for Spanish.

**Carried forward, untouched this session:**
- **October + November content — all 14 daily streams end 2026-09-30.** Target ~22 September.
- Website: confirm the nav-breakpoint fix and the three other pending changes are pushed, then run
  Post Inspector. LinkedIn launch post still to draft.
- GET21 — light no-ask touch mid-September, proper push late October.
- PWA update banner, `HelpSheet` on marking-based exercises, Class Play validation toggle UI.
- Spelling Bee thresholds pending the September recount; `rank_label` Queen Bee fix + backfill;
  teacher UI for `spanish_level`; the `!isSpanish` sibling-gate audit.
- Wordle star rate: 22–24 Aug sessions may contain junk guesses; fortnight re-measure still pending
  against the 66.3% baseline.

**Before any question_bank insert: re-`SELECT MAX(question_number)` live.** Not touched this
session, so the last known value is unchanged — but it has drifted in every recent session.
