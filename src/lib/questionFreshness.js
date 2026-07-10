// ─────────────────────────────────────────────────────────────────────────────
// questionFreshness — "recently-seen skip" for question_bank surfaces
//
// Used by: RandomPracticeExercise, TopicPracticeExercise, ConditionalChooser,
// ModalChooser (the surfaces that log per-question answers to student_answers).
//
// Model: least-recently-seen ordering, not a hard skip. Each session serves
// never-seen questions first (shuffled), then previously-seen ones oldest-first,
// so a pool cycles fully before anything repeats — and once exhausted it resets
// automatically to the questions seen longest ago. No new tables, no new write
// paths: student_answers IS the per-student progress.
//
// Failure modes all degrade to today's behaviour (pure shuffle): no user, query
// error, or an empty history simply yield an empty seen-map. The pool is never
// filtered, only reordered, so a session can never come up short.
// ─────────────────────────────────────────────────────────────────────────────

// One read per exercise start. Returns Map(question_number → last_seen ISO string).
// The window bounds the QUERY, not the pedagogy: anything not answered in the
// last `days` counts as unseen — a month-old question feels fresh anyway.
// `limit` (newest-first) covers the heaviest student's month with headroom;
// if it ever truncates, it drops the oldest rows, which is the safe direction.
export async function fetchSeenMap(supabase, { days = 30, limit = 1500 } = {}) {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return new Map();
    const cutoff = new Date(Date.now() - days * 86400000).toISOString();
    const { data, error } = await supabase
      .from('student_answers')
      .select('question_id, created_at')
      .eq('student_id', user.id)
      .gt('created_at', cutoff)
      .order('created_at', { ascending: false })
      .limit(limit);
    if (error || !data) return new Map();
    const seen = new Map();
    for (const row of data) {
      const qn = Number(row.question_id);
      // Rows arrive newest-first, so the first sighting is the latest one.
      if (Number.isFinite(qn) && !seen.has(qn)) seen.set(qn, row.created_at);
    }
    return seen;
  } catch {
    return new Map();
  }
}

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// Pick `n` questions from `pool`: unseen first (shuffled), then seen questions
// oldest-last-seen first. The final slice is shuffled again so display order
// doesn't telegraph which questions are "old". Returns the pool's own row
// objects (no cloning), so identity-based Sets in callers keep working.
export function pickFresh(pool, seenMap, n) {
  const unseen = [];
  const seen = [];
  for (const q of pool || []) {
    if (seenMap && seenMap.has(Number(q.question_number))) seen.push(q);
    else unseen.push(q);
  }
  seen.sort((a, b) =>
    new Date(seenMap.get(Number(a.question_number))) - new Date(seenMap.get(Number(b.question_number)))
  );
  return shuffle([...shuffle(unseen), ...seen].slice(0, n));
}
