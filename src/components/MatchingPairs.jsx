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

/**
 * MatchingPairs — shared component used by MatchingExercise and RandomPracticeExercise.
 *
 * Props:
 *   pairs    — array of { left: {type, content, label?}, right: {type, content, label?} }
 *              type can be: "text" | "audio" | "image"
 *   disabled — boolean, disables all interaction after completion
 *   onResult — callback(isCorrect: boolean, wrongAttempts: number) fired when all pairs matched
 *
 * Always mount with a key prop to reset state between questions.
 */
export default function MatchingPairs({ pairs, disabled, onResult }) {
  const leftItems = pairs.map((p, i) => ({ ...p.left, id: i }));
  const [rightItems] = useState(() => shuffleArray(pairs.map((p, i) => ({ ...p.right, id: i }))));

  const [leftSelected, setLeftSelected] = useState(null);
  const [matched, setMatched] = useState(new Set());
  const [wrongFlash, setWrongFlash] = useState(null);
  const [wrongAttempts, setWrongAttempts] = useState(0);
  const [playingId, setPlayingId] = useState(null);
  const audioRef = useRef(null);
  const wrongFlashTimer = useRef(null);

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

  const handleLeftTap = (id) => {
    if (wrongFlash || disabled) return;
    if (matched.has(id)) return;
    setLeftSelected(prev => prev === id ? null : id);
  };

  const handleRightTap = (item) => {
    if (wrongFlash || disabled) return;
    if (matched.has(item.id)) return;
    if (leftSelected === null) return;

    if (leftSelected === item.id) {
      const newMatched = new Set(matched);
      newMatched.add(item.id);
      setMatched(newMatched);
      setLeftSelected(null);
      if (newMatched.size === leftItems.length) {
        stopAudio();
        onResult(wrongAttempts === 0, wrongAttempts);
      }
    } else {
      const newWrong = wrongAttempts + 1;
      setWrongAttempts(newWrong);
      setWrongFlash({ leftId: leftSelected, rightId: item.id });
      setLeftSelected(null);
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
          <button
            onClick={() => {
              // No stopPropagation — click bubbles to tile div, selecting it in the same tap
              playAudio(item.content, key);
            }}
            style={{
              width: '44px', height: '44px', borderRadius: '50%',
              border: 'none',
              background: isPlaying
                ? 'linear-gradient(135deg, #764ba2, #667eea)'
                : 'linear-gradient(135deg, #667eea, #764ba2)',
              color: 'white', fontSize: '1.1rem', cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: isPlaying
                ? '0 0 0 3px rgba(102,126,234,0.35)'
                : '0 2px 6px rgba(102,126,234,0.3)',
              transition: 'all 0.2s', flexShrink: 0,
            }}
          >
            {isPlaying ? '⏹' : '▶'}
          </button>
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
    const isMatched = matched.has(id);
    const isSelected = side === 'left' && leftSelected === id;
    const isWrongLeft = wrongFlash && side === 'left' && wrongFlash.leftId === id;
    const isWrongRight = wrongFlash && side === 'right' && wrongFlash.rightId === id;

    const base = {
      padding: 'clamp(8px, 2.5vw, 12px) clamp(6px, 1.8vw, 10px)',
      borderRadius: '10px',
      border: 'none',
      cursor: (isMatched || disabled) ? 'default' : 'pointer',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      // No minHeight here — height is governed by the CSS grid row so both sides always match
      transition: 'all 0.18s ease',
      userSelect: 'none',
      WebkitTapHighlightColor: 'transparent',
      boxSizing: 'border-box',
      position: 'relative',
    };

    if (isMatched) return { ...base, boxShadow: 'inset 0 0 0 2px #48bb78', backgroundColor: '#f0fff4', color: '#276749', opacity: 0.6 };
    if (isWrongLeft || isWrongRight) return { ...base, boxShadow: 'inset 0 0 0 2px #f56565', backgroundColor: '#fff5f5', color: '#c53030', transform: 'scale(0.97)' };
    if (isSelected) return { ...base, boxShadow: 'inset 0 0 0 2px #667eea', backgroundColor: '#EDE9FE', color: '#553C9A', transform: 'scale(1.01)' };
    return { ...base, boxShadow: 'inset 0 0 0 2px #e2e8f0', backgroundColor: 'white', color: '#2d3748' };
  };

  const allMatched = matched.size === leftItems.length && leftItems.length > 0;
  const pairsCount = leftItems.length;

  return (
    <div>
      {/*
        Flat grid — each pair renders as two adjacent cells in the same row.
        CSS grid automatically makes both tiles in a row the same height.
        Left items stay in original order; right items are shuffled.
      */}
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
              onClick={() => handleLeftTap(leftItem.id)}
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
              onClick={() => handleRightTap(rightItem)}
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
          <span style={{ color: leftSelected !== null ? '#667eea' : '#a0aec0', fontWeight: leftSelected !== null ? 500 : 400 }}>
            {leftSelected !== null ? '→ Now tap its match on the right' : 'Tap a tile on the left to begin'}
          </span>
          <span style={{ color: '#cbd5e0' }}>{matched.size}/{pairsCount}</span>
        </div>
      )}
    </div>
  );
}
