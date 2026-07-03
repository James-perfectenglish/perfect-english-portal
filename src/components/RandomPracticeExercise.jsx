import { useState, useEffect, useRef } from 'react';
import { supabase } from '../supabaseClient';
import SentenceBuildingInput from './SentenceBuildingInput';
import MatchingPairs from './MatchingPairs';
import SentenceChallenge from './SentenceChallenge';
import { LevelBadge, TypeBadge, AiMarkedBadge, TopicBadge } from './BadgePill';
import FlagQuestion from './FlagQuestion';

// ── Question mix per round (easy to tweak!) ──
const QUESTION_MIX = {
  gap_fill: 3,
  multiple_choice: 4,
  sentence_building: 3,
  odd_one_out: 3,
  error_correction: 3,
  matching: 2,
  dictation: 1,
  pronunciation: 1,
  // Total: 20
};

// ── Weak Spots question mix ──
const buildWeakMix = (weakTypes) => {
  if (!weakTypes || weakTypes.length === 0) return QUESTION_MIX;
  const mix = Object.fromEntries(Object.keys(QUESTION_MIX).map(k => [k, 0]));
  const perWeak = Math.floor(15 / weakTypes.length);
  weakTypes.forEach(t => { if (t in mix) mix[t] = perWeak; });
  const fallback = ['multiple_choice', 'dictation', 'matching', 'gap_fill'].filter(t => !weakTypes.includes(t));
  let rem = 20 - weakTypes.reduce((s, t) => s + (mix[t] || 0), 0);
  for (const t of fallback) {
    if (rem <= 0) break;
    const give = Math.min(rem, QUESTION_MIX[t] || 2);
    mix[t] = give; rem -= give;
  }
  return mix;
};

// ── Auto playback speed for quick dictation by level ──
const getAutoSpeed = (level) => {
  if (['A1', 'A2'].includes(level)) return 0.9;
  if (['C1', 'C2'].includes(level)) return 1.1;
  return 1.0;
};

// Inject CSS for focus fix on OOO, EC, and matching tiles
const RP_STYLE_ID = 'rp-focus-fix';
if (typeof document !== 'undefined' && !document.getElementById(RP_STYLE_ID)) {
  const style = document.createElement('style');
  style.id = RP_STYLE_ID;
  style.textContent = `
    .rp-ooo-option, .rp-ooo-option:focus, .rp-ooo-option:focus-visible,
    .rp-ec-tile, .rp-ec-tile:focus, .rp-ec-tile:focus-visible {
      outline: none !important;
      -webkit-tap-highlight-color: transparent !important;
    }
  `;
  document.head.appendChild(style);
}

// ── Mute helpers ──
const MUTE_AUDIO_KEY = 'pe_mute_audio_until';
const MUTE_SPEAKING_KEY = 'pe_mute_speaking_until';
const MUTE_DURATION_MS = 15 * 60 * 1000;
const isMuted = (key) => { const v = localStorage.getItem(key); return !!v && Date.now() < parseInt(v, 10); };
const muteFor15 = (key) => localStorage.setItem(key, String(Date.now() + MUTE_DURATION_MS));
const getMuteMinutesLeft = (key) => { const v = localStorage.getItem(key); if (!v) return 0; const ms = parseInt(v, 10) - Date.now(); return ms > 0 ? Math.ceil(ms / 60000) : 0; };

function shuffleArray(arr) {
  const shuffled = [...arr];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

// ── Levenshtein distance ──
function levenshtein(a, b) {
  const m = a.length, n = b.length;
  const dp = Array.from({ length: m + 1 }, (_, i) => [i, ...Array(n).fill(0)]);
  for (let j = 0; j <= n; j++) dp[0][j] = j;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] = a[i - 1] === b[j - 1] ? dp[i - 1][j - 1] : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
    }
  }
  return dp[m][n];
}

function isFuzzyMatch(studentAnswer, correctAnswers) {
  for (const correct of correctAnswers) {
    // Single-word answers: only fuzzy if the correct word is long enough to make a typo plausible.
    // Words of 3 chars or fewer (e.g. "of", "on", "for") must not fuzzy-match each other.
    if (!correct.includes(' ') && !studentAnswer.includes(' ')) {
      if (correct.length <= 3) continue;
      const dist = levenshtein(studentAnswer, correct);
      if (dist === 1) return true;
      if (dist === 2 && correct.length >= 6) return true;
      continue;
    }
    // Multi-word: only fuzzy if exactly one word differs AND that word is long enough to be a typo
    // This prevents "have got" passing for "has got" (grammar error, not typo)
    const sWords = studentAnswer.split(/\s+/);
    const cWords = correct.split(/\s+/);
    if (sWords.length !== cWords.length) continue;
    let diffs = 0, diffOk = true;
    for (let i = 0; i < cWords.length; i++) {
      const d = levenshtein(sWords[i] || '', cWords[i] || '');
      if (d > 0) {
        diffs++;
        if (cWords[i].length < 5 || d > 1) diffOk = false;
      }
    }
    if (diffs === 1 && diffOk) return true;
  }
  return false;
}

const normaliseEC = (s) => s.toLowerCase().trim().replace(/\s+/g, ' ');
const normaliseDictation = (s) => s.toLowerCase().trim().replace(/[.,!?;:'"]/g, '').replace(/\s+/g, ' ');

const findErrorIndex = (questionWords, correctAnswer) => {
  const correctWords = correctAnswer.trim().split(/\s+/);
  for (let i = 0; i < Math.max(questionWords.length, correctWords.length); i++) {
    if (!questionWords[i] || !correctWords[i] || questionWords[i].toLowerCase() !== correctWords[i].toLowerCase()) {
      return { index: i, correctWord: correctWords[i] || '(missing)' };
    }
  }
  return { index: -1, correctWord: '' };
};

const getQuestionLanguage = (question) => question?.topic === 'spanish' || question?.language === 'es' ? 'es' : 'en';

// ── Extract a meaningful word from the answered question for the sentence challenge ──
const STOP_WORDS = new Set([
  'a','an','the','in','on','at','to','for','of','and','or','but','is','are','was','were',
  'be','been','have','has','had','do','does','did','will','would','could','should','may',
  'might','must','can','it','he','she','they','we','i','you','my','his','her','their',
  'our','your','its','this','that','these','those','not','no','so','as','by','up','out',
  'off','if','than','then','with','from','into','about','over','after','before','just',
  'very','too','also','back','more','some','all','one','two','its','got',
]);

function getChallengeWord(question) {
  if (!question || question.type === 'matching' || question.type === 'pronunciation') return null;
  const sourceText = question.correct_answer || '';
  if (!sourceText) return null;
  // Preserve original capitalisation for proper nouns
  const rawWords = sourceText.split(/\s+/).map(w => w.replace(/[.,!?;:'\'"()]/g, '')).filter(Boolean);
  const words = rawWords.map(w => w.toLowerCase());
  const candidates = rawWords.filter((w, i) => words[i].length > 3 && !STOP_WORDS.has(words[i]));
  if (candidates.length === 0) return rawWords.find((w, i) => words[i].length > 2) || null;
  // Prefer longest candidate — most likely to be the key vocabulary item
  return candidates.sort((a, b) => b.length - a.length)[0] || null;
}

const aiMarkGapFill = async (question, correctAnswer, studentAnswer, language = 'en') => {
  try {
    const response = await fetch('/api/mark-gap', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'gap_fill', question, correctAnswer, studentAnswer, language }),
    });
    if (!response.ok) return null;
    const result = await response.json();
    if (result.valid === null) return null;
    return result;
  } catch (e) { console.error('AI gap fill marking error:', e); return null; }
};

const aiMarkCorrection = async (originalSentence, errorWord, studentReplacement, correctAnswerSentence, language = 'en', level = 'B1') => {
  try {
    const response = await fetch('/api/mark-free', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'correction', originalSentence, errorWord, studentReplacement, correctAnswerSentence, language, level }),
    });
    if (!response.ok) return null;
    const result = await response.json();
    if (result.valid === null) return null;
    return result;
  } catch (e) { console.error('AI correction marking error:', e); return null; }
};

const aiMarkDictation = async (correctAnswer, studentAnswer, excerptType = 'phrase', acceptableAlternatives = []) => {
  try {
    const response = await fetch('/api/mark-gap', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'dictation', correctAnswer, studentAnswer, excerptType, acceptableAlternatives }),
    });
    if (!response.ok) return null;
    const result = await response.json();
    return result;
  } catch (e) { console.error('AI dictation marking error:', e); return null; }
};

