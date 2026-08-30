# HANDOVER — 30 August 2026

## 1. Where things stand

Both tense engines are migrated to content domains, both banks have been deleted
and rebuilt from scratch, and everything is committed and pushed (`df32c4c`).
There is no work in flight. The app and the banks agree.

Bank state, verified server-side rather than taken from the generator's own output:

| language | level | rows | distinct | grid coverage |
|---|---|---|---|---|
| en | A2 | 1506 | 1506 | 6/6 specs |
| en | B1 | 1500 | 1500 | 17/17 specs |
| en | B2 | 1508 | 1508 | 19/19 specs |
| en | C1 | 1516 | 1516 | 19/19 specs |
| es | A2 | 1507 | 1507 | 5/5 tiempos |
| es | B1 | 1510 | 1510 | 8/8 tiempos |

9,047 specimens. Every sentence distinct, no null answers, no empty sentences,
no leaked role markers (`#s`/`#g`/`#r`/`#a`/`!`), no `esta mañana` in the
pretérito, no ambiguous bare `read`.

Full-run keep rates: es A2 98%, es B1 96%, en A2 97%, en B1 94%, en B2 92%,
en C1 92%.

## 2. What the English engine gained

It was a flat verb array with no domains, no level filter and a hand-written
participle pattern. It now has:

**Three content domains** — `day` (everyday life, the spine), `hotel` (the
workplace), `biz` (hotel management with a legal seam at B2/C1). Weighted by
`DOMAIN_MIX` at 50/25/25, which lands within a point at every level. To shift
the balance, change those numbers; the lexicon does not need touching.

Note the asymmetry with Spanish, which is deliberate and documented in both
files: **English learners WORK in hotels, Spanish learners STAY in them.** Do
not copy role conventions from one engine to the other.

**Roles**, hotel domain only, with neither staff nor guest as the default:

- `#g` guest, `#s` any staff, `#r` reception desk, `#a` adults only
- A subject's role is a **string of letters**, not one letter — the receptionist
  and the manager are `'sr'`, the waiter is `'s'` alone. This is what stopped
  the waiter handing over room keys.
- `#a` runs the other way round. Every other role restricts a subject to a
  class; `#a` exists to keep `the children` out of "go to work" and "pay the
  rent". It works because an unroled subject passes everything, so the child is
  the one carrying a role (`'c'`) and never matches.
- Bare pronouns carry no role, so "I" can both clean the rooms and pay the bill.
  Correct per sentence, which is all a tense specimen needs.

**Four semantic axes**, all base-keyed Sets. The invariant for all of them: a
base listed must behave that way in *every* domain it appears in.

- `ACTIVITY` / `PROCESS_PASSIVE` / `PUNCTUAL` — pre-existing.
- `PASSIVE_ONLY` (`build`, `paint`) — kept for the passive machinery, since
  their active voice made the learner a decorator.
- `ONE_OFF` — events that do not repeat, barred from the present simple in both
  voices. Without it the habitual tense produced "My sister buys a present every
  morning" and "The agreement is drafted twice a week".
- `ROUTINE` — the opposite failure. Events so frequent that a single instance
  over a week or a month is pointless: "breakfast has been served this month".
  `make` is deliberately absent: making dinner is routine, making a reservation
  is not.
- `NOT_FUTURE` (`lose` only) — narrower and separate. Being a one-off is not the
  same as being unwilled, and it was the unwilled part that made "I will lose
  the key" odd.

`!` marks a one-off at OBJECT level, for cases where the verb is fine but the
object is not — `a present!`, `the tap!`, `the bill#g!`. Suffix order is `#s!`.

**A level filter that actually bites.** `min` was dead metadata: `makeGenerated`
never read it, so A2 students were getting B1 verbs. Now `LEVEL_RANK` gates the
pool across four tiers, which is also what makes the business grading mean
anything.

**Domain chosen after the spec filter, not before.** Rolling the domain first
would hit an empty pool on specs like the continuous passive, silently retry,
and bias the mix without saying so. Empty domains are dropped and the remaining
weights renormalised.

## 3. Answer-key bugs — the ones that matter

These are the errors the AI filter cannot see, because the sentence reads fine
and only the key is wrong. They ship silently. All are now closed:

- **`read`, the English nosotros trap.** Base and past are the same string, so
  outside the third person singular "They read the report." is present simple
  and past simple at once with a one-answer key. Guard is generic
  (`v.past === v.base`), so `cut`, `put`, `set`, `cost` are covered if ever added.
- **`esta mañana` in the pretérito.** Peninsular usage takes the perfecto for an
  unfinished window. It was in the pretérito list *and* in `DISAMBIG`, so the
  nosotros guard was force-feeding students the wrong rule.
- **Form ≠ function.** `this afternoon` on the present continuous reads as a
  future arrangement while the generated key says present — the exact contrast
  the curated C1 bank exists to teach, produced with a wrong key. Nothing that
  can read as a future arrangement belongs on the `now` tag.

## 4. A live student-facing bug, fixed in passing

`productionResult` built its past-participle alternation from a suffix pattern
that missed `paid`, `made`, `read`, `found` and `understood`. Since it is the
client-side deterministic layer, it short-circuits before the AI marker: a
student typing "The bill was paid yesterday" was told the structure was wrong.
The alternation is now built from the lexicon itself, so it cannot drift.

## 5. Spanish changes

Legacy pre-domain blocks deleted (53 lines). Beyond that, all filter-driven:

