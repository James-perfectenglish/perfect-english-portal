import { useState, useEffect } from "react";
import { supabase } from "./supabaseClient";
import SentenceBuildingInput from "./components/SentenceBuildingInput";

// ── helpers ──────────────────────────────────────────────────────────────────

function levenshtein(a, b) {
  a = a.toLowerCase().trim();
  b = b.toLowerCase().trim();
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  const dp = Array.from({ length: a.length + 1 }, (_, i) =>
    Array.from({ length: b.length + 1 }, (_, j) => (i === 0 ? j : j === 0 ? i : 0))
  );
  for (let i = 1; i <= a.length; i++)
    for (let j = 1; j <= b.length; j++)
      dp[i][j] =
        a[i - 1] === b[j - 1]
          ? dp[i - 1][j - 1]
          : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
  return dp[a.length][b.length];
}

function fuzzyMatch(guess, target) {
  const g = guess.trim().toLowerCase();
  const t = target.trim().toLowerCase();
  if (!g) return false;
  if (g === t) return true;
  if (t.includes(g) && g.length >= 4) return true;
  const dist = levenshtein(g, t);
  return dist <= (t.length <= 5 ? 1 : t.length <= 10 ? 2 : 3);
}

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function parseJsonField(val) {
  if (Array.isArray(val)) return val;
  try { return JSON.parse(val || "[]"); } catch { return []; }
}

// ── constants ────────────────────────────────────────────────────────────────

const MODES = {
  easy: {
    label: "Easy",
    emoji: "🟢",
    sub: "Artist shown · 2 pts max",
    border: "#16a34a",
    bg: "#dcfce7",
    text: "#15803d",
    lyricPts: 1,
    maxPts: 2,
    showArtist: true,
    distractors: false,
  },
  medium: {
    label: "Medium",
    emoji: "🟡",
    sub: "No hints · 3 pts max",
    border: "#ca8a04",
    bg: "#fef9c3",
    text: "#a16207",
    lyricPts: 1,
    maxPts: 3,
    showArtist: false,
    distractors: false,
  },
  hard: {
    label: "Hard",
    emoji: "🔴",
    sub: "Extra words · lyric worth 2 pts · 4 pts max",
    border: "#dc2626",
    bg: "#fee2e2",
    text: "#b91c1c",
    lyricPts: 2,
    maxPts: 4,
    showArtist: false,
    distractors: true,
  },
};

const TOTAL = 5;

// ── shared styles ─────────────────────────────────────────────────────────────

const S = {
  page: {
    maxWidth: "600px", margin: "0 auto",
    paddingBottom: "40px", backgroundColor: "#f8f9fa", minHeight: "100vh",
  },
  header: {
    background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
    color: "white",
    padding: "2.5rem 1.5rem 1.5rem",
    borderRadius: "0 0 20px 20px",
    marginBottom: "1.5rem",
    textAlign: "center",
  },
  inner: { padding: "0 1rem" },
  card: {
    background: "white", borderRadius: "12px",
    padding: "1.25rem",
    boxShadow: "0 2px 8px rgba(0,0,0,0.08)",
    marginBottom: "1rem",
  },
  input: {
    width: "100%", padding: "12px 14px", fontSize: "16px",
    border: "2px solid #e2e8f0", borderRadius: "10px",
    outline: "none", boxSizing: "border-box",
    marginTop: "8px", fontFamily: "inherit",
  },
};

function PrimaryBtn({ children, onClick, style = {} }) {
  return (
    <button onClick={onClick} style={{
      background: "linear-gradient(135deg, #667eea, #764ba2)",
      color: "white", border: "none", borderRadius: "10px",
      padding: "13px 24px", fontSize: "16px", fontWeight: "600",
      cursor: "pointer", width: "100%", marginTop: "12px",
      fontFamily: "inherit", ...style,
    }}>
      {children}
    </button>
  );
}

function GhostBtn({ children, onClick }) {
  return (
    <button onClick={onClick} style={{
      background: "#f1f5f9", color: "#64748b", border: "none",
      borderRadius: "10px", padding: "13px 20px",
      fontSize: "15px", fontWeight: "600", cursor: "pointer",
      marginTop: "12px", fontFamily: "inherit", flexShrink: 0,
    }}>
      {children}
    </button>
  );
}

