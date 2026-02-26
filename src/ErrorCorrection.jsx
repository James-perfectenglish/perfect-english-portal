import { useState, useEffect } from 'react';
import { supabase } from './supabaseClient';

function shuffleArray(arr) {
  const shuffled = [...arr];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

const LEVELS = [
  {
    key: 'beginner',
    label: 'Beginner',
    sublabel: 'A1 – A2',
    badgeLabel: 'Level: A1-A2',
    description: 'Simple verb errors, word order, and basic grammar mistakes.',
    colour: '#48bb78',
    colourLight: '#f0fff4',
    dbLevels: ['A1', 'A2'],
    icon: '🌱'
  },
  {
    key: 'intermediate',
    label: 'Intermediate',
    sublabel: 'B1 – B2',
    badgeLabel: 'Level: B1-B2',
    description: 'Tense errors, prepositions, conditionals, and tricky collocations.',
    colour: '#4299e1',
    colourLight: '#ebf8ff',
    dbLevels: ['B1', 'B2'],
    icon: '📘'
  },
  {
    key: 'advanced',
    label: 'Advanced',
    sublabel: 'C1 – C2',
    badgeLabel: 'Level: C1-C2',
    description: 'Subtle grammar errors, register mistakes, and advanced structures.',
    colour: '#ed8936',
    colourLight: '#fffaf0',
    dbLevels: ['C1', 'C2'],
    icon: '🎓'
  }
];

const GRADIENT = 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)';
const QUESTIONS_PER_ROUND = 10;

// Levels where the AI soft-marker is used
const AI_MARKED_LEVELS = ['B2', 'C1', 'C2'];

const normalise = (s) => s.toLowerCase().trim().replace(/\s+/g, ' ');

const findErrorIndex = (questionWords, correctAnswer) => {
  const correctWords = correctAnswer.trim().split(/\s+/);
  for (let i = 0; i < Math.max(questionWords.length, correctWords.length); i++) {
    if (!questionWords[i] || !correctWords[i] || questionWords[i].toLowerCase() !== correctWords[i].toLowerCase()) {
      return { index: i, correctWord: correctWords[i] || '(missing)' };
    }
  }
  return { index: -1, correctWord: '' };
};

// Call our serverless function to soft-mark a correction at B2/C1/C2
const aiMarkCorrection = async (originalSentence, errorWord, studentReplacement, correctAnswerSentence) => {
  try {
    const response = await fetch('/api/mark-correction', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ originalSentence, errorWord, studentReplacement, correctAnswerSentence })
    });
    if (!response.ok) return null;
    const result = await response.json();
    // valid: null means the API itself errored — fall through to normal fail
    if (result.valid === null) return null;
    return result;
  } catch (e) {
    console.error('AI marking error:', e);
    return null; // fall through to normal fail if request errors
  }
};

