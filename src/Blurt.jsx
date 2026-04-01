import { useState, useEffect, useRef } from 'react';
import { supabase } from './supabaseClient';

// ── Audio ──────────────────────────────────────────────────────────────────
let _ctx = null;
function getCtx() {
  if (!_ctx) _ctx = new (window.AudioContext || window.webkitAudioContext)();
  return _ctx;
}
function tone(freq, type = 'sine', dur = 0.15, vol = 0.12, delay = 0) {
  try {
    const ctx = getCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain); gain.connect(ctx.destination);
    osc.type = type;
    const t = ctx.currentTime + delay;
    osc.frequency.setValueAtTime(freq, t);
    gain.gain.setValueAtTime(vol, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + dur);
    osc.start(t); osc.stop(t + dur);
  } catch (_) {}
}
function playSound(type) {
  if (type === 'correct')  { tone(880, 'sine', 0.1, 0.13); tone(1100, 'sine', 0.1, 0.1, 0.07); }
  if (type === 'wrong')    { tone(200, 'sawtooth', 0.14, 0.09); }
  if (type === 'penalty')  { tone(160, 'square', 0.1, 0.08); tone(120, 'square', 0.12, 0.08, 0.12); }
  if (type === 'timeup')   { tone(440, 'sine', 0.08, 0.1); tone(330, 'sine', 0.08, 0.1, 0.1); tone(220, 'sine', 0.18, 0.12, 0.2); }
}

// ── Helpers ────────────────────────────────────────────────────────────────
const getLevelGroup = (level) => {
  if (!level) return 'B';
  const u = level.toUpperCase();
  if (u.startsWith('A')) return 'A';
  if (u.startsWith('B')) return 'B';
  return 'C';
};
const getInitials = (fullName) =>
  (fullName || 'Anon').trim().split(/\s+/).map(w => w[0] || '').join('').toUpperCase().slice(0, 3);

const GROUP_META = {
  A: { label: '🟢 A Group', color: '#38a169' },
  B: { label: '🔵 B Group', color: '#3182ce' },
  C: { label: '🟠 C Group', color: '#dd6b20' },
};

