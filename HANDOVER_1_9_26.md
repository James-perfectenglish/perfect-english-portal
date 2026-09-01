# HANDOVER — 1 September 2026

Follows `HANDOVER_30_8_26.md`, which covers the domain migration and the bank
rebuild. Everything here is component and focus-model work: **no engine change,
no schema change, and the banks are untouched** (9,047 rows, still valid).

## 1. Diagonal contrasts — the `combos` model

The focus model could only describe a RECTANGLE. "Past: simple vs perfect" pins
Time and offers two Types, which is fine. But **present perfect vs past simple**
— the single most requested contrast, and the classic error for Spanish speakers
— is a DIAGONAL: present pairs with perfect, past pairs with simple. The nearest
rectangle is four tenses, not two.

Restricting the pool to the diagonal without changing the UI would have been
worse than useless: Time and Type become perfectly correlated, so a student who
notices that present always means perfect gets the second axis free. That is the
exact score inflation the pinned/restricted split exists to prevent.

So `focus.combos` holds a list of whole tense descriptions, asked as **one
decision on one chip row** rather than as separate axes. Any axis named inside
the combos stops being a question and its per-axis rule is ignored, so a preset
can still pin voice without fighting the diagonal.

- New preset `pp_vs_past`, B1+, "Present perfect vs past simple".
- The combo row renders through the existing chip JSX as a pseudo-axis
  (`COMBO_AXIS = 'tense'`), so there is no parallel rendering path. A combo key
  like `present|perfect` displays as "present perfect" via the same replace.
- **The bank query cannot express a diagonal.** It narrows to the surrounding
  rectangle in SQL and sieves the diagonal client-side, over-fetching to 120 to
  cover what the sieve drops — about 58 usable rows against a deck that refills
  below 8. An axis is only narrowed if EVERY combo names it.
- `tense_attempts` records these as `{tense: 'present|perfect'}` rather than
  separate time/aspect keys. Honest about what was asked, but **combo attempts
  will not aggregate with axis attempts** — know that before reading the data.

Spanish never needs any of this: one axis, so every pair is already expressible.
`pret_perf` (*ayer comí / hoy he comido*) has always existed.

## 2. Curated items now honour the focus

`nextFromBank` served the hand-picked form≠function items only when there was no
focus at all, so the most interesting content in the exercise vanished the moment
a student picked a preset, silently. It was **two** call sites, not one — the
offline/empty-bank fallback in `drawGenerated` also called `makeCurated()` blind,
so a student practising *Past only* could be handed *Water boils at one hundred
degrees* whenever the deck ran dry.

`curatedPool(level, focus)` filters by matching each item's tags against
`allowedSpecsFocused` — the generated path's own predicate, so the two cannot
drift. Also fixed: the mount-time specimen ignored focus entirely (the first
sentence after "Practise this" could be the wrong tense), and the initial focus
was being computed three times; it is hoisted now.

**Drawn without replacement within a set.** The flat 45% roll was tuned for the
unfocused pool of seven; under a focus the pool is often two, and re-rolling it
every question served the same sentence repeatedly — 94% of focused sets would
have repeated one, worst case all ten identical. Marking on serve fixes that
while leaving the unfocused case untouched (4.47 vs 4.50 per set, because there
the roll rather than the pool is the limiter). Marking happens in an effect on
`item`, so it catches every path — mount, focus change, advance. Cleared at the
three set boundaries: `restartSet`, `changeLevel`, `applyFocus`.

**Bank grown 7 → 21 items**, chosen to fill what the presets could not reach:
nothing was perfect, perfect continuous, future-form or passive. Every preset now
has at least two.

| preset | curated |
|---|---|
| All tenses | 21 |
| Simple vs continuous | 13 |
| Time only | 11 |
| Present only | 9 |
| Present perfect vs past simple | 8 |
| Past only | 7 |
| Past: simple vs perfect / Active vs passive | 5 |
| Perfect vs perfect continuous | 4 |
| Future only | 2 |

