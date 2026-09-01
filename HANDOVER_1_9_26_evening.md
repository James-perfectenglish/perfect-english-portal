# HANDOVER — 1 September 2026 (evening)

Follows `HANDOVER_1_9_26.md`, which covers the `combos` diagonal focus model and
the curated-item work. Nothing here touches the tense engines, the focus model or
the banks. One component changed: `src/WordleGame.jsx`. **No schema change.**

## 1. Wordle now persists mid-game

Reported from the field: leaving Wordle part-way through reset the board, and
students had worked out they could use that for extra guesses. Belinda and
Carolina named specifically.

The diagnosis was narrower than the symptom suggested — **the restore half
already worked.** `initDaily` reads `wordle_sessions`, rebuilds `guesses` and
falls through to the right `gameState`; `computeLetterStates` re-derives the
keyboard colours from `guesses` on render. What was missing was the write.
`saveSession` was only called on a win or a loss, so a non-terminal guess never
touched the database and there was no row to resume from. Connections calls its
`saveSession` after every guess, which is why it behaves.

Fix: a `saveSession` call in the `else` branch of `submitGuess`. Three decisions
went into it.

**`completed_at` is stamped on mid-game writes too.** Despite the name, the only
two readers treat it as "last active", not as a completion marker — `Progress`
feeds it into the streak calculation and `TeacherDashboard` into `lastActive`.
The consequence is real and intended: **opening Wordle and abandoning it now
counts as a streak day**, where before it counted for nothing. The alternative
(null until the game ends, as `connections_sessions` does) would sort NULLS FIRST
in those `DESC` queries and eat the row limit. That is a latent bug in Connections
today — 200-row limit, so it will bite there first.

**Writes are fired without awaiting, but chained.** Holding `locked` across the
round trip would leave the Enter key dead on hotel wifi with no spinner to explain
it. But plain fire-and-forget risks guess 3's write landing before guess 2's, and
since every write carries the *whole* `guesses` array a stale write landing last
shrinks it — handing back a free guess, which is the exact hole being closed. So
`saveChain` (a ref holding the last promise) serialises them without blocking.
`saveSession` is now a queueing wrapper returning the chained promise; the actual
upsert moved into `writeSession`. Terminal paths still await; the per-guess path
doesn't. The `.catch` on the chain stops one failed write poisoning the rest of
the game.

**Partially typed letters are dropped.** Only submitted guesses persist.

Also tidied while in there: the upsert was discarding its `error`, and both call
sites were passing a sixth argument to a five-parameter function.

## 2. The star baseline is no longer comparable

This matters more than the fix. `starTiers` awards one row per tier crossed, so
solving in 3 is four stars where solving in 6 is one, and the extra subtypes do
not collide with `ux_stars_dedupe`. Restarting therefore bought a better *tier*,
not just more guesses — which is the actual incentive.

**The 66.3% Wordle star-rate baseline should be treated as retired.** The
fortnight re-measurement will not be comparing like with like. Last 60 days, for
reference, but note this cannot separate cheating from competence because
unfinished games were never recorded:

| student | days solved | avg guesses | solve stars |
|---|---|---|---|
| Jon Cabañes | 10 | 3.40 | 36 |
| Belinda Alemán Diaz | 8 | 3.88 | 25 |
| Carolina Santana | 6 | 4.33 | 16 |
| Carmen | 5 | 4.80 | 11 |

Stars already awarded were left alone. Clearing them is a decision not taken, not
a decision missed.

## 3. Residual holes, deliberately not closed

**Multi-device.** Two devices holding the same row both write the full array and
last write wins, so a stale device can rewind the guess count. Connections has
this identically. Carolina is the one who would hit it, and by accident rather
than design.

**RLS.** The `Students update own wordle sessions` policy permits an `UPDATE` on
their own row, so a student who knows what supabase-js is could clear `guesses`
directly. Closing it properly means moving the write behind a `SECURITY DEFINER`
RPC that refuses to shorten an existing array. Not what is happening in practice.

**Double-Enter wastes a guess.** Adjacent, pre-existing, and not part of this
change. `submitGuess` reads `locked` from a closure frozen at first render, so
the guard only works for on-screen taps — a physical-keyboard double-Enter can
resubmit the same word because `setCurrent('')` has not reached `stateRef` yet.
One-line fix: move `locked` into `stateRef` with the rest. Left out deliberately
so it does not hide inside a persistence commit.

## 4. Verification and state

`npx esbuild src/WordleGame.jsx --format=esm --loader:.jsx=jsx --outfile=/dev/null`
passes. Changes applied to the working tree via dry-run diff first, then landed;
the landed file was re-read and re-validated, not assumed.

**Not yet committed or pushed.** Nothing is live for students until
`git add src/WordleGame.jsx && git commit && git push` and Vercel redeploys — and
then only after a PWA hard-refresh, which is the reason the `skipWaiting` + reload
banner keeps earning its place at the top of the standing list.

Worth watching after deploy: whether the streak numbers in Progress move for
students who open games and abandon them. That is expected, not a regression.

## 5. Standing items, unchanged

`skipWaiting` + reload banner for the PWA. Phase A (the future gap, both
languages) and Phase B (the segment model) as described in the previous handover.
Future perfect keep rate sliding 85 → 78 → 73 as level rises. `filter parse
mismatch` should retry the batch rather than keep it.
