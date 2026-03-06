import { useState, useEffect, useRef } from 'react';
import { supabase } from './supabaseClient';

// ── helpers ────────────────────────────────────────────────────────────
const levelGroup = (l) => {
  if (!l) return 'A';
  const u = l.toUpperCase();
  if (u.startsWith('A')) return 'A';
  if (u.startsWith('B')) return 'B';
  return 'C';
};

const GROUP_META = {
  A: { label: '🟢 A Group', color: '#38a169' },
  B: { label: '🔵 B Group', color: '#3182ce' },
  C: { label: '🟠 C Group', color: '#dd6b20' },
};

// ── audio ──────────────────────────────────────────────────────────────
let _audioCtx = null;
function getCtx() {
  if (!_audioCtx) _audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  return _audioCtx;
}
function tone(freq, type = 'sine', dur = 0.15, vol = 0.12, delay = 0) {
  try {
    const ctx = getCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.type = type;
    const t = ctx.currentTime + delay;
    osc.frequency.setValueAtTime(freq, t);
    gain.gain.setValueAtTime(vol, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + dur);
    osc.start(t);
    osc.stop(t + dur);
  } catch (_) {}
}
function playSound(type) {
  if (type === 'correct') {
    tone(880, 'sine', 0.1, 0.13);
    tone(1100, 'sine', 0.1, 0.1, 0.07);
  } else if (type === 'wrong') {
    tone(200, 'sawtooth', 0.14, 0.09);
  } else if (type === 'penalty') {
    tone(160, 'square', 0.1, 0.08);
    tone(120, 'square', 0.12, 0.08, 0.12);
  } else if (type === 'timeup') {
    tone(440, 'sine', 0.08, 0.1);
    tone(330, 'sine', 0.08, 0.1, 0.1);
    tone(220, 'sine', 0.18, 0.12, 0.2);
  }
}