const gradientBg = 'linear-gradient(135deg, #667eea, #764ba2)';
const card = { backgroundColor: 'white', borderRadius: '12px', padding: '1.5rem', boxShadow: '0 10px 40px rgba(0,0,0,0.12)', marginBottom: '1rem' };
const btnPrimary = { background: gradientBg, color: 'white', border: 'none', borderRadius: '10px', padding: '0.875rem 1.5rem', fontSize: '1rem', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' };
const btnSecondary = { backgroundColor: 'white', color: '#667eea', border: '2px solid #667eea', borderRadius: '10px', padding: '0.875rem 1.5rem', fontSize: '1rem', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' };

// ── Main Component ─────────────────────────────────────────────────────────
export default function Blurt({ user, profileOverride = null }) {
  const [view, setView] = useState('home');
  const [categories, setCategories] = useState([]);
  const [profile, setProfile] = useState(null);
  const [selected, setSelected] = useState(null);

  const [inputVal, setInputVal] = useState('');
  const [chips, setChips] = useState([]);
  const [timeLeft, setTimeLeft] = useState(60);
  const [dupFlash, setDupFlash] = useState(false);
  const [cdNum, setCdNum] = useState(3);

  const [score, setScore] = useState(0);
  const [personalBest, setPersonalBest] = useState(null);
  const [isNewPB, setIsNewPB] = useState(false);
  const [leaderboard, setLeaderboard] = useState({ A: [], B: [], C: [] });

  const timerRef = useRef(null);
  const inputRef = useRef(null);
  const chipsRef = useRef([]);
  const selectedRef = useRef(null);
  const gameEndedRef = useRef(false);

  useEffect(() => { chipsRef.current = chips; }, [chips]);
  useEffect(() => { selectedRef.current = selected; }, [selected]);
  useEffect(() => { fetchProfile(); }, []);

  async function fetchProfile() {
    const { data } = await supabase.from('profiles').select('level, tracks, full_name').eq('id', user.id).single();
    const resolved = profileOverride || data;
    if (resolved) setProfile(resolved);
    fetchCategories(resolved?.tracks || [], resolved?.level);
  }

  async function fetchCategories(userTracks, userLevel) {
    const { data } = await supabase.from('blurt_categories').select('*').order('sort_order');
    if (!data) return;
    const isSpanish = userLevel === 'Spanish' || userTracks.includes('spanish');
    setCategories(data.filter((c) => {
      const t = c.tracks || [];
      if (isSpanish) return t.includes('spanish');
      if (t.includes('general')) return true;
      if (t.includes('hotels') && userTracks.includes('hotels')) return true;
      if (t.includes('bathroom') && userTracks.includes('bathroom')) return true;
      return false;
    }));
  }

  async function fetchLeaderboard() {
    const cat = selectedRef.current;
    if (!cat) return;
    const { data } = await supabase.from('blurt_leaderboard').select('initials, best_score, level_group, student_id').eq('category_id', cat.id).order('best_score', { ascending: false }).limit(60);
    if (!data) return;
    const g = { A: [], B: [], C: [] };
    data.forEach(r => { if (g[r.level_group]) g[r.level_group].push(r); });
    Object.keys(g).forEach(k => { g[k] = g[k].slice(0, 10); });
    setLeaderboard(g);
  }

  function pickRandom() {
    if (!categories.length) return;
    const cat = categories[Math.floor(Math.random() * categories.length)];
    setSelected(cat);
    selectedRef.current = cat;
    resetGameState();
    setView('reveal');
  }

  function resetGameState() {
    clearInterval(timerRef.current);
    setChips([]); chipsRef.current = [];
    setInputVal(''); setTimeLeft(60); setCdNum(3);
    setScore(0); setPersonalBest(null); setIsNewPB(false);
    setLeaderboard({ A: [], B: [], C: [] });
    gameEndedRef.current = false;
  }

  // countdown
  useEffect(() => {
    if (view !== 'countdown') return;
    if (cdNum > 0) {
      const t = setTimeout(() => setCdNum(n => n - 1), 1000);
      return () => clearTimeout(t);
    }
    const t = setTimeout(() => setView('playing'), 500);
    return () => clearTimeout(t);
  }, [view, cdNum]);

  // game timer
  useEffect(() => {
    if (view !== 'playing') return;
    setTimeout(() => inputRef.current?.focus(), 100);
    timerRef.current = setInterval(() => {
      setTimeLeft(t => {
        if (t <= 1) {
          clearInterval(timerRef.current);
          playSound('timeup');
          gameEndedRef.current = true;
          setTimeout(() => finishGame(), 400);
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
    if (chipsRef.current.some(c => c.word.toLowerCase() === w.toLowerCase())) {
      setDupFlash(true);
      setTimeout(() => setDupFlash(false), 800);
      setInputVal('');
      return;
    }
    const idx = chipsRef.current.length;
    const newChip = { word: w, status: 'pending', note: '' };
    chipsRef.current = [...chipsRef.current, newChip];
    setChips([...chipsRef.current]);
    setInputVal('');
    inputRef.current?.focus();
    markWord(w, idx);
  }

  async function markWord(word, idx) {
    const cat = selectedRef.current;
    if (!cat) return;
    try {
      const res = await fetch('/api/mark-game', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'blurt',
          categoryName: cat.name,
          scoringInstructions: cat.scoring_instructions,
          hasPenalty: cat.has_penalty,
          penaltyCategoryName: cat.penalty_category_name,
          answers: [word],
        }),
      });
      const data = await res.json();
      const result = data.scored?.[0];
      if (!result) return;

      const isJames = word.toLowerCase() === 'james' && result.accepted;
      let status = 'wrong';
      if (isJames) status = 'james';
      else if (result.penalty) status = 'penalty';
      else if (result.accepted) status = 'correct';

      playSound(status === 'correct' || status === 'james' ? 'correct' : status === 'penalty' ? 'penalty' : 'wrong');

      setChips(prev => {
        const updated = [...prev];
        if (updated[idx]) updated[idx] = { ...updated[idx], status, note: result.note || '' };
        chipsRef.current = updated;
        return updated;
      });
    } catch (e) {
      console.error('markWord error', e);
      setChips(prev => {
        const updated = [...prev];
        if (updated[idx]) updated[idx] = { ...updated[idx], status: 'wrong', note: '' };
        chipsRef.current = updated;
        return updated;
      });
    }
  }

  async function finishGame() {
    setView('results');
    let waited = 0;
    while (waited < 8000) {
      if (chipsRef.current.every(c => c.status !== 'pending')) break;
      await new Promise(r => setTimeout(r, 200));
      waited += 200;
    }
    const finalChips = chipsRef.current;
    const finalScore = Math.max(0, finalChips.reduce((acc, c) => {
      if (c.status === 'correct' || c.status === 'james') return acc + 1;
      if (c.status === 'penalty') return acc - 1;
      return acc;
    }, 0));
    setScore(finalScore);
    await saveSession(finalChips, finalScore);
    await fetchLeaderboard();
  }

  async function saveSession(finalChips, finalScore) {
    if (!profile) return;
    const cat = selectedRef.current;
    const group = getLevelGroup(profile.level);
    await supabase.from('blurt_sessions').insert({ student_id: user.id, category_id: cat.id, answers: finalChips, raw_score: finalScore });
    const { data: ex } = await supabase.from('blurt_leaderboard').select('best_score').eq('student_id', user.id).eq('category_id', cat.id).maybeSingle();
    const prev = ex?.best_score ?? null;
    setPersonalBest(prev);
    if (prev === null || finalScore > prev) {
      setIsNewPB(true);
      await supabase.from('blurt_leaderboard').upsert(
        { student_id: user.id, category_id: cat.id, initials: getInitials(profile.full_name), best_score: finalScore, level_group: group },
        { onConflict: 'student_id,category_id' }
      );
    }
  }

  function chipStyle(status) {
    const base = { borderRadius: '10px', padding: '0.4rem 0.8rem', display: 'flex', flexDirection: 'column', alignItems: 'flex-start', border: '2px solid', transition: 'background-color 0.2s, border-color 0.2s' };
    if (status === 'pending') return { ...base, backgroundColor: '#f7fafc', borderColor: '#e2e8f0' };
    if (status === 'correct') return { ...base, backgroundColor: '#f0fff4', borderColor: '#68d391' };
    if (status === 'james')   return { ...base, backgroundColor: '#fffff0', borderColor: '#f6e05e' };
    if (status === 'penalty') return { ...base, backgroundColor: '#fff5f5', borderColor: '#fc8181' };
    return { ...base, backgroundColor: '#fff5f5', borderColor: '#fed7d7' };
  }
  function chipColor(status) {
    if (status === 'correct') return '#276749';
    if (status === 'james')   return '#b7791f';
    if (status === 'penalty') return '#c53030';
    if (status === 'wrong')   return '#9b2c2c';
    return '#a0aec0';
  }
  function chipIcon(status) {
    if (status === 'pending') return '…';
    if (status === 'correct') return '✅';
    if (status === 'james')   return '⭐️';
    if (status === 'penalty') return '➖';
    return '❌';
  }

  const Chip = ({ c }) => (
    <div style={chipStyle(c.status)}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', color: chipColor(c.status), fontWeight: 600, fontSize: '0.9rem' }}>
        <span style={{ fontSize: '0.8rem' }}>{chipIcon(c.status)}</span>
        {c.word}
        {c.status === 'james' && <span style={{ fontSize: '0.7rem', color: '#d69e2e', fontStyle: 'italic' }}>bonus!</span>}
      </div>
      {c.note && c.status !== 'pending' && (
        <div style={{ fontSize: '0.7rem', color: '#718096', marginTop: '0.1rem', fontStyle: 'italic' }}>{c.note}</div>
      )}
    </div>
  );

  const timerPct = (timeLeft / 60) * 100;
  const timerColor = timeLeft > 20 ? '#38a169' : timeLeft > 10 ? '#dd6b20' : '#e53e3e';
  const liveScore = Math.max(0, chips.reduce((acc, c) => {
    if (c.status === 'correct' || c.status === 'james') return acc + 1;
    if (c.status === 'penalty') return acc - 1;
    return acc;
  }, 0));

  const wrap = (children) => (
    <div style={{ backgroundColor: '#f8f9fa', minHeight: '100vh', padding: '1rem' }}>
      <div style={{ maxWidth: '800px', margin: '0 auto' }}>{children}</div>
    </div>
  );

  const GradHeader = ({ big = false }) => (
    <div style={{ background: gradientBg, borderRadius: '12px', padding: big ? '3rem 2rem' : '1.5rem 2rem', marginBottom: '1rem', textAlign: 'center', color: 'white' }}>
      <div style={{ fontSize: big ? '3rem' : '1.5rem' }}>⏱️</div>
      <h1 style={{ margin: '0.25rem 0 0', fontSize: big ? '2.8rem' : '1.6rem', fontWeight: 800 }}>Blurt!</h1>
      {big && <p style={{ margin: '0.5rem 0 0', opacity: 0.9, fontSize: '1rem' }}>How many can you name in 60 seconds?</p>}
    </div>
  );

  // ── HOME ───────────────────────────────────────────────────────────────
  if (view === 'home') return wrap(
    <>
      <GradHeader big />
      <div style={{ ...card, textAlign: 'center', padding: '3rem 2rem' }}>
        {categories.length === 0 ? (
          <p style={{ color: '#a0aec0' }}>Loading categories...</p>
        ) : (
          <>
            <p style={{ color: '#718096', marginBottom: '2rem', fontSize: '0.95rem', lineHeight: 1.6 }}>
              We'll pick a random category for you.<br />
              Type as many answers as you can before time runs out!
            </p>
            <button onClick={pickRandom} style={{ ...btnPrimary, fontSize: '1.3rem', padding: '1rem 3rem' }}>
              Let's Blurt! 🎲
            </button>
            <p style={{ color: '#a0aec0', fontSize: '0.78rem', marginTop: '1.25rem' }}>
              {categories.length} categories available
            </p>
          </>
        )}
      </div>
    </>
  );

  // ── REVEAL ─────────────────────────────────────────────────────────────
  if (view === 'reveal') return wrap(
    <>
      <GradHeader />
      <div style={{ ...card, textAlign: 'center', padding: '2.5rem 2rem' }}>
        <div style={{ fontSize: '0.72rem', fontWeight: 700, color: '#a0aec0', textTransform: 'uppercase', letterSpacing: 2, marginBottom: '1rem' }}>
          Your category is...
        </div>
        <div style={{ fontSize: '2.2rem', fontWeight: 800, color: '#2d3748', lineHeight: 1.25, marginBottom: '0.75rem' }}>
          {selected?.name}
        </div>
        {selected?.description && (
          <p style={{ color: '#718096', fontSize: '0.92rem', margin: '0 0 1rem' }}>{selected.description}</p>
        )}
        {selected?.has_penalty && (
          <div style={{ background: '#fff5f5', border: '1px solid #fed7d7', borderRadius: '8px', padding: '0.6rem 1rem', marginBottom: '1.25rem', fontSize: '0.85rem', color: '#c53030', fontWeight: 600 }}>
            ⚠️ Penalty −1 for {selected.penalty_category_name === 'do' ? '"do" words' : '"make" words'}!
          </div>
        )}
        <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'center', flexWrap: 'wrap', marginTop: '1.5rem' }}>
          <button onClick={pickRandom} style={btnSecondary}>🎲 Different Category</button>
          <button onClick={() => setView('countdown')} style={{ ...btnPrimary, fontSize: '1.1rem', padding: '0.875rem 2rem' }}>
            Go! ⏱️
          </button>
        </div>
      </div>
    </>
  );

  // ── COUNTDOWN ──────────────────────────────────────────────────────────
  if (view === 'countdown') return (
    <div style={{ minHeight: '100vh', backgroundColor: '#f8f9fa', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '1rem' }}>
      <div style={{ fontSize: '0.85rem', color: '#888', textTransform: 'uppercase', letterSpacing: 2, textAlign: 'center' }}>{selected?.name}</div>
      <div style={{ fontSize: cdNum === 0 ? '2.8rem' : '8rem', fontWeight: 900, background: gradientBg, WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', lineHeight: 1.1, transition: 'font-size 0.15s', textAlign: 'center' }}>
        {cdNum === 0 ? '🚀 GO!' : cdNum}
      </div>
    </div>
  );

  // ── PLAYING ────────────────────────────────────────────────────────────
  if (view === 'playing') return (
    <div style={{ backgroundColor: '#f8f9fa', minHeight: '100vh', padding: '1rem' }}>
      <div style={{ maxWidth: '800px', margin: '0 auto' }}>
        <div style={{ background: gradientBg, borderRadius: '12px', padding: '1.25rem 1.5rem 0.75rem', marginBottom: '1rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
            <div>
              <div style={{ color: 'rgba(255,255,255,0.75)', fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: 1, marginBottom: '0.2rem' }}>⏱️ Blurt!</div>
              <div style={{ color: 'white', fontWeight: 700, fontSize: '1.1rem' }}>{selected?.name}</div>
            </div>
            <div style={{ width: 68, height: 68, borderRadius: '50%', border: `4px solid ${timerColor}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, fontWeight: 900, color: timerColor, background: 'rgba(255,255,255,0.15)', flexShrink: 0, transition: 'color 0.3s, border-color 0.3s' }}>
              {timeLeft}
            </div>
          </div>
          <div style={{ height: '4px', backgroundColor: 'rgba(255,255,255,0.25)', borderRadius: '2px', overflow: 'hidden' }}>
            <div style={{ height: '100%', width: `${timerPct}%`, backgroundColor: 'white', borderRadius: '2px', transition: 'width 1s linear' }} />
          </div>
        </div>

        <div style={{ backgroundColor: 'white', borderRadius: '12px', padding: '1.25rem', boxShadow: '0 4px 16px rgba(0,0,0,0.08)', marginBottom: '0.75rem' }}>
          {selected?.has_penalty && (
            <div style={{ backgroundColor: '#fff5f5', border: '1px solid #fed7d7', borderRadius: '8px', padding: '0.45rem 0.75rem', marginBottom: '0.75rem', fontSize: '0.8rem', color: '#c53030', fontWeight: 600 }}>
              {selected.penalty_category_name === 'do' ? '⚠️ Penalty −1 for DO words!' : '⚠️ Penalty −1 for MAKE words!'}
            </div>
          )}
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <input ref={inputRef} value={inputVal} onChange={e => setInputVal(e.target.value)} onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), addWord())} placeholder="Type a word, press Enter..." autoComplete="off" autoCapitalize="none" spellCheck={false}
              style={{ flex: 1, fontSize: '1.05rem', padding: '0.7rem 1rem', border: `2px solid ${dupFlash ? '#fc8181' : '#e2e8f0'}`, borderRadius: '8px', outline: 'none', fontFamily: 'inherit', transition: 'border-color 0.2s' }} />
            <button onClick={addWord} style={{ background: gradientBg, color: 'white', border: 'none', borderRadius: '8px', padding: '0.7rem 1.1rem', fontSize: '1.3rem', cursor: 'pointer', fontWeight: 700 }}>+</button>
          </div>
          {dupFlash && <div style={{ color: '#e53e3e', fontSize: '0.78rem', marginTop: '0.3rem' }}>Already added!</div>}
        </div>

        <div style={{ backgroundColor: 'white', borderRadius: '12px', padding: '1.25rem', boxShadow: '0 4px 16px rgba(0,0,0,0.08)', minHeight: '90px' }}>
          <div style={{ fontSize: '0.76rem', color: '#a0aec0', marginBottom: '0.6rem' }}>
            👆 Press Enter after each answer · {chips.length} added · score: {liveScore}
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
            {chips.map((c, i) => <Chip key={i} c={c} />)}
          </div>
        </div>
      </div>
    </div>
  );

  // ── RESULTS ────────────────────────────────────────────────────────────
  if (view === 'results') {
    const stillPending = chips.some(c => c.status === 'pending');
    return (
      <div style={{ backgroundColor: '#f8f9fa', minHeight: '100vh', padding: '1rem' }}>
        <div style={{ maxWidth: '800px', margin: '0 auto' }}>
          <div style={{ background: gradientBg, borderRadius: '12px', padding: '2rem', marginBottom: '1rem', textAlign: 'center', color: 'white' }}>
            <div style={{ fontSize: '0.78rem', textTransform: 'uppercase', letterSpacing: 1, opacity: 0.8, marginBottom: '0.5rem' }}>{selected?.name}</div>
            {stillPending ? (
              <div style={{ fontSize: '1rem', opacity: 0.9 }}>🤖 Finishing marking...</div>
            ) : (
              <>
                <div style={{ fontSize: '4.5rem', fontWeight: 900, lineHeight: 1 }}>{score}</div>
                <div style={{ fontSize: '0.88rem', opacity: 0.85, marginTop: '0.4rem', minHeight: '1.2rem' }}>
                  {isNewPB ? '🏆 New personal best!' : personalBest !== null ? `Your best: ${personalBest}` : ''}
                </div>
              </>
            )}
          </div>

          <div style={card}>
            {chips.length === 0 ? (
              <div style={{ textAlign: 'center', color: '#a0aec0', padding: '1.5rem' }}>No answers submitted.</div>
            ) : (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                {chips.map((c, i) => <Chip key={i} c={c} />)}
              </div>
            )}
          </div>

          {!stillPending && (
            <>
              <div style={card}>
                <div style={{ fontWeight: 700, fontSize: '1rem', color: '#2d3748', marginBottom: '1rem' }}>🏆 {selected?.name} — Leaderboard</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1rem' }}>
                  {['A', 'B', 'C'].map(g => (
                    <div key={g}>
                      <div style={{ fontSize: '0.7rem', fontWeight: 700, letterSpacing: 1, color: GROUP_META[g].color, marginBottom: '0.5rem', paddingBottom: '0.3rem', borderBottom: `2px solid ${GROUP_META[g].color}` }}>{GROUP_META[g].label}</div>
                      {leaderboard[g].length === 0 ? (
                        <div style={{ fontSize: '0.76rem', color: '#a0aec0', fontStyle: 'italic' }}>No entries yet</div>
                      ) : leaderboard[g].map((e, i) => (
                        <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.28rem 0.4rem', borderRadius: '6px', marginBottom: '0.18rem', backgroundColor: e.student_id === user.id ? '#f0f4ff' : i === 0 ? '#fffff0' : 'transparent', fontWeight: e.student_id === user.id ? 700 : 400 }}>
                          <span style={{ fontSize: '0.8rem', color: '#4a5568' }}>{i + 1}. {e.initials}{i === 0 ? ' 🏆' : ''}{e.student_id === user.id ? ' 👈' : ''}</span>
                          <span style={{ fontSize: '0.85rem', fontWeight: 700, color: '#667eea' }}>{e.best_score}</span>
                        </div>
                      ))}
                    </div>
                  ))}
                </div>
              </div>

              <div style={{ display: 'flex', gap: '0.75rem' }}>
                <button onClick={() => { resetGameState(); setView('home'); }} style={{ ...btnSecondary, flex: 1 }}>🏠 Home</button>
                <button onClick={() => { const cat = selected; resetGameState(); setSelected(cat); selectedRef.current = cat; setView('reveal'); }} style={{ ...btnSecondary, flex: 1 }}>🔄 Same</button>
                <button onClick={() => { resetGameState(); pickRandom(); }} style={{ ...btnPrimary, flex: 1 }}>🎲 New Category</button>
              </div>
            </>
          )}
        </div>
      </div>
    );
  }

  return null;
}
