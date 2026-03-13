import { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from './supabaseClient';

// ─── Sound ────────────────────────────────────────────────────────────────────
function beep(type) {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.connect(g);
    g.connect(ctx.destination);
    if (type === 'ok') {
      o.type = 'sine'; o.frequency.value = 660;
      g.gain.setValueAtTime(0.12, ctx.currentTime);
      g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.18);
      o.start(); o.stop(ctx.currentTime + 0.18);
    } else if (type === 'bonus') {
      o.type = 'sine';
      o.frequency.setValueAtTime(660, ctx.currentTime);
      o.frequency.linearRampToValueAtTime(990, ctx.currentTime + 0.2);
      g.gain.setValueAtTime(0.14, ctx.currentTime);
      g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.28);
      o.start(); o.stop(ctx.currentTime + 0.28);
    } else if (type === 'milestone') {
      [0, 0.1, 0.2].forEach((delay, i) => {
        const o2 = ctx.createOscillator(); const g2 = ctx.createGain();
        o2.connect(g2); g2.connect(ctx.destination);
        o2.type = 'sine'; o2.frequency.value = 550 + i * 165;
        g2.gain.setValueAtTime(0.13, ctx.currentTime + delay);
        g2.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + delay + 0.18);
        o2.start(ctx.currentTime + delay); o2.stop(ctx.currentTime + delay + 0.2);
      });
    } else if (type === 'fail') {
      o.type = 'sawtooth'; o.frequency.value = 200;
      g.gain.setValueAtTime(0.1, ctx.currentTime);
      g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.22);
      o.start(); o.stop(ctx.currentTime + 0.22);
    }
  } catch (_) { /* audio blocked */ }
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
const fmtTime   = (s) => { const m = Math.floor(s / 60); return m > 0 ? `${m}:${String(s % 60).padStart(2, '0')}` : String(s); };

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

// ─── Colours ──────────────────────────────────────────────────────────────────
const C = {
  grad:    'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
  primary: '#667eea',
  dark:    '#764ba2',
  light:   '#f0f0ff',
  border:  '#c3c9f8',
  chip:    '#e8eaff',
  chipTxt: '#4c51bf',
};

