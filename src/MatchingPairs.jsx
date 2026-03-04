import { useState, useRef } from 'react';

// Inject CSS to kill browser outlines on matching tiles
const MP_STYLE_ID = 'matching-pairs-focus-fix';
if (typeof document !== 'undefined' && !document.getElementById(MP_STYLE_ID)) {
  const style = document.createElement('style');
  style.id = MP_STYLE_ID;
  style.textContent = `
    .matching-tile, .matching-tile:focus, .matching-tile:focus-visible,
    .matching-tile:active, .matching-tile * {
      outline: none !important;
      -webkit-tap-highlight-color: transparent !important;
    }
  `;
  document.head.appendChild(style);
}

function shuffleArray(arr) {
  const s = [...arr];
  for (let i = s.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [s[i], s[j]] = [s[j], s[i]];
  }
  return s;
}

export default function MatchingPairs({ pairs, disabled, onResult }) {
  const leftItems  = pairs.map((p, i) => ({ ...p.left,  id: i }));
  const [rightItems] = useState(() => shuffleArray(pairs.map((p, i) => ({ ...p.right, id: i }))));

  // selected: { id, side } | null  — tracks whichever tile was tapped first
  const [selected, setSelected]       = useState(null);
  const [matched, setMatched]         = useState(new Set());
  const [wrongFlash, setWrongFlash]   = useState(null);
  const [wrongAttempts, setWrongAttempts] = useState(0);
  const [playingId, setPlayingId]     = useState(null);
  const audioRef         = useRef(null);
  const wrongFlashTimer  = useRef(null);

  const stopAudio = () => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
    }
    setPlayingId(null);
  };

  const playAudio = (url, key) => {
    if (playingId === key) { stopAudio(); return; }
    stopAudio();
    const audio = new Audio(url);
    audioRef.current = audio;
    setPlayingId(key);
    audio.play().catch(console.error);
    audio.onended = () => setPlayingId(null);
  };

  // ── Unified tap handler — works for left OR right ──
  const handleTap = (item, side) => {
    if (wrongFlash || disabled) return;
    if (matched.has(item.id)) return;

    // Always play audio tiles on tap regardless of match logic
    if (item.type === 'audio') {
      playAudio(item.content, `${side}-${item.id}`);
    }

    // Nothing selected yet — select this tile
    if (selected === null) {
      setSelected({ id: item.id, side });
      return;
    }

    // Tapping the same tile again — deselect
    if (selected.id === item.id && selected.side === side) {
      setSelected(null);
      return;
    }

    // Tapping a different tile on the same side — switch selection
    if (selected.side === side) {
      setSelected({ id: item.id, side });
      return;
    }

    // Tapping the opposite side — check for match
    if (selected.id === item.id) {
      // ✅ Correct pair
      const newMatched = new Set(matched);
      newMatched.add(item.id);
      setMatched(newMatched);
      setSelected(null);
      if (newMatched.size === leftItems.length) {
        stopAudio();
        onResult(wrongAttempts === 0, wrongAttempts);
      }
    } else {
      // ❌ Wrong pair
      const newWrong = wrongAttempts + 1;
      setWrongAttempts(newWrong);
      const flashObj = selected.side === 'left'
        ? { leftId: selected.id,  rightId: item.id }
        : { leftId: item.id,      rightId: selected.id };
      setWrongFlash(flashObj);
      setSelected(null);
      clearTimeout(wrongFlashTimer.current);
      wrongFlashTimer.current = setTimeout(() => setWrongFlash(null), 600);
    }
  };

  const renderContent = (item, side) => {
    if (item.type === 'audio') {
      const key = `${side}-${item.id}`;
      const isPlaying = playingId === key;
      return (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
          <div style={{
            width: '44px', height: '44px', borderRadius: '50%',
            background: isPlaying
              ? 'linear-gradient(135deg, #764ba2, #667eea)'
              : 'linear-gradient(135deg, #667eea, #764ba2)',
            color: 'white', fontSize: '1.1rem',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: isPlaying
              ? '0 0 0 3px rgba(102,126,234,0.35)'
              : '0 2px 6px rgba(102,126,234,0.3)',
            transition: 'all 0.2s', flexShrink: 0,
            pointerEvents: 'none',
          }}>
            {isPlaying ? '⏹' : '▶'}
          </div>
          {item.label && (
            <span style={{ fontSize: '0.75rem', color: '#718096', textAlign: 'center', lineHeight: 1.2 }}>
              {item.label}
            </span>
          )}
        </div>
      );
    }

    if (item.type === 'image') {
      return (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '5px' }}>
          <img
            src={item.content}
            alt={item.label || ''}
            style={{ width: '64px', height: '64px', objectFit: 'cover', borderRadius: '8px', display: 'block' }}
          />
          {item.label && (
            <span style={{ fontSize: '0.78rem', color: '#4a5568', textAlign: 'center', lineHeight: 1.2 }}>
              {item.label}
            </span>
          )}
        </div>
      );
    }

    return (
      <span style={{
        fontSize: 'clamp(0.82rem, 2.6vw, 0.98rem)',
        fontWeight: '500', textAlign: 'center', lineHeight: 1.35,
        wordBreak: 'break-word',
      }}>
        {item.content}
      </span>
    );
  };

  const getTileStyle = (item, side) => {
    const id = item.id;
    const isMatched      = matched.has(id);
    const isSelected     = selected && selected.id === id && selected.side === side;
    const isWrongLeft    = wrongFlash && side === 'left'  && wrongFlash.leftId  === id;
    const isWrongRight   = wrongFlash && side === 'right' && wrongFlash.rightId === id;

    const base = {
      padding: 'clamp(8px, 2.5vw, 12px) clamp(6px, 1.8vw, 10px)',
      borderRadius: '10px',
      border: 'none',
      cursor: (isMatched || disabled) ? 'default' : 'pointer',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      transition: 'all 0.18s ease',
      userSelect: 'none',
      WebkitTapHighlightColor: 'transparent',
      boxSizing: 'border-box',
      position: 'relative',
    };

    if (isMatched)                  return { ...base, boxShadow: 'inset 0 0 0 2px #48bb78', backgroundColor: '#f0fff4', color: '#276749', opacity: 0.6 };
    if (isWrongLeft || isWrongRight) return { ...base, boxShadow: 'inset 0 0 0 2px #f56565', backgroundColor: '#fff5f5', color: '#c53030', transform: 'scale(0.97)' };
    if (isSelected)                 return { ...base, boxShadow: 'inset 0 0 0 2px #667eea', backgroundColor: '#EDE9FE', color: '#553C9A', transform: 'scale(1.01)' };
    return { ...base, boxShadow: 'inset 0 0 0 2px #e2e8f0', backgroundColor: 'white', color: '#2d3748' };
  };

  const allMatched  = matched.size === leftItems.length && leftItems.length > 0;
  const pairsCount  = leftItems.length;

  return (
    <div>
      <div style={{
        display: 'grid',
        gridTemplateColumns: '1fr 1fr',
        gap: '10px',
        marginBottom: '10px',
        alignItems: 'stretch',
      }}>
        {leftItems.map((leftItem, i) => {
          const rightItem = rightItems[i];
          return [
            <div
              key={`left-${leftItem.id}`}
              className="matching-tile"
              tabIndex={-1}
              onClick={() => handleTap(leftItem, 'left')}
              style={getTileStyle(leftItem, 'left')}
            >
              {matched.has(leftItem.id) && (
                <span style={{ position: 'absolute', top: '4px', right: '6px', fontSize: '0.7rem', color: '#48bb78' }}>✓</span>
              )}
              {renderContent(leftItem, 'left')}
            </div>,

            <div
              key={`right-${rightItem.id}`}
              className="matching-tile"
              tabIndex={-1}
              onClick={() => handleTap(rightItem, 'right')}
              style={getTileStyle(rightItem, 'right')}
            >
              {matched.has(rightItem.id) && (
                <span style={{ position: 'absolute', top: '4px', right: '6px', fontSize: '0.7rem', color: '#48bb78' }}>✓</span>
              )}
              {renderContent(rightItem, 'right')}
            </div>,
          ];
        })}
      </div>

      {!allMatched && !disabled && (
        <div style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          fontSize: '0.82rem', marginTop: '4px', padding: '0 2px',
        }}>
          <span style={{ color: selected !== null ? '#667eea' : '#a0aec0', fontWeight: selected !== null ? 500 : 400 }}>
            {selected !== null ? '👆 Now tap its match on the other side' : 'Tap any tile to begin'}
          </span>
          <span style={{ color: '#cbd5e0' }}>{matched.size}/{pairsCount}</span>
        </div>
      )}
    </div>
  );
}