export default function RandomPracticeExercise({ levels, levelTitle, levelSubtitle, gradient, language = 'en', userTracks = [], weakTypes = [], fixups = [], onBack }) {
  const isSpanish = language === 'es';

  // Topics that are restricted to specific tracks
  const TRACK_TOPICS = {
    bathroom_vocabulary: 'bathroom',
    hotel_vocabulary:    'hotels',
    business_vocabulary: 'business',
    business_phrasal_verbs: 'business',
  };

  const isAllowedByTrack = (topic) => {
    const requiredTrack = TRACK_TOPICS[topic];
    if (!requiredTrack) return true;
    return userTracks.includes(requiredTrack);
  };

  const [stage, setStage] = useState('start');
  const [questions, setQuestions] = useState([]);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [userAnswer, setUserAnswer] = useState('');
  const [selectedOption, setSelectedOption] = useState(null);
  const [feedback, setFeedback] = useState(null);
  const [score, setScore] = useState(0);
  const scoreRef = useRef(0);
  useEffect(() => { scoreRef.current = score; }, [score]);
  const [showHint, setShowHint] = useState(false);
  const [loading, setLoading] = useState(false);
  const [isChecking, setIsChecking] = useState(false);
  const [sbFeedback, setSbFeedback] = useState(null);
  const [bestScore, setBestScore] = useState(null);
  const [averageScore, setAverageScore] = useState(null);
  const allScoresRef = useRef([]);
  const [oooSelected, setOooSelected] = useState(null);
  const [ecSelectedWordIndex, setEcSelectedWordIndex] = useState(null);
  const [ecCorrection, setEcCorrection] = useState('');
  const [matchingDone, setMatchingDone] = useState(false);
  const audioRef = useRef(null);
  const [audioPlayed, setAudioPlayed] = useState(false);

  // ── Pronunciation recording state ──
  const [isRecording, setIsRecording] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [isMarking, setIsMarking] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [pronTranscript, setPronTranscript] = useState('');
  const pronRecorderRef = useRef(null);
  const pronChunksRef = useRef([]);
  const pronStreamRef = useRef(null);
  const pronTimerRef = useRef(null);

  // ── Sentence challenge ──
  const [challengePositions, setChallengePositions] = useState(new Set());
  const challengePositionsRef = useRef(new Set());
  const [showChallenge, setShowChallenge] = useState(false);
  const [challengeWord, setChallengeWord] = useState('');
  const [challengeLevel, setChallengeLevel] = useState(null);

  useEffect(() => { window.scrollTo(0, 0); }, [stage]);

  const getLevelKey = () => {
    if (isSpanish) return 'spanish';
    if (levels && levels.length > 0) return levels.sort().join('-');
    return 'all';
  };

  useEffect(() => { loadScoreHistory(); }, []);

  const loadScoreHistory = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data: attempts, error } = await supabase
        .from('student_attempts')
        .select('score, answers')
        .eq('student_id', user.id)
        .is('exercise_id', null);
      if (error || !attempts) return;
      const levelKey = getLevelKey();
      const scores = attempts
        .filter(a => a.answers && a.answers.practice_type === 'random_practice' && a.answers.levels === levelKey)
        .map(a => a.score);
      if (scores.length > 0) allScoresRef.current = scores;
    } catch (error) { console.error('Error loading score history:', error); }
  };

  const finishExercise = () => {
    const currentScore = scoreRef.current;
    allScoresRef.current = [...allScoresRef.current, currentScore];
    const scores = allScoresRef.current;
    setBestScore(Math.max(...scores));
    setAverageScore(Math.round((scores.reduce((a, b) => a + b, 0) / scores.length) * 10) / 10);
    setStage('finished');
    saveAttemptToDB(currentScore);
  };

  const saveAttemptToDB = async (currentScore) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      await supabase.from('student_attempts').insert({
        student_id: user.id, exercise_id: null, score: currentScore,
        answers: { practice_type: 'random_practice', levels: getLevelKey(), total_questions: questions.length },
      });
    } catch (error) { console.error('Error saving attempt:', error); }
  };

  const saveAnswer = async (question, studentAnswer, isCorrect) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      await supabase.from('student_answers').insert({
        student_id: user.id,
        question_id: question.question_number,
        student_answer: studentAnswer,
        correct_answer: question.correct_answer || '',
        is_correct: isCorrect,
      });
    } catch (error) { console.error('Error saving answer:', error); }
  };

  const saveDictationAnswer = async (exerciseId, studentAnswer, isCorrect, isSoftPass) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      await supabase.from('dictation_sessions').insert({
        student_id: user.id,
        exercise_id: exerciseId,
        student_answer: studentAnswer,
        is_correct: isCorrect,
        is_soft_pass: isSoftPass,
      });
    } catch (error) { console.error('Error saving dictation answer:', error); }
  };

  // ── Pronunciation recording cleanup (safe to call anytime) ──
  const stopPronunciationCleanup = () => {
    if (pronTimerRef.current) { clearInterval(pronTimerRef.current); pronTimerRef.current = null; }
    if (pronRecorderRef.current && pronRecorderRef.current.state !== 'inactive') { try { pronRecorderRef.current.stop(); } catch(e) {} }
    if (pronStreamRef.current) { pronStreamRef.current.getTracks().forEach(t => t.stop()); pronStreamRef.current = null; }
  };

  // ── Mute handlers ──
  const handleMuteAudio = () => { muteFor15(MUTE_AUDIO_KEY); advanceQuestion(); };
  const handleMuteSpeaking = () => { stopPronunciationCleanup(); muteFor15(MUTE_SPEAKING_KEY); advanceQuestion(); };

  // ── Pronunciation: start recording ──
  const startPronunciationRecording = async () => {
    if (isRecording || isTranscribing || isMarking) return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      pronStreamRef.current = stream;
      pronChunksRef.current = [];
      const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus') ? 'audio/webm;codecs=opus'
                      : MediaRecorder.isTypeSupported('audio/webm') ? 'audio/webm' : '';
      const rec = new MediaRecorder(stream, mimeType ? { mimeType } : {});
      pronRecorderRef.current = rec;
      rec.ondataavailable = (e) => { if (e.data && e.data.size > 0) pronChunksRef.current.push(e.data); };
      rec.onstop = async () => {
        stopPronunciationCleanup();
        setIsRecording(false);
        setRecordingSeconds(0);
        const blob = new Blob(pronChunksRef.current, { type: mimeType || 'audio/webm' });
        if (blob.size < 1000) {
          setFeedback({ type: 'incorrect', isCorrect: false, message: "We didn't catch anything — make sure your microphone is working and try again.", pronFeedback: true });
          return;
        }
        setIsTranscribing(true);
        await transcribeAndMarkPronunciation(blob, mimeType || 'audio/webm');
        setIsTranscribing(false);
      };
      rec.start(100);
      setIsRecording(true);
      setRecordingSeconds(0);
      pronTimerRef.current = setInterval(() => {
        setRecordingSeconds(s => { if (s >= 14) { stopPronunciationRecording(); return 0; } return s + 1; });
      }, 1000);
    } catch (e) {
      console.error('Microphone error:', e);
      setFeedback({ type: 'incorrect', isCorrect: false, message: 'Could not access your microphone. Check your browser permissions and try again.', pronFeedback: true });
    }
  };

  const stopPronunciationRecording = () => {
    if (pronTimerRef.current) { clearInterval(pronTimerRef.current); pronTimerRef.current = null; }
    if (pronRecorderRef.current && pronRecorderRef.current.state === 'recording') pronRecorderRef.current.stop();
  };

  const transcribeAndMarkPronunciation = async (blob, mimeType) => {
    const cq = questions[currentQuestionIndex];
    const target = cq?.sentence_template
      ? cq.sentence_template.replace(/_{3,}/g, cq.correct_answer || '')
      : (cq?.correct_answer || '');
    const language = isSpanish ? 'es' : 'en';
    try {
      const transcribeRes = await fetch(`/api/transcribe?language=${language}`, {
        method: 'POST',
        headers: { 'Content-Type': mimeType },
        body: blob,
      });
      const transcribeData = transcribeRes.ok ? await transcribeRes.json() : null;
      const spokenText = transcribeData?.transcript?.trim() || '';
      if (!spokenText) {
        setFeedback({ type: 'incorrect', isCorrect: false, message: "We couldn't make out what you said. Try speaking more clearly and closer to your microphone.", pronFeedback: true });
        return;
      }
      setPronTranscript(spokenText);
      setIsMarking(true);
      const markRes = await fetch('/api/mark-pronunciation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ target, spoken: spokenText, language }),
      });
      const result = markRes.ok ? await markRes.json() : null;
      const finalResult = result || { valid: null, feedback: 'Could not analyse your recording — try again.' };
      setIsMarking(false);
      const isCorrect = finalResult.valid === true;
      setFeedback({ type: isCorrect ? 'correct' : finalResult.valid === null ? 'soft-pass' : 'incorrect', isCorrect, message: finalResult.feedback || '', pronFeedback: true });
      if (isCorrect) setScore(s => s + 1);
    } catch (e) {
      console.error('Pronunciation marking error:', e);
      setIsMarking(false);
      setFeedback({ type: 'incorrect', isCorrect: false, message: 'Could not analyse your recording — please try again.', pronFeedback: true });
    }
  };

  const startExercise = async () => {
    window.scrollTo({ top: 0, behavior: 'instant' });
    setLoading(true);
    try {
      // ── Fix it! mode: serve the student's own past mistakes, in queue order ──
      if (fixups && fixups.length > 0) {
        const qns = fixups.map(f => f.question_number);
        const { data: bankRows, error: fixErr } = await supabase
          .from('question_bank').select('*').in('question_number', qns);
        if (fixErr) throw fixErr;
        const byQn = Object.fromEntries((bankRows || []).map(q => [q.question_number, q]));
        const ordered = qns.map(qn => byQn[qn]).filter(Boolean).map(q => {
          if ((q.type === 'multiple_choice' || q.type === 'odd_one_out') && Array.isArray(q.options)) {
            return { ...q, options: shuffleArray(q.options) };
          }
          return q;
        });
        if (ordered.length === 0) {
          alert(isSpanish ? 'No hay nada que arreglar hoy. ¡Buen trabajo!' : 'Nothing to fix today. Nice work!');
          setLoading(false);
          return;
        }
        challengePositionsRef.current = new Set();
        setChallengePositions(new Set());
        setQuestions(ordered);
        setStage('playing');
        setCurrentQuestionIndex(0);
        setScore(0);
        setFeedback(null);
        setSbFeedback(null);
        setUserAnswer('');
        setSelectedOption(null);
        setOooSelected(null);
        setEcSelectedWordIndex(null);
        setEcCorrection('');
        setMatchingDone(false);
        setShowHint(false);
        setIsChecking(false);
        setAudioPlayed(false);
        setIsRecording(false);
        setIsTranscribing(false);
        setIsMarking(false);
        setRecordingSeconds(0);
        setPronTranscript('');
        setShowChallenge(false);
        setChallengeWord('');
        setLoading(false);
        return;
      }

      const langFilter = isSpanish ? ['es', 'both'] : ['en', 'both'];

      const queryForType = (type) => {
        let q = supabase.from('question_bank').select('*').eq('type', type).in('language', langFilter);
        if (!isSpanish) q = q.neq('topic', 'spanish');
        if (!isSpanish && levels && levels.length > 0) q = q.in('level', levels);
        return q;
      };

      const fetchDictation = () => {
        let q = supabase.from('dictation_exercises').select('*')
          .eq('language', isSpanish ? 'es' : 'en')
          .ilike('audio_url', '%quick%');
        if (!isSpanish && levels && levels.length > 0) q = q.in('level', levels);
        return q;
      };

      const [gfRes, mcRes, sbRes, oooRes, ecRes, matchRes, dictRes] = await Promise.all([
        queryForType('gap_fill'),
        queryForType('multiple_choice'),
        queryForType('sentence_building'),
        queryForType('odd_one_out'),
        queryForType('error_correction'),
        (() => {
          let q = supabase.from('question_bank').select('*').eq('type', 'matching').in('language', langFilter).is('sequence_group', null);
          if (!isSpanish) q = q.neq('topic', 'spanish');
          if (!isSpanish && levels && levels.length > 0) q = q.in('level', levels);
          return q;
        })(),
        fetchDictation(),
      ]);

      if (gfRes.error || mcRes.error || sbRes.error || oooRes.error || ecRes.error || matchRes.error) {
        throw gfRes.error || mcRes.error || sbRes.error || oooRes.error || ecRes.error || matchRes.error;
      }

      const activeMix = buildWeakMix(weakTypes);
      const TARGET_TOTAL = Object.values(activeMix).reduce((a, b) => a + b, 0);

      const pick = (data, type) => shuffleArray((data || []).filter(q => isAllowedByTrack(q.topic))).slice(0, activeMix[type] || 0).map(q => {
        if ((type === 'multiple_choice' || type === 'odd_one_out') && Array.isArray(q.options)) {
          return { ...q, options: shuffleArray(q.options) };
        }
        return q;
      });

      // Pick dictation first — check mute, then pick pronunciation from remaining pool
      const shuffledDictPool = shuffleArray(dictRes.data || []);
      let pickedDictation = [];
      let dictationUsedIds = new Set();
      if (!isMuted(MUTE_AUDIO_KEY) && (activeMix.dictation || 0) > 0) {
        const dictSlice = shuffledDictPool.slice(0, activeMix.dictation);
        pickedDictation = dictSlice.map(ex => ({
          ...ex,
          type: 'dictation',
          question: ex.hint || '',
          correct_answer: ex.answer,
          question_number: null,
          _dictation_exercise_id: ex.id,
        }));
        dictationUsedIds = new Set(dictSlice.map(ex => ex.id));
      }

      let pickedPronunciation = [];
      if (!isMuted(MUTE_SPEAKING_KEY) && (activeMix.pronunciation || 0) > 0) {
        const remaining = shuffleArray(shuffledDictPool.filter(ex => !dictationUsedIds.has(ex.id)));
        pickedPronunciation = remaining.slice(0, activeMix.pronunciation).map(ex => ({
          ...ex,
          type: 'pronunciation',
          question: '',
          correct_answer: ex.answer,
          question_number: null,
          _dictation_exercise_id: ex.id,
        }));
      }

      const pickedMC = pick(mcRes.data, 'multiple_choice');
      let baseQuestions = [
        ...pick(gfRes.data, 'gap_fill'),
        ...pickedMC,
        ...pick(sbRes.data, 'sentence_building'),
        ...pick(oooRes.data, 'odd_one_out'),
        ...pick(ecRes.data, 'error_correction'),
        ...pick(matchRes.data, 'matching'),
        ...pickedDictation,
        ...pickedPronunciation,
      ];

      if (baseQuestions.length < TARGET_TOTAL) {
        const shortfall = TARGET_TOTAL - baseQuestions.length;
        const mcUsedIds = new Set(pickedMC.map(q => q.id));
        const extraMC = shuffleArray((mcRes.data || []).filter(q => !mcUsedIds.has(q.id))).slice(0, shortfall);
        baseQuestions = [...baseQuestions, ...extraMC];
      }

      const allQuestions = shuffleArray(baseQuestions);
      if (allQuestions.length === 0) {
        alert('No questions available yet. Check back soon!');
        setLoading(false);
        return;
      }

      // Pick 2 random positions for sentence challenge (avoid last question)
      const totalQs = allQuestions.length;
      const positions = new Set();
      const eligible = allQuestions
        .map((_, i) => i)
        .filter((_, i) => allQuestions[i]?.type !== 'matching' && allQuestions[i]?.type !== 'pronunciation');
      const shuffledEligible = shuffleArray(eligible);
      for (const idx of shuffledEligible) {
        if (positions.size >= 2) break;
        positions.add(idx);
      }
      challengePositionsRef.current = positions;
      setChallengePositions(positions);

      setQuestions(allQuestions);
      setStage('playing');
      setCurrentQuestionIndex(0);
      setScore(0);
      setFeedback(null);
      setSbFeedback(null);
      setUserAnswer('');
      setSelectedOption(null);
      setOooSelected(null);
      setEcSelectedWordIndex(null);
      setEcCorrection('');
      setMatchingDone(false);
      setShowHint(false);
      setIsChecking(false);
      setAudioPlayed(false);
      setIsRecording(false);
      setIsTranscribing(false);
      setIsMarking(false);
      setRecordingSeconds(0);
      setPronTranscript('');
      setShowChallenge(false);
      setChallengeWord('');
    } catch (error) {
      console.error('Error fetching questions:', error);
      alert('Failed to load questions. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const checkAnswer = async () => {
    const currentQuestion = questions[currentQuestionIndex];
    let isCorrect = false;
    let feedbackType = 'incorrect';
    let explanation = currentQuestion.explanation || '';

    if (currentQuestion.type === 'gap_fill') {
      const answer = userAnswer.toLowerCase().trim();
      const correctAnswer = currentQuestion.correct_answer?.toLowerCase().trim() || '';
      const correctAnswers = [correctAnswer];
      if (correctAnswer && answer === correctAnswer) { isCorrect = true; feedbackType = 'correct'; }
      if (!isCorrect && currentQuestion.informal_accepted && Array.isArray(currentQuestion.informal_accepted)) {
        const informalAnswers = currentQuestion.informal_accepted.map(a => a.toLowerCase().trim());
        if (informalAnswers.includes(answer)) {
          isCorrect = true; feedbackType = 'informal';
          if (currentQuestion.informal_feedback) explanation = `${currentQuestion.informal_feedback} ${explanation}`;
        }
      }
      if (!isCorrect && currentQuestion.acceptable_alternatives && Array.isArray(currentQuestion.acceptable_alternatives)) {
        const alternative = currentQuestion.acceptable_alternatives.find(alt => alt.answer && alt.answer.toLowerCase().trim() === answer);
        if (alternative) { isCorrect = true; feedbackType = 'alternative'; explanation = `${alternative.feedback} ${explanation}`; }
      }
      if (!isCorrect && isFuzzyMatch(answer, correctAnswers)) { isCorrect = true; feedbackType = 'fuzzy'; }
      if (!isCorrect) {
        setIsChecking(true);
        const lang = getQuestionLanguage(currentQuestion);
        const aiResult = await aiMarkGapFill(currentQuestion.question, correctAnswer, userAnswer.trim(), lang);
        setIsChecking(false);
        if (aiResult?.valid) { isCorrect = true; feedbackType = 'soft-pass'; if (aiResult.reason) explanation = `${aiResult.reason} ${explanation}`; }
      }
      setFeedback({ type: feedbackType, isCorrect, studentAnswer: userAnswer.trim(), correctAnswer: correctAnswer || 'N/A', explanation });
      saveAnswer(currentQuestion, userAnswer.trim(), isCorrect);
    } else if (currentQuestion.type === 'multiple_choice') {
      const mcCorrect = currentQuestion.correct_answer || '';
      if (selectedOption === mcCorrect) { isCorrect = true; feedbackType = 'correct'; }
      setFeedback({ type: feedbackType, isCorrect, studentAnswer: selectedOption || '', correctAnswer: mcCorrect, explanation });
      saveAnswer(currentQuestion, selectedOption || '', isCorrect);
    }

    if (isCorrect) setScore(s => s + 1);
  };

  const checkDictationAnswer = async () => {
    const cq = questions[currentQuestionIndex];
    if (!userAnswer.trim() || isChecking) return;
    const answer = userAnswer.trim();
    const correct = cq.correct_answer || '';
    let isCorrect = false;
    let isSoftPass = false;
    let feedbackType = 'incorrect';
    let feedbackMsg = '';

    if (answer.toLowerCase() === correct.toLowerCase()) {
      isCorrect = true; feedbackType = 'correct';
    }
    if (!isCorrect && normaliseDictation(answer) === normaliseDictation(correct)) {
      isCorrect = true; feedbackType = 'correct';
    }
    if (!isCorrect && isFuzzyMatch(normaliseDictation(answer), [normaliseDictation(correct)])) {
      isCorrect = true; feedbackType = 'fuzzy';
    }
    // Check acceptable_alternatives locally before hitting the API
    if (!isCorrect && Array.isArray(cq.acceptable_alternatives) && cq.acceptable_alternatives.length > 0) {
      const norm = s => s.toLowerCase().trim().replace(/[.,!?;:'"]/g, '');
      if (cq.acceptable_alternatives.map(norm).includes(norm(answer))) {
        isCorrect = true; feedbackType = 'soft-pass';
      }
    }
    if (!isCorrect) {
      setIsChecking(true);
      const aiResult = await aiMarkDictation(correct, answer, cq.excerpt_type || 'phrase', cq.acceptable_alternatives || []);
      setIsChecking(false);
      if (aiResult?.valid) {
        isCorrect = true; isSoftPass = true; feedbackType = 'soft-pass';
      }
    }

    if (feedbackType === 'correct') {
      feedbackMsg = `✅ Correct!`;
    } else if (feedbackType === 'fuzzy') {
      feedbackMsg = `✅ Correct — watch your spelling! The answer was: "${correct}"`;
    } else if (feedbackType === 'soft-pass') {
      feedbackMsg = `✅ Close enough! The model answer was: "${correct}"`;
    } else {
      feedbackMsg = `❌ The answer was: "${correct}"`;
    }

    setFeedback({ type: feedbackType, isCorrect, message: feedbackMsg, studentAnswer: answer, correctAnswer: correct });
    saveDictationAnswer(cq._dictation_exercise_id, answer, isCorrect, isSoftPass);
    if (isCorrect) setScore(s => s + 1);
  };

  const handleOOOSelect = (option) => {
    if (feedback) return;
    setOooSelected(option);
    const cq = questions[currentQuestionIndex];
    const oddOne = cq.correct_answer || '';
    const isCorrect = option.toLowerCase().trim() === oddOne.toLowerCase().trim();
    const feedbackMessage = isCorrect
      ? `✅ Correct! "${oddOne}" is the odd one out. ${cq.explanation || ''}`
      : `❌ Not quite. "${oddOne}" is the odd one out. ${cq.explanation || ''}`;
    setFeedback({ message: feedbackMessage, type: isCorrect ? 'correct' : 'incorrect', isCorrect, oddOne });
    if (isCorrect) setScore(s => s + 1);
    saveAnswer(cq, option, isCorrect);
  };

  const handleECWordTap = (index) => {
    if (feedback || isChecking) return;
    setEcSelectedWordIndex(index);
    setEcCorrection('');
  };

  const checkECAnswer = async () => {
    if (ecSelectedWordIndex === null || !ecCorrection.trim() || isChecking) return;
    const cq = questions[currentQuestionIndex];
    const words = cq.question.trim().split(/\s+/);
    const correctAnswer = cq.correct_answer || '';
    const correctedWords = [...words];
    const originalWord = words[ecSelectedWordIndex];
    const trailingPunct = originalWord.match(/[.,!?;:]+$/)?.[0] || '';
    const cleanCorrection = ecCorrection.trim().replace(/[.,!?;:]+$/, '');
    correctedWords[ecSelectedWordIndex] = cleanCorrection + trailingPunct;
    const correctedSentence = correctedWords.join(' ');
    const isExactMatch = normaliseEC(correctedSentence) === normaliseEC(correctAnswer);
    const errorInfo = findErrorIndex(words, correctAnswer);

    if (isExactMatch) {
      setFeedback({ type: 'correct', message: `✅ Correct! ${cq.explanation || ''}`, isCorrect: true, errorIndex: ecSelectedWordIndex, correctWord: cleanCorrection + trailingPunct });
      setScore(s => s + 1);
      saveAnswer(cq, `${words[ecSelectedWordIndex]} → ${ecCorrection.trim()}`, true);
      return;
    }

    setIsChecking(true);
    const lang = getQuestionLanguage(cq);
    const aiResult = await aiMarkCorrection(cq.question, words[ecSelectedWordIndex], ecCorrection.trim(), correctAnswer, lang, cq.level);
    setIsChecking(false);

    if (aiResult?.valid) {
      setFeedback({ type: 'soft-pass', message: `✅ Good — that works too! ${aiResult.reason || ''} The model answer was "${errorInfo.correctWord}". ${cq.explanation || ''}`, isCorrect: true, errorIndex: ecSelectedWordIndex, correctWord: cleanCorrection + trailingPunct });
      setScore(s => s + 1);
      saveAnswer(cq, `${words[ecSelectedWordIndex]} → ${ecCorrection.trim()}`, true);
      return;
    }

    const foundRightWord = ecSelectedWordIndex === errorInfo.index;
    const message = foundRightWord
      ? `❌ Good — you found the error in "${words[errorInfo.index]}", but "${ecCorrection.trim()}" doesn't quite work here. ${aiResult?.reason ? aiResult.reason + ' ' : ''}It should be "${errorInfo.correctWord}". ${cq.explanation || ''}`
      : `❌ The error is actually in "${words[errorInfo.index]}" — it should be "${errorInfo.correctWord}". ${cq.explanation || ''}`;
    setFeedback({ type: 'incorrect', message, isCorrect: false, errorIndex: errorInfo.index, correctWord: errorInfo.correctWord });
    saveAnswer(cq, `${words[ecSelectedWordIndex]} → ${ecCorrection.trim()}`, false);
  };

  // ── Remove the selected tile (deletion correction) ── deterministic, no AI ──
  const removeECWord = () => {
    if (ecSelectedWordIndex === null || feedback || isChecking) return;
    const cq = questions[currentQuestionIndex];
    const words = cq.question.trim().split(/\s+/);
    const correctAnswer = cq.correct_answer || '';
    const removedSentence = words.filter((_, i) => i !== ecSelectedWordIndex).join(' ');
    const errorInfo = findErrorIndex(words, correctAnswer);
    if (normaliseEC(removedSentence) === normaliseEC(correctAnswer)) {
      setFeedback({ type: 'correct', message: `✅ Correct! ${cq.explanation || ''}`, isCorrect: true, errorIndex: ecSelectedWordIndex, correctWord: '(removed)' });
      setScore(s => s + 1);
      saveAnswer(cq, `${words[ecSelectedWordIndex]} → (removed)`, true);
      return;
    }
    if (ecSelectedWordIndex !== errorInfo.index) {
      setFeedback({ type: 'incorrect', message: `❌ The error is actually in "${words[errorInfo.index]}" — it should be "${errorInfo.correctWord}". ${cq.explanation || ''}`, isCorrect: false, errorIndex: errorInfo.index, correctWord: errorInfo.correctWord });
      saveAnswer(cq, `${words[ecSelectedWordIndex]} → (removed)`, false);
      return;
    }
    setFeedback({ type: 'incorrect', message: `❌ Good — you found the error, but this word needs changing, not removing. It should be "${errorInfo.correctWord}". ${cq.explanation || ''}`, isCorrect: false, errorIndex: errorInfo.index, correctWord: errorInfo.correctWord });
    saveAnswer(cq, `${words[ecSelectedWordIndex]} → (removed)`, false);
  };

  const handleSentenceBuildingResult = (isCorrect, isSoft = false, userAnswer = '', aiReason = '') => {
    const cq = questions[currentQuestionIndex];
    if (isCorrect) {
      const msg = isSoft && aiReason
        ? `✅ Good — ${aiReason}`
        : `✅ Correct! ${cq.explanation || ''}`;
      const type = isSoft && aiReason ? 'soft-pass' : 'correct';
      setSbFeedback({ correct: true, message: msg });
      setFeedback({ message: msg, type, isCorrect: true });
      setScore(s => s + 1);
      saveAnswer(cq, userAnswer || '(correct)', true);
    } else {
      const displaySentence = (cq.correct_answer || '').replace(/ ([.,?!;:])/g, '$1').replace(/^(\w)/, m => m.toUpperCase());
      const msg = `❌ Not quite. The correct answer is: "${displaySentence}" — ${cq.explanation || ''}`;
      setSbFeedback({ correct: false, message: msg });
      setFeedback({ message: msg, type: 'incorrect', isCorrect: false });
      saveAnswer(cq, userAnswer || '(incorrect)', false);
    }
  };

  const handleMatchingResult = (isCorrect, wrongAttempts) => {
    const cq = questions[currentQuestionIndex];
    setMatchingDone(true);
    // Leniency: 0 wrong = perfect (star), 1–2 wrong = soft pass (no star), 3+ = fail
    const leniencyPass = !isCorrect && wrongAttempts <= 2;
    let msg, type;
    if (isCorrect) {
      msg = `✅ Perfect matching! ${cq.explanation || ''}`;
      type = 'correct';
    } else if (leniencyPass) {
      msg = `✅ All matched! Watch a couple of those — try to be more decisive next time. ${cq.explanation || ''}`;
      type = 'soft-pass';
    } else {
      msg = `❌ All matched — but ${wrongAttempts} wrong attempt${wrongAttempts !== 1 ? 's' : ''} along the way. Review those pairs! ${cq.explanation || ''}`;
      type = 'incorrect';
    }
    setFeedback({ message: msg, type, isCorrect: isCorrect || leniencyPass });
    if (isCorrect) setScore(s => s + 1); // No star for leniency pass
    saveAnswer(cq, isCorrect ? 'all_matched_clean' : `${wrongAttempts}_wrong`, isCorrect);
  };

  const getSbProps = (question) => {
    if (!question) return {};
    const options = Array.isArray(question.options) ? question.options : JSON.parse(question.options || '[]');
    const hasPrompt = question.question && question.question.trim() !== '';
    return {
      words: options,
      questionType: hasPrompt ? 'translation' : 'build',
      prompt: hasPrompt ? question.question : null,
      correctSentences: [question.correct_answer || ''],
      explanation: question.explanation || '',
      acceptable_alternatives: Array.isArray(question.acceptable_alternatives) ? question.acceptable_alternatives : [],
    };
  };

  // ── Advance to next question (called after challenge closes, or directly if no challenge) ──
  const advanceQuestion = (bonusScore = 0) => {
    stopPronunciationCleanup();
    if (bonusScore) {
      scoreRef.current = scoreRef.current + bonusScore;
      setScore(s => s + bonusScore);
    }
    if (currentQuestionIndex < questions.length - 1) {
      setCurrentQuestionIndex(currentQuestionIndex + 1);
      setUserAnswer('');
      setSelectedOption(null);
      setFeedback(null);
      setSbFeedback(null);
      setOooSelected(null);
      setEcSelectedWordIndex(null);
      setEcCorrection('');
      setMatchingDone(false);
      setShowHint(false);
      setIsChecking(false);
      setAudioPlayed(false);
      setIsRecording(false);
      setIsTranscribing(false);
      setIsMarking(false);
      setRecordingSeconds(0);
      setPronTranscript('');
    } else {
      finishExercise();
    }
  };

  const nextQuestion = () => {
    window.scrollTo({ top: 0, behavior: 'instant' });
    if (challengePositionsRef.current.has(currentQuestionIndex)) {
      const word = getChallengeWord(questions[currentQuestionIndex]);
      if (word) {
        setChallengeWord(word);
        setChallengeLevel(questions[currentQuestionIndex]?.level || null);
        setShowChallenge(true);
        return;
      }
    }
    advanceQuestion();
  };

  const handleChallengeClose = (earnedStar) => {
    setShowChallenge(false);
    window.scrollTo({ top: 0, behavior: 'instant' });
    advanceQuestion(); // Stars are tracked separately — no score bonus
  };

  // Harvest the SC sentence (text + AI verdict) for teacher review — see sc_sentences table.
  const onChallengeMarked = async ({ sentence, inputMethod, result }) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      await supabase.from('sc_sentences').insert({
        student_id:   user.id,
        source:       'rpe',
        target:       challengeWord,
        sentence:     sentence.trim(),
        is_correct:   result?.valid === true,
        ai_feedback:  result?.feedback || result?.reason || '',
        input_method: inputMethod || 'text',
        language:     isSpanish ? 'es' : 'en',
        level:        challengeLevel,
      });
    } catch (e) { console.warn('RPE: could not save sc sentence:', e); }
  };

  const retry = () => { startExercise(); };

  const currentQuestion = questions[currentQuestionIndex];
  const isFixupMode = fixups && fixups.length > 0;
  const fixupMeta = (isFixupMode && currentQuestion) ? fixups.find(f => Number(f.question_number) === Number(currentQuestion.question_number)) : null;
  const displayTitle = isFixupMode ? (levelTitle || 'Fix it!') : (levelTitle ? `${levelTitle} Practice` : 'Random Practice');
  const displayGradient = gradient || 'linear-gradient(135deg, #3498DB, #667eea)';
  const scorePercent = questions.length > 0 ? (score / questions.length) * 100 : 0;
  const matchingPairs = currentQuestion?.type === 'matching'
    ? (Array.isArray(currentQuestion.options) ? currentQuestion.options : JSON.parse(currentQuestion.options || '[]'))
    : null;

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
      if (index === errorIdx && isPass) return { ...base, backgroundColor: '#f0fff4', border: '2px solid #48bb78', color: '#276749', textDecoration: 'line-through', textDecorationColor: '#c53030' };
      if (index === errorIdx && !isPass) return { ...base, backgroundColor: '#fff5f5', border: '2px solid #f56565', color: '#c53030', textDecoration: 'line-through', textDecorationColor: '#c53030' };
      if (index === ecSelectedWordIndex && ecSelectedWordIndex !== errorIdx) return { ...base, backgroundColor: '#fff5f5', border: '2px solid #f56565', color: '#c53030', opacity: 0.6 };
      return { ...base, opacity: 0.6 };
    }
    if (index === ecSelectedWordIndex) return { ...base, backgroundColor: '#EDE9FE', border: '2px solid #667eea', color: '#553C9A' };
    return base;
  };

  const ecWords = currentQuestion && currentQuestion.type === 'error_correction'
    ? currentQuestion.question.trim().split(/\s+/)
    : [];

  const renderStructuredFeedback = () => {
    if (!feedback || !currentQuestion) return null;
    if (currentQuestion.type !== 'gap_fill' && currentQuestion.type !== 'multiple_choice') return null;
    const isFuzzy = feedback.type === 'fuzzy';
    const isSoftPass = feedback.type === 'soft-pass';
    const isCorrect = feedback.isCorrect;
    const borderColor = (isFuzzy || isSoftPass) ? '#f6ad55' : isCorrect ? '#48bb78' : '#f56565';
    const bgColor = (isFuzzy || isSoftPass) ? '#fffbeb' : isCorrect ? '#f0fff4' : '#fff5f5';
    const headerBg = (isFuzzy || isSoftPass) ? '#f6ad55' : isCorrect ? '#48bb78' : '#f56565';
    const headerText = isFuzzy ? '✅ Correct — but watch your spelling!' : isSoftPass ? '✅ Also correct!' : isCorrect ? '✅ Correct!' : '❌ Incorrect';
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
          {isFuzzy && (
            <div style={{ borderTop: `1px solid ${borderColor}`, paddingTop: '0.75rem', color: '#744210', lineHeight: '1.6' }}>
              ✏️ Almost perfect — watch your spelling next time!
            </div>
          )}
          {!isFuzzy && feedback.explanation && (
            <div style={{ borderTop: `1px solid ${borderColor}`, paddingTop: '0.75rem', color: '#4a5568', lineHeight: '1.6' }}>
              💡 {feedback.explanation}
            </div>
          )}
        </div>
      </div>
    );
  };

  const renderCheckingIndicator = () => {
    if (!isChecking || !currentQuestion) return null;
    if (!['gap_fill', 'error_correction', 'dictation'].includes(currentQuestion.type)) return null;
    return (
      <div style={{ marginTop: '1rem', textAlign: 'center', padding: '1rem', color: '#553C9A', fontSize: '0.95rem', border: '2px dashed #EDE9FE', borderRadius: '8px' }}>
        🤖 Checking your answer...
      </div>
    );
  };

  return (
    <>
    <div style={{ width: '100%', minHeight: '100vh', backgroundColor: '#f8f9fa', boxSizing: 'border-box' }}>
      <div style={{ padding: '1rem', width: '100%', boxSizing: 'border-box' }}>

        {/* ── START SCREEN ── */}
        {stage === 'start' && (
          <div style={{ textAlign: 'center', padding: '2rem 0', minHeight: '60vh', display: 'flex', flexDirection: 'column', justifyContent: 'center', width: '100%', boxSizing: 'border-box', maxWidth: '600px', margin: '0 auto' }}>
            {levelSubtitle && (
              <div style={{ display: 'inline-block', background: displayGradient, color: 'white', padding: '6px 20px', borderRadius: '20px', fontSize: 'clamp(0.9rem, 3vw, 1rem)', fontWeight: '600', marginBottom: '1rem', alignSelf: 'center' }}>{levelSubtitle}</div>
            )}
            <h1 style={{ fontSize: 'clamp(2rem, 8vw, 2.5rem)', color: '#2C3E50', marginBottom: '1.5rem', fontWeight: '700' }}>{displayTitle}</h1>
            <p style={{ fontSize: 'clamp(1.1rem, 4vw, 1.3rem)', color: '#2C3E50', marginBottom: '1rem', lineHeight: '1.5' }}>
              {isFixupMode
                ? (isSpanish
                    ? 'Preguntas que fallaste antes — ¡vamos a arreglarlas!'
                    : 'Questions you got wrong before — time to fix them!')
                : isSpanish
                  ? '20 preguntas variadas — ¡vamos!'
                  : 'Test your English with 20 random questions!'}
            </p>
            <p style={{ fontSize: 'clamp(0.95rem, 3vw, 1.05rem)', color: '#666', marginBottom: '2.5rem', lineHeight: '1.5' }}>
              {isFixupMode
                ? (isSpanish
                    ? `${fixups.length === 1 ? '1 pregunta' : `${fixups.length} preguntas`} de tus sesiones anteriores. Acierta cada una dos veces — en días distintos — y quedará arreglada para siempre.`
                    : `${fixups.length} ${fixups.length === 1 ? 'question' : 'questions'} from your past sessions. Get each one right twice — on different days — and it's fixed for good.`)
                : isSpanish
                  ? 'Una mezcla de tipos de ejercicios. Responde todas las preguntas y mira tu puntuación al final.'
                  : 'A mix of multiple choice, gap fill, sentence building, odd one out, error correction, matching, and dictation. Answer all questions and see your score at the end.'}
            </p>
            <button onClick={startExercise} disabled={loading} style={{ padding: '1.25rem', fontSize: 'clamp(1.1rem, 4vw, 1.3rem)', background: displayGradient, color: 'white', border: 'none', borderRadius: '12px', cursor: 'pointer', width: '100%', maxWidth: '350px', margin: '0 auto', fontWeight: '600', boxShadow: '0 4px 12px rgba(0,0,0,0.15)' }}>
              {loading ? 'Loading...' : isFixupMode ? (isSpanish ? '¡A arreglar!' : 'Start Fixing') : isSpanish ? 'Empezar' : 'Start Practice'}
            </button>
            {onBack && (
              <button onClick={onBack} style={{ marginTop: '1.5rem', padding: '0.75rem 1.5rem', fontSize: 'clamp(0.9rem, 3vw, 1rem)', backgroundColor: 'transparent', color: '#666', border: '1px solid #ddd', borderRadius: '8px', cursor: 'pointer', fontWeight: '500' }}>
                {isFixupMode ? (isSpanish ? '← Volver' : '← Back') : '← Choose Different Level'}
              </button>
            )}
          </div>
        )}

        {/* ── PLAYING SCREEN ── */}
        {stage === 'playing' && currentQuestion && (
          <div style={{ width: '100%', maxWidth: '700px', margin: '0 auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1rem', fontSize: 'clamp(0.9rem, 3vw, 1rem)', color: '#2C3E50', fontWeight: '500' }}>
              <div>Q {currentQuestionIndex + 1}/{questions.length}</div>
              <div>Score: {score}</div>
            </div>
            <div style={{ height: '6px', backgroundColor: '#e0e0e0', borderRadius: '3px', marginBottom: '1.5rem', overflow: 'hidden' }}>
              <div style={{ height: '100%', width: `${((currentQuestionIndex) / questions.length) * 100}%`, background: displayGradient, borderRadius: '3px', transition: 'width 0.3s ease' }} />
            </div>

            <div style={{ backgroundColor: 'white', padding: 'clamp(1.5rem, 5vw, 2.5rem)', borderRadius: '16px', boxShadow: '0 4px 16px rgba(0,0,0,0.08)', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>

              {/* ── Badges ── */}
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', alignItems: 'center' }}>
                <TypeBadge type={currentQuestion.type} />
                <LevelBadge level={currentQuestion.level} />
                {currentQuestion.type !== 'dictation' && <TopicBadge topic={currentQuestion.topic} />}
                {['error_correction', 'gap_fill', 'sentence_building', 'dictation', 'pronunciation'].includes(currentQuestion.type) && <AiMarkedBadge />}
              </div>

              {/* Fix it!: show the previous wrong answer BEFORE the student answers */}
              {fixupMeta && currentQuestion.type !== 'matching' && fixupMeta.last_wrong_answer && (
                <div style={{ background: '#fffaf0', border: '1px solid #fbd38d', borderRadius: '10px', padding: '0.6rem 1rem', fontSize: '0.9rem', color: '#744210', lineHeight: 1.5 }}>
                  🔧 {isSpanish ? 'La última vez escribiste: ' : 'Last time you wrote: '}
                  <span style={{ textDecoration: 'line-through' }}>{fixupMeta.last_wrong_answer}</span>
                </div>
              )}

              {/* Question Text */}
              {currentQuestion.type !== 'sentence_building' && currentQuestion.type !== 'error_correction' && currentQuestion.type !== 'matching' && currentQuestion.type !== 'dictation' && currentQuestion.question && (
                <div style={{ fontSize: 'clamp(1.15rem, 4vw, 1.4rem)', color: '#2C3E50', lineHeight: '1.6', fontWeight: '500', wordWrap: 'break-word', overflowWrap: 'break-word' }}>
                  {currentQuestion.question}
                </div>
              )}

              {showHint && currentQuestion.hint && currentQuestion.type !== 'dictation' && (
                <div style={{ backgroundColor: '#fff3cd', padding: '0.8rem 1rem', borderRadius: '8px', border: '1px solid #ffc107', fontSize: 'clamp(0.9rem, 3vw, 1rem)', color: '#856404' }}>
                  💡 <strong>Hint:</strong> {currentQuestion.hint}
                </div>
              )}

              <div style={{ flex: 1 }}>

                {/* GAP FILL */}
                {currentQuestion.type === 'gap_fill' && !feedback && (
                  <input type="text" value={userAnswer} onChange={(e) => setUserAnswer(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && !isChecking && checkAnswer()}
                    placeholder="Type your answer..." disabled={isChecking}
                    style={{ width: '100%', padding: '1.2rem', fontSize: 'clamp(1.1rem, 4vw, 1.3rem)', borderRadius: '10px', border: '2px solid #e0e0e0', boxSizing: 'border-box', color: '#2C3E50', opacity: isChecking ? 0.6 : 1 }}
                    autoFocus />
                )}

                {/* MULTIPLE CHOICE — before answer */}
                {currentQuestion.type === 'multiple_choice' && !feedback && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    {currentQuestion.options.map((option, index) => (
                      <button key={index} onClick={() => setSelectedOption(option)}
                        style={{ padding: '1.2rem', fontSize: 'clamp(1.05rem, 3.5vw, 1.2rem)', textAlign: 'left', backgroundColor: selectedOption === option ? '#3498DB' : 'white', color: selectedOption === option ? 'white' : '#2C3E50', border: `2px solid ${selectedOption === option ? '#3498DB' : '#e0e0e0'}`, borderRadius: '10px', cursor: 'pointer', transition: 'all 0.2s', wordWrap: 'break-word', width: '100%', boxSizing: 'border-box', fontWeight: '500' }}
                      >{option}</button>
                    ))}
                  </div>
                )}

                {/* MULTIPLE CHOICE — after answer */}
                {currentQuestion.type === 'multiple_choice' && feedback && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginBottom: '0.5rem' }}>
                    {currentQuestion.options.map((option, index) => {
                      const isCorrectOption = option === feedback.correctAnswer;
                      const wasSelected = option === feedback.studentAnswer;
                      let bg = '#f7fafc', border = '#e2e8f0', color = '#a0aec0';
                      if (isCorrectOption) { bg = '#f0fff4'; border = '#48bb78'; color = '#276749'; }
                      else if (wasSelected && !feedback.isCorrect) { bg = '#fff5f5'; border = '#f56565'; color = '#c53030'; }
                      return (
                        <div key={index} style={{ padding: '0.9rem 1.2rem', fontSize: 'clamp(1rem, 3.5vw, 1.1rem)', backgroundColor: bg, color, border: `2px solid ${border}`, borderRadius: '10px', fontWeight: isCorrectOption || wasSelected ? '600' : '400', wordWrap: 'break-word' }}>
                          {isCorrectOption ? '✓ ' : wasSelected && !feedback.isCorrect ? '✗ ' : ''}{option}
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* SENTENCE BUILDING */}
                {currentQuestion.type === 'sentence_building' && (
                  <SentenceBuildingInput key={currentQuestionIndex} {...getSbProps(currentQuestion)} disabled={!!feedback} onResult={handleSentenceBuildingResult} feedback={sbFeedback} showCheckButton={true} onAnswerReady={() => {}} />
                )}

                {/* ODD ONE OUT */}
                {currentQuestion.type === 'odd_one_out' && (
                  <div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '12px', marginBottom: '1rem' }}>
                      {(Array.isArray(currentQuestion.options) ? currentQuestion.options : JSON.parse(currentQuestion.options || '[]')).map((option, idx) => (
                        <div key={idx} className="rp-ooo-option" tabIndex={-1} onClick={() => handleOOOSelect(option)} style={getOOOStyle(option)}
                          onMouseEnter={e => { if (!feedback) { e.currentTarget.style.boxShadow = 'inset 0 0 0 2px #667eea'; e.currentTarget.style.transform = 'translateY(-1px)'; } }}
                          onMouseLeave={e => { if (!feedback && oooSelected !== option) { e.currentTarget.style.boxShadow = 'inset 0 0 0 2px #e2e8f0'; e.currentTarget.style.transform = 'none'; } }}
                        >{option}</div>
                      ))}
                    </div>
                  </div>
                )}

                {/* ERROR CORRECTION */}
                {currentQuestion.type === 'error_correction' && (
                  <div>
                    <div style={{ fontSize: '0.9rem', color: '#718096', marginBottom: '1rem', fontStyle: 'italic' }}>
                      {isChecking ? '🤖 Checking your answer...' : !feedback ? '👆 Tap the word that is wrong, then change it or remove it.' : feedback.isCorrect ? 'Well done!' : 'See the correction below.'}
                    </div>
                    <div style={{ backgroundColor: '#F8FBFF', padding: '1.25rem', borderRadius: '10px', border: '1px solid #AED6F1', lineHeight: '2.4', marginBottom: '1.25rem', display: 'flex', flexWrap: 'wrap', alignItems: 'center' }}>
                      {ecWords.map((word, index) => (
                        <span key={index} className="rp-ec-tile" tabIndex={-1} onClick={() => handleECWordTap(index)} style={getECTileStyle(index)}
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
                          <div style={{ fontSize: '0.75rem', color: '#718096', fontWeight: 600, marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                            Fix "{ecWords[ecSelectedWordIndex]}" — type the correction, or remove it:
                          </div>
                          <input type="text" value={ecCorrection} onChange={(e) => setEcCorrection(e.target.value)}
                            onKeyDown={(e) => { if (e.key === 'Enter') checkECAnswer(); else if (e.key === 'Backspace' && ecCorrection === '') { e.preventDefault(); removeECWord(); } }}
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
                      <div style={{ textAlign: 'center', padding: '1rem', color: '#A0AEC0', fontSize: '0.95rem', border: '2px dashed #E2E8F0', borderRadius: '8px' }}>
                        👆 Tap the word you think is wrong
                      </div>
                    )}
                  </div>
                )}

                {/* MATCHING */}
                {currentQuestion.type === 'matching' && matchingPairs && (
                  <div>
                    {currentQuestion.question && currentQuestion.question.trim() && (
                      <div style={{ fontSize: 'clamp(1.05rem, 3.5vw, 1.2rem)', color: '#2C3E50', lineHeight: '1.6', fontWeight: '500', marginBottom: '1rem', wordWrap: 'break-word' }}>
                        {currentQuestion.question}
                      </div>
                    )}
                    <MatchingPairs key={currentQuestionIndex} pairs={matchingPairs} disabled={!!feedback} onResult={handleMatchingResult} />
                  </div>
                )}

                {/* DICTATION */}
                {currentQuestion.type === 'dictation' && (
                  <div>
                    <audio ref={audioRef} src={currentQuestion.audio_url} style={{ display: 'none' }} />
                    <div style={{ textAlign: 'center', marginBottom: '1.25rem' }}>
                      <button
                        onClick={() => {
                          if (audioRef.current) {
                            audioRef.current.currentTime = 0;
                            audioRef.current.playbackRate = getAutoSpeed(currentQuestion.level);
                            audioRef.current.play();
                            setAudioPlayed(true);
                          }
                        }}
                        style={{ padding: '0.9rem 2rem', background: 'linear-gradient(135deg, #667eea, #764ba2)', color: 'white', border: 'none', borderRadius: '10px', cursor: 'pointer', fontSize: 'clamp(1rem, 3.5vw, 1.1rem)', fontWeight: '600', boxShadow: '0 2px 8px rgba(102,126,234,0.35)' }}
                      >
                        🔊 {audioPlayed ? 'Play Again' : 'Play Audio'}
                      </button>
                      {!audioPlayed && (
                        <div style={{ marginTop: '0.5rem', fontSize: '0.8rem', color: '#a0aec0' }}>👆 Tap to hear the audio</div>
                      )}
                    </div>

                    {currentQuestion.sentence_template && !feedback && (
                      <div style={{ backgroundColor: '#EBF8FF', border: '2px solid #90CDF4', borderRadius: '10px', padding: '1rem 1.25rem', marginBottom: '1rem', fontSize: 'clamp(1rem, 3.5vw, 1.15rem)', color: '#2C3E50', lineHeight: '1.6', fontWeight: '500' }}>
                        {currentQuestion.sentence_template}
                      </div>
                    )}

                    {!feedback && (
                      <>
                      <input type="text" value={userAnswer} onChange={(e) => setUserAnswer(e.target.value)}
                        onKeyPress={(e) => e.key === 'Enter' && !isChecking && userAnswer.trim() && checkDictationAnswer()}
                        placeholder={currentQuestion.excerpt_type === 'sentence' ? 'Type the full sentence you heard...' : 'Type the word or phrase you heard...'}
                        disabled={isChecking}
                        style={{ width: '100%', padding: '1.2rem', fontSize: 'clamp(1.1rem, 4vw, 1.3rem)', borderRadius: '10px', border: '2px solid #e0e0e0', boxSizing: 'border-box', color: '#2C3E50', opacity: isChecking ? 0.6 : 1 }}
                      />
                      <div style={{ textAlign: 'center', marginTop: '0.75rem' }}>
                        <button onClick={handleMuteAudio} style={{ fontSize: '0.78rem', color: '#a0aec0', background: 'none', border: '1px solid #e2e8f0', borderRadius: '6px', padding: '0.35rem 0.75rem', cursor: 'pointer' }}>
                          🔇 Mute audio for 15 mins
                        </button>
                      </div>
                      </>
                    )}

                    {feedback && (
                      <div style={{
                        backgroundColor: feedback.isCorrect ? (feedback.type === 'fuzzy' || feedback.type === 'soft-pass' ? '#fffbeb' : '#f0fff4') : '#fff5f5',
                        border: `2px solid ${feedback.isCorrect ? (feedback.type === 'fuzzy' || feedback.type === 'soft-pass' ? '#f6ad55' : '#48bb78') : '#f56565'}`,
                        borderRadius: '10px', padding: '1rem', marginTop: '0.5rem',
                        fontSize: 'clamp(1rem, 3vw, 1.1rem)', lineHeight: '1.6',
                        color: feedback.isCorrect ? (feedback.type === 'fuzzy' || feedback.type === 'soft-pass' ? '#744210' : '#276749') : '#c53030',
                        fontWeight: '500',
                      }}>
                        {feedback.message}
                      </div>
                    )}
                  </div>
                )}

                {/* PRONUNCIATION */}
                {currentQuestion.type === 'pronunciation' && (
                  <div>
                    <div style={{ backgroundColor: '#EBF8FF', border: '2px solid #90CDF4', borderRadius: '10px', padding: '1rem 1.25rem', marginBottom: '1.25rem', fontSize: 'clamp(1rem, 3.5vw, 1.15rem)', color: '#2C3E50', lineHeight: '1.7', fontWeight: '500' }}>
                      {currentQuestion.sentence_template
                        ? currentQuestion.sentence_template.replace(/_{3,}/g, currentQuestion.correct_answer || '')
                        : currentQuestion.correct_answer}
                    </div>
                    {!feedback && (
                      <div style={{ textAlign: 'center', marginBottom: '1rem', color: '#553C9A', fontWeight: '600', fontSize: 'clamp(0.95rem, 3vw, 1rem)' }}>
                        🎤 Read the sentence above out loud
                      </div>
                    )}
                    {!feedback && !isTranscribing && !isMarking && (
                      <div style={{ textAlign: 'center', marginBottom: '1rem' }}>
                        <button
                          onClick={isRecording ? stopPronunciationRecording : startPronunciationRecording}
                          style={{ padding: '0.9rem 2rem', background: isRecording ? 'linear-gradient(135deg, #e53e3e, #c53030)' : 'linear-gradient(135deg, #667eea, #764ba2)', color: 'white', border: 'none', borderRadius: '10px', cursor: 'pointer', fontSize: 'clamp(1rem, 3.5vw, 1.1rem)', fontWeight: '600', boxShadow: '0 2px 8px rgba(102,126,234,0.35)' }}>
                          {isRecording ? `⏹ Stop (${recordingSeconds}s)` : '🎤 Start Recording'}
                        </button>
                      </div>
                    )}
                    {(isTranscribing || isMarking) && (
                      <div style={{ textAlign: 'center', padding: '1rem', color: '#553C9A', fontSize: '0.95rem', border: '2px dashed #EDE9FE', borderRadius: '8px', marginBottom: '1rem' }}>
                        {isTranscribing ? '🏽 Listening to your recording...' : '🤖 Analysing your pronunciation...'}
                      </div>
                    )}
                    {pronTranscript && feedback?.pronFeedback && (
                      <div style={{ backgroundColor: '#f7fafc', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '0.75rem 1rem', marginBottom: '0.75rem', fontSize: '0.9rem', color: '#718096' }}>
                        🏽 We heard: <em>"{pronTranscript}"</em>
                      </div>
                    )}
                    {feedback?.pronFeedback && (
                      <div style={{ backgroundColor: feedback.isCorrect ? '#f0fff4' : feedback.type === 'soft-pass' ? '#fffbeb' : '#fff5f5', border: `2px solid ${feedback.isCorrect ? '#48bb78' : feedback.type === 'soft-pass' ? '#f6ad55' : '#f56565'}`, borderRadius: '10px', padding: '1rem', fontSize: 'clamp(1rem, 3vw, 1.1rem)', lineHeight: '1.6', color: feedback.isCorrect ? '#276749' : feedback.type === 'soft-pass' ? '#744210' : '#c53030', fontWeight: '500' }}>
                        {feedback.isCorrect ? '✅ ' : feedback.type === 'soft-pass' ? '⚠️ ' : '❌ '}{feedback.message}
                      </div>
                    )}
                    {!feedback && !isRecording && !isTranscribing && !isMarking && (
                      <div style={{ textAlign: 'center', marginTop: '1.5rem' }}>
                        <button onClick={handleMuteSpeaking} style={{ fontSize: '0.78rem', color: '#a0aec0', background: 'none', border: '1px solid #e2e8f0', borderRadius: '6px', padding: '0.35rem 0.75rem', cursor: 'pointer' }}>
                          🎤 Mute speaking for 15 mins
                        </button>
                      </div>
                    )}
                  </div>
                )}

                {renderCheckingIndicator()}
                {renderStructuredFeedback()}

                {/* EC feedback */}
                {feedback && currentQuestion.type === 'error_correction' && (
                  <div style={{ backgroundColor: feedback.type === 'soft-pass' ? '#fffbeb' : feedback.isCorrect ? '#d4edda' : '#f8d7da', color: feedback.type === 'soft-pass' ? '#744210' : feedback.isCorrect ? '#155724' : '#721c24', padding: '1.2rem', borderRadius: '10px', marginTop: '1rem', fontSize: 'clamp(1rem, 3vw, 1.1rem)', lineHeight: '1.6', wordWrap: 'break-word', overflowWrap: 'break-word', border: feedback.type === 'soft-pass' ? '1px solid #fbd38d' : 'none' }}>
                    {feedback.message}
                  </div>
                )}

                {/* Simple feedback (OOO, SB, matching) */}
                {feedback && !['error_correction', 'sentence_building', 'gap_fill', 'multiple_choice', 'dictation', 'pronunciation'].includes(currentQuestion.type) && (
                  <div style={{ backgroundColor: feedback.type === 'soft-pass' ? '#fffbeb' : feedback.isCorrect ? '#d4edda' : '#f8d7da', color: feedback.type === 'soft-pass' ? '#744210' : feedback.isCorrect ? '#155724' : '#721c24', border: feedback.type === 'soft-pass' ? '1px solid #fbd38d' : 'none', padding: '1.2rem', borderRadius: '10px', marginTop: '1rem', fontSize: 'clamp(1rem, 3vw, 1.1rem)', lineHeight: '1.6', wordWrap: 'break-word', overflowWrap: 'break-word' }}>
                    {feedback.message}
                  </div>
                )}
              </div>

              {/* Buttons */}
              <div style={{ marginTop: '1.5rem' }}>
                {!feedback && !['sentence_building', 'odd_one_out', 'error_correction', 'matching', 'pronunciation'].includes(currentQuestion.type) && (
                  <button
                    onClick={currentQuestion.type === 'dictation' ? checkDictationAnswer : checkAnswer}
                    disabled={isChecking || !userAnswer.trim() && currentQuestion.type !== 'multiple_choice' || currentQuestion.type === 'multiple_choice' && !selectedOption}
                    style={{ padding: '1.2rem', fontSize: 'clamp(1.1rem, 4vw, 1.25rem)', backgroundColor: '#2C3E50', color: 'white', border: 'none', borderRadius: '10px', cursor: 'pointer', width: '100%', fontWeight: '600', opacity: (isChecking || (!userAnswer.trim() && currentQuestion.type !== 'multiple_choice') || (currentQuestion.type === 'multiple_choice' && !selectedOption)) ? 0.5 : 1 }}
                  >{isChecking ? '🤖 Checking...' : 'Check Answer'}</button>
                )}
                {feedback && fixupMeta && (
                  <div style={{ background: '#f7fafc', border: '1px solid #e2e8f0', borderRadius: '10px', padding: '0.75rem 1rem', fontSize: '0.88rem', lineHeight: 1.5 }}>
                    <div style={{ fontWeight: 600, color: feedback.isCorrect ? '#276749' : '#c53030' }}>
                      {feedback.isCorrect
                        ? (fixupMeta.fixes_so_far >= 1
                            ? (isSpanish ? '🔧 ¡Arreglada! No volverás a verla.' : "🔧 Fixed! This one's out of your box for good.")
                            : (isSpanish ? 'Una vez bien — acierta otro día y quedará arreglada.' : 'Right once — get it right on another day and it\'s fixed.'))
                        : (isSpanish ? 'Vuelve a la caja — la verás otra vez.' : "Back in the box — you'll see this one again.")}
                    </div>
                  </div>
                )}
                {feedback && currentQuestion?.question_number && (
                  <FlagQuestion questionNumber={currentQuestion.question_number} language={isSpanish ? 'es' : 'en'} />
                )}
                {feedback && (
                  <button onClick={nextQuestion} style={{ padding: '1.2rem', fontSize: 'clamp(1.1rem, 4vw, 1.25rem)', backgroundColor: '#3498DB', color: 'white', border: 'none', borderRadius: '10px', cursor: 'pointer', width: '100%', fontWeight: '600' }}>
                    {currentQuestionIndex < questions.length - 1 ? 'Next Question →' : 'Finish'}
                  </button>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ── FINISHED SCREEN ── */}
        {stage === 'finished' && (
          <div style={{ width: '100%', maxWidth: '600px', margin: '2rem auto 0' }}>
            <div style={{ backgroundColor: 'white', padding: 'clamp(2rem, 6vw, 3rem)', borderRadius: '16px', boxShadow: '0 4px 16px rgba(0,0,0,0.08)', textAlign: 'center' }}>
              <h1 style={{ fontSize: 'clamp(1.8rem, 6vw, 2.2rem)', color: '#2C3E50', marginBottom: '0.5rem', fontWeight: '700' }}>
                {isSpanish ? '¡Práctica completada!' : 'Practice Complete!'}
              </h1>
              <div style={{ fontSize: 'clamp(1rem, 3.5vw, 1.15rem)', marginBottom: '1.5rem', color: '#666' }}>
                {scorePercent >= 90 ? '🌟 Outstanding work!' : scorePercent >= 75 ? '👍 Great job!' : scorePercent >= 50 ? '👌 Good effort!' : '💪 Keep practicing!'}
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: bestScore !== null ? 'repeat(3, minmax(0, 1fr))' : '1fr', gap: '0.5rem', marginBottom: '2rem' }}>
                <div style={{ background: displayGradient, borderRadius: '12px', padding: '1rem 0.4rem', color: 'white' }}>
                  <div style={{ fontSize: '0.8rem', fontWeight: '600', opacity: 0.9, textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '0.4rem' }}>This attempt</div>
                  <div style={{ fontSize: 'clamp(1.5rem, 6vw, 2.2rem)', fontWeight: '700', lineHeight: 1.1 }}>{score}/{questions.length}</div>
                  <div style={{ fontSize: '0.85rem', opacity: 0.85, marginTop: '0.25rem' }}>{Math.round(scorePercent)}%</div>
                </div>
                {bestScore !== null && (
                  <div style={{ background: score >= bestScore ? '#f0fff4' : '#f7fafc', border: score >= bestScore ? '2px solid #48bb78' : '2px solid #e2e8f0', borderRadius: '12px', padding: '1rem 0.4rem' }}>
                    <div style={{ fontSize: '0.8rem', fontWeight: '600', color: '#718096', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '0.4rem' }}>Best</div>
                    <div style={{ fontSize: 'clamp(1.5rem, 6vw, 2.2rem)', fontWeight: '700', color: '#2C3E50', lineHeight: 1.1 }}>{bestScore}/{questions.length}</div>
                    {score >= bestScore && score > 0 && (
                      <div style={{ fontSize: '0.85rem', color: '#48bb78', fontWeight: '600', marginTop: '0.25rem' }}>
                        {score > bestScore ? '🎉 New best!' : '🏆 Matched!'}
                      </div>
                    )}
                  </div>
                )}
                {averageScore !== null && (
                  <div style={{ background: '#f7fafc', border: '2px solid #e2e8f0', borderRadius: '12px', padding: '1rem 0.4rem' }}>
                    <div style={{ fontSize: '0.8rem', fontWeight: '600', color: '#718096', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '0.4rem' }}>Average</div>
                    <div style={{ fontSize: 'clamp(1.5rem, 6vw, 2.2rem)', fontWeight: '700', color: '#2C3E50', lineHeight: 1.1 }}>{averageScore}</div>
                    <div style={{ fontSize: '0.85rem', color: '#718096', marginTop: '0.25rem' }}>out of {questions.length}</div>
                  </div>
                )}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <button onClick={retry} style={{ padding: '1.2rem', fontSize: 'clamp(1.1rem, 4vw, 1.25rem)', background: displayGradient, color: 'white', border: 'none', borderRadius: '10px', cursor: 'pointer', fontWeight: '600' }}>
                  {isSpanish ? 'Otra vez' : 'Try Again'}
                </button>
                {onBack && (
                  <button onClick={onBack} style={{ padding: '1rem', fontSize: 'clamp(1rem, 3.5vw, 1.1rem)', backgroundColor: 'transparent', color: '#666', border: '1px solid #ddd', borderRadius: '10px', cursor: 'pointer', fontWeight: '500' }}>
                    ← Back to Levels
                  </button>
                )}
              </div>
            </div>
          </div>
        )}

      </div>
    </div>

    {showChallenge && challengeWord && (
      <SentenceChallenge
        word={challengeWord}
        language={isSpanish ? 'es' : 'en'}
        exercise="rpe"
        onMarkResult={onChallengeMarked}
        onClose={handleChallengeClose}
      />
    )}
    </>
  );
}
