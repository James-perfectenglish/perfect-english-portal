# Handover — 29 August 2026

**Session type:** continuation of 28 Aug. The Spanish Tense Tagger engine was rebuilt around
**content domains** after the original hotel-workplace brief turned out to be wrong. English is
**not yet done** and is the main outstanding job.

Nothing is committed. **Do not push yet** — see §5.

---

## 1. What changed and why

The 28 Aug build assumed every sentence should be set in a hotel, with staff subjects (camarero,
recepcionista, cocinero, el jefe finishing his shift). That was wrong for Spanish: **these learners
do not work in hotels, they stay in them.** The voice was the waiter serving the coffee when it
should have been the guest ordering it.

So the Spanish engine now has **domains**. Everyday life is the spine; the hotel is one situation
among several, seen from the guest's side. Staff appear only as third parties.

**The agreed mix:**

| | everyday | hotel | business |
|---|---|---|---|
| ES A2 / B1 | 70 | 30 | — |
| EN A2 / B1 / B2 / C1 | 50 | 25 | 25 |

`DOMAIN_MIX` in each engine is the only thing to touch to shift the balance. The lexicon does not
need editing.

Rationale for the English split, from James: the higher-level English students work *for* hotels
but as managers, not serving customers — hence a business slice rather than more hotel.

---

## 2. Spanish — DONE and validated

`src/lib/tenseEngineEs.js` now holds:

- **`VERBS_DAY`** (32 verbs) — home, food, shopping, family, travel, free time. Approved by James,
  including `mi marido` and `los niños`.
- **`VERBS_HOTEL`** (18 verbs) — guest-side only: booking a room, more towels, the lift, the key,
  the pool, the terrace, paying the bill.
- **`SUBJECTS_DAY`** / **`SUBJECTS_HOTEL`**, **`DOMAIN_MIX`**, **`DOMAIN_VERBS`**, **`DOMAIN_SUBJECTS`**.

Measured mix: **72% everyday / 28% hotel** against the 70/30 target.

**In the hotel domain, guest is the DEFAULT role and staff is the marked exception.** An unmarked
verb is a guest action; `role: 's'` marks the staff ones (`limpiar`, `traer`, `servir`). Without
this the receptionist ended up sleeping in a guest room. One line in `makeES`, not twelve tags.

### Eight engine bugs found and fixed across the two sessions

Each of these was found by reading the AI filter's *reasons*, not by guessing. That feedback loop is
the single most useful thing added this week.

1. **The nosotros trap** — for `-ar`/`-ir` verbs the nosotros form is identical in presente and
   pretérito (`limpiamos` = "we clean" *and* "we cleaned"). With no time cue the sentence has two
   correct answers while the key holds one, so the student is marked wrong for being right. Now
   every such sentence carries a disambiguating adverbial, or drops the nosotros subject.
   **This is almost certainly in the existing bank** — a reason to delete rather than top up.
2. **Stative verbs with frequency adverbials** — "vive cerca del hotel todos los días".
3. **`ser` + origin in the pretérito** — where you are from is not a bounded past event.
4. **Subject eating its own object** — "los huéspedes están recibiendo a los huéspedes".
5. **Objectless verbs inside a frame** — "el jefe había dormido" delivers no completed task.
6. **Role incoherence** — customers cleaning tables, clients coming to work.
7. **Objectless transitives** — "Los clientes lavaron anoche" (28 Aug).
8. **Pluscuamperfecto anchors too scene-specific** — "Cuando abrió el restaurante… ya había traído
   la cuenta" put the bill before opening. Anchors are now purely temporal.

Regression suite passes on all of them at 60,000+ generated sentences, alongside the conjugation
checks (verified against `verbConjugatorEs.js`) and the focus-model checks.

---

## 3. English — NOT STARTED, this is the main job

`src/lib/tenseEngineEn.js` is untouched and still working. Its lexicon is a compact tuple array:

```
[base, s, past, pp, ing, transitive, stative, objects, min]
```

Adding a domain is a one-element extension of that tuple plus a filter in `makeGenerated` —
structurally easier than the Spanish rewrite was, because the verb list is already flat and tidy.

**Work needed:**

