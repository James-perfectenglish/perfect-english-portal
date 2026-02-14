import { useState, useEffect, useRef } from 'react';
import { supabase } from './supabaseClient';

const LEVELS = [
  {
    key: 'beginner',
    label: 'Beginner',
    sublabel: 'A1 – A2',
    description: 'Short, clear conversations and announcements with everyday vocabulary.',
    colour: '#48bb78',
    colourLight: '#f0fff4',
    dbLevels: ['A1', 'A2'],
    icon: '🌱'
  },
  {
    key: 'intermediate',
    label: 'Intermediate',
    sublabel: 'B1 – B2',
    description: 'Longer dialogues, workplace scenarios, and natural-speed speech.',
    colour: '#4299e1',
    colourLight: '#ebf8ff',
    dbLevels: ['B1', 'B2'],
    icon: '📘'
  },
  {
    key: 'advanced',
    label: 'Advanced',
    sublabel: 'C1 – C2',
    description: 'Complex discussions, implied meaning, and fast-paced natural speech.',
    colour: '#ed8936',
    colourLight: '#fffaf0',
    dbLevels: ['C1', 'C2'],
    icon: '🎓'
  }
];

export default function ListeningExercise({ onBack }) {
  // Navigation state
  const [stage, setStage] = useState('level-select');
  const [selectedLevel, setSelectedLevel] = useState(null);

  // Exercise list state
  const [exerciseList, setExerciseList] = useState([]);
  const [exerciseCounts, setExerciseCounts] = useState({});
  const [listLoading, setListLoading] = useState(false);

  // Individual exercise state
  const [currentExercise, setCurrentExercise] = useState(null);
  const [questions, setQuestions] = useState([]);
  const [answers, setAnswers] = useState({});
  const [submitted, setSubmitted] = useState(false);
  const [score, setScore] = useState(0);
  const [gapInputs, setGapInputs] = useState({});
  const [showTranscript, setShowTranscript] = useState(false);

  // Audio state
  const audioRef = useRef(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [playsRemaining, setPlaysRemaining] = useState(2);
  const [hasStarted, setHasStarted] = useState(false);

  // Fetch exercise counts on mount
  useEffect(() => {
    fetchCounts();
  }, []);

  const fetchCounts = async () => {
    const { data } = await supabase
      .from('listening_exercises')
      .select('level');

    if (data) {
      const counts = {};
      LEVELS.forEach(lv => {
        counts[lv.key] = data.filter(e => lv.dbLevels.includes(e.level)).length;
      });
      setExerciseCounts(counts);
    }
  };

  // =============================================
  // LEVEL SELECT
  // =============================================
  const selectLevel = (level) => {
    if ((exerciseCounts[level.key] || 0) === 0) return;
    setSelectedLevel(level);
    setStage('exercise-list');
    fetchExerciseList(level.dbLevels);
  };

  const fetchExerciseList = async (dbLevels) => {
    setListLoading(true);
    const { data, error } = await supabase
      .from('listening_exercises')
      .select('id, title, description, level, topic, duration_seconds')
      .in('level', dbLevels)
      .order('created_at', { ascending: true });

    if (data) setExerciseList(data);
    setListLoading(false);
  };

  // =============================================
  // INDIVIDUAL EXERCISE
  // =============================================
  const openExercise = async (exercise) => {
    // Fetch questions for this exercise
    const { data: qData } = await supabase
      .from('listening_questions')
      .select('*')
      .eq('listening_exercise_id', exercise.id)
      .order('question_number', { ascending: true });

    // Fetch full exercise data (including audio_url and transcript)
    const { data: fullExercise } = await supabase
      .from('listening_exercises')
      .select('*')
      .eq('id', exercise.id)
      .single();

    setCurrentExercise(fullExercise);
    setQuestions(qData || []);
    setAnswers({});
    setGapInputs({});
    setSubmitted(false);
    setScore(0);
    setShowTranscript(false);
    setIsPlaying(false);
    setCurrentTime(0);
    setDuration(0);
    setPlaysRemaining(2);
    setHasStarted(false);
    setStage('exercise');
    window.scrollTo({ top: 0, behavior: 'instant' });
  };

  // Audio controls
  const togglePlay = () => {
    if (!audioRef.current) return;

    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
    } else {
      if (!hasStarted) {
        setHasStarted(true);
      }
      audioRef.current.play();
      setIsPlaying(true);
    }
  };

  const handleAudioEnded = () => {
    setIsPlaying(false);
    setPlaysRemaining(prev => Math.max(0, prev - 1));
  };

  const handleTimeUpdate = () => {
    if (audioRef.current) {
      setCurrentTime(audioRef.current.currentTime);
    }
  };

  const handleLoadedMetadata = () => {
    if (audioRef.current) {
      setDuration(audioRef.current.duration);
    }
  };

  const replayAudio = () => {
    if (!audioRef.current || playsRemaining <= 0) return;
    audioRef.current.currentTime = 0;
    audioRef.current.play();
    setIsPlaying(true);
  };

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // Answer handling
  const selectAnswer = (questionId, answer) => {
    if (submitted) return;
    setAnswers(prev => ({ ...prev, [questionId]: answer }));
  };

  const handleGapInput = (questionId, value) => {
    if (submitted) return;
    setGapInputs(prev => ({ ...prev, [questionId]: value }));
    setAnswers(prev => ({ ...prev, [questionId]: value }));
  };

  const submitAnswers = () => {
    let correct = 0;
    questions.forEach(q => {
      const userAnswer = (answers[q.id] || '').toLowerCase().trim();
      if (q.type === 'gap_fill') {
        const correctAnswers = q.correct_answers
          ? (Array.isArray(q.correct_answers) ? q.correct_answers : JSON.parse(q.correct_answers))
          : [q.correct_answer];
        if (correctAnswers.map(a => a.toLowerCase().trim()).includes(userAnswer)) {
          correct++;
        }
      } else {
        if (userAnswer === (q.correct_answer || '').toLowerCase().trim()) {
          correct++;
        }
      }
    });
    setScore(correct);
    setSubmitted(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const allAnswered = questions.length > 0 && questions.every(q => {
    const a = answers[q.id];
    return a && a.trim() !== '';
  });

  // Navigation
  const backToLevelSelect = () => {
    window.scrollTo({ top: 0, behavior: 'instant' });
    setSelectedLevel(null);
    setExerciseList([]);
    setStage('level-select');
    fetchCounts();
  };

  const backToExerciseList = () => {
    window.scrollTo({ top: 0, behavior: 'instant' });
    setCurrentExercise(null);
    setQuestions([]);
    setStage('exercise-list');
    if (audioRef.current) {
      audioRef.current.pause();
    }
  };

  // =============================================
  // RENDER: LEVEL SELECT
  // =============================================
  if (stage === 'level-select') {
    return (
      <div style={{ maxWidth: '800px', margin: '0 auto' }}>
        <div style={{
          background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
          borderRadius: '12px 12px 0 0',
          padding: '2.5rem 2rem 2rem',
          textAlign: 'center',
          color: 'white',
          position: 'relative'
        }}>
          <h1 style={{ margin: 0, fontSize: '1.8rem' }}>Listening Exercises</h1>
          <p style={{ margin: '8px 0 0', opacity: 0.9 }}>
            Practise your listening skills with audio exercises
          </p>
        </div>

        <div style={{
          background: 'white',
          padding: '2rem',
          borderRadius: '0 0 12px 12px',
          boxShadow: '0 10px 40px rgba(0,0,0,0.15)'
        }}>
          <h2 style={{
            color: '#2d3748', fontSize: '1.15rem', fontWeight: 600,
            margin: '0 0 6px', textAlign: 'center'
          }}>Choose your level</h2>
          <p style={{
            color: '#718096', fontSize: '0.9rem',
            margin: '0 0 24px', textAlign: 'center'
          }}>Select a difficulty to see available exercises</p>

          <div style={{ display: 'grid', gap: '16px' }}>
            {LEVELS.map(level => {
              const count = exerciseCounts[level.key] || 0;
              const available = count > 0;

              return (
                <div
                  key={level.key}
                  onClick={() => available && selectLevel(level)}
                  style={{
                    border: `2px solid ${available ? level.colour : '#e2e8f0'}`,
                    borderRadius: '12px',
                    padding: '1.25rem 1.5rem',
                    cursor: available ? 'pointer' : 'default',
                    background: available ? level.colourLight : '#f9fafb',
                    opacity: available ? 1 : 0.55,
                    transition: 'transform 0.15s ease, box-shadow 0.15s ease',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '1rem'
                  }}
                  onMouseEnter={e => {
                    if (available) {
                      e.currentTarget.style.transform = 'translateY(-2px)';
                      e.currentTarget.style.boxShadow = `0 4px 16px ${level.colour}30`;
                    }
                  }}
                  onMouseLeave={e => {
                    e.currentTarget.style.transform = 'none';
                    e.currentTarget.style.boxShadow = 'none';
                  }}
                >
                  <div style={{ fontSize: '2rem', flexShrink: 0 }}>{level.icon}</div>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                      <span style={{ fontSize: '1.1rem', fontWeight: 700, color: '#2d3748' }}>
                        {level.label}
                      </span>
                      <span style={{
                        background: available ? level.colour : '#a0aec0',
                        color: 'white', padding: '2px 10px', borderRadius: '20px',
                        fontSize: '0.8rem', fontWeight: 600
                      }}>{level.sublabel}</span>
                    </div>
                    <p style={{ margin: '4px 0 0', fontSize: '0.88rem', color: '#4a5568', lineHeight: 1.4 }}>
                      {level.description}
                    </p>
                    <span style={{
                      display: 'inline-block', marginTop: '6px', fontSize: '0.8rem',
                      color: available ? '#4a5568' : '#a0aec0', fontWeight: 500
                    }}>
                      {available ? `${count} exercise${count !== 1 ? 's' : ''} available` : 'Coming soon'}
                    </span>
                  </div>
                  {available && (
                    <div style={{ fontSize: '1.3rem', color: level.colour, flexShrink: 0 }}>→</div>
                  )}
                </div>
              );
            })}
          </div>

          {onBack && (
            <div style={{ textAlign: 'center', marginTop: '24px' }}>
              <button onClick={onBack} style={{
                padding: '10px 24px', background: 'transparent', color: '#718096',
                border: '1px solid #e2e8f0', borderRadius: '6px', fontWeight: 500,
                cursor: 'pointer', fontSize: '0.95rem'
              }}>
                ← Back to Exercises
              </button>
            </div>
          )}
        </div>
      </div>
    );
  }

  // =============================================
  // RENDER: EXERCISE LIST
  // =============================================
  if (stage === 'exercise-list') {
    return (
      <div style={{ maxWidth: '800px', margin: '0 auto' }}>
        <div style={{
          background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
          borderRadius: '12px 12px 0 0',
          padding: '2.5rem 2rem 2rem',
          textAlign: 'center',
          color: 'white',
          position: 'relative'
        }}>
          <h1 style={{ margin: 0, fontSize: '1.8rem' }}>Listening Exercises</h1>
          <p style={{ margin: '8px 0 0', opacity: 0.9 }}>
            Choose an exercise to start listening
          </p>
          {selectedLevel && (
            <span style={{
              display: 'inline-block', background: selectedLevel.colour,
              padding: '4px 12px', borderRadius: '20px', fontSize: '0.85rem',
              fontWeight: 600, marginTop: '8px'
            }}>Level: {selectedLevel.sublabel}</span>
          )}
        </div>

        <div style={{
          background: 'white', padding: '2rem',
          borderRadius: '0 0 12px 12px', boxShadow: '0 10px 40px rgba(0,0,0,0.15)'
        }}>
          {listLoading && (
            <div style={{ textAlign: 'center', padding: '3rem 1rem', color: '#666' }}>
              Loading exercises...
            </div>
          )}

          {!listLoading && exerciseList.length === 0 && (
            <div style={{ textAlign: 'center', padding: '2rem' }}>
              <div style={{ fontSize: '2.5rem', marginBottom: '0.75rem' }}>🎧</div>
              <h2 style={{ color: '#2C3E50', marginBottom: '0.5rem' }}>Coming Soon!</h2>
              <p style={{ color: '#666' }}>Listening exercises for this level are being added. Check back soon!</p>
            </div>
          )}

          {!listLoading && exerciseList.length > 0 && (
            <div style={{ display: 'grid', gap: '12px' }}>
              {exerciseList.map(exercise => (
                <div
                  key={exercise.id}
                  onClick={() => openExercise(exercise)}
                  style={{
                    border: '2px solid #e2e8f0',
                    borderRadius: '12px',
                    padding: '1.25rem',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '1rem'
                  }}
                  onMouseEnter={e => {
                    e.currentTarget.style.borderColor = selectedLevel.colour;
                    e.currentTarget.style.transform = 'translateY(-1px)';
                    e.currentTarget.style.boxShadow = '0 2px 8px rgba(0,0,0,0.08)';
                  }}
                  onMouseLeave={e => {
                    e.currentTarget.style.borderColor = '#e2e8f0';
                    e.currentTarget.style.transform = 'none';
                    e.currentTarget.style.boxShadow = 'none';
                  }}
                >
                  <div style={{
                    width: '48px', height: '48px', borderRadius: '10px',
                    background: `${selectedLevel.colourLight}`,
                    border: `1px solid ${selectedLevel.colour}30`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: '1.4rem', flexShrink: 0
                  }}>
                    🎧
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 700, color: '#2d3748', fontSize: '1rem', marginBottom: '2px' }}>
                      {exercise.title}
                    </div>
                    <div style={{ fontSize: '0.85rem', color: '#718096', lineHeight: 1.4 }}>
                      {exercise.description}
                    </div>
                    <div style={{ display: 'flex', gap: '12px', marginTop: '6px', fontSize: '0.78rem', color: '#a0aec0' }}>
                      <span>{exercise.level}</span>
                      {exercise.duration_seconds && (
                        <span>{Math.ceil(exercise.duration_seconds / 60)} min</span>
                      )}
                    </div>
                  </div>
                  <div style={{ fontSize: '1.3rem', color: '#cbd5e0', flexShrink: 0 }}>→</div>
                </div>
              ))}
            </div>
          )}

          <div style={{ textAlign: 'center', marginTop: '24px' }}>
            <button onClick={backToLevelSelect} style={{
              padding: '10px 24px', background: 'transparent', color: '#718096',
              border: '1px solid #e2e8f0', borderRadius: '6px', fontWeight: 500,
              cursor: 'pointer', fontSize: '0.95rem'
            }}>
              ← Change Level
            </button>
          </div>
        </div>
      </div>
    );
  }

  // =============================================
  // RENDER: INDIVIDUAL EXERCISE
  // =============================================
  if (stage === 'exercise' && currentExercise) {
    const progressPercent = duration > 0 ? (currentTime / duration) * 100 : 0;

    return (
      <div style={{ maxWidth: '800px', margin: '0 auto' }}>
        {/* Header */}
        <div style={{
          background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
          borderRadius: '12px 12px 0 0',
          padding: '2.5rem 2rem 2rem',
          textAlign: 'center',
          color: 'white',
          position: 'relative'
        }}>
          <h1 style={{ margin: 0, fontSize: '1.8rem' }}>{currentExercise.title}</h1>
          <p style={{ margin: '8px 0 0', opacity: 0.9 }}>{currentExercise.description}</p>
          {selectedLevel && (
            <span style={{
              display: 'inline-block', background: selectedLevel.colour,
              padding: '4px 12px', borderRadius: '20px', fontSize: '0.85rem',
              fontWeight: 600, marginTop: '8px'
            }}>Level: {currentExercise.level}</span>
          )}
        </div>

        {/* Content */}
        <div style={{
          background: 'white', padding: '2rem',
          borderRadius: '0 0 12px 12px', boxShadow: '0 10px 40px rgba(0,0,0,0.15)'
        }}>
          {/* Audio Player */}
          <div style={{
            background: '#f7fafc', borderRadius: '12px',
            padding: '1.5rem', marginBottom: '1.5rem',
            border: '1px solid #e2e8f0'
          }}>
            <audio
              ref={audioRef}
              src={currentExercise.audio_url}
              onEnded={handleAudioEnded}
              onTimeUpdate={handleTimeUpdate}
              onLoadedMetadata={handleLoadedMetadata}
              preload="metadata"
            />

            {/* Play/Replay controls */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1rem' }}>
              <button
                onClick={!hasStarted || !isPlaying ? togglePlay : togglePlay}
                disabled={hasStarted && !isPlaying && playsRemaining <= 0}
                style={{
                  width: '52px', height: '52px', borderRadius: '50%',
                  background: (hasStarted && !isPlaying && playsRemaining <= 0)
                    ? '#cbd5e0'
                    : 'linear-gradient(135deg, #667eea, #764ba2)',
                  color: 'white', border: 'none', fontSize: '1.3rem',
                  cursor: (hasStarted && !isPlaying && playsRemaining <= 0) ? 'not-allowed' : 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  flexShrink: 0
                }}
              >
                {isPlaying ? '⏸' : '▶'}
              </button>

              <div style={{ flex: 1 }}>
                {/* Progress bar */}
                <div style={{
                  width: '100%', height: '6px', background: '#e2e8f0',
                  borderRadius: '3px', overflow: 'hidden', marginBottom: '6px'
                }}>
                  <div style={{
                    width: `${progressPercent}%`, height: '100%',
                    background: 'linear-gradient(135deg, #667eea, #764ba2)',
                    borderRadius: '3px', transition: 'width 0.3s'
                  }} />
                </div>
                <div style={{
                  display: 'flex', justifyContent: 'space-between',
                  fontSize: '0.78rem', color: '#718096'
                }}>
                  <span>{formatTime(currentTime)}</span>
                  <span>{duration > 0 ? formatTime(duration) : '--:--'}</span>
                </div>
              </div>
            </div>

            {/* Listen count + replay */}
            <div style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              fontSize: '0.85rem', color: '#718096'
            }}>
              <span>
                {playsRemaining > 0
                  ? `${playsRemaining} listen${playsRemaining !== 1 ? 's' : ''} remaining`
                  : 'No listens remaining'}
              </span>
              {hasStarted && !isPlaying && playsRemaining > 0 && (
                <button onClick={replayAudio} style={{
                  padding: '6px 14px', background: '#667eea', color: 'white',
                  border: 'none', borderRadius: '6px', fontSize: '0.85rem',
                  fontWeight: 600, cursor: 'pointer'
                }}>
                  Listen Again
                </button>
              )}
            </div>
          </div>

          {/* Results banner */}
          {submitted && (
            <div style={{
              background: score >= Math.ceil(questions.length * 0.7) ? '#f0fff4' : '#fff5f5',
              border: `2px solid ${score >= Math.ceil(questions.length * 0.7) ? '#48bb78' : '#f56565'}`,
              borderRadius: '8px', padding: '1.25rem', marginBottom: '1.5rem',
              textAlign: 'center'
            }}>
              <div style={{ fontSize: '2rem', marginBottom: '0.25rem' }}>
                {score >= questions.length ? '🏆' : score >= Math.ceil(questions.length * 0.7) ? '⭐' : '💪'}
              </div>
              <div style={{
                fontSize: '1.5rem', fontWeight: 700,
                color: score >= Math.ceil(questions.length * 0.7) ? '#48bb78' : '#f56565'
              }}>
                {score}/{questions.length}
              </div>
              <p style={{ color: '#4a5568', margin: '4px 0 0', fontSize: '0.95rem' }}>
                {score >= questions.length
                  ? 'Perfect! Excellent listening!'
                  : score >= Math.ceil(questions.length * 0.7)
                  ? 'Well done! Strong listening skills.'
                  : 'Keep practising — try listening again for the details you missed.'}
              </p>
            </div>
          )}

          {/* Questions */}
          {questions.map((q, idx) => {
            const userAnswer = (answers[q.id] || '').toLowerCase().trim();
            const isCorrect = (() => {
              if (q.type === 'gap_fill') {
                const correctAnswers = q.correct_answers
                  ? (Array.isArray(q.correct_answers) ? q.correct_answers : JSON.parse(q.correct_answers))
                  : [q.correct_answer];
                return correctAnswers.map(a => a.toLowerCase().trim()).includes(userAnswer);
              }
              return userAnswer === (q.correct_answer || '').toLowerCase().trim();
            })();

            return (
              <div key={q.id} style={{
                border: `2px solid ${submitted ? (isCorrect ? '#48bb78' : '#f56565') : '#e2e8f0'}`,
                background: submitted ? (isCorrect ? '#f0fff4' : '#fff5f5') : 'white',
                borderRadius: '8px', padding: '1.5rem', marginBottom: '1rem'
              }}>
                <div style={{
                  fontWeight: 700, color: '#667eea',
                  fontSize: '0.85rem', marginBottom: '8px'
                }}>
                  Question {q.question_number}
                </div>
                <div style={{
                  fontSize: '1.05rem', color: '#2d3748',
                  marginBottom: '12px', lineHeight: 1.6
                }}>
                  {q.question}
                </div>

                {/* Multiple choice / True-false options */}
                {(q.type === 'multiple_choice' || q.type === 'true_false') && (
                  <div style={{
                    display: 'grid',
                    gridTemplateColumns: q.type === 'true_false' ? '1fr 1fr' : 'repeat(auto-fit, minmax(140px, 1fr))',
                    gap: '10px'
                  }}>
                    {(Array.isArray(q.options) ? q.options : JSON.parse(q.options || '[]')).map(opt => {
                      const selected = answers[q.id] === opt;
                      let bg = '#f7fafc', border = '#e2e8f0', color = '#2d3748';

                      if (submitted) {
                        if (opt.toLowerCase().trim() === (q.correct_answer || '').toLowerCase().trim()) {
                          bg = '#48bb78'; border = '#48bb78'; color = 'white';
                        } else if (selected) {
                          bg = '#f56565'; border = '#f56565'; color = 'white';
                        }
                      } else if (selected) {
                        bg = '#667eea'; border = '#667eea'; color = 'white';
                      }

                      return (
                        <button
                          key={opt}
                          onClick={() => selectAnswer(q.id, opt)}
                          disabled={submitted}
                          style={{
                            padding: '10px', background: bg, border: `2px solid ${border}`,
                            borderRadius: '6px', color, cursor: submitted ? 'default' : 'pointer',
                            fontWeight: 500, fontSize: '0.95rem', transition: 'all 0.2s'
                          }}
                        >
                          {opt}
                        </button>
                      );
                    })}
                  </div>
                )}

                {/* Gap fill input */}
                {q.type === 'gap_fill' && (
                  <input
                    type="text"
                    value={gapInputs[q.id] || ''}
                    onChange={(e) => handleGapInput(q.id, e.target.value)}
                    disabled={submitted}
                    placeholder="Type your answer..."
                    style={{
                      width: '100%', padding: '10px 14px', fontSize: '1rem',
                      border: `2px solid ${submitted ? (isCorrect ? '#48bb78' : '#f56565') : '#e2e8f0'}`,
                      borderRadius: '6px', boxSizing: 'border-box', color: '#2d3748',
                      backgroundColor: submitted ? (isCorrect ? '#f0fff4' : '#fff5f5') : 'white'
                    }}
                  />
                )}

                {/* Feedback after submit */}
                {submitted && (
                  <div style={{
                    marginTop: '10px', padding: '10px', borderRadius: '6px',
                    background: isCorrect ? '#c6f6d5' : '#fed7d7',
                    color: isCorrect ? '#22543d' : '#742a2a',
                    borderLeft: `4px solid ${isCorrect ? '#48bb78' : '#f56565'}`,
                    fontSize: '0.9rem', lineHeight: 1.5
                  }}>
                    <strong>{isCorrect ? '✓ Correct!' : `✗ Incorrect — ${q.correct_answer}`}</strong>
                    {q.explanation && <><br />{q.explanation}</>}
                  </div>
                )}
              </div>
            );
          })}

          {/* Submit / Transcript / Navigation */}
          <div style={{ marginTop: '1rem' }}>
            {!submitted && questions.length > 0 && (
              <button
                onClick={submitAnswers}
                disabled={!allAnswered}
                style={{
                  width: '100%', padding: '1rem', fontSize: '1rem',
                  background: allAnswered
                    ? 'linear-gradient(135deg, #667eea, #764ba2)'
                    : '#cbd5e0',
                  color: 'white', border: 'none', borderRadius: '10px',
                  cursor: allAnswered ? 'pointer' : 'not-allowed',
                  fontWeight: 600
                }}
              >
                Submit Answers
              </button>
            )}

            {/* Transcript toggle */}
            {submitted && currentExercise.transcript && (
              <div style={{ marginTop: '1rem' }}>
                <button
                  onClick={() => setShowTranscript(!showTranscript)}
                  style={{
                    width: '100%', padding: '0.75rem', fontSize: '0.95rem',
                    background: '#f7fafc', color: '#4a5568', border: '1px solid #e2e8f0',
                    borderRadius: '8px', cursor: 'pointer', fontWeight: 500
                  }}
                >
                  {showTranscript ? 'Hide Transcript' : 'Show Transcript'}
                </button>

                {showTranscript && (
                  <div style={{
                    marginTop: '0.75rem', padding: '1.25rem', background: '#f7fafc',
                    borderRadius: '8px', border: '1px solid #e2e8f0',
                    fontSize: '0.95rem', color: '#2d3748', lineHeight: 1.7,
                    whiteSpace: 'pre-wrap'
                  }}>
                    {currentExercise.transcript}
                  </div>
                )}
              </div>
            )}

            {/* Navigation buttons */}
            {submitted && (
              <div style={{
                display: 'flex', gap: '12px', justifyContent: 'center',
                flexWrap: 'wrap', marginTop: '1.5rem'
              }}>
                <button onClick={() => openExercise(currentExercise)} style={{
                  padding: '10px 24px', background: '#667eea', color: 'white',
                  border: 'none', borderRadius: '6px', fontWeight: 600,
                  cursor: 'pointer', fontSize: '1rem'
                }}>
                  Try Again
                </button>
                <button onClick={backToExerciseList} style={{
                  padding: '10px 24px', background: '#4a5568', color: 'white',
                  border: 'none', borderRadius: '6px', fontWeight: 600,
                  cursor: 'pointer', fontSize: '1rem'
                }}>
                  More Exercises
                </button>
                {onBack && (
                  <button onClick={onBack} style={{
                    padding: '10px 24px', background: 'transparent', color: '#718096',
                    border: '1px solid #e2e8f0', borderRadius: '6px', fontWeight: 500,
                    cursor: 'pointer', fontSize: '1rem'
                  }}>
                    Back to Exercises
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  return null;
}