// ── component ──────────────────────────────────────────────────────────
export default function Blurt({ user }) {
  const [view, setView] = useState('select'); // select | countdown | playing | results
  const [categories, setCategories] = useState([]);
  const [profile, setProfile] = useState(null);
  const [selected, setSelected] = useState(null);

  // playing state
  const [inputVal, setInputVal] = useState('');
  const [answers, setAnswers] = useState([]);
  const [timeLeft, setTimeLeft] = useState(60);
  const [dupFlash, setDupFlash] = useState(false);

  // countdown
  const [cdNum, setCdNum] = useState(3);

  // results state
  const [markingState, setMarkingState] = useState('loading'); // loading | revealing | done
  const [results, setResults] = useState([]);
  const [revealIdx, setRevealIdx] = useState(0);
  const [score, setScore] = useState(0);
  const [personalBest, setPersonalBest] = useState(null);
  const [isNewPB, setIsNewPB] = useState(false);
  const [leaderboard, setLeaderboard] = useState({ A: [], B: [], C: [] });

  const answersRef = useRef([]);
  const timerRef = useRef(null);
  const inputRef = useRef(null);
  const selectedRef = useRef(null);

  useEffect(() => { answersRef.current = answers; }, [answers]);
  useEffect(() => { selectedRef.current = selected; }, [selected]);

  useEffect(() => { fetchProfile(); }, []);

  // ── data loading ───────────────────────────────────────────────────
  async function fetchProfile() {
    const { data } = await supabase
      .from('profiles')
      .select('level, tracks, full_name')
      .eq('id', user.id)
      .single();
    setProfile(data);
    fetchCategories(data?.tracks || []);
  }

  async function fetchCategories(tracks) {
    const { data } = await supabase
      .from('blurt_categories')
      .select('*')
      .order('display_order');
    if (!data) return;
    setCategories(
      data.filter(
        (c) =>
          c.track === 'general' ||
          c.track === 'fun' ||
          (c.track === 'hotels' && tracks.includes('hotels')) ||
          (c.track === 'borras' && tracks.includes('bathroom'))
      )
    );
  }

  async function fetchLeaderboard() {
    const cat = selectedRef.current;
    if (!cat) return;
    const { data } = await supabase
      .from('blurt_leaderboard')
      .select('initials, best_score, level_group, student_id')
      .eq('category_id', cat.id)
      .order('best_score', { ascending: false })
      .limit(60);
    if (!data) return;
    const g = { A: [], B: [], C: [] };
    data.forEach((r) => {
      if (g[r.level_group]) g[r.level_group].push(r);
    });
    Object.keys(g).forEach((k) => { g[k] = g[k].slice(0, 10); });
    setLeaderboard(g);
  }

  // ── game flow ──────────────────────────────────────────────────────
  function pickCategory(cat) {
    setSelected(cat);
    selectedRef.current = cat;
    setAnswers([]);
    setInputVal('');
    setTimeLeft(60);
    setCdNum(3);
    setResults([]);
    setScore(0);
    setPersonalBest(null);
    setIsNewPB(false);
    setLeaderboard({ A: [], B: [], C: [] });
    setRevealIdx(0);
    setView('countdown');
  }

  // countdown ticks
  useEffect(() => {
    if (view !== 'countdown') return;
    if (cdNum > 0) {
      const t = setTimeout(() => setCdNum((n) => n - 1), 1000);
      return () => clearTimeout(t);
    }
    const t = setTimeout(() => setView('playing'), 700);
    return () => clearTimeout(t);
  }, [view, cdNum]);

  // game timer
  useEffect(() => {
    if (view !== 'playing') return;
    setTimeout(() => inputRef.current?.focus(), 100);
    timerRef.current = setInterval(() => {
      setTimeLeft((t) => {
        if (t <= 1) {
          clearInterval(timerRef.current);
          playSound('timeup');
          setTimeout(() => startMarking(answersRef.current), 400);
          return 0;
        }
        return t - 1;
      });
    }, 1000);
    return () => clearInterval(timerRef.current);
  }, [view]);

  function addWord() {
    const w = inputVal.trim();
    if (!w) return;
    if (answersRef.current.some((a) => a.toLowerCase() === w.toLowerCase())) {
      setDupFlash(true);
      setTimeout(() => setDupFlash(false), 800);
      setInputVal('');
      return;
    }
    setAnswers((prev) => [...prev, w]);
    setInputVal('');
    inputRef.current?.focus();
  }

  // ── marking ────────────────────────────────────────────────────────
  async function startMarking(finalAnswers) {
    const cat = selectedRef.current;
    setView('results');
    setMarkingState('loading');

    if (!finalAnswers.length) {
      setResults([]);
      setScore(0);
      setMarkingState('done');
      fetchLeaderboard();
      return;
    }

    try {
      const res = await fetch('/api/mark-blurt', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          categoryName: cat.name,
          aiPrompt: cat.ai_prompt,
          answers: finalAnswers,
          penaltyType: cat.penalty_type || null,
        }),
      });
      const { results: marked } = await res.json();
      const raw = marked.reduce(
        (acc, r) => (r.accepted ? acc + 1 : r.penalty ? acc - 1 : acc),
        0
      );
      const final = Math.max(0, raw);
      setResults(marked);
      setScore(final);
      setRevealIdx(0);
      setMarkingState('revealing');
      // fetch leaderboard immediately (shows existing data), then refresh after save
      fetchLeaderboard();
      saveSession(marked, final);
    } catch (e) {
      console.error(e);
      setMarkingState('done');
      fetchLeaderboard();
    }
  }

  // reveal stagger — 100ms per chip
  useEffect(() => {
    if (markingState !== 'revealing') return;
    if (revealIdx >= results.length) {
      setMarkingState('done');
      return;
    }
    const r = results[revealIdx];
    const t = setTimeout(() => {
      if (r.word.toLowerCase() !== 'james') {
        playSound(r.penalty ? 'penalty' : r.accepted ? 'correct' : 'wrong');
      }
      setRevealIdx((i) => i + 1);
    }, 100);
    return () => clearTimeout(t);
  }, [revealIdx, markingState, results]);

  async function saveSession(marked, finalScore) {
    if (!profile) return;
    const cat = selectedRef.current;

    await supabase.from('blurt_sessions').insert({
      student_id: user.id,
      category_id: cat.id,
      answers: marked,
      raw_score: finalScore,
    });

    const { data: ex } = await supabase
      .from('blurt_leaderboard')
      .select('best_score')
      .eq('student_id', user.id)
      .eq('category_id', cat.id)
      .maybeSingle();

    const prev = ex?.best_score ?? null;
    setPersonalBest(prev);

    if (prev === null || finalScore > prev) {
      setIsNewPB(true);
      const initials = (profile.full_name || 'Anon')
        .split(' ')
        .map((n) => n[0] || '')
        .join('')
        .toUpperCase()
        .slice(0, 3);
      await supabase.from('blurt_leaderboard').upsert(
        {
          student_id: user.id,
          category_id: cat.id,
          initials,
          best_score: finalScore,
          level_group: levelGroup(profile.level),
        },
        { onConflict: 'student_id,category_id' }
      );
    }

    // refresh leaderboard after save so new score appears
    await fetchLeaderboard();
  }

  // ── derived ────────────────────────────────────────────────────────
  const timerPct = (timeLeft / 60) * 100;
  const timerColor =
    timeLeft > 20 ? '#38a169' : timeLeft > 10 ? '#dd6b20' : '#e53e3e';
  const runningScore = results
    .slice(0, revealIdx)
    .reduce((a, r) => (r.accepted ? a + 1 : r.penalty ? a - 1 : a), 0);
  const displayScore = markingState === 'done' ? score : runningScore;

  // ── COUNTDOWN ──────────────────────────────────────────────────────
  if (view === 'countdown') {
    return (
      <div
        style={{
          minHeight: '100vh',
          backgroundColor: '#f8f9fa',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '1rem',
          padding: '1rem',
        }}
      >
        <div
          style={{
            fontSize: '0.85rem',
            color: '#888',
            textTransform: 'uppercase',
            letterSpacing: 2,
            textAlign: 'center',
          }}
        >
          {selected?.name}
        </div>
        <div
          style={{
            fontSize: cdNum === 0 ? '2.8rem' : '8rem',
            fontWeight: 900,
            background: 'linear-gradient(135deg, #667eea, #764ba2)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            lineHeight: 1.1,
            transition: 'font-size 0.15s',
            textAlign: 'center',
          }}
        >
          {cdNum === 0 ? '🚀 GO!' : cdNum}
        </div>
      </div>
    );
  }

  // ── PLAYING ────────────────────────────────────────────────────────
  if (view === 'playing') {
    return (
      <div style={{ backgroundColor: '#f8f9fa', minHeight: '100vh', padding: '1rem' }}>
        <div style={{ maxWidth: '800px', margin: '0 auto' }}>
          {/* header with timer bar */}
          <div
            style={{
              background: 'linear-gradient(135deg, #667eea, #764ba2)',
              borderRadius: '12px',
              padding: '1.25rem 1.5rem 0.75rem',
              marginBottom: '1rem',
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginBottom: '0.75rem',
              }}
            >
              <div>
                <div
                  style={{
                    color: 'rgba(255,255,255,0.75)',
                    fontSize: '0.72rem',
                    textTransform: 'uppercase',
                    letterSpacing: 1,
                    marginBottom: '0.2rem',
                  }}
                >
                  Blurt!
                </div>
                <div style={{ color: 'white', fontWeight: 700, fontSize: '1.1rem' }}>
                  {selected?.name}
                </div>
              </div>
              <div
                style={{
                  fontSize: '2.6rem',
                  fontWeight: 900,
                  color: timerColor,
                  backgroundColor: 'white',
                  borderRadius: '10px',
                  padding: '0.15rem 0.65rem',
                  minWidth: '68px',
                  textAlign: 'center',
                  lineHeight: 1.25,
                  transition: 'color 0.3s',
                }}
              >
                {timeLeft}
              </div>
            </div>
            <div
              style={{
                height: '4px',
                backgroundColor: 'rgba(255,255,255,0.25)',
                borderRadius: '2px',
                overflow: 'hidden',
              }}
            >
              <div
                style={{
                  height: '100%',
                  width: `${timerPct}%`,
                  backgroundColor: 'white',
                  borderRadius: '2px',
                  transition: 'width 1s linear',
                }}
              />
            </div>
          </div>

          {/* input area */}
          <div
            style={{
              backgroundColor: 'white',
              borderRadius: '12px',
              padding: '1.25rem',
              boxShadow: '0 4px 16px rgba(0,0,0,0.08)',
              marginBottom: '0.75rem',
            }}
          >
            {selected?.penalty_type && (
              <div
                style={{
                  backgroundColor: '#fff5f5',
                  border: '1px solid #fed7d7',
                  borderRadius: '8px',
                  padding: '0.45rem 0.75rem',
                  marginBottom: '0.75rem',
                  fontSize: '0.8rem',
                  color: '#c53030',
                  fontWeight: 600,
                }}
              >
                {selected.penalty_type === 'make_not_do'
                  ? '⚠️ Penalty −1 for DO words!'
                  : '⚠️ Penalty −1 for MAKE words!'}
              </div>
            )}
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <input
                ref={inputRef}
                value={inputVal}
                onChange={(e) => setInputVal(e.target.value)}
                onKeyDown={(e) =>
                  e.key === 'Enter' && (e.preventDefault(), addWord())
                }
                placeholder="Type a word, press Enter..."
                autoComplete="off"
                autoCapitalize="none"
                spellCheck={false}
                style={{
                  flex: 1,
                  fontSize: '1.05rem',
                  padding: '0.7rem 1rem',
                  border: `2px solid ${dupFlash ? '#fc8181' : '#e2e8f0'}`,
                  borderRadius: '8px',
                  outline: 'none',
                  transition: 'border-color 0.2s',
                }}
              />
              <button
                onClick={addWord}
                style={{
                  background: 'linear-gradient(135deg, #667eea, #764ba2)',
                  color: 'white',
                  border: 'none',
                  borderRadius: '8px',
                  padding: '0.7rem 1.1rem',
                  fontSize: '1.3rem',
                  cursor: 'pointer',
                  fontWeight: 700,
                }}
              >
                +
              </button>
            </div>
            {dupFlash && (
              <div style={{ color: '#e53e3e', fontSize: '0.78rem', marginTop: '0.3rem' }}>
                Already added!
              </div>
            )}
          </div>

          {/* word chips */}
          <div
            style={{
              backgroundColor: 'white',
              borderRadius: '12px',
              padding: '1.25rem',
              boxShadow: '0 4px 16px rgba(0,0,0,0.08)',
              minHeight: '90px',
            }}
          >
            <div style={{ fontSize: '0.76rem', color: '#a0aec0', marginBottom: '0.6rem' }}>
              👆 Press Enter after each answer &middot; {answers.length} added
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>
              {answers.map((w, i) => (
                <span
                  key={i}
                  style={{
                    backgroundColor: '#f0f4ff',
                    color: '#4a5568',
                    padding: '0.3rem 0.7rem',
                    borderRadius: '20px',
                    fontSize: '0.88rem',
                    fontWeight: 500,
                  }}
                >
                  {w}
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ── RESULTS ────────────────────────────────────────────────────────
  if (view === 'results') {
    return (
      <div style={{ backgroundColor: '#f8f9fa', minHeight: '100vh', padding: '1rem' }}>
        <div style={{ maxWidth: '800px', margin: '0 auto' }}>
          {/* score header */}
          <div
            style={{
              background: 'linear-gradient(135deg, #667eea, #764ba2)',
              borderRadius: '12px',
              padding: '2rem 2rem 1.5rem',
              marginBottom: '1rem',
              textAlign: 'center',
            }}
          >
            <div
              style={{
                color: 'rgba(255,255,255,0.75)',
                fontSize: '0.78rem',
                textTransform: 'uppercase',
                letterSpacing: 1,
                marginBottom: '0.5rem',
              }}
            >
              {selected?.name}
            </div>
            {markingState === 'loading' ? (
              <div style={{ color: 'rgba(255,255,255,0.9)', fontSize: '1rem' }}>
                🤖 Marking your answers...
              </div>
            ) : (
              <>
                <div
                  style={{
                    color: 'white',
                    fontSize: '4.5rem',
                    fontWeight: 900,
                    lineHeight: 1,
                  }}
                >
                  {displayScore}
                </div>
                <div
                  style={{
                    color: 'rgba(255,255,255,0.85)',
                    fontSize: '0.88rem',
                    marginTop: '0.4rem',
                    minHeight: '1.2rem',
                  }}
                >
                  {markingState === 'done' && isNewPB && '🏆 New personal best!'}
                  {markingState === 'done' &&
                    !isNewPB &&
                    personalBest !== null &&
                    `Your best: ${personalBest}`}
                  {markingState === 'revealing' && '\u00a0'}
                </div>
              </>
            )}
          </div>

          {/* answer chips with reveal */}
          <div
            style={{
              backgroundColor: 'white',
              borderRadius: '12px',
              padding: '1.5rem',
              boxShadow: '0 10px 40px rgba(0,0,0,0.12)',
              marginBottom: '1rem',
            }}
          >
            {markingState === 'loading' && (
              <div
                style={{
                  textAlign: 'center',
                  padding: '2rem',
                  color: '#a0aec0',
                  fontSize: '0.88rem',
                }}
              >
                Sending {answers.length} answer{answers.length !== 1 ? 's' : ''} to
                the examiner...
              </div>
            )}

            {(markingState === 'revealing' || markingState === 'done') &&
              results.length === 0 && (
                <div
                  style={{ textAlign: 'center', color: '#a0aec0', padding: '1.5rem' }}
                >
                  No answers submitted.
                </div>
              )}

            {(markingState === 'revealing' || markingState === 'done') &&
              results.length > 0 && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                  {results.map((r, i) => {
                    const revealed = i < revealIdx;
                    const isJames =
                      r.word.toLowerCase() === 'james' && r.accepted;

                    let bg = '#f7fafc',
                      border = '2px solid #edf2f7',
                      color = '#cbd5e0';
                    if (revealed) {
                      if (isJames) {
                        bg = '#fffff0';
                        border = '2px solid #f6e05e';
                        color = '#b7791f';
                      } else if (r.penalty) {
                        bg = '#fff5f5';
                        border = '2px solid #fc8181';
                        color = '#c53030';
                      } else if (r.accepted) {
                        bg = '#f0fff4';
                        border = '2px solid #68d391';
                        color = '#276749';
                      } else {
                        bg = '#fff5f5';
                        border = '2px solid #fed7d7';
                        color = '#9b2c2c';
                      }
                    }

                    return (
                      <div
                        key={i}
                        style={{
                          backgroundColor: bg,
                          border,
                          borderRadius: '10px',
                          padding: '0.4rem 0.8rem',
                          transition: 'background-color 0.2s, border-color 0.2s',
                          display: 'flex',
                          flexDirection: 'column',
                          alignItems: 'flex-start',
                        }}
                      >
                        <div
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.3rem',
                            color,
                            fontWeight: 600,
                            fontSize: '0.9rem',
                          }}
                        >
                          {revealed &&
                            (isJames
                              ? '⭐️'
                              : r.penalty
                              ? '➖'
                              : r.accepted
                              ? '✅'
                              : '❌')}
                          {r.word}
                          {revealed && isJames && (
                            <span
                              style={{
                                fontSize: '0.7rem',
                                color: '#d69e2e',
                                fontStyle: 'italic',
                              }}
                            >
                              bonus!
                            </span>
                          )}
                        </div>
                        {revealed && r.reason && (
                          <div
                            style={{
                              fontSize: '0.7rem',
                              color: '#718096',
                              marginTop: '0.12rem',
                              fontStyle: 'italic',
                            }}
                          >
                            {r.reason}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
          </div>

          {/* leaderboard */}
          {markingState === 'done' && (
            <div
              style={{
                backgroundColor: 'white',
                borderRadius: '12px',
                padding: '1.5rem',
                boxShadow: '0 10px 40px rgba(0,0,0,0.12)',
                marginBottom: '1rem',
              }}
            >
              <div
                style={{
                  fontWeight: 700,
                  fontSize: '1rem',
                  color: '#2d3748',
                  marginBottom: '1rem',
                }}
              >
                🏆 {selected?.name} — Leaderboard
              </div>
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr 1fr 1fr',
                  gap: '1rem',
                }}
              >
                {['A', 'B', 'C'].map((g) => (
                  <div key={g}>
                    <div
                      style={{
                        fontSize: '0.7rem',
                        fontWeight: 700,
                        letterSpacing: 1,
                        color: GROUP_META[g].color,
                        marginBottom: '0.5rem',
                        paddingBottom: '0.3rem',
                        borderBottom: `2px solid ${GROUP_META[g].color}`,
                      }}
                    >
                      {GROUP_META[g].label}
                    </div>
                    {leaderboard[g].length === 0 ? (
                      <div
                        style={{
                          fontSize: '0.76rem',
                          color: '#a0aec0',
                          fontStyle: 'italic',
                        }}
                      >
                        No entries yet
                      </div>
                    ) : (
                      leaderboard[g].map((e, i) => (
                        <div
                          key={i}
                          style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            padding: '0.28rem 0.4rem',
                            borderRadius: '6px',
                            marginBottom: '0.18rem',
                            backgroundColor:
                              e.student_id === user.id
                                ? '#f0f4ff'
                                : i === 0
                                ? '#fffff0'
                                : 'transparent',
                            fontWeight: e.student_id === user.id ? 700 : 400,
                          }}
                        >
                          <span style={{ fontSize: '0.8rem', color: '#4a5568' }}>
                            {i + 1}. {e.initials}
                            {i === 0 ? ' 🏆' : ''}
                            {e.student_id === user.id ? ' 👈' : ''}
                          </span>
                          <span
                            style={{
                              fontSize: '0.85rem',
                              fontWeight: 700,
                              color: '#667eea',
                            }}
                          >
                            {e.best_score}
                          </span>
                        </div>
                      ))
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* action buttons */}
          {markingState === 'done' && (
            <div style={{ display: 'flex', gap: '0.75rem' }}>
              <button
                onClick={() => pickCategory(selected)}
                style={{
                  flex: 1,
                  background: 'linear-gradient(135deg, #667eea, #764ba2)',
                  color: 'white',
                  border: 'none',
                  borderRadius: '10px',
                  padding: '0.875rem',
                  fontSize: '0.95rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                🔄 Play Again
              </button>
              <button
                onClick={() => setView('select')}
                style={{
                  flex: 1,
                  backgroundColor: 'white',
                  color: '#667eea',
                  border: '2px solid #667eea',
                  borderRadius: '10px',
                  padding: '0.875rem',
                  fontSize: '0.95rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                📋 New Category
              </button>
            </div>
          )}
        </div>
      </div>
    );
  }

  // ── SELECT ─────────────────────────────────────────────────────────
  const general = categories.filter((c) => c.track === 'general');
  const tracked = categories.filter(
    (c) => c.track === 'hotels' || c.track === 'borras'
  );
  const fun = categories.filter((c) => c.track === 'fun');

  if (!categories.length) {
    return (
      <div
        style={{
          minHeight: '100vh',
          backgroundColor: '#f8f9fa',
          display: 'flex',
          alignItems: 'center',
          