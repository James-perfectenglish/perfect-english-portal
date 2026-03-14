import { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from './supabaseClient';

// ─── Sound ────────────────────────────────────────────────────────────────────
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
  if (type === 'ok')        { tone(880, 'sine', 0.1, 0.13); tone(1100, 'sine', 0.1, 0.1, 0.07); }
  if (type === 'bonus')     { tone(880, 'sine', 0.1, 0.13); tone(1100, 'sine', 0.1, 0.1, 0.07); tone(1320, 'sine', 0.1, 0.1, 0.16); }
  if (type === 'milestone') { tone(550, 'sine', 0.15, 0.13); tone(660, 'sine', 0.15, 0.13, 0.1); tone(880, 'sine', 0.2, 0.13, 0.2); }
  if (type === 'fail')      { tone(200, 'sawtooth', 0.14, 0.09); }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
const SOLO_DURATION = 60;
const LONG_MIN      = 7;
const MILESTONES    = [10, 20, 30];

const lastChar  = (s) => (s || '').trim().slice(-1).toLowerCase();
const firstChar = (s) => (s || '').trim()[0]?.toLowerCase() || '';
const stripped  = (s) => s.replace(/\s/g, '').length;
const lvlGroup  = (l) => { const u = (l || '').toUpperCase(); return u.startsWith('A') ? 'A' : u.startsWith('B') ? 'B' : 'C'; };
const mkInit    = (n) => (n || 'AN').split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 3);
const randCode  = () => String(Math.floor(1000 + Math.random() * 9000));

function wordScore(word, newLen) {
  let pts = 1;
  if (stripped(word) >= LONG_MIN) pts++;
  if (MILESTONES.includes(newLen)) pts += 2;
  return pts;
}

function catVisible(cat, profileTracks) {
  const pt = profileTracks || ['general'];
  return (cat.tracks || ['general']).some(t => t === 'general' || pt.includes(t));
}

