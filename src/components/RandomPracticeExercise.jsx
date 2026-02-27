import { useState, useEffect, useRef } from 'react';
import { supabase } from '../supabaseClient';
import SentenceBuildingInput from './SentenceBuildingInput';
import MatchingPairs from './MatchingPairs';

// ── Question mix per round (easy to tweak!) ──
const QUESTION_MIX = {
  gap_fill: 3,
  multiple_choice: 6,
  sentence_building: 3,
  odd_one_out: 3,
  error_correction: 3,
  matching: 2,
  // Total: 20
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

function shuffleArray(arr) {
  const shuffled = [...arr];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

const normaliseEC = (s) => s.toLowerCase().trim().replace(/\s+/g, ' ');

const findErrorIndex = (questionWords, correctAnswer) => {
  const correctWords = correctAnswer.trim().split(/\s+/);
  for (let i = 0; i < Math.max(questionWords.length, correctWords.length); i++) {
    if (!questionWords[i] || !correctWords[i] || questionWords[i].toLowerCase() !== correctWords[i].toLowerCase()) {
      return { index: i, correctWord: correctWords[i] || '(missing)' };
    }
  }
  return { index: -1, correctWord: '' };
};

export default function RandomPracticeExercise({ levels, levelTitle, levelSubtitle, gradient, onBack }) {
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
  const [sbFeedback, setSbFeedback] = useState(null);
  const [bestScore, setBestScore] = useState(null);
  const [averageScore, setAverageScore] = useState(null);

  const allScoresRef = useRef([]);

  const [oooSelected, setOooSelected] = useState(null);

  const [ecSelectedWordIndex, setEcSelectedWordIndex] = useState(null);
  const [ecCorrection, setEcCorrection] = useState('');

  const [matchingDone, setMatchingDone] = useState(false);

  useEffect(() => { window.scrollTo(0, 0); }, [stage]);

  const getLevelKey = () => {
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
    } catch (error) {
      console.error('Error loading score history:', error);
    }
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
        student_id: user.id,
        exercise_id: null,
        score: currentScore,
        answers: {
          practice_type: 'random_practice',
          levels: getLevelKey(),
          total_questions: questions.length,
        },
      });
    } catch (error) {
      console.error('Error saving attempt:', error);
    }
  };

  const saveAnswer = async (question, studentAnswer, isCorrect) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const correctAnswers = Array.isArray(question.correct_answers)
        ? question.correct_answers
        : JSON.parse(question.correct_answers || '[]');
      const correctAnswer = question.type === 'multiple_choice'
        ? (question.correct_answer || correctAnswers[0] || '')
        : (correctAnswers[0] || '');
      await supabase.from('student_answers').insert({
        student_id: user.id,
        question_id: question.question_number,
        student_answer: studentAnswer,
        correct_answer: correctAnswer,
        is_correct: isCorrect,
      });
    } catch (error) {
      console.error('Error saving answer:', error);
    }
  };

  const startExercise = async () => {
    window.scrollTo({ top: 0, behavior: 'instant' });
    setLoading(true);
    try {
      const queryForType = (type) => {
        let q = supabase.from('question_bank').select('*').eq('type', type);
        if (levels && levels.length > 0) q = q.in('level', levels);
        return q;
      };

      const [gfRes, mcRes, sbRes, oooRes, ecRes, matchRes] = await Promise.all([
        queryForType('gap_fill'),
        queryForType('multiple_choice'),
        queryForType('sentence_building'),
        queryForType('odd_one_out'),
        queryForType('error_correction'),
        (() => {
          let q = supabase.from('question_bank').select('*').eq('type', 'matching').is('sequence_group', null);
          if (levels && levels.length > 0) q = q.in('level', levels);
          return q;
        })(),
      ]);

      if (gfRes.error || mcRes.error || sbRes.error || oooRes.error || ecRes.error || matchRes.error) {
        throw gfRes.error || mcRes.error || sbRes.error || oooRes.error || ecRes.error || matchRes.error;
      }

      const pick = (data, type) => shuffleArray(data || []).slice(0, QUESTION_MIX[type] || 0);

      const allQuestions = shuffleArray([
        ...pick(gfRes.data, 'gap_fill'),
        ...pick(mcRes.data, 'multiple_choice'),
        ...pick(sbRes.data, 'sentence_building'),
        ...pick(oooRes.data, 'odd_one_out'),
        ...pick(ecRes.data, 'error_correction'),
        ...pick(matchRes.data, 'matching'),
      ]);

      if (allQuestions.length === 0) {
        alert('No questions available for this level yet. Check back soon!');
        setLoading(false);
        return;
      }

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
    } catch (error) {
      console.error('Error fetching questions:', error);
      alert('Failed to load questions. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const checkAnswer = () => {
    const currentQuestion = questions[currentQuestionIndex];
    let isCorrect = false;
    let feedbackType = 'incorrect';
    let explanation = currentQuestion.explanation || '';

    if (currentQuestion.type === 'gap_fill') {
      const answer = userAnswer.toLowerCase().trim();
      const correctAnswers = Array.isArray(currentQuestion.correct_answers)
        ? currentQuestion.correct_answers.map(a => a.toLowerCase().trim())
        : [];

      if (correctAnswers.includes(answer)) {
        isCorrect = true;
        feedbackType = 'correct';
      } else if (currentQuestion.informal_accepted && Array.isArray(currentQuestion.informal_accepted)) {
        const informalAnswers = currentQuestion.informal_accepted.map(a => a.toLowerCase().trim());
        if (informalAnswers.includes(answer)) {
          isCorrect = true;
          feedbackType = 'informal';
          if (currentQuestion.informal_feedback) {
            explanation = `${currentQuestion.informal_feedback} ${explanation}`;
          }
        }
      }
      if (!isCorrect && currentQuestion.acceptable_alternatives && Array.isArray(currentQuestion.acceptable_alternatives)) {
        const alternative = currentQuestion.acceptable_alternatives.find(
          alt => alt.answer && alt.answer.toLowerCase().trim() === answer
        );
        if (alternative) {
          isCorrect = true;
          feedbackType = 'alternative';
          explanation = `${alternative.feedback} ${explanation}`;
        }
      }

      setFeedback({
        type: feedbackType,
        isCorrect,
        studentAnswer: userAnswer.trim(),
        correctAnswer: correctAnswers[0] || 'N/A',
        explanation,
      });
      saveAnswer(currentQuestion, userAnswer.trim(), isCorrect);

    } else if (currentQuestion.type === 'multiple_choice') {
      const correctAnswers = Array.isArray(currentQuestion.correct_answers)
        ? currentQuestion.correct_answers
        : JSON.parse(currentQuestion.correct_answers || '[]');
      const mcCorrect = currentQuestion.correct_answer || correctAnswers[0] || '';
      if (selectedOption === mcCorrect) {
        isCorrect = true;
        feedbackType = 'correct';
      }

      setFeedback({
        type: feedbackType,
        isCorrect,
        studentAnswer: selectedOption || '',
        correctAnswer: mcCorrect,
        explanation,
      });
      saveAnswer(currentQuestion, selectedOption || '', isCorrect);
    }

    if (isCorrect) setScore(score + 1);
  };

  const handleOOOSelect = (option) => {
    if (feedback) return;
    setOooSelected(option);
    const cq = questions[currentQuestionIndex];
    const correctAnswers = Array.isArray(cq.correct_answers)
      ? cq.correct_answers
      : JSON.parse(cq.correct_answers || '[]');
    const oddOne = correctAnswers[0] || '';
    const isCorrect = option.toLowerCase().trim() === oddOne.toLowerCase().trim();
    const feedbackMessage = isCorrect
      ? `✅ Correct! "${oddOne}" is the odd one out. ${cq.explanation || ''}`
      : `❌ Not quite. "${oddOne}" is the odd one out. ${cq.explanation || ''}`;
    setFeedback({ message: feedbackMessage, type: isCorrect ? 'correct' : 'incorrect', isCorrect, oddOne });
    if (isCorrect) setScore(s => s + 1);
    saveAnswer(cq, option, isCorrect);
  };

  const handleECWordTap = (index) => {
    if (feedback) return;
    setEcSelectedWordIndex(index);
    setEcCorrection('');
  };

  const checkECAnswer = () => {
    if (ecSelectedWordIndex === null || !ecCorrection.trim()) return;
    const cq = questions[currentQuestionIndex];
    const words = cq.question.trim().split(/\s+/);
    const correctAnswers = Array.isArray(cq.correct_answers)
      ? cq.correct_answers
      : JSON.parse(cq.correct_answers || '[]');
    const correctedWords = [...words];
    const originalWord = words[ecSelectedWordIndex];
    const trailingPunct = originalWord.match(/[.,!?;:]+$/)?.[0] || '';
    const cleanCorrection = ecCorrection.trim().replace(/[.,!?;:]+$/, '');
    correctedWords[ecSelectedWordIndex] = cleanCorrection + trailingPunct;
    const correctedSentence = correctedWords.join(' ');
    const isCorrect = correctAnswers.some(ca => normaliseEC(correctedSentence) === normaliseEC(ca));
    const errorInfo = findErrorIndex(words, correctAnswers[0]);
    let feedbackMessage;
    if (isCorrect) {
      feedbackMessage = `✅ Correct! ${cq.explanation || ''}`;
    } else {
      const foundRightWord = ecSelectedWordIndex === errorInfo.index;
      feedbackMessage = foundRightWord
        ? `❌ You found the error, but the correction should be "${errorInfo.correctWord}". ${cq.explanation || ''}`
        : `❌ The error is in "${words[errorInfo.index]}" — it should be "${errorInfo.correctWord}". ${cq.explanation || ''}`;
    }
    setFeedback({ message: feedbackMessage, type: isCorrect ? 'correct' : 'incorrect', isCorrect, errorIndex: errorInfo.index, correctWord: errorInfo.correctWord });
    if (isCorrect) setScore(s => s + 1);
    saveAnswer(cq, `${words[ecSelectedWordIndex]} → ${ecCorrection.trim()}`, isCorrect);
  };

  const handleSentenceBuildingResult = (isCorrect, isSoft = false, userAnswer = '') => {
    const cq = questions[currentQuestionIndex];
    if (isCorrect) {
      const msg = `✅ Correct! ${cq.explanation || ''}`;
      setSbFeedback({ correct: true, message: msg });
      setFeedback({ message: msg, type: 'correct', isCorrect: true });
      setScore(s => s + 1);
      saveAnswer(cq, userAnswer || '(correct)', true);
    } else {
      const correctSentences = Array.isArray(cq.correct_answers)
        ? cq.correct_answers
        : JSON.parse(cq.correct_answers || '[]');
      const displaySentence = (correctSentences[0] || '').replace(/ ([.,?!;:])/g, '$1').replace(/^(\w)/, m => m.toUpperCase());
      const msg = `❌ Not quite. The correct answer is: "${displaySentence}" — ${cq.explanation || ''}`;
      setSbFeedback({ correct: false, message: msg });
      setFeedback({ message: msg, type: 'incorrect', isCorrect: false });
      saveAnswer(cq, userAnswer || '(incorrect)', false);
    }
  };

  const handleMatchingResult = (isCorrect, wrongAttempts) => {
    const cq = questions[currentQuestionIndex];
    setMatchingDone(true);
    const msg = isCorrect
      ? `✅ Perfect matching! ${cq.explanation || ''}`
      : `👍 All matched! You had ${wrongAttempts} wrong attempt${wrongAttempts !== 1 ? 's' : ''}. ${cq.explanation || ''}`;
    setFeedback({ message: msg, type: isCorrect ? 'correct' : 'incorrect', isCorrect });
    if (isCorrect) setScore(s => s + 1);
    saveAnswer(cq, isCorrect ? 'all_matched_clean' : `${wrongAttempts}_wrong`, isCorrect);
  };

  const getSbProps = (question) => {
    if (!question) return {};
    const options = Array.isArray(question.options) ? question.options : JSON.parse(question.options || '[]');
    const correctSentences = Array.isArray(question.correct_answers)
      ? question.correct_answers
      : JSON.parse(question.correct_answers || '[]');
    const hasPrompt = question.question && question.question.trim() !== '';
    return {
      words: options,
      questionType: hasPrompt ? 'translation' : 'build',
      prompt: hasPrompt ? question.question : null,
      correctSentences,
      explanation: question.explanation || '',
    };
  };

  const nextQuestion = () => {
    window.scrollTo({ top: 0, behavior: 'instant' });
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
    } else {
      finishExercise();
    }
  };

  const retry = () => { startExercise(); };

  const currentQuestion = questions[currentQuestionIndex];
  const displayTitle = levelTitle ? `${levelTitle} Practice` : 'Random Practice';
  const displayGradient = gradient || 'linear-gradient(135deg, #3498DB, #667eea)';
  const scorePercent = questions.length > 0 ? (score / questions.length) * 100 : 0;

  const matchingPairs = currentQuestion?.type === 'matching'
    ? (Array.isArray(currentQuestion.options)
      ? currentQuestion.options
      : JSON.parse(currentQuestion.options || '[]'))
    : null;

  const getOOOStyle = (option) => {
    const base = {
      padding: 'clamp(8px, 2.5vw, 10px) clamp(12px, 3vw, 16px)',
      borderRadius: '8px', border: 'none',
      boxShadow: 'inset 0 0 0 2px #e2e8f0',
      cursor: feedback ? 'default' : 'pointer',
      fontSize: 'clamp(0.9rem, 3.2vw, 1.1rem)', fontWeight: '500',
      textAlign: 'center', transition: 'all 0.2s ease',
      backgroundColor: 'white', color: '#2d3748',
      minHeight: '55px', display: 'flex', alignItems: 'center', justifyContent: 'center',
      userSelect: 'none', outline: 'none',
    };
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
    const base = {
      display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
      padding: 'clamp(8px, 2.5vw, 10px) clamp(12px, 3vw, 16px)',
      margin: '4px 3px', borderRadius: '8px',
      fontSize: 'clamp(0.9rem, 3.2vw, 1.1rem)', fontWeight: '500',
      cursor: feedback ? 'default' : 'pointer',
      transition: 'all 0.15s ease', userSelect: 'none',
      backgroundColor: 'white', border: '2px solid #e2e8f0', color: '#2d3748', outline: 'none',
    };
    if (feedback) {
      const errorIdx = feedback.errorIndex;
      if (index === errorIdx && feedback.isCorrect) return { ...base, backgroundColor: '#f0fff4', border: '2px solid #48bb78', color: '#276749', textDecoration: 'line-through', textDecorationColor: '#c53030' };
      if (index === errorIdx && !feedback.isCorrect) return { ...base, backgroundColor: '#fff5f5', border: '2px solid #f56565', color: '#c53030', textDecoration: 'line-through', textDecorationColor: '#c53030' };
      if (index === ecSelectedWordIndex && ecSelectedWordIndex !== errorIdx) return { ...base, backgroundColor: '#fff5f5', border: '2px solid #f56565', color: '#c53030', opacity: 0.6 };
      return { ...base, opacity: 0.6 };
    }
    if (index === ecSelectedWordIndex) return { ...base, backgroundColor: '#EDE9FE', border: '2px solid #667eea', color: '#553C9A' };
    return base;
  };

  const ecWords = currentQuestion && currentQuestion.type === 'error_correction'
    ? currentQuestion.question.trim().split(/\s+/)
    : [];

  // ── Structured feedback panel for gap_fill and multiple_choice ──
  const renderStructuredFeedback = () => {
    if (!feedback || !currentQuestion) return null;
    if (currentQuestion.type !== 'gap_fill' && currentQuestion.type !== 'multiple_choice') return null;

    const isCorrect = feedback.isCorrect;
    const borderColor = isCorrect ? '#48bb78' : '#f56565';
    const bgColor = isCorrect ? '#f0fff4' : '#fff5f5';
    const headerBg = isCorrect ? '#48bb78' : '#f56565';

    return (
      <div style={{
        marginTop: '1rem',
        borderRadius: '12px',
        border: `2px solid ${borderColor}`,
        overflow: 'hidden',
        fontSize: 'clamp(0.95rem, 3vw, 1.05rem)',
      }}>
        {/* Header */}
        <div style={{
          backgroundColor: headerBg,
          color: 'white',
          padding: '0.6rem 1rem',
          fontWeight: '700',
          fontSize: 'clamp(0.95rem, 3vw, 1.05rem)',
        }}>
          {isCorrect ? '✅ Correct!' : '❌ Incorrect'}
        </div>

        {/* Body */}
        <div style={{ backgroundColor: bgColor, padding: '1rem' }}>

          {/* Your answer */}
          <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.6rem', alignItems: 'flex-start' }}>
            <span style={{ fontWeight: '600', color: '#4a5568', whiteSpace: 'nowrap', minWidth: '110px' }}>
              Your answer:
            </span>
            <span style={{
              fontWeight: '600',
              color: isCorrect ? '#276749' : '#c53030',
              wordBreak: 'break-word',
            }}>
              {feedback.studentAnswer || '(no answer)'}
            </span>
          </div>

          {/* Correct answer — always shown so students can confirm even when correct */}
          <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.75rem', alignItems: 'flex-start' }}>
            <span style={{ fontWeight: '600', color: '#4a5568', whiteSpace: 'nowrap', minWidth: '110px' }}>
              Correct answer:
            </span>
            <span style={{ fontWeight: '700', color: '#276749', wordBreak: 'break-word' }}>
              {feedback.correctAnswer}
            </span>
          </div>

          {/* Divider */}
          {feedback.explanation && (
            <div style={{ borderTop: `1px solid ${borderColor}`, paddingTop: '0.75rem', color: '#4a5568', lineHeight: '1.6' }}>
              💡 {feedback.explanation}
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <div style={{ width: '100%', minHeight: '100vh', backgroundColor: '#f8f9fa', boxSizing: 'border-box' }}>
      <div style={{ padding: '1rem', width: '100%', boxSizing: 'border-box' }}>

        {/* ── START SCREEN ── */}
        {stage === 'start' && (
          <div style={{
            textAlign: 'center', padding: '2rem 0', minHeight: '60vh',
            display: 'flex', flexDirection: 'column', justifyContent: 'center',
            width: '100%', boxSizing: 'border-box', maxWidth: '600px', margin: '0 auto',
          }}>
            {levelSubtitle && (
              <div style={{
                display: 'inline-block', background: displayGradient, color: 'white',
                padding: '6px 20px', borderRadius: '20px',
                fontSize: 'clamp(0.9rem, 3vw, 1rem)', fontWeight: '600',
                marginBottom: '1rem', alignSelf: 'center',
              }}>{levelSubtitle}</div>
            )}
            <h1 style={{ fontSize: 'clamp(2rem, 8vw, 2.5rem)', color: '#2C3E50', marginBottom: '1.5rem', fontWeight: '700' }}>
              {displayTitle}
            </h1>
            <p style={{ fontSize: 'clamp(1.1rem, 4vw, 1.3rem)', color: '#2C3E50', marginBottom: '1rem', lineHeight: '1.5' }}>
              Test your English with 20 random questions!
            </p>
            <p style={{ fontSize: 'clamp(0.95rem, 3vw, 1.05rem)', color: '#666', marginBottom: '2.5rem', lineHeight: '1.5' }}>
              A mix of multiple choice, gap fill, sentence building, odd one out, error correction, and matching. Answer all questions and see your score at the end.
            </p>
            <button
              onClick={startExercise}
              disabled={loading}
              style={{
                padding: '1.25rem', fontSize: 'clamp(1.1rem, 4vw, 1.3rem)',
                background: displayGradient, color: 'white', border: 'none',
                borderRadius: '12px', cursor: 'pointer',
                width: '100%', maxWidth: '350px', margin: '0 auto',
                fontWeight: '600', boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
              }}
            >{loading ? 'Loading...' : 'Start Practice'}</button>
            {onBack && (
              <button
                onClick={onBack}
                style={{
                  marginTop: '1.5rem', padding: '0.75rem 1.5rem',
                  fontSize: 'clamp(0.9rem, 3vw, 1rem)', backgroundColor: 'transparent',
                  color: '#666', border: '1px solid #ddd', borderRadius: '8px',
                  cursor: 'pointer', fontWeight: '500',
                }}>← Choose Different Level</button>
            )}
          </div>
        )}

        {/* ── PLAYING SCREEN ── */}
        {stage === 'playing' && currentQuestion && (
          <div style={{ width: '100%', maxWidth: '700px', margin: '0 auto' }}>
            <div style={{
              display: 'flex', justifyContent: 'space-between', marginBottom: '1rem',
              fontSize: 'clamp(0.9rem, 3vw, 1rem)', color: '#2C3E50', fontWeight: '500',
            }}>
              <div>Q {currentQuestionIndex + 1}/{questions.length}</div>
              <div>Score: {score}</div>
            </div>
            <div style={{ height: '6px', backgroundColor: '#e0e0e0', borderRadius: '3px', marginBottom: '1.5rem', overflow: 'hidden' }}>
              <div style={{
                height: '100%',
                width: `${((currentQuestionIndex) / questions.length) * 100}%`,
                background: displayGradient, borderRadius: '3px', transition: 'width 0.3s ease',
              }} />
            </div>

            <div style={{
              backgroundColor: 'white',
              padding: 'clamp(1.5rem, 5vw, 2.5rem)',
              borderRadius: '16px', boxShadow: '0 4px 16px rgba(0,0,0,0.08)',
              display: 'flex', flexDirection: 'column', gap: '1.5rem',
            }}>
              {/* Badges */}
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', alignItems: 'center' }}>
                {currentQuestion.type !== 'sentence_building' && (
                  <div style={{
                    padding: '4px 12px', borderRadius: '20px', fontSize: '0.8rem', fontWeight: '600',
                    backgroundColor:
                      currentQuestion.type === 'gap_fill' ? '#fff3cd' :
                      currentQuestion.type === 'odd_one_out' ? '#E0F2FE' :
                      currentQuestion.type === 'error_correction' ? '#FEE2E2' :
                      currentQuestion.type === 'matching' ? '#D1FAE5' :
                      '#d4edda',
                    color:
                      currentQuestion.type === 'gap_fill' ? '#856404' :
                      currentQuestion.type === 'odd_one_out' ? '#0369A1' :
                      currentQuestion.type === 'error_correction' ? '#DC2626' :
                      currentQuestion.type === 'matching' ? '#065F46' :
                      '#155724',
                  }}>
                    {currentQuestion.type === 'gap_fill' ? '✏️ Gap Fill' :
                     currentQuestion.type === 'odd_one_out' ? '🔍 Odd One Out' :
                     currentQuestion.type === 'error_correction' ? '🚨 Error Correction' :
                     currentQuestion.type === 'matching' ? '🔗 Matching' :
                     '📝 Multiple Choice'}
                  </div>
                )}
                {currentQuestion.level && (
                  <div style={{
                    padding: '4px 12px', borderRadius: '20px', fontSize: '0.8rem', fontWeight: '600',
                    backgroundColor: currentQuestion.level.startsWith('A') ? '#c6f6d5' : currentQuestion.level.startsWith('B') ? '#bee3f8' : '#feebc8',
                    color: currentQuestion.level.startsWith('A') ? '#48bb78' : currentQuestion.level.startsWith('B') ? '#4299e1' : '#ed8936',
                  }}>{currentQuestion.level}</div>
                )}
                {currentQuestion.topic && (
                  <div style={{
                    padding: '4px 12px', borderRadius: '20px', fontSize: '0.8rem', fontWeight: '600',
                    backgroundColor: currentQuestion.topic === 'question_forms' ? '#FEE2E2' : currentQuestion.topic === 'punctuation' ? '#FEE2E2' : '#f0f0f0',
                    color: currentQuestion.topic === 'question_forms' ? '#DC2626' : currentQuestion.topic === 'punctuation' ? '#DC2626' : '#555',
                  }}>
                    {currentQuestion.topic === 'question_forms' ? '❓ ' : ''}
                    {currentQuestion.topic.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}
                  </div>
                )}
              </div>

              {/* Question Text */}
              {currentQuestion.type !== 'sentence_building' &&
               currentQuestion.type !== 'error_correction' &&
               currentQuestion.type !== 'matching' &&
               currentQuestion.question && (
                <div style={{
                  fontSize: 'clamp(1.15rem, 4vw, 1.4rem)', color: '#2C3E50',
                  lineHeight: '1.6', fontWeight: '500', wordWrap: 'break-word', overflowWrap: 'break-word',
                }}>{currentQuestion.question}</div>
              )}

              {/* Hint */}
              {showHint && currentQuestion.hint && (
                <div style={{
                  backgroundColor: '#fff3cd', padding: '0.8rem 1rem',
                  borderRadius: '8px', border: '1px solid #ffc107',
                  fontSize: 'clamp(0.9rem, 3vw, 1rem)', color: '#856404',
                }}>💡 <strong>Hint:</strong> {currentQuestion.hint}</div>
              )}

              <div style={{ flex: 1 }}>
                {/* ── GAP FILL ── */}
                {currentQuestion.type === 'gap_fill' && !feedback && (
                  <input
                    type="text" value={userAnswer}
                    onChange={(e) => setUserAnswer(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && checkAnswer()}
                    placeholder="Type your answer..."
                    style={{
                      width: '100%', padding: '1.2rem',
                      fontSize: 'clamp(1.1rem, 4vw, 1.3rem)',
                      borderRadius: '10px', border: '2px solid #e0e0e0',
                      boxSizing: 'border-box', color: '#2C3E50',
                    }}
                    autoFocus
                  />
                )}

                {/* ── MULTIPLE CHOICE ── */}
                {currentQuestion.type === 'multiple_choice' && !feedback && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    {currentQuestion.options.map((option, index) => (
                      <button
                        key={index}
                        onClick={() => setSelectedOption(option)}
                        style={{
                          padding: '1.2rem',
                          fontSize: 'clamp(1.05rem, 3.5vw, 1.2rem)',
                          textAlign: 'left',
                          backgroundColor: selectedOption === option ? '#3498DB' : 'white',
                          color: selectedOption === option ? 'white' : '#2C3E50',
                          border: `2px solid ${selectedOption === option ? '#3498DB' : '#e0e0e0'}`,
                          borderRadius: '10px', cursor: 'pointer', transition: 'all 0.2s',
                          wordWrap: 'break-word', width: '100%', boxSizing: 'border-box', fontWeight: '500',
                        }}
                      >{option}</button>
                    ))}
                  </div>
                )}

                {/* ── MULTIPLE CHOICE: show options greyed out after answer ── */}
                {currentQuestion.type === 'multiple_choice' && feedback && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginBottom: '0.5rem' }}>
                    {currentQuestion.options.map((option, index) => {
                      const isCorrectOption = option === feedback.correctAnswer;
                      const wasSelected = option === feedback.studentAnswer;
                      let bg = '#f7fafc';
                      let border = '#e2e8f0';
                      let color = '#a0aec0';
                      if (isCorrectOption) { bg = '#f0fff4'; border = '#48bb78'; color = '#276749'; }
                      else if (wasSelected && !feedback.isCorrect) { bg = '#fff5f5'; border = '#f56565'; color = '#c53030'; }
                      return (
                        <div key={index} style={{
                          padding: '0.9rem 1.2rem',
                          fontSize: 'clamp(1rem, 3.5vw, 1.1rem)',
                          backgroundColor: bg,
                          color,
                          border: `2px solid ${border}`,
                          borderRadius: '10px',
                          fontWeight: isCorrectOption || wasSelected ? '600' : '400',
                          wordWrap: 'break-word',
                        }}>
                          {isCorrectOption ? '✓ ' : wasSelected && !feedback.isCorrect ? '✗ ' : ''}{option}
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* ── SENTENCE BUILDING ── */}
                {currentQuestion.type === 'sentence_building' && (
                  <SentenceBuildingInput
                    key={currentQuestionIndex}
                    {...getSbProps(currentQuestion)}
                    disabled={!!feedback}
                    onResult={handleSentenceBuildingResult}
                    feedback={sbFeedback}
                    showCheckButton={true}
                    onAnswerReady={() => {}}
                  />
                )}

                {/* ── ODD ONE OUT ── */}
                {currentQuestion.type === 'odd_one_out' && (
                  <div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '12px', marginBottom: '1rem' }}>
                      {(Array.isArray(currentQuestion.options)
                        ? currentQuestion.options
                        : JSON.parse(currentQuestion.options || '[]')
                      ).map((option, idx) => (
                        <div
                          key={idx} className="rp-ooo-option" tabIndex={-1}
                          onClick={() => handleOOOSelect(option)}
                          style={getOOOStyle(option)}
                          onMouseEnter={e => {
                            if (!feedback) {
                              e.currentTarget.style.boxShadow = 'inset 0 0 0 2px #667eea';
                              e.currentTarget.style.transform = 'translateY(-1px)';
                            }
                          }}
                          onMouseLeave={e => {
                            if (!feedback && oooSelected !== option) {
                              e.currentTarget.style.boxShadow = 'inset 0 0 0 2px #e2e8f0';
                              e.currentTarget.style.transform = 'none';
                            }
                          }}
                        >{option}</div>
                      ))}
                    </div>
                  </div>
                )}

                {/* ── ERROR CORRECTION ── */}
                {currentQuestion.type === 'error_correction' && (
                  <div>
                    <div style={{ fontSize: '0.9rem', color: '#718096', marginBottom: '1rem', fontStyle: 'italic' }}>
                      {!feedback
                        ? 'Tap the word that is wrong, then type the correction below.'
                        : feedback.isCorrect ? 'Well done!' : 'See the correction below.'}
                    </div>
                    <div style={{
                      backgroundColor: '#F8FBFF', padding: '1.25rem',
                      borderRadius: '10px', border: '1px solid #AED6F1',
                      lineHeight: '2.4', marginBottom: '1.25rem',
                      display: 'flex', flexWrap: 'wrap', alignItems: 'center',
                    }}>
                      {ecWords.map((word, index) => (
                        <span
                          key={index} className="rp-ec-tile" tabIndex={-1}
                          onClick={() => handleECWordTap(index)}
                          style={getECTileStyle(index)}
                          onMouseEnter={e => {
                            if (!feedback && ecSelectedWordIndex !== index) {
                              e.currentTarget.style.borderColor = '#667eea';
                              e.currentTarget.style.backgroundColor = '#f7f7ff';
                            }
                          }}
                          onMouseLeave={e => {
                            if (!feedback && ecSelectedWordIndex !== index) {
                              e.currentTarget.style.borderColor = '#e2e8f0';
                              e.currentTarget.style.backgroundColor = 'white';
                            }
                          }}
                        >{word}</span>
                      ))}
                      {feedback && feedback.errorIndex >= 0 && (
                        <div style={{ width: '100%', marginTop: '0.75rem', fontSize: '1rem', paddingLeft: '4px' }}>
                          <span style={{ color: '#c53030', textDecoration: 'line-through', fontWeight: 500 }}>
                            {ecWords[feedback.errorIndex]}
                          </span>
                          <span style={{ margin: '0 8px', color: '#718096' }}>→</span>
                          <span style={{ color: '#276749', fontWeight: 600 }}>{feedback.correctWord}</span>
                        </div>
                      )}
                    </div>
                    {ecSelectedWordIndex !== null && !feedback && (
                      <div style={{ display: 'flex', gap: '10px', marginBottom: '1rem', alignItems: 'stretch' }}>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontSize: '0.75rem', color: '#718096', fontWeight: 600, marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                            Your correction for "{ecWords[ecSelectedWordIndex]}":
                          </div>
                          <input
                            type="text" value={ecCorrection}
                            onChange={(e) => setEcCorrection(e.target.value)}
                            onKeyPress={(e) => e.key === 'Enter' && checkECAnswer()}
                            placeholder="Type the correct word..."
                            autoFocus
                            style={{
                              width: '100%', padding: '0.9rem 1rem',
                              fontSize: 'clamp(1rem, 3.5vw, 1.15rem)',
                              borderRadius: '8px', border: '2px solid #667eea',
                              boxSizing: 'border-box', color: '#2d3748',
                              fontWeight: 500, backgroundColor: '#EDE9FE',
                            }}
                          />
                        </div>
                        <button
                          onClick={checkECAnswer}
                          disabled={!ecCorrection.trim()}
                          style={{
                            padding: '0 1.5rem',
                            background: ecCorrection.trim() ? 'linear-gradient(135deg, #667eea, #764ba2)' : '#cbd5e0',
                            color: 'white', border: 'none', borderRadius: '8px',
                            cursor: ecCorrection.trim() ? 'pointer' : 'not-allowed',
                            fontWeight: 600, fontSize: '1rem',
                            alignSelf: 'flex-end', minHeight: '48px',
                          }}
                        >Check</button>
                      </div>
                    )}
                    {ecSelectedWordIndex === null && !feedback && (
                      <div style={{
                        textAlign: 'center', padding: '1rem', color: '#A0AEC0',
                        fontSize: '0.95rem', border: '2px dashed #E2E8F0', borderRadius: '8px',
                      }}>👆 Tap the word you think is wrong</div>
                    )}
                  </div>
                )}

                {/* ── MATCHING ── */}
                {currentQuestion.type === 'matching' && matchingPairs && (
                  <div>
                    {currentQuestion.question && currentQuestion.question.trim() && (
                      <div style={{
                        fontSize: 'clamp(1.05rem, 3.5vw, 1.2rem)', color: '#2C3E50',
                        lineHeight: '1.6', fontWeight: '500', marginBottom: '1rem',
                        wordWrap: 'break-word',
                      }}>{currentQuestion.question}</div>
                    )}
                    <MatchingPairs
                      key={currentQuestionIndex}
                      pairs={matchingPairs}
                      disabled={!!feedback}
                      onResult={handleMatchingResult}
                    />
                  </div>
                )}

                {/* ── STRUCTURED FEEDBACK (gap_fill + multiple_choice) ── */}
                {renderStructuredFeedback()}

                {/* ── SIMPLE FEEDBACK (all other types) ── */}
                {feedback && currentQuestion.type !== 'sentence_building' &&
                 currentQuestion.type !== 'gap_fill' &&
                 currentQuestion.type !== 'multiple_choice' && (
                  <div style={{
                    backgroundColor: feedback.isCorrect ? '#d4edda' : '#f8d7da',
                    color: feedback.isCorrect ? '#155724' : '#721c24',
                    padding: '1.2rem', borderRadius: '10px', marginTop: '1rem',
                    fontSize: 'clamp(1rem, 3vw, 1.1rem)', lineHeight: '1.6',
                    wordWrap: 'break-word', overflowWrap: 'break-word',
                  }}>{feedback.message}</div>
                )}
              </div>

              {/* ── Buttons ── */}
              <div style={{ marginTop: '1.5rem' }}>
                {!feedback &&
                 currentQuestion.type !== 'sentence_building' &&
                 currentQuestion.type !== 'odd_one_out' &&
                 currentQuestion.type !== 'error_correction' &&
                 currentQuestion.type !== 'matching' && (
                  <button
                    onClick={checkAnswer}
                    disabled={
                      (currentQuestion.type === 'gap_fill' && !userAnswer.trim()) ||
                      (currentQuestion.type === 'multiple_choice' && !selectedOption)
                    }
                    style={{
                      padding: '1.2rem', fontSize: 'clamp(1.1rem, 4vw, 1.25rem)',
                      backgroundColor: '#2C3E50', color: 'white', border: 'none',
                      borderRadius: '10px', cursor: 'pointer', width: '100%', fontWeight: '600',
                      opacity: (
                        (currentQuestion.type === 'gap_fill' && !userAnswer.trim()) ||
                        (currentQuestion.type === 'multiple_choice' && !selectedOption)
                      ) ? 0.5 : 1,
                    }}
                  >Check Answer</button>
                )}

                {feedback && (
                  <button
                    onClick={nextQuestion}
                    style={{
                      padding: '1.2rem', fontSize: 'clamp(1.1rem, 4vw, 1.25rem)',
                      backgroundColor: '#3498DB', color: 'white', border: 'none',
                      borderRadius: '10px', cursor: 'pointer', width: '100%', fontWeight: '600',
                    }}
                  >
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
            <div style={{
              backgroundColor: 'white', padding: 'clamp(2rem, 6vw, 3rem)',
              borderRadius: '16px', boxShadow: '0 4px 16px rgba(0,0,0,0.08)', textAlign: 'center',
            }}>
              <h1 style={{ fontSize: 'clamp(1.8rem, 6vw, 2.2rem)', color: '#2C3E50', marginBottom: '0.5rem', fontWeight: '700' }}>
                Practice Complete!
              </h1>
              <div style={{ fontSize: 'clamp(1rem, 3.5vw, 1.15rem)', marginBottom: '1.5rem', color: '#666' }}>
                {scorePercent >= 90 ? '🌟 Outstanding work!' :
                 scorePercent >= 75 ? '👍 Great job!' :
                 scorePercent >= 50 ? '👌 Good effort!' : '💪 Keep practicing!'}
              </div>
              <div style={{
                display: 'grid',
                gridTemplateColumns: bestScore !== null ? '1fr 1fr 1fr' : '1fr',
                gap: '1rem', marginBottom: '2rem',
              }}>
                <div style={{ background: displayGradient, borderRadius: '12px', padding: '1.25rem 1rem', color: 'white' }}>
                  <div style={{ fontSize: '0.8rem', fontWeight: '600', opacity: 0.9, textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '0.4rem' }}>This attempt</div>
                  <div style={{ fontSize: 'clamp(2rem, 8vw, 2.5rem)', fontWeight: '700', lineHeight: 1.1 }}>{score}/{questions.length}</div>
                  <div style={{ fontSize: '0.85rem', opacity: 0.85, marginTop: '0.25rem' }}>{Math.round(scorePercent)}%</div>
                </div>
                {bestScore !== null && (
                  <div style={{
                    background: score >= bestScore ? '#f0fff4' : '#f7fafc',
                    border: score >= bestScore ? '2px solid #48bb78' : '2px solid #e2e8f0',
                    borderRadius: '12px', padding: '1.25rem 1rem',
                  }}>
                    <div style={{ fontSize: '0.8rem', fontWeight: '600', color: '#718096', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '0.4rem' }}>Best</div>
                    <div style={{ fontSize: 'clamp(2rem, 8vw, 2.5rem)', fontWeight: '700', color: '#2C3E50', lineHeight: 1.1 }}>{bestScore}/{questions.length}</div>
                    {score >= bestScore && score > 0 && (
                      <div style={{ fontSize: '0.85rem', color: '#48bb78', fontWeight: '600', marginTop: '0.25rem' }}>
                        {score > bestScore ? '🎉 New best!' : '🏆 Matched!'}
                      </div>
                    )}
                  </div>
                )}
                {averageScore !== null && (
                  <div style={{ background: '#f7fafc', border: '2px solid #e2e8f0', borderRadius: '12px', padding: '1.25rem 1rem' }}>
                    <div style={{ fontSize: '0.8rem', fontWeight: '600', color: '#718096', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '0.4rem' }}>Average</div>
                    <div style={{ fontSize: 'clamp(2rem, 8vw, 2.5rem)', fontWeight: '700', color: '#2C3E50', lineHeight: 1.1 }}>{averageScore}</div>
                    <div style={{ fontSize: '0.85rem', color: '#718096', marginTop: '0.25rem' }}>out of {questions.length}</div>
                  </div>
                )}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <button
                  onClick={retry}
                  style={{
                    padding: '1.2rem', fontSize: 'clamp(1.1rem, 4vw, 1.25rem)',
                    background: displayGradient, color: 'white', border: 'none',
                    borderRadius: '10px', cursor: 'pointer', fontWeight: '600',
                  }}
                >Try Again</button>
                {onBack && (
                  <button
                    onClick={onBack}
                    style={{
                      padding: '1rem', fontSize: 'clamp(1rem, 3.5vw, 1.1rem)',
                      backgroundColor: 'transparent', color: '#666',
                      border: '1px solid #ddd', borderRadius: '10px',
                      cursor: 'pointer', fontWeight: '500',
                    }}
                  >← Back to Levels</button>
                )}
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
