import { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';

export default function RandomPracticeExercise() {
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

  const startExercise = async () => {
    setLoading(true);
    try {
      // Get ALL questions, then randomly select
      const { data: allGapFill, error: gapError } = await supabase
        .from('question_bank')
        .select('*')
        .eq('type', 'gap_fill');

      const { data: allMultipleChoice, error: mcError } = await supabase
        .from('question_bank')
        .select('*')
        .eq('type', 'multiple_choice');

      if (gapError || mcError) throw gapError || mcError;

      // Shuffle and take 10 of each
      const shuffledGapFill = allGapFill.sort(() => Math.random() - 0.5).slice(0, 10);
      const shuffledMultipleChoice = allMultipleChoice.sort(() => Math.random() - 0.5).slice(0, 10);

      // Combine and shuffle again
      const allQuestions = [...shuffledGapFill, ...shuffledMultipleChoice].sort(() => Math.random() - 0.5);
      
      setQuestions(allQuestions);
      setStage('playing');
      setCurrentQuestionIndex(0);
      setLives(3);
      setScore(0);
      setFeedback(null);
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
    
    // Ensure correct_answers is an array and normalize all answers
    const correctAnswers = Array.isArray(currentQuestion.correct_answers) 
      ? currentQuestion.correct_answers.map(a => a.toLowerCase().trim())
      : [];
    
    console.log('Student answer:', answer);
    console.log('Correct answers:', correctAnswers);
    console.log('Match found:', correctAnswers.includes(answer));
    
    if (correctAnswers.includes(answer)) {
      isCorrect = true;
      feedbackMessage = `✅ Correct! ${currentQuestion.explanation}`;
      feedbackType = 'correct';
    } 
    // Check informal accepted
    else if (currentQuestion.informal_accepted && Array.isArray(currentQuestion.informal_accepted)) {
      const informalAnswers = currentQuestion.informal_accepted.map(a => a.toLowerCase().trim());
      if (informalAnswers.includes(answer)) {
        isCorrect = true;
        feedbackMessage = `✅ Correct! ${currentQuestion.informal_feedback} ${currentQuestion.explanation}`;
        feedbackType = 'informal';
      }
    }
    // Check acceptable alternatives
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
  } 
  else if (currentQuestion.type === 'multiple_choice') {
    if (selectedOption === currentQuestion.correct_answer) {
      isCorrect = true;
      feedbackMessage = `✅ Correct! ${currentQuestion.explanation}`;
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

  const retry = () => {
    startExercise();
  };

  const currentQuestion = questions[currentQuestionIndex];

  return (
    <div style={{ 
      maxWidth: '800px', 
      margin: '0 auto', 
      padding: '1rem',
      width: '100%',
      boxSizing: 'border-box'
    }}>
      {/* START SCREEN */}
      {stage === 'start' && (
        <div style={{ textAlign: 'center', padding: '1rem' }}>
          <h1 style={{ 
            fontSize: 'clamp(1.5rem, 5vw, 2rem)',
            color: '#2C3E50'
          }}>
            Random Practice
          </h1>
          <p style={{ 
            fontSize: 'clamp(0.9rem, 3vw, 1.1rem)',
            color: '#2C3E50'
          }}>
            Test your English with 20 random questions!
          </p>
          <p style={{ 
            fontSize: 'clamp(0.9rem, 3vw, 1.1rem)',
            color: '#2C3E50'
          }}>
            You have <strong>3 lives</strong>. Good luck!
          </p>
          <button 
            onClick={startExercise}
            disabled={loading}
            style={{
              padding: '1rem 2rem',
              fontSize: 'clamp(1rem, 3vw, 1.2rem)',
              backgroundColor: '#3498DB',
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              cursor: 'pointer',
              marginTop: '2rem',
              width: '100%',
              maxWidth: '300px'
            }}
          >
            {loading ? 'Loading...' : 'Start Practice'}
          </button>
        </div>
      )}

      {/* PLAYING SCREEN */}
      {stage === 'playing' && currentQuestion && (
        <div style={{ width: '100%', boxSizing: 'border-box' }}>
          {/* Header */}
          <div style={{ 
            display: 'flex', 
            justifyContent: 'space-between', 
            marginBottom: '1.5rem',
            fontSize: 'clamp(0.85rem, 2.5vw, 1rem)',
            gap: '0.5rem',
            flexWrap: 'wrap',
            color: '#2C3E50'
          }}>
            <div>Question {currentQuestionIndex + 1}/{questions.length}</div>
            <div>
              Lives: {Array(lives).fill('❤️').join(' ')} {Array(3 - lives).fill('🖤').join(' ')}
            </div>
            <div>Score: {score}</div>
          </div>

          {/* Question Card */}
          <div style={{ 
            backgroundColor: 'white', 
            padding: 'clamp(1rem, 3vw, 2rem)', 
            borderRadius: '12px',
            marginBottom: '1rem',
            boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
            width: '100%',
            boxSizing: 'border-box'
          }}>
            <div style={{ 
              fontSize: 'clamp(0.75rem, 2vw, 0.9rem)', 
              color: '#666', 
              marginBottom: '0.5rem' 
            }}>
              {currentQuestion.level} | {currentQuestion.topic.replace(/_/g, ' ')}
            </div>
            <h2 style={{ 
              fontSize: 'clamp(1.1rem, 4vw, 1.5rem)', 
              marginBottom: '1.5rem',
              lineHeight: '1.4',
              color: '#2C3E50',
              fontWeight: '600'
            }}>
              {currentQuestion.question}
            </h2>

            {/* Hint */}
            {showHint && currentQuestion.hint && (
              <div style={{
                backgroundColor: '#fff3cd',
                padding: '1rem',
                borderRadius: '8px',
                marginBottom: '1rem',
                border: '1px solid #ffc107',
                fontSize: 'clamp(0.85rem, 2.5vw, 1rem)',
                color: '#2C3E50'
              }}>
                💡 <strong>Hint:</strong> {currentQuestion.hint}
              </div>
            )}

            {/* GAP FILL */}
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
                    fontSize: 'clamp(1rem, 3vw, 1.1rem)',
                    borderRadius: '8px',
                    border: '2px solid #ddd',
                    marginBottom: '1rem',
                    boxSizing: 'border-box',
                    color: '#2C3E50'
                  }}
                  autoFocus
                />
              </div>
            )}

            {/* MULTIPLE CHOICE */}
            {currentQuestion.type === 'multiple_choice' && !feedback && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                {currentQuestion.options.map((option, index) => (
                  <button
                    key={index}
                    onClick={() => setSelectedOption(option)}
                    style={{
                      padding: '1rem',
                      fontSize: 'clamp(0.95rem, 3vw, 1.1rem)',
                      textAlign: 'left',
                      backgroundColor: selectedOption === option ? '#3498DB' : 'white',
                      color: selectedOption === option ? 'white' : '#2C3E50',
                      border: '2px solid #ddd',
                      borderRadius: '8px',
                      cursor: 'pointer',
                      transition: 'all 0.2s',
                      wordWrap: 'break-word',
                      width: '100%',
                      boxSizing: 'border-box'
                    }}
                  >
                    {option}
                  </button>
                ))}
              </div>
            )}

            {/* CHECK ANSWER */}
            {!feedback && (
              <button
                onClick={checkAnswer}
                disabled={
                  (currentQuestion.type === 'gap_fill' && !userAnswer.trim()) ||
                  (currentQuestion.type === 'multiple_choice' && !selectedOption)
                }
                style={{
                  padding: '1rem',
                  fontSize: 'clamp(1rem, 3vw, 1.1rem)',
                  backgroundColor: '#2C3E50',
                  color: 'white',
                  border: 'none',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  marginTop: '1rem',
                  width: '100%',
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
                  marginBottom: '1rem',
                  fontSize: 'clamp(0.9rem, 2.5vw, 1rem)',
                  lineHeight: '1.5'
                }}>
                  {feedback.message}
                </div>

                {lives > 0 && (
                  <button
                    onClick={nextQuestion}
                    style={{
                      padding: '1rem',
                      fontSize: 'clamp(1rem, 3vw, 1.1rem)',
                      backgroundColor: '#3498DB',
                      color: 'white',
                      border: 'none',
                      borderRadius: '8px',
                      cursor: 'pointer',
                      width: '100%'
                    }}
                  >
                    {currentQuestionIndex < questions.length - 1 ? 'Next Question →' : 'Finish'}
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* FINISHED SCREEN */}
      {stage === 'finished' && (
        <div style={{ textAlign: 'center', padding: '1rem' }}>
          <h1 style={{ 
            fontSize: 'clamp(1.5rem, 5vw, 2rem)',
            color: '#2C3E50'
          }}>
            Exercise Complete!
          </h1>
          <div style={{ 
            fontSize: 'clamp(2rem, 8vw, 3rem)', 
            margin: '1.5rem 0',
            color: '#2C3E50'
          }}>
            {score} / {questions.length}
          </div>
          <div style={{ 
            fontSize: 'clamp(1.2rem, 4vw, 1.5rem)', 
            marginBottom: '1.5rem',
            color: '#2C3E50'
          }}>
            {score >= 18 ? '🌟 Excellent!' : score >= 15 ? '👍 Great job!' : score >= 10 ? '👌 Good effort!' : '💪 Keep practicing!'}
          </div>

          {lives === 0 && (
            <div style={{
              backgroundColor: '#fff3cd',
              padding: '1rem',
              borderRadius: '8px',
              marginBottom: '1.5rem',
              fontSize: 'clamp(0.9rem, 3vw, 1rem)',
              color: '#2C3E50'
            }}>
              You ran out of lives! Don't worry - practice makes perfect. Try again!
            </div>
          )}

          <div style={{
            backgroundColor: 'white',
            padding: '1.5rem',
            borderRadius: '12px',
            marginBottom: '1.5rem',
            boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
          }}>
            <h3 style={{ 
              fontSize: 'clamp(1rem, 3vw, 1.2rem)',
              color: '#2C3E50'
            }}>
              How difficult was this exercise?
            </h3>
            <div style={{ display: 'flex', justifyContent: 'center', gap: '0.5rem', marginTop: '1rem' }}>
              {[1, 2, 3, 4, 5].map((rating) => (
                <button
                  key={rating}
                  onClick={() => setDifficultyRating(rating)}
                  style={{
                    fontSize: 'clamp(1.5rem, 5vw, 2rem)',
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
            <div style={{ 
              fontSize: 'clamp(0.75rem, 2vw, 0.9rem)', 
              color: '#666', 
              marginTop: '0.5rem' 
            }}>
              1 = Too easy, 5 = Very hard
            </div>
          </div>

          <button
            onClick={retry}
            style={{
              padding: '1rem 2rem',
              fontSize: 'clamp(1rem, 3vw, 1.1rem)',
              backgroundColor: '#3498DB',
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              cursor: 'pointer',
              width: '100%',
              maxWidth: '300px'
            }}
          >
            Try Again
          </button>
        </div>
      )}
    </div>
  );
}