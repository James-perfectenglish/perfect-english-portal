import { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import { supabase } from './supabaseClient';
import SentenceBuildingInput from './components/SentenceBuildingInput';
import { LevelBadge, TypeBadge, AiMarkedBadge, TagBadges } from './components/BadgePill';
import MatchingPairs from './components/MatchingPairs';
import CrosswordGame from './CrosswordGame';
import WordSearchGame from './WordSearchGame';
import WordleGame from './WordleGame';
import ConnectionsGame from './ConnectionsGame';

const TYPE_INFO = {
  gap_fill:          { emoji: '✏️',  label: 'Gap Fill' },
  multiple_choice:   { emoji: '🔘',  label: 'Multiple Choice' },
  sentence_building: { emoji: '🔧',  label: 'Sentence Building' },
  odd_one_out:       { emoji: '🔍',  label: 'Odd One Out' },
  error_correction:  { emoji: '🔴',  label: 'Error Correction' },
  matching:          { emoji: '🔗',  label: 'Matching' },
  sentence_auction:  { emoji: '🔨',  label: 'Sentence Auction' },
};

const LEVELS = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'];

const LEVEL_COLORS = {
  A1: '#48bb78', A2: '#48bb78',
  B1: '#4299e1', B2: '#4299e1',
  C1: '#ed8936', C2: '#ed8936',
};

const SOURCE_META = {
  question_bank: { emoji: '❓', color: '#667eea' },
  listening:     { emoji: '🎧', color: '#9f7aea' },
  dictation:     { emoji: '⌨️', color: '#48bb78' },
};

// Connections colour ranks
const RANK_STYLE = {
  1: { bg: '#f9df6d', text: '#2d2000', border: '#e6c840', label: 'Easiest' },
  2: { bg: '#a0c35a', text: '#1a2d00', border: '#7aaa2a', label: 'Medium' },
  3: { bg: '#b0c4ef', text: '#0a1f4d', border: '#7a9de0', label: 'Tricky' },
  4: { bg: '#ba81c5', text: '#2d0040', border: '#9a55a8', label: 'Hardest' },
};

// Wordle keyboard layouts and tile colours
const EN_KB = [
  ['Q','W','E','R','T','Y','U','I','O','P'],
  ['A','S','D','F','G','H','J','K','L'],
  ['ENTER','Z','X','C','V','B','N','M','⌫'],
];
const ES_KB = [
  ['Q','W','E','R','T','Y','U','I','O','P'],
  ['A','S','D','F','G','H','J','K','L','Ñ'],
  ['ENTER','Z','X','C','V','B','N','M','⌫'],
];
const WC = { correct: '#538d4e', present: '#b59f3b', absent: '#787c7e' };

const NEW_COUNT = 50;

// ALL_TAGS removed — tags now fetched live from question_bank on mount (see availableTags state)

const SETS_KEY = 'pep_teacher_sets_v1';
const loadSets  = () => { try { return JSON.parse(localStorage.getItem(SETS_KEY) || '[]'); } catch { return []; } };
const storeSets = (s) => localStorage.setItem(SETS_KEY, JSON.stringify(s));
const genId     = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6);

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function levenshtein(a, b) {
  const m = a.length, n = b.length;
  const dp = Array.from({ length: m + 1 }, (_, i) => [i, ...Array(n).fill(0)]);
  for (let j = 0; j <= n; j++) dp[0][j] = j;
  for (let i = 1; i <= m; i++)
    for (let j = 1; j <= n; j++)
      dp[i][j] = a[i-1] === b[j-1] ? dp[i-1][j-1] : 1 + Math.min(dp[i-1][j], dp[i][j-1], dp[i-1][j-1]);
  return dp[m][n];
}

function fmtDate(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr + 'T12:00:00');
  return d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
}

function Badge({ color = '#718096', children, style = {} }) {
  return (
    <span style={{ background: color, color: 'white', borderRadius: 6, padding: '2px 9px', fontSize: 12, fontWeight: 600, ...style }}>
      {children}
    </span>
  );
}