// ─── Main ─────────────────────────────────────────────────────────────────────
export default function WordSnake({ user }) {
  const [profile, setProfile]   = useState(null);
  const [screen, setScreen]     = useState('menu');
  const [mode, setMode]         = useState(null);
  const [cats, setCats]         = useState([]);
  const [cat, setCat]           = useState(null);

  const [isHost, setIsHost]               = useState(false);
  const [roomCode, setRoomCode]           = useState('');
  const [codeInput, setCodeInput]         = useState('');
  const [lobbyPlayers, setLobbyPlayers]   = useState([]);
  const [lobbyError, setLobbyError]       = useState('');
  const [lobbyDur, setLobbyDur]           = useState(60);
  const [oppScore, setOppScore]           = useState(null);
  const [oppName, setOppName]             = useState('');

  const [chain, setChain]       = useState([]);
  const [myScore, setMyScore]   = useState(0);
  const [timeLeft, setTimeLeft] = useState(SOLO_DURATION);
  const [input, setInput]       = useState('');
  const [feedback, setFeedback] = useState(null);
  const [gameOver, setGameOver] = useState(false);
  const [checking, setChecking] = useState(false);
  const [lb, setLb]             = useState([]);

  const timerRef    = useRef(null);
  const inputRef    = useRef(null);
  const chainEndRef = useRef(null);
  const chainRef    = useRef([]);
  const myScoreRef  = useRef(0);
  const screenRef   = useRef('menu');
  const isHostRef   = useRef(false);
  const modeRef     = useRef(null);
  const subRef      = useRef(null);
  const roomCodeRef = useRef('');

  useEffect(() => { chainRef.current    = chain;    }, [chain]);
  useEffect(() => { myScoreRef.current  = myScore;  }, [myScore]);
  useEffect(() => { screenRef.current   = screen;   }, [screen]);
  useEffect(() => { isHostRef.current   = isHost;   }, [isHost]);
  useEffect(() => { modeRef.current     = mode;     }, [mode]);
  useEffect(() => { roomCodeRef.current = roomCode; }, [roomCode]);

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

  const startTimer = useCallback((seconds) => {
    setTimeLeft(seconds);
    clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) { clearInterval(timerRef.current); setGameOver(true); return 0; }
        return prev - 1;
      });
    }, 1000);
  }, []);

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

      const { data: lbData } = await supabase.from('word_snake_leaderboard')
        .select('initials, best_score, level_group')
        .eq('category_id', cat.id).order('best_score', { ascending: false }).limit(10);
      if (lbData) setLb(lbData);
    })();

    const delay = modeRef.current === 'h2h' ? 2500 : 700;
    setTimeout(() => setScreen('results'), delay);
  }, [gameOver]); // eslint-disable-line

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

  const startSolo = useCallback((selectedCat) => {
    const c = selectedCat || cat;
    setCat(c);
    setMode('solo');
    setChain([]);
    setMyScore(0);
    setFeedback(null);
    setGameOver(false);
    setLb([]);
    setScreen('game');
    startTimer(SOLO_DURATION);
    setTimeout(() => inputRef.current?.focus(), 300);
  }, [cat, startTimer]);

  const submitWord = useCallback(async () => {
    const word = input.trim().toLowerCase();
    if (!word || !cat || gameOver || checking) return;

    const valid = chainRef.current.filter(w => w.valid !== false && !w.pending);
    const last  = valid[valid.length - 1];

    if (last) {
      const need  = lastChar(last.word);
      const given = firstChar(word);
      if (need !== given) {
        beep('fail');
        setFeedback({ ok: false, word, reason: `Must start with "${need.toUpperCase()}"` });
        setInput('');
        inputRef.current?.focus();
        return;
      }
    }

    if (valid.some(w => w.word === word)) {
      beep('fail');
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
          beep(isMile ? 'milestone' : isLong ? 'bonus' : 'ok');
          setFeedback({ ok: true, word, pts, isLong, isMile });

        } else if (curMode === 'h2h') {
          setChain(prev => prev.map(e => e === pending ? entry : e));
          const newScore = myScoreRef.current + pts;
          setMyScore(newScore);
          beep(isMile ? 'milestone' : isLong ? 'bonus' : 'ok');
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
            beep(isMile ? 'milestone' : isLong ? 'bonus' : 'ok');
            setFeedback({ ok: true, word, pts });
          } else {
            beep('fail');
            setFeedback({ ok: false, word, reason: addResult?.reason === 'chain_changed' ? 'Someone was faster — try again!' : 'Could not add word' });
          }
        }

      } else {
        if (curMode !== 'class') setChain(prev => prev.map(e => e === pending ? { ...e, pending: false, valid: false } : e));
        beep('fail');
        setFeedback({ ok: false, word, reason: result.reason || 'Not in this category' });
      }
    } catch {
      if (curMode !== 'class') setChain(prev => prev.map(e => e === pending ? { ...e, pending: false, valid: false } : e));
      beep('fail');
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
    setScreen('menu'); setMode(null); setCat(null);
    setChain([]); setMyScore(0); setFeedback(null); setGameOver(false); setLb([]);
    setRoomCode(''); setCodeInput(''); setIsHost(false); setLobbyPlayers([]);
    setOppScore(null); setOppName(''); setLobbyError('');
  };

  const validChain = chain.filter(w => w.valid !== false);
  const lastWord   = validChain[validChain.length - 1];
  const nextLetter = lastWord ? lastChar(lastWord.word).toUpperCase() : null;
  const visCats    = cats.filter(c => catVisible(c, profile?.tracks));
  const timerColor = timeLeft <= 10 ? '#e53e3e' : timeLeft <= 20 ? '#ed8936' : C.primary;

  const S = {
    page:  { backgroundColor: '#f8f9fa', minHeight: '100vh', padding: '1rem' },
    inner: { maxWidth: 700, margin: '0 auto' },
    head:  { background: C.grad, borderRadius: 12, padding: '2rem 2rem 1.5rem', color: '#fff', marginBottom: '1.25rem', textAlign: 'center' },
    card:  { background: '#fff', borderRadius: 12, padding: '1.5rem', boxShadow: '0 10px 40px rgba(0,0,0,0.12)', marginBottom: '1rem' },
    btn:   (bg = C.primary, col = '#fff', extra = {}) => ({ background: bg, color: col, border: 'none', borderRadius: 10, padding: '0.75rem 1.5rem', fontSize: 16, cursor: 'pointer', fontWeight: 600, ...extra }),
    chip:  (v, p) => ({
      display: 'inline-flex', alignItems: 'center', gap: 5, padding: '5px 12px',
      borderRadius: 20, fontSize: 14, fontWeight: 600,
      background: p ? '#e2e8f0' : v === false ? '#fed7d7' : C.chip,
      color:      p ? '#718096' : v === false ? '#c53030' : C.chipTxt,
      textDecoration: v === false ? 'line-through' : 'none',
      opacity: p ? 0.7 : 1, transition: 'all 0.2s',
    }),
  };

  if (screen === 'menu') return (
    <div style={S.page}><div style={S.inner}>
      <div style={S.head}>
        <div style={{ fontSize: 52 }}>🐍</div>
        <h1 style={{ margin: '0.4rem 0 0.25rem', fontSize: 30 }}>Word Snake</h1>
        <p style={{ margin: 0, opacity: 0.85, fontSize: 15 }}>Chain words where each one starts with the last letter of the previous</p>
      </div>

      <div style={S.card}>
        <h2 style={{ margin: '0 0 1rem', color: '#2d3748', fontSize: 18 }}>Choose a mode</h2>
        {[
          { id: 'solo',  emoji: '🎯', label: 'Solo',         desc: '60 seconds — build the longest chain you can' },
          { id: 'h2h',   emoji: '⚔️', label: 'Head to Head', desc: 'Race a friend simultaneously — highest score wins' },
          { id: 'class', emoji: '👥', label: 'Class Mode',    desc: "Shared chain — who's quickest to grab the next word?" },
        ].map(m => (
          <button key={m.id}
            onClick={() => { setMode(m.id); setScreen('categories'); }}
            style={{ ...S.btn('#fff', '#2d3748', { display: 'flex', alignItems: 'center', gap: 14, border: '2px solid #e2e8f0', borderRadius: 12, padding: '0.9rem 1.1rem', width: '100%', marginBottom: '0.6rem', textAlign: 'left' }) }}>
            <span style={{ fontSize: 28 }}>{m.emoji}</span>
            <div>
              <div style={{ fontSize: 16, fontWeight: 700 }}>{m.label}</div>
              <div style={{ fontSize: 13, color: '#718096', fontWeight: 400, marginTop: 2 }}>{m.desc}</div>
            </div>
          </button>
        ))}
      </div>

      <div style={S.card}>
        <h3 style={{ margin: '0 0 0.75rem', color: '#2d3748', fontSize: 16 }}>Join a game with a code</h3>
        <div style={{ display: 'flex', gap: 8 }}>
          <input value={codeInput} onChange={e => setCodeInput(e.target.value.replace(/\D/g,'').slice(0,4))}
            placeholder="Room code" maxLength={4}
            style={{ flex: 1, padding: '0.75rem', border: '2px solid #e2e8f0', borderRadius: 10, fontSize: 22, textAlign: 'center', letterSpacing: 6, fontWeight: 800, outline: 'none' }} />
          <button onClick={joinRoom} style={S.btn()}>Join</button>
        </div>
        {lobbyError && <div style={{ color: '#e53e3e', marginTop: 8, fontSize: 14 }}>{lobbyError}</div>}
      </div>

      <div style={S.card}>
        <h3 style={{ margin: '0 0 0.5rem', color: '#2d3748', fontSize: 16 }}>How to score</h3>
        <div style={{ color: '#4a5568', fontSize: 14, lineHeight: 1.8 }}>
          +1 point per valid word · +1 bonus for 7+ letters · +2 milestone bonus at 10, 20 and 30 words<br />
          Invalid words play a sound but don't break the chain — just keep going!
        </div>
      </div>
    </div></div>
  );

  if (screen === 'categories') return (
    <div style={S.page}><div style={S.inner}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: '1rem' }}>
        <button onClick={() => setScreen('menu')} style={S.btn('#e2e8f0', '#2d3748', { padding: '0.5rem 1rem', fontSize: 14 })}>← Back</button>
        <h2 style={{ margin: 0, color: '#2d3748', fontSize: 20 }}>Pick a topic</h2>
      </div>
      {visCats.length === 0 && <div style={S.card}>Loading...</div>}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(195px, 1fr))', gap: '0.7rem' }}>
        {visCats.map(c => (
          <button key={c.id}
            onClick={() => { setCat(c); if (mode === 'solo') startSolo(c); else { setLobbyError(''); setScreen('lobby'); } }}
            style={{ ...S.btn('#fff', '#2d3748', { padding: '0.9rem 1rem', textAlign: 'left', border: '2px solid #e2e8f0', borderRadius: 12, lineHeight: 1.4 }) }}>
            <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 4 }}>{c.name}</div>
            <div style={{ fontSize: 12, color: '#718096', fontWeight: 400 }}>{c.description}</div>
          </button>
        ))}
      </div>
    </div></div>
  );

  if (screen === 'lobby') return (
    <div style={S.page}><div style={S.inner}>
      <div style={S.head}>
        <div style={{ fontSize: 36 }}>🐍</div>
        <h2 style={{ margin: '0.4rem 0 0.2rem', fontSize: 22 }}>{mode === 'h2h' ? 'Head to Head' : 'Class Mode'}</h2>
        <div style={{ opacity: 0.85, fontSize: 14 }}>{cat?.name}</div>
      </div>

      {!roomCode && (
        <div style={S.card}>
          {mode === 'class' && (
            <div style={{ marginBottom: '1rem' }}>
              <div style={{ fontSize: 13, color: '#4a5568', marginBottom: 8, fontWeight: 600 }}>Duration</div>
              <div style={{ display: 'flex', gap: 8 }}>
                {[30, 60, 90, 120].map(d => (
                  <button key={d} onClick={() => setLobbyDur(d)}
                    style={S.btn(lobbyDur === d ? C.primary : '#e2e8f0', lobbyDur === d ? '#fff' : '#2d3748', { padding: '0.4rem 0.9rem', fontSize: 14 })}>
                    {d}s
                  </button>
                ))}
              </div>
            </div>
          )}
          <button onClick={() => createRoom(mode)} style={{ ...S.btn(), width: '100%', fontSize: 16, padding: '0.85rem' }}>Create room</button>
          <div style={{ textAlign: 'center', color: '#718096', fontSize: 13, margin: '0.75rem 0' }}>or join with a code</div>
          <div style={{ display: 'flex', gap: 8 }}>
            <input value={codeInput} onChange={e => setCodeInput(e.target.value.replace(/\D/g,'').slice(0,4))}
              placeholder="Room code" maxLength={4}
              style={{ flex: 1, padding: '0.75rem', border: '2px solid #e2e8f0', borderRadius: 10, fontSize: 22, textAlign: 'center', letterSpacing: 6, fontWeight: 800, outline: 'none' }} />
            <button onClick={joinRoom} style={S.btn()}>Join</button>
          </div>
          {lobbyError && <div style={{ color: '#e53e3e', marginTop: 8, fontSize: 14 }}>{lobbyError}</div>}
        </div>
      )}

      {roomCode && (<>
        <div style={{ ...S.card, textAlign: 'center', padding: '1.25rem' }}>
          <div style={{ fontSize: 13, color: '#718096', marginBottom: 6 }}>Share this code</div>
          <div style={{ fontSize: 56, fontWeight: 900, letterSpacing: 14, background: C.grad, WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', lineHeight: 1 }}>{roomCode}</div>
        </div>
        <div style={S.card}>
          <div style={{ fontWeight: 700, color: '#2d3748', marginBottom: 10, fontSize: 15 }}>Players — {lobbyPlayers.length}</div>
          {lobbyPlayers.length === 0
            ? <div style={{ color: '#718096', fontSize: 14 }}>Waiting for players to join...</div>
            : lobbyPlayers.map((p, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                <div style={{ width: 34, height: 34, borderRadius: '50%', background: C.grad, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 13, flexShrink: 0 }}>{p.initials || '?'}</div>
                <span style={{ fontSize: 15 }}>{p.name}</span>
              </div>
            ))
          }
        </div>
        {isHost && (
          mode === 'h2h'
            ? lobbyPlayers.length >= 2
              ? <button onClick={hostStart} style={{ ...S.btn(), width: '100%', fontSize: 17, padding: '0.9rem' }}>Start ▶</button>
              : <div style={{ ...S.card, textAlign: 'center', color: '#718096', fontSize: 15 }}>Waiting for your opponent to join...</div>
            : <button onClick={hostStart} disabled={lobbyPlayers.length < 2}
                style={{ ...S.btn(lobbyPlayers.length < 2 ? '#cbd5e0' : C.primary), width: '100%', fontSize: 17, padding: '0.9rem' }}>
                {lobbyPlayers.length < 2 ? 'Waiting for students...' : `Start class (${lobbyPlayers.length} players) ▶`}
              </button>
        )}
        {!isHost && <div style={{ ...S.card, textAlign: 'center', color: '#718096', fontSize: 15 }}>⏳ Waiting for the host to start...</div>}
      </>)}

      <button onClick={reset} style={{ ...S.btn('#e2e8f0', '#4a5568', { fontSize: 14, marginTop: 8 }) }}>← Menu</button>
    </div></div>
  );

  if (screen === 'game') return (
    <div style={S.page}><div style={S.inner}>
      <div style={{ ...S.head, padding: '1.1rem 1.5rem', textAlign: 'left' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
          <div>
            <div style={{ fontSize: 12, opacity: 0.8, marginBottom: 3 }}>🐍 {cat?.name}</div>
            <div style={{ fontSize: 30, fontWeight: 900, lineHeight: 1 }}>{myScore} <span style={{ fontSize: 16, opacity: 0.8, fontWeight: 400 }}>pts</span></div>
            <div style={{ fontSize: 12, opacity: 0.75, marginTop: 3 }}>{validChain.length} word{validChain.length !== 1 ? 's' : ''}</div>
          </div>
          {mode === 'h2h' && oppName && (
            <div style={{ textAlign: 'center', opacity: 0.9 }}>
              <div style={{ fontSize: 11, opacity: 0.8 }}>{oppName.split(' ')[0]}</div>
              <div style={{ fontSize: 22, fontWeight: 700 }}>{oppScore ?? '–'}</div>
            </div>
          )}
          <div style={{ width: 68, height: 68, borderRadius: '50%', border: `4px solid ${timerColor}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, fontWeight: 800, color: timerColor, background: 'rgba(255,255,255,0.15)', flexShrink: 0, transition: 'color 0.3s, border-color 0.3s' }}>
            {fmtTime(timeLeft)}
          </div>
        </div>
      </div>

      {mode === 'class' && lobbyPlayers.length > 0 && (
        <div style={{ ...S.card, padding: '0.7rem 1rem' }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
            {[...lobbyPlayers].sort((a, b) => (b.score || 0) - (a.score || 0)).map((p, i) => (
              <span key={i} style={{ fontSize: 14, fontWeight: 700, color: p.id === user.id ? C.primary : '#4a5568' }}>
                {p.initials}: {p.score || 0}
              </span>
            ))}
          </div>
        </div>
      )}

      <div style={{ ...S.card, padding: '0.75rem 1rem', background: C.light, border: `2px solid ${C.border}`, textAlign: 'center' }}>
        {nextLetter
          ? <span style={{ color: C.dark, fontSize: 16 }}>Next word must start with <strong style={{ fontSize: 26 }}>{nextLetter}</strong></span>
          : <span style={{ color: C.dark, fontSize: 14 }}>👆 Type any word in the category to start the chain</span>
        }
      </div>

      {feedback && (
        <div style={{ ...S.card, padding: '0.7rem 1rem', background: feedback.ok ? '#f0fff4' : '#fff5f5', border: `1px solid ${feedback.ok ? '#9ae6b4' : '#feb2b2'}`, color: feedback.ok ? '#276749' : '#c53030', fontSize: 14 }}>
          {feedback.ok
            ? <span>✅ <strong>{feedback.word}</strong> +{feedback.pts}pt{feedback.pts !== 1 ? 's' : ''}{feedback.isMile ? ' 🎉 milestone!' : feedback.isLong ? ' 🔥 long word bonus!' : ''}</span>
            : <span>❌ <strong>{feedback.word}</strong> — {feedback.reason}</span>
          }
        </div>
      )}

      <div style={{ ...S.card, maxHeight: 240, overflowY: 'auto', padding: '1rem' }}>
        {chain.length === 0
          ? <div style={{ color: '#a0aec0', textAlign: 'center', fontSize: 14 }}>Your chain will appear here...</div>
          : <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7 }}>
              {chain.map((entry, i) => (
                <div key={i} style={S.chip(entry.valid, entry.pending)}>
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

      {!gameOver ? (
        <div style={S.card}>
          <div style={{ display: 'flex', gap: 8 }}>
            <input ref={inputRef} value={input} onChange={e => setInput(e.target.value)} onKeyDown={onKey}
              placeholder={nextLetter ? `Word starting with ${nextLetter}…` : 'Type a word…'}
              disabled={checking} autoFocus
              style={{ flex: 1, padding: '0.875rem 1rem', border: `2px solid ${nextLetter ? C.border : '#e2e8f0'}`, borderRadius: 10, fontSize: 18, outline: 'none', background: checking ? '#f7fafc' : '#fff' }} />
            <button onClick={submitWord} disabled={!input.trim() || checking}
              style={S.btn(!input.trim() || checking ? '#cbd5e0' : C.primary, '#fff', { padding: '0.875rem 1.25rem', fontSize: 22 })}>
              ↵
            </button>
          </div>
          {checking && <div style={{ fontSize: 13, color: '#718096', marginTop: 6 }}>Checking...</div>}
        </div>
      ) : (
        <div style={{ ...S.card, textAlign: 'center', background: C.light }}>
          <div style={{ fontSize: 28, marginBottom: 8 }}>⏱️ Time's up!</div>
          <div style={{ fontSize: 24, fontWeight: 800, color: C.dark }}>{myScore} pts</div>
          <div style={{ fontSize: 14, color: '#4a5568', marginTop: 4 }}>{validChain.length} words</div>
        </div>
      )}
    </div></div>
  );

  if (screen === 'results') {
    const finalChain = chain.filter(w => w.valid !== false);
    const won  = mode === 'h2h' && oppScore !== null && myScore > oppScore;
    const lost = mode === 'h2h' && oppScore !== null && myScore < oppScore;

    return (
      <div style={S.page}><div style={S.inner}>
        <div style={S.head}>
          <div style={{ fontSize: 44 }}>🐍</div>
          <h2 style={{ margin: '0.4rem 0 0.2rem', fontSize: 24 }}>Game over!</h2>
          <div style={{ opacity: 0.85, fontSize: 14 }}>{cat?.name}</div>
        </div>

        <div style={{ ...S.card, textAlign: 'center' }}>
          <div style={{ fontSize: 56, fontWeight: 900, background: C.grad, WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', lineHeight: 1 }}>{myScore}</div>
          <div style={{ fontSize: 15, color: '#718096', marginTop: 4 }}>points · {finalChain.length} word{finalChain.length !== 1 ? 's' : ''}</div>
          {mode === 'h2h' && oppName && (
            <div style={{ marginTop: 14, padding: '0.9rem', background: '#f7fafc', borderRadius: 10 }}>
              <div style={{ fontSize: 13, color: '#718096', marginBottom: 4 }}>{oppName}</div>
              <div style={{ fontSize: 26, fontWeight: 700 }}>{oppScore ?? '?'}</div>
              {won  && <div style={{ fontSize: 18, color: '#276749', marginTop: 6, fontWeight: 700 }}>🏆 You won!</div>}
              {lost && <div style={{ fontSize: 16, color: '#e53e3e', marginTop: 6 }}>Better luck next time!</div>}
              {!won && !lost && oppScore !== null && <div style={{ fontSize: 16, color: '#ed8936', marginTop: 6 }}>🤝 Draw!</div>}
            </div>
          )}
        </div>

        {finalChain.length > 0 && (
          <div style={S.card}>
            <div style={{ fontWeight: 700, color: '#2d3748', marginBottom: 10, fontSize: 15 }}>Your chain</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {finalChain.map((w, i) => (
                <span key={i} style={S.chip(true, false)}>
                  {w.word}
                  {i < finalChain.length - 1 && <span style={{ color: C.border, marginLeft: 3, fontSize: 12 }}>›</span>}
                </span>
              ))}
            </div>
          </div>
        )}

        {lb.length > 0 && (
          <div style={S.card}>
            <div style={{ fontWeight: 700, color: '#2d3748', marginBottom: 10, fontSize: 15 }}>🏆 Leaderboard — {cat?.name}</div>
            {lb.map((entry, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '0.45rem 0', borderBottom: i < lb.length - 1 ? '1px solid #f0f0f5' : 'none' }}>
                <span style={{ width: 22, fontWeight: 700, color: i === 0 ? '#d69e2e' : '#a0aec0', fontSize: 14 }}>
                  {i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `${i + 1}.`}
                </span>
                <span style={{ flex: 1, fontWeight: 600, fontSize: 15 }}>{entry.initials}</span>
                <span style={{ fontSize: 11, padding: '2px 7px', borderRadius: 6, background: entry.level_group === 'A' ? '#c6f6d5' : entry.level_group === 'B' ? '#bee3f8' : '#fbd38d', color: entry.level_group === 'A' ? '#276749' : entry.level_group === 'B' ? '#2b6cb0' : '#744210', fontWeight: 600 }}>
                  {entry.level_group}
                </span>
                <span style={{ fontWeight: 800, fontSize: 18, color: '#2d3748' }}>{entry.best_score}</span>
              </div>
            ))}
          </div>
        )}

        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {mode === 'solo' && <button onClick={() => startSolo(cat)} style={{ ...S.btn(), flex: 1 }}>Play again</button>}
          <button onClick={() => setScreen('categories')} style={{ ...S.btn(C.grad), flex: 1 }}>Change topic</button>
          <button onClick={reset} style={{ ...S.btn('#e2e8f0', '#4a5568'), flex: 1 }}>Menu</button>
        </div>
      </div></div>
    );
  }

  return null;
}