- **Drop the strays** — `sing`, `build` (a house / the wall), `paint` (the wall / a picture),
  `teach` (English / the class), and probably `drive the bus`. A builder, a decorator, a driver and
  a teacher currently wander through a hotel.
- **Build an everyday core** (~15 verbs) — meet, call, visit, walk, study, play, drink, plus
  everyday objects for existing verbs like `eat`, `watch`, `buy`, `read`, `fix`.
- **Build a business core** (~15 verbs) — send, write, run, attend, manage, hire, approve, review,
  present, discuss, sign, check. **Level-grade it**: "email the team" is A2, "negotiate the
  contract" is B2+. The existing `min` field handles this.
- **Reassign the existing verbs** to day / hotel / biz.
- **Add `DOMAIN_MIX` at 50/25/25** for all four levels.

---

## 4. Loose ends in the Spanish file

- **Delete the dead block.** The old hotel-workplace lexicon is still present, renamed to
  `LEGACY_VERBS_UNUSED` and `LEGACY_SUBJECTS_UNUSED`. Nothing reads either. Left in only so the
  diff was reviewable — delete both arrays.
- `MODEL` in the generator now defaults to `claude-opus-5`, overridable with `--model=`.

---

## 5. Order of operations from here

1. Finish the English domains (§3).
2. Delete the dead Spanish block (§4).
3. Dry runs, both languages:
   ```
   sh scripts/run-generator.sh --dry --lang=es --target=60
   sh scripts/run-generator.sh --dry --lang=en --level=A2 --target=60
   sh scripts/run-generator.sh --dry --lang=en --level=C1 --target=60
   ```
   Read the **reject reasons**, not just the keep rates. Every cluster so far has pointed at an
   engine bug worth fixing at source.
4. **Commit and push.** The engine has changed substantially since the last push; the live fallback
   would otherwise disagree with the bank.
5. **Then** delete and rebuild the banks — app live first, always.
   ```sql
   DELETE FROM public.tense_specimens WHERE language = 'es';   -- 3,030 rows
   DELETE FROM public.tense_specimens WHERE language = 'en';   -- 6,031 rows
   ```
   ```
   sh scripts/run-generator.sh --lang=es
   sh scripts/run-generator.sh --lang=en
   ```
   Delete rather than top up: the existing rows were built by the old engine (nosotros ambiguity,
   hotel-workplace framing) and passed the old one-question filter. Topping up mixes two quality
   bars in one table. Cost on Opus is roughly $1–2 Spanish, $2–3 English.

---

## 6. Principles worth keeping

- **Read the filter's reasons.** Adding `why` to rejections turned the dry run from a pass/fail
  into a diagnostic. Every bug in §2 came out of it.
- **A cluster in the rejects is an engine bug, not filter noise.** Fix at source rather than paying
  the filter to bin the same thing 3,000 times. The per-tense keep-rate table flags anything under
  45%.
- **The answer key can be wrong.** A sentence that is natural but ambiguous between two tenses is
  worse than an ugly one, because the student is punished for agreeing with a native speaker. That
  is what the filter's second question exists to catch.
- **Substring tests against this lexicon give false positives.** I wrote three loose regex checks
  this session and all three flagged correct sentences — "el cliente pide el menú" is fine even
  though `el menú` is staff-marked on `escribir`. The same object string lives on several verbs
  with different roles. Test at generation time or not at all.
- **Deploy order is still non-negotiable**: app live, then bank.

---

## Carried forward, untouched

- **October + November content — all 14 daily streams end 2026-09-30.** Target ~22 September.
- Website: confirm the nav-breakpoint fix and three other pending changes are pushed, then run Post
  Inspector. LinkedIn launch post still to draft.
- GET21 — light no-ask touch mid-September, proper push late October.
- PWA update banner (`skipWaiting`), `HelpSheet` on marking-based exercises, Class Play validation
  toggle UI.
- Spelling Bee thresholds pending the September recount; `rank_label` Queen Bee fix + backfill;
  teacher UI for `spanish_level`; the `!isSpanish` sibling-gate audit.
- Wordle star rate: fortnight re-measure against the 66.3% baseline.
- Subjuntivo — still needs a trigger-clause generator; unlocks B2 for Spanish.
- **Before any question_bank insert: re-`SELECT MAX(question_number)` live.**