export default function ErrorCorrection({ onBack, onComplete, topicFilter }) {
  const [stage, setStage] = useState('level-select');
  const [selectedLevel, setSelectedLevel] = useState(null);
  const [questionCounts, setQuestionCounts] = useState({});
  const [questions, setQuestions] = useState([]);
  const [currentQ, setCurrentQ] = useState(0);
  const [score, setScore] = useState(0);
  const [selectedWordIndex, setSelectedWordIndex] = useState(null);
  const [correction, setCorrection] = useState('');
  const [feedback, setFeedback] = useState(null);
  const [isChecking, setIsChecking] = useState(false);

  useEffect(() => { fetchCounts(); }, []);

  const fetchCounts = async () => {
    let query = supabase.from('question_bank').select('level').eq('type', 'error_correction');
    if (topicFilter) query = query.eq('topic', topicFilter);
    const { data } = await query;
    if (data) {
      const counts = {};
      LEVELS.forEach(lv => { counts[lv.key] = data.filter(q => lv.dbLevels.includes(q.level)).length; });
      setQuestionCounts(counts);
    }
  };

  const selectLevel = (level) => {
    if ((questionCounts[level.key] || 0) === 0) return;
    setSelectedLevel(level);
    setStage('loading');
    fetchQuestions(level.dbLevels);
  };

  const fetchQuestions = async (dbLevels) => {
    let query = supabase.from('question_bank').select('*').eq('type', 'error_correction').in('level', dbLevels);
    if (topicFilter) query = query.eq('topic', topicFilter);
    const { data, error } = await query;
    if (error) { console.error('Error:', error); setStage('playing'); return; }
    if (data && data.length > 0) setQuestions(shuffleArray(data).slice(0, QUESTIONS_PER_ROUND));
    setStage('playing');
  };

  const saveAnswer = async (question, studentAnswer, isCorrect, isSoftPass = false) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const correctAnswers = Array.isArray(question.correct_answers) ? question.correct_answers : JSON.parse(question.correct_answers || '[]');
      await supabase.from('student_answers').insert({
        student_id: user.id,
        question_id: question.question_number,
        student_answer: studentAnswer,
        correct_answer: correctAnswers[0] || '',
        is_correct: isCorrect,
        is_soft_pass: isSoftPass
      });
    } catch (error) { console.error('Error saving answer:', error); }
  };

  const handleWordTap = (index) => {
    if (feedback || isChecking) return;
    setSelectedWordIndex(index);
    setCorrection('');
  };

  const checkAnswer = async () => {
    if (selectedWordIndex === null || !correction.trim() || isChecking) return;

    const q = questions[currentQ];
    const words = q.question.trim().split(/\s+/);
    const correctAnswers = Array.isArray(q.correct_answers) ? q.correct_answers : JSON.parse(q.correct_answers || '[]');

    const correctedWords = [...words];
    correctedWords[selectedWordIndex] = correction.trim();
    const correctedSentence = correctedWords.join(' ');

    const isExactMatch = correctAnswers.some(ca => normalise(correctedSentence) === normalise(ca));
    const errorInfo = findErrorIndex(words, correctAnswers[0]);

    // ✅ FULL PASS — exact match
    if (isExactMatch) {
      setScore(s => s + 1);
      setFeedback({
        type: 'pass',
        message: `✅ Correct! ${q.explanation || ''}`,
        errorIndex: selectedWordIndex,
        correctWord: correction.trim()
      });
      saveAnswer(q, `${words[selectedWordIndex]} → ${correction.trim()}`, true, false);
      return;
    }

    // For B2/C1/C2 — ask the AI before calling it wrong
    const useAI = AI_MARKED_LEVELS.includes(q.level);

    if (useAI) {
      setIsChecking(true);
      const aiResult = await aiMarkCorrection(
        q.question,
        words[selectedWordIndex],
        correction.trim(),
        correctAnswers[0]
      );
      setIsChecking(false);

      if (aiResult?.valid) {
        // ✅ SOFT PASS — valid alternative answer
        setScore(s => s + 1);
        setFeedback({
          type: 'soft-pass',
          message: `✅ Good — that works too! ${aiResult.reason} The model answer was "${errorInfo.correctWord}". ${q.explanation || ''}`,
          errorIndex: selectedWordIndex,
          correctWord: correction.trim()
        });
        saveAnswer(q, `${words[selectedWordIndex]} → ${correction.trim()}`, true, true);
        return;
      }

      // AI said no — but give useful feedback on whether they at least found the right word
      const foundRightWord = selectedWordIndex === errorInfo.index;
      let message;
      if (foundRightWord) {
        message = `❌ Good — you found the error in "${words[errorInfo.index]}", but "${correction.trim()}" doesn't quite work here. ${aiResult?.reason ? aiResult.reason + ' ' : ''}It should be "${errorInfo.correctWord}". ${q.explanation || ''}`;
      } else {
        message = `❌ The error is actually in "${words[errorInfo.index]}" — it should be "${errorInfo.correctWord}". ${q.explanation || ''}`;
      }
      setFeedback({ type: 'fail', message, errorIndex: errorInfo.index, correctWord: errorInfo.correctWord });
      saveAnswer(q, `${words[selectedWordIndex]} → ${correction.trim()}`, false, false);

    } else {
      // A1/A2/B1 — simple comparison, no API
      const foundRightWord = selectedWordIndex === errorInfo.index;
      let message;
      if (foundRightWord) {
        message = `❌ You found the error, but the correction should be "${errorInfo.correctWord}". ${q.explanation || ''}`;
      } else {
        message = `❌ The error is in "${words[errorInfo.index]}" — it should be "${errorInfo.correctWord}". ${q.explanation || ''}`;
      }
      setFeedback({ type: 'fail', message, errorIndex: errorInfo.index, correctWord: errorInfo.correctWord });
      saveAnswer(q, `${words[selectedWordIndex]} → ${correction.trim()}`, false, false);
    }
  };

  const nextQuestion = () => {
    window.scrollTo({ top: 0, behavior: 'instant' });
    if (currentQ + 1 >= questions.length) { setStage('finished'); }
    else { setCurrentQ(c => c + 1); setSelectedWordIndex(null); setCorrection(''); setFeedback(null); }
  };

  const backToLevelSelect = () => {
    window.scrollTo({ top: 0, behavior: 'instant' });
    setSelectedLevel(null); setQuestions([]); setCurrentQ(0); setScore(0);
    setSelectedWordIndex(null); setCorrection(''); setFeedback(null);
    setStage('level-select'); fetchCounts();
  };

  const restartExercise = () => {
    window.scrollTo({ top: 0, behavior: 'instant' });
    setCurrentQ(0); setScore(0); setSelectedWordIndex(null); setCorrection(''); setFeedback(null);
    setStage('loading'); fetchQuestions(selectedLevel.dbLevels);
  };

  const q = questions[currentQ];
  const questionWords = q ? q.question.trim().split(/\s+/) : [];

  const getWordTileStyle = (index) => {
    const base = {
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: 'clamp(8px, 2.5vw, 10px) clamp(12px, 3vw, 16px)',
      margin: '4px 3px',
      borderRadius: '8px',
      fontSize: 'clamp(0.9rem, 3.2vw, 1.1rem)',
      fontWeight: '500',
      cursor: (feedback || isChecking) ? 'default' : 'pointer',
      transition: 'all 0.15s ease',
      userSelect: 'none',
      backgroundColor: 'white',
      border: '2px solid #e2e8f0',
      color: '#2d3748'
    };

    if (feedback) {
      const isPass = feedback.type === 'pass' || feedback.type === 'soft-pass';
      if (index === feedback.errorIndex && isPass) {
        return { ...base, backgroundColor: '#f0fff4', border: '2px solid #48bb78', color: '#276749', textDecoration: 'line-through', textDecorationColor: '#c53030' };
      }
      if (index === feedback.errorIndex && !isPass) {
        return { ...base, backgroundColor: '#fff5f5', border: '2px solid #f56565', color: '#c53030', textDecoration: 'line-through', textDecorationColor: '#c53030' };
      }
      if (index === selectedWordIndex && selectedWordIndex !== feedback.errorIndex) {
        return { ...base, backgroundColor: '#fff5f5', border: '2px solid #f56565', color: '#c53030', opacity: 0.6 };
      }
      return { ...base, opacity: 0.6 };
    }

    if (index === selectedWordIndex) {
      return { ...base, backgroundColor: '#EDE9FE', border: '2px solid #667eea', color: '#553C9A' };
    }

    return base;
  };

  // Feedback colours — three states: pass (green), soft-pass (amber), fail (red)
  const feedbackStyle = feedback ? {
    pass:      { bg: '#f0fff4', border: '#c6f6d5', color: '#276749' },
    'soft-pass': { bg: '#fffbeb', border: '#fbd38d', color: '#744210' },
    fail:      { bg: '#fff5f5', border: '#fed7d7', color: '#9b2c2c' },
  }[feedback.type] : null;

  // LEVEL SELECT
  if (stage === 'level-select') {
    return (
      <div style={{ maxWidth: '800px', margin: '0 auto' }}>
        <div style={{ background: GRADIENT, borderRadius: '12px 12px 0 0', padding: '2.5rem 2rem 2rem', textAlign: 'center', color: 'white' }}>
          <h1 style={{ margin: 0, fontSize: '1.8rem' }}>✏️ Error Correction</h1>
          <p style={{ margin: '8px 0 0', opacity: 0.9 }}>Find and fix the mistake in each sentence</p>
        </div>
        <div style={{ background: 'white', padding: '2rem', borderRadius: '0 0 12px 12px', boxShadow: '0 10px 40px rgba(0,0,0,0.15)' }}>
          <h2 style={{ color: '#2d3748', fontSize: '1.15rem', fontWeight: 600, margin: '0 0 6px', textAlign: 'center' }}>Choose your level</h2>
          <p style={{ color: '#718096', fontSize: '0.9rem', margin: '0 0 24px', textAlign: 'center' }}>Select a difficulty to start practising</p>
          <div style={{ display: 'grid', gap: '16px' }}>
            {LEVELS.map(level => {
              const count = questionCounts[level.key] || 0;
              const available = count > 0;
              return (
                <div key={level.key} onClick={() => available && selectLevel(level)} style={{
                  border: `2px solid ${available ? level.colour : '#e2e8f0'}`, borderRadius: '12px', padding: '1.25rem 1.5rem',
                  cursor: available ? 'pointer' : 'default', background: available ? level.colourLight : '#f9fafb',
                  opacity: available ? 1 : 0.55, transition: 'transform 0.15s ease, box-shadow 0.15s ease',
                  display: 'flex', alignItems: 'center', gap: '1rem'
                }}
                  onMouseEnter={e => { if (available) { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = `0 4px 16px ${level.colour}30`; } }}
                  onMouseLeave={e => { e.currentTarget.style.transform = 'none'; e.currentTarget.style.boxShadow = 'none'; }}
                >
                  <div style={{ fontSize: '2rem', flexShrink: 0 }}>{level.icon}</div>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                      <span style={{ fontSize: '1.1rem', fontWeight: 700, color: '#2d3748' }}>{level.label}</span>
                      <span style={{ background: available ? level.colour : '#a0aec0', color: 'white', padding: '2px 10px', borderRadius: '20px', fontSize: '0.8rem', fontWeight: 600 }}>{level.sublabel}</span>
                    </div>
                    <p style={{ margin: '4px 0 0', fontSize: '0.88rem', color: '#4a5568', lineHeight: 1.4 }}>{level.description}</p>
                    <span style={{ display: 'inline-block', marginTop: '6px', fontSize: '0.8rem', color: available ? '#4a5568' : '#a0aec0', fontWeight: 500 }}>
                      {available ? `${count} question${count !== 1 ? 's' : ''} available` : 'Coming soon'}
                    </span>
                  </div>
                  {available && <div style={{ fontSize: '1.3rem', color: level.colour, flexShrink: 0 }}>→</div>}
                </div>
              );
            })}
          </div>
          {onBack && (
            <div style={{ textAlign: 'center', marginTop: '24px' }}>
              <button onClick={onBack} style={{ padding: '10px 24px', background: 'transparent', color: '#718096', border: '1px solid #e2e8f0', borderRadius: '6px', fontWeight: 500, cursor: 'pointer', fontSize: '0.95rem' }}>← Back to Exercises</button>
            </div>
          )}
        </div>
      </div>
    );
  }

  // EXERCISE
  return (
    <div style={{ maxWidth: '800px', margin: '0 auto' }}>
      <div style={{ background: GRADIENT, borderRadius: '12px 12px 0 0', padding: '2.5rem 2rem 2rem', textAlign: 'center', color: 'white' }}>
        <h1 style={{ margin: 0, fontSize: '1.8rem' }}>✏️ Error Correction</h1>
        <p style={{ margin: '8px 0 0', opacity: 0.9 }}>Tap the wrong word, then type the correction</p>
        {selectedLevel && <span style={{ display: 'inline-block', background: selectedLevel.colour, padding: '4px 12px', borderRadius: '20px', fontSize: '0.85rem', fontWeight: 600, marginTop: '8px' }}>{selectedLevel.badgeLabel}</span>}
      </div>
      <div style={{ background: 'white', padding: '2rem', borderRadius: '0 0 12px 12px', boxShadow: '0 10px 40px rgba(0,0,0,0.15)' }}>
        {stage === 'loading' && <div style={{ textAlign: 'center', padding: '3rem 1rem', color: '#666' }}>Loading questions...</div>}

        {stage === 'playing' && questions.length === 0 && (
          <div style={{ textAlign: 'center', padding: '2rem' }}>
            <div style={{ fontSize: '2.5rem', marginBottom: '0.75rem' }}>✏️</div>
            <h2 style={{ color: '#2C3E50', marginBottom: '0.5rem' }}>Coming Soon!</h2>
            <p style={{ color: '#666' }}>Questions for this level are being added. Check back soon!</p>
            <button onClick={backToLevelSelect} style={{ marginTop: '1rem', padding: '0.75rem 1.5rem', background: GRADIENT, color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: '600' }}>← Choose Another Level</button>
          </div>
        )}

        {stage === 'playing' && q && (
          <>
            <div style={{ display: 'flex', justifyContent: 'space-between', background: '#f7fafc', padding: '12px 16px', borderRadius: '8px', marginBottom: '24px', fontSize: '0.9rem', color: '#4a5568', fontWeight: 500 }}>
              <span>Progress: {currentQ + 1}/{questions.length}</span>
              <span>Score: {score}/{questions.length}</span>
            </div>

            <div style={{ border: '2px solid #e2e8f0', borderRadius: '8px', padding: '1.5rem', marginBottom: '1.5rem' }}>
              {/* Topic & Level pills */}
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', alignItems: 'center', marginBottom: '1rem' }}>
                {q.level && <div style={{ padding: '4px 12px', borderRadius: '20px', fontSize: '0.8rem', fontWeight: '600', backgroundColor: q.level.startsWith('A') ? '#c6f6d5' : q.level.startsWith('B') ? '#bee3f8' : '#feebc8', color: q.level.startsWith('A') ? '#276749' : q.level.startsWith('B') ? '#2b6cb0' : '#c05621' }}>{q.level}</div>}
                {q.topic && <div style={{ padding: '4px 12px', borderRadius: '20px', fontSize: '0.8rem', fontWeight: '600', backgroundColor: q.topic === 'punctuation' ? '#FEE2E2' : '#e8daef', color: q.topic === 'punctuation' ? '#DC2626' : '#6c3483' }}>{q.topic.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}</div>}
                {AI_MARKED_LEVELS.includes(q.level) && (
                  <div style={{ padding: '4px 12px', borderRadius: '20px', fontSize: '0.75rem', fontWeight: '600', backgroundColor: '#EDE9FE', color: '#553C9A' }}>🤖 AI marked</div>
                )}
              </div>

              {/* Instruction */}
              <div style={{ fontSize: '0.9rem', color: '#718096', marginBottom: '1rem', fontStyle: 'italic' }}>
                {isChecking
                  ? '🤖 Checking your answer...'
                  : !feedback
                    ? 'Tap the word that is wrong, then type the correction below.'
                    : feedback.type === 'pass'
                      ? 'Well done!'
                      : feedback.type === 'soft-pass'
                        ? 'Valid alternative — well spotted!'
                        : 'See the correction below.'}
              </div>

              {/* Sentence with tappable word tiles */}
              <div style={{
                backgroundColor: '#F8FBFF',
                padding: '1.25rem',
                borderRadius: '10px',
                border: '1px solid #AED6F1',
                lineHeight: '2.4',
                marginBottom: '1.25rem',
                display: 'flex',
                flexWrap: 'wrap',
                alignItems: 'center'
              }}>
                {questionWords.map((word, index) => (
                  <span
                    key={index}
                    onClick={() => handleWordTap(index)}
                    style={getWordTileStyle(index)}
                    onMouseEnter={e => {
                      if (!feedback && !isChecking && selectedWordIndex !== index) {
                        e.currentTarget.style.borderColor = '#667eea';
                        e.currentTarget.style.backgroundColor = '#f7f7ff';
                      }
                    }}
                    onMouseLeave={e => {
                      if (!feedback && !isChecking && selectedWordIndex !== index) {
                        e.currentTarget.style.borderColor = '#e2e8f0';
                        e.currentTarget.style.backgroundColor = 'white';
                      }
                    }}
                  >
                    {word}
                  </span>
                ))}

                {/* Correction indicator after feedback */}
                {feedback && feedback.errorIndex >= 0 && (
                  <div style={{ width: '100%', marginTop: '0.75rem', fontSize: '1rem', paddingLeft: '4px' }}>
                    <span style={{ color: '#c53030', textDecoration: 'line-through', fontWeight: 500 }}>
                      {questionWords[feedback.errorIndex]}
                    </span>
                    <span style={{ margin: '0 8px', color: '#718096' }}>→</span>
                    <span style={{ color: '#276749', fontWeight: 600 }}>
                      {feedback.correctWord}
                    </span>
                  </div>
                )}
              </div>

              {/* Checking spinner */}
              {isChecking && (
                <div style={{ textAlign: 'center', padding: '1rem', color: '#553C9A', fontSize: '0.95rem', border: '2px dashed #EDE9FE', borderRadius: '8px', marginBottom: '1rem' }}>
                  🤖 Asking the AI marker...
                </div>
              )}

              {/* Correction input */}
              {selectedWordIndex !== null && !feedback && !isChecking && (
                <div style={{ display: 'flex', gap: '10px', marginBottom: '1rem', alignItems: 'stretch' }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: '0.75rem', color: '#718096', fontWeight: 600, marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                      Your correction for "{questionWords[selectedWordIndex]}":
                    </div>
                    <input
                      type="text"
                      value={correction}
                      onChange={(e) => setCorrection(e.target.value)}
                      onKeyPress={(e) => e.key === 'Enter' && checkAnswer()}
                      placeholder="Type the correct word..."
                      autoFocus
                      style={{
                        width: '100%',
                        padding: '0.9rem 1rem',
                        fontSize: 'clamp(1rem, 3.5vw, 1.15rem)',
                        borderRadius: '8px',
                        border: '2px solid #667eea',
                        boxSizing: 'border-box',
                        color: '#2d3748',
                        fontWeight: 500,
                        backgroundColor: '#EDE9FE'
                      }}
                    />
                  </div>
                  <button
                    onClick={checkAnswer}
                    disabled={!correction.trim()}
                    style={{
                      padding: '0 1.5rem',
                      background: correction.trim() ? GRADIENT : '#cbd5e0',
                      color: 'white', border: 'none', borderRadius: '8px',
                      cursor: correction.trim() ? 'pointer' : 'not-allowed',
                      fontWeight: 600, fontSize: '1rem', alignSelf: 'flex-end', minHeight: '48px'
                    }}
                  >Check</button>
                </div>
              )}

              {/* No word selected prompt */}
              {selectedWordIndex === null && !feedback && !isChecking && (
                <div style={{ textAlign: 'center', padding: '1rem', color: '#A0AEC0', fontSize: '0.95rem', border: '2px dashed #E2E8F0', borderRadius: '8px' }}>
                  👆 Tap the word you think is wrong
                </div>
              )}

              {/* Feedback — three colours */}
              {feedback && feedbackStyle && (
                <div style={{
                  backgroundColor: feedbackStyle.bg,
                  border: `1px solid ${feedbackStyle.border}`,
                  color: feedbackStyle.color,
                  padding: '1rem 1.25rem', borderRadius: '10px',
                  fontSize: 'clamp(0.95rem, 3vw, 1.05rem)', lineHeight: '1.6', marginBottom: '0.75rem'
                }}>{feedback.message}</div>
              )}

              {feedback && (
                <button onClick={nextQuestion} style={{
                  width: '100%', padding: '1rem', marginTop: '0.5rem', fontSize: '1rem',
                  background: GRADIENT, color: 'white', border: 'none',
                  borderRadius: '10px', cursor: 'pointer', fontWeight: '600'
                }}>{currentQ + 1 >= questions.length ? 'See Results' : 'Next Question →'}</button>
              )}
            </div>
          </>
        )}

        {stage === 'finished' && (
          <div style={{ background: '#f7fafc', border: '2px solid #e2e8f0', borderRadius: '8px', padding: '2rem', textAlign: 'center', marginTop: '1rem' }}>
            <div style={{ fontSize: '3rem', marginBottom: '0.5rem' }}>{score >= 9 ? '🏆' : score >= 7 ? '⭐' : score >= 5 ? '👍' : '💪'}</div>
            <h2 style={{ color: '#2d3748', margin: '0 0 12px' }}>Exercise Complete!</h2>
            <div style={{ fontSize: '3rem', fontWeight: 700, margin: '12px 0', color: score >= 7 ? '#48bb78' : score >= 5 ? '#ed8936' : '#f56565' }}>{score}/{questions.length}</div>
            <p style={{ color: '#4a5568' }}>
              {score >= 9 ? 'Outstanding! Sharp eye for errors.' : score >= 7 ? 'Great work! You spotted most mistakes.' : score >= 5 ? 'Good effort. Keep training your error detection.' : 'Keep going — the more you practise, the easier it gets!'}
            </p>
            <div style={{ marginTop: '20px', display: 'flex', gap: '12px', justifyContent: 'center', flexWrap: 'wrap' }}>
              <button onClick={restartExercise} style={{ padding: '10px 24px', background: '#667eea', color: 'white', border: 'none', borderRadius: '6px', fontWeight: 600, cursor: 'pointer', fontSize: '1rem' }}>Try Again</button>
              <button onClick={backToLevelSelect} style={{ padding: '10px 24px', background: '#4a5568', color: 'white', border: 'none', borderRadius: '6px', fontWeight: 600, cursor: 'pointer', fontSize: '1rem' }}>Change Level</button>
              {onBack && <button onClick={onBack} style={{ padding: '10px 24px', background: 'transparent', color: '#718096', border: '1px solid #e2e8f0', borderRadius: '6px', fontWeight: 500, cursor: 'pointer', fontSize: '1rem' }}>Back to Exercises</button>}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
