import { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import { supabase } from './supabaseClient';
import SentenceBuildingInput from './components/SentenceBuildingInput';
import MatchingPairs from './components/MatchingPairs';

// ── Constants ─────────────────────────────────────────────────────────────────

const TYPE_INFO = {
  gap_fill:          { emoji: '✏️',  label: 'Gap Fill' },
  multiple_choice:   { emoji: '🔘',  label: 'Multiple Choice' },
  sentence_building: { emoji: '🔧',  label: 'Sentence Building' },
  odd_one_out:       { emoji: '🔍',  label: 'Odd One Out' },
  error_correction:  { emoji: '🔴',  label: 'Error Correction' },
  matching:          { emoji: '🔗',  label: 'Matching' },
  sentence_auction:  { emoji: '🏷️', label: 'Sentence Auction' },
};

const LEVELS = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'];

const LEVEL_COLORS = {
  A1: '#48bb78', A2: '#38a169',
  B1: '#4299e1', B2: '#2b6cb0',
  C1: '#ed8936', C2: '#c05621',
};

const SOURCE_META = {
  question_bank: { emoji: '❓', color: '#667eea' },
  listening:     { emoji: '🎧', color: '#9f7aea' },
  dictation:     { emoji: '🎙️', color: '#48bb78' },
};

const NEW_COUNT = 50;

// ── LocalStorage helpers ──────────────────────────────────────────────────────

const SETS_KEY = 'pep_teacher_sets_v1';
const loadSets  = () => { try { return JSON.parse(localStorage.getItem(SETS_KEY) || '[]'); } catch { return []; } };
const storeSets = (s) => localStorage.setItem(SETS_KEY, JSON.stringify(s));
const genId     = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6);

// ── Fisher-Yates shuffle ──────────────────────────────────────────────────────

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// ── Levenshtein for gap fill fuzzy check ──────────────────────────────────────

function levenshtein(a, b) {
  const m = a.length, n = b.length;
  const dp = Array.from({ length: m + 1 }, (_, i) => [i, ...Array(n).fill(0)]);
  for (let j = 0; j <= n; j++) dp[0][j] = j;
  for (let i = 1; i <= m; i++)
    for (let j = 1; j <= n; j++)
      dp[i][j] = a[i-1] === b[j-1] ? dp[i-1][j-1] : 1 + Math.min(dp[i-1][j], dp[i][j-1], dp[i-1][j-1]);
  return dp[m][n];
}

// ── Shared components ─────────────────────────────────────────────────────────

function Badge({ color = '#718096', children, style = {} }) {
  return (
    <span style={{ background: color, color: 'white', borderRadius: 6, padding: '2px 9px', fontSize: 12, fontWeight: 600, ...style }}>
      {children}
    </span>
  );
}
function LevelBadge({ level }) {
  return <Badge color={LEVEL_COLORS[level] || '#718096'}>{level}</Badge>;
}
function FilterSection({ label, children }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <div style={{ fontSize: 10, fontWeight: 700, color: '#a0aec0', letterSpacing: 1.2, textTransform: 'uppercase', marginBottom: 6 }}>{label}</div>
      {children}
    </div>
  );
}

// ── Result banner ─────────────────────────────────────────────────────────────

function ResultBanner({ state, feedback, correctAnswer, onReset }) {
  if (state === 'idle' || state === 'checking') return null;
  const isCorrect = state === 'correct' || state === 'soft';
  return (
    <div style={{
      marginTop: 12, padding: '10px 14px', borderRadius: 10,
      background: isCorrect ? '#f0fff4' : '#fff5f5',
      border: `2px solid ${isCorrect ? '#48bb78' : '#fc8181'}`,
    }}>
      <div style={{ fontWeight: 700, fontSize: 15, color: isCorrect ? '#276749' : '#c53030', marginBottom: feedback ? 4 : 0 }}>
        {state === 'correct' ? '✅ Correct!' : state === 'soft' ? '✅ Close enough!' : '❌ Not quite'}
      </div>
      {feedback && <div style={{ fontSize: 13, color: '#4a5568', marginBottom: 6 }}>{feedback}</div>}
      {!isCorrect && correctAnswer && (
        <div style={{ fontSize: 13, color: '#276749', fontWeight: 600, marginBottom: 6 }}>
          ✔ {correctAnswer}
        </div>
      )}
      <button onClick={onReset} style={{ fontSize: 12, color: '#667eea', background: 'none', border: 'none', cursor: 'pointer', padding: 0, fontWeight: 700 }}>
        ↺ Try again
      </button>
    </div>
  );
}

// ── Teacher Card ──────────────────────────────────────────────────────────────

function TeacherCard({ item }) {
  if (item._source === 'listening') {
    return (
      <div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, marginBottom: 12 }}>
          <Badge color="#9f7aea">🎧 Listening</Badge>
          <LevelBadge level={item.level} />
          {item.topic && <Badge color="#718096">{item.topic}</Badge>}
        </div>
        <h3 style={{ margin: '0 0 6px', fontSize: 17 }}>{item.title}</h3>
        {item.description && <p style={{ color: '#718096', margin: '0 0 10px', fontSize: 14 }}>{item.description}</p>}
        {item.intro_text && <div style={{ background: '#f0f4ff', borderRadius: 8, padding: 10, marginBottom: 10, lineHeight: 1.6, fontSize: 14 }}>{item.intro_text}</div>}
        {item.audio_url && <audio controls src={item.audio_url} style={{ width: '100%', marginBottom: 10 }} />}
        {item.transcript && (
          <details>
            <summary style={{ cursor: 'pointer', fontWeight: 600, color: '#667eea', fontSize: 14 }}>📄 Transcript</summary>
            <p style={{ marginTop: 8, lineHeight: 1.7, whiteSpace: 'pre-wrap', fontSize: 13, color: '#4a5568' }}>{item.transcript}</p>
          </details>
        )}
      </div>
    );
  }
  if (item._source === 'dictation') {
    return (
      <div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, marginBottom: 12 }}>
          <Badge color="#48bb78">🎙️ Dictation</Badge>
          <LevelBadge level={item.level} />
          {item.topic && <Badge color="#718096">{item.topic}</Badge>}
          {item.excerpt_type && <Badge color="#9f7aea">{item.excerpt_type}</Badge>}
        </div>
        <h3 style={{ margin: '0 0 8px', fontSize: 17 }}>{item.title}</h3>
        {item.audio_url && <audio controls src={item.audio_url} style={{ width: '100%', marginBottom: 10 }} />}
        <div style={{ background: '#f0fff4', border: '2px solid #48bb78', borderRadius: 8, padding: 12, marginBottom: 10 }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: '#38a169', letterSpacing: 1, marginBottom: 4 }}>ANSWER</div>
          <div style={{ fontWeight: 700, fontSize: 17 }}>{item.answer}</div>
        </div>
        {item.sentence_template && (
          <div style={{ background: '#f7fafc', borderRadius: 8, padding: 10, marginBottom: 8 }}>
            <div style={{ fontSize: 10, color: '#718096', letterSpacing: 1, marginBottom: 4 }}>STUDENT SEES</div>
            <div style={{ fontSize: 16 }}>{item.sentence_template}</div>
          </div>
        )}
        {item.hint && <p style={{ color: '#718096', fontSize: 13, margin: 0 }}>💡 Hint: {item.hint}</p>}
      </div>
    );
  }
  const opts = Array.isArray(item.options) ? item.options : [];
  const correct = item.correct_answer;
  return (
    <div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, marginBottom: 12, alignItems: 'center' }}>
        <Badge color="#667eea">{TYPE_INFO[item.type]?.emoji} {TYPE_INFO[item.type]?.label || item.type}</Badge>
        <LevelBadge level={item.level} />
        {item.topic && <Badge color="#718096">{item.topic}</Badge>}
        {item.language && item.language !== 'en' && <Badge color="#f6ad55">🌐 {item.language}</Badge>}
        <span style={{ marginLeft: 'auto', color: '#a0aec0', fontSize: 12 }}>Q{item.question_number}</span>
      </div>
      <p style={{ fontSize: 16, fontWeight: 500, lineHeight: 1.65, margin: '0 0 14px' }}>{item.question}</p>
      {opts.length > 0 && (
        <div style={{ marginBottom: 10 }}>
          {opts.map((opt, i) => {
            const isCorrect = opt === correct;
            return (
              <div key={i} style={{ padding: '7px 12px', borderRadius: 8, marginBottom: 5, background: isCorrect ? '#f0fff4' : '#f7fafc', border: `${isCorrect ? 2 : 1}px solid ${isCorrect ? '#48bb78' : '#e2e8f0'}`, fontWeight: isCorrect ? 600 : 400, color: isCorrect ? '#276749' : '#2d3748', display: 'flex', alignItems: 'center', gap: 8, fontSize: 14 }}>
                {isCorrect ? '✅' : '○'} {opt}
              </div>
            );
          })}
        </div>
      )}
      {opts.length === 0 && correct && (
        <div style={{ background: '#f0fff4', border: '2px solid #48bb78', borderRadius: 8, padding: 12, marginBottom: 10 }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: '#38a169', letterSpacing: 1, marginBottom: 4 }}>ANSWER</div>
          <div style={{ fontWeight: 700, fontSize: 16 }}>{correct}</div>
        </div>
      )}
      {item.informal_feedback && <div style={{ background: '#fffbeb', borderRadius: 8, padding: 9, fontSize: 13, color: '#92400e', marginBottom: 8 }}>💬 {item.informal_feedback}</div>}
      {item.acceptable_alternatives && Array.isArray(item.acceptable_alternatives) && item.acceptable_alternatives.length > 0 && (
        <div style={{ fontSize: 13, color: '#718096' }}>Also accepted: {item.acceptable_alternatives.join(', ')}</div>
      )}
    </div>
  );
}

