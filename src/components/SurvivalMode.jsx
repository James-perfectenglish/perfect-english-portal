import { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';

const STAGES = [
  { name: 'Beginner', levels: ['A1', 'A2'], count: 20, gradient: 'linear-gradient(135deg, #43b581, #2ecc71)' },
  { name: 'Intermediate', levels: ['B1', 'B2'], count: 20, gradient: 'linear-gradient(135deg, #3498DB, #667eea)' },
  { name: 'Advanced', levels: ['C1', 'C2'], count: 999, gradient: 'linear-gradient(135deg, #ed8936, #f6ad55)' }
];

export default function SurvivalMode({ onBack }) {
  const [stage, setStage] = useState('start'); // start, playing, finished
  const [questions, setQuestions] = useState([]);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [userAnswer, setUserAnswer] = useState('');
  const [selectedOption, setSelectedOption] = useState(null);
  const [feedback, setFeedback] = useState(null);
  const [lives, setLives] = useState(5);
  const [score, setScore] = useState(0);
  const [showHint, setShowHint] = useState(false);
  const [loading, setLoading] = useState(false);
  const [currentStageIndex, setCurrentStageIndex] = useState(0);
  const [questionsAnsweredInStage, setQuestionsAnsweredInStage] = useState(0);
  const [stageTransition, setStageTransition] = useState(false);
  const [highestStage, setHighestStage] = useState('Beginner');

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [stage, stageTransition]);

  // Save individual answer to student_answers table
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

      await supabase
        .from('student_answers')
        .insert({
          student_id: user.id,
          question_id: question.question_number,
          student_answer: studentAnswer,
          correct_answer: correctAnswer,
          is_correct: isCorrect,
          answered_at: new Date().toISOString()
        });
    } catch (error) {
      console.error('Error saving answer:', error);
    }
  };

  const fetchQuestionsForStage = async (stageIndex) => {
    const stageConfig = STAGES[stageIndex];

    let gapFillQuery = supabase
      .from('question_bank')
      .select('*')
      .eq('type', 'gap_fill')
      .in('level', stageConfig.levels);

    let mcQuery = supabase
      .from('question_bank')
      .select('*')
      .eq('type', 'multiple_choice')
      .in('level', stageConfig.levels);

    const { data: gapFill, error: gapError } = await gapFillQuery;
    const { data: mc, error: mcError } = await mcQuery;

    if (gapError || mcError) throw gapError || mcError;

    // Reduced gap fill weighting: take fewer gap fills relative to multiple choice
    const shuffledGap = (gapFill || []).sort(() => Math.random() - 0.5);
    const shuffledMC = (mc || []).sort(() => Math.random() - 0.5);

    // Take roughly 20% gap fill, 80% multiple choice
    const gapCount = Math.min(Math.ceil(stageConfig.count * 0.2), shuffledGap.length);
    const mcCount = Math.min(stageConfig.count - gapCount, shuffledMC.length);

    const selectedGap = shuffledGap.slice(0, gapCount);
    const selectedMC = shuffledMC.slice(0, mcCount);

    const all = [...selectedGap, ...selectedMC].sort(() => Math.random() - 0.5);
    return all.slice(0, stageConfig.count);
  };

  const startGame = async () => {
    window.scrollTo({ top: 0, behavior: 'instant' });
    setLoading(true);
    try {
      // Load all questions for all stages upfront
      const beginnerQs = await fetchQuestionsForStage(0);
      const intermediateQs = await fetchQuestionsForStage(1);
      const advancedQs = await fetchQuestionsForStage(2);

      const allQuestions = [...beginnerQs, ...intermediateQs, ...advancedQs];

      if (allQuestions.length === 0) {
        alert('No questions available yet. Check back soon!');
        setLoading(false);
        return;
      }

      setQuestions(allQuestions);
      setStage('playing');
      setCurrentQuestionIndex(0);
      setLives(5);
      setScore(0);
      setCurrentStageIndex(0);
      setQuestionsAnsweredInStage(0);
      setHighestStage('Beginner');
      setFeedback(null);
      setUserAnswer('');
      setSelectedOption(null);
      setShowHint(false);
      setStageTransition(false);
    } catch (error) {
      console.error('Error fetching questions:', error);
      alert('Failed to load questions. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const getCurrentStageConfig = () => {
    let qCount = 0;
    for (let i = 0; i < STAGES.length; i++) {
      const stageQuestionCount = i === STAGES.length - 1
        ? questions.length - qCount
        : Math.min(STAGES[i].count, questions.length - qCount);
      if (currentQuestionIndex < qCount + stageQuestionCount) {
        return { ...STAGES[i], stageIndex: i, stageStart: qCount };
      }
      qCount += stageQuestionCount;
    }
    return { ...STAGES[STAGES.length - 1], stageIndex: STAGES.length - 1, stageStart: qCount };
  };

  const checkAnswer = () => {
    const currentQuestion = questions[currentQuestionIndex];
    let isCorrect = false;
    let feedbackMessage = '';
    let feedbackType = 'incorrect';

    if (currentQuestion.type === 'gap_fill') {
      const answer = userAnswer.toLowerCase().trim();
      const correctAnswers = Array.isArray(currentQuestion.correct_answers)
        ? currentQuestion.correct_answers.map(a => a.toLowerCase().trim())
        : [];

      if (correctAnswers.includes(answer)) {
        isCorrect = true;
        feedbackMessage = `✅ Correct! ${currentQuestion.explanation}`;
        feedbackType = 'correct';
      } else if (currentQuestion.informal_accepted && Array.isArray(currentQuestion.informal_accepted)) {
        const informalAnswers = currentQuestion.informal_accepted.map(a => a.toLowerCase().trim());
        if (informalAnswers.includes(answer)) {
          isCorrect = true;
          feedbackMessage = `✅ Correct! ${currentQuestion.informal_feedback || ''} ${currentQuestion.explanation}`;
          feedbackType = 'informal';
        }
      }

      if (!isCorrect && currentQuestion.acceptable_alternatives && Array.isArray(currentQuestion.acceptable_alternatives)) {
        const alternative = currentQuestion.acceptable_alternatives.find(
          alt => alt.answer && alt.answer.toLowerCase().trim() === answer
        );
        if (alternative) {
          isCorrect = true;
          feedbackMessage = `✅ ${alternative.feedback} ${currentQuestion.explanation}`;
          feedbackType = 'alternative';
        }
      }

      if (!isCorrect) {
        const correctAnswer = correctAnswers[0] || 'N/A';
        feedbackMessage = `❌ Incorrect. The correct answer is: "${correctAnswer}". ${currentQuestion.explanation}`;
      }

      // Track the answer
      saveAnswer(currentQuestion, userAnswer.trim(), isCorrect);

    } else if (currentQuestion.type === 'multiple_choice') {
      if (selectedOption === currentQuestion.correct_answer) {
        isCorrect = true;
        feedbackMessage = `✅ Correct! ${currentQuestion.explanation}`;
        feedbackType = 'correct';
      } else {
        feedbackMessage = `❌ Incorrect. The correct answer is: "${currentQuestion.correct_answer}". ${currentQuestion.explanation}`;
      }

      // Track the answer
      saveAnswer(currentQuestion, selectedOption || '', isCorrect);
    }

    setFeedback({ message: feedbackMessage, type: feedbackType, isCorrect });

    if (isCorrect) {
      setScore(score + 1);
    } else {
      const newLives = lives - 1;
      setLives(newLives);
      if (newLives === 0) {
        setTimeout(() => {
          setStage('finished');
        }, 2000);
        return;
      }
      if (newLives === 1 && !showHint && currentQuestion.hint) {
        setShowHint(true);
      }
    }
  };

  const nextQuestion = () => {
    window.scrollTo({ top: 0, behavior: 'instant' });

    const nextIndex = currentQuestionIndex + 1;

    // Check if we've run out of questions
    if (nextIndex >= questions.length) {
      setStage('finished');
      return;
    }

    // Check for stage transition
    const currentStageInfo = getCurrentStageConfig();
    const nextStageStart = currentStageInfo.stageStart +
      (currentStageInfo.stageIndex === STAGES.length - 1
        ? questions.length - currentStageInfo.stageStart
        : STAGES[currentStageInfo.stageIndex].count);

    if (nextIndex >= nextStageStart && currentStageInfo.stageIndex < STAGES.length - 1) {
      // Stage transition!
      const nextStage = STAGES[currentStageInfo.stageIndex + 1];
      setHighestStage(nextStage.name);
      setStageTransition(true);
      setCurrentStageIndex(currentStageInfo.stageIndex + 1);

      setTimeout(() => {
        setStageTransition(false);
        setCurrentQuestionIndex(nextIndex);
        setUserAnswer('');
        setSelectedOption(null);
        setFeedback(null);
        setShowHint(false);
      }, 2500);
    } else {
      setCurrentQuestionIndex(nextIndex);
      setUserAnswer('');
      setSelectedOption(null);
      setFeedback(null);
      setShowHint(false);
    }
  };

  const currentQuestion = questions[currentQuestionIndex];
  const stageInfo = stage === 'playing' ? getCurrentStageConfig() : null;

  return (
    <div style={{ width: '100%', minHeight: '100vh', backgroundColor: '#f8f9fa', boxSizing: 'border-box' }}>
      <div style={{ padding: '1rem', width: '100%', boxSizing: 'border-box' }}>

        {/* START SCREEN */}
        {stage === 'start' && (
          <div style={{
            textAlign: 'center',
            padding: '2rem 0',
            minHeight: '60vh',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            width: '100%',
            maxWidth: '600px',
            margin: '0 auto'
          }}>
            <div style={{ fontSize: '4rem', marginBottom: '1rem' }}>⚔️</div>
            <h1 style={{
              fontSize: 'clamp(2rem, 8vw, 2.5rem)',
              color: '#2C3E50',
              marginBottom: '1rem',
              fontWeight: '700'
            }}>
              Survival Mode
            </h1>

            <p style={{
              fontSize: 'clamp(1rem, 3.5vw, 1.15rem)',
              color: '#4a5568',
              marginBottom: '2rem',
              lineHeight: '1.6'
            }}>
              How far can you go? Start at Beginner and work your way up through
              Intermediate to Advanced. You have <strong>5 lives</strong> — no restarts, no mercy!
            </p>

            {/* Stage preview */}
            <div style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '0.75rem',
              marginBottom: '2.5rem',
              textAlign: 'left',
              maxWidth: '350px',
              margin: '0 auto 2.5rem'
            }}>
              {STAGES.map((s, i) => (
                <div key={i} style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.75rem',
                  padding: '0.75rem 1rem',
                  backgroundColor: 'white',
                  borderRadius: '10px',
                  border: '1px solid #e2e8f0'
                }}>
                  <div style={{
                    background: s.gradient,
                    width: '36px',
                    height: '36px',
                    borderRadius: '8px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: 'white',
                    fontWeight: '700',
                    fontSize: '0.9rem',
                    flexShrink: 0
                  }}>
                    {i + 1}
                  </div>
                  <div>
                    <div style={{ fontWeight: '600', color: '#2C3E50', fontSize: '0.95rem' }}>{s.name}</div>
                    <div style={{ fontSize: '0.8rem', color: '#888' }}>
                      {i < 2 ? `${s.count} questions` : 'Until you drop!'}
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <button
              onClick={startGame}
              disabled={loading}
              style={{
                padding: '1.25rem',
                fontSize: 'clamp(1.1rem, 4vw, 1.3rem)',
                background: 'linear-gradient(135deg, #ed8936, #e74c3c)',
                color: 'white',
                border: 'none',
                borderRadius: '12px',
                cursor: 'pointer',
                width: '100%',
                maxWidth: '350px',
                margin: '0 auto',
                fontWeight: '600',
                boxShadow: '0 4px 12px rgba(237, 137, 54, 0.3)'
              }}
            >
              {loading ? 'Loading...' : '⚔️ Enter Survival Mode'}
            </button>

            {onBack && (
              <button
                onClick={onBack}
                style={{
                  marginTop: '1.5rem',
                  padding: '0.75rem 1.5rem',
                  fontSize: 'clamp(0.9rem, 3vw, 1rem)',
                  backgroundColor: 'transparent',
                  color: '#666',
                  border: '1px solid #ddd',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  fontWeight: '500'
                }}
              >
                ← Back to Practice
              </button>
            )}
          </div>
        )}

        {/* STAGE TRANSITION SCREEN */}
        {stage === 'playing' && stageTransition && (
          <div style={{
            textAlign: 'center',
            padding: '2rem 0',
            minHeight: '60vh',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            alignItems: 'center',
            maxWidth: '600px',
            margin: '0 auto'
          }}>
            <div style={{
              fontSize: '3rem',
              marginBottom: '1rem',
              animation: 'pulse 1s ease-in-out infinite'
            }}>
              🔥
            </div>
            <h2 style={{
              fontSize: 'clamp(1.8rem, 6vw, 2.2rem)',
              color: '#2C3E50',
              marginBottom: '0.5rem',
              fontWeight: '700'
            }}>
              Level Up!
            </h2>
            <div style={{
              display: 'inline-block',
              background: STAGES[currentStageIndex].gradient,
              color: 'white',
              padding: '8px 24px',
              borderRadius: '20px',
              fontSize: 'clamp(1.1rem, 4vw, 1.3rem)',
              fontWeight: '600',
              marginBottom: '1rem'
            }}>
              {STAGES[currentStageIndex].name}
            </div>
            <p style={{ fontSize: '1.1rem', color: '#666' }}>
              Score: {score} | Lives: {Array(lives).fill('❤️').join(' ')}
            </p>
            <p style={{ fontSize: '1rem', color: '#888', marginTop: '1rem' }}>
              Get ready...
            </p>
          </div>
        )}

        {/* PLAYING SCREEN */}
        {stage === 'playing' && !stageTransition && currentQuestion && (
          <div style={{ width: '100%', maxWidth: '700px', margin: '0 auto' }}>
            {/* Info Bar */}
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: '0.5rem',
              fontSize: 'clamp(0.9rem, 3vw, 1rem)',
              color: '#2C3E50',
              fontWeight: '500'
            }}>
              <div>Q {currentQuestionIndex + 1}</div>
              <div>Lives: {Array(lives).fill('❤️').join(' ')} {Array(5 - lives).fill('🖤').join(' ')}</div>
              <div>Score: {score}</div>
            </div>

            {/* Stage indicator */}
            {stageInfo && (
              <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '0.5rem',
                marginBottom: '1rem'
              }}>
                {STAGES.map((s, i) => (
                  <div key={i} style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.25rem'
                  }}>
                    <div style={{
                      width: i === stageInfo.stageIndex ? '28px' : '20px',
                      height: i === stageInfo.stageIndex ? '28px' : '20px',
                      borderRadius: '50%',
                      background: i <= stageInfo.stageIndex ? s.gradient : '#e0e0e0',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '0.65rem',
                      color: 'white',
                      fontWeight: '700',
                      transition: 'all 0.3s'
                    }}>
                      {i + 1}
                    </div>
                    {i < STAGES.length - 1 && (
                      <div style={{
                        width: '20px',
                        height: '2px',
                        backgroundColor: i < stageInfo.stageIndex ? '#43b581' : '#e0e0e0'
                      }} />
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* Question Card */}
            <div style={{
              backgroundColor: 'white',
              padding: 'clamp(1.5rem, 5vw, 2.5rem)',
              borderRadius: '16px',
              boxShadow: '0 4px 16px rgba(0,0,0,0.08)',
              display: 'flex',
              flexDirection: 'column',
              gap: '1.5rem'
            }}>
              {/* Question Type + Level/Topic Badges */}
              <div style={{
                display: 'flex',
                flexWrap: 'wrap',
                gap: '0.5rem',
                alignItems: 'center'
              }}>
                <div style={{
                  padding: '4px 12px',
                  borderRadius: '20px',
                  fontSize: '0.8rem',
                  fontWeight: '600',
                  backgroundColor: currentQuestion.type === 'gap_fill' ? '#fff3cd' : '#d4edda',
                  color: currentQuestion.type === 'gap_fill' ? '#856404' : '#155724'
                }}>
                  {currentQuestion.type === 'gap_fill' ? '✏️ Gap Fill' : '📝 Multiple Choice'}
                </div>
                {(currentQuestion.level || currentQuestion.topic) && (
                  <div style={{
                    padding: '4px 12px',
                    borderRadius: '20px',
                    fontSize: '0.8rem',
                    fontWeight: '600',
                    backgroundColor: '#e8f4fd',
                    color: '#2471a3'
                  }}>
                    {[currentQuestion.level, currentQuestion.topic].filter(Boolean).join(' · ')}
                  </div>
                )}
              </div>

              {/* Question Text */}
              <div style={{
                fontSize: 'clamp(1.15rem, 4vw, 1.4rem)',
                color: '#2C3E50',
                lineHeight: '1.6',
                fontWeight: '500',
                wordWrap: 'break-word',
                overflowWrap: 'break-word'
              }}>
                {currentQuestion.question}
              </div>

              {/* Hint */}
              {showHint && currentQuestion.hint && (
                <div style={{
                  backgroundColor: '#fff3cd',
                  padding: '0.8rem 1rem',
                  borderRadius: '8px',
                  border: '1px solid #ffc107',
                  fontSize: 'clamp(0.9rem, 3vw, 1rem)',
                  color: '#856404'
                }}>
                  💡 <strong>Hint:</strong> {currentQuestion.hint}
                </div>
              )}

              <div style={{ flex: 1 }}>
                {/* GAP FILL */}
                {currentQuestion.type === 'gap_fill' && !feedback && (
                  <input
                    type="text"
                    value={userAnswer}
                    onChange={(e) => setUserAnswer(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && checkAnswer()}
                    placeholder="Type your answer..."
                    style={{
                      width: '100%',
                      padding: '1.2rem',
                      fontSize: 'clamp(1.1rem, 4vw, 1.3rem)',
                      borderRadius: '10px',
                      border: '2px solid #e0e0e0',
                      boxSizing: 'border-box',
                      color: '#2C3E50'
                    }}
                    autoFocus
                  />
                )}

                {/* MULTIPLE CHOICE */}
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
                          borderRadius: '10px',
                          cursor: 'pointer',
                          transition: 'all 0.2s',
                          wordWrap: 'break-word',
                          width: '100%',
                          boxSizing: 'border-box',
                          fontWeight: '500'
                        }}
                      >
                        {option}
                      </button>
                    ))}
                  </div>
                )}

                {/* FEEDBACK */}
                {feedback && (
                  <div style={{
                    backgroundColor: feedback.isCorrect ? '#d4edda' : '#f8d7da',
                    color: feedback.isCorrect ? '#155724' : '#721c24',
                    padding: '1.2rem',
                    borderRadius: '10px',
                    fontSize: 'clamp(1rem, 3vw, 1.1rem)',
                    lineHeight: '1.6',
                    wordWrap: 'break-word',
                    overflowWrap: 'break-word'
                  }}>
                    {feedback.message}
                  </div>
                )}
              </div>

              {/* Buttons */}
              <div style={{ marginTop: '1.5rem' }}>
                {!feedback && (
                  <button
                    onClick={checkAnswer}
                    disabled={
                      (currentQuestion.type === 'gap_fill' && !userAnswer.trim()) ||
                      (currentQuestion.type === 'multiple_choice' && !selectedOption)
                    }
                    style={{
                      padding: '1.2rem',
                      fontSize: 'clamp(1.1rem, 4vw, 1.25rem)',
                      backgroundColor: '#2C3E50',
                      color: 'white',
                      border: 'none',
                      borderRadius: '10px',
                      cursor: 'pointer',
                      width: '100%',
                      fontWeight: '600',
                      opacity:
                        (currentQuestion.type === 'gap_fill' && !userAnswer.trim()) ||
                        (currentQuestion.type === 'multiple_choice' && !selectedOption)
                          ? 0.5 : 1
                    }}
                  >
                    Check Answer
                  </button>
                )}

                {feedback && lives > 0 && (
                  <button
                    onClick={nextQuestion}
                    style={{
                      padding: '1.2rem',
                      fontSize: 'clamp(1.1rem, 4vw, 1.25rem)',
                      background: stageInfo ? STAGES[stageInfo.stageIndex].gradient : '#3498DB',
                      color: 'white',
                      border: 'none',
                      borderRadius: '10px',
                      cursor: 'pointer',
                      width: '100%',
                      fontWeight: '600'
                    }}
                  >
                    Next Question →
                  </button>
                )}
              </div>
            </div>
          </div>
        )}

        {/* FINISHED SCREEN */}
        {stage === 'finished' && (
          <div style={{ width: '100%', maxWidth: '600px', margin: '2rem auto 0' }}>
            <div style={{
              backgroundColor: 'white',
              padding: 'clamp(2rem, 6vw, 3rem)',
              borderRadius: '16px',
              boxShadow: '0 4px 16px rgba(0,0,0,0.08)',
              textAlign: 'center'
            }}>
              <div style={{ fontSize: '3rem', marginBottom: '0.5rem' }}>⚔️</div>
              <h1 style={{
                fontSize: 'clamp(1.8rem, 6vw, 2.2rem)',
                color: '#2C3E50',
                marginBottom: '1rem',
                fontWeight: '700'
              }}>
                {lives === 0 ? 'Game Over!' : 'Survival Complete!'}
              </h1>

              <div style={{
                fontSize: 'clamp(3rem, 12vw, 4rem)',
                margin: '1rem 0',
                color: '#2C3E50',
                fontWeight: 'bold'
              }}>
                {score}
              </div>
              <div style={{
                fontSize: 'clamp(1rem, 3vw, 1.1rem)',
                color: '#666',
                marginBottom: '1.5rem'
              }}>
                questions correct
              </div>

              {/* Stats */}
              <div style={{
                backgroundColor: '#f5f7fa',
                padding: 'clamp(1.25rem, 4vw, 1.75rem)',
                borderRadius: '12px',
                marginBottom: '2rem'
              }}>
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr 1fr',
                  gap: '1rem',
                  textAlign: 'center'
                }}>
                  <div>
                    <div style={{ fontSize: '0.85rem', color: '#888', marginBottom: '0.25rem' }}>Highest Stage</div>
                    <div style={{ fontSize: '1.2rem', fontWeight: '700', color: '#2C3E50' }}>{highestStage}</div>
                  </div>
                  <div>
                    <div style={{ fontSize: '0.85rem', color: '#888', marginBottom: '0.25rem' }}>Questions Faced</div>
                    <div style={{ fontSize: '1.2rem', fontWeight: '700', color: '#2C3E50' }}>{currentQuestionIndex + 1}</div>
                  </div>
                  <div>
                    <div style={{ fontSize: '0.85rem', color: '#888', marginBottom: '0.25rem' }}>Accuracy</div>
                    <div style={{ fontSize: '1.2rem', fontWeight: '700', color: '#2C3E50' }}>
                      {currentQuestionIndex + 1 > 0 ? Math.round((score / (currentQuestionIndex + 1)) * 100) : 0}%
                    </div>
                  </div>
                  <div>
                    <div style={{ fontSize: '0.85rem', color: '#888', marginBottom: '0.25rem' }}>Lives Remaining</div>
                    <div style={{ fontSize: '1.2rem', fontWeight: '700', color: '#2C3E50' }}>
                      {Array(lives).fill('❤️').join('')}{Array(5 - lives).fill('🖤').join('')}
                    </div>
                  </div>
                </div>
              </div>

              {/* Performance message */}
              <div style={{
                fontSize: 'clamp(1.2rem, 4vw, 1.4rem)',
                marginBottom: '2rem',
                color: '#2C3E50'
              }}>
                {score >= 50 ? '🏆 Legendary!' :
                 score >= 40 ? '⭐ Outstanding!' :
                 score >= 30 ? '🔥 Impressive!' :
                 score >= 20 ? '💪 Great run!' :
                 score >= 10 ? '👍 Good effort!' :
                 '🎯 Keep practising!'}
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <button
                  onClick={() => {
                    setStage('start');
                    setQuestions([]);
                    setCurrentQuestionIndex(0);
                  }}
                  style={{
                    padding: '1.2rem',
                    fontSize: 'clamp(1.1rem, 4vw, 1.25rem)',
                    background: 'linear-gradient(135deg, #ed8936, #e74c3c)',
                    color: 'white',
                    border: 'none',
                    borderRadius: '10px',
                    cursor: 'pointer',
                    fontWeight: '600'
                  }}
                >
                  ⚔️ Try Again
                </button>
                {onBack && (
                  <button
                    onClick={onBack}
                    style={{
                      padding: '1rem',
                      fontSize: 'clamp(1rem, 3.5vw, 1.1rem)',
                      backgroundColor: 'transparent',
                      color: '#666',
                      border: '1px solid #ddd',
                      borderRadius: '10px',
                      cursor: 'pointer',
                      fontWeight: '500'
                    }}
                  >
                    ← Back to Practice
                  </button>
                )}
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