One trap worth recording: a present perfect continuous whose meaning is still
present is **not** a form≠function item — `isMismatch` is
`functionTime !== answer.time`, so both being 'present' makes it false. Two of my
first drafts were wrong for exactly that reason and the check caught them. The
mismatch has to come from an activity that has just STOPPED ("The floor is wet
because someone has been cleaning") or from the extra-polite past form ("I had
been hoping you could help me").

**The C1 gate stays.** It is not arbitrary — it tracks `gate.secondQ`, and the
function question is the only place the mismatch is examined and the note shown.
Below C1 a curated item would be tagged like any other sentence and the point
would pass in silence. "Curated below C1" really means "run the function question
below C1", which is a much larger pedagogical decision.

## 3. Custom matrix panel

Per-axis multi-select under the presets: pick one value on a row to fix it, several
to be asked about it. It writes a focus object directly, so chips, scoring and the
deck query all worked already — this was UI plus two pure helpers.

- All values selected on an axis = no rule (everything asked). One = pinned. Two
  or more = restricted and asked. That maps onto the user's own mental model:
  "Present + Past, Simple + Perfect" gives 4 tenses asking time + type, and adding
  Passive gives 8 asking time + type + voice.
- Live count and a plain-English description of what will be asked.
- **Impossible combinations are disabled**, using the RAW intersection —
  deliberately NOT `allowedSpecsFocused`, which falls back to the whole grid when
  a focus would empty it. That fallback is right for generation but would have
  reported 19 instead of 0 here and left every dead combination enabled. Caught
  by a test, not by reading the code.
- Opening the matrix while a diagonal is active starts from the full grid, since
  a rectangle cannot represent a diagonal and silently widening it would be worse.

## 4. Still missing — and three of them share one cause

`pre` + `vp` + `post` assumes the verb phrase is one contiguous span between the
subject and the rest. Sort the known gaps by whether they respect that:

| | contiguous? |
|---|---|
| Negatives — *I have not finished*, *He does not clean* | yes |
| `going to` — *I am going to clean* | yes |
| Present continuous for future — *I'm seeing them tomorrow* | yes |
| Negative contractions — *haven't*, *didn't* | yes, inside the VP |
| **Questions** — *Have **you** finished?* | **no** — subject splits the VP |
| **Subject-aux contractions** — ***I've** finished* | **no** — spans pre/vp |

So it is a generator job for four of them and one data-model limitation blocking
the other two. English inversion always splits the verb phrase; **Spanish does
not**, because it drops or postposes the subject — *¿Has terminado?* stays
contiguous. Questions are cheap in Spanish and architectural in English.

Negatives and questions also share do-support: *He does not clean* and *Did you
finish?* need the same DO carrier inserted when a simple active tense has no
auxiliary. Build it once, both fall out.

Every sentence in both banks is currently an affirmative declarative — 9,047 rows
and not one question. That matters most for the contrast this session added:
*Did you finish?* versus *Have you finished?* is where the discrimination
actually moves into the auxiliary.

Spanish also lacks a past continuous (*estaba hablando*, contrasting with
*hablaba*) and *ir a* + infinitive — the same future gap as English.

## 5. Next

**Phase A — the future gap, both languages.** No architecture change. English
gains `going to` as a surface form keyed to future simple (which makes *I am
going to clean* a genuine trap, since it looks present continuous), plus
generated present-continuous-with-future-function using the `isMismatch`
machinery that already exists. Spanish gains `imperfecto continuo` and `futuro
próximo` on the pattern used for the last four tiempos. One rebuild at the end.

**Phase B — the segment model.** A sentence becomes a list of segments flagged
verb or not, so a discontinuous verb phrase is expressible. Migration on
`tense_specimens`, a render change, an RPC update — and since we are migrating
anyway, the moment to add the `domain` column from §7 of the previous handover.
Then negatives, questions and contractions become generator work, with `polarity`
and `mood` in `answer` as metadata rather than asked axes: never chips, but a
focus could restrict them, so *Questions only* and *Negatives only* come free.
`productionResult`'s regexes assume affirmative declarative word order and will
need revisiting. Second rebuild.

Standing items unchanged from the previous handover: future perfect keep rate
sliding 85 → 78 → 73 as level rises; `filter parse mismatch` should retry the
batch rather than keep it; **`skipWaiting` + reload banner for the PWA** — a
stale bundle was the first thing we had to rule out when testing today, and it
costs time every session.

## 6. Kept from last time, still true

**Distrust your own tests before the engine.** It happened twice more today: a
count that read 19 instead of 0 because `allowedSpecsFocused` falls back, and two
curated items that were not form≠function at all. Both were caught by checks, not
by reading code — but in the previous session seven checks fired falsely against
a correct engine. Read the actual sentence, decide whether it is genuinely wrong,
and only then touch code.

**Distinguish cost from quality.** A sentence the filter rejects never reaches a
student. The errors that matter are the ones nothing can see — wrong answer keys,
correlated axes, an off-focus sentence in a focused set.