// ── Interactive Question (Student view with real marking) ─────────────────────

// ── Focus-ring fix for OOO + EC tiles (mirrors RandomPracticeExercise) ────────

const TB_STYLE_ID = 'tb-focus-fix';
if (typeof document !== 'undefined' && !document.getElementById(TB_STYLE_ID)) {
  const _s = document.createElement('style');
  _s.id = TB_STYLE_ID;
  _s.textContent = `
    .tb-ooo-option, .tb-ooo-option:focus, .tb-ooo-option:focus-visible,
    .tb-ec-tile, .tb-ec-tile:focus, .tb-ec-tile:focus-visible {
      outline: none !important;
      -webkit-tap-highlight-color: transparent !important;
    }
  `;
  document.head.appendChild(_s);
}

// ── Module-level helpers (mirrors RandomPracticeExercise) ─────────────────────

const _isFuzzy = (studentAnswer, correctAnswers) => {
  for (const correct of correctAnswers) {
    const dist = levenshtein(studentAnswer, correct);
    if (dist === 1) return true;
    if (dist === 2 && correct.length >= 6) return true;
  }
  return false;
};
const _normaliseEC         = (s) => s.toLowerCase().trim().replace(/\s+/g, ' ');
const _normaliseDictation  = (s) => s.toLowerCase().trim().replace(/[.,!?;:'"]/g, '').replace(/\s+/g, ' ');
const _findErrorIndex      = (words, correctAnswer) => {
  const cw = correctAnswer.trim().split(/\s+/);
  for (let i = 0; i < Math.max(words.length, cw.length); i++) {
    if (!words[i] || !cw[i] || words[i].toLowerCase() !== cw[i].toLowerCase())
      return { index: i, correctWord: cw[i] || '(missing)' };
  }
  return { index: -1, correctWord: '' };
};
const _qLang = (q) => q?.topic === 'spanish' ? 'es' : 'en';
const _getSbProps = (q) => {
  if (!q) return {};
  const options = Array.isArray(q.options) ? q.options : JSON.parse(q.options || '[]');
  const hasPrompt = q.question && q.question.trim() !== '';
  return { words: options, questionType: hasPrompt ? 'translation' : 'build', prompt: hasPrompt ? q.question : null, correctSentences: [q.correct_answer || ''], explanation: q.explanation || '' };
};

function InteractiveQuestion({ item: q }) {
  const [feedback,           setFeedback]           = useState(null);
  const [isChecking,         setIsChecking]          = useState(false);
  const [userAnswer,         setUserAnswer]          = useState('');
  const [selectedOption,     setSelectedOption]      = useState(null);
  const [oooSelected,        setOooSelected]         = useState(null);
  const [ecSelectedWordIndex,setEcSelectedWordIndex] = useState(null);
  const [ecCorrection,       setEcCorrection]        = useState('');
  const [sbFeedback,         setSbFeedback]          = useState(null);
  const [matchingDone,       setMatchingDone]        = useState(false);
  const [audioPlayed,        setAudioPlayed]         = useState(false);
  const audioRef = useRef(null);

  const reset = () => {
    setFeedback(null); setUserAnswer(''); setSelectedOption(null);
    setOooSelected(null); setEcSelectedWordIndex(null); setEcCorrection('');
    setSbFeedback(null); setMatchingDone(false); setAudioPlayed(false); setIsChecking(false);
  };

  // ── Mark: gap fill (verbatim logic from RPE) ──
  const checkAnswer = async () => {
    let isCorrect = false, feedbackType = 'incorrect', explanation = q.explanation || '';
    if (q.type === 'gap_fill') {
      const answer = userAnswer.toLowerCase().trim();
      const correctAnswer = q.correct_answer?.toLowerCase().trim() || '';
      const correctAnswers = [correctAnswer];
      if (correctAnswer && answer === correctAnswer) { isCorrect = true; feedbackType = 'correct'; }
      if (!isCorrect && q.informal_accepted && Array.isArray(q.informal_accepted)) {
        const inf = q.informal_accepted.map(a => a.toLowerCase().trim());
        if (inf.includes(answer)) { isCorrect = true; feedbackType = 'informal'; if (q.informal_feedback) explanation = q.informal_feedback + ' ' + explanation; }
      }
      if (!isCorrect && q.acceptable_alternatives && Array.isArray(q.acceptable_alternatives)) {
        const alt = q.acceptable_alternatives.find(a => a.answer && a.answer.toLowerCase().trim() === answer);
        if (alt) { isCorrect = true; feedbackType = 'alternative'; explanation = alt.feedback + ' ' + explanation; }
      }
      if (!isCorrect && _isFuzzy(answer, correctAnswers)) { isCorrect = true; feedbackType = 'fuzzy'; }
      if (!isCorrect) {
        setIsChecking(true);
        try {
          const res  = await fetch('/api/mark-gap-fill', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ question: q.question, correctAnswer, studentAnswer: userAnswer.trim(), language: _qLang(q) }) });
          const data = await res.json();
          if (data?.valid) { isCorrect = true; feedbackType = 'soft-pass'; if (data.reason) explanation = data.reason + ' ' + explanation; }
        } catch(e) {}
        setIsChecking(false);
      }
      setFeedback({ type: feedbackType, isCorrect, studentAnswer: userAnswer.trim(), correctAnswer: correctAnswer || 'N/A', explanation });
    } else if (q.type === 'multiple_choice') {
      const mcCorrect = q.correct_answer || '';
      isCorrect = selectedOption === mcCorrect;
      setFeedback({ type: isCorrect ? 'correct' : 'incorrect', isCorrect, studentAnswer: selectedOption || '', correctAnswer: mcCorrect, explanation });
    }
  };

  // ── Mark: dictation ──
  const checkDictationAnswer = async () => {
    if (!userAnswer.trim() || isChecking) return;
    const answer = userAnswer.trim(), correct = q.correct_answer || '';
    let isCorrect = false, feedbackType = 'incorrect', feedbackMsg = '';
    if (answer.toLowerCase() === correct.toLowerCase()) { isCorrect = true; feedbackType = 'correct'; }
    if (!isCorrect && _normaliseDictation(answer) === _normaliseDictation(correct)) { isCorrect = true; feedbackType = 'correct'; }
    if (!isCorrect && _isFuzzy(_normaliseDictation(answer), [_normaliseDictation(correct)])) { isCorrect = true; feedbackType = 'fuzzy'; }
    if (!isCorrect) {
      setIsChecking(true);
      try {
        const res  = await fetch('/api/mark-dictation', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ correctAnswer: correct, studentAnswer: answer }) });
        const data = await res.json();
        if (data?.accepted) { isCorrect = true; feedbackType = 'soft-pass'; }
      } catch(e) {}
      setIsChecking(false);
    }
    if (feedbackType === 'correct')    feedbackMsg = `✅ Correct!`;
    else if (feedbackType === 'fuzzy') feedbackMsg = `✅ Correct — watch your spelling! The answer was: "${correct}"`;
    else if (feedbackType === 'soft-pass') feedbackMsg = `✅ Close enough! The model answer was: "${correct}"`;
    else                               feedbackMsg = `❌ The answer was: "${correct}"`;
    setFeedback({ type: feedbackType, isCorrect, message: feedbackMsg, studentAnswer: answer, correctAnswer: correct });
  };

  // ── Mark: OOO ──
  const handleOOOSelect = (option) => {
    if (feedback) return;
    setOooSelected(option);
    const oddOne = q.correct_answer || '';
    const isCorrect = option.toLowerCase().trim() === oddOne.toLowerCase().trim();
    setFeedback({ message: isCorrect ? `✅ Correct! "${oddOne}" is the odd one out. ${q.explanation || ''}` : `❌ Not quite. "${oddOne}" is the odd one out. ${q.explanation || ''}`, type: isCorrect ? 'correct' : 'incorrect', isCorrect, oddOne });
  };

  // ── Mark: EC ──
  const handleECWordTap = (index) => { if (feedback || isChecking) return; setEcSelectedWordIndex(index); setEcCorrection(''); };
  const checkECAnswer = async () => {
    if (ecSelectedWordIndex === null || !ecCorrection.trim() || isChecking) return;
    const words = q.question.trim().split(/\s+/);
    const correctAnswer = q.correct_answer || '';
    const correctedWords = [...words];
    const originalWord = words[ecSelectedWordIndex];
    const trailingPunct = originalWord.match(/[.,!?;:]+$/)?.[0] || '';
    const cleanCorrection = ecCorrection.trim().replace(/[.,!?;:]+$/, '');
    correctedWords[ecSelectedWordIndex] = cleanCorrection + trailingPunct;
    const correctedSentence = correctedWords.join(' ');
    const isExactMatch = _normaliseEC(correctedSentence) === _normaliseEC(correctAnswer);
    const errorInfo = _findErrorIndex(words, correctAnswer);
    if (isExactMatch) {
      setFeedback({ type: 'correct', message: `✅ Correct! ${q.explanation || ''}`, isCorrect: true, errorIndex: ecSelectedWordIndex, correctWord: cleanCorrection + trailingPunct });
      return;
    }
    setIsChecking(true);
    let aiResult = null;
    try {
      const res = await fetch('/api/mark-correction', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ originalSentence: q.question, errorWord: words[ecSelectedWordIndex], studentReplacement: ecCorrection.trim(), correctAnswerSentence: correctAnswer, language: _qLang(q) }) });
      aiResult = await res.json();
    } catch(e) {}
    setIsChecking(false);
    if (aiResult?.valid) {
      setFeedback({ type: 'soft-pass', message: `✅ Good — that works too! ${aiResult.reason || ''} The model answer was "${errorInfo.correctWord}". ${q.explanation || ''}`, isCorrect: true, errorIndex: ecSelectedWordIndex, correctWord: cleanCorrection + trailingPunct });
      return;
    }
    const foundRightWord = ecSelectedWordIndex === errorInfo.index;
    setFeedback({ type: 'incorrect', message: foundRightWord ? `❌ Good — you found the error in "${words[errorInfo.index]}", but "${ecCorrection.trim()}" doesn't quite work here. ${aiResult?.reason ? aiResult.reason + ' ' : ''}It should be "${errorInfo.correctWord}". ${q.explanation || ''}` : `❌ The error is actually in "${words[errorInfo.index]}" — it should be "${errorInfo.correctWord}". ${q.explanation || ''}`, isCorrect: false, errorIndex: errorInfo.index, correctWord: errorInfo.correctWord });
  };

  // ── Mark: sentence building ──
  const handleSentenceBuildingResult = (isCorrect, isSoft = false, userAns = '') => {
    if (isCorrect) {
      const msg = `✅ Correct! ${q.explanation || ''}`;
      setSbFeedback({ correct: true, message: msg });
      setFeedback({ message: msg, type: 'correct', isCorrect: true });
    } else {
      const displaySentence = (q.correct_answer || '').replace(/ ([.,?!;:])/g, '$1').replace(/^(\w)/, m => m.toUpperCase());
      const msg = `❌ Not quite. The correct answer is: "${displaySentence}" — ${q.explanation || ''}`;
      setSbFeedback({ correct: false, message: msg });
      setFeedback({ message: msg, type: 'incorrect', isCorrect: false });
    }
  };

  // ── Mark: matching ──
  const handleMatchingResult = (isCorrect, wrongAttempts) => {
    setMatchingDone(true);
    const msg = isCorrect ? `✅ Perfect matching! ${q.explanation || ''}` : `👍 All matched! You had ${wrongAttempts} wrong attempt${wrongAttempts !== 1 ? 's' : ''}. ${q.explanation || ''}`;
    setFeedback({ message: msg, type: isCorrect ? 'correct' : 'incorrect', isCorrect });
  };

  // ── Styles (verbatim from RPE) ──
  const getOOOStyle = (option) => {
    const base = { padding: 'clamp(8px, 2.5vw, 10px) clamp(12px, 3vw, 16px)', borderRadius: '8px', border: 'none', boxShadow: 'inset 0 0 0 2px #e2e8f0', cursor: feedback ? 'default' : 'pointer', fontSize: 'clamp(0.9rem, 3.2vw, 1.1rem)', fontWeight: '500', textAlign: 'center', transition: 'all 0.2s ease', backgroundColor: 'white', color: '#2d3748', minHeight: '55px', display: 'flex', alignItems: 'center', justifyContent: 'center', userSelect: 'none', outline: 'none' };
    if (!feedback) {
      if (oooSelected === option) return { ...base, boxShadow: 'inset 0 0 0 2px #667eea', backgroundColor: '#EDE9FE', color: '#553C9A' };
      return base;
    }
    const oddOne = feedback.oddOne || '';
    const isOdd = option.toLowerCase().trim() === oddOne.toLowerCase().trim();
    const wasSelected = oooSelected === option;
    if (isOdd) return { ...base, boxShadow: 'inset 0 0 0 2px #48bb78, 0 0 0 3px rgba(72, 187, 120, 0.3)', backgroundColor: '#f0fff4', color: '#276749' };
    if (wasSelected && !feedback.isCorrect) return { ...base, boxShadow: 'inset 0 0 0 2px #f56565', backgroundColor: '#fff5f5', color: '#c53030' };
    return { ...base, opacity: 0.5 };
  };

  const getECTileStyle = (index) => {
    const base = { display: 'inline-flex', alignItems: 'center', justifyContent: 'center', padding: 'clamp(8px, 2.5vw, 10px) clamp(12px, 3vw, 16px)', margin: '4px 3px', borderRadius: '8px', fontSize: 'clamp(0.9rem, 3.2vw, 1.1rem)', fontWeight: '500', cursor: (feedback || isChecking) ? 'default' : 'pointer', transition: 'all 0.15s ease', userSelect: 'none', backgroundColor: 'white', border: '2px solid #e2e8f0', color: '#2d3748', outline: 'none' };
    if (feedback) {
      const errorIdx = feedback.errorIndex;
      const isPass = feedback.type === 'correct' || feedback.type === 'soft-pass';
      if (index === errorIdx && isPass)  return { ...base, backgroundColor: '#f0fff4', border: '2px solid #48bb78', color: '#276749', textDecoration: 'line-through', textDecorationColor: '#c53030' };
      if (index === errorIdx && !isPass) return { ...base, backgroundColor: '#fff5f5', border: '2px solid #f56565', color: '#c53030', textDecoration: 'line-through', textDecorationColor: '#c53030' };
      if (index === ecSelectedWordIndex && ecSelectedWordIndex !== errorIdx) return { ...base, backgroundColor: '#fff5f5', border: '2px solid #f56565', color: '#c53030', opacity: 0.6 };
      return { ...base, opacity: 0.6 };
    }
    if (index === ecSelectedWordIndex) return { ...base, backgroundColor: '#EDE9FE', border: '2px solid #667eea', color: '#553C9A' };
    return base;
  };

  // ── Derived ──
  const ecWords       = q.type === 'error_correction' ? q.question.trim().split(/\s+/) : [];
  const matchingPairs = q.type === 'matching' ? (Array.isArray(q.options) ? q.options : JSON.parse(q.options || '[]')) : null;

  // ── Structured feedback (gap fill + MC) — verbatim from RPE ──
  const renderStructuredFeedback = () => {
    if (!feedback || (q.type !== 'gap_fill' && q.type !== 'multiple_choice')) return null;
    const isFuzzy = feedback.type === 'fuzzy', isSoftPass = feedback.type === 'soft-pass', isCorrect = feedback.isCorrect;
    const borderColor = (isFuzzy || isSoftPass) ? '#f6ad55' : isCorrect ? '#48bb78' : '#f56565';
    const bgColor     = (isFuzzy || isSoftPass) ? '#fffbeb' : isCorrect ? '#f0fff4' : '#fff5f5';
    const headerBg    = (isFuzzy || isSoftPass) ? '#f6ad55' : isCorrect ? '#48bb78' : '#f56565';
    const headerText  = isFuzzy ? '✅ Correct — but watch your spelling!' : isSoftPass ? '✅ Also correct!' : isCorrect ? '✅ Correct!' : '❌ Incorrect';
    return (
      <div style={{ marginTop: '1rem', borderRadius: '12px', border: `2px solid ${borderColor}`, overflow: 'hidden', fontSize: 'clamp(0.95rem, 3vw, 1.05rem)' }}>
        <div style={{ backgroundColor: headerBg, color: 'white', padding: '0.6rem 1rem', fontWeight: '700', fontSize: 'clamp(0.95rem, 3vw, 1.05rem)' }}>{headerText}</div>
        <div style={{ backgroundColor: bgColor, padding: '1rem' }}>
          <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.6rem', alignItems: 'flex-start' }}>
            <span style={{ fontWeight: '600', color: '#4a5568', whiteSpace: 'nowrap', minWidth: '110px' }}>Your answer:</span>
            <span style={{ fontWeight: '600', color: isCorrect ? '#276749' : '#c53030', wordBreak: 'break-word' }}>{feedback.studentAnswer || '(no answer)'}</span>
          </div>
          <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.75rem', alignItems: 'flex-start' }}>
            <span style={{ fontWeight: '600', color: '#4a5568', whiteSpace: 'nowrap', minWidth: '110px' }}>Correct answer:</span>
            <span style={{ fontWeight: '700', color: '#276749', wordBreak: 'break-word' }}>{feedback.correctAnswer}</span>
          </div>
          {isFuzzy && <div style={{ borderTop: `1px solid ${borderColor}`, paddingTop: '0.75rem', color: '#744210', lineHeight: '1.6' }}>✏️ Almost perfect — watch your spelling next time!</div>}
          {!isFuzzy && feedback.explanation && <div style={{ borderTop: `1px solid ${borderColor}`, paddingTop: '0.75rem', color: '#4a5568', lineHeight: '1.6' }}>💡 {feedback.explanation}</div>}
        </div>
      </div>
    );
  };

  // ── Listening exercise: audio-only focus view ──
  if (q._source === 'listening') {
    return (
      <div style={{ backgroundColor: 'white', padding: 'clamp(1.5rem, 5vw, 2.5rem)', borderRadius: '16px', boxShadow: '0 4px 16px rgba(0,0,0,0.08)', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', alignItems: 'center' }}>
          <div style={{ padding: '4px 12px', borderRadius: '20px', fontSize: '0.8rem', fontWeight: '600', backgroundColor: '#EDE9FE', color: '#553C9A' }}>🎧 Listening</div>
          {q.level && <div style={{ padding: '4px 12px', borderRadius: '20px', fontSize: '0.8rem', fontWeight: '600', backgroundColor: q.level.startsWith('A') ? '#c6f6d5' : q.level.startsWith('B') ? '#bee3f8' : '#feebc8', color: q.level.startsWith('A') ? '#48bb78' : q.level.startsWith('B') ? '#4299e1' : '#ed8936' }}>{q.level}</div>}
        </div>
        {q.title && <div style={{ fontSize: 'clamp(1.2rem, 4vw, 1.5rem)', color: '#2C3E50', fontWeight: '700' }}>{q.title}</div>}
        {q.intro_text && <div style={{ fontSize: 'clamp(1rem, 3.5vw, 1.1rem)', color: '#4a5568', lineHeight: '1.6' }}>{q.intro_text}</div>}
        {q.description && !q.intro_text && <div style={{ fontSize: 'clamp(1rem, 3.5vw, 1.1rem)', color: '#4a5568', lineHeight: '1.6' }}>{q.description}</div>}
        {q.audio_url && (
          <div>
            <audio controls src={q.audio_url} style={{ width: '100%', borderRadius: '8px' }} />
          </div>
        )}
        {q.transcript && (
          <details style={{ backgroundColor: '#f8f9fa', borderRadius: '10px', padding: '1rem' }}>
            <summary style={{ cursor: 'pointer', fontWeight: '600', color: '#553C9A', fontSize: '0.9rem', marginBottom: '0.5rem' }}>📄 Transcript</summary>
            <div style={{ fontSize: '0.95rem', color: '#4a5568', lineHeight: '1.8', marginTop: '0.75rem', whiteSpace: 'pre-wrap' }}>{q.transcript}</div>
          </details>
        )}
      </div>
    );
  }

  // ── Render ──
  return (
    <div style={{ backgroundColor: 'white', padding: 'clamp(1.5rem, 5vw, 2.5rem)', borderRadius: '16px', boxShadow: '0 4px 16px rgba(0,0,0,0.08)', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>

      {/* Badges — verbatim from RPE */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', alignItems: 'center' }}>
        {q.type !== 'sentence_building' && (
          <div style={{ padding: '4px 12px', borderRadius: '20px', fontSize: '0.8rem', fontWeight: '600',
            backgroundColor: q.type === 'gap_fill' ? '#fff3cd' : q.type === 'odd_one_out' ? '#E0F2FE' : q.type === 'error_correction' ? '#FEE2E2' : q.type === 'matching' ? '#D1FAE5' : q.type === 'dictation' ? '#EDE9FE' : '#d4edda',
            color: q.type === 'gap_fill' ? '#856404' : q.type === 'odd_one_out' ? '#0369A1' : q.type === 'error_correction' ? '#DC2626' : q.type === 'matching' ? '#065F46' : q.type === 'dictation' ? '#553C9A' : '#155724',
          }}>
            {q.type === 'gap_fill' ? '✏️ Gap Fill' : q.type === 'odd_one_out' ? '🔍 Odd One Out' : q.type === 'error_correction' ? '🚨 Error Correction' : q.type === 'matching' ? '🔗 Matching' : q.type === 'dictation' ? '⌨️ Dictation' : '📝 Multiple Choice'}
          </div>
        )}
        {q.level && (
          <div style={{ padding: '4px 12px', borderRadius: '20px', fontSize: '0.8rem', fontWeight: '600',
            backgroundColor: q.level.startsWith('A') ? '#c6f6d5' : q.level.startsWith('B') ? '#bee3f8' : '#feebc8',
            color: q.level.startsWith('A') ? '#48bb78' : q.level.startsWith('B') ? '#4299e1' : '#ed8936',
          }}>{q.level}</div>
        )}
        {q.topic && q.type !== 'dictation' && (
          <div style={{ padding: '4px 12px', borderRadius: '20px', fontSize: '0.8rem', fontWeight: '600',
            backgroundColor: q.topic === 'question_forms' ? '#FEE2E2' : q.topic === 'punctuation' ? '#FEE2E2' : '#f0f0f0',
            color: q.topic === 'question_forms' ? '#DC2626' : q.topic === 'punctuation' ? '#DC2626' : '#555',
          }}>
            {q.topic === 'question_forms' ? '❓ ' : ''}{q.topic.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}
          </div>
        )}
        {(q.type === 'error_correction' || q.type === 'gap_fill' || q.type === 'sentence_building' || q.type === 'dictation') && (
          <div style={{ padding: '4px 12px', borderRadius: '20px', fontSize: '0.75rem', fontWeight: '600', backgroundColor: '#EDE9FE', color: '#553C9A' }}>🤖 AI marked</div>
        )}
      </div>

      {/* Question text — same condition as RPE */}
      {q.type !== 'sentence_building' && q.type !== 'error_correction' && q.type !== 'matching' && q.type !== 'dictation' && q.type !== 'sentence_auction' && q.question && (
        <div style={{ fontSize: 'clamp(1.15rem, 4vw, 1.4rem)', color: '#2C3E50', lineHeight: '1.6', fontWeight: '500', wordWrap: 'break-word', overflowWrap: 'break-word' }}>
          {q.question}
        </div>
      )}

      <div style={{ flex: 1 }}>

        {/* GAP FILL */}
        {q.type === 'gap_fill' && !feedback && (
          <input type="text" value={userAnswer} onChange={e => setUserAnswer(e.target.value)}
            onKeyPress={e => e.key === 'Enter' && !isChecking && checkAnswer()}
            placeholder="Type your answer..." disabled={isChecking} autoFocus
            style={{ width: '100%', padding: '1.2rem', fontSize: 'clamp(1.1rem, 4vw, 1.3rem)', borderRadius: '10px', border: '2px solid #e0e0e0', boxSizing: 'border-box', color: '#2C3E50', opacity: isChecking ? 0.6 : 1 }} />
        )}

        {/* MULTIPLE CHOICE — before */}
        {q.type === 'multiple_choice' && !feedback && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {q.options.map((option, index) => (
              <button key={index} onClick={() => setSelectedOption(option)}
                style={{ padding: '1.2rem', fontSize: 'clamp(1.05rem, 3.5vw, 1.2rem)', textAlign: 'left', backgroundColor: selectedOption === option ? '#3498DB' : 'white', color: selectedOption === option ? 'white' : '#2C3E50', border: `2px solid ${selectedOption === option ? '#3498DB' : '#e0e0e0'}`, borderRadius: '10px', cursor: 'pointer', transition: 'all 0.2s', wordWrap: 'break-word', width: '100%', boxSizing: 'border-box', fontWeight: '500' }}
              >{option}</button>
            ))}
          </div>
        )}

        {/* MULTIPLE CHOICE — after */}
        {q.type === 'multiple_choice' && feedback && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginBottom: '0.5rem' }}>
            {q.options.map((option, index) => {
              const isCorrectOption = option === feedback.correctAnswer;
              const wasSelected     = option === feedback.studentAnswer;
              let bg = '#f7fafc', border = '#e2e8f0', color = '#a0aec0';
              if (isCorrectOption)                        { bg = '#f0fff4'; border = '#48bb78'; color = '#276749'; }
              else if (wasSelected && !feedback.isCorrect){ bg = '#fff5f5'; border = '#f56565'; color = '#c53030'; }
              return (
                <div key={index} style={{ padding: '0.9rem 1.2rem', fontSize: 'clamp(1rem, 3.5vw, 1.1rem)', backgroundColor: bg, color, border: `2px solid ${border}`, borderRadius: '10px', fontWeight: isCorrectOption || wasSelected ? '600' : '400', wordWrap: 'break-word' }}>
                  {isCorrectOption ? '✓ ' : wasSelected && !feedback.isCorrect ? '✗ ' : ''}{option}
                </div>
              );
            })}
          </div>
        )}

        {/* SENTENCE BUILDING */}
        {q.type === 'sentence_building' && (
          <SentenceBuildingInput key={q.id} {..._getSbProps(q)} disabled={!!feedback} onResult={handleSentenceBuildingResult} feedback={sbFeedback} showCheckButton={true} onAnswerReady={() => {}} />
        )}

        {/* SENTENCE AUCTION */}
        {q.type === 'sentence_auction' && (() => {
          const sentences = Array.isArray(q.options) ? q.options : (() => { try { return JSON.parse(q.options || '[]'); } catch { return []; } })();
          const revealed = !!feedback;
          return (
            <div>
              {q.question && q.question.trim() && (
                <div style={{ backgroundColor: '#FFFBEB', border: '2px solid #F6AD55', borderRadius: '10px', padding: '0.9rem 1.25rem', marginBottom: '1.25rem', fontSize: 'clamp(0.95rem, 3vw, 1.05rem)', color: '#6B4C00', lineHeight: '1.6', fontWeight: '500', fontStyle: 'italic' }}>
                  🏷️ {q.question}
                </div>
              )}
              <p style={{ fontSize: '0.88rem', color: '#718096', margin: '0 0 1rem', fontStyle: 'italic' }}>
                {revealed ? 'Answers revealed — green = correct, red = incorrect.' : 'Which sentences are correct? Tap "Reveal Answers" when ready.'}
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '1.25rem' }}>
                {sentences.map((s, idx) => {
                  const bg     = !revealed ? 'white'    : s.correct ? '#f0fff4' : '#fff5f5';
                  const border = !revealed ? '#e2e8f0' : s.correct ? '#48bb78' : '#f56565';
                  const colour = !revealed ? '#2d3748'  : s.correct ? '#276749' : '#c53030';
                  return (
                    <div key={idx} style={{ borderRadius: '10px', border: `2px solid ${border}`, background: bg, padding: '0.9rem 1.1rem', transition: 'all 0.3s' }}>
                      <div style={{ fontSize: 'clamp(0.95rem, 3vw, 1.05rem)', color: colour, fontWeight: '500', lineHeight: '1.55', marginBottom: revealed && s.explanation ? '0.5rem' : 0 }}>
                        {revealed && <span style={{ marginRight: '7px' }}>{s.correct ? '✅' : '❌'}</span>}
                        {s.sentence}
                      </div>
                      {revealed && s.explanation && (
                        <div style={{ fontSize: '0.875rem', color: s.correct ? '#2f855a' : '#9b2c2c', lineHeight: '1.5', opacity: 0.9 }}>
                          {s.explanation}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
              {!revealed
                ? <button onClick={() => setFeedback({ type: 'revealed' })} style={{ width: '100%', padding: '0.9rem', fontSize: '1rem', fontWeight: '700', background: 'linear-gradient(135deg,#667eea,#764ba2)', color: 'white', border: 'none', borderRadius: '10px', cursor: 'pointer' }}>🔍 Reveal Answers</button>
                : null
              }
            </div>
          );
        })()}

        {/* ODD ONE OUT */}
        {q.type === 'odd_one_out' && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '12px', marginBottom: '1rem' }}>
            {(Array.isArray(q.options) ? q.options : JSON.parse(q.options || '[]')).map((option, idx) => (
              <div key={idx} className="tb-ooo-option" tabIndex={-1} onClick={() => handleOOOSelect(option)} style={getOOOStyle(option)}
                onMouseEnter={e => { if (!feedback) { e.currentTarget.style.boxShadow = 'inset 0 0 0 2px #667eea'; e.currentTarget.style.transform = 'translateY(-1px)'; } }}
                onMouseLeave={e => { if (!feedback && oooSelected !== option) { e.currentTarget.style.boxShadow = 'inset 0 0 0 2px #e2e8f0'; e.currentTarget.style.transform = 'none'; } }}
              >{option}</div>
            ))}
          </div>
        )}

        {/* ERROR CORRECTION */}
        {q.type === 'error_correction' && (
          <div>
            <div style={{ fontSize: '0.9rem', color: '#718096', marginBottom: '1rem', fontStyle: 'italic' }}>
              {isChecking ? '🤖 Checking your answer...' : !feedback ? '👆 Tap the word that is wrong, then type the correction below.' : feedback.isCorrect ? 'Well done!' : 'See the correction below.'}
            </div>
            <div style={{ backgroundColor: '#F8FBFF', padding: '1.25rem', borderRadius: '10px', border: '1px solid #AED6F1', lineHeight: '2.4', marginBottom: '1.25rem', display: 'flex', flexWrap: 'wrap', alignItems: 'center' }}>
              {ecWords.map((word, index) => (
                <span key={index} className="tb-ec-tile" tabIndex={-1} onClick={() => handleECWordTap(index)} style={getECTileStyle(index)}
                  onMouseEnter={e => { if (!feedback && !isChecking && ecSelectedWordIndex !== index) { e.currentTarget.style.borderColor = '#667eea'; e.currentTarget.style.backgroundColor = '#f7f7ff'; } }}
                  onMouseLeave={e => { if (!feedback && !isChecking && ecSelectedWordIndex !== index) { e.currentTarget.style.borderColor = '#e2e8f0'; e.currentTarget.style.backgroundColor = 'white'; } }}
                >{word}</span>
              ))}
              {feedback && feedback.errorIndex >= 0 && (
                <div style={{ width: '100%', marginTop: '0.75rem', fontSize: '1rem', paddingLeft: '4px' }}>
                  <span style={{ color: '#c53030', textDecoration: 'line-through', fontWeight: 500 }}>{ecWords[feedback.errorIndex]}</span>
                  <span style={{ margin: '0 8px', color: '#718096' }}>→</span>
                  <span style={{ color: '#276749', fontWeight: 600 }}>{feedback.correctWord}</span>
                </div>
              )}
            </div>
            {ecSelectedWordIndex !== null && !feedback && !isChecking && (
              <div style={{ display: 'flex', gap: '10px', marginBottom: '1rem', alignItems: 'stretch' }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: '0.75rem', color: '#718096', fontWeight: 600, marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Your correction for "{ecWords[ecSelectedWordIndex]}":</div>
                  <input type="text" value={ecCorrection} onChange={e => setEcCorrection(e.target.value)}
                    onKeyPress={e => e.key === 'Enter' && checkECAnswer()}
                    placeholder="Type the correct word..." autoFocus
                    style={{ width: '100%', padding: '0.9rem 1rem', fontSize: 'clamp(1rem, 3.5vw, 1.15rem)', borderRadius: '8px', border: '2px solid #667eea', boxSizing: 'border-box', color: '#2d3748', fontWeight: 500, backgroundColor: '#EDE9FE' }} />
                </div>
                <button onClick={checkECAnswer} disabled={!ecCorrection.trim() || isChecking}
                  style={{ padding: '0 1.5rem', background: ecCorrection.trim() ? 'linear-gradient(135deg, #667eea, #764ba2)' : '#cbd5e0', color: 'white', border: 'none', borderRadius: '8px', cursor: ecCorrection.trim() ? 'pointer' : 'not-allowed', fontWeight: 600, fontSize: '1rem', alignSelf: 'flex-end', minHeight: '48px' }}>Check</button>
              </div>
            )}
            {ecSelectedWordIndex === null && !feedback && !isChecking && (
              <div style={{ textAlign: 'center', padding: '1rem', color: '#A0AEC0', fontSize: '0.95rem', border: '2px dashed #E2E8F0', borderRadius: '8px' }}>👆 Tap the word you think is wrong</div>
            )}
          </div>
        )}

        {/* MATCHING */}
        {q.type === 'matching' && matchingPairs && (
          <div>
            {q.question && q.question.trim() && (
              <div style={{ fontSize: 'clamp(1.05rem, 3.5vw, 1.2rem)', color: '#2C3E50', lineHeight: '1.6', fontWeight: '500', marginBottom: '1rem', wordWrap: 'break-word' }}>
                {q.question}
              </div>
            )}
            <MatchingPairs key={q.id} pairs={matchingPairs} disabled={!!feedback} onResult={handleMatchingResult} />
          </div>
        )}

        {/* DICTATION */}
        {q.type === 'dictation' && (
          <div>
            <audio ref={audioRef} src={q.audio_url} style={{ display: 'none' }} />
            <div style={{ textAlign: 'center', marginBottom: '1.25rem' }}>
              <button onClick={() => { if (audioRef.current) { audioRef.current.currentTime = 0; audioRef.current.play(); setAudioPlayed(true); } }}
                style={{ padding: '0.9rem 2rem', background: 'linear-gradient(135deg, #667eea, #764ba2)', color: 'white', border: 'none', borderRadius: '10px', cursor: 'pointer', fontSize: 'clamp(1rem, 3.5vw, 1.1rem)', fontWeight: '600', boxShadow: '0 2px 8px rgba(102,126,234,0.35)' }}>
                🔊 {audioPlayed ? 'Play Again' : 'Play Audio'}
              </button>
              {!audioPlayed && <div style={{ marginTop: '0.5rem', fontSize: '0.8rem', color: '#a0aec0' }}>👆 Tap to hear the audio</div>}
            </div>
            {q.sentence_template && !feedback && (
              <div style={{ backgroundColor: '#EBF8FF', border: '2px solid #90CDF4', borderRadius: '10px', padding: '1rem 1.25rem', marginBottom: '1rem', fontSize: 'clamp(1rem, 3.5vw, 1.15rem)', color: '#2C3E50', lineHeight: '1.6', fontWeight: '500' }}>
                {q.sentence_template}
              </div>
            )}
            {!feedback && (
              <input type="text" value={userAnswer} onChange={e => setUserAnswer(e.target.value)}
                onKeyPress={e => e.key === 'Enter' && !isChecking && userAnswer.trim() && checkDictationAnswer()}
                placeholder={q.excerpt_type === 'sentence' ? 'Type the full sentence you heard...' : 'Type the word or phrase you heard...'}
                disabled={isChecking}
                style={{ width: '100%', padding: '1.2rem', fontSize: 'clamp(1.1rem, 4vw, 1.3rem)', borderRadius: '10px', border: '2px solid #e0e0e0', boxSizing: 'border-box', color: '#2C3E50', opacity: isChecking ? 0.6 : 1 }} />
            )}
            {feedback && (
              <div style={{ backgroundColor: feedback.isCorrect ? (feedback.type === 'fuzzy' || feedback.type === 'soft-pass' ? '#fffbeb' : '#f0fff4') : '#fff5f5', border: `2px solid ${feedback.isCorrect ? (feedback.type === 'fuzzy' || feedback.type === 'soft-pass' ? '#f6ad55' : '#48bb78') : '#f56565'}`, borderRadius: '10px', padding: '1rem', marginTop: '0.5rem', fontSize: 'clamp(1rem, 3vw, 1.1rem)', lineHeight: '1.6', color: feedback.isCorrect ? (feedback.type === 'fuzzy' || feedback.type === 'soft-pass' ? '#744210' : '#276749') : '#c53030', fontWeight: '500' }}>
                {feedback.message}
              </div>
            )}
          </div>
        )}

        {/* AI checking indicator */}
        {isChecking && ['gap_fill', 'error_correction', 'dictation'].includes(q.type) && (
          <div style={{ marginTop: '1rem', textAlign: 'center', padding: '1rem', color: '#553C9A', fontSize: '0.95rem', border: '2px dashed #EDE9FE', borderRadius: '8px' }}>🤖 Checking your answer...</div>
        )}

        {renderStructuredFeedback()}

        {/* EC feedback */}
        {feedback && q.type === 'error_correction' && (
          <div style={{ backgroundColor: feedback.type === 'soft-pass' ? '#fffbeb' : feedback.isCorrect ? '#d4edda' : '#f8d7da', color: feedback.type === 'soft-pass' ? '#744210' : feedback.isCorrect ? '#155724' : '#721c24', padding: '1.2rem', borderRadius: '10px', marginTop: '1rem', fontSize: 'clamp(1rem, 3vw, 1.1rem)', lineHeight: '1.6', wordWrap: 'break-word', overflowWrap: 'break-word', border: feedback.type === 'soft-pass' ? '1px solid #fbd38d' : 'none' }}>
            {feedback.message}
          </div>
        )}

        {/* Simple feedback: OOO, matching */}
        {feedback && !['error_correction', 'sentence_building', 'gap_fill', 'multiple_choice', 'dictation', 'sentence_auction'].includes(q.type) && (
          <div style={{ backgroundColor: feedback.isCorrect ? '#d4edda' : '#f8d7da', color: feedback.isCorrect ? '#155724' : '#721c24', padding: '1.2rem', borderRadius: '10px', marginTop: '1rem', fontSize: 'clamp(1rem, 3vw, 1.1rem)', lineHeight: '1.6', wordWrap: 'break-word', overflowWrap: 'break-word' }}>
            {feedback.message}
          </div>
        )}
      </div>

      {/* Buttons */}
      <div style={{ marginTop: '1.5rem' }}>
        {!feedback && !['sentence_building', 'odd_one_out', 'error_correction', 'matching', 'sentence_auction'].includes(q.type) && (
          <button
            onClick={q.type === 'dictation' ? checkDictationAnswer : checkAnswer}
            disabled={isChecking || (!userAnswer.trim() && q.type !== 'multiple_choice') || (q.type === 'multiple_choice' && !selectedOption)}
            style={{ padding: '1.2rem', fontSize: 'clamp(1.1rem, 4vw, 1.25rem)', backgroundColor: '#2C3E50', color: 'white', border: 'none', borderRadius: '10px', cursor: 'pointer', width: '100%', fontWeight: '600', opacity: (isChecking || (!userAnswer.trim() && q.type !== 'multiple_choice') || (q.type === 'multiple_choice' && !selectedOption)) ? 0.5 : 1 }}>
            {isChecking ? '🤖 Checking...' : 'Check Answer'}
          </button>
        )}
        {feedback && (
          <button onClick={reset}
            style={{ padding: '1.2rem', fontSize: 'clamp(1.1rem, 4vw, 1.25rem)', backgroundColor: '#718096', color: 'white', border: 'none', borderRadius: '10px', cursor: 'pointer', width: '100%', fontWeight: '600' }}>
            ↺ Try again
          </button>
        )}
      </div>
    </div>
  );
}

// ── Focus Mode ────────────────────────────────────────────────────────────────

function FocusMode({ items, index, onChangeIndex, previewMode, setPreviewMode, onExit }) {
  const item = items[index];
  if (!item) return null;
  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 2000, background: '#f8f9fa', display: 'flex', flexDirection: 'column' }}>
      <div style={{ background: 'white', borderBottom: '1px solid #e2e8f0', padding: '10px 20px', display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0 }}>
        <div style={{ display: 'flex', background: '#f7fafc', borderRadius: 7, padding: 3, gap: 2 }}>
          {[['teacher', '👨‍🏫 Teacher'], ['student', '👤 Student']].map(([mode, label]) => (
            <button key={mode} onClick={() => setPreviewMode(mode)} style={{ padding: '5px 14px', borderRadius: 5, border: 'none', background: previewMode === mode ? '#667eea' : 'transparent', color: previewMode === mode ? 'white' : '#718096', cursor: 'pointer', fontSize: 13, fontWeight: previewMode === mode ? 700 : 400 }}>
              {label}
            </button>
          ))}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginLeft: 'auto' }}>
          <button onClick={() => onChangeIndex(index - 1)} disabled={index === 0} style={{ padding: '6px 16px', borderRadius: 7, border: '1px solid #e2e8f0', background: index === 0 ? '#f7fafc' : 'white', color: index === 0 ? '#cbd5e0' : '#4a5568', cursor: index === 0 ? 'default' : 'pointer', fontSize: 15, fontWeight: 700 }}>← Prev</button>
          <span style={{ fontSize: 13, color: '#718096', minWidth: 70, textAlign: 'center' }}>{index + 1} / {items.length}</span>
          <button onClick={() => onChangeIndex(index + 1)} disabled={index === items.length - 1} style={{ padding: '6px 16px', borderRadius: 7, border: '1px solid #e2e8f0', background: index === items.length - 1 ? '#f7fafc' : 'white', color: index === items.length - 1 ? '#cbd5e0' : '#4a5568', cursor: index === items.length - 1 ? 'default' : 'pointer', fontSize: 15, fontWeight: 700 }}>Next →</button>
        </div>
        <button onClick={onExit} style={{ padding: '6px 14px', borderRadius: 7, border: '1px solid #e2e8f0', background: 'white', color: '#4a5568', cursor: 'pointer', fontSize: 13, marginLeft: 8 }}>✕ Exit focus</button>
      </div>
      <div style={{ flex: 1, overflowY: 'auto', display: 'flex', justifyContent: 'center', alignItems: 'flex-start', padding: '2rem 1rem' }}>
        <div style={{ width: '100%', maxWidth: 700, background: 'white', borderRadius: 16, padding: '2rem', boxShadow: '0 4px 32px rgba(0,0,0,0.10)' }}>
          {previewMode === 'teacher'
            ? <TeacherCard item={item} />
            : <InteractiveQuestion key={item._rowKey} item={item} />}
        </div>
      </div>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export default function TeacherBrowse({ user, globalLang = 'en' }) {
  const [filters, setFilters] = useState({ source: 'all', levels: [], types: [], topic: '', lang: globalLang, qFrom: '', qTo: '', newOnly: false });
  const [maxQNumber,   setMaxQNumber]   = useState(null);
  const [results,      setResults]      = useState([]);
  const [loading,      setLoading]      = useState(false);
  const [hasSearched,  setHasSearched]  = useState(false);
  const [selected,     setSelected]     = useState(new Set());
  const [previewItem,  setPreviewItem]  = useState(null);
  const [previewMode,  setPreviewMode]  = useState('student');
  const [focusMode,    setFocusMode]    = useState(false);
  const [focusIndex,   setFocusIndex]   = useState(0);
  const [sets,          setSets]          = useState(loadSets);
  const [activeSet,     setActiveSet]     = useState(null);
  const [showSetsPanel, setShowSetsPanel] = useState(false);
  const [addToSetId,    setAddToSetId]    = useState('');
  const [newSetName,    setNewSetName]    = useState('');

  const setFilter   = (k, v) => setFilters(f => ({ ...f, [k]: v }));
  const toggleLevel = (lv) => setFilter('levels', filters.levels.includes(lv) ? filters.levels.filter(l => l !== lv) : [...filters.levels, lv]);
  const toggleType  = (tp) => setFilter('types',  filters.types.includes(tp)  ? filters.types.filter(t => t !== tp)  : [...filters.types, tp]);

  useEffect(() => {
    supabase.from('question_bank').select('question_number').order('question_number', { ascending: false }).limit(1).single()
      .then(({ data }) => { if (data) setMaxQNumber(data.question_number); });
  }, []);

  const search = useCallback(async (overrideFilters) => {
    const f = overrideFilters || filters;
    setLoading(true); setHasSearched(true); setActiveSet(null); setPreviewItem(null); setSelected(new Set());
    const newThreshold = maxQNumber != null ? maxQNumber - NEW_COUNT + 1 : null;
    const all = [];
    if (f.source === 'all' || f.source === 'question_bank') {
      let q = supabase.from('question_bank').select('*').order('question_number');
      if (f.lang === 'en') q = q.in('language', ['en', 'both']);
      else if (f.lang === 'es') q = q.in('language', ['es', 'both']);
      if (f.levels.length) q = q.in('level', f.levels);
      if (f.types.length)  q = q.in('type',  f.types);
      if (f.topic)  q = q.ilike('topic', `%${f.topic}%`);
      if (f.qFrom)  q = q.gte('question_number', parseInt(f.qFrom));
      if (f.qTo)    q = q.lte('question_number', parseInt(f.qTo));
      if (f.newOnly && newThreshold) q = q.gte('question_number', newThreshold);
      const { data } = await q.limit(200);
      if (data) data.forEach(r => all.push({ ...r, _source: 'question_bank', _rowKey: `qb_${r.id}` }));
    }
    if (f.source === 'all' || f.source === 'listening') {
      let q = supabase.from('listening_exercises').select('*').order('title');
      if (f.levels.length) q = q.in('level', f.levels);
      if (f.topic) q = q.ilike('topic', `%${f.topic}%`);
      const { data } = await q.limit(100);
      if (data) data.forEach(r => all.push({ ...r, _source: 'listening', _rowKey: `li_${r.id}` }));
    }
    if (f.source === 'all' || f.source === 'dictation') {
      let q = supabase.from('dictation_exercises').select('*').order('title');
      if (f.lang === 'en') q = q.in('language', ['en', 'both']);
      else if (f.lang === 'es') q = q.in('language', ['es', 'both']);
      if (f.levels.length) q = q.in('level', f.levels);
      if (f.topic) q = q.ilike('topic', `%${f.topic}%`);
      const { data } = await q.limit(100);
      if (data) data.forEach(r => all.push({ ...r, _source: 'dictation', _rowKey: `di_${r.id}`, type: 'dictation', correct_answer: r.answer }));
    }
    setResults(all); setLoading(false);
  }, [filters, maxQNumber]);

  const loadSet = async (set) => {
    setActiveSet({ id: set.id, name: set.name }); setLoading(true); setHasSearched(true); setPreviewItem(null); setSelected(new Set());
    const all = [];
    const qbIds = set.items.filter(i => i.source === 'question_bank').map(i => i.id);
    const liIds = set.items.filter(i => i.source === 'listening').map(i => i.id);
    const diIds = set.items.filter(i => i.source === 'dictation').map(i => i.id);
    if (qbIds.length) { const { data } = await supabase.from('question_bank').select('*').in('id', qbIds); if (data) data.forEach(r => all.push({ ...r, _source: 'question_bank', _rowKey: `qb_${r.id}` })); }
    if (liIds.length) { const { data } = await supabase.from('listening_exercises').select('*').in('id', liIds); if (data) data.forEach(r => all.push({ ...r, _source: 'listening', _rowKey: `li_${r.id}` })); }
    if (diIds.length) { const { data } = await supabase.from('dictation_exercises').select('*').in('id', diIds); if (data) data.forEach(r => all.push({ ...r, _source: 'dictation', _rowKey: `di_${r.id}`, type: 'dictation', correct_answer: r.answer })); }
    const orderMap = {}; set.items.forEach((item, idx) => { orderMap[item.id] = idx; });
    all.sort((a, b) => (orderMap[a.id] ?? 99) - (orderMap[b.id] ?? 99));
    setResults(all); setLoading(false);
  };

  const toggleSelect   = (key) => setSelected(prev => { const n = new Set(prev); n.has(key) ? n.delete(key) : n.add(key); return n; });
  const selectAll      = () => setSelected(new Set(results.map(r => r._rowKey)));
  const clearSelection = () => setSelected(new Set());
  const focusItems     = selected.size > 0 ? results.filter(r => selected.has(r._rowKey)) : results;
  const enterFocus     = (startIndex = 0) => { setFocusIndex(startIndex); setFocusMode(true); };

  const saveSelectionToSet = (targetId, name) => {
    const newItems = results.filter(r => selected.has(r._rowKey)).map(r => ({ source: r._source, id: r.id, label: r._source === 'question_bank' ? `Q${r.question_number}: ${(r.question || '').slice(0, 55)}` : (r.title || r.id) }));
    let updated;
    if (targetId === '__new__') { updated = [...sets, { id: genId(), name, createdAt: new Date().toISOString(), items: newItems }]; }
    else { updated = sets.map(s => { if (s.id !== targetId) return s; const existing = new Set(s.items.map(i => i.id)); return { ...s, items: [...s.items, ...newItems.filter(i => !existing.has(i.id))] }; }); }
    setSets(updated); storeSets(updated); setSelected(new Set()); setAddToSetId(''); setNewSetName('');
  };

  const deleteSet = (id) => {
    const updated = sets.filter(s => s.id !== id); setSets(updated); storeSets(updated);
    if (activeSet?.id === id) { setActiveSet(null); setResults([]); setHasSearched(false); }
  };

  const removeFromActiveSet = (itemId) => {
    if (!activeSet) return;
    const updated = sets.map(s => s.id !== activeSet.id ? s : { ...s, items: s.items.filter(i => i.id !== itemId) });
    setSets(updated); storeSets(updated); setResults(prev => prev.filter(r => r.id !== itemId));
  };

  // ── Sidebar ───────────────────────────────────────────────────────────────

  const sidebar = (
    <div style={{ width: 220, flexShrink: 0, background: 'white', borderRadius: 12, padding: '1.1rem', boxShadow: '0 2px 10px rgba(0,0,0,0.07)', alignSelf: 'flex-start', position: 'sticky', top: 12 }}>

      <FilterSection label="My Sets">
        <button onClick={() => setShowSetsPanel(v => !v)} style={{ display: 'block', width: '100%', textAlign: 'left', padding: '6px 9px', borderRadius: 7, border: `1px solid ${showSetsPanel ? '#667eea' : '#e2e8f0'}`, background: showSetsPanel ? '#f0f4ff' : 'white', color: showSetsPanel ? '#667eea' : '#4a5568', cursor: 'pointer', fontSize: 13, fontWeight: showSetsPanel ? 700 : 500 }}>
          📂 {sets.length === 0 ? 'No sets yet' : `${sets.length} set${sets.length !== 1 ? 's' : ''}`}
        </button>
        {showSetsPanel && (
          <div style={{ marginTop: 6, display: 'flex', flexDirection: 'column', gap: 4 }}>
            {sets.length === 0
              ? <p style={{ color: '#a0aec0', fontSize: 11, margin: 0, lineHeight: 1.5 }}>Select questions then save them to a set.</p>
              : sets.map(s => (
                <div key={s.id} style={{ display: 'flex', alignItems: 'center', gap: 5, background: '#f7fafc', border: '1px solid #e2e8f0', borderRadius: 6, padding: '4px 7px' }}>
                  <button onClick={() => { loadSet(s); setShowSetsPanel(false); }} style={{ flex: 1, background: 'none', border: 'none', cursor: 'pointer', color: '#667eea', fontSize: 12, fontWeight: 700, textAlign: 'left', padding: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.name}</button>
                  <span style={{ color: '#a0aec0', fontSize: 11, flexShrink: 0 }}>{s.items.length}</span>
                  <button onClick={() => deleteSet(s.id)} style={{ background: 'none', border: 'none', color: '#e53e3e', cursor: 'pointer', fontSize: 14, padding: 0, lineHeight: 1, flexShrink: 0 }}>×</button>
                </div>
              ))
            }
          </div>
        )}
      </FilterSection>

      <div style={{ borderTop: '1px solid #f0f0f0', margin: '2px 0 14px' }} />

      <FilterSection label="Source">
        {[['all', '🗂️ All'], ['question_bank', '❓ Questions'], ['listening', '🎧 Listening'], ['dictation', '🎙️ Dictation']].map(([val, lbl]) => (
          <button key={val} onClick={() => setFilter('source', val)} style={{ display: 'block', width: '100%', textAlign: 'left', padding: '5px 8px', borderRadius: 6, border: 'none', background: filters.source === val ? '#667eea' : 'transparent', color: filters.source === val ? 'white' : '#4a5568', cursor: 'pointer', marginBottom: 1, fontSize: 13 }}>{lbl}</button>
        ))}
      </FilterSection>

      <FilterSection label="Language">
        <div style={{ display: 'flex', gap: 4 }}>
          {[['en', '🇬🇧'], ['es', '🇪🇸'], ['both', '🌐']].map(([val, lbl]) => (
            <button key={val} onClick={() => setFilter('lang', val)} style={{ flex: 1, padding: '5px 0', borderRadius: 6, border: '1px solid #e2e8f0', background: filters.lang === val ? '#667eea' : 'white', color: filters.lang === val ? 'white' : '#4a5568', cursor: 'pointer', fontSize: 16 }}>{lbl}</button>
          ))}
        </div>
      </FilterSection>

      <FilterSection label="Level">
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
          {LEVELS.map(lv => (
            <button key={lv} onClick={() => toggleLevel(lv)} style={{ padding: '3px 9px', borderRadius: 6, border: '1px solid #e2e8f0', background: filters.levels.includes(lv) ? LEVEL_COLORS[lv] : 'white', color: filters.levels.includes(lv) ? 'white' : '#4a5568', cursor: 'pointer', fontSize: 12, fontWeight: 600 }}>{lv}</button>
          ))}
        </div>
      </FilterSection>

      {(filters.source === 'all' || filters.source === 'question_bank') && (
        <FilterSection label="Type">
          {Object.entries(TYPE_INFO).map(([key, { emoji, label }]) => (
            <button key={key} onClick={() => toggleType(key)} style={{ display: 'block', width: '100%', textAlign: 'left', padding: '4px 7px', borderRadius: 6, border: 'none', background: filters.types.includes(key) ? '#edf2ff' : 'transparent', color: filters.types.includes(key) ? '#667eea' : '#4a5568', cursor: 'pointer', marginBottom: 1, fontSize: 12 }}>
              {filters.types.includes(key) ? '✓' : '○'} {emoji} {label}
            </button>
          ))}
        </FilterSection>
      )}

      <FilterSection label="Topic keyword">
        <input value={filters.topic} onChange={e => setFilter('topic', e.target.value)} onKeyDown={e => e.key === 'Enter' && search()} placeholder="e.g. comparatives" style={{ width: '100%', padding: '5px 8px', border: '1px solid #e2e8f0', borderRadius: 6, fontSize: 13, boxSizing: 'border-box' }} />
      </FilterSection>

      {(filters.source === 'all' || filters.source === 'question_bank') && (
        <FilterSection label="Q number range">
          <input value={filters.qFrom} onChange={e => setFilter('qFrom', e.target.value)} placeholder="From" style={{ width: '100%', padding: '5px 8px', border: '1px solid #e2e8f0', borderRadius: 6, fontSize: 13, boxSizing: 'border-box', marginBottom: 5 }} />
          <input value={filters.qTo}   onChange={e => setFilter('qTo', e.target.value)}   placeholder="To"   style={{ width: '100%', padding: '5px 8px', border: '1px solid #e2e8f0', borderRadius: 6, fontSize: 13, boxSizing: 'border-box' }} />
        </FilterSection>
      )}

      {(filters.source === 'all' || filters.source === 'question_bank') && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 14 }}>
          <input type="checkbox" id="newOnly" checked={filters.newOnly} onChange={e => setFilter('newOnly', e.target.checked)} style={{ accentColor: '#667eea', width: 15, height: 15 }} />
          <label htmlFor="newOnly" style={{ fontSize: 12, cursor: 'pointer', color: '#4a5568' }}>
            New only{maxQNumber != null && <span style={{ color: '#a0aec0' }}> (last {NEW_COUNT})</span>}
          </label>
        </div>
      )}

      <button onClick={() => search()} disabled={loading} style={{ width: '100%', padding: '9px', background: '#667eea', color: 'white', border: 'none', borderRadius: 8, fontSize: 14, fontWeight: 700, cursor: 'pointer' }}>
        {loading ? '…' : '🔍 Search'}
      </button>
      <button onClick={() => { setFilters({ source: 'all', levels: [], types: [], topic: '', lang: globalLang, qFrom: '', qTo: '', newOnly: false }); setResults([]); setHasSearched(false); setActiveSet(null); setSelected(new Set()); }} style={{ width: '100%', padding: '7px', background: 'transparent', color: '#718096', border: '1px solid #e2e8f0', borderRadius: 8, fontSize: 12, cursor: 'pointer', marginTop: 5 }}>
        Clear all
      </button>
    </div>
  );

  // ── Results list ──────────────────────────────────────────────────────────

  const resultsList = (
    <div style={{ flex: 1, minWidth: 0 }}>
      {activeSet && (
        <div style={{ background: '#f0f4ff', border: '2px solid #667eea', borderRadius: 10, padding: '9px 14px', marginBottom: 10, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ fontWeight: 700, color: '#667eea', fontSize: 14 }}>📂 {activeSet.name}</span>
          <button onClick={() => { setActiveSet(null); setResults([]); setHasSearched(false); }} style={{ background: 'none', border: 'none', color: '#718096', cursor: 'pointer', fontSize: 20, lineHeight: 1 }}>×</button>
        </div>
      )}
      {hasSearched && !loading && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8, flexWrap: 'wrap' }}>
          <span style={{ fontWeight: 600, color: '#4a5568', fontSize: 13 }}>{results.length} result{results.length !== 1 ? 's' : ''}</span>
          {results.length > 0 && (
            <>
              <button onClick={selectAll} style={{ fontSize: 12, color: '#667eea', background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline' }}>Select all</button>
              {selected.size > 0 && (
                <>
                  <button onClick={clearSelection} style={{ fontSize: 12, color: '#718096', background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline' }}>Clear</button>
                  <span style={{ background: '#667eea', color: 'white', borderRadius: 12, padding: '2px 10px', fontSize: 12, fontWeight: 600 }}>{selected.size} selected</span>
                </>
              )}
              <button onClick={() => enterFocus(0)} style={{ marginLeft: 'auto', padding: '4px 12px', borderRadius: 7, border: '1px solid #667eea', background: 'white', color: '#667eea', cursor: 'pointer', fontSize: 12, fontWeight: 700 }}>
                {selected.size > 0 ? `⛶ Focus (${selected.size})` : '⛶ Focus all'}
              </button>
            </>
          )}
        </div>
      )}
      {selected.size > 0 && (
        <div style={{ background: '#f0f4ff', border: '1px solid #c3d1f7', borderRadius: 10, padding: '9px 12px', marginBottom: 10, display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 7 }}>
          <span style={{ fontWeight: 600, color: '#4a5568', fontSize: 13 }}>💾 Save {selected.size} item{selected.size !== 1 ? 's' : ''}:</span>
          <select value={addToSetId} onChange={e => setAddToSetId(e.target.value)} style={{ padding: '4px 8px', border: '1px solid #e2e8f0', borderRadius: 6, fontSize: 13, background: 'white' }}>
            <option value="">— pick a set —</option>
            <option value="__new__">+ New set…</option>
            {sets.map(s => <option key={s.id} value={s.id}>{s.name} ({s.items.length})</option>)}
          </select>
          {addToSetId === '__new__' && (
            <input value={newSetName} onChange={e => setNewSetName(e.target.value)} placeholder="Set name" autoFocus style={{ padding: '4px 8px', border: '1px solid #e2e8f0', borderRadius: 6, fontSize: 13 }} onKeyDown={e => e.key === 'Enter' && newSetName && saveSelectionToSet('__new__', newSetName)} />
          )}
          {((addToSetId && addToSetId !== '__new__') || (addToSetId === '__new__' && newSetName)) && (
            <button onClick={() => saveSelectionToSet(addToSetId, newSetName)} style={{ padding: '4px 12px', background: '#667eea', color: 'white', border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: 13, fontWeight: 700 }}>Save ✓</button>
          )}
        </div>
      )}
      {loading && <div style={{ textAlign: 'center', padding: '3rem', color: '#718096' }}>Searching…</div>}
      {!loading && hasSearched && results.length === 0 && <div style={{ textAlign: 'center', padding: '3rem', color: '#718096' }}><div style={{ fontSize: 28, marginBottom: 8 }}>🔍</div>No results — try adjusting the filters.</div>}
      {!loading && !hasSearched && <div style={{ textAlign: 'center', padding: '3rem', color: '#718096' }}><div style={{ fontSize: 28, marginBottom: 8 }}>👆</div>Set your filters and hit Search, or open a saved set.</div>}
      {!loading && results.map((item, idx) => {
        const isSel    = selected.has(item._rowKey);
        const isActive = previewItem?._rowKey === item._rowKey;
        const srcMeta  = SOURCE_META[item._source];
        const title    = item._source === 'question_bank' ? (item.question || '').slice(0, 110) : (item.title || '');
        const sub      = item._source === 'question_bank' ? `Q${item.question_number} · ${TYPE_INFO[item.type]?.label || item.type}` : (item.description || item.answer || '').slice(0, 70);
        return (
          <div key={item._rowKey} onClick={() => enterFocus(idx)} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '9px 11px', background: 'white', border: '1px solid #e2e8f0', borderRadius: 10, marginBottom: 5, cursor: 'pointer' }}>
            <div onClick={e => { e.stopPropagation(); toggleSelect(item._rowKey); }} style={{ flexShrink: 0, width: 18, height: 18, border: `2px solid ${isSel ? '#667eea' : '#cbd5e0'}`, borderRadius: 4, background: isSel ? '#667eea' : 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontSize: 11 }}>
              {isSel && '✓'}
            </div>
            <div style={{ flexShrink: 0, background: srcMeta.color, color: 'white', borderRadius: 5, padding: '2px 6px', fontSize: 12 }}>{srcMeta.emoji}</div>
            {item.level && <div style={{ flexShrink: 0, background: LEVEL_COLORS[item.level] || '#718096', color: 'white', borderRadius: 5, padding: '2px 7px', fontSize: 11, fontWeight: 700, minWidth: 26, textAlign: 'center' }}>{item.level}</div>}
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 500, color: '#2d3748', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{title}</div>
              <div style={{ fontSize: 11, color: '#718096', marginTop: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{sub}</div>
            </div>
            <button onClick={e => { e.stopPropagation(); enterFocus(idx); }} title="Open in focus mode" style={{ flexShrink: 0, background: 'none', border: 'none', color: '#a0aec0', cursor: 'pointer', fontSize: 15, padding: '1px 5px', lineHeight: 1 }}>⛶</button>
            {activeSet && <button onClick={e => { e.stopPropagation(); removeFromActiveSet(item.id); }} style={{ flexShrink: 0, background: 'none', border: 'none', color: '#e53e3e', cursor: 'pointer', fontSize: 17, padding: '1px 5px', lineHeight: 1 }}>×</button>}
          </div>
        );
      })}
    </div>
  );

  // ── Preview panel ─────────────────────────────────────────────────────────

  const previewPanel = previewItem && (
    <div style={{ width: 380, flexShrink: 0, background: 'white', borderRadius: 12, boxShadow: '0 4px 24px rgba(0,0,0,0.11)', alignSelf: 'flex-start', position: 'sticky', top: 12, overflow: 'hidden' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', borderBottom: '1px solid #e2e8f0' }}>
        <div style={{ display: 'flex', background: '#f7fafc', borderRadius: 7, padding: 3, gap: 2 }}>
          {[['teacher', '👨‍🏫 Teacher'], ['student', '👤 Student']].map(([mode, label]) => (
            <button key={mode} onClick={() => setPreviewMode(mode)} style={{ padding: '4px 12px', borderRadius: 5, border: 'none', background: previewMode === mode ? '#667eea' : 'transparent', color: previewMode === mode ? 'white' : '#718096', cursor: 'pointer', fontSize: 12, fontWeight: previewMode === mode ? 700 : 400 }}>{label}</button>
          ))}
        </div>
        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          <button onClick={() => { const idx = results.findIndex(r => r._rowKey === previewItem._rowKey); enterFocus(idx >= 0 ? idx : 0); }} title="Expand to focus mode" style={{ background: 'none', border: '1px solid #e2e8f0', borderRadius: 6, color: '#667eea', cursor: 'pointer', fontSize: 14, padding: '2px 8px' }}>⛶</button>
          <button onClick={() => setPreviewItem(null)} style={{ background: 'none', border: 'none', color: '#a0aec0', cursor: 'pointer', fontSize: 20, lineHeight: 1 }}>×</button>
        </div>
      </div>
      <div style={{ padding: '1.1rem', maxHeight: 'calc(100vh - 180px)', overflowY: 'auto' }}>
        {previewMode === 'teacher'
          ? <TeacherCard item={previewItem} />
          : <InteractiveQuestion key={previewItem._rowKey} item={previewItem} />}
      </div>
    </div>
  );

  return (
    <div style={{ minHeight: '100vh', background: '#f8f9fa' }}>
      {focusMode && <FocusMode items={focusItems} index={focusIndex} onChangeIndex={setFocusIndex} previewMode={previewMode} setPreviewMode={setPreviewMode} onExit={() => setFocusMode(false)} />}
      <div style={{ maxWidth: 1300, margin: '0 auto', padding: '12px 1rem 2rem', display: 'flex', gap: 10, alignItems: 'flex-start' }}>
        {sidebar}
        {resultsList}
        {previewPanel}
      </div>
    </div>
  );
}
