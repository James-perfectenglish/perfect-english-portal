import { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import SentenceBuildingInput from './SentenceBuildingInput';

export default function RandomPracticeExercise({ levels, levelTitle, levelSubtitle, gradient, onBack }) {
  const [stage, setStage] = useState('start');
  const [questions, setQuestions] = useState([]);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [userAnswer, setUserAnswer] = useState('');
  const [selectedOption, setSelectedOption] = useState(null);
  const [feedback, setFeedback] = useState(null);
  const [lives, setLives] = useState(3);
  const [score, setScore] = useState(0);
  const [showHint, setShowHint] = useState(false);
  const [loading, setLoading] = useState(false);
  const [difficultyRating, setDifficultyRating] = useState(0);
  const [sbFeedback, setSbFeedback] = useState(null);

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [stage]);

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
          is_correct: isCorrect
        });
    } catch (error) {
      console.error('Error saving answer:', error);
    }
  };

  const startExercise = async () => {
    window.scrollTo({ top: 0, behavior: 'instant' });
    setLoading(true);
    try {
      // Build queries with level filter
      let gapFillQuery = supabase
        .from('question_bank')
        .select('*')
        .eq('type', 'gap_fill');

      let mcQuery = supabase
        .from('question_bank')
        .select('*')
        .eq('type', 'multiple_choice');

      let sbQuery = supabase
        .from('question_bank')
        .select('*')
        .eq('type', 'sentence_building');

      // Apply level filter if levels are provided
      if (levels && levels.length > 0) {
        gapFillQuery = gapFillQuery.in('level', levels);
        mcQuery = mcQuery.in('level', levels);
        sbQuery = sbQuery.in('level', levels);
      }

      const { data: allGapFill, error: gapError } = await gapFillQuery;
      const { data: allMultipleChoice, error: mcError } = await mcQuery;
      const { data: allSentenceBuilding, error: sbError } = await sbQuery;

      if (gapError || mcError || sbError) throw gapError || mcError || sbError;

      // Shuffle and take up to 3 gap_fill (reduced), 13 multiple_choice, 4 sentence_building
      const shuffledGapFill = (allGapFill || []).sort(() => Math.random() - 0.5).slice(0, 3);
      const shuffledMultipleChoice = (allMultipleChoice || []).sort(() => Math.random() - 0.5).slice(0, 13);
      const shuffledSentenceBuilding = (allSentenceBuilding || []).sort(() => Math.random() - 0.5).slice(0, 4);

      const allQuestions = [...shuffledGapFill, ...shuffledMultipleChoice, ...shuffledSentenceBuilding]
        .sort(() => Math.random() - 0.5);

      if (allQuestions.length === 0) {
        alert('No questions available for this level yet. Check back soon!');
        setLoading(false);
        return;
      }

      setQuestions(allQuestions);
      setStage('playing');
      setCurrentQuestionIndex(0);
      setLives(3);
      setScore(0);
      setFeedback(null);
      setSbFeedback(null);
      setUserAnswer('');
      setSelectedOption(null);
      setDifficultyRating(0);
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

  // Handler for sentence_building questions — called by SentenceBuildingInput
  const handleSentenceBuildingResult = (isCorrect, isSoft = false, userAnswer = '') => {
    const currentQuestion = questions[currentQuestionIndex];
    let feedbackMessage = '';

    if (isCorrect && !isSoft) {
      feedbackMessage = `✅ Correct! ${currentQuestion.explanation || ''}`;
      setSbFeedback({ correct: true, message: feedbackMessage });
      setFeedback({ message: feedbackMessage, type: 'correct', isCorrect: true });
      setScore(s => s + 1);
      saveAnswer(currentQuestion, userAnswer || '(correct)', true);
    } else if (isCorrect && isSoft) {
      feedbackMessage = `✅ You got the words right — but don't forget your punctuation! Score counted. ${currentQuestion.explanation || ''}`;
      setSbFeedback({ correct: true, message: feedbackMessage });
      setFeedback({ message: feedbackMessage, type: 'correct', isCorrect: true });
      setScore(s => s + 1);
      saveAnswer(currentQuestion, userAnswer || '(soft pass)', true);
    } else {
      const correctSentences = Array.isArray(currentQuestion.correct_answers)
        ? currentQuestion.correct_answers
        : JSON.parse(currentQuestion.correct_answers || '[]');
      const displaySentence = (correctSentences[0] || '')
        .replace(/ ([.,?!;:])/g, '$1')
        .replace(/^(\w)/, m => m.toUpperCase());
      feedbackMessage = `❌ Not quite. The correct answer is: "${displaySentence}" — ${currentQuestion.explanation || ''}`;
      setSbFeedback({ correct: false, message: feedbackMessage });
      setFeedback({ message: feedbackMessage, type: 'incorrect', isCorrect: false });
      saveAnswer(currentQuestion, userAnswer || '(incorrect)', false);

      const newLives = lives - 1;
      setLives(newLives);
      if (newLives === 0) {
        setTimeout(() => {
          setStage('finished');
        }, 2000);
        return;
      }
    }
  };

  // Get props for SentenceBuildingInput from a question_bank row
  const getSbProps = (question) => {
    if (!question) return {};
    const options = Array.isArray(question.options)
      ? question.options
      : JSON.parse(question.options || '[]');
    const correctSentences = Array.isArray(question.correct_answers)
      ? question.correct_answers
      : JSON.parse(question.correct_answers || '[]');
    const hasPrompt = question.question && question.question.trim() !== '';

    return {
      words: options,
      questionType: hasPrompt ? 'translation' : 'build',
      prompt: hasPrompt ? question.question : null,
      correctSentences,
      explanation: question.explanation || ''
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
      setShowHint(false);
    } else {
      setStage('finished');
    }
  };

  const retry = () => {
    startExercise();
  };

  const currentQuestion = questions[currentQuestionIndex];

  // Display title
  const displayTitle = levelTitle ? `${levelTitle} Practice` : 'Random Practice';
  const displaySubtitle = levelSubtitle || '';
  const displayGradient = gradient || 'linear-gradient(135deg, #3498DB, #667eea)';

  return (
    <div style={{
      width: '100%',
      minHeight: '100vh',
      backgroundColor: '#f8f9fa',
      boxSizing: 'border-box'
    }}>
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
            boxSizing: 'border-box',
            maxWidth: '600px',
            margin: '0 auto'
          }}>
            {levelSubtitle && (
              <div style={{
                display: 'inline-block',
                background: displayGradient,
                color: 'white',
                padding: '6px 20px',
                borderRadius: '20px',
                fontSize: 'clamp(0.9rem, 3vw, 1rem)',
                fontWeight: '600',
                marginBottom: '1rem',
                alignSelf: 'center'
              }}>
                {levelSubtitle}
              </div>
            )}
            <h1 style={{
              fontSize: 'clamp(2rem, 8vw, 2.5rem)',
              color: '#2C3E50',
              marginBottom: '1.5rem',
              fontWeight: '700'
            }}>
              {displayTitle}
            </h1>
            <p style={{
              fontSize: 'clamp(1.1rem, 4vw, 1.3rem)',
              color: '#2C3E50',
              marginBottom: '1rem',
              lineHeight: '1.5'
            }}>
              Test your English with 20 random questions!
            </p>
            <p style={{
              fontSize: 'clamp(0.95rem, 3vw, 1.05rem)',
              color: '#666',
              marginBottom: '2.5rem',
              lineHeight: '1.5'
            }}>
              You have <strong>3 lives</strong>. Mix of multiple choice, gap fill, and sentence building.
            </p>

            <button
              onClick={startExercise}
              disabled={loading}
              style={{
                padding: '1.25rem',
                fontSize: 'clamp(1.1rem, 4vw, 1.3rem)',
                background: displayGradient,
                color: 'white',
                border: 'none',
                borderRadius: '12px',
                cursor: 'pointer',
                width: '100%',
                maxWidth: '350px',
                margin: '0 auto',
                fontWeight: '600',
                boxShadow: '0 4px 12px rgba(0,0,0,0.15)'
              }}
            >
              {loading ? 'Loading...' : 'Start Practice'}
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
                ← Choose Different Level
              </button>
            )}
          </div>
        )}

        {/* PLAYING SCREEN */}
        {stage === 'playing' && currentQuestion && (
          <div style={{ width: '100%', maxWidth: '700px', margin: '0 auto' }}>
            {/* Info Bar */}
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              marginBottom: '1rem',
              fontSize: 'clamp(0.9rem, 3vw, 1rem)',
              color: '#2C3E50',
              fontWeight: '500'
            }}>
              <div>Q {currentQuestionIndex + 1}/{questions.length}</div>
              <div>Lives: {Array(lives).fill('❤️').join(' ')} {Array(3 - lives).fill('🖤').join(' ')}</div>
              <div>Score: {score}</div>
            </div>

            {/* Progress Bar */}
            <div style={{
              height: '6px',
              backgroundColor: '#e0e0e0',
              borderRadius: '3px',
              marginBottom: '1.5rem',
              overflow: 'hidden'
            }}>
              <div style={{
                height: '100%',
                width: `${((currentQuestionIndex) / questions.length) * 100}%`,
                background: displayGradient,
                borderRadius: '3px',
                transition: 'width 0.3s ease'
              }} />
            </div>

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
                  backgroundColor: currentQuestion.type === 'gap_fill' ? '#fff3cd'
                    : currentQuestion.type === 'sentence_building' ? '#e8daef'
                    : '#d4edda',
                  color: currentQuestion.type === 'gap_fill' ? '#856404'
                    : currentQuestion.type === 'sentence_building' ? '#6c3483'
                    : '#155724'
                }}>
                  {currentQuestion.type === 'gap_fill' ? '✏️ Gap Fill'
                    : currentQuestion.type === 'sentence_building' ? '🧩 Sentence Building'
                    : '📝 Multiple Choice'}
                </div>
                {currentQuestion.level && (
                  <div style={{
                    padding: '4px 12px',
                    borderRadius: '20px',
                    fontSize: '0.8rem',
                    fontWeight: '600',
                    backgroundColor: currentQuestion.level.startsWith('A') ? '#c6f6d5'
                      : currentQuestion.level.startsWith('B') ? '#bee3f8'
                      : '#feebc8',
                    color: currentQuestion.level.startsWith('A') ? '#48bb78'
                      : currentQuestion.level.startsWith('B') ? '#4299e1'
                      : '#ed8936'
                  }}>
                    {currentQuestion.level}
                  </div>
                )}
                {currentQuestion.topic && (
                  <div style={{
                    padding: '4px 12px',
                    borderRadius: '20px',
                    fontSize: '0.8rem',
                    fontWeight: '600',
                    backgroundColor: '#f0f0f0',
                    color: '#555'
                  }}>
                    {currentQuestion.topic.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}
                  </div>
                )}
              </div>

              {/* Question Text (not shown for pure sentence building) */}
              {!(currentQuestion.type === 'sentence_building' && (!currentQuestion.question || !currentQuestion.question.trim())) && (
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
              )}

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

                {/* SENTENCE BUILDING */}
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

                {/* FEEDBACK for gap_fill and multiple_choice */}
                {feedback && currentQuestion.type !== 'sentence_building' && (
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
                {/* Check Answer — only for gap_fill and multiple_choice */}
                {!feedback && currentQuestion.type !== 'sentence_building' && (
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

                {/* Next Question — shown after feedback for all types */}
                {feedback && lives > 0 && (
                  <button
                    onClick={nextQuestion}
                    style={{
                      padding: '1.2rem',
                      fontSize: 'clamp(1.1rem, 4vw, 1.25rem)',
                      backgroundColor: '#3498DB',
                      color: 'white',
                      border: 'none',
                      borderRadius: '10px',
                      cursor: 'pointer',
                      width: '100%',
                      fontWeight: '600'
                    }}
                  >
                    {currentQuestionIndex < questions.length - 1 ? 'Next Question →' : 'Finish'}
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
              <h1 style={{
                fontSize: 'clamp(1.8rem, 6vw, 2.2rem)',
                color: '#2C3E50',
                marginBottom: '1.5rem',
                fontWeight: '700'
              }}>
                Exercise Complete!
              </h1>
              <div style={{
                fontSize: 'clamp(3rem, 12vw, 4rem)',
                margin: '1.5rem 0',
                color: '#2C3E50',
                fontWeight: 'bold'
              }}>
                {score} / {questions.length}
              </div>
              <div style={{
                fontSize: 'clamp(1.4rem, 5vw, 1.7rem)',
                marginBottom: '2rem',
                color: '#2C3E50'
              }}>
                {score >= 18 ? '🌟 Excellent!' : score >= 15 ? '👍 Great job!' : score >= 10 ? '👌 Good effort!' : '💪 Keep practicing!'}
              </div>

              {lives === 0 && (
                <div style={{
                  backgroundColor: '#fff3cd',
                  padding: '1.2rem',
                  borderRadius: '10px',
                  marginBottom: '2rem',
                  fontSize: 'clamp(1rem, 3.5vw, 1.1rem)',
                  color: '#856404',
                  lineHeight: '1.5'
                }}>
                  You ran out of lives! Don't worry - practice makes perfect. Try again!
                </div>
              )}

              <div style={{
                backgroundColor: '#f5f7fa',
                padding: 'clamp(1.5rem, 5vw, 2rem)',
                borderRadius: '12px',
                marginBottom: '2rem'
              }}>
                <h3 style={{
                  fontSize: 'clamp(1.1rem, 4vw, 1.3rem)',
                  color: '#2C3E50',
                  marginBottom: '1rem',
                  fontWeight: '600'
                }}>
                  How difficult was this?
                </h3>
                <div style={{ display: 'flex', justifyContent: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
                  {[1, 2, 3, 4, 5].map(star => (
                    <button
                      key={star}
                      onClick={() => setDifficultyRating(star)}
                      style={{
                        fontSize: 'clamp(1.5rem, 5vw, 2rem)',
                        background: 'none',
                        border: 'none',
                        cursor: 'pointer',
                        opacity: star <= difficultyRating ? 1 : 0.3,
                        transition: 'opacity 0.2s'
                      }}
                    >
                      ⭐
                    </button>
                  ))}
                </div>
                {difficultyRating > 0 && (
                  <p style={{ fontSize: '0.9rem', color: '#888', marginTop: '0.5rem' }}>
                    {difficultyRating <= 2 ? 'Too easy? Try a harder level!' : difficultyRating === 3 ? 'Just right!' : 'Challenge accepted!'}
                  </p>
                )}
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <button
                  onClick={retry}
                  style={{
                    padding: '1.2rem',
                    fontSize: 'clamp(1.1rem, 4vw, 1.25rem)',
                    background: displayGradient,
                    color: 'white',
                    border: 'none',
                    borderRadius: '10px',
                    cursor: 'pointer',
                    fontWeight: '600'
                  }}
                >
                  Try Again
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
                    ← Back to Levels
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
