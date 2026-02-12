import { useState, useEffect } from 'react';
import { supabase } from './supabaseClient';
import SentenceBuildingInput from './components/SentenceBuildingInput';

function shuffleArray(arr) {
  const shuffled = [...arr];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

export default function SentenceBuilding({ onBack, onComplete }) {
  const [questions, setQuestions] = useState([]);
  const [currentQ, setCurrentQ] = useState(0);
  const [score, setScore] = useState(0);
  const [feedback, setFeedback] = useState(null);
  const [stage, setStage] = useState('loading');
  const [hasAnswer, setHasAnswer] = useState(false);

  useEffect(() => {
    fetchQuestions();
  }, []);

  const fetchQuestions = async () => {
    const { data, error } = await supabase
      .from('question_bank')
      .select('*')
      .eq('type', 'sentence_building');

    if (error) {
      console.error('Error fetching questions:', error);
      setStage('playing');
      return;
    }

    if (data && data.length > 0) {
      const translation = shuffleArray(data.filter(q => q.question && q.question.trim() !== ''));
      const build = shuffleArray(data.filter(q => !q.question || q.question.trim() === ''));

      const selectedTranslation = translation.slice(0, 5);
      const selectedBuild = build.slice(0, 5);
      let combined = shuffleArray([...selectedTranslation, ...selectedBuild]);

      if (combined.length < 10) {
        const usedIds = new Set(combined.map(q => q.id));
        const remaining = shuffleArray(data.filter(q => !usedIds.has(q.id)));
        combined.push(...remaining.slice(0, 10 - combined.length));
      }

      setQuestions(combined.slice(0, 10));
    }
    setStage('playing');
  };

  const handleResult = (isCorrect, isSoft = false) => {
    const q = questions[currentQ];
    if (isCorrect && !isSoft) {
      setScore(s => s + 1);
      setFeedback({
        correct: true,
        message: `✅ Correct! ${q.explanation || ''}`
      });
    } else if (isCorrect && isSoft) {
      setScore(s => s + 1); // still counts as correct
      setFeedback({
        correct: true,
        message: `✅ You got the words right — but don't forget your punctuation! Score counted. ${q.explanation || ''}`
      });
    } else {
      const correctSentences = Array.isArray(q.correct_answers) ? q.correct_answers : JSON.parse(q.correct_answers || '[]');
      const displaySentence = (correctSentences[0] || '')
        .replace(/ ([.,?!;:])/g, '$1')
        .replace(/^(\w)/, m => m.toUpperCase());
      setFeedback({
        correct: false,
        message: `❌ Not quite. The correct answer is: "${displaySentence}" — ${q.explanation || ''}`
      });
    }
  };

  const nextQuestion = () => {
    window.scrollTo({ top: 0, behavior: 'instant' });
    if (currentQ + 1 >= questions.length) {
      setStage('finished');
    } else {
      setCurrentQ(c => c + 1);
      setFeedback(null);
      setHasAnswer(false);
    }
  };

  const restartExercise = () => {
    window.scrollTo({ top: 0, behavior: 'instant' });
    setCurrentQ(0);
    setScore(0);
    setFeedback(null);
    setHasAnswer(false);
    setStage('loading');
    fetchQuestions();
  };

  const q = questions[currentQ];

  const getQuestionProps = (question) => {
    if (!question) return {};
    const options = Array.isArray(question.options) ? question.options : JSON.parse(question.options || '[]');
    const correctSentences = Array.isArray(question.correct_answers) ? question.correct_answers : JSON.parse(question.correct_answers || '[]');
    const hasPrompt = question.question && question.question.trim() !== '';

    return {
      words: options,
      questionType: hasPrompt ? 'translation' : 'build',
      prompt: hasPrompt ? question.question : null,
      correctSentences,
      explanation: question.explanation || ''
    };
  };

  return (
    <div style={{
      width: '100%',
      minHeight: '100vh',
      backgroundColor: '#f8f9fa',
      boxSizing: 'border-box'
    }}>
      {/* HEADER */}
      <div style={{
        background: 'linear-gradient(135deg, #667eea, #764ba2)',
        padding: 'clamp(1.5rem, 5vw, 2.5rem) 1rem clamp(1.25rem, 4vw, 2rem)',
        textAlign: 'center',
        color: 'white',
      }}>
        <h1 style={{
          fontSize: 'clamp(1.5rem, 5vw, 2rem)',
          fontWeight: '700',
          margin: '0 0 0.3rem'
        }}>
          Sentence Building
        </h1>
        <p style={{
          fontSize: 'clamp(0.85rem, 2.5vw, 1rem)',
          margin: 0,
          opacity: 0.9
        }}>
          Drag the words into the correct order to build sentences
        </p>
      </div>

      <div style={{ padding: '1rem', maxWidth: '700px', margin: '0 auto', boxSizing: 'border-box' }}>

        {stage === 'loading' && (
          <div style={{ textAlign: 'center', padding: '3rem 1rem', color: '#666' }}>
            Loading questions...
          </div>
        )}

        {stage === 'playing' && questions.length === 0 && (
          <div style={{
            backgroundColor: 'white',
            borderRadius: '16px',
            boxShadow: '0 2px 12px rgba(0,0,0,0.06)',
            padding: '2rem',
            textAlign: 'center'
          }}>
            <div style={{ fontSize: '2.5rem', marginBottom: '0.75rem' }}>📝</div>
            <h2 style={{ color: '#2C3E50', marginBottom: '0.5rem' }}>Coming Soon!</h2>
            <p style={{ color: '#666' }}>Sentence building questions are being added. Check back soon!</p>
            {onBack && (
              <button onClick={onBack} style={{
                marginTop: '1rem', padding: '0.75rem 1.5rem',
                background: 'linear-gradient(135deg, #667eea, #764ba2)',
                color: 'white', border: 'none', borderRadius: '8px',
                cursor: 'pointer', fontWeight: '600'
              }}>
                ← Back to Exercises
              </button>
            )}
          </div>
        )}

        {stage === 'playing' && q && (
          <>
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: '1rem',
              fontSize: 'clamp(0.85rem, 2.5vw, 0.95rem)',
              color: '#666',
              fontWeight: '500'
            }}>
              <span>Question {currentQ + 1} of {questions.length}</span>
              <span>Score: {score}/{questions.length}</span>
            </div>

            <div style={{
              width: '100%',
              height: '6px',
              backgroundColor: '#e2e8f0',
              borderRadius: '3px',
              marginBottom: '1.25rem',
              overflow: 'hidden'
            }}>
              <div style={{
                width: `${((currentQ) / questions.length) * 100}%`,
                height: '100%',
                background: 'linear-gradient(135deg, #667eea, #764ba2)',
                borderRadius: '3px',
                transition: 'width 0.3s ease'
              }} />
            </div>

            <div style={{
              backgroundColor: 'white',
              borderRadius: '16px',
              boxShadow: '0 2px 12px rgba(0,0,0,0.06)',
              padding: 'clamp(1.25rem, 4vw, 2rem)',
              boxSizing: 'border-box'
            }}>
              <SentenceBuildingInput
                key={currentQ}
                {...getQuestionProps(q)}
                disabled={!!feedback}
                onResult={handleResult}
                feedback={feedback}
                showCheckButton={true}
                onAnswerReady={setHasAnswer}
              />

              {feedback && (
                <button
                  onClick={nextQuestion}
                  style={{
                    width: '100%',
                    padding: '1rem',
                    marginTop: '0.75rem',
                    fontSize: 'clamp(1rem, 3.5vw, 1.15rem)',
                    background: 'linear-gradient(135deg, #667eea, #764ba2)',
                    color: 'white',
                    border: 'none',
                    borderRadius: '10px',
                    cursor: 'pointer',
                    fontWeight: '600'
                  }}
                >
                  {currentQ + 1 >= questions.length ? 'See Results' : 'Next Question →'}
                </button>
              )}
            </div>
          </>
        )}

        {stage === 'finished' && (
          <div style={{
            backgroundColor: 'white',
            borderRadius: '16px',
            boxShadow: '0 2px 12px rgba(0,0,0,0.06)',
            padding: 'clamp(2rem, 6vw, 3rem)',
            textAlign: 'center',
            marginTop: '1rem'
          }}>
            <div style={{ fontSize: '3rem', marginBottom: '0.5rem' }}>
              {score >= 9 ? '🏆' : score >= 7 ? '⭐' : score >= 5 ? '👍' : '💪'}
            </div>
            <h2 style={{
              fontSize: 'clamp(1.5rem, 5vw, 2rem)',
              color: '#2C3E50',
              marginBottom: '1rem',
              fontWeight: '700'
            }}>
              Exercise Complete!
            </h2>

            <div style={{
              fontSize: 'clamp(2.5rem, 10vw, 3.5rem)',
              fontWeight: '700',
              color: score >= 7 ? '#27ae60' : score >= 5 ? '#f39c12' : '#e74c3c',
              margin: '1rem 0'
            }}>
              {score}/{questions.length}
            </div>

            <div style={{
              fontSize: 'clamp(1rem, 3vw, 1.15rem)',
              color: '#666',
              marginBottom: '2rem'
            }}>
              {score >= 9 ? 'Outstanding! Perfect sentence construction.' :
               score >= 7 ? 'Great work! Your sentence building is strong.' :
               score >= 5 ? 'Good effort. Keep practising to improve.' :
               'Keep going — practice makes perfect!'}
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', alignItems: 'center' }}>
              <button
                onClick={restartExercise}
                style={{
                  padding: '1rem 2.5rem',
                  fontSize: 'clamp(1rem, 3.5vw, 1.15rem)',
                  background: 'linear-gradient(135deg, #667eea, #764ba2)',
                  color: 'white',
                  border: 'none',
                  borderRadius: '10px',
                  cursor: 'pointer',
                  fontWeight: '600',
                  width: '100%',
                  maxWidth: '300px'
                }}
              >
                Try Again
              </button>

              {onBack && (
                <button
                  onClick={onBack}
                  style={{
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
                  ← Back to Exercises
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