function FilterSection({ label, children, collapsible = false, open, onToggle }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <div
        onClick={collapsible ? onToggle : undefined}
        style={{
          fontSize: 10, fontWeight: 700, color: '#a0aec0', letterSpacing: 1.2,
          textTransform: 'uppercase', marginBottom: collapsible && !open ? 0 : 6,
          cursor: collapsible ? 'pointer' : 'default',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          userSelect: 'none',
        }}
      >
        <span>{label}</span>
        {collapsible && <span style={{ fontSize: 9, opacity: 0.7 }}>{open ? '▲' : '▼'}</span>}
      </div>
      {(!collapsible || open) && children}
    </div>
  );
}

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
          <Badge color="#48bb78">⌨️ Dictation</Badge>
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
      {item.tags && item.tags.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 10 }}>
          <TagBadges tags={item.tags} />
        </div>
      )}
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
      {item.explanation && (
        <div style={{ background: '#fffff0', border: '1px solid #ecc94b', borderRadius: 8, padding: 9, fontSize: 13, color: '#744210', marginBottom: 8 }}>
          💡 {item.explanation}
        </div>
      )}
      {item.informal_feedback && <div style={{ background: '#fffbeb', borderRadius: 8, padding: 9, fontSize: 13, color: '#92400e', marginBottom: 8 }}>💬 {item.informal_feedback}</div>}
      {item.acceptable_alternatives && Array.isArray(item.acceptable_alternatives) && item.acceptable_alternatives.length > 0 && (
        <div style={{ fontSize: 13, color: '#718096' }}>Also accepted: {item.acceptable_alternatives.join(', ')}</div>
      )}
    </div>
  );
}

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
    @keyframes tb-shake {
      0%, 100% { transform: translateX(0); }
      20% { transform: translateX(-8px); }
      40% { transform: translateX(8px); }
      60% { transform: translateX(-6px); }
      80% { transform: translateX(6px); }
    }
  `;
  document.head.appendChild(_s);
}

const _isFuzzy = (studentAnswer, correctAnswers) => {
  for (const correct of correctAnswers) {
    if (!correct.includes(' ') && !studentAnswer.includes(' ')) {
      const dist = levenshtein(studentAnswer, correct);
      if (dist === 1) return true;
      if (dist === 2 && correct.length >= 6) return true;
      continue;
    }
    const sWords = studentAnswer.split(/\s+/);
    const cWords = correct.split(/\s+/);
    if (sWords.length !== cWords.length) continue;
    let diffs = 0, diffOk = true;
    for (let i = 0; i < cWords.length; i++) {
      const d = levenshtein(sWords[i] || '', cWords[i] || '');
      if (d > 0) {
        diffs++;
        if (cWords[i].length < 5 || d > 2) diffOk = false;
      }
    }
    if (diffs === 1 && diffOk) return true;
  }
  return false;
};
const _normaliseEC        = (s) => s.toLowerCase().trim().replace(/\s+/g, ' ');
const _normaliseDictation = (s) => s.toLowerCase().trim().replace(/[.,!?;:'"]/g, '').replace(/\s+/g, ' ');
const _findErrorIndex     = (words, correctAnswer) => {
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
  return { words: options, questionType: hasPrompt ? 'translation' : 'build', prompt: hasPrompt ? q.question : null, correctSentences: [q.correct_answer || ''], explanation: q.explanation || '', acceptable_alternatives: Array.isArray(q.acceptable_alternatives) ? q.acceptable_alternatives : [] };
};

const _parseMatchingPairs = (options) => {
  try {
    const pairs = Array.isArray(options) ? options : JSON.parse(options || '[]');
    return Array.isArray(pairs) ? pairs : [];
  } catch (e) {
    console.warn('Could not parse matching pairs:', e);
    return [];
  }
};

function InteractiveQuestion({ item: q }) {
  const [feedback,            setFeedback]           = useState(null);
  const [isChecking,          setIsChecking]          = useState(false);
  const [userAnswer,          setUserAnswer]          = useState('');
  const [selectedOption,      setSelectedOption]      = useState(null);
  const [oooSelected,         setOooSelected]         = useState(null);
  const [ecSelectedWordIndex, setEcSelectedWordIndex] = useState(null);
  const [ecCorrection,        setEcCorrection]        = useState('');
  const [sbFeedback,          setSbFeedback]          = useState(null);
  const [matchingDone,        setMatchingDone]        = useState(false);
  const [audioPlayed,         setAudioPlayed]         = useState(false);
  const [auctionPicks,        setAuctionPicks]        = useState({});
  const audioRef = useRef(null);

  const shuffledOptions = useMemo(
    () => q.type === 'multiple_choice'
      ? shuffle(Array.isArray(q.options) ? q.options : [])
      : [],
    [q.id]
  );

  const reset = () => {
    setFeedback(null); setUserAnswer(''); setSelectedOption(null);
    setOooSelected(null); setEcSelectedWordIndex(null); setEcCorrection('');
    setSbFeedback(null); setMatchingDone(false); setAudioPlayed(false); setIsChecking(false);
    setAuctionPicks({});
  };

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
          const res  = await fetch('/api/mark-gap', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ type: 'gap_fill', question: q.question, correctAnswer, studentAnswer: userAnswer.trim(), language: _qLang(q) }) });
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
        const res  = await fetch('/api/mark-gap', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ type: 'dictation', correctAnswer: correct, studentAnswer: answer, excerptType: q.excerpt_type || 'phrase', acceptableAlternatives: q.acceptable_alternatives || [] }) });
        const data = await res.json();
        if (data?.valid) { isCorrect = true; feedbackType = 'soft-pass'; }
      } catch(e) {}
      setIsChecking(false);
    }
    if (feedbackType === 'correct')        feedbackMsg = `✅ Correct!`;
    else if (feedbackType === 'fuzzy')     feedbackMsg = `✅ Correct — watch your spelling! The answer was: "${correct}"`;
    else if (feedbackType === 'soft-pass') feedbackMsg = `✅ Close enough! The model answer was: "${correct}"`;
    else                                   feedbackMsg = `❌ The answer was: "${correct}"`;
    setFeedback({ type: feedbackType, isCorrect, message: feedbackMsg, studentAnswer: answer, correctAnswer: correct });
  };

  const handleOOOSelect = (option) => {
    if (feedback) return;
    setOooSelected(option);
    const oddOne = q.correct_answer || '';
    const isCorrect = option.toLowerCase().trim() === oddOne.toLowerCase().trim();
    setFeedback({ message: isCorrect ? `✅ Correct! "${oddOne}" is the odd one out. ${q.explanation || ''}` : `❌ Not quite. "${oddOne}" is the odd one out. ${q.explanation || ''}`, type: isCorrect ? 'correct' : 'incorrect', isCorrect, oddOne });
  };

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
      const res = await fetch('/api/mark-free', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ type: 'correction', originalSentence: q.question, errorWord: words[ecSelectedWordIndex], studentReplacement: ecCorrection.trim(), correctAnswerSentence: correctAnswer, language: _qLang(q), level: q.level }) });
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

  // ── Remove the selected tile (deletion correction) ── deterministic, no AI ──
  const removeECWord = () => {
    if (ecSelectedWordIndex === null || feedback || isChecking) return;
    const words = q.question.trim().split(/\s+/);
    const correctAnswer = q.correct_answer || '';
    const removedSentence = words.filter((_, i) => i !== ecSelectedWordIndex).join(' ');
    const errorInfo = _findErrorIndex(words, correctAnswer);
    if (_normaliseEC(removedSentence) === _normaliseEC(correctAnswer)) {
      setFeedback({ type: 'correct', message: `✅ Correct! ${q.explanation || ''}`, isCorrect: true, errorIndex: ecSelectedWordIndex, correctWord: '(removed)' });
      return;
    }
    const foundRightWord = ecSelectedWordIndex === errorInfo.index;
    setFeedback({ type: 'incorrect', message: foundRightWord ? `❌ Good — you found the error, but this word needs changing, not removing. It should be "${errorInfo.correctWord}". ${q.explanation || ''}` : `❌ The error is actually in "${words[errorInfo.index]}" — it should be "${errorInfo.correctWord}". ${q.explanation || ''}`, isCorrect: false, errorIndex: errorInfo.index, correctWord: errorInfo.correctWord });
  };

  const handleSentenceBuildingResult = (isCorrect, isSoft = false, userAnswer = '', aiReason = '') => {
    const displaySentence = (q.correct_answer || '').replace(/ ([.,?!;:])/g, '$1').replace(/^(\w)/, m => m.toUpperCase());
    if (isCorrect && isSoft) {
      const note = aiReason ? `${aiReason} ` : '';
      const msg = `✅ Also correct! ${note}The model answer was: "${displaySentence}"`;
      setSbFeedback({ correct: true, soft: true, message: msg });
      setFeedback({ message: msg, type: 'soft-pass', isCorrect: true });
    } else if (isCorrect) {
      const msg = `✅ Correct! ${q.explanation || ''}`;
      setSbFeedback({ correct: true, message: msg });
      setFeedback({ message: msg, type: 'correct', isCorrect: true });
    } else {
      const msg = `❌ Not quite. The correct answer is: "${displaySentence}" — ${q.explanation || ''}`;
      setSbFeedback({ correct: false, message: msg });
      setFeedback({ message: msg, type: 'incorrect', isCorrect: false });
    }
  };

  const handleMatchingResult = (isCorrect, wrongAttempts) => {
    setMatchingDone(true);
    const msg = isCorrect ? `✅ Perfect matching! ${q.explanation || ''}` : `👍 All matched! You had ${wrongAttempts} wrong attempt${wrongAttempts !== 1 ? 's' : ''}. ${q.explanation || ''}`;
    setFeedback({ message: msg, type: isCorrect ? 'correct' : 'incorrect', isCorrect });
  };

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

  const ecWords       = q.type === 'error_correction' ? (q.question || '').trim().split(/\s+/) : [];
  const matchingPairs = q.type === 'matching' ? _parseMatchingPairs(q.options) : null;

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
            <span style={{ fontWeight: '600', color: '#4a5568', whiteSpace: 'nowrap', minWidth: '110px', flexShrink: 0 }}>Your answer:</span>
            <span style={{ fontWeight: '600', color: isCorrect ? '#276749' : '#c53030', wordBreak: 'break-word' }}>{feedback.studentAnswer || '(no answer)'}</span>
          </div>
          <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.75rem', alignItems: 'flex-start' }}>
            <span style={{ fontWeight: '600', color: '#4a5568', whiteSpace: 'nowrap', minWidth: '110px', flexShrink: 0 }}>Correct answer:</span>
            <span style={{ fontWeight: '700', color: '#276749', wordBreak: 'break-word' }}>{feedback.correctAnswer}</span>
          </div>
          {isFuzzy && <div style={{ borderTop: `1px solid ${borderColor}`, paddingTop: '0.75rem', color: '#744210', lineHeight: '1.6' }}>✏️ Almost perfect — watch your spelling next time!</div>}
          {!isFuzzy && feedback.explanation && <div style={{ borderTop: `1px solid ${borderColor}`, paddingTop: '0.75rem', color: '#4a5568', lineHeight: '1.6' }}>💡 {feedback.explanation}</div>}
        </div>
      </div>
    );
  };

  if (q._source === 'listening') {
    return (
      <div style={{ backgroundColor: 'white', padding: 'clamp(1.5rem, 5vw, 2.5rem)', borderRadius: '16px', boxShadow: '0 4px 16px rgba(0,0,0,0.08)', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', alignItems: 'center' }}>
          <div style={{ padding: '4px 12px', borderRadius: '20px', fontSize: '0.8rem', fontWeight: '600', backgroundColor: '#EDE9FE', color: '#553C9A' }}>🎧 Listening</div>
          <LevelBadge level={q.level} />
        </div>
        {q.title && <div style={{ fontSize: 'clamp(1.2rem, 4vw, 1.5rem)', color: '#2C3E50', fontWeight: '700' }}>{q.title}</div>}
        {q.intro_text && <div style={{ fontSize: 'clamp(1rem, 3.5vw, 1.1rem)', color: '#4a5568', lineHeight: '1.6' }}>{q.intro_text}</div>}
        {q.description && !q.intro_text && <div style={{ fontSize: 'clamp(1rem, 3.5vw, 1.1rem)', color: '#4a5568', lineHeight: '1.6' }}>{q.description}</div>}
        {q.audio_url && <div><audio controls src={q.audio_url} style={{ width: '100%', borderRadius: '8px' }} /></div>}
        {q.transcript && (
          <details style={{ backgroundColor: '#f8f9fa', borderRadius: '10px', padding: '1rem' }}>
            <summary style={{ cursor: 'pointer', fontWeight: '600', color: '#553C9A', fontSize: '0.9rem', marginBottom: '0.5rem' }}>📄 Transcript</summary>
            <div style={{ fontSize: '0.95rem', color: '#4a5568', lineHeight: '1.8', marginTop: '0.75rem', whiteSpace: 'pre-wrap' }}>{q.transcript}</div>
          </details>
        )}
      </div>
    );
  }

  const topicDisplay = q.topic ? q.topic.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()) : null;

  return (
    <div style={{ backgroundColor: 'white', padding: 'clamp(1.5rem, 5vw, 2.5rem)', borderRadius: '16px', boxShadow: '0 4px 16px rgba(0,0,0,0.08)', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', alignItems: 'center' }}>
        <TypeBadge type={q.type} />
        <LevelBadge level={q.level} />
        {q.type !== 'dictation' && topicDisplay && (
          <span style={{ background: '#718096', color: 'white', borderRadius: 6, padding: '2px 9px', fontSize: 12, fontWeight: 600 }}>{topicDisplay}</span>
        )}
        {(q.type === 'error_correction' || q.type === 'gap_fill' || q.type === 'sentence_building' || q.type === 'dictation') && (
          <AiMarkedBadge />
        )}
        <TagBadges tags={q.tags} />
      </div>

      {q.type !== 'sentence_building' && q.type !== 'error_correction' && q.type !== 'matching' && q.type !== 'dictation' && q.type !== 'sentence_auction' && q.question && (
        <div style={{ fontSize: 'clamp(1.15rem, 4vw, 1.4rem)', color: '#2C3E50', lineHeight: '1.6', fontWeight: '500', wordWrap: 'break-word', overflowWrap: 'break-word' }}>
          {q.question}
        </div>
      )}

      <div style={{ flex: 1 }}>
        {q.type === 'gap_fill' && !feedback && (
          <input type="text" value={userAnswer} onChange={e => setUserAnswer(e.target.value)}
            onKeyPress={e => e.key === 'Enter' && !isChecking && checkAnswer()}
            placeholder="Type your answer..." disabled={isChecking} autoFocus
            style={{ width: '100%', padding: '1.2rem', fontSize: 'clamp(1.1rem, 4vw, 1.3rem)', borderRadius: '10px', border: '2px solid #e0e0e0', boxSizing: 'border-box', color: '#2C3E50', opacity: isChecking ? 0.6 : 1 }} />
        )}

        {q.type === 'multiple_choice' && !feedback && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {shuffledOptions.map((option, index) => (
              <button key={index} onClick={() => setSelectedOption(option)}
                style={{ padding: '1.2rem', fontSize: 'clamp(1.05rem, 3.5vw, 1.2rem)', textAlign: 'left', backgroundColor: selectedOption === option ? '#3498DB' : 'white', color: selectedOption === option ? 'white' : '#2C3E50', border: `2px solid ${selectedOption === option ? '#3498DB' : '#e0e0e0'}`, borderRadius: '10px', cursor: 'pointer', transition: 'all 0.2s', wordWrap: 'break-word', width: '100%', boxSizing: 'border-box', fontWeight: '500' }}
              >{option}</button>
            ))}
          </div>
        )}

        {q.type === 'multiple_choice' && feedback && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginBottom: '0.5rem' }}>
            {shuffledOptions.map((option, index) => {
              const isCorrectOption = option === feedback.correctAnswer;
              const wasSelected     = option === feedback.studentAnswer;
              let bg = '#f7fafc', border = '#e2e8f0', color = '#a0aec0';
              if (isCorrectOption)                         { bg = '#f0fff4'; border = '#48bb78'; color = '#276749'; }
              else if (wasSelected && !feedback.isCorrect) { bg = '#fff5f5'; border = '#f56565'; color = '#c53030'; }
              return (
                <div key={index} style={{ padding: '0.9rem 1.2rem', fontSize: 'clamp(1rem, 3.5vw, 1.1rem)', backgroundColor: bg, color, border: `2px solid ${border}`, borderRadius: '10px', fontWeight: isCorrectOption || wasSelected ? '600' : '400', wordWrap: 'break-word' }}>
                  {isCorrectOption ? '✓ ' : wasSelected && !feedback.isCorrect ? '✗ ' : ''}{option}
                </div>
              );
            })}
          </div>
        )}

        {q.type === 'sentence_building' && (
          <SentenceBuildingInput key={q.id} {..._getSbProps(q)} disabled={!!feedback} onResult={handleSentenceBuildingResult} feedback={sbFeedback} showCheckButton={true} onAnswerReady={() => {}} />
        )}

        {q.type === 'sentence_auction' && (() => {
          const sentences = Array.isArray(q.options) ? q.options : (() => { try { return JSON.parse(q.options || '[]'); } catch { return []; } })();
          const revealed = !!feedback;
          const togglePick = (idx, val) => {
            if (revealed) return;
            setAuctionPicks(prev => ({ ...prev, [idx]: prev[idx] === val ? undefined : val }));
          };
          return (
            <div>
              {q.question && q.question.trim() && (
                <div style={{ backgroundColor: '#FFFBEB', border: '2px solid #F6AD55', borderRadius: '10px', padding: '0.9rem 1.25rem', marginBottom: '1.25rem', fontSize: 'clamp(0.95rem, 3vw, 1.05rem)', color: '#6B4C00', lineHeight: '1.6', fontWeight: '500', fontStyle: 'italic' }}>
                  🏷️ {q.question}
                </div>
              )}
              <p style={{ fontSize: '0.88rem', color: '#718096', margin: '0 0 1rem', fontStyle: 'italic' }}>
                {revealed ? 'Answers revealed — green = correct, red = incorrect.' : 'Mark each sentence ✅ or ❌ before revealing.'}
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '1.25rem' }}>
                {sentences.map((s, idx) => {
                  const pick = auctionPicks[idx];
                  const bg     = !revealed ? (pick === true ? '#f0fff4' : pick === false ? '#fff5f5' : 'white') : s.correct ? '#f0fff4' : '#fff5f5';
                  const border = !revealed ? (pick === true ? '#48bb78' : pick === false ? '#f56565' : '#e2e8f0') : s.correct ? '#48bb78' : '#f56565';
                  const colour = !revealed ? '#2d3748' : s.correct ? '#276749' : '#c53030';
                  const pickedRight = revealed && pick !== undefined && pick === s.correct;
                  const pickedWrong = revealed && pick !== undefined && pick !== s.correct;
                  return (
                    <div key={idx} style={{ borderRadius: '10px', border: `2px solid ${border}`, background: bg, padding: '0.9rem 1.1rem', transition: 'all 0.3s', display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 'clamp(0.95rem, 3vw, 1.05rem)', color: colour, fontWeight: '500', lineHeight: '1.55', marginBottom: revealed && s.explanation ? '0.5rem' : 0 }}>
                          {revealed && <span style={{ marginRight: '7px' }}>{s.correct ? '✅' : '❌'}</span>}
                          {s.sentence}
                          {revealed && pickedRight && <span style={{ marginLeft: '8px', fontSize: '0.78rem', fontWeight: '700', color: '#276749', background: '#c6f6d5', padding: '2px 7px', borderRadius: '20px' }}>👍 right call</span>}
                          {revealed && pickedWrong && <span style={{ marginLeft: '8px', fontSize: '0.78rem', fontWeight: '700', color: '#9b2c2c', background: '#fed7d7', padding: '2px 7px', borderRadius: '20px' }}>😬 wrong call</span>}
                        </div>
                        {revealed && s.explanation && <div style={{ fontSize: '0.875rem', color: s.correct ? '#2f855a' : '#9b2c2c', lineHeight: '1.5', opacity: 0.9 }}>{s.explanation}</div>}
                      </div>
                      {!revealed && (
                        <div style={{ display: 'flex', gap: '5px', flexShrink: 0, alignSelf: 'center' }}>
                          <button onClick={() => togglePick(idx, true)} title="Correct" style={{ width: '36px', height: '36px', borderRadius: '8px', border: `2px solid ${pick === true ? '#48bb78' : '#e2e8f0'}`, background: pick === true ? '#48bb78' : 'white', fontSize: '1rem', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.15s' }}>✅</button>
                          <button onClick={() => togglePick(idx, false)} title="Incorrect" style={{ width: '36px', height: '36px', borderRadius: '8px', border: `2px solid ${pick === false ? '#f56565' : '#e2e8f0'}`, background: pick === false ? '#f56565' : 'white', fontSize: '1rem', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.15s' }}>❌</button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
              {!revealed && <button onClick={() => setFeedback({ type: 'revealed' })} style={{ width: '100%', padding: '0.9rem', fontSize: '1rem', fontWeight: '700', background: 'linear-gradient(135deg,#667eea,#764ba2)', color: 'white', border: 'none', borderRadius: '10px', cursor: 'pointer' }}>🔨 Reveal Answers</button>}
            </div>
          );
        })()}

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

        {q.type === 'error_correction' && (
          <div>
            <div style={{ fontSize: '0.9rem', color: '#718096', marginBottom: '1rem', fontStyle: 'italic' }}>
              {isChecking ? '🤖 Checking your answer...' : !feedback ? '👆 Tap the word that is wrong, then change it or remove it.' : feedback.isCorrect ? 'Well done!' : 'See the correction below.'}
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
              <>
              <div style={{ display: 'flex', gap: '10px', marginBottom: '0.6rem', alignItems: 'stretch' }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: '0.75rem', color: '#718096', fontWeight: 600, marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Fix "{ecWords[ecSelectedWordIndex]}" — type the correction, or remove it:</div>
                  <input type="text" value={ecCorrection} onChange={e => setEcCorrection(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') checkECAnswer(); else if (e.key === 'Backspace' && ecCorrection === '') { e.preventDefault(); removeECWord(); } }}
                    placeholder="Type the correct word..." autoFocus
                    style={{ width: '100%', padding: '0.9rem 1rem', fontSize: 'clamp(1rem, 3.5vw, 1.15rem)', borderRadius: '8px', border: '2px solid #667eea', boxSizing: 'border-box', color: '#2d3748', fontWeight: 500, backgroundColor: '#EDE9FE' }} />
                </div>
                <button onClick={checkECAnswer} disabled={!ecCorrection.trim() || isChecking}
                  style={{ padding: '0 1.5rem', background: ecCorrection.trim() ? 'linear-gradient(135deg, #667eea, #764ba2)' : '#cbd5e0', color: 'white', border: 'none', borderRadius: '8px', cursor: ecCorrection.trim() ? 'pointer' : 'not-allowed', fontWeight: 600, fontSize: '1rem', alignSelf: 'flex-end', minHeight: '48px' }}>Check</button>
              </div>
              <button onClick={removeECWord} style={{ marginBottom: '1rem', background: 'white', color: '#718096', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '0.5rem 0.9rem', fontSize: '0.85rem', fontWeight: 600, cursor: 'pointer' }}>🗑 Remove "{ecWords[ecSelectedWordIndex]}" (it shouldn't be there)</button>
              </>
            )}
            {ecSelectedWordIndex === null && !feedback && !isChecking && (
              <div style={{ textAlign: 'center', padding: '1rem', color: '#A0AEC0', fontSize: '0.95rem', border: '2px dashed #E2E8F0', borderRadius: '8px' }}>👆 Tap the word you think is wrong</div>
            )}
          </div>
        )}

        {q.type === 'matching' && matchingPairs && matchingPairs.length > 0 && (
          <div>
            {q.question && q.question.trim() && <div style={{ fontSize: 'clamp(1.05rem, 3.5vw, 1.2rem)', color: '#2C3E50', lineHeight: '1.6', fontWeight: '500', marginBottom: '1rem', wordWrap: 'break-word' }}>{q.question}</div>}
            <MatchingPairs key={q.id} pairs={matchingPairs} disabled={!!feedback} onResult={handleMatchingResult} />
          </div>
        )}
        {q.type === 'matching' && (!matchingPairs || matchingPairs.length === 0) && (
          <div style={{ padding: '1rem', background: '#f7fafc', borderRadius: '8px', color: '#718096', fontSize: '0.95rem' }}>
            ⚠️ Could not load matching pairs for this question.
          </div>
        )}

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
              <div style={{ backgroundColor: '#EBF8FF', border: '2px solid #90CDF4', borderRadius: '10px', padding: '1rem 1.25rem', marginBottom: '1rem', fontSize: 'clamp(1rem, 3.5vw, 1.15rem)', color: '#2C3E50', lineHeight: '1.6', fontWeight: '500' }}>{q.sentence_template}</div>
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

        {isChecking && ['gap_fill', 'error_correction', 'dictation'].includes(q.type) && (
          <div style={{ marginTop: '1rem', textAlign: 'center', padding: '1rem', color: '#553C9A', fontSize: '0.95rem', border: '2px dashed #EDE9FE', borderRadius: '8px' }}>🤖 Checking your answer...</div>
        )}

        {renderStructuredFeedback()}

        {feedback && q.type === 'error_correction' && (
          <div style={{ backgroundColor: feedback.type === 'soft-pass' ? '#fffbeb' : feedback.isCorrect ? '#d4edda' : '#f8d7da', color: feedback.type === 'soft-pass' ? '#744210' : feedback.isCorrect ? '#155724' : '#721c24', padding: '1.2rem', borderRadius: '10px', marginTop: '1rem', fontSize: 'clamp(1rem, 3vw, 1.1rem)', lineHeight: '1.6', wordWrap: 'break-word', overflowWrap: 'break-word', border: feedback.type === 'soft-pass' ? '1px solid #fbd38d' : 'none' }}>
            {feedback.message}
          </div>
        )}

        {feedback && !['error_correction', 'sentence_building', 'gap_fill', 'multiple_choice', 'dictation', 'sentence_auction'].includes(q.type) && (
          <div style={{ backgroundColor: feedback.isCorrect ? '#d4edda' : '#f8d7da', color: feedback.isCorrect ? '#155724' : '#721c24', padding: '1.2rem', borderRadius: '10px', marginTop: '1rem', fontSize: 'clamp(1rem, 3vw, 1.1rem)', lineHeight: '1.6', wordWrap: 'break-word', overflowWrap: 'break-word' }}>
            {feedback.message}
          </div>
        )}
      </div>

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
          <button onClick={reset} style={{ padding: '1.2rem', fontSize: 'clamp(1.1rem, 4vw, 1.25rem)', backgroundColor: '#718096', color: 'white', border: 'none', borderRadius: '10px', cursor: 'pointer', width: '100%', fontWeight: '600' }}>
            ↺ Try again
          </button>
        )}
      </div>
    </div>
  );
}

// ─── Connections Focus Overlay ────────────────────────────────────────────────
function ConnectionsFocus({ groups, title, playDate, onClose }) {
  const MAX_MISTAKES = 4;
  const initialTiles = () => shuffle(groups.flatMap(g => g.words.map(w => ({ word: w, rank: g.colour_rank }))));

  const [tiles,       setTiles]       = useState(initialTiles);
  const [selected,    setSelected]    = useState(new Set());
  const [solvedRanks, setSolvedRanks] = useState(new Set());
  const [mistakes,    setMistakes]    = useState(0);
  const [gameState,   setGameState]   = useState('playing');
  const [message,     setMessage]     = useState('');
  const [shaking,     setShaking]     = useState(false);
  const [locked,      setLocked]      = useState(false);

  function toggleTile(word) {
    if (gameState !== 'playing' || locked) return;
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(word)) { next.delete(word); return next; }
      if (next.size >= 4) return prev;
      next.add(word);
      return next;
    });
  }

  function submitGuess() {
    if (selected.size !== 4 || locked) return;
    setLocked(true);
    const selArr = [...selected];
    const ranks = selArr.map(w => groups.find(g => g.words.includes(w))?.colour_rank);
    const allSame = ranks.every(r => r === ranks[0]);

    if (allSame) {
      const rank = ranks[0];
      const newSolved = new Set([...solvedRanks, rank]);
      setSolvedRanks(newSolved);
      setSelected(new Set());
      if (newSolved.size === 4) {
        setGameState('won');
        setMessage('Solved! 🎉');
      } else {
        setMessage(`✅ ${RANK_STYLE[rank].label} group found!`);
        setTimeout(() => setMessage(''), 2000);
      }
      setLocked(false);
    } else {
      const rankCounts = {};
      ranks.forEach(r => { rankCounts[r] = (rankCounts[r] || 0) + 1; });
      const maxCount = Math.max(...Object.values(rankCounts));
      const newMistakes = mistakes + 1;
      setMistakes(newMistakes);
      setShaking(true);
      setTimeout(() => { setShaking(false); setLocked(false); }, 600);
      setMessage(maxCount === 3 ? 'One away! 🤔' : 'Not quite — try again');
      setTimeout(() => setMessage(''), 2000);
      if (newMistakes >= MAX_MISTAKES) {
        setSolvedRanks(new Set([1, 2, 3, 4]));
        setGameState('lost');
        setMessage('Hard luck! Here are the answers.');
      }
    }
  }

  function resetGame() {
    setTiles(initialTiles());
    setSelected(new Set());
    setSolvedRanks(new Set());
    setMistakes(0);
    setGameState('playing');
    setMessage('');
    setLocked(false);
  }

  const mistakeDots = Array.from({ length: MAX_MISTAKES }, (_, i) => (
    <span key={i} style={{ fontSize: 14, color: i < mistakes ? '#cbd5e0' : '#667eea' }}>
      {i < mistakes ? '○' : '●'}
    </span>
  ));

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 3000, background: '#f8f9fa', display: 'flex', flexDirection: 'column', overflowY: 'auto' }}>
      {/* Header */}
      <div style={{ background: 'white', borderBottom: '1px solid #e2e8f0', padding: '10px 20px', display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0, flexWrap: 'wrap' }}>
        <div>
          <span style={{ fontWeight: 700, fontSize: 16 }}>🟨 {title}</span>
          {playDate && <span style={{ color: '#718096', fontSize: 13, marginLeft: 8 }}>{fmtDate(playDate)}</span>}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginLeft: 'auto' }}>
          <span style={{ display: 'flex', gap: 4 }}>{mistakeDots}</span>
          <button onClick={resetGame} style={{ padding: '6px 14px', borderRadius: 7, border: '1px solid #e2e8f0', background: 'white', color: '#4a5568', cursor: 'pointer', fontSize: 13 }}>↺ Reset</button>
          <button onClick={onClose} style={{ padding: '6px 14px', borderRadius: 7, border: '1px solid #e2e8f0', background: 'white', color: '#4a5568', cursor: 'pointer', fontSize: 13 }}>✕ Close</button>
        </div>
      </div>

      {/* Game area */}
      <div style={{ flex: 1, display: 'flex', justifyContent: 'center', alignItems: 'flex-start', padding: '2rem 1rem' }}>
        <div style={{ width: '100%', maxWidth: 580 }}>
          {/* Solved / revealed groups */}
          {[1, 2, 3, 4].filter(r => solvedRanks.has(r)).map(rank => {
            const grp = groups.find(g => g.colour_rank === rank);
            if (!grp) return null;
            const s = RANK_STYLE[rank];
            return (
              <div key={rank} style={{ background: s.bg, border: `2px solid ${s.border}`, borderRadius: 10, padding: '12px 16px', marginBottom: 8, textAlign: 'center' }}>
                <div style={{ fontWeight: 700, fontSize: 13, color: s.text, marginBottom: 4, textTransform: 'uppercase', letterSpacing: 0.5 }}>{grp.category}</div>
                <div style={{ fontSize: 14, color: s.text, fontWeight: 600 }}>{grp.words.join('  ·  ')}</div>
              </div>
            );
          })}

          {/* Unsolved tiles */}
          {gameState === 'playing' && (
            <>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8, marginBottom: 16 }}>
                {tiles.filter(t => !solvedRanks.has(t.rank)).map(({ word }) => {
                  const isSel = selected.has(word);
                  return (
                    <button
                      key={word}
                      onClick={() => toggleTile(word)}
                      style={{
                        padding: '14px 4px', borderRadius: 8,
                        border: `2px solid ${isSel ? '#667eea' : '#e2e8f0'}`,
                        background: isSel ? '#667eea' : 'white',
                        color: isSel ? 'white' : '#2d3748',
                        fontWeight: 700, fontSize: 'clamp(11px, 2.5vw, 14px)',
                        cursor: 'pointer', textAlign: 'center', lineHeight: 1.3,
                        animation: shaking && isSel ? 'tb-shake 0.5s' : 'none',
                        transition: 'background 0.15s, border-color 0.15s',
                      }}
                    >{word}</button>
                  );
                })}
              </div>

              {message && (
                <div style={{ textAlign: 'center', fontWeight: 600, color: '#4a5568', marginBottom: 12, fontSize: 15 }}>{message}</div>
              )}

              <div style={{ display: 'flex', gap: 8, justifyContent: 'center' }}>
                <button
                  onClick={() => {
                    const unsolved = tiles.filter(t => !solvedRanks.has(t.rank));
                    const sel = unsolved.filter(t => selected.has(t.word));
                    const unsel = shuffle(unsolved.filter(t => !selected.has(t.word)));
                    setTiles([...sel, ...unsel]);
                  }}
                  style={{ padding: '8px 20px', borderRadius: 8, border: '1px solid #e2e8f0', background: 'white', cursor: 'pointer', fontSize: 14 }}
                >Shuffle</button>
                <button
                  onClick={() => setSelected(new Set())}
                  style={{ padding: '8px 20px', borderRadius: 8, border: '1px solid #e2e8f0', background: 'white', cursor: 'pointer', fontSize: 14 }}
                >Deselect</button>
                <button
                  onClick={submitGuess}
                  disabled={selected.size !== 4}
                  style={{ padding: '8px 24px', borderRadius: 8, border: 'none', background: selected.size === 4 ? '#2d3748' : '#e2e8f0', color: selected.size === 4 ? 'white' : '#a0aec0', cursor: selected.size === 4 ? 'pointer' : 'default', fontSize: 14, fontWeight: 700 }}
                >Submit</button>
              </div>
            </>
          )}

          {(gameState === 'won' || gameState === 'lost') && (
            <div style={{ textAlign: 'center', marginTop: 24 }}>
              <div style={{ fontSize: 22, fontWeight: 700, marginBottom: 16 }}>{message}</div>
              <button onClick={resetGame} style={{ padding: '10px 28px', borderRadius: 8, background: 'linear-gradient(135deg,#667eea,#764ba2)', color: 'white', border: 'none', cursor: 'pointer', fontWeight: 700, fontSize: 15 }}>↺ Play Again</button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Wordle Focus Overlay ─────────────────────────────────────────────────────
function WordleFocus({ word, language, playDate, onClose }) {
  const WORD = word.toUpperCase();
  const KB   = language === 'es' ? ES_KB : EN_KB;

  const [guesses,   setGuesses]   = useState([]);
  const [current,   setCurrent]   = useState('');
  const [gameState, setGameState] = useState('playing');
  const [message,   setMessage]   = useState('');
  const [shaking,   setShaking]   = useState(false);

  const currentRef  = useRef(current);
  const guessesRef  = useRef(guesses);
  const gameStRef   = useRef(gameState);
  useEffect(() => { currentRef.current = current; }, [current]);
  useEffect(() => { guessesRef.current = guesses; }, [guesses]);
  useEffect(() => { gameStRef.current = gameState; }, [gameState]);

  function getTileResult(guess, col) {
    const letter = guess[col];
    if (letter === WORD[col]) return 'correct';
    if (WORD.includes(letter)) return 'present';
    return 'absent';
  }

  function getLetterStates() {
    const priority = { correct: 3, present: 2, absent: 1 };
    const states = {};
    guesses.forEach(g => {
      for (let i = 0; i < 5; i++) {
        const letter = g[i];
        const result = getTileResult(g, i);
        if (!states[letter] || priority[result] > priority[states[letter]]) states[letter] = result;
      }
    });
    return states;
  }

  function submitGuess() {
    const cur = currentRef.current;
    if (cur.length < 5) {
      setMessage('Not enough letters');
      setShaking(true);
      setTimeout(() => { setShaking(false); setMessage(''); }, 1000);
      return;
    }
    const newGuesses = [...guessesRef.current, cur];
    setGuesses(newGuesses);
    setCurrent('');
    if (cur === WORD) {
      setGameState('won');
      const msgs = ['Genius! 🧠', 'Magnificent! ✨', 'Impressive! 🌟', 'Splendid! 👏', 'Great! 🎉', 'Phew! 😅'];
      setMessage(msgs[newGuesses.length - 1] || 'Well done!');
    } else if (newGuesses.length >= 6) {
      setGameState('lost');
      setMessage(`The word was ${WORD}`);
    }
  }

  function handleKey(key) {
    if (gameStRef.current !== 'playing') return;
    if (key === '⌫' || key === 'BACKSPACE') { setCurrent(c => c.slice(0, -1)); return; }
    if (key === 'ENTER') { submitGuess(); return; }
    if (/^[A-ZÁÉÍÓÚÑÜ]$/.test(key) && currentRef.current.length < 5) setCurrent(c => c + key);
  }

  useEffect(() => {
    const handler = (e) => {
      const k = e.key.toUpperCase();
      if (k === 'BACKSPACE') { handleKey('BACKSPACE'); return; }
      if (k === 'ENTER') { handleKey('ENTER'); return; }
      if (/^[A-ZÁÉÍÓÚÑÜ]$/.test(k)) handleKey(k);
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  const letterStates = getLetterStates();

  function resetGame() {
    setGuesses([]); setCurrent(''); setGameState('playing'); setMessage(''); setShaking(false);
  }

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 3000, background: '#f8f9fa', display: 'flex', flexDirection: 'column' }}>
      {/* Header */}
      <div style={{ background: 'white', borderBottom: '1px solid #e2e8f0', padding: '10px 20px', display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0, flexWrap: 'wrap' }}>
        <div>
          <span style={{ fontWeight: 700, fontSize: 16 }}>🟩 Wordle</span>
          {playDate && <span style={{ color: '#718096', fontSize: 13, marginLeft: 8 }}>{fmtDate(playDate)}</span>}
          <span style={{ marginLeft: 8, fontSize: 13 }}>{language === 'es' ? '🇪🇸' : '🇬🇧'}</span>
        </div>
        {/* Show answer for teacher reference */}
        <div style={{ background: '#f0fff4', border: '1px solid #48bb78', borderRadius: 6, padding: '3px 10px', fontSize: 13, fontWeight: 700, color: '#276749', letterSpacing: 2 }}>
          {WORD}
        </div>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
          <button onClick={resetGame} style={{ padding: '6px 14px', borderRadius: 7, border: '1px solid #e2e8f0', background: 'white', color: '#4a5568', cursor: 'pointer', fontSize: 13 }}>↺ Reset</button>
          <button onClick={onClose} style={{ padding: '6px 14px', borderRadius: 7, border: '1px solid #e2e8f0', background: 'white', color: '#4a5568', cursor: 'pointer', fontSize: 13 }}>✕ Close</button>
        </div>
      </div>

      {/* Game area */}
      <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '1.5rem 1rem', gap: '1rem' }}>
        {/* Grid */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
          {Array.from({ length: 6 }, (_, row) => {
            const isCurrentRow = row === guesses.length && gameState === 'playing';
            const guess = row < guesses.length ? guesses[row] : (isCurrentRow ? current : '');
            const isSubmitted = row < guesses.length;
            return (
              <div key={row} style={{ display: 'flex', gap: 5, animation: shaking && isCurrentRow ? 'tb-shake 0.5s' : 'none' }}>
                {Array.from({ length: 5 }, (_, col) => {
                  const letter = guess[col] || '';
                  const result = isSubmitted ? getTileResult(guess, col) : null;
                  const bg = result ? WC[result] : letter ? '#e2e8f0' : '#f7fafc';
                  const color = result ? 'white' : '#2d3748';
                  const border = result ? 'transparent' : letter ? '#a0aec0' : '#e2e8f0';
                  return (
                    <div key={col} style={{ width: 52, height: 52, display: 'flex', alignItems: 'center', justifyContent: 'center', border: `2px solid ${border}`, borderRadius: 6, background: bg, color, fontWeight: 700, fontSize: 22, textTransform: 'uppercase', transition: 'background 0.3s' }}>
                      {letter}
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>

        {message && (
          <div style={{ fontWeight: 700, fontSize: 16, color: gameState === 'lost' ? '#c53030' : '#2d3748', textAlign: 'center', padding: '8px 16px', background: 'white', borderRadius: 8, boxShadow: '0 2px 8px rgba(0,0,0,0.1)' }}>
            {message}
          </div>
        )}

        {/* Keyboard */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, alignItems: 'center' }}>
          {KB.map((row, ri) => (
            <div key={ri} style={{ display: 'flex', gap: 5 }}>
              {row.map(key => {
                const state = letterStates[key];
                const bg    = state ? WC[state] : '#d3d6da';
                const color = state ? 'white' : '#2d3748';
                const isWide = key === 'ENTER' || key === '⌫';
                return (
                  <button
                    key={key}
                    onClick={() => handleKey(key)}
                    style={{ padding: isWide ? '14px 8px' : '14px 0', width: isWide ? 58 : 38, borderRadius: 6, border: 'none', background: bg, color, fontWeight: 700, fontSize: isWide ? 11 : 14, cursor: 'pointer', transition: 'background 0.2s' }}
                  >{key}</button>
                );
              })}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Exercise Focus Mode ──────────────────────────────────────────────────────
function FocusMode({ items, index, onChangeIndex, previewMode, setPreviewMode, onExit }) {
  const item = items[index];
  if (!item) return null;
  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 2000, background: '#f8f9fa', display: 'flex', flexDirection: 'column' }}>
      <div style={{ background: 'white', borderBottom: '1px solid #e2e8f0', padding: '10px 20px', display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0 }}>
        <div style={{ display: 'flex', background: '#f7fafc', borderRadius: 7, padding: 3, gap: 2 }}>
          {[['teacher', '👨‍🏫 Teacher'], ['student', '👤 Student']].map(([mode, label]) => (
            <button key={mode} onClick={() => setPreviewMode(mode)} style={{ padding: '5px 14px', borderRadius: 5, border: 'none', background: previewMode === mode ? '#667eea' : 'transparent', color: previewMode === mode ? 'white' : '#718096', cursor: 'pointer', fontSize: 13, fontWeight: previewMode === mode ? 700 : 400 }}>{label}</button>
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
          {previewMode === 'teacher' ? <TeacherCard item={item} /> : <InteractiveQuestion key={item._rowKey} item={item} />}
        </div>
      </div>
    </div>
  );
}

// ─── Main TeacherBrowse Component ─────────────────────────────────────────────
const CONTENT_SOURCES = ['connections', 'wotd', 'wordle', 'crossword', 'wordsearch'];
const EXERCISE_SOURCES = ['all', 'question_bank', 'listening', 'dictation'];

export default function TeacherBrowse({ user, globalLang = 'en' }) {
  const [filters, setFilters] = useState({
    source: 'all', levels: [], types: [], tags: [], topic: '', searchText: '', lang: 'en',
    qFrom: '', qTo: '', newOnly: false, dateFrom: '', dateTo: '',
  });
  const [maxQNumber,         setMaxQNumber]         = useState(null);
  const [results,            setResults]            = useState([]);
  const [loading,            setLoading]            = useState(false);
  const [hasSearched,        setHasSearched]        = useState(false);
  const [selected,           setSelected]           = useState(new Set());
  const [previewItem,        setPreviewItem]        = useState(null);
  const [previewMode,        setPreviewMode]        = useState('student');
  const [focusMode,          setFocusMode]          = useState(false);
  const [focusIndex,         setFocusIndex]         = useState(0);
  const [sets,               setSets]               = useState(loadSets);
  const [activeSet,          setActiveSet]          = useState(null);
  const [showSetsPanel,      setShowSetsPanel]      = useState(false);
  const [addToSetId,         setAddToSetId]         = useState('');
  const [newSetName,         setNewSetName]         = useState('');
  const [typeOpen,           setTypeOpen]           = useState(false);
  const [tagOpen,            setTagOpen]            = useState(false);
  const [tagFilter,          setTagFilter]          = useState('');
  const [searchOpen,         setSearchOpen]         = useState(false);
  const [availableTopics,    setAvailableTopics]    = useState([]);
  const [availableTags,      setAvailableTags]      = useState([]);
  const searchRef = useRef(null);
  // Content type overlays
  const [connectionsFocus,   setConnectionsFocus]   = useState(null); // full connections puzzle row (with groups) → Class Play
  const [wordleFocus,        setWordleFocus]        = useState(null); // full wordle_words row → Class Play
  const [crosswordFocus,     setCrosswordFocus]     = useState(null); // full crossword_puzzles row → Class Play
  const [wordsearchFocus,    setWordsearchFocus]    = useState(null); // full wordsearch_puzzles row → Class Play
  const [wotdExpanded,       setWotdExpanded]       = useState(new Set());

  const isContentSource = CONTENT_SOURCES.includes(filters.source);

  const setFilter   = (k, v) => setFilters(f => ({ ...f, [k]: v }));
  const toggleLevel = (lv) => setFilter('levels', filters.levels.includes(lv) ? filters.levels.filter(l => l !== lv) : [...filters.levels, lv]);
  const toggleType  = (tp) => setFilter('types',  filters.types.includes(tp)  ? filters.types.filter(t => t !== tp)  : [...filters.types, tp]);
  const toggleTag   = (tg) => setFilter('tags',   filters.tags.includes(tg)   ? filters.tags.filter(t => t !== tg)   : [...filters.tags, tg]);

  const visibleTags = tagFilter.trim()
    ? availableTags.filter(t => t.toLowerCase().includes(tagFilter.toLowerCase()))
    : availableTags;

  // Quick date helpers
  function setMonth(offset) {
    const d = new Date();
    d.setMonth(d.getMonth() + offset);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const last = new Date(y, d.getMonth() + 1, 0).getDate();
    setFilters(f => ({ ...f, dateFrom: `${y}-${m}-01`, dateTo: `${y}-${m}-${last}` }));
  }

  useEffect(() => {
    supabase.from('question_bank').select('question_number').order('question_number', { ascending: false }).limit(1).single()
      .then(({ data }) => { if (data) setMaxQNumber(data.question_number); });
  }, []);

  // Fetch distinct topics + tags from question_bank for the search typeahead.
  useEffect(() => {
    supabase.from('question_bank').select('topic, tags')
      .then(({ data }) => {
        if (!data) return;
        const topics = [...new Set(data.map(r => r.topic).filter(Boolean))].sort();
        const tags   = [...new Set(data.flatMap(r => r.tags || []))].sort();
        setAvailableTopics(topics);
        setAvailableTags(tags);
      });
  }, []);

  // Close the search-suggestions dropdown when clicking outside it.
  useEffect(() => {
    const handler = (e) => {
      if (searchRef.current && !searchRef.current.contains(e.target)) setSearchOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const search = useCallback(async (overrideFilters) => {
    const f = overrideFilters || filters;
    setLoading(true); setHasSearched(true); setActiveSet(null); setPreviewItem(null);
    setSelected(new Set()); setWotdExpanded(new Set());

    // ── Connections ──────────────────────────────────────────────────────────
    if (f.source === 'connections') {
      let q = supabase.from('connections_puzzles').select('id, play_date, title, language').order('play_date');
      if (f.lang !== 'both') q = q.eq('language', f.lang);
      if (f.dateFrom) q = q.gte('play_date', f.dateFrom);
      if (f.dateTo)   q = q.lte('play_date', f.dateTo);
      const { data: puzzles } = await q.limit(60);
      if (!puzzles || puzzles.length === 0) { setResults([]); setLoading(false); return; }
      const ids = puzzles.map(p => p.id);
      const { data: groups } = await supabase.from('connections_groups').select('*').in('puzzle_id', ids).order('colour_rank');
      const items = puzzles.map(p => ({
        ...p,
        _source: 'connections',
        _rowKey: `con_${p.id}`,
        groups: (groups || []).filter(g => g.puzzle_id === p.id),
      }));
      setResults(items); setLoading(false); return;
    }

    // ── WOTD ─────────────────────────────────────────────────────────────────
    if (f.source === 'wotd') {
      // Default to current month if no date range set — prevents 200-row limit cutting off recent entries
      const _n = new Date();
      const _y = _n.getFullYear(), _m = String(_n.getMonth() + 1).padStart(2, '0');
      const _defaultFrom = `${_y}-${_m}-01`;
      const _defaultTo   = new Date(_y, _n.getMonth() + 1, 0).toISOString().slice(0, 10);
      let q = supabase.from('word_of_the_day').select('*').order('date')
        .gte('date', f.dateFrom || _defaultFrom)
        .lte('date', f.dateTo   || _defaultTo);
      const { data: rows } = await q.limit(200);
      const byDate = {};
      (rows || []).forEach(r => { if (!byDate[r.date]) byDate[r.date] = []; byDate[r.date].push(r); });
      const items = Object.entries(byDate)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([date, entries]) => ({
          _source: 'wotd', _rowKey: `wotd_${date}`, date,
          entries: entries.sort((a, b) => {
            const order = { 'A1/A2': 0, 'B1/B2': 1, 'C1/C2': 2 };
            if (a.language === 'es') return 3;
            if (b.language === 'es') return -3;
            return (order[a.level] ?? 9) - (order[b.level] ?? 9);
          }),
        }));
      setResults(items); setLoading(false); return;
    }

    // ── Wordle ────────────────────────────────────────────────────────────────
    if (f.source === 'wordle') {
      let q = supabase.from('wordle_words').select('*').order('play_date');
      if (f.lang !== 'both') q = q.eq('language', f.lang);
      if (f.dateFrom) q = q.gte('play_date', f.dateFrom);
      if (f.dateTo)   q = q.lte('play_date', f.dateTo);
      const { data: rows } = await q.limit(200);
      const items = (rows || []).map(r => ({ ...r, _source: 'wordle', _rowKey: `wdl_${r.id}` }));
      setResults(items); setLoading(false); return;
    }

    // ── Crossword ──────────────────────────────────────────────────
    // Class Play: list specific crossword puzzles (any date/level) to run live in class.
    if (f.source === 'crossword') {
      let q = supabase.from('crossword_puzzles').select('*').order('play_date').order('level');
      if (f.lang !== 'both') q = q.eq('language', f.lang);
      if (f.dateFrom) q = q.gte('play_date', f.dateFrom);
      if (f.dateTo)   q = q.lte('play_date', f.dateTo);
      const { data: rows } = await q.limit(200);
      const items = (rows || []).map(r => ({ ...r, _source: 'crossword', _rowKey: `cw_${r.id}` }));
      setResults(items); setLoading(false); return;
    }

    // ── Wordsearch ───────────────────────────────────────────────
    if (f.source === 'wordsearch') {
      let q = supabase.from('wordsearch_puzzles').select('*').order('play_date');
      if (f.lang !== 'both') q = q.eq('language', f.lang);
      if (f.dateFrom) q = q.gte('play_date', f.dateFrom);
      if (f.dateTo)   q = q.lte('play_date', f.dateTo);
      const { data: rows } = await q.limit(200);
      const items = (rows || []).map(r => ({ ...r, _source: 'wordsearch', _rowKey: `ws_${r.id}` }));
      setResults(items); setLoading(false); return;
    }

    // ── Exercises (existing logic) ────────────────────────────────────────────
    const newThreshold = maxQNumber != null ? maxQNumber - NEW_COUNT + 1 : null;
    const all = [];
    if (f.source === 'all' || f.source === 'question_bank') {
      let q = supabase.from('question_bank').select('*').order('question_number');
      if (f.lang === 'en') q = q.in('language', ['en', 'both']);
      else if (f.lang === 'es') q = q.in('language', ['es', 'both']);
      if (f.levels.length) q = q.in('level', f.levels);
      if (f.types.length)  q = q.in('type',  f.types);
      if (f.tags.length)   q = q.overlaps('tags', f.tags);
      if (f.topic) q = q.ilike('topic', `%${f.topic}%`);
      if (f.searchText) q = q.or(`topic.ilike.%${f.searchText}%,question.ilike.%${f.searchText}%,explanation.ilike.%${f.searchText}%`);
      if (f.qFrom)  q = q.gte('question_number', parseInt(f.qFrom));
      if (f.qTo)    q = q.lte('question_number', parseInt(f.qTo));
      if (f.newOnly && newThreshold) q = q.gte('question_number', newThreshold);
      const { data } = await q.limit(200);
      if (data) data.forEach(r => all.push({ ...r, _source: 'question_bank', _rowKey: `qb_${r.id}` }));
    }
    if ((f.source === 'all' || f.source === 'listening') && !f.tags.length) {
      let q = supabase.from('listening_exercises').select('*').order('title');
      if (f.levels.length) q = q.in('level', f.levels);
      if (f.topic) q = q.ilike('topic', `%${f.topic}%`);
      if (f.searchText) q = q.or(`topic.ilike.%${f.searchText}%,title.ilike.%${f.searchText}%,description.ilike.%${f.searchText}%`);
      const { data } = await q.limit(100);
      if (data) data.forEach(r => all.push({ ...r, _source: 'listening', _rowKey: `li_${r.id}` }));
    }
    if ((f.source === 'all' || f.source === 'dictation') && !f.tags.length) {
      let q = supabase.from('dictation_exercises').select('*').order('title');
      if (f.lang === 'en') q = q.in('language', ['en', 'both']);
      else if (f.lang === 'es') q = q.in('language', ['es', 'both']);
      if (f.levels.length) q = q.in('level', f.levels);
      if (f.topic) q = q.ilike('topic', `%${f.topic}%`);
      if (f.searchText) q = q.or(`topic.ilike.%${f.searchText}%,title.ilike.%${f.searchText}%,answer.ilike.%${f.searchText}%`);
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

  // Only exercise items go into focus mode
  const exerciseResults = results.filter(r => !CONTENT_SOURCES.includes(r._source));
  const focusItems = selected.size > 0
    ? exerciseResults.filter(r => selected.has(r._rowKey))
    : exerciseResults;
  const enterFocus = (startIndex = 0) => { setFocusIndex(startIndex); setFocusMode(true); };

  function handleItemClick(item, exerciseIdx) {
    if (item._source === 'connections') {
      setConnectionsFocus(item);
    } else if (item._source === 'wordle') {
      setWordleFocus(item);
    } else if (item._source === 'crossword') {
      setCrosswordFocus(item);
    } else if (item._source === 'wordsearch') {
      setWordsearchFocus(item);
    } else if (item._source === 'wotd') {
      setWotdExpanded(prev => {
        const next = new Set(prev);
        next.has(item.date) ? next.delete(item.date) : next.add(item.date);
        return next;
      });
    } else {
      enterFocus(exerciseIdx);
    }
  }

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

  // ── Sidebar ──────────────────────────────────────────────────────────────────
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

      <div style={{ borderTop: '1px solid #f0f0f0', margin: '2px 0 10px' }} />

      {/* Exercises group */}
      <div style={{ fontSize: 9, fontWeight: 700, color: '#a0aec0', letterSpacing: 1.2, textTransform: 'uppercase', marginBottom: 4 }}>Exercises</div>
      {[['all', '🗂️ All exercises'], ['question_bank', '❓ Questions'], ['listening', '🎧 Listening'], ['dictation', '⌨️ Dictation']].map(([val, lbl]) => (
        <button key={val} onClick={() => setFilter('source', val)} style={{ display: 'block', width: '100%', textAlign: 'left', padding: '5px 8px', borderRadius: 6, border: 'none', background: filters.source === val ? '#667eea' : 'transparent', color: filters.source === val ? 'white' : '#4a5568', cursor: 'pointer', marginBottom: 1, fontSize: 13 }}>{lbl}</button>
      ))}

      <div style={{ borderTop: '1px solid #f0f0f0', margin: '8px 0 6px' }} />

      {/* Content group */}
      <div style={{ fontSize: 9, fontWeight: 700, color: '#a0aec0', letterSpacing: 1.2, textTransform: 'uppercase', marginBottom: 4 }}>Content</div>
      {[['connections', '🟨 Connections'], ['wotd', '📖 Word of the Day'], ['wordle', '🟩 Wordle'], ['crossword', '✜ Crossword'], ['wordsearch', '🔎 Wordsearch']].map(([val, lbl]) => (
        <button key={val} onClick={() => setFilter('source', val)} style={{ display: 'block', width: '100%', textAlign: 'left', padding: '5px 8px', borderRadius: 6, border: 'none', background: filters.source === val ? '#667eea' : 'transparent', color: filters.source === val ? 'white' : '#4a5568', cursor: 'pointer', marginBottom: 1, fontSize: 13 }}>{lbl}</button>
      ))}

      <div style={{ borderTop: '1px solid #f0f0f0', margin: '8px 0 10px' }} />

      {/* Language — always shown */}
      <FilterSection label="Language">
        <div style={{ display: 'flex', gap: 4 }}>
          {[['en', '🇬🇧'], ['es', '🇪🇸'], ['both', '🌐']].map(([val, lbl]) => (
            <button key={val} onClick={() => setFilter('lang', val)} style={{ flex: 1, padding: '5px 0', borderRadius: 6, border: '1px solid #e2e8f0', background: filters.lang === val ? '#667eea' : 'white', color: filters.lang === val ? 'white' : '#4a5568', cursor: 'pointer', fontSize: 16 }}>{lbl}</button>
          ))}
        </div>
      </FilterSection>

      {/* Content sources: date range */}
      {isContentSource && (
        <FilterSection label="Date range">
          <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginBottom: 6 }}>
            {[['This month', 0], ['Next month', 1], ['Last month', -1]].map(([lbl, offset]) => (
              <button key={lbl} onClick={() => setMonth(offset)} style={{ padding: '3px 7px', borderRadius: 6, border: '1px solid #e2e8f0', background: 'white', color: '#667eea', cursor: 'pointer', fontSize: 11, fontWeight: 600 }}>{lbl}</button>
            ))}
          </div>
          <input
            type="date" value={filters.dateFrom} onChange={e => setFilter('dateFrom', e.target.value)}
            style={{ width: '100%', padding: '5px 7px', border: '1px solid #e2e8f0', borderRadius: 6, fontSize: 12, boxSizing: 'border-box', marginBottom: 4 }}
          />
          <input
            type="date" value={filters.dateTo} onChange={e => setFilter('dateTo', e.target.value)}
            style={{ width: '100%', padding: '5px 7px', border: '1px solid #e2e8f0', borderRadius: 6, fontSize: 12, boxSizing: 'border-box' }}
          />
        </FilterSection>
      )}

      {/* Exercise-only filters */}
      {!isContentSource && (
        <>
          <FilterSection label="Level">
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
              {LEVELS.map(lv => (
                <button key={lv} onClick={() => toggleLevel(lv)} style={{ padding: '3px 9px', borderRadius: 6, border: '1px solid #e2e8f0', background: filters.levels.includes(lv) ? LEVEL_COLORS[lv] : 'white', color: filters.levels.includes(lv) ? 'white' : '#4a5568', cursor: 'pointer', fontSize: 12, fontWeight: 600 }}>{lv}</button>
              ))}
            </div>
          </FilterSection>

          {(filters.source === 'all' || filters.source === 'question_bank') && (
            <FilterSection label={`Type${filters.types.length ? ` (${filters.types.length})` : ''}`} collapsible open={typeOpen} onToggle={() => setTypeOpen(v => !v)}>
              {Object.entries(TYPE_INFO).map(([key, { emoji, label }]) => (
                <button key={key} onClick={() => toggleType(key)} style={{ display: 'block', width: '100%', textAlign: 'left', padding: '4px 7px', borderRadius: 6, border: 'none', background: filters.types.includes(key) ? '#edf2ff' : 'transparent', color: filters.types.includes(key) ? '#667eea' : '#4a5568', cursor: 'pointer', marginBottom: 1, fontSize: 12 }}>
                  {filters.types.includes(key) ? '✓' : '○'} {emoji} {label}
                </button>
              ))}
            </FilterSection>
          )}

          {(filters.source === 'all' || filters.source === 'question_bank') && (
            <FilterSection label={`Tag${filters.tags.length ? ` (${filters.tags.length})` : ''}`} collapsible open={tagOpen} onToggle={() => setTagOpen(v => !v)}>
              <input value={tagFilter} onChange={e => setTagFilter(e.target.value)} placeholder="Filter tags…" style={{ width: '100%', padding: '4px 7px', border: '1px solid #e2e8f0', borderRadius: 6, fontSize: 12, boxSizing: 'border-box', marginBottom: 5 }} />
              <div style={{ display: 'flex', flexDirection: 'column', gap: 1, maxHeight: 220, overflowY: 'auto' }}>
                {visibleTags.map(tag => (
                  <button key={tag} onClick={() => toggleTag(tag)} style={{ display: 'block', width: '100%', textAlign: 'left', padding: '3px 7px', borderRadius: 6, border: filters.tags.includes(tag) ? '1px solid #CBD5E0' : 'none', background: filters.tags.includes(tag) ? '#EDF2F7' : 'transparent', color: filters.tags.includes(tag) ? '#2d3748' : '#4a5568', cursor: 'pointer', fontSize: 11, fontWeight: filters.tags.includes(tag) ? 700 : 400 }}>
                    {filters.tags.includes(tag) ? '✓' : '○'} {tag}
                  </button>
                ))}
                {visibleTags.length === 0 && <span style={{ fontSize: 11, color: '#a0aec0', padding: '3px 7px' }}>No tags match</span>}
              </div>
            </FilterSection>
          )}

          <FilterSection label="Search">
            <div ref={searchRef} style={{ position: 'relative' }}>
              <input
                value={filters.searchText}
                onChange={e => { setFilter('searchText', e.target.value); setSearchOpen(true); }}
                onFocus={() => setSearchOpen(true)}
                onKeyDown={e => {
                  if (e.key === 'Enter')  { setSearchOpen(false); search(); }
                  if (e.key === 'Escape') { setSearchOpen(false); }
                }}
                placeholder="Topic, tag, or question text…"
                style={{ width: '100%', padding: '5px 8px', border: '1px solid #e2e8f0', borderRadius: 6, fontSize: 13, boxSizing: 'border-box' }}
              />
              {searchOpen && filters.searchText.trim() && (() => {
                const q = filters.searchText.trim().toLowerCase();
                const topicMatches = availableTopics.filter(t => t.toLowerCase().includes(q) && t !== filters.topic).slice(0, 8);
                const tagMatches   = availableTags.filter(t => t.toLowerCase().includes(q) && !filters.tags.includes(t)).slice(0, 8);
                if (!topicMatches.length && !tagMatches.length) return null;
                return (
                  <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, marginTop: 2, background: 'white', border: '1px solid #e2e8f0', borderRadius: 6, boxShadow: '0 4px 16px rgba(0,0,0,0.08)', zIndex: 100, maxHeight: 240, overflowY: 'auto' }}>
                    {topicMatches.map(t => (
                      <button key={`top-${t}`} onClick={() => { setFilter('topic', t); setFilter('searchText', ''); setSearchOpen(false); }}
                        onMouseEnter={e => e.currentTarget.style.background = '#f7fafc'}
                        onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                        style={{ display: 'block', width: '100%', textAlign: 'left', padding: '5px 9px', border: 'none', background: 'transparent', cursor: 'pointer', fontSize: 12, color: '#2d3748' }}>
                        📁 <span style={{ color: '#4a5568' }}>{t}</span>
                      </button>
                    ))}
                    {tagMatches.map(t => (
                      <button key={`tag-${t}`} onClick={() => { toggleTag(t); setFilter('searchText', ''); setSearchOpen(false); }}
                        onMouseEnter={e => e.currentTarget.style.background = '#f7fafc'}
                        onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                        style={{ display: 'block', width: '100%', textAlign: 'left', padding: '5px 9px', border: 'none', background: 'transparent', cursor: 'pointer', fontSize: 12, color: '#2d3748' }}>
                        🏷️ <span style={{ color: '#4a5568' }}>{t}</span>
                      </button>
                    ))}
                  </div>
                );
              })()}
            </div>
            {filters.topic && (
              <div style={{ marginTop: 5, display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, background: '#EDF2F7', border: '1px solid #CBD5E0', borderRadius: 4, padding: '2px 6px', fontSize: 11, color: '#2d3748', fontWeight: 600 }}>
                  📁 {filters.topic}
                  <button onClick={() => setFilter('topic', '')} style={{ background: 'none', border: 'none', color: '#718096', cursor: 'pointer', fontSize: 13, padding: 0, lineHeight: 1 }}>×</button>
                </span>
              </div>
            )}
            <div style={{ fontSize: 10, color: '#a0aec0', marginTop: 5, lineHeight: 1.4 }}>
              Click a suggestion to filter exactly, or hit Enter to search across question text.
            </div>
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
        </>
      )}

      <button onClick={() => search()} disabled={loading} style={{ width: '100%', padding: '9px', background: '#667eea', color: 'white', border: 'none', borderRadius: 8, fontSize: 14, fontWeight: 700, cursor: 'pointer' }}>
        {loading ? '…' : '🔍 Search'}
      </button>
      <button onClick={() => {
        setFilters({ source: filters.source, levels: [], types: [], tags: [], topic: '', searchText: '', lang: 'en', qFrom: '', qTo: '', newOnly: false, dateFrom: '', dateTo: '' });
        setResults([]); setHasSearched(false); setActiveSet(null); setSelected(new Set()); setTagFilter(''); setSearchOpen(false);
      }} style={{ width: '100%', padding: '7px', background: 'transparent', color: '#718096', border: '1px solid #e2e8f0', borderRadius: 8, fontSize: 12, cursor: 'pointer', marginTop: 5 }}>
        Clear
      </button>
    </div>
  );

  // ── Results List ─────────────────────────────────────────────────────────────
  let exerciseIdx = -1; // track index within exercise results only

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
          {results.length > 0 && !isContentSource && (
            <>
              <button onClick={selectAll} style={{ fontSize: 12, color: '#667eea', background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline' }}>Select all</button>
              {selected.size > 0 && (
                <>
                  <button onClick={clearSelection} style={{ fontSize: 12, color: '#718096', background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline' }}>Clear</button>
                  <span style={{ background: '#667eea', color: 'white', borderRadius: 12, padding: '2px 10px', fontSize: 12, fontWeight: 600 }}>{selected.size} selected</span>
                </>
              )}
              {exerciseResults.length > 0 && (
                <button onClick={() => enterFocus(0)} style={{ marginLeft: 'auto', padding: '4px 12px', borderRadius: 7, border: '1px solid #667eea', background: 'white', color: '#667eea', cursor: 'pointer', fontSize: 12, fontWeight: 700 }}>
                  {selected.size > 0 ? `⛶ Focus (${selected.size})` : '⛶ Focus all'}
                </button>
              )}
            </>
          )}
        </div>
      )}

      {selected.size > 0 && !isContentSource && (
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

      {!loading && results.map((item) => {
        // ── Connections item ────────────────────────────────────────────────
        if (item._source === 'connections') {
          return (
            <div
              key={item._rowKey}
              onClick={() => handleItemClick(item, -1)}
              style={{ padding: '10px 14px', background: 'white', border: '1px solid #e2e8f0', borderRadius: 10, marginBottom: 5, cursor: 'pointer' }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                <span style={{ background: '#f9df6d', color: '#2d2000', borderRadius: 5, padding: '2px 7px', fontSize: 12, fontWeight: 700 }}>🟨 Connections</span>
                <span style={{ fontSize: 13, color: '#718096' }}>{fmtDate(item.play_date)}</span>
                <span style={{ marginLeft: 'auto', fontSize: 13, color: '#667eea', fontWeight: 700 }}>▶ Play</span>
              </div>
              <div style={{ fontWeight: 700, fontSize: 14, color: '#2d3748', marginBottom: 6 }}>{item.title}</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                {item.groups.map(g => {
                  const s = RANK_STYLE[g.colour_rank];
                  return (
                    <div key={g.colour_rank} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span style={{ width: 8, height: 8, borderRadius: '50%', background: s.bg, border: `1px solid ${s.border}`, flexShrink: 0 }} />
                      <span style={{ fontSize: 11, color: '#718096', flex: '0 0 60px', fontWeight: 600 }}>{s.label}</span>
                      <span style={{ fontSize: 12, color: '#4a5568' }}>{g.words.join(' · ')}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        }

        // ── WOTD item ───────────────────────────────────────────────────────
        if (item._source === 'wotd') {
          const expanded = wotdExpanded.has(item.date);
          const enWords = item.entries.filter(e => e.language === 'en');
          const esWords = item.entries.filter(e => e.language === 'es');
          return (
            <div
              key={item._rowKey}
              style={{ background: 'white', border: '1px solid #e2e8f0', borderRadius: 10, marginBottom: 5, overflow: 'hidden' }}
            >
              {/* Collapsed header */}
              <div
                onClick={() => handleItemClick(item, -1)}
                style={{ padding: '10px 14px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8 }}
              >
                <span style={{ background: '#EDE9FE', color: '#553C9A', borderRadius: 5, padding: '2px 7px', fontSize: 12, fontWeight: 700 }}>📖 WOTD</span>
                <span style={{ fontSize: 13, color: '#718096' }}>{fmtDate(item.date)}</span>
                <span style={{ fontSize: 12, color: '#4a5568', marginLeft: 4 }}>
                  {item.entries.map(e => e.word).join(' · ')}
                </span>
                <span style={{ marginLeft: 'auto', color: '#a0aec0', fontSize: 12 }}>{expanded ? '▲' : '▼'}</span>
              </div>
              {/* Expanded detail */}
              {expanded && (
                <div style={{ padding: '0 14px 14px', borderTop: '1px solid #f0f0f0', display: 'flex', flexDirection: 'column', gap: 10, paddingTop: 10 }}>
                  {[...enWords, ...esWords].map((e, i) => (
                    <div key={i} style={{ background: '#f8f9fa', borderRadius: 8, padding: '10px 12px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                        <span style={{ background: e.language === 'es' ? '#f6ad55' : LEVEL_COLORS[e.level?.split('/')[0]] || '#667eea', color: 'white', borderRadius: 5, padding: '1px 7px', fontSize: 11, fontWeight: 700 }}>
                          {e.language === 'es' ? '🇪🇸 ES' : e.level}
                        </span>
                        <span style={{ fontWeight: 700, fontSize: 15 }}>{e.word}</span>
                        {e.part_of_speech && <span style={{ fontSize: 12, color: '#718096', fontStyle: 'italic' }}>{e.part_of_speech}</span>}
                      </div>
                      <div style={{ fontSize: 13, color: '#4a5568', marginBottom: 4 }}>{e.definition}</div>
                      {e.example_sentence && <div style={{ fontSize: 13, color: '#718096', fontStyle: 'italic' }}>"{e.example_sentence}"</div>}
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        }

        // ── Wordle item ─────────────────────────────────────────────────────
        if (item._source === 'wordle') {
          return (
            <div
              key={item._rowKey}
              onClick={() => handleItemClick(item, -1)}
              style={{ padding: '10px 14px', background: 'white', border: '1px solid #e2e8f0', borderRadius: 10, marginBottom: 5, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 10 }}
            >
              <span style={{ background: '#c6f6d5', color: '#276749', borderRadius: 5, padding: '2px 7px', fontSize: 12, fontWeight: 700 }}>🟩 Wordle</span>
              <span style={{ fontSize: 13, color: '#718096' }}>{fmtDate(item.play_date)}</span>
              <span style={{ fontSize: 13 }}>{item.language === 'es' ? '🇪🇸' : '🇬🇧'}</span>
              <span style={{ fontWeight: 700, fontSize: 15, letterSpacing: 2, color: '#2d3748' }}>{item.word?.toUpperCase()}</span>
              <span style={{ marginLeft: 'auto', fontSize: 13, color: '#667eea', fontWeight: 700 }}>▶ Play</span>
            </div>
          );
        }

        // ── Crossword item ────────────────────────────────────────
        if (item._source === 'crossword') {
          return (
            <div
              key={item._rowKey}
              onClick={() => handleItemClick(item, -1)}
              style={{ padding: '10px 14px', background: 'white', border: '1px solid #e2e8f0', borderRadius: 10, marginBottom: 5, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}
            >
              <span style={{ background: '#e9d8fd', color: '#553c9a', borderRadius: 5, padding: '2px 7px', fontSize: 12, fontWeight: 700 }}>✜ Crossword</span>
              <span style={{ fontSize: 13, color: '#718096' }}>{item.play_date ? fmtDate(item.play_date) : (item.title || 'Themed')}</span>
              <span style={{ fontSize: 13 }}>{item.language === 'es' ? '🇪🇸' : '🇬🇧'}</span>
              <span style={{ background: LEVEL_COLORS[item.level + '1'] || '#718096', color: 'white', borderRadius: 5, padding: '1px 7px', fontSize: 11, fontWeight: 700 }}>Level {item.level}</span>
              <span style={{ fontSize: 13, color: '#4a5568' }}>★ {item.star_word}</span>
              <span style={{ marginLeft: 'auto', fontSize: 13, color: '#667eea', fontWeight: 700 }}>▶ Play</span>
            </div>
          );
        }

        // ── Wordsearch item ─────────────────────────────────────
        if (item._source === 'wordsearch') {
          return (
            <div
              key={item._rowKey}
              onClick={() => handleItemClick(item, -1)}
              style={{ padding: '10px 14px', background: 'white', border: '1px solid #e2e8f0', borderRadius: 10, marginBottom: 5, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}
            >
              <span style={{ background: '#e2e8f0', color: '#2d3748', borderRadius: 5, padding: '2px 7px', fontSize: 12, fontWeight: 700 }}>🔎 Wordsearch</span>
              <span style={{ fontSize: 13, color: '#718096' }}>{item.play_date ? fmtDate(item.play_date) : 'Themed'}</span>
              <span style={{ fontSize: 13 }}>{item.language === 'es' ? '🇪🇸' : '🇬🇧'}</span>
              <span style={{ fontSize: 13, color: '#4a5568', fontWeight: 600 }}>{item.theme}</span>
              <span style={{ fontSize: 13, color: '#4a5568' }}>★ {item.star_word}</span>
              <span style={{ marginLeft: 'auto', fontSize: 13, color: '#667eea', fontWeight: 700 }}>▶ Play</span>
            </div>
          );
        }

        // ── Exercise item (existing) ─────────────────────────────────────────
        exerciseIdx++;
        const thisExerciseIdx = exerciseIdx;
        const isSel   = selected.has(item._rowKey);
        const srcMeta = SOURCE_META[item._source];
        const title   = item._source === 'question_bank' ? (item.question || '').slice(0, 110) : (item.title || '');
        const sub     = item._source === 'question_bank' ? `Q${item.question_number} · ${TYPE_INFO[item.type]?.label || item.type}` : (item.description || item.answer || '').slice(0, 70);
        const itemTags = item._source === 'question_bank' && item.tags && item.tags.length > 0 ? item.tags : [];
        return (
          <div key={item._rowKey} onClick={() => handleItemClick(item, thisExerciseIdx)} style={{ display: 'flex', alignItems: 'flex-start', gap: 8, padding: '9px 11px', background: 'white', border: '1px solid #e2e8f0', borderRadius: 10, marginBottom: 5, cursor: 'pointer' }}>
            <div onClick={e => { e.stopPropagation(); toggleSelect(item._rowKey); }} style={{ flexShrink: 0, width: 18, height: 18, border: `2px solid ${isSel ? '#667eea' : '#cbd5e0'}`, borderRadius: 4, background: isSel ? '#667eea' : 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontSize: 11, marginTop: 2 }}>
              {isSel && '✓'}
            </div>
            <div style={{ flexShrink: 0, background: srcMeta.color, color: 'white', borderRadius: 5, padding: '2px 6px', fontSize: 12, marginTop: 1 }}>{srcMeta.emoji}</div>
            {item.level && (
              <div style={{ flexShrink: 0, background: LEVEL_COLORS[item.level] || '#718096', color: 'white', borderRadius: 5, padding: '2px 7px', fontSize: 11, fontWeight: 700, minWidth: 26, textAlign: 'center', marginTop: 1 }}>
                {item.level}
              </div>
            )}
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 500, color: '#2d3748', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{title}</div>
              <div style={{ fontSize: 11, color: '#718096', marginTop: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{sub}</div>
              {itemTags.length > 0 && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3, marginTop: 4 }}>
                  {itemTags.map(tag => (
                    <span key={tag} style={{ background: '#EDF2F7', color: '#4a5568', border: '1px solid #CBD5E0', borderRadius: 4, padding: '1px 6px', fontSize: 10, fontWeight: 600 }}>{tag}</span>
                  ))}
                </div>
              )}
            </div>
            <button onClick={e => { e.stopPropagation(); handleItemClick(item, thisExerciseIdx); }} title="Open in focus mode" style={{ flexShrink: 0, background: 'none', border: 'none', color: '#a0aec0', cursor: 'pointer', fontSize: 15, padding: '1px 5px', lineHeight: 1 }}>⛶</button>
            {activeSet && <button onClick={e => { e.stopPropagation(); removeFromActiveSet(item.id); }} style={{ flexShrink: 0, background: 'none', border: 'none', color: '#e53e3e', cursor: 'pointer', fontSize: 17, padding: '1px 5px', lineHeight: 1 }}>×</button>}
          </div>
        );
      })}
    </div>
  );

  const previewPanel = previewItem && (
    <div style={{ width: 380, flexShrink: 0, background: 'white', borderRadius: 12, boxShadow: '0 4px 24px rgba(0,0,0,0.11)', alignSelf: 'flex-start', position: 'sticky', top: 12, overflow: 'hidden' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', borderBottom: '1px solid #e2e8f0' }}>
        <div style={{ display: 'flex', background: '#f7fafc', borderRadius: 7, padding: 3, gap: 2 }}>
          {[['teacher', '👨‍🏫 Teacher'], ['student', '👤 Student']].map(([mode, label]) => (
            <button key={mode} onClick={() => setPreviewMode(mode)} style={{ padding: '4px 12px', borderRadius: 5, border: 'none', background: previewMode === mode ? '#667eea' : 'transparent', color: previewMode === mode ? 'white' : '#718096', cursor: 'pointer', fontSize: 12, fontWeight: previewMode === mode ? 700 : 400 }}>{label}</button>
          ))}
        </div>
        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          <button onClick={() => { const idx = exerciseResults.findIndex(r => r._rowKey === previewItem._rowKey); enterFocus(idx >= 0 ? idx : 0); }} title="Expand to focus mode" style={{ background: 'none', border: '1px solid #e2e8f0', borderRadius: 6, color: '#667eea', cursor: 'pointer', fontSize: 14, padding: '2px 8px' }}>⛶</button>
          <button onClick={() => setPreviewItem(null)} style={{ background: 'none', border: 'none', color: '#a0aec0', cursor: 'pointer', fontSize: 20, lineHeight: 1 }}>×</button>
        </div>
      </div>
      <div style={{ padding: '1.1rem', maxHeight: 'calc(100vh - 180px)', overflowY: 'auto' }}>
        {previewMode === 'teacher' ? <TeacherCard item={previewItem} /> : <InteractiveQuestion key={previewItem._rowKey} item={previewItem} />}
      </div>
    </div>
  );

  return (
    <div style={{ minHeight: '100vh', background: '#f8f9fa' }}>
      {/* Exercise focus mode */}
      {focusMode && (
        <FocusMode items={focusItems} index={focusIndex} onChangeIndex={setFocusIndex} previewMode={previewMode} setPreviewMode={setPreviewMode} onExit={() => setFocusMode(false)} />
      )}
      {/* Connections Class Play overlay — the real student component; teacher mode writes no stars */}
      {connectionsFocus && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 3000, background: '#f8f9fa', overflowY: 'auto' }}>
          <button onClick={() => setConnectionsFocus(null)} style={{ position: 'fixed', top: 12, right: 12, zIndex: 3001, padding: '6px 14px', borderRadius: 8, border: '1px solid #e2e8f0', background: 'white', color: '#4a5568', cursor: 'pointer', fontSize: 13, fontWeight: 600, boxShadow: '0 2px 8px rgba(0,0,0,0.12)' }}>✕ Close</button>
          <ConnectionsGame classPuzzle={connectionsFocus} onBack={() => setConnectionsFocus(null)} />
        </div>
      )}
      {/* Wordle Class Play overlay — the real student component; teacher mode writes no stars */}
      {wordleFocus && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 3000, background: '#f8f9fa', overflowY: 'auto' }}>
          <button onClick={() => setWordleFocus(null)} style={{ position: 'fixed', top: 12, right: 12, zIndex: 3001, padding: '6px 14px', borderRadius: 8, border: '1px solid #e2e8f0', background: 'white', color: '#4a5568', cursor: 'pointer', fontSize: 13, fontWeight: 600, boxShadow: '0 2px 8px rgba(0,0,0,0.12)' }}>✕ Close</button>
          <WordleGame classPuzzle={wordleFocus} onBack={() => setWordleFocus(null)} />
        </div>
      )}
      {/* Crossword Class Play overlay — the real student component; teacher mode writes no stars */}
      {crosswordFocus && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 3000, background: '#f8f9fa', overflowY: 'auto' }}>
          <button onClick={() => setCrosswordFocus(null)} style={{ position: 'fixed', top: 12, right: 12, zIndex: 3001, padding: '6px 14px', borderRadius: 8, border: '1px solid #e2e8f0', background: 'white', color: '#4a5568', cursor: 'pointer', fontSize: 13, fontWeight: 600, boxShadow: '0 2px 8px rgba(0,0,0,0.12)' }}>✕ Close</button>
          <CrosswordGame classPuzzle={crosswordFocus} onBack={() => setCrosswordFocus(null)} />
        </div>
      )}
      {/* Wordsearch Class Play overlay — the real student component; teacher mode writes no stars */}
      {wordsearchFocus && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 3000, background: '#f8f9fa', overflowY: 'auto' }}>
          <button onClick={() => setWordsearchFocus(null)} style={{ position: 'fixed', top: 12, right: 12, zIndex: 3001, padding: '6px 14px', borderRadius: 8, border: '1px solid #e2e8f0', background: 'white', color: '#4a5568', cursor: 'pointer', fontSize: 13, fontWeight: 600, boxShadow: '0 2px 8px rgba(0,0,0,0.12)' }}>✕ Close</button>
          <WordSearchGame classPuzzle={wordsearchFocus} onBack={() => setWordsearchFocus(null)} />
        </div>
      )}
      <div style={{ maxWidth: 1300, margin: '0 auto', padding: '12px 1rem 2rem', display: 'flex', gap: 10, alignItems: 'flex-start' }}>
        {sidebar}
        {resultsList}
        {previewPanel}
      </div>
    </div>
  );
}
