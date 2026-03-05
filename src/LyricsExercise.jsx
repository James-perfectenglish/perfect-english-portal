import { useState, useEffect } from "react";
import { supabase } from "./supabaseClient";
import SentenceBuildingInput from "./components/SentenceBuildingInput";

const GRADIENT = 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)';

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
    emoji: "🎼",
    sub: "You can see the name of the artist, but what is the lyric and what is the name of the song?",
    border: "#48bb78",
    bg: "#f0fff4",
    colour: "#48bb78",
    colourLight: "#f0fff4",
    text: "#276749",
    sublabel: "2 pts max",
    lyricPts: 1,
    maxPts: 2,
    showArtist: true,
    distractors: false,
  },
  medium: {
    label: "Medium",
    emoji: "🎸",
    sub: "What is the lyric, what is the name of the song, and who sang it?",
    border: "#4299e1",
    bg: "#ebf8ff",
    colour: "#4299e1",
    colourLight: "#ebf8ff",
    text: "#2b6cb0",
    sublabel: "3 pts max",
    lyricPts: 1,
    maxPts: 3,
    showArtist: false,
    distractors: false,
  },
  hard: {
    label: "Hard",
    emoji: "🥁",
    sub: "What is the lyric, what is the name of the song, and who sang it? Extra words included to make it even harder...",
    border: "#ed8936",
    bg: "#fffaf0",
    colour: "#ed8936",
    colourLight: "#fffaf0",
    text: "#c05621",
    sublabel: "4 pts max · lyric worth 2",
    lyricPts: 2,
    maxPts: 4,
    showArtist: false,
    distractors: true,
  },
};

const TOTAL = 5;

// ── small shared components ───────────────────────────────────────────────────

function PrimaryBtn({ children, onClick, style = {} }) {
  return (
    <button onClick={onClick} style={{
      width: "100%", padding: "1rem", marginTop: "0.75rem",
      fontSize: "1rem", background: GRADIENT,
      color: "white", border: "none", borderRadius: "10px",
      cursor: "pointer", fontWeight: "600", fontFamily: "inherit", ...style,
    }}>
      {children}
    </button>
  );
}

function GhostBtn({ children, onClick }) {
  return (
    <button onClick={onClick} style={{
      padding: "1rem 1.25rem", background: "transparent",
      color: "#718096", border: "1px solid #e2e8f0",
      borderRadius: "10px", cursor: "pointer",
      fontWeight: "500", fontSize: "1rem", fontFamily: "inherit",
      marginTop: "0.75rem", flexShrink: 0,
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
      background: ok ? "#f0fff4" : "#fff5f5",
      border: `1px solid ${ok ? "#9ae6b4" : "#feb2b2"}`,
      color: ok ? "#276749" : "#c53030",
      marginBottom: "8px", fontSize: "0.95rem", fontWeight: "500",
    }}>
      <span>{ok ? "✅" : "❌"}</span><span>{label}</span>
    </div>
  );
}

