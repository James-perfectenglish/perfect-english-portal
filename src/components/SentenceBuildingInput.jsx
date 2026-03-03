import { useState, useEffect, useRef, useCallback } from 'react';

function shuffleArray(arr) {
  const shuffled = [...arr];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

function normalizeAnswer(words) {
  let result = words.map(w => w.text).join(' ');
  result = result.replace(/ ([.,?!;:])/g, '$1');
  return result.toLowerCase().trim();
}

const aiMarkSentence = async (correctAnswer, studentAnswer, language = 'en') => {
  try {
    const response = await fetch('/api/mark-word-order', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ correctAnswer, studentAnswer, language }),
    });
    if (!response.ok) return null;
    const result = await response.json();
    if (result.valid === null) return null;
    return result;
  } catch (e) {
    console.error('AI sentence marking error:', e);
    return null;
  }
};

/**
 * SentenceBuildingInput
 *
 * Props:
 * - words: string[]
 * - questionType: 'translation' | 'build'
 * - prompt: string | null
 * - correctSentences: string[]
 * - explanation: string
 * - disabled: boolean
 * - onResult: (isCorrect: boolean, isSoft: boolean, userAnswer: string) => void
 * - feedback: { correct, message } | null
 * - showCheckButton: boolean
 * - onAnswerReady: (hasAnswer: boolean) => void
 * - getCheckFn: (fn) => void
 * - language: 'en' | 'es'  — defaults to 'en'
 */