function ResultPill({ ok, label }) {
  return (
    <div style={{
      display: "flex", alignItems: "center", gap: "8px",
      padding: "10px 14px", borderRadius: "8px",
      background: ok ? "#dcfce7" : "#fee2e2",
      color: ok ? "#15803d" : "#b91c1c",
      marginBottom: "8px", fontSize: "15px", fontWeight: "500",
    }}>
      <span>{ok ? "✅" : "❌"}</span><span>{label}</span>
    </div>
  );
}

function ModeBadge({ mode }) {
  const cfg = MODES[mode];
  if (!cfg) return null;
  return (
    <span style={{
      background: cfg.bg, color: cfg.text,
      border: `1px solid ${cfg.border}`,
      padding: "3px 12px", borderRadius: "20px",
      fontSize: "13px", fontWeight: "600",
    }}>
      {cfg.emoji} {cfg.label}
    </span>
  );
}

// ── main component ────────────────────────────────────────────────────────────

export default function LyricsExercise({ user }) {
  const [phase, setPhase]                   = useState("pick");
  const [mode, setMode]                     = useState(null);
  const [exercises, setExercises]           = useState([]);
  const [idx, setIdx]                       = useState(0);
  const [wordPool, setWordPool]             = useState([]);
  const [lyricsFeedback, setLyricsFeedback] = useState(null);
  const [lyricsOk, setLyricsOk]             = useState(false);
  const [songGuess, setSongGuess]           = useState("");
  const [songOk, setSongOk]                 = useState(false);
  const [songDone, setSongDone]             = useState(false);
  const [bandGuess, setBandGuess]           = useState("");
  const [bandOk, setBandOk]                 = useState(false);
  const [bandDone, setBandDone]             = useState(false);
  const [history, setHistory]               = useState([]);
  const [leaderboard, setLeaderboard]       = useState([]);
  const [profile, setProfile]               = useState(null);
  const [loading, setLoading]               = useState(false);
  const [error, setError]                   = useState(null);

  const ex  = exercises[idx];
  const cfg = MODES[mode] || MODES.easy;

  useEffect(() => {
    if (!user) return;
    supabase.from("profiles").select("full_name").eq("id", user.id).single()
      .then(({ data }) => setProfile(data));
  }, [user]);

  // ── start ────────────────────────────────────────────────────────────────────

  async function startMode(m) {
    setLoading(true);
    setError(null);
    const { data, error: err } = await supabase.from("lyrics_exercises").select("*");
    if (err || !data?.length) {
      setError("Couldn't load songs. Please try again.");
      setLoading(false);
      return;
    }
    const picked = shuffle(data).slice(0, TOTAL);
    setMode(m);
    setExercises(picked);
    setIdx(0);
    setHistory([]);
    buildPool(picked[0], m);
    resetRound();
    setLoading(false);
    setPhase("play");
  }

  function buildPool(exercise, m) {
    const words    = parseJsonField(exercise?.words);
    const extras   = (m || mode) === "hard" ? parseJsonField(exercise?.distractor_words) : [];
    setWordPool(shuffle([...words, ...extras]));
  }

  function resetRound() {
    setLyricsFeedback(null);
    setLyricsOk(false);
    setSongGuess(""); setSongOk(false); setSongDone(false);
    setBandGuess(""); setBandOk(false); setBandDone(false);
  }

  // ── SentenceBuildingInput callback ───────────────────────────────────────────
  // Signature: onResult(isCorrect, isSoft, userAnswer)

  function handleLyricsResult(isCorrect, isSoft) {
    setLyricsOk(isCorrect);
    if (isCorrect) {
      const ptLabel = cfg.lyricPts === 2 ? "+2 pts 🔥" : "+1 pt";
      setLyricsFeedback({
        correct: true,
        message: isSoft
          ? `✅ Correct! (minor punctuation — still counts) ${ptLabel}`
          : `✅ Correct! ${ptLabel}`,
      });
    } else {
      const correctLine = parseJsonField(ex?.words).join(" ");
      setLyricsFeedback({
        correct: false,
        message: `❌ Not quite. The correct lyric is: "${correctLine}"`,
      });
    }
  }

  // ── song / band ───────────────────────────────────────────────────────────────

  function submitSongGuess() {
    setSongOk(fuzzyMatch(songGuess, ex?.song_title || ""));
    setSongDone(true);
  }

  function submitBandGuess() {
    setBandOk(fuzzyMatch(bandGuess, ex?.artist || ""));
    setBandDone(true);
  }

  function proceedFromSong() {
    if (mode === "easy") finishRound(lyricsOk, songOk, false);
    else setPhase("band");
  }

  function proceedFromBand() {
    finishRound(lyricsOk, songOk, bandOk);
  }

  // ── finish round ─────────────────────────────────────────────────────────────

  async function finishRound(lo, so, bo) {
    const score = (lo ? cfg.lyricPts : 0) + (so ? 1 : 0) + (bo ? 1 : 0);
    const newHistory = [...history, { exercise: ex, lyricsOk: lo, songOk: so, bandOk: bo, score, lyricPts: cfg.lyricPts }];
    setHistory(newHistory);

    supabase.from("lyrics_sessions").insert({
      student_id: user.id, exercise_id: ex.id, difficulty: mode,
      lyrics_correct: lo, guessed_song: so, guessed_band: bo, score,
    });

    setPhase("result");
  }

  async function handleNext() {
    window.scrollTo({ top: 0, behavior: "instant" });
    if (idx + 1 < exercises.length) {
      const ni = idx + 1;
      setIdx(ni);
      buildPool(exercises[ni], mode);
      resetRound();
      setPhase("play");
    } else {
      await finaliseLeaderboard();
      setPhase("board");
    }
  }

  async function finaliseLeaderboard() {
    const sessionTotal = history.reduce((s, r) => s + r.score, 0);
    const initials = profile?.full_name
      ? profile.full_name.trim().split(/\s+/).map(n => n[0].toUpperCase()).slice(0, 2).join("")
      : "??";

    const { data: existing } = await supabase
      .from("lyrics_leaderboard").select("total_score, sessions_count")
      .eq("student_id", user.id).maybeSingle();

    await supabase.from("lyrics_leaderboard").upsert({
      student_id: user.id, initials,
      total_score:    (existing?.total_score    || 0) + sessionTotal,
      sessions_count: (existing?.sessions_count || 0) + 1,
      updated_at: new Date().toISOString(),
    }, { onConflict: "student_id" });

    const { data: lb } = await supabase
      .from("lyrics_leaderboard").select("*")
      .order("total_score", { ascending: false }).limit(10);

    setLeaderboard(lb || []);
  }

  // ── RENDER ────────────────────────────────────────────────────────────────────

  // PICK
  if (phase === "pick") {
    return (
      <div style={S.page}>
        <div style={S.header}>
          <h1 style={{ margin: 0, fontSize: "1.8rem" }}>🎵 Lyrics Mixer</h1>
          <p style={{ margin: "8px 0 0", opacity: 0.9 }}>Rearrange the words, then guess the song</p>
        </div>
        <div style={S.inner}>
          {error && (
            <div style={{ color: "#b91c1c", background: "#fee2e2", borderRadius: "8px", padding: "12px 16px", marginBottom: "16px" }}>
              {error}
            </div>
          )}
          {Object.entries(MODES).map(([key, m]) => (
            <div key={key} onClick={() => !loading && startMode(key)} style={{
              ...S.card, cursor: loading ? "default" : "pointer",
              borderLeft: `5px solid ${m.border}`, opacity: loading ? 0.6 : 1,
              transition: "transform 0.1s",
            }}
              onMouseEnter={e => { if (!loading) e.currentTarget.style.transform = "translateY(-1px)"; }}
              onMouseLeave={e => { e.currentTarget.style.transform = "translateY(0)"; }}
            >
              <div style={{ fontSize: "20px", fontWeight: "700", color: "#1e293b" }}>{m.emoji} {m.label}</div>
              <div style={{ fontSize: "14px", color: "#64748b", marginTop: "4px" }}>{m.sub}</div>
            </div>
          ))}
          {loading && <div style={{ textAlign: "center", color: "#64748b", padding: "16px" }}>Loading songs...</div>}
        </div>
      </div>
    );
  }

  // PLAY
  if (phase === "play") {
    const correctLine = parseJsonField(ex?.words).join(" ");
    return (
      <div style={S.page}>
        <div style={S.header}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "10px" }}>
            <h1 style={{ margin: 0, fontSize: "1.8rem" }}>🎵 Lyrics Mixer</h1>
            <div style={{ background: "rgba(255,255,255,0.2)", borderRadius: "20px", padding: "4px 12px", fontSize: "13px", whiteSpace: "nowrap" }}>
              {idx + 1} / {exercises.length}
            </div>
          </div>
          <ModeBadge mode={mode} />
          {cfg.lyricPts === 2 && (
            <div style={{ marginTop: "6px", fontSize: "13px", opacity: 0.9 }}>🔥 Lyric worth 2 pts on Hard</div>
          )}
        </div>

        <div style={S.inner}>
          {cfg.showArtist && ex && (
            <div style={{ ...S.card, background: "#f0f4ff", border: "2px solid #c7d2fe", textAlign: "center" }}>
              <div style={{ fontSize: "12px", color: "#6366f1", fontWeight: "700", letterSpacing: "0.05em", marginBottom: "4px" }}>
                🎤 ARTIST
              </div>
              <div style={{ fontSize: "22px", fontWeight: "800", color: "#1e293b" }}>{ex.artist}</div>
            </div>
          )}

          <div style={S.card}>
            <SentenceBuildingInput
              key={`${mode}-${idx}`}
              words={wordPool}
              questionType="build"
              prompt={
                cfg.distractors
                  ? "👆 Rearrange the lyric — some words don't belong!"
                  : "👆 Rearrange the words to recreate the lyric"
              }
              correctSentences={[correctLine]}
              explanation=""
              disabled={!!lyricsFeedback}
              onResult={handleLyricsResult}
              feedback={lyricsFeedback}
              showCheckButton={true}
              language="en"
            />

            {lyricsFeedback && (
              <button onClick={() => setPhase("song")} style={{
                width: "100%", padding: "13px", marginTop: "12px",
                fontSize: "16px", fontWeight: "600",
                background: "linear-gradient(135deg, #667eea, #764ba2)",
                color: "white", border: "none", borderRadius: "10px",
                cursor: "pointer", fontFamily: "inherit",
              }}>
                Do you know the song? →
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  // SONG GUESS
  if (phase === "song") {
    return (
      <div style={S.page}>
        <div style={S.header}>
          <h1 style={{ margin: 0, fontSize: "1.8rem" }}>🎵 Lyrics Mixer</h1>
          <div style={{ marginTop: "8px" }}><ModeBadge mode={mode} /></div>
          <div style={{ marginTop: "6px", fontSize: "13px", opacity: 0.85 }}>Round {idx + 1} / {exercises.length}</div>
        </div>
        <div style={S.inner}>
          {/* Lyric recap */}
          <div style={{ ...S.card, borderLeft: `4px solid ${lyricsOk ? "#16a34a" : "#dc2626"}` }}>
            <div style={{ fontSize: "12px", color: "#64748b", fontWeight: "600", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "4px" }}>
              Lyric
            </div>
            <div style={{ fontSize: "15px", fontWeight: "600", color: lyricsOk ? "#15803d" : "#b91c1c" }}>
              {lyricsOk ? `✅ Correct! +${cfg.lyricPts} pt${cfg.lyricPts > 1 ? "s" : ""}` : "❌ Not quite — 0 pts"}
            </div>
          </div>

          {/* Song guess card */}
          <div style={S.card}>
            <div style={{ fontSize: "17px", fontWeight: "700", color: "#1e293b" }}>🎵 Do you know the song?</div>
            <div style={{ fontSize: "13px", color: "#64748b", marginTop: "2px" }}>+1 pt for a correct guess</div>

            {!songDone ? (
              <>
                <input style={S.input} type="text" value={songGuess}
                  onChange={e => setSongGuess(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && submitSongGuess()}
                  placeholder="Song title..." autoFocus />
                <div style={{ display: "flex", gap: "8px" }}>
                  <PrimaryBtn onClick={submitSongGuess} style={{ flex: 1 }}>Submit</PrimaryBtn>
                  <GhostBtn onClick={() => { setSongOk(false); setSongDone(true); }}>Skip</GhostBtn>
                </div>
              </>
            ) : (
              <>
                <div style={{
                  padding: "12px 14px", borderRadius: "8px", marginTop: "10px",
                  background: songOk ? "#dcfce7" : "#fee2e2",
                  color: songOk ? "#15803d" : "#b91c1c",
                  fontWeight: "600", fontSize: "15px",
                }}>
                  {songOk ? `✅ "${ex.song_title}" — correct! +1 pt` : `❌ It was "${ex.song_title}"`}
                </div>
                <PrimaryBtn onClick={proceedFromSong}>
                  {mode === "easy" ? "See my score →" : "Next →"}
                </PrimaryBtn>
              </>
            )}
          </div>
        </div>
      </div>
    );
  }

  // BAND GUESS
  if (phase === "band") {
    const ptsEarned = (lyricsOk ? cfg.lyricPts : 0) + (songOk ? 1 : 0);
    return (
      <div style={S.page}>
        <div style={S.header}>
          <h1 style={{ margin: 0, fontSize: "1.8rem" }}>🎵 Lyrics Mixer</h1>
          <div style={{ marginTop: "8px" }}><ModeBadge mode={mode} /></div>
          <div style={{ marginTop: "6px", fontSize: "13px", opacity: 0.85 }}>Round {idx + 1} / {exercises.length}</div>
        </div>
        <div style={S.inner}>
          <div style={{ ...S.card, textAlign: "center", background: "linear-gradient(135deg, #f0f4ff, #faf5ff)" }}>
            <div style={{ fontSize: "13px", color: "#64748b" }}>Points so far</div>
            <div style={{ fontSize: "40px", fontWeight: "800", color: "#667eea" }}>
              {ptsEarned} <span style={{ fontSize: "20px", color: "#94a3b8" }}>/ {cfg.maxPts}</span>
            </div>
          </div>

          <div style={S.card}>
            <div style={{ fontSize: "17px", fontWeight: "700", color: "#1e293b" }}>🎤 Do you know the artist?</div>
            <div style={{ fontSize: "13px", color: "#64748b", marginTop: "2px" }}>+1 pt for a correct guess</div>

            {!bandDone ? (
              <>
                <input style={S.input} type="text" value={bandGuess}
                  onChange={e => setBandGuess(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && submitBandGuess()}
                  placeholder="Artist or band name..." autoFocus />
                <div style={{ display: "flex", gap: "8px" }}>
                  <PrimaryBtn onClick={submitBandGuess} style={{ flex: 1 }}>Submit</PrimaryBtn>
                  <GhostBtn onClick={() => { setBandOk(false); setBandDone(true); }}>Skip</GhostBtn>
                </div>
              </>
            ) : (
              <>
                <div style={{
                  padding: "12px 14px", borderRadius: "8px", marginTop: "10px",
                  background: bandOk ? "#dcfce7" : "#fee2e2",
                  color: bandOk ? "#15803d" : "#b91c1c",
                  fontWeight: "600", fontSize: "15px",
                }}>
                  {bandOk ? `✅ ${ex.artist} — correct! +1 pt` : `❌ It was ${ex.artist}`}
                </div>
                <PrimaryBtn onClick={proceedFromBand}>See my score →</PrimaryBtn>
              </>
            )}
          </div>
        </div>
      </div>
    );
  }

  // ROUND RESULT
  if (phase === "result") {
    const last = history[history.length - 1];
    const runningTotal = history.reduce((s, r) => s + r.score, 0);
    const isLast = idx === exercises.length - 1;
    return (
      <div style={S.page}>
        <div style={S.header}>
          <h1 style={{ margin: 0, fontSize: "1.8rem" }}>🎵 Lyrics Mixer</h1>
          <div style={{ marginTop: "8px" }}><ModeBadge mode={mode} /></div>
          <div style={{ marginTop: "6px", fontSize: "13px", opacity: 0.85 }}>Round {idx + 1} of {exercises.length}</div>
        </div>
        <div style={S.inner}>
          <div style={S.card}>
            <div style={{ fontSize: "14px", color: "#64748b", marginBottom: "12px", fontStyle: "italic" }}>
              {last?.exercise?.artist} — "{last?.exercise?.song_title}"
            </div>
            <ResultPill ok={last?.lyricsOk} label={`Lyric order${last?.lyricPts === 2 ? " (worth 2 pts)" : ""}`} />
            <ResultPill ok={last?.songOk}   label={`Song: "${last?.exercise?.song_title}"`} />
            {mode !== "easy" && (
              <ResultPill ok={last?.bandOk} label={`Artist: ${last?.exercise?.artist}`} />
            )}
            <div style={{
              marginTop: "16px", padding: "16px", borderRadius: "12px",
              background: "linear-gradient(135deg, #f0f4ff, #faf5ff)", textAlign: "center",
            }}>
              <div style={{ fontSize: "13px", color: "#64748b" }}>This round</div>
              <div style={{ fontSize: "44px", fontWeight: "800", color: "#667eea", lineHeight: 1.1 }}>
                {last?.score}<span style={{ fontSize: "20px", color: "#94a3b8" }}> / {cfg.maxPts}</span>
              </div>
              <div style={{ fontSize: "13px", color: "#64748b", marginTop: "6px" }}>
                Running total: <strong style={{ color: "#667eea" }}>{runningTotal}</strong> pt{runningTotal !== 1 ? "s" : ""} from {history.length} round{history.length !== 1 ? "s" : ""}
              </div>
            </div>
          </div>
          <PrimaryBtn onClick={handleNext}>
            {isLast ? "See leaderboard 🏆" : "Next song →"}
          </PrimaryBtn>
        </div>
      </div>
    );
  }

  // LEADERBOARD
  if (phase === "board") {
    const sessionTotal = history.reduce((s, r) => s + r.score, 0);
    const maxPossible  = exercises.length * cfg.maxPts;
    return (
      <div style={S.page}>
        <div style={S.header}>
          <h1 style={{ margin: 0, fontSize: "1.8rem" }}>🏆 Leaderboard</h1>
          <p style={{ margin: "8px 0 0", opacity: 0.85 }}>Lyrics Mixer · All-time totals</p>
        </div>
        <div style={S.inner}>
          <div style={{ ...S.card, background: "linear-gradient(135deg, #f0f4ff, #faf5ff)", textAlign: "center" }}>
            <div style={{ fontSize: "13px", color: "#64748b" }}>This session · {cfg.label}</div>
            <div style={{ fontSize: "44px", fontWeight: "800", color: "#667eea", lineHeight: 1.1, margin: "4px 0" }}>
              {sessionTotal}<span style={{ fontSize: "20px", color: "#94a3b8" }}> / {maxPossible}</span>
            </div>
            <div style={{ fontSize: "22px", marginTop: "4px" }}>
              {history.map((r, i) => (
                <span key={i} title={r.exercise?.song_title}>{r.lyricsOk ? "✅" : "❌"}</span>
              ))}
            </div>
          </div>

          <div style={S.card}>
            <div style={{ fontSize: "16px", fontWeight: "700", marginBottom: "14px" }}>🏆 Top Scores</div>
            {leaderboard.length === 0 ? (
              <div style={{ color: "#64748b", textAlign: "center", padding: "12px" }}>No scores yet — you're first!</div>
            ) : (
              leaderboard.map((row, i) => {
                const isMe = row.student_id === user?.id;
                return (
                  <div key={row.student_id} style={{
                    display: "flex", alignItems: "center", gap: "12px",
                    padding: "10px 8px", borderRadius: "8px",
                    borderBottom: i < leaderboard.length - 1 ? "1px solid #f1f5f9" : "none",
                    background: isMe ? "#f0f4ff" : "transparent",
                  }}>
                    <div style={{
                      width: "28px", height: "28px", borderRadius: "50%",
                      background: i === 0 ? "#fbbf24" : i === 1 ? "#94a3b8" : i === 2 ? "#b45309" : "#e2e8f0",
                      display: "flex", alignItems: "center", justifyContent: "center",
                      fontSize: "12px", fontWeight: "700", color: i < 3 ? "white" : "#64748b", flexShrink: 0,
                    }}>{i + 1}</div>
                    <div style={{
                      width: "36px", height: "36px", borderRadius: "50%",
                      background: "linear-gradient(135deg, #667eea, #764ba2)",
                      display: "flex", alignItems: "center", justifyContent: "center",
                      color: "white", fontWeight: "700", fontSize: "14px", flexShrink: 0,
                    }}>{row.initials}</div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: "600", fontSize: "15px", color: "#1e293b" }}>
                        {row.initials}{isMe && <span style={{ fontSize: "12px", color: "#667eea" }}> · you</span>}
                      </div>
                      <div style={{ fontSize: "12px", color: "#94a3b8" }}>
                        {row.sessions_count} session{row.sessions_count !== 1 ? "s" : ""}
                      </div>
                    </div>
                    <div style={{ fontWeight: "800", fontSize: "20px", color: "#667eea" }}>{row.total_score}</div>
                  </div>
                );
              })
            )}
          </div>

          <PrimaryBtn onClick={() => setPhase("pick")}>Play again 🎵</PrimaryBtn>
        </div>
      </div>
    );
  }

  return null;
}
