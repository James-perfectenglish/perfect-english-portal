import { useState, useEffect, useRef } from 'react';
import { supabase } from './supabaseClient';

// ─────────────────────────────────────────────────────────────
// REUSABLE MEMORY GAME — with session tracking
//
// Props:
//   title, subtitle, levelBadge  — display text
//   cards                        — array from BorrasCards / HotelCards
//   gameName                     — string key for tracking e.g. "borras", "hotel"
//   cardBackImage                — image URL for card backs
//   maxPerRound                  — max cards per round (default 6)
//   onBack                       — callback
// ─────────────────────────────────────────────────────────────

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function buildTiles(cardSet) {
  const tiles = [];
  cardSet.forEach(card => {
    tiles.push({ tileId: `eng-${card.id}`, pairId: card.id, type: 'english', text: card.word });
    tiles.push({ tileId: `spa-${card.id}`, pairId: card.id, type: 'spanish', text: card.spanish });
  });
  return shuffle(tiles);
}

// ─── SINGLE BOARD ────────────────────────────────────────────
function MemoryBoard({ cardSet, cardBackImage, onComplete }) {
  const [tiles, setTiles]       = useState(() => buildTiles(cardSet));
  const [flipped, setFlipped]   = useState([]);
  const [matched, setMatched]   = useState(new Set());
  const [locked, setLocked]     = useState(false);
  const [moves, setMoves]       = useState(0);
  const [shakePair, setShakePair] = useState(null);
  const startTimeRef            = useRef(Date.now());

  const allMatched = matched.size === cardSet.length;

  useEffect(() => {
    if (flipped.length === 2) {
      setLocked(true);
      setMoves(m => m + 1);
      const [a, b] = flipped.map(id => tiles.find(t => t.tileId === id));
      if (a.pairId === b.pairId) {
        setTimeout(() => {
          setMatched(prev => new Set([...prev, a.pairId]));
          setFlipped([]);
          setLocked(false);
        }, 500);
      } else {
        setShakePair([a.tileId, b.tileId]);
        setTimeout(() => {
          setShakePair(null);
          setFlipped([]);
          setLocked(false);
        }, 900);
      }
    }
  }, [flipped, tiles]);

  function handleTile(tile) {
    if (locked || matched.has(tile.pairId) || flipped.includes(tile.tileId) || flipped.length >= 2) return;
    setFlipped(prev => [...prev, tile.tileId]);
  }

  function reset() {
    setTiles(buildTiles(cardSet));
    setFlipped([]);
    setMatched(new Set());
    setLocked(false);
    setMoves(0);
    setShakePair(null);
    startTimeRef.current = Date.now();
  }

  const isFaceUp  = tile => flipped.includes(tile.tileId) || matched.has(tile.pairId);
  const isMatched = tile => matched.has(tile.pairId);
  const isShaking = tile => shakePair && shakePair.includes(tile.tileId);

  return (
    <div>
      {/* Stats */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', fontSize: '0.9rem', color: '#4a5568', fontWeight: 500 }}>
        <span>{matched.size} of {cardSet.length} matched</span>
        <span style={{ color: '#667eea', fontWeight: 700 }}>{moves} move{moves !== 1 ? 's' : ''}</span>
      </div>

      {/* 4×N grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 'clamp(6px, 2vw, 10px)' }}>
        {tiles.map(tile => {
          const faceUp   = isFaceUp(tile);
          const matched2 = isMatched(tile);
          const shaking  = isShaking(tile);
          return (
            <div key={tile.tileId} onClick={() => handleTile(tile)} style={{ perspective: '600px', cursor: matched2 ? 'default' : 'pointer', aspectRatio: '3/4', animation: shaking ? 'memShake 0.45s ease' : 'none' }}>
              <div style={{ width: '100%', height: '100%', position: 'relative', transformStyle: 'preserve-3d', transition: 'transform 0.4s cubic-bezier(0.4,0.2,0.2,1)', transform: faceUp ? 'rotateY(180deg)' : 'rotateY(0deg)' }}>
                {/* Back */}
                <div style={{ position: 'absolute', inset: 0, backfaceVisibility: 'hidden', borderRadius: '10px', overflow: 'hidden', boxShadow: '0 2px 8px rgba(0,0,0,0.15)', border: '2px solid rgba(255,255,255,0.3)' }}>
                  {cardBackImage
                    ? <img src={cardBackImage} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    : <div style={{ width: '100%', height: '100%', background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><span style={{ fontSize: '1.5rem' }}>🃏</span></div>
                  }
                </div>
                {/* Front */}
                <div style={{ position: 'absolute', inset: 0, backfaceVisibility: 'hidden', transform: 'rotateY(180deg)', borderRadius: '10px', backgroundColor: matched2 ? '#f0fff4' : tile.type === 'english' ? 'white' : '#f7f8ff', border: `2px solid ${matched2 ? '#48bb78' : tile.type === 'english' ? '#667eea' : '#764ba2'}`, boxShadow: matched2 ? '0 0 0 2px #48bb7844' : '0 2px 8px rgba(0,0,0,0.10)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '0.3rem 0.2rem', textAlign: 'center', transition: 'all 0.2s' }}>
                  {matched2 && <span style={{ fontSize: '0.9rem', lineHeight: 1, marginBottom: '2px' }}>✅</span>}
                  <span style={{ fontSize: tile.text.length > 14 ? '0.55rem' : tile.text.length > 9 ? '0.65rem' : '0.75rem', fontWeight: 700, color: matched2 ? '#276749' : tile.type === 'english' ? '#667eea' : '#764ba2', lineHeight: 1.25 }}>
                    {tile.text}
                  </span>
                  {!matched2 && <span style={{ fontSize: '0.5rem', color: '#a0aec0', marginTop: '3px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{tile.type === 'english' ? 'EN' : 'ES'}</span>}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {allMatched && (
        <div style={{ marginTop: '1.5rem', background: '#f0fff4', border: '2px solid #48bb78', borderRadius: '12px', padding: '1.5rem', textAlign: 'center' }}>
          <p style={{ margin: 0, fontWeight: 800, color: '#276749', fontSize: '1.1rem' }}>
            🎉 Excellent! All {cardSet.length} pairs matched in {moves} moves!
          </p>
          <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1rem', justifyContent: 'center' }}>
            <button onClick={reset} style={{ background: '#48bb78', color: 'white', border: 'none', borderRadius: '10px', padding: '0.6rem 1.2rem', fontWeight: 700, cursor: 'pointer', fontSize: '0.9rem' }}>Play Again</button>
            {onComplete && <button onClick={() => onComplete(moves)} style={{ background: '#667eea', color: 'white', border: 'none', borderRadius: '10px', padding: '0.6rem 1.2rem', fontWeight: 700, cursor: 'pointer', fontSize: '0.9rem' }}>Next Round →</button>}
          </div>
        </div>
      )}

      <style>{`
        @keyframes memShake {
          0%, 100% { transform: translateX(0); }
          20% { transform: translateX(-5px); }
          40% { transform: translateX(5px); }
          60% { transform: translateX(-4px); }
          80% { transform: translateX(4px); }
        }
      `}</style>
    </div>
  );
}

// ─── MAIN EXPORT ─────────────────────────────────────────────
export default function MemoryGame({
  title       = 'Memory Game',
  subtitle    = 'Match the English word to its Spanish translation',
  levelBadge  = '',
  cards       = [],
  gameName    = 'unknown',
  cardBackImage = '/og-image.png',
  maxPerRound = 6,
  onBack,
}) {
  const rounds = [...new Set(cards.map(c => c.round))];
  const [selectedRound, setSelectedRound] = useState(rounds[0] || 1);
  const [boardKey, setBoardKey]           = useState(0);

  const roundCards = cards.filter(c => c.round === selectedRound).slice(0, maxPerRound);
  const roundName  = roundCards[0]?.roundName || `Round ${selectedRound}`;

  function goToRound(r) { setSelectedRound(r); setBoardKey(k => k + 1); }

  async function handleRoundComplete(moves) {
    // Save tracking record
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        await supabase.from('memory_sessions').insert({
          student_id:  user.id,
          game_name:   gameName,
          round_name:  roundName,
          moves,
        });
      }
    } catch (e) {
      console.error('Error saving memory session:', e);
    }
    // Advance to next round
    const idx = rounds.indexOf(selectedRound);
    if (idx < rounds.length - 1) goToRound(rounds[idx + 1]);
  }

  return (
    <div style={{ width: '100vw', minHeight: '100vh', backgroundColor: '#f8f9fa', boxSizing: 'border-box', position: 'relative', left: '50%', right: '50%', marginLeft: '-50vw', marginRight: '-50vw' }}>
      <div style={{ padding: '1rem', maxWidth: '800px', margin: '0 auto', width: '100%', boxSizing: 'border-box' }}>

        {/* HEADER */}
        <div style={{ background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', borderRadius: '12px', padding: '2rem', textAlign: 'center', color: 'white', marginBottom: '1.5rem' }}>
          <h1 style={{ margin: 0, fontSize: 'clamp(1.8rem, 5vw, 2.2rem)', fontWeight: 700 }}>{title}</h1>
          <p style={{ margin: '0.5rem 0 0', opacity: 0.9, fontSize: 'clamp(0.9rem, 3vw, 1.1rem)' }}>{subtitle}</p>
          {levelBadge && <span style={{ display: 'inline-block', background: '#48bb78', padding: '4px 12px', borderRadius: '20px', fontSize: '0.85rem', fontWeight: 600, marginTop: '0.5rem' }}>{levelBadge}</span>}
        </div>

        {/* ROUND TABS */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem', marginBottom: '1.5rem' }}>
          {rounds.map(r => {
            const name     = cards.find(c => c.round === r)?.roundName;
            const isActive = r === selectedRound;
            return (
              <button key={r} onClick={() => goToRound(r)} style={{ background: isActive ? '#667eea' : 'white', color: isActive ? 'white' : '#4a5568', border: `1.5px solid ${isActive ? '#667eea' : '#e2e8f0'}`, borderRadius: '20px', padding: '5px 13px', fontSize: '0.78rem', fontWeight: 600, cursor: 'pointer' }}>
                {r}. {name}
              </button>
            );
          })}
        </div>

        {/* BOARD CARD */}
        <div style={{ backgroundColor: 'white', borderRadius: '16px', padding: 'clamp(1rem, 4vw, 1.5rem)', boxShadow: '0 4px 16px rgba(0,0,0,0.08)', marginBottom: '1rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
            <h3 style={{ margin: 0, color: '#2d3748', fontSize: '1rem' }}>Round {selectedRound}: {roundName}</h3>
            <span style={{ background: '#f7f8ff', color: '#667eea', border: '1px solid #e2e8f0', fontSize: '0.75rem', fontWeight: 700, padding: '3px 10px', borderRadius: '20px' }}>{roundCards.length} pairs</span>
          </div>
          <MemoryBoard
            key={boardKey}
            cardSet={roundCards}
            cardBackImage={cardBackImage}
            onComplete={rounds.indexOf(selectedRound) < rounds.length - 1 ? handleRoundComplete : null}
          />
        </div>

        {/* HOW TO PLAY */}
        <div style={{ backgroundColor: 'white', borderRadius: '12px', padding: '1rem 1.2rem', boxShadow: '0 2px 8px rgba(0,0,0,0.05)', fontSize: '0.85rem', color: '#4a5568', lineHeight: 1.6 }}>
          <strong style={{ color: '#667eea' }}>How to play:</strong> Tap a card to flip it. Find the English word and its Spanish translation to make a pair. Match all {roundCards.length} pairs to complete the round!
        </div>

        {onBack && (
          <div style={{ textAlign: 'center', marginTop: '1.5rem' }}>
            <button onClick={onBack} style={{ padding: '10px 24px', background: 'transparent', color: '#718096', border: '1px solid #e2e8f0', borderRadius: '6px', fontWeight: 500, cursor: 'pointer', fontSize: '0.95rem' }}>← Back to Exercises</button>
          </div>
        )}
      </div>
    </div>
  );
}