export default function SentenceBuildingInput({
  words = [],
  questionType = 'build',
  prompt = null,
  correctSentences = [],
  explanation = '',
  disabled = false,
  onResult,
  feedback = null,
  showCheckButton = true,
  onAnswerReady,
  getCheckFn,
  language = 'en',
}) {
  const [bankWords, setBankWords] = useState([]);
  const [answerWords, setAnswerWords] = useState([]);
  const [dragWord, setDragWord] = useState(null);
  const [dragPos, setDragPos] = useState(null);
  const [dropIndex, setDropIndex] = useState(null);
  const [isChecking, setIsChecking] = useState(false);
  const isDragging = useRef(false);
  const dragStartPos = useRef(null);
  const answerRefs = useRef([]);
  const answerZoneRef = useRef(null);
  const tapCooldown = useRef(false);
  const DRAG_THRESHOLD = 12;

  const targetTileCount = (() => {
    if (!correctSentences || correctSentences.length === 0) return null;
    const counts = correctSentences.map(s => s.trim().split(/\s+/).length);
    return Math.min(...counts);
  })();

  useEffect(() => {
    const wordsWithIds = words.map((text, i) => ({ id: `w${i}`, text }));
    setBankWords(shuffleArray(wordsWithIds));
    setAnswerWords([]);
    setDropIndex(null);
    setDragWord(null);
    setDragPos(null);
  }, [JSON.stringify(words)]);

  useEffect(() => {
    if (onAnswerReady) onAnswerReady(answerWords.length > 0);
  }, [answerWords.length]);

  useEffect(() => {
    if (getCheckFn) {
      getCheckFn(() => checkAnswer());
    }
  }, [answerWords, correctSentences]);

  const checkAnswer = async () => {
    if (isChecking || answerWords.length === 0) return;

    const userAnswer = normalizeAnswer(answerWords);

    // 1 — Exact match
    const isCorrect = correctSentences.some(
      correct => correct.trim().toLowerCase() === userAnswer
    );
    if (isCorrect) {
      if (onResult) onResult(true, false, userAnswer);
      return true;
    }

    // 2 — Soft punctuation match
    const stripPunctuation = (str) => str.replace(/[.,?!;:]/g, '').replace(/\s+/g, ' ').trim();
    const userStripped = stripPunctuation(userAnswer);
    const isSoftCorrect = correctSentences.some(
      correct => stripPunctuation(correct.trim().toLowerCase()) === userStripped
    );
    if (isSoftCorrect) {
      if (onResult) onResult(true, true, userAnswer);
      return true;
    }

    // 3 — AI backstop
    setIsChecking(true);
    const aiResult = await aiMarkSentence(correctSentences[0] || '', userAnswer, language);
    setIsChecking(false);

    if (aiResult?.valid) {
      if (onResult) onResult(true, true, userAnswer);
      return true;
    }

    if (onResult) onResult(false, false, userAnswer);
    return false;
  };

  const resetWords = () => {
    const wordsWithIds = words.map((text, i) => ({ id: `w${i}`, text }));
    setBankWords(shuffleArray(wordsWithIds));
    setAnswerWords([]);
    setDropIndex(null);
    setDragWord(null);
    setDragPos(null);
  };

  const calcDropIndex = (cursorX, cursorY) => {
    const refs = answerRefs.current;
    const ROW_TOLERANCE = 8;
    for (let i = 0; i < refs.length; i++) {
      const el = refs[i];
      if (!el) continue;
      const r = el.getBoundingClientRect();
      const aboveTile = cursorY < r.top - ROW_TOLERANCE;
      const onSameRow = cursorY >= r.top - ROW_TOLERANCE && cursorY <= r.bottom + ROW_TOLERANCE;
      if (aboveTile) return i;
      if (onSameRow) {
        if (cursorX < r.left + r.width / 2) return i;
      }
    }
    return refs.length;
  };

  const handlePointerDown = useCallback((word, zone, e) => {
    if (disabled || isChecking) return;
    if (isDragging.current) return;
    if (tapCooldown.current) return;
    e.preventDefault();
    e.stopPropagation();

    const touch = e.touches ? e.touches[0] : e;
    dragStartPos.current = { x: touch.clientX, y: touch.clientY };
    isDragging.current = false;
    const pendingWord = { ...word, fromZone: zone };

    const handleMove = (moveE) => {
      const t = moveE.touches ? moveE.touches[0] : moveE;
      const dx = t.clientX - dragStartPos.current.x;
      const dy = t.clientY - dragStartPos.current.y;
      if (!isDragging.current && Math.sqrt(dx * dx + dy * dy) > DRAG_THRESHOLD) {
        isDragging.current = true;
        setDragWord(pendingWord);
      }
      if (isDragging.current) {
        moveE.preventDefault();
        setDragPos({ x: t.clientX, y: t.clientY });
        if (answerZoneRef.current) {
          const zr = answerZoneRef.current.getBoundingClientRect();
          if (t.clientY >= zr.top - 50 && t.clientY <= zr.bottom + 50) {
            setDropIndex(calcDropIndex(t.clientX, t.clientY));
          } else {
            setDropIndex(null);
          }
        }
      }
    };

    const handleUp = () => {
      document.removeEventListener('mousemove', handleMove);
      document.removeEventListener('mouseup', handleUp);
      document.removeEventListener('touchmove', handleMove, { passive: false });
      document.removeEventListener('touchend', handleUp);

      if (!isDragging.current) {
        tapCooldown.current = true;
        setTimeout(() => { tapCooldown.current = false; }, 200);
        if (zone === 'bank') {
          setBankWords(prev => prev.filter(w => w.id !== word.id));
          setAnswerWords(prev => [...prev, word]);
        } else {
          setAnswerWords(prev => prev.filter(w => w.id !== word.id));
          setBankWords(prev => [...prev, word]);
        }
      } else {
        setDragWord(null);
        setDragPos(null);
        isDragging.current = false;
        if (zone === 'bank') {
          setDropIndex(currentIdx => {
            setBankWords(prev => prev.filter(w => w.id !== word.id));
            setAnswerWords(prev => {
              const idx = currentIdx !== null && currentIdx !== undefined ? currentIdx : prev.length;
              const newAnswer = [...prev];
              newAnswer.splice(idx, 0, word);
              return newAnswer;
            });
            return null;
          });
        } else {
          setDropIndex(currentIdx => {
            if (currentIdx !== null && currentIdx !== undefined) {
              setAnswerWords(prev => {
                const filtered = prev.filter(w => w.id !== word.id);
                filtered.splice(Math.min(currentIdx, filtered.length), 0, word);
                return filtered;
              });
            } else {
              setAnswerWords(prev => prev.filter(w => w.id !== word.id));
              setBankWords(prev => [...prev, word]);
            }
            return null;
          });
        }
      }
      setDropIndex(null);
    };

    document.addEventListener('mousemove', handleMove);
    document.addEventListener('mouseup', handleUp);
    document.addEventListener('touchmove', handleMove, { passive: false });
    document.addEventListener('touchend', handleUp);
  }, [disabled, isChecking]);

  const tileStyle = (isDragSource = false) => ({
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
    padding: 'clamp(8px, 2.5vw, 10px) clamp(12px, 3vw, 16px)',
    margin: 'clamp(4px, 1.5vw, 6px)',
    backgroundColor: isDragSource ? '#e2e8f0' : 'white',
    border: isDragSource ? '2px dashed #cbd5e0' : '2px solid #e2e8f0',
    borderRadius: '8px', fontSize: 'clamp(0.9rem, 3.2vw, 1.1rem)', fontWeight: '500',
    color: isDragSource ? 'transparent' : '#2C3E50',
    cursor: (disabled || isChecking) ? 'default' : 'grab',
    userSelect: 'none', WebkitUserSelect: 'none', touchAction: 'none',
    minWidth: '32px', textAlign: 'center', boxSizing: 'border-box',
  });

  const answerTileStyle = (isDragSource = false) => ({
    ...tileStyle(isDragSource),
    backgroundColor: isDragSource ? '#dbeafe' : '#EBF5FB',
    border: isDragSource ? '2px dashed #93c5fd' : '2px solid #AED6F1',
    color: isDragSource ? 'transparent' : '#1a5276',
  });

  const dropIndicator = (
    <span style={{
      display: 'inline-block', width: '3px', height: '36px',
      backgroundColor: '#667eea', borderRadius: '2px', margin: '4px 2px',
      verticalAlign: 'middle', animation: 'sbPulse 0.8s ease-in-out infinite alternate'
    }} />
  );

  const tileCountMatch = targetTileCount && answerWords.length === targetTileCount;
  const tileCountOver = targetTileCount && answerWords.length > targetTileCount;

  return (
    <div>
      {/* Type badge */}
      {questionType === 'translation' && (
        <div style={{ display: 'inline-block', padding: '3px 12px', borderRadius: '12px', fontSize: '0.8rem', fontWeight: '600', marginBottom: '1rem', backgroundColor: '#EDE9FE', color: '#6B21A8' }}>
          🇪🇸 Translate
        </div>
      )}
      {questionType === 'build' && (
        <div style={{ display: 'inline-block', padding: '3px 12px', borderRadius: '12px', fontSize: '0.8rem', fontWeight: '600', marginBottom: '1rem', backgroundColor: '#DBEAFE', color: '#1E40AF' }}>
          🔨 Build a sentence
        </div>
      )}

      {/* Prompt */}
      {questionType === 'translation' && prompt && (
        <div style={{ backgroundColor: '#F5F3FF', border: '1px solid #DDD6FE', borderRadius: '10px', padding: '1rem 1.25rem', marginBottom: '1.25rem', fontSize: 'clamp(1.1rem, 3.5vw, 1.25rem)', fontStyle: 'italic', color: '#5B21B6', lineHeight: '1.5' }}>
          {prompt}
        </div>
      )}
      {questionType === 'build' && (
        <div style={{ backgroundColor: '#EFF6FF', border: '1px solid #BFDBFE', borderRadius: '10px', padding: '1rem 1.25rem', marginBottom: '1.25rem', fontSize: 'clamp(0.95rem, 3vw, 1.05rem)', color: '#1E40AF', lineHeight: '1.5' }}>
          {prompt || "Arrange the words to make a correct sentence. You won't need all of them."}
        </div>
      )}

      {/* ANSWER ZONE */}
      <div style={{ marginBottom: '1.25rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.4rem' }}>
          <div style={{ fontSize: '0.8rem', fontWeight: '600', color: '#666', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
            Your answer
          </div>
          {targetTileCount && (
            <div style={{ fontSize: '0.8rem', fontWeight: '600', color: tileCountMatch ? '#48bb78' : tileCountOver ? '#e53e3e' : '#8B5CF6', display: 'flex', alignItems: 'center', gap: '4px' }}>
              🎯 {answerWords.length}/{targetTileCount} tiles{tileCountMatch && ' ✓'}
            </div>
          )}
        </div>
        <div ref={answerZoneRef} style={{ minHeight: '70px', border: answerWords.length === 0 ? '2px dashed #AED6F1' : '2px solid #AED6F1', borderRadius: '12px', padding: '12px', display: 'flex', flexWrap: 'wrap', alignItems: 'center', alignContent: 'flex-start', backgroundColor: '#F8FBFF' }}>
          {answerWords.length === 0 && !dragWord && (
            <div style={{ width: '100%', textAlign: 'center', color: '#94a3b8', fontSize: 'clamp(0.85rem, 2.5vw, 0.95rem)', padding: '0.5rem 0' }}>
              Tap or drag words here to build your sentence
            </div>
          )}
          {answerWords.map((word, index) => {
            const isDragSource = dragWord && dragWord.id === word.id && dragWord.fromZone === 'answer';
            return (
              <span key={word.id}>
                {dropIndex === index && dragWord && !(dragWord.fromZone === 'answer' && dragWord.id === word.id) && dropIndicator}
                <span
                  ref={el => answerRefs.current[index] = el}
                  onMouseDown={(e) => handlePointerDown(word, 'answer', e)}
                  onTouchStart={(e) => handlePointerDown(word, 'answer', e)}
                  style={answerTileStyle(isDragSource)}
                >
                  {word.text}
                </span>
              </span>
            );
          })}
          {dropIndex !== null && dropIndex >= answerWords.length && dragWord && dropIndicator}
        </div>
      </div>

      {/* WORD BANK */}
      <div style={{ marginBottom: '1.25rem' }}>
        <div style={{ fontSize: '0.8rem', fontWeight: '600', color: '#666', marginBottom: '0.4rem', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
          Word bank
          <span style={{ fontWeight: '400', textTransform: 'none', letterSpacing: 'normal', color: '#999' }}>{' '}— you won't need all the words</span>
        </div>
        <div style={{ border: '1px solid #e2e8f0', borderRadius: '12px', padding: '12px', display: 'flex', flexWrap: 'wrap', minHeight: '50px', backgroundColor: '#fafafa' }}>
          {bankWords.map(word => {
            const isDragSource = dragWord && dragWord.id === word.id && dragWord.fromZone === 'bank';
            return (
              <span key={word.id} onMouseDown={(e) => handlePointerDown(word, 'bank', e)} onTouchStart={(e) => handlePointerDown(word, 'bank', e)} style={tileStyle(isDragSource)}>
                {word.text}
              </span>
            );
          })}
          {bankWords.length === 0 && (
            <div style={{ width: '100%', textAlign: 'center', color: '#cbd5e0', fontSize: '0.85rem' }}>All words placed</div>
          )}
        </div>
      </div>

      {/* FEEDBACK */}
      {feedback && (
        <div style={{ backgroundColor: feedback.correct ? '#d4edda' : '#f8d7da', color: feedback.correct ? '#155724' : '#721c24', padding: '1rem 1.25rem', borderRadius: '10px', fontSize: 'clamp(0.95rem, 3vw, 1.05rem)', lineHeight: '1.6', marginBottom: '1rem', wordWrap: 'break-word' }}>
          {feedback.message}
        </div>
      )}

      {/* AI checking indicator */}
      {isChecking && (
        <div style={{ textAlign: 'center', padding: '0.75rem', color: '#553C9A', fontSize: '0.95rem', border: '2px dashed #EDE9FE', borderRadius: '8px', marginBottom: '1rem' }}>
          🤖 Checking your answer...
        </div>
      )}

      {/* BUTTONS */}
      {showCheckButton && !feedback && (
        <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
          <button
            onClick={checkAnswer}
            disabled={answerWords.length === 0 || isChecking}
            style={{ flex: 1, padding: '1rem', fontSize: 'clamp(1rem, 3.5vw, 1.15rem)', background: 'linear-gradient(135deg, #667eea, #764ba2)', color: 'white', border: 'none', borderRadius: '10px', cursor: 'pointer', fontWeight: '600', opacity: (answerWords.length === 0 || isChecking) ? 0.5 : 1, minWidth: '120px' }}>
            {isChecking ? '🤖 Checking...' : 'Check Answer'}
          </button>
          <button onClick={resetWords} style={{ padding: '1rem 1.25rem', fontSize: 'clamp(1rem, 3.5vw, 1.15rem)', backgroundColor: 'transparent', color: '#666', border: '1px solid #ddd', borderRadius: '10px', cursor: 'pointer', fontWeight: '500' }}>
            🔄 Reset
          </button>
        </div>
      )}

      {!showCheckButton && !feedback && (
        <button onClick={resetWords} style={{ padding: '0.5rem 1rem', fontSize: 'clamp(0.85rem, 2.5vw, 0.9rem)', backgroundColor: 'transparent', color: '#888', border: '1px solid #e2e8f0', borderRadius: '8px', cursor: 'pointer', fontWeight: '500', marginBottom: '0.5rem' }}>
          🔄 Reset words
        </button>
      )}

      {/* Drag ghost */}
      {dragWord && dragPos && (
        <div style={{ position: 'fixed', left: dragPos.x, top: dragPos.y, transform: 'translate(-50%, -50%)', padding: '10px 16px', backgroundColor: '#667eea', color: 'white', borderRadius: '8px', fontSize: 'clamp(1rem, 3.5vw, 1.15rem)', fontWeight: '600', boxShadow: '0 8px 24px rgba(102, 126, 234, 0.4)', pointerEvents: 'none', zIndex: 9999, whiteSpace: 'nowrap' }}>
          {dragWord.text}
        </div>
      )}

      <style>{`
        @keyframes sbPulse { from { opacity: 0.4; } to { opacity: 1; } }
      `}</style>
    </div>
  );
}