// ─── Constants ────────────────────────────────────────────────────────────────
const gradientBg = 'linear-gradient(135deg, #667eea, #764ba2)';
const card = { backgroundColor: 'white', borderRadius: '12px', padding: '1.5rem', boxShadow: '0 10px 40px rgba(0,0,0,0.12)', marginBottom: '1rem' };
const btnPrimary = { background: gradientBg, color: 'white', border: 'none', borderRadius: '10px', padding: '0.875rem 1.5rem', fontSize: '1rem', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' };
const btnSecondary = { backgroundColor: 'white', color: '#667eea', border: '2px solid #667eea', borderRadius: '10px', padding: '0.875rem 1.5rem', fontSize: '1rem', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' };

const GROUP_META = {
  A: { label: '🟢 A Group', color: '#38a169' },
  B: { label: '🔵 B Group', color: '#3182ce' },
  C: { label: '🟠 C Group', color: '#dd6b20' },
};

const wrap = (children) => (
  <div style={{ backgroundColor: '#f8f9fa', minHeight: '100vh', padding: '1rem' }}>
    <div style={{ maxWidth: '800px', margin: '0 auto' }}>{children}</div>
  </div>
);

const GradHeader = ({ emoji = '🐍', title = 'Word Snake', subtitle = null, small = false }) => (
  <div style={{ background: gradientBg, borderRadius: '12px', padding: small ? '1.5rem 2rem' : '3rem 2rem', marginBottom: '1rem', textAlign: 'center', color: 'white' }}>
    <div style={{ fontSize: small ? '1.5rem' : '3rem' }}>{emoji}</div>
    <h1 style={{ margin: '0.25rem 0 0', fontSize: small ? '1.6rem' : '2.8rem', fontWeight: 800 }}>{title}</h1>
    {subtitle && <p style={{ margin: '0.5rem 0 0', opacity: 0.9, fontSize: '1rem' }}>{subtitle}</p>}
  </div>
);

// ─── Main ─────────────────────────────────────────────────────────────────────
export default function WordSnake({ user }) {
  const [profile, setProfile]   = useState(null);
  const [screen, setScreen]     = useState('home');
  const [mode, setMode]         = useState(null);
  const [cats, setCats]         = useState([]);
  const [cat, setCat]           = useState(null);

  const [isHost, setIsHost]             = useState(false);
  const [roomCode, setRoomCode]         = useState('');
  const [codeInput, setCodeInput]       = useState('');
  const [lobbyPlayers, setLobbyPlayers] = useState([]);
  const [lobbyError, setLobbyError]     = useState('');
  const [lobbyDur, setLobbyDur]         = useState(60);
  const [oppScore, setOppScore]         = useState(null);
  const [oppName, setOppName]           = useState('');
  const [duration, setDuration]         = useState(SOLO_DURATION);

  const [chain, setChain]       = useState([]);
  const [myScore, setMyScore]   = useState(0);
  const [timeLeft, setTimeLeft] = useState(SOLO_DURATION);
  const [input, setInput]       = useState('');
  const [feedback, setFeedback] = useState(null);
  const [gameOver, setGameOver] = useState(false);
  const [checking, setChecking] = useState(false);
  const [leaderboard, setLeaderboard] = useState({ A: [], B: [], C: [] });

  const timerRef    = useRef(null);
  const inputRef    = useRef(null);
  const chainEndRef = useRef(null);
  const chainRef    = useRef([]);
  const myScoreRef  = useRef(0);
  const screenRef   = useRef('home');
  const isHostRef   = useRef(false);
  const modeRef     = useRef(null);
  const subRef      = useRef(null);
  const roomCodeRef = useRef('');
  const durRef      = useRef(SOLO_DURATION);

  useEffect(() => { chainRef.current    = chain;    }, [chain]);
  useEffect(() => { myScoreRef.current  = myScore;  }, [myScore]);
  useEffect(() => { screenRef.current   = screen;   }, [screen]);
  useEffect(() => { isHostRef.current   = isHost;   }, [isHost]);
  useEffect(() => { modeRef.current     = mode;     }, [mode]);
  useEffect(() => { roomCodeRef.current = roomCode; }, [roomCode]);
  useEffect(() => { durRef.current      = duration; }, [duration]);

  useEffect(() => {
    if (!user) return;
    supabase.from('profiles').select('*').eq('id', user.id).single()
      .then(({ data }) => { if (data) setProfile(data); });
  }, [user]);

  useEffect(() => {
    supabase.from('word_snake_categories').select('*').order('sort_order')
      .then(({ data }) => { if (data) setCats(data); });
  }, []);

  useEffect(() => { chainEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [chain.length]);

  useEffect(() => {
    if (!chain.some(w => w.valid === false)) return;
    const t = setTimeout(() => setChain(prev => prev.filter(w => w.valid !== false)), 1800);
    return () => clearTimeout(t);
  }, [chain]);

  useEffect(() => () => {
    clearInterval(timerRef.current);
    if (subRef.current) supabase.removeChannel(subRef.current);
  }, []);

  // ── pick random category ──────────────────────────────────────────────────
  const pickRandom = useCallback((currentCat) => {
    const visible = cats.filter(c => catVisible(c, profile?.tracks));
    if (!visible.length) return;
    const pool = visible.filter(c => c.id !== currentCat?.id);
    const picked = pool.length ? pool[Math.floor(Math.random() * pool.length)] : visible[0];
    setCat(picked);
  }, [cats, profile]);

  // ── timer ─────────────────────────────────────────────────────────────────
  const startTimer = useCallback((seconds) => {
    setDuration(seconds);
    setTimeLeft(seconds);
    clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) { clearInterval(timerRef.current); setGameOver(true); return 0; }
        return prev - 1;
      });
    }, 1000);
  }, []);

  // ── fetch leaderboard ─────────────────────────────────────────────────────
  const fetchLeaderboard = useCallback(async (catId) => {
    const { data } = await supabase.from('word_snake_leaderboard')
      .select('initials, best_score, level_group, student_id')
      .eq('category_id', catId).order('best_score', { ascending: false }).limit(60);
    if (!data) return;
    const g = { A: [], B: [], C: [] };
    data.forEach(r => { if (g[r.level_group]) g[r.level_group].push(r); });
    Object.keys(g).forEach(k => { g[k] = g[k].slice(0, 10); });
    setLeaderboard(g);
  }, []);

  // ── game over ─────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!gameOver || screenRef.current !== 'game') return;
    clearInterval(timerRef.current);

    (async () => {
      const finalScore = myScoreRef.current;
      const finalChain = chainRef.current.filter(w => w.valid !== false);
      if (!cat) return;

      await supabase.from('word_snake_sessions').insert({
        student_id:   user.id,
        category_id:  cat.id,
        mode:         modeRef.current || 'solo',
        score:        finalScore,
        chain_length: finalChain.length,
        chain:        JSON.stringify(finalChain.map(w => w.word)),
      });

      const initials   = mkInit(profile?.full_name);
      const levelGroup = lvlGroup(profile?.level);
      const { data: ex } = await supabase.from('word_snake_leaderboard')
        .select('best_score').eq('student_id', user.id).eq('category_id', cat.id).maybeSingle();

      if (!ex || finalScore > (ex.best_score || 0)) {
        await supabase.from('word_snake_leaderboard').upsert({
          student_id: user.id, category_id: cat.id,
          initials, best_score: finalScore, level_group: levelGroup,
          updated_at: new Date().toISOString(),
        }, { onConflict: 'student_id,category_id' });
      }

      await fetchLeaderboard(cat.id);
    })();

    const delay = modeRef.current === 'h2h' ? 2500 : 700;
    setTimeout(() => setScreen('results'), delay);
  }, [gameOver]); // eslint-disable-line

  // ── realtime ──────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!roomCode || !mode || mode === 'solo') return;

    const ch = supabase.channel(`snake-${roomCode}`)
      .on('postgres_changes', {
        event: 'UPDATE', schema: 'public',
        table: 'word_snake_rooms', filter: `room_code=eq.${roomCode}`,
      }, ({ new: room }) => {
        const state   = room.state || {};
        const players = state.players || {};
        setLobbyPlayers(Object.values(players));

        if (modeRef.current === 'h2h') {
          const opp = Object.values(players).find(p => p.id !== user.id);
          if (opp) { setOppScore(opp.score || 0); setOppName(opp.name || 'Opponent'); }
        }

        if (modeRef.current === 'class' && screenRef.current === 'game') {
          const serverChain = (state.chain || []).map(w => ({ ...w, pending: false }));
          setChain(serverChain);
          const me = players[user.id];
          if (me) setMyScore(me.score || 0);
        }

        if (room.status === 'active' && screenRef.current === 'lobby' && !isHostRef.current) {
          const dur     = room.duration_seconds || 60;
          const elapsed = Math.floor((Date.now() - new Date(room.started_at).getTime()) / 1000);
          const rem     = Math.max(1, dur - elapsed);
          setScreen('game');
          setGameOver(false);
          setChain([]);
          setMyScore(0);
          startTimer(rem);
          setTimeout(() => inputRef.current?.focus(), 300);
        }

        if (room.status === 'finished' && !gameOver) setGameOver(true);
      })
      .subscribe();

    subRef.current = ch;
    return () => { supabase.removeChannel(ch); };
  }, [roomCode, mode]); // eslint-disable-line

  // ── room actions ──────────────────────────────────────────────────────────
  const createRoom = async (m) => {
    const code = randCode();
    const me   = { id: user.id, name: profile?.full_name || 'Host', initials: mkInit(profile?.full_name), score: 0, level_group: lvlGroup(profile?.level) };
    const state = { players: { [user.id]: me }, ...(m === 'class' ? { chain: [] } : {}) };

    const { error } = await supabase.from('word_snake_rooms').insert({
      room_code: code, category_id: cat.id, mode: m, host_id: user.id,
      status: 'waiting', duration_seconds: lobbyDur, state,
    });
    if (error) { setLobbyError('Could not create room — try again'); return; }

    setRoomCode(code);
    setIsHost(true);
    setLobbyPlayers([me]);
    setMode(m);
  };

  const joinRoom = async () => {
    setLobbyError('');
    const code = codeInput.trim();
    if (code.length !== 4) { setLobbyError('Enter a 4-digit code'); return; }

    const { data: room } = await supabase.from('word_snake_rooms')
      .select('*').eq('room_code', code).eq('status', 'waiting').maybeSingle();
    if (!room) { setLobbyError('Room not found or already started'); return; }

    const me    = { id: user.id, name: profile?.full_name || 'Student', initials: mkInit(profile?.full_name), score: 0, level_group: lvlGroup(profile?.level) };
    const state = { ...room.state, players: { ...room.state.players, [user.id]: me } };
    await supabase.from('word_snake_rooms').update({ state }).eq('room_code', code);

    const foundCat = cats.find(c => c.id === room.category_id);
    if (foundCat) setCat(foundCat);
    setMode(room.mode);
    setRoomCode(code);
    setIsHost(false);
    setLobbyPlayers(Object.values(state.players));
    setScreen('lobby');
  };

  const hostStart = async () => {
    const now = new Date().toISOString();
    setScreen('game');
    setGameOver(false);
    setChain([]);
    setMyScore(0);
    startTimer(lobbyDur);
    setTimeout(() => inputRef.current?.focus(), 300);
    await supabase.from('word_snake_rooms').update({
      status: 'active', started_at: now, duration_seconds: lobbyDur,
    }).eq('room_code', roomCode);
  };

  // ── start solo ────────────────────────────────────────────────────────────
  const startGame = useCallback(() => {
    setChain([]);
    setMyScore(0);
    setFeedback(null);
    setGameOver(false);
    setLeaderboard({ A: [], B: [], C: [] });
    setScreen('game');
    startTimer(SOLO_DURATION);
    setTimeout(() => inputRef.current?.focus(), 300);
  }, [startTimer]);

  // ── submit word ───────────────────────────────────────────────────────────
  const submitWord = useCallback(async () => {
    const word = input.trim().toLowerCase();
    if (!word || !cat || gameOver || checking) return;

    const valid = chainRef.current.filter(w => w.valid !== false && !w.pending);
    const last  = valid[valid.length - 1];

    if (last) {
      const need  = lastChar(last.word);
      const given = firstChar(word);
      if (need !== given) {
        playSound('fail');
        setFeedback({ ok: false, word, reason: `Must start with "${need.toUpperCase()}"` });
        setInput('');
        inputRef.current?.focus();
        return;
      }
    }

    if (valid.some(w => w.word === word)) {
      playSound('fail');
      setFeedback({ ok: false, word, reason: 'Already used!' });
      setInput('');
      inputRef.current?.focus();
      return;
    }

    setInput('');
    const pending = { word, playerId: user.id, playerName: profile?.full_name || 'You', pending: true, valid: null, score: 0 };
    const curMode = modeRef.current;

    if (curMode !== 'class') setChain(prev => [...prev, pending]);
    else setChecking(true);

    try {
      const res    = await fetch('/api/validate-word-snake', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ word, category_name: cat.name, ai_prompt: cat.ai_prompt }),
      });
      const result = await res.json();

      if (result.valid) {
        const newLen = valid.length + 1;
        const pts    = wordScore(word, newLen);
        const entry  = { word, playerId: user.id, playerName: profile?.full_name || 'You', valid: true, pending: false, score: pts };
        const isMile = MILESTONES.includes(newLen);
        const isLong = stripped(word) >= LONG_MIN;

        if (curMode === 'solo') {
          setChain(prev => prev.map(e => e === pending ? entry : e));
          setMyScore(prev => prev + pts);
          playSound(isMile ? 'milestone' : isLong ? 'bonus' : 'ok');
          setFeedback({ ok: true, word, pts, isLong, isMile });

        } else if (curMode === 'h2h') {
          setChain(prev => prev.map(e => e === pending ? entry : e));
          const newScore = myScoreRef.current + pts;
          setMyScore(newScore);
          playSound(isMile ? 'milestone' : isLong ? 'bonus' : 'ok');
          setFeedback({ ok: true, word, pts });
          const { data: row } = await supabase.from('word_snake_rooms').select('state').eq('room_code', roomCodeRef.current).single();
          if (row) {
            const ns = { ...row.state, players: { ...row.state.players, [user.id]: { ...(row.state.players?.[user.id] || {}), score: newScore } } };
            await supabase.from('word_snake_rooms').update({ state: ns }).eq('room_code', roomCodeRef.current);
          }

        } else if (curMode === 'class') {
          const serverChain = chainRef.current.filter(w => w.valid !== false);
          const { data: addResult } = await supabase.rpc('snake_add_word_to_class', {
            p_room_code:          roomCodeRef.current,
            p_expected_chain_len: serverChain.length,
            p_word_entry:         entry,
          });
          if (addResult?.success) {
            playSound(isMile ? 'milestone' : isLong ? 'bonus' : 'ok');
            setFeedback({ ok: true, word, pts });
          } else {
            playSound('fail');
            setFeedback({ ok: false, word, reason: addResult?.reason === 'chain_changed' ? 'Someone was faster — try again!' : 'Could not add word' });
          }
        }

      } else {
        if (curMode !== 'class') setChain(prev => prev.map(e => e === pending ? { ...e, pending: false, valid: false } : e));
        playSound('fail');
        setFeedback({ ok: false, word, reason: result.reason || 'Not in this category' });
      }
    } catch {
      if (curMode !== 'class') setChain(prev => prev.map(e => e === pending ? { ...e, pending: false, valid: false } : e));
      playSound('fail');
      setFeedback({ ok: false, word, reason: 'Could not validate — try again' });
    } finally {
      setChecking(false);
      inputRef.current?.focus();
    }
  }, [input, cat, gameOver, checking, user.id, profile]);

  const onKey = (e) => { if (e.key === 'Enter') submitWord(); };

  const reset = () => {
    clearInterval(timerRef.current);
    if (subRef.current) { supabase.removeChannel(subRef.current); subRef.current = null; }
    setScreen('home'); setMode(null); setCat(null);
    setChain([]); setMyScore(0); setFeedback(null); setGameOver(false);
    setLeaderboard({ A: [], B: [], C: [] });
    setRoomCode(''); setCodeInput(''); setIsHost(false); setLobbyPlayers([]);
    setOppScore(null); setOppName(''); setLobbyError('');
  };

  const validChain = chain.filter(w => w.valid !== false);
  const lastWord   = validChain[validChain.length - 1];
  const nextLetter = lastWord ? lastChar(lastWord.word).toUpperCase() : null;
  const timerPct   = (timeLeft / (duration || SOLO_DURATION)) * 100;
  const timerColor = timeLeft <= 10 ? '#e53e3e' : timeLeft <= 20 ? '#dd6b20' : '#38a169';

  // chip styles (for chain)
  const chipStyle = (valid, pending) => ({
    display: 'inline-flex', alignItems: 'center', gap: 5,
    padding: '5px 12px', borderRadius: 20, fontSize: 14, fontWeight: 600,
    background: pending ? '#f7fafc' : valid === false ? '#fff5f5' : '#f0fff4',
    color:      pending ? '#a0aec0' : valid === false ? '#c53030'  : '#276749',
    border: `2px solid ${pending ? '#e2e8f0' : valid === false ? '#fed7d7' : '#68d391'}`,
    textDecoration: valid === false ? 'line-through' : 'none',
    opacity: pending ? 0.7 : 1, transition: 'all 0.2s',
  });

  // ─────────────────────────────── HOME ─────────────────────────────────────
  if (screen === 'home') return wrap(
    <>
      <GradHeader subtitle="Chain words — each one starts with the last letter of the previous" />
      <div style={{ ...card, textAlign: 'center', padding: '2rem' }}>
        <p style={{ color: '#718096', marginBottom: '2rem', fontSize: '0.95rem', lineHeight: 1.6 }}>
          Choose a mode, then we'll pick a random topic.<br />
          Type as fast as you can before time runs out!
        </p>
        {[
          { id: 'solo',  emoji: '🎯', label: 'Solo',         desc: '60 seconds — build the longest chain you can' },
          { id: 'h2h',   emoji: '⚔️', label: 'Head to Head', desc: 'Race a friend simultaneously — highest score wins' },
          { id: 'class', emoji: '👥', label: 'Class Mode',    desc: "Shared chain — who's quickest to grab the next word?" },
        ].map(m => (
          <button key={m.id}
            onClick={() => {
              setMode(m.id);
              setCat(null);
              pickRandom(null);
              setScreen('reveal');
            }}
            style={{ display: 'flex', alignItems: 'center', gap: 14, background: 'white', border: '2px solid #e2e8f0', borderRadius: 12, padding: '0.9rem 1.1rem', width: '100%', marginBottom: '0.6rem', textAlign: 'left', cursor: 'pointer' }}>
            <span style={{ fontSize: 28 }}>{m.emoji}</span>
            <div>
              <div style={{ fontSize: 16, fontWeight: 700, color: '#2d3748' }}>{m.label}</div>
              <div style={{ fontSize: 13, color: '#718096', fontWeight: 400, marginTop: 2 }}>{m.desc}</div>
            </div>
          </button>
        ))}
      </div>

      <div style={card}>
        <h3 style={{ margin: '0 0 0.75rem', color: '#2d3748', fontSize: 16 }}>Join a game with a code</h3>
        <div style={{ display: 'flex', gap: 8 }}>
          <input value={codeInput} onChange={e => setCodeInput(e.target.value.replace(/\D/g,'').slice(0,4))}
            placeholder="Room code" maxLength={4}
            style={{ flex: 1, padding: '0.75rem', border: '2px solid #e2e8f0', borderRadius: 10, fontSize: 22, textAlign: 'center', letterSpacing: 6, fontWeight: 800, outline: 'none' }} />
          <button onClick={joinRoom} style={btnPrimary}>Join</button>
        </div>
        {lobbyError && <div style={{ color: '#e53e3e', marginTop: 8, fontSize: 14 }}>{lobbyError}</div>}
      </div>

      <div style={card}>
        <h3 style={{ margin: '0 0 0.5rem', color: '#2d3748', fontSize: 16 }}>How to score</h3>
        <div style={{ color: '#4a5568', fontSize: 14, lineHeight: 1.8 }}>
          +1 point per valid word · +1 bonus for 7+ letters · +2 milestone bonus at 10, 20 and 30 words<br />
          Invalid words play a sound but don't break the chain — just keep going!
        </div>
      </div>
    </>
  );

  // ─────────────────────────────── REVEAL ───────────────────────────────────
  if (screen === 'reveal') return wrap(
    <>
      <GradHeader small />
      <div style={{ ...card, textAlign: 'center', padding: '2.5rem 2rem' }}>
        <div style={{ fontSize: '0.72rem', fontWeight: 700, color: '#a0aec0', textTransform: 'uppercase', letterSpacing: 2, marginBottom: '1rem' }}>
          Your topic is...
        </div>
        <div style={{ fontSize: '2.2rem', fontWeight: 800, color: '#2d3748', lineHeight: 1.25, marginBottom: '0.75rem' }}>
          {cat ? cat.name : 'Loading...'}
        </div>
        {cat?.description && (
          <p style={{ color: '#718096', fontSize: '0.92rem', margin: '0 0 1rem' }}>{cat.description}</p>
        )}
        <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'center', flexWrap: 'wrap', marginTop: '1.5rem' }}>
          <button onClick={() => pickRandom(cat)} style={btnSecondary}>🎲 Different Topic</button>
          <button
            onClick={() => {
              if (mode === 'solo') {
                startGame();
              } else {
                setLobbyError('');
                setScreen('lobby');
              }
            }}
            style={{ ...btnPrimary, fontSize: '1.1rem', padding: '0.875rem 2rem' }}
          >
            Go! ▶
          </button>
        </div>
      </div>
    </>
  );

  // ─────────────────────────────── LOBBY ────────────────────────────────────
  if (screen === 'lobby') return wrap(
    <>
      <GradHeader small title={mode === 'h2h' ? 'Head to Head' : 'Class Mode'} subtitle={cat?.name} />

      {!roomCode && (
        <div style={card}>
          {mode === 'class' && (
            <div style={{ marginBottom: '1rem' }}>
              <div style={{ fontSize: 13, color: '#4a5568', marginBottom: 8, fontWeight: 600 }}>Duration</div>
              <div style={{ display: 'flex', gap: 8 }}>
                {[30, 60, 90, 120].map(d => (
                  <button key={d} onClick={() => setLobbyDur(d)}
                    style={lobbyDur === d ? btnPrimary : btnSecondary}>
                    {d}s
                  </button>
                ))}
              </div>
            </div>
          )}
          <button onClick={() => createRoom(mode)} style={{ ...btnPrimary, width: '100%', fontSize: 16, padding: '0.85rem' }}>Create room</button>
          <div style={{ textAlign: 'center', color: '#718096', fontSize: 13, margin: '0.75rem 0' }}>or join with a code</div>
          <div style={{ display: 'flex', gap: 8 }}>
            <input value={codeInput} onChange={e => setCodeInput(e.target.value.replace(/\D/g,'').slice(0,4))}
              placeholder="Room code" maxLength={4}
              style={{ flex: 1, padding: '0.75rem', border: '2px solid #e2e8f0', borderRadius: 10, fontSize: 22, textAlign: 'center', letterSpacing: 6, fontWeight: 800, outline: 'none' }} />
            <button onClick={joinRoom} style={btnPrimary}>Join</button>
          </div>
          {lobbyError && <div style={{ color: '#e53e3e', marginTop: 8, fontSize: 14 }}>{lobbyError}</div>}
        </div>
      )}

      {roomCode && (<>
        <div style={{ ...card, textAlign: 'center', padding: '1.25rem' }}>
          <div style={{ fontSize: 13, color: '#718096', marginBottom: 6 }}>Share this code</div>
          <div style={{ fontSize: 56, fontWeight: 900, letterSpacing: 14, background: gradientBg, WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', lineHeight: 1 }}>{roomCode}</div>
        </div>
        <div style={card}>
          <div style={{ fontWeight: 700, color: '#2d3748', marginBottom: 10, fontSize: 15 }}>Players — {lobbyPlayers.length}</div>
          {lobbyPlayers.length === 0
            ? <div style={{ color: '#718096', fontSize: 14 }}>Waiting for players to join...</div>
            : lobbyPlayers.map((p, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                <div style={{ width: 34, height: 34, borderRadius: '50%', background: gradientBg, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 13, flexShrink: 0 }}>{p.initials || '?'}</div>
                <span style={{ fontSize: 15 }}>{p.name}</span>
              </div>
            ))
          }
        </div>
        {isHost && (
          mode === 'h2h'
            ? lobbyPlayers.length >= 2
              ? <button onClick={hostStart} style={{ ...btnPrimary, width: '100%', fontSize: 17, padding: '0.9rem' }}>Start ▶</button>
              : <div style={{ ...card, textAlign: 'center', color: '#718096', fontSize: 15 }}>Waiting for your opponent to join...</div>
            : <button onClick={hostStart} disabled={lobbyPlayers.length < 2}
                style={{ ...btnPrimary, width: '100%', fontSize: 17, padding: '0.9rem', opacity: lobbyPlayers.length < 2 ? 0.5 : 1 }}>
                {lobbyPlayers.length < 2 ? 'Waiting for students...' : `Start class (${lobbyPlayers.length} players) ▶`}
              </button>
        )}
        {!isHost && <div style={{ ...card, textAlign: 'center', color: '#718096', fontSize: 15 }}>⏳ Waiting for the host to start...</div>}
      </>)}

      <button onClick={() => setScreen('reveal')} style={{ ...btnSecondary, marginTop: 8 }}>← Back</button>
    </>
  );

  // ─────────────────────────────── GAME ─────────────────────────────────────
  if (screen === 'game') return (
    <div style={{ backgroundColor: '#f8f9fa', minHeight: '100vh', padding: '1rem' }}>
      <div style={{ maxWidth: '800px', margin: '0 auto' }}>

        {/* Header */}
        <div style={{ background: gradientBg, borderRadius: '12px', padding: '1.25rem 1.5rem 0.75rem', marginBottom: '1rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
            <div>
              <div style={{ color: 'rgba(255,255,255,0.75)', fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: 1, marginBottom: '0.2rem' }}>
                🐍 {cat?.name}
              </div>
              <div style={{ color: 'white', fontWeight: 900, fontSize: '2rem', lineHeight: 1 }}>
                {myScore} <span style={{ fontSize: '1rem', fontWeight: 400, opacity: 0.8 }}>pts</span>
              </div>
              <div style={{ color: 'rgba(255,255,255,0.7)', fontSize: '0.75rem', marginTop: 2 }}>
                {validChain.length} word{validChain.length !== 1 ? 's' : ''}
              </div>
            </div>

            {mode === 'h2h' && oppName && (
              <div style={{ textAlign: 'center', color: 'white', opacity: 0.9 }}>
                <div style={{ fontSize: 11, opacity: 0.8 }}>{oppName.split(' ')[0]}</div>
                <div style={{ fontSize: 22, fontWeight: 700 }}>{oppScore ?? '–'}</div>
              </div>
            )}

            {/* Circle timer — Word Snake style */}
            <div style={{ width: 68, height: 68, borderRadius: '50%', border: `4px solid ${timerColor}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, fontWeight: 900, color: timerColor, background: 'rgba(255,255,255,0.15)', flexShrink: 0, transition: 'color 0.3s, border-color 0.3s' }}>
              {timeLeft}
            </div>
          </div>

          {/* Progress bar */}
          <div style={{ height: '4px', backgroundColor: 'rgba(255,255,255,0.25)', borderRadius: '2px', overflow: 'hidden' }}>
            <div style={{ height: '100%', width: `${timerPct}%`, backgroundColor: 'white', borderRadius: '2px', transition: 'width 1s linear' }} />
          </div>
        </div>

        {/* Class scoreboard */}
        {mode === 'class' && lobbyPlayers.length > 0 && (
          <div style={{ ...card, padding: '0.7rem 1rem' }}>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
              {[...lobbyPlayers].sort((a, b) => (b.score || 0) - (a.score || 0)).map((p, i) => (
                <span key={i} style={{ fontSize: 14, fontWeight: 700, color: p.id === user.id ? '#667eea' : '#4a5568' }}>
                  {p.initials}: {p.score || 0}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Next letter prompt */}
        <div style={{ ...card, padding: '0.75rem 1rem', background: '#f0f0ff', border: '2px solid #c3c9f8', textAlign: 'center' }}>
          {nextLetter
            ? <span style={{ color: '#764ba2', fontSize: 16 }}>Next word must start with <strong style={{ fontSize: 26 }}>{nextLetter}</strong></span>
            : <span style={{ color: '#764ba2', fontSize: 14 }}>👆 Type any word in the topic to start the chain</span>
          }
        </div>

        {/* Feedback */}
        {feedback && (
          <div style={{ ...card, padding: '0.7rem 1rem', background: feedback.ok ? '#f0fff4' : '#fff5f5', border: `1px solid ${feedback.ok ? '#9ae6b4' : '#feb2b2'}`, color: feedback.ok ? '#276749' : '#c53030', fontSize: 14 }}>
            {feedback.ok
              ? <span>✅ <strong>{feedback.word}</strong> +{feedback.pts}pt{feedback.pts !== 1 ? 's' : ''}{feedback.isMile ? ' 🎉 milestone!' : feedback.isLong ? ' 🔥 long word bonus!' : ''}</span>
              : <span>❌ <strong>{feedback.word}</strong> — {feedback.reason}</span>
            }
          </div>
        )}

        {/* Chain */}
        <div style={{ ...card, maxHeight: 240, overflowY: 'auto', padding: '1rem' }}>
          {chain.length === 0
            ? <div style={{ color: '#a0aec0', textAlign: 'center', fontSize: 14 }}>Your chain will appear here...</div>
            : <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7 }}>
                {chain.map((entry, i) => (
                  <div key={i} style={chipStyle(entry.valid, entry.pending)}>
                    {entry.pending && <span style={{ fontSize: 11 }}>⏳</span>}
                    {mode === 'class' && entry.playerId !== user.id && (
                      <span style={{ fontSize: 11, opacity: 0.65 }}>{(entry.playerName || '?').split(' ')[0]}:</span>
                    )}
                    {entry.word}
                    {entry.score > 1 && entry.valid === true && (
                      <span style={{ fontSize: 11, opacity: 0.7 }}>+{entry.score}</span>
                    )}
                  </div>
                ))}
                <div ref={chainEndRef} />
              </div>
          }
        </div>

        {/* Input */}
        {!gameOver ? (
          <div style={{ ...card, padding: '1.25rem' }}>
            <div style={{ display: 'flex', gap: 8 }}>
              <input ref={inputRef} value={input} onChange={e => setInput(e.target.value)} onKeyDown={onKey}
                placeholder={nextLetter ? `Word starting with ${nextLetter}…` : 'Type a word…'}
                disabled={checking} autoFocus autoComplete="off" autoCapitalize="none" spellCheck={false}
                style={{ flex: 1, padding: '0.7rem 1rem', border: `2px solid ${nextLetter ? '#c3c9f8' : '#e2e8f0'}`, borderRadius: 8, fontSize: 18, outline: 'none', background: checking ? '#f7fafc' : '#fff', fontFamily: 'inherit' }} />
              <button onClick={submitWord} disabled={!input.trim() || checking}
                style={{ background: !input.trim() || checking ? '#cbd5e0' : gradientBg, color: 'white', border: 'none', borderRadius: 8, padding: '0.7rem 1.1rem', fontSize: '1.3rem', cursor: 'pointer', fontWeight: 700 }}>
                +
              </button>
            </div>
            {checking && <div style={{ fontSize: 13, color: '#718096', marginTop: 6 }}>Checking...</div>}
          </div>
        ) : (
          <div style={{ ...card, textAlign: 'center', background: '#f0f0ff' }}>
            <div style={{ fontSize: 28, marginBottom: 8 }}>⏱️ Time's up!</div>
            <div style={{ fontSize: 24, fontWeight: 800, color: '#764ba2' }}>{myScore} pts</div>
            <div style={{ fontSize: 14, color: '#4a5568', marginTop: 4 }}>{validChain.length} words</div>
          </div>
        )}
      </div>
    </div>
  );

  // ─────────────────────────────── RESULTS ──────────────────────────────────
  if (screen === 'results') {
    const finalChain = chain.filter(w => w.valid !== false);
    const won  = mode === 'h2h' && oppScore !== null && myScore > oppScore;
    const lost = mode === 'h2h' && oppScore !== null && myScore < oppScore;
    const hasLb = leaderboard.A.length > 0 || leaderboard.B.length > 0 || leaderboard.C.length > 0;

    return wrap(
      <>
        {/* Score header */}
        <div style={{ background: gradientBg, borderRadius: '12px', padding: '2rem', marginBottom: '1rem', textAlign: 'center', color: 'white' }}>
          <div style={{ fontSize: '0.78rem', textTransform: 'uppercase', letterSpacing: 1, opacity: 0.8, marginBottom: '0.5rem' }}>{cat?.name}</div>
          <div style={{ fontSize: '4.5rem', fontWeight: 900, lineHeight: 1 }}>{myScore}</div>
          <div style={{ fontSize: '0.88rem', opacity: 0.85, marginTop: '0.4rem' }}>
            {finalChain.length} word{finalChain.length !== 1 ? 's' : ''}
          </div>
          {mode === 'h2h' && oppName && (
            <div style={{ marginTop: 14, padding: '0.9rem', background: 'rgba(255,255,255,0.15)', borderRadius: 10 }}>
              <div style={{ fontSize: 13, opacity: 0.8, marginBottom: 4 }}>{oppName}</div>
              <div style={{ fontSize: 26, fontWeight: 700 }}>{oppScore ?? '?'}</div>
              {won  && <div style={{ fontSize: 18, marginTop: 6, fontWeight: 700 }}>🏆 You won!</div>}
              {lost && <div style={{ fontSize: 16, marginTop: 6 }}>Better luck next time!</div>}
              {!won && !lost && oppScore !== null && <div style={{ fontSize: 16, marginTop: 6 }}>🤝 Draw!</div>}
            </div>
          )}
        </div>

        {/* Chain */}
        {finalChain.length > 0 && (
          <div style={card}>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {finalChain.map((w, i) => (
                <span key={i} style={{ ...chipStyle(true, false), fontSize: 13 }}>
                  {w.word}
                  {i < finalChain.length - 1 && <span style={{ color: '#9ae6b4', marginLeft: 3, fontSize: 11 }}>›</span>}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Leaderboard — 3 column A/B/C */}
        {hasLb && (
          <div style={card}>
            <div style={{ fontWeight: 700, fontSize: '1rem', color: '#2d3748', marginBottom: '1rem' }}>🏆 {cat?.name} — Leaderboard</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1rem' }}>
              {['A', 'B', 'C'].map(g => (
                <div key={g}>
                  <div style={{ fontSize: '0.7rem', fontWeight: 700, letterSpacing: 1, color: GROUP_META[g].color, marginBottom: '0.5rem', paddingBottom: '0.3rem', borderBottom: `2px solid ${GROUP_META[g].color}` }}>
                    {GROUP_META[g].label}
                  </div>
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
        )}

        {/* Buttons */}
        <div style={{ display: 'flex', gap: '0.75rem' }}>
          <button onClick={reset} style={{ ...btnSecondary, flex: 1 }}>🏠 Home</button>
          <button onClick={() => {
            setChain([]); setMyScore(0); setFeedback(null); setGameOver(false);
            setLeaderboard({ A: [], B: [], C: [] });
            setScreen('game');
            startTimer(SOLO_DURATION);
            setTimeout(() => inputRef.current?.focus(), 300);
          }} style={{ ...btnSecondary, flex: 1 }}>🔄 Same</button>
          <button onClick={() => { pickRandom(cat); setScreen('reveal'); }} style={{ ...btnPrimary, flex: 1 }}>🎲 New Topic</button>
        </div>
      </>
    );
  }

  return null;
}