- `routine` flag + `WIDE_WINDOW`, the mirror of `stative`/`SHORT_WINDOW`. One
  strips short windows, the other wide ones. It is **per-entry, not per-verb**:
  `ver la piscina` in the hotel is routine, `ver una película` is not.
- `tener` is the one entry carrying **both** flags — hunger is a state, and an
  everyday one. It also skips pretérito, perfecto and pluscuamperfecto, since a
  bounded past tense is wrong for a state.
- Pluscuamperfecto gate changed from `objs.length` to telicity by name. The old
  predicate was simply wrong: `estudiar` and `esperar` both take objects and
  neither ever finishes.
- Condicional openers avoid the verbs they would contradict ("Con más tiempo, yo
  llegaría tarde"); clock frames avoid `llegar`; `Cuando llegamos` now avoids
  `yo` as well as `nosotros`, since the speaker is inside the group.
- `ser` skips the imperfecto (origin does not change), `desayunar` lost its time
  complement, `este año` and `el año que viene` trimmed, imperfecto lost its
  empty adverbial.

## 6. Open — pick up here

**Future perfect degrades with level: 85% at B1, 78% at B2, 73% at C1.** The
only consistent downward trend in the full run and the clearest next target.
Suspicion is the interaction between the `by …` anchors and the B2/C1 business
verbs, but it has not been investigated.

**Timescale mismatch, deliberately not built.** "had been writing a postcard
since March", "have been waiting for the bus since March", "have been staying at
the hotel all morning". A fourth axis splitting durations into short and long,
with every activity verb tagged. Left alone on purpose — see §7.

**~40 ungated rows.** `filter parse mismatch` fired twice (en B1, en C1),
keeping a batch of 20 each time without AI review. Not retrospectively
identifiable: nothing distinguishes them in the table. At ~0.4% of the bank and
generated by the same engine, not worth a rebuild — but if that message becomes
frequent, the generator should retry the batch rather than keep it.

Carried over from before: subjuntivo specimens, Spanish Modal Explainer,
`helper → auxiliary verb` sweep, `skipWaiting` PWA update banner, October
content cliff.

## 7. Deliberately paused — classroom observation first

Stopping here to see how it behaves in real classes before building anything
else on it. Two things about measuring that:

**`domain` is not persisted anywhere.** Neither `tense_specimens` nor
`tense_attempts` carries it, so the one thing this session added cannot be
measured. Everything else can — per-tense accuracy from `answer`, form-vs-
function from `function_picked` vs `function_answer`, focus usage from `focus`.
If the domain split ever needs evaluating, add a `domain text` column to
`tense_specimens` and populate it from the generator **before** the next
rebuild; a rebuild is the only cheap moment to fill it, and inferring it
retrospectively from sentence strings is exactly the kind of substring matching
that produced seven false positives this session (§8).

**Baseline starts 30 Aug 2026.** The bank was replaced wholesale, and some
earlier `tense_attempts` rows are inflated by the old "Practise this" chip leak.
Do not compare across that line.

## 8. Level ladder — A1 and C2 English, decided against

Asked and answered, so it does not need re-litigating:

**No A1 English.** The tagger is a metalinguistic exercise — the student names
the tense. At A1 that effort belongs in production and recognition instead.
Mechanically it fits badly too: `min` bottoms out at A2, so all 79 lexicon
entries would need re-grading, and an A1 gate would be about two specs. The
engine already holds the relevant principle — the Spanish chip resolver refuses
to ship a one-option question on the grounds that it is not a question.

**C2 English is not a level question.** C1 already carries all nineteen specs,
so a C2 bucket would clone it. C2 would need a new AXIS, and the engine already
names the candidate: modality is excluded from the grid on purpose, as "a
future, separate item type (not a forced axis)". The real decision is whether to
build modality; if it is built, that is what creates the top tier.

**Spanish tops out at B1, and that is the asymmetry to fix first.** English has
three axes to grow along (time × aspect × voice: 6 specs at A2, 19 at C1).
Spanish has one, tiempo, so its levels are only "how many tiempos are unlocked"
— five at A2, all eight at B1, and nothing above. `startLevel` says so outright:
`l.startsWith('A') ? 'A2' : 'B1'`, so every student from B1 upward gets the same
pool. Subjuntivo is the genuine second axis and therefore the natural B2 tier:
`LEVEL_TENSES` gains a B2 entry, `startLevel` gains a third branch, `BUCKETS` in
the generator gains a seventh entry. That is what that job actually unlocks —
it is not just more sentences.

## 9. Two things worth keeping

**Distinguish cost from quality.** A sentence the filter rejects never reaches a
student — it costs pennies and nothing else. The errors that matter are the ones
the filter cannot see, because those ship with a wrong key (§3). Once those are
closed, chasing the last few percent of keep rate buys cost reduction with an
over-constrained lexicon, and a repetitive bank is something students *do* see.
That is why §6 item two was left undone.

**Distrust your own tests before the engine.** Seven times this session a check
written against this lexicon flagged a failure, and seven times the check was
wrong, not the engine: `'the rooms'` matching `'the room#g'` by prefix; a flat
object→role map collapsing `the bill#g` and `the bill#s`; `the car` matched
across verbs; `ver` flagged without knowing its domain; a query for ambiguous
`read` that forgot to exclude the future. The engine has been right every single
time. When a check fires, read the sentence and decide whether it is actually
wrong before touching code.

And the one from last session, which held again: **every engine bug this week
was found by reading a rejection reason, not by inspecting code.** Keep the
filter explaining itself.