const inputStyle = {
  width: "100%", padding: "0.9rem 1rem", fontSize: "clamp(1rem, 3.5vw, 1.15rem)",
  borderRadius: "8px", border: "2px solid #667eea",
  boxSizing: "border-box", color: "#2d3748", fontWeight: 500,
  backgroundColor: "#EDE9FE", fontFamily: "inherit", outline: "none",
  marginBottom: "0.75rem",
};

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
    const words  = parseJsonField(exercise?.words);
    const extras = (m || mode) === "hard" ? parseJsonField(exercise?.distractor_words) : [];
    setWordPool(shuffle([...words, ...extras]));
  }

  function resetRound() {
    setLyricsFeedback(null);
    setLyricsOk(false);
    setSongGuess(""); setSongOk(false); setSongDone(false);
    setBandGuess(""); setBandOk(false); setBandDone(false);
  }

  // ── lyric result ─────────────────────────────────────────────────────────────

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

  function submitSongGuess() { setSongOk(fuzzyMatch(songGuess, ex?.song_title || "")); setSongDone(true); }
  function submitBandGuess() { setBandOk(fuzzyMatch(bandGuess, ex?.artist || "")); setBandDone(true); }
  function proceedFromSong() { if (mode === "easy") finishRound(lyricsOk, songOk, false); else setPhase("band"); }
  function proceedFromBand() { finishRound(lyricsOk, songOk, bandOk); }

  // ── finish round ─────────────────────────────────────────────────────────────

  async function finishRound(lo, so, bo) {
    const score = (lo ? cfg.lyricPts : 0) + (so ? 1 : 0) + (bo ? 1 : 0);
    const newHistory = [...history, { exercise: ex, lyricsOk: lo, songOk: so, bandOk: bo, score, lyricPts: cfg.lyricPts }];
    setHistory(newHistory);
    const { error: sessionErr } = await supabase.from("lyrics_sessions").insert({
      student_id: user.id, exercise_id: ex.id, difficulty: mode,
      lyrics_correct: lo, guessed_song: so, guessed_band: bo, score,
    });
    if (sessionErr) console.error("lyrics_sessions insert error:", sessionErr);
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

  // ── shared header ─────────────────────────────────────────────────────────────

  const PageHeader = ({ sub, badge }) => (
    <div style={{ background: GRADIENT, borderRadius: "12px", padding: "2.5rem 2rem 2rem", textAlign: "center", color: "white", marginBottom: "1.5rem" }}>
      <h1 style={{ margin: 0, fontSize: "1.8rem" }}>🎤 Lyrics Mixer</h1>
      <p style={{ margin: "8px 0 0", opacity: 0.9 }}>{sub || "Rearrange the words, then guess the song"}</p>
      {badge && (
        <span style={{ display: "inline-block", background: cfg.colour, padding: "4px 12px", borderRadius: "20px", fontSize: "0.85rem", fontWeight: 600, marginTop: "8px" }}>
          {badge}
        </span>
      )}
    </div>
  );

  // ── RENDER ────────────────────────────────────────────────────────────────────

  // PICK
  if (phase === "pick") {
    return (
      <div style={{ backgroundColor: "#f8f9fa", minHeight: "100vh" }}>
      <div style={{ maxWidth: "800px", margin: "0 auto", padding: "1rem" }}>
        <PageHeader />
        <div style={{ background: "white", padding: "2rem", borderRadius: "12px", boxShadow: "0 10px 40px rgba(0,0,0,0.15)" }}>
          <h2 style={{ color: "#2d3748", fontSize: "1.15rem", fontWeight: 600, margin: "0 0 6px", textAlign: "center" }}>Choose your difficulty</h2>
          <p style={{ color: "#718096", fontSize: "0.9rem", margin: "0 0 24px", textAlign: "center" }}>Select a level to start playing</p>

          {error && (
            <div style={{ color: "#c53030", background: "#fff5f5", borderRadius: "8px", padding: "12px 16px", marginBottom: "16px", border: "1px solid #feb2b2" }}>
              {error}
            </div>
          )}

          <div style={{ display: "grid", gap: "16px" }}>
            {Object.entries(MODES).map(([key, m]) => (
              <div key={key} onClick={() => !loading && startMode(key)}
                style={{ border: `2px solid ${m.colour}`, borderRadius: "12px", padding: "1.25rem 1.5rem", cursor: loading ? "default" : "pointer", background: m.colourLight, opacity: loading ? 0.6 : 1, transition: "transform 0.15s, box-shadow 0.15s", display: "flex", alignItems: "center", gap: "1rem" }}
                onMouseEnter={e => { if (!loading) { e.currentTarget.style.transform = "translateY(-2px)"; e.currentTarget.style.boxShadow = `0 4px 16px ${m.colour}40`; }}}
                onMouseLeave={e => { e.currentTarget.style.transform = "none"; e.currentTarget.style.boxShadow = "none"; }}
              >
                <div style={{ fontSize: "2rem", flexShrink: 0 }}>{m.emoji}</div>
                <div style={{ flex: 1 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
                    <span style={{ fontSize: "1.1rem", fontWeight: 700, color: "#2d3748" }}>{m.label}</span>
                    <span style={{ background: m.colour, color: "white", padding: "2px 10px", borderRadius: "20px", fontSize: "0.8rem", fontWeight: 600 }}>{m.sublabel}</span>
                  </div>
                  <p style={{ margin: "4px 0 0", fontSize: "0.88rem", color: "#4a5568", lineHeight: 1.4 }}>{m.sub}</p>
                </div>
                {!loading && <div style={{ fontSize: "1.3rem", color: m.colour, flexShrink: 0 }}>→</div>}
              </div>
            ))}
          </div>

          {loading && <div style={{ textAlign: "center", color: "#718096", padding: "16px" }}>Loading songs...</div>}
        </div>
      </div>
      </div>
    );
  }

  // PLAY
  if (phase === "play") {
    const correctLine = parseJsonField(ex?.words).join(" ");
    return (
      <div style={{ backgroundColor: "#f8f9fa", minHeight: "100vh" }}>
      <div style={{ maxWidth: "800px", margin: "0 auto", padding: "1rem" }}>
        <PageHeader
          sub={`Round ${idx + 1} of ${exercises.length} · ${cfg.label}`}
          badge={cfg.label}
        />
        <div style={{ background: "white", padding: "2rem", borderRadius: "12px", boxShadow: "0 10px 40px rgba(0,0,0,0.15)" }}>

          {/* Progress */}
          <div style={{ display: "flex", justifyContent: "space-between", background: "#f7fafc", padding: "12px 16px", borderRadius: "8px", marginBottom: "1.5rem", fontSize: "0.9rem", color: "#4a5568", fontWeight: 500 }}>
            <span>Round {idx + 1} / {exercises.length}</span>
            <span>{cfg.lyricPts === 2 ? "🔥 Lyric worth 2 pts" : `${cfg.emoji} ${cfg.label}`}</span>
          </div>

          {/* Artist hint (easy only) */}
          {cfg.showArtist && ex && (
            <div style={{ background: "#f0f4ff", border: "2px solid #c7d2fe", borderRadius: "10px", padding: "1rem 1.25rem", marginBottom: "1.25rem", textAlign: "center" }}>
              <div style={{ fontSize: "0.75rem", color: "#6366f1", fontWeight: 700, letterSpacing: "0.05em", marginBottom: "4px", textTransform: "uppercase" }}>
                🎤 Artist
              </div>
              <div style={{ fontSize: "1.4rem", fontWeight: 800, color: "#1e293b" }}>{ex.artist}</div>
            </div>
          )}

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
              width: "100%", padding: "1rem", marginTop: "0.75rem",
              fontSize: "1rem", fontWeight: "600", background: GRADIENT,
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
      <div style={{ backgroundColor: "#f8f9fa", minHeight: "100vh" }}>
      <div style={{ maxWidth: "800px", margin: "0 auto", padding: "1rem" }}>
        <PageHeader
          sub={`Round ${idx + 1} of ${exercises.length} · ${cfg.label}`}
          badge={cfg.label}
        />
        <div style={{ background: "white", padding: "2rem", borderRadius: "12px", boxShadow: "0 10px 40px rgba(0,0,0,0.15)" }}>

          {/* Lyric recap */}
          <div style={{ border: `2px solid ${lyricsOk ? "#9ae6b4" : "#feb2b2"}`, borderRadius: "10px", marginBottom: "1.25rem", overflow: "hidden" }}>
            <div style={{ background: lyricsOk ? "#48bb78" : "#f56565", color: "white", padding: "0.6rem 1rem", fontWeight: 700, fontSize: "0.95rem" }}>
              Lyric
            </div>
            <div style={{ padding: "0.9rem 1rem", background: lyricsOk ? "#f0fff4" : "#fff5f5", color: lyricsOk ? "#276749" : "#c53030", fontWeight: 600 }}>
              {lyricsOk ? `✅ Correct! +${cfg.lyricPts} pt${cfg.lyricPts > 1 ? "s" : ""}` : "❌ Not quite — 0 pts"}
            </div>
          </div>

          {/* Song guess */}
          <div style={{ border: "2px solid #e2e8f0", borderRadius: "10px", overflow: "hidden", marginBottom: "1rem" }}>
            <div style={{ background: GRADIENT, color: "white", padding: "0.6rem 1rem", fontWeight: 700, fontSize: "0.95rem" }}>
              🎵 Do you know the song? <span style={{ fontWeight: 400, fontSize: "0.85rem", opacity: 0.9 }}>+1 pt</span>
            </div>
            <div style={{ padding: "1rem" }}>
              {!songDone ? (
                <>
                  <input
                    style={inputStyle} type="text" value={songGuess}
                    onChange={e => setSongGuess(e.target.value)}
                    onKeyDown={e => e.key === "Enter" && submitSongGuess()}
                    placeholder="Song title..." autoFocus
                  />
                  <div style={{ display: "flex", gap: "10px" }}>
                    <button onClick={submitSongGuess} style={{ flex: 1, padding: "0.9rem", background: GRADIENT, color: "white", border: "none", borderRadius: "8px", cursor: "pointer", fontWeight: 600, fontSize: "1rem", fontFamily: "inherit" }}>Submit</button>
                    <button onClick={() => { setSongOk(false); setSongDone(true); }} style={{ padding: "0.9rem 1.25rem", background: "transparent", color: "#718096", border: "1px solid #e2e8f0", borderRadius: "8px", cursor: "pointer", fontWeight: 500, fontSize: "1rem", fontFamily: "inherit" }}>Skip</button>
                  </div>
                </>
              ) : (
                <>
                  <div style={{ padding: "0.9rem 1rem", borderRadius: "8px", background: songOk ? "#f0fff4" : "#fff5f5", border: `1px solid ${songOk ? "#9ae6b4" : "#feb2b2"}`, color: songOk ? "#276749" : "#c53030", fontWeight: 600, marginBottom: "0.75rem" }}>
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
      </div>
      </div>
    );
  }

  // BAND GUESS
  if (phase === "band") {
    const ptsEarned = (lyricsOk ? cfg.lyricPts : 0) + (songOk ? 1 : 0);
    return (
      <div style={{ backgroundColor: "#f8f9fa", minHeight: "100vh" }}>
      <div style={{ maxWidth: "800px", margin: "0 auto", padding: "1rem" }}>
        <PageHeader
          sub={`Round ${idx + 1} of ${exercises.length} · ${cfg.label}`}
          badge={cfg.label}
        />
        <div style={{ background: "white", padding: "2rem", borderRadius: "12px", boxShadow: "0 10px 40px rgba(0,0,0,0.15)" }}>

          {/* Points so far */}
          <div style={{ background: "#f7fafc", border: "2px solid #e2e8f0", borderRadius: "10px", padding: "1rem", textAlign: "center", marginBottom: "1.25rem" }}>
            <div style={{ fontSize: "0.8rem", color: "#718096", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.5px" }}>Points so far</div>
            <div style={{ fontSize: "2.5rem", fontWeight: 800, color: "#667eea", lineHeight: 1.2 }}>
              {ptsEarned} <span style={{ fontSize: "1.2rem", color: "#a0aec0" }}>/ {cfg.maxPts}</span>
            </div>
          </div>

          {/* Band guess */}
          <div style={{ border: "2px solid #e2e8f0", borderRadius: "10px", overflow: "hidden" }}>
            <div style={{ background: GRADIENT, color: "white", padding: "0.6rem 1rem", fontWeight: 700, fontSize: "0.95rem" }}>
              🎤 Do you know the artist? <span style={{ fontWeight: 400, fontSize: "0.85rem", opacity: 0.9 }}>+1 pt</span>
            </div>
            <div style={{ padding: "1rem" }}>
              {!bandDone ? (
                <>
                  <input
                    style={inputStyle} type="text" value={bandGuess}
                    onChange={e => setBandGuess(e.target.value)}
                    onKeyDown={e => e.key === "Enter" && submitBandGuess()}
                    placeholder="Artist or band name..." autoFocus
                  />
                  <div style={{ display: "flex", gap: "10px" }}>
                    <button onClick={submitBandGuess} style={{ flex: 1, padding: "0.9rem", background: GRADIENT, color: "white", border: "none", borderRadius: "8px", cursor: "pointer", fontWeight: 600, fontSize: "1rem", fontFamily: "inherit" }}>Submit</button>
                    <button onClick={() => { setBandOk(false); setBandDone(true); }} style={{ padding: "0.9rem 1.25rem", background: "transparent", color: "#718096", border: "1px solid #e2e8f0", borderRadius: "8px", cursor: "pointer", fontWeight: 500, fontSize: "1rem", fontFamily: "inherit" }}>Skip</button>
                  </div>
                </>
              ) : (
                <>
                  <div style={{ padding: "0.9rem 1rem", borderRadius: "8px", background: bandOk ? "#f0fff4" : "#fff5f5", border: `1px solid ${bandOk ? "#9ae6b4" : "#feb2b2"}`, color: bandOk ? "#276749" : "#c53030", fontWeight: 600, marginBottom: "0.75rem" }}>
                    {bandOk ? `✅ ${ex.artist} — correct! +1 pt` : `❌ It was ${ex.artist}`}
                  </div>
                  <PrimaryBtn onClick={proceedFromBand}>See my score →</PrimaryBtn>
                </>
              )}
            </div>
          </div>
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
      <div style={{ backgroundColor: "#f8f9fa", minHeight: "100vh" }}>
      <div style={{ maxWidth: "800px", margin: "0 auto", padding: "1rem" }}>
        <PageHeader
          sub={`Round ${idx + 1} of ${exercises.length} · ${cfg.label}`}
          badge={cfg.label}
        />
        <div style={{ background: "white", padding: "2rem", borderRadius: "12px", boxShadow: "0 10px 40px rgba(0,0,0,0.15)" }}>

          <p style={{ color: "#718096", fontSize: "0.9rem", fontStyle: "italic", margin: "0 0 1rem" }}>
            {last?.exercise?.artist} — "{last?.exercise?.song_title}"
          </p>

          <ResultPill ok={last?.lyricsOk} label={`Lyric order${last?.lyricPts === 2 ? " (worth 2 pts)" : ""}`} />
          <ResultPill ok={last?.songOk}   label={`Song: "${last?.exercise?.song_title}"`} />
          {mode !== "easy" && (
            <ResultPill ok={last?.bandOk} label={`Artist: ${last?.exercise?.artist}`} />
          )}

          <div style={{ background: "#f7fafc", border: "2px solid #e2e8f0", borderRadius: "10px", padding: "1.25rem", textAlign: "center", marginTop: "1.25rem" }}>
            <div style={{ fontSize: "0.8rem", color: "#718096", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.5px" }}>This round</div>
            <div style={{ fontSize: "3rem", fontWeight: 800, color: "#667eea", lineHeight: 1.2 }}>
              {last?.score} <span style={{ fontSize: "1.4rem", color: "#a0aec0" }}>/ {cfg.maxPts}</span>
            </div>
            <div style={{ fontSize: "0.9rem", color: "#718096", marginTop: "4px" }}>
              Running total: <strong style={{ color: "#667eea" }}>{runningTotal}</strong> pt{runningTotal !== 1 ? "s" : ""} from {history.length} round{history.length !== 1 ? "s" : ""}
            </div>
          </div>

          <PrimaryBtn onClick={handleNext}>
            {isLast ? "See leaderboard 🏆" : "Next song →"}
          </PrimaryBtn>
        </div>
      </div>
      </div>
    );
  }

  // LEADERBOARD
  if (phase === "board") {
    const sessionTotal = history.reduce((s, r) => s + r.score, 0);
    const maxPossible  = exercises.length * cfg.maxPts;
    return (
      <div style={{ backgroundColor: "#f8f9fa", minHeight: "100vh" }}>
      <div style={{ maxWidth: "800px", margin: "0 auto", padding: "1rem" }}>
        <div style={{ background: GRADIENT, borderRadius: "12px", padding: "2.5rem 2rem 2rem", textAlign: "center", color: "white", marginBottom: "1.5rem" }}>
          <h1 style={{ margin: 0, fontSize: "1.8rem" }}>🏆 Leaderboard</h1>
          <p style={{ margin: "8px 0 0", opacity: 0.9 }}>Lyrics Mixer · All-time totals</p>
        </div>
        <div style={{ background: "white", padding: "2rem", borderRadius: "12px", boxShadow: "0 10px 40px rgba(0,0,0,0.15)" }}>

          {/* Session summary */}
          <div style={{ background: "#f7fafc", border: "2px solid #e2e8f0", borderRadius: "10px", padding: "1.25rem", textAlign: "center", marginBottom: "1.5rem" }}>
            <div style={{ fontSize: "0.8rem", color: "#718096", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.5px" }}>
              This session · {cfg.label}
            </div>
            <div style={{ fontSize: "3rem", fontWeight: 800, color: "#667eea", lineHeight: 1.2, margin: "4px 0" }}>
              {sessionTotal} <span style={{ fontSize: "1.4rem", color: "#a0aec0" }}>/ {maxPossible}</span>
            </div>
            <div style={{ fontSize: "1.4rem", marginTop: "4px" }}>
              {history.map((r, i) => (
                <span key={i} title={r.exercise?.song_title}>{r.lyricsOk ? "✅" : "❌"}</span>
              ))}
            </div>
          </div>

          {/* Table */}
          <h3 style={{ color: "#2d3748", fontSize: "1rem", fontWeight: 700, margin: "0 0 12px" }}>🏆 Top Scores</h3>
          {leaderboard.length === 0 ? (
            <div style={{ color: "#718096", textAlign: "center", padding: "1rem" }}>No scores yet — you're first!</div>
          ) : (
            leaderboard.map((row, i) => {
              const isMe = row.student_id === user?.id;
              return (
                <div key={row.student_id} style={{ display: "flex", alignItems: "center", gap: "12px", padding: "10px 8px", borderRadius: "8px", borderBottom: i < leaderboard.length - 1 ? "1px solid #f1f5f9" : "none", background: isMe ? "#f0f4ff" : "transparent" }}>
                  <div style={{ width: "28px", height: "28px", borderRadius: "50%", background: i === 0 ? "#fbbf24" : i === 1 ? "#94a3b8" : i === 2 ? "#b45309" : "#e2e8f0", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "12px", fontWeight: 700, color: i < 3 ? "white" : "#64748b", flexShrink: 0 }}>
                    {i + 1}
                  </div>
                  <div style={{ width: "36px", height: "36px", borderRadius: "50%", background: GRADIENT, display: "flex", alignItems: "center", justifyContent: "center", color: "white", fontWeight: 700, fontSize: "14px", flexShrink: 0 }}>
                    {row.initials}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 600, fontSize: "0.95rem", color: "#1e293b" }}>
                      {row.initials}{isMe && <span style={{ fontSize: "0.75rem", color: "#667eea" }}> · you</span>}
                    </div>
                    <div style={{ fontSize: "0.75rem", color: "#94a3b8" }}>
                      {row.sessions_count} session{row.sessions_count !== 1 ? "s" : ""}
                    </div>
                  </div>
                  <div style={{ fontWeight: 800, fontSize: "1.3rem", color: "#667eea" }}>{row.total_score}</div>
                </div>
              );
            })
          )}

          <PrimaryBtn onClick={() => setPhase("pick")} style={{ marginTop: "1.5rem" }}>
            Play again 🎵
          </PrimaryBtn>
        </div>
      </div>
      </div>
    );
  }

  return null;
}
