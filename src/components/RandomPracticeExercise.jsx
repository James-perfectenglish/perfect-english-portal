import { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';

export default function RandomPracticeExercise() {
  const [stage, setStage] = useState('start'); // 'start', 'playing', 'finished'
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

  // Fetch 20 random questions
  const startExercise = async () => {
    setLoading(true);
    try {
      // Get 10 gap-fill and 10 multiple choice
      const { data: gapFill, error: gapError } = await supabase
        .from('question_bank')
        .select('*')
        .eq('type', 'gap_fill')
        .limit(10);

      const { data: multipleChoice, error: mcError } = await supabase
        .from('question_bank')
        .select('*')
        .eq('type', 'multiple_choice')
        .limit(10);

      if (gapError || mcError) throw gapError || mcError;

      // Shuffle and combine
      const allQuestions = [...gapFill, ...multipleChoice].sort(() => Math.random() - 0.5);
      
      setQuestions(allQuestions);
      setStage('playing');
      setCurrentQuestionIndex(0);
      setLives(3);
      setScore(0);
      setFeedback(null);
      setUserAnswer('');
      setSelectedOption(null);
    } catch (error) {
      console.error('Error fetching questions:', error);
      alert('Failed to load questions. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // Check answer
  const checkAnswer = () => {
    const currentQuestion = questions[currentQuestionIndex];
    let isCorrect = false;
    let feedbackMessage = '';
    let feedbackType = 'incorrect'; // 'correct', 'incorrect', 'informal', 'alternative'

    if (currentQuestion.type === 'gap_fill') {
      const answer = userAnswer.trim();
      
      // Check correct answers
      const correctAnswers = currentQuestion.correct_answers || [];
      if (correctAnswers.includes(answer)) {
        isCorrect = true;
        feedbackMessage = '✅ Correct!';
        feedbackType = 'correct';
      } 
      // Check informal accepted (like 'u' for 'you')
      else if (currentQuestion.informal_accepted && currentQuestion.informal_accepted.includes(answer)) {
        isCorrect = true;
        feedbackMessage = `✅ Correct! ${currentQuestion.informal_feedback}`;
        feedbackType = 'informal';
      }
      // Check acceptable alternatives (correct but less natural)
      else if (currentQuestion.acceptable_alternatives) {
        const alternative = currentQuestion.acceptable_alternatives.find(alt => alt.answer === answer);
        if (alternative) {
          isCorrect = true;
          feedbackMessage = `✅ ${alternative.feedback}`;
          feedbackType = 'alternative';
        }
      }
      
      // If still incorrect
      if (!isCorrect) {
        const correctAnswer = correctAnswers[0] || 'N/A';
        feedbackMessage = `❌ Incorrect. The correct answer is: "${correctAnswer}". ${currentQuestion.explanation}`;
      }
    } 
    else if (currentQuestion.type === 'multiple_choice') {
      if (selectedOption === currentQuestion.correct_answer) {
        isCorrect = true;
        feedbackMessage = '✅ Correct!';
        feedbackType = 'correct';
      } else {
        feedbackMessage = `❌ Incorrect. The correct answer is: "${currentQuestion.correct_answer}". ${currentQuestion.explanation}`;
      }
    }

    setFeedback({ message: feedbackMessage, type: feedbackType, isCorrect });

    if (isCorrect) {
      setScore(score + 1);
    } else {
      const newLives = lives - 1;
      setLives(newLives);
      
      // Show hint on last life
      if (newLives === 1 && !showHint && currentQuestion.hint) {
        setShowHint(true);
      }
    }
  };

  // Move to next question
  const nextQuestion = () => {
    if (currentQuestionIndex < questions.length - 1) {
      setCurrentQuestionIndex(currentQuestionIndex + 1);
      setUserAnswer('');
      setSelectedOption(null);
      setFeedback(null);
      setShowHint(false);
    } else {
      setStage('finished');
    }
  };

  // Reset for retry
  const retry = () => {
    startExercise();
  };

  const currentQuestion = questions[currentQuestionIndex];

  return (
    <div style={{ maxWidth: '800px', margin: '0 auto', padding: '2rem' }}>
      {/* START SCREEN */}
      {stage === 'start' && (
        <div style={{ textAlign: 'center' }}>
          <h1>Random Practice</h1>
          <p>Test your English with 20 random questions!</p>
          <p>You have 3 lives. Good luck!</p>
          <button 
            onClick={startExercise}
            disabled={loading}
            style={{
              padding: '1rem 2rem',
              fontSize: '1.2rem',
              backgroundColor: '#3498DB',
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              cursor: 'pointer',
              marginTop: '2rem'
            }}
          >
            {loading ? 'Loading...' : 'Start Practice'}
          </button>
        </div>
      )}

      {/* PLAYING SCREEN */}
      {stage === 'playing' && currentQuestion && (
        <div>
          {/* Header */}
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '2rem' }}>
            <div>Question {currentQuestionIndex + 1} / {questions.length}</div>
            <div>
              Lives: {Array(lives).fill('❤️').join(' ')} {Array(3 - lives).fill('🖤').join(' ')}
            </div>
            <div>Score: {score}</div>
          </div>

          {/* Question */}
          <div style={{ 
            backgroundColor: '#f5f7fa', 
            padding: '2rem', 
            borderRadius: '12px',
            marginBottom: '1rem'
          }}>
            <div style={{ fontSize: '0.9rem', color: '#666', marginBottom: '0.5rem' }}>
              {currentQuestion.level} | {currentQuestion.topic.replace(/_/g, ' ')}
            </div>
            <h2 style={{ fontSize: '1.5rem', marginBottom: '1.5rem' }}>
              {currentQuestion.question}
            </h2>

            {/* Hint (if last life) */}
            {showHint && currentQuestion.hint && (
              <div style={{
                backgroundColor: '#fff3cd',
                padding: '1rem',
                borderRadius: '8px',
                marginBottom: '1rem',
                border: '1px solid #ffc107'
              }}>
                💡 <strong>Hint:</strong> {currentQuestion.hint}
              </div>
            )}

            {/* GAP FILL INPUT */}
            {currentQuestion.type === 'gap_fill' && !feedback && (
              <div>
                <input
                  type="text"
                  value={userAnswer}
                  onChange={(e) => setUserAnswer(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && checkAnswer()}
                  placeholder="Type your answer here..."
                  style={{
                    width: '100%',
                    padding: '1rem',
                    fontSize: '1.1rem',
                    borderRadius: '8px',
                    border: '2px solid #ddd',
                    marginBottom: '1rem'
                  }}
                  autoFocus
                />
              </div>
            )}

            {/* MULTIPLE CHOICE OPTIONS */}
            {currentQuestion.type === 'multiple_choice' && !feedback && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                {currentQuestion.options.map((option, index) => (
                  <button
                    key={index}
                    onClick={() => setSelectedOption(option)}
                    style={{
                      padding: '1rem',
                      fontSize: '1.1rem',
                      textAlign: 'left',
                      backgroundColor: selectedOption === option ? '#3498DB' : 'white',
                      color: selectedOption === option ? 'white' : '#2C3E50',
                      border: '2px solid #ddd',
                      borderRadius: '8px',
                      cursor: 'pointer',
                      transition: 'all 0.2s'
                    }}
                  >
                    {option}
                  </button>
                ))}
              </div>
            )}

            {/* CHECK ANSWER BUTTON */}
            {!feedback && (
              <button
                onClick={checkAnswer}
                disabled={
                  (currentQuestion.type === 'gap_fill' && !userAnswer.trim()) ||
                  (currentQuestion.type === 'multiple_choice' && !selectedOption)
                }
                style={{
                  padding: '1rem 2rem',
                  fontSize: '1.1rem',
                  backgroundColor: '#2C3E50',
                  color: 'white',
                  border: 'none',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  marginTop: '1rem',
                  opacity: (currentQuestion.type === 'gap_fill' && !userAnswer.trim()) ||
                           (currentQuestion.type === 'multiple_choice' && !selectedOption) ? 0.5 : 1
                }}
              >
                Check Answer
              </button>
            )}

            {/* FEEDBACK */}
            {feedback && (
              <div>
                <div style={{
                  backgroundColor: feedback.isCorrect ? '#d4edda' : '#f8d7da',
                  color: feedback.isCorrect ? '#155724' : '#721c24',
                  padding: '1rem',
                  borderRadius: '8px',
                  marginTop: '1rem',
                  marginBottom: '1rem'
                }}>
                  {feedback.message}
                </div>

                <button
                  onClick={nextQuestion}
                  style={{
                    padding: '1rem 2rem',
                    fontSize: '1.1rem',
                    backgroundColor: '#3498DB',
                    color: 'white',
                    border: 'none',
                    borderRadius: '8px',
                    cursor: 'pointer'
                  }}
                >
                  {currentQuestionIndex < questions.length - 1 ? 'Next Question →' : 'Finish'}
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* FINISHED SCREEN */}
      {stage === 'finished' && (
        <div style={{ textAlign: 'center' }}>
          <h1>Exercise Complete!</h1>
          <div style={{ fontSize: '3rem', margin: '2rem 0' }}>
            {score} / {questions.length}
          </div>
          <div style={{ fontSize: '1.5rem', marginBottom: '2rem' }}>
            {score >= 18 ? '🌟 Excellent!' : score >= 15 ? '👍 Great job!' : score >= 10 ? '👌 Good effort!' : '💪 Keep practicing!'}
          </div>

          <div style={{
            backgroundColor: '#f5f7fa',
            padding: '2rem',
            borderRadius: '12px',
            marginBottom: '2rem'
          }}>
            <h3>How difficult was this exercise?</h3>
            <div style={{ display: 'flex', justifyContent: 'center', gap: '1rem', marginTop: '1rem' }}>
              {[1, 2, 3, 4, 5].map((rating) => (
                <button
                  key={rating}
                  onClick={() => setDifficultyRating(rating)}
                  style={{
                    fontSize: '2rem',
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    opacity: difficultyRating >= rating ? 1 : 0.3
                  }}
                >
                  ⭐
                </button>
              ))}
            </div>
            <div style={{ fontSize: '0.9rem', color: '#666', marginTop: '0.5rem' }}>
              1 = Too easy, 5 = Very hard
            </div>
          </div>

          <button
            onClick={retry}
            style={{
              padding: '1rem 2rem',
              fontSize: '1.1rem',
              backgroundColor: '#3498DB',
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              cursor: 'pointer'
            }}
          >
            Try Again
          </button>
        </div>
      )}
    </div>
  );
}