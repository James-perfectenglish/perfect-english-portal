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

// Playback speed by level
const getPlaybackSpeed = (level) => {
  if (!level) return 1;
  if (level.startsWith('A')) return 0.85;
  if (level.startsWith('B')) return 0.95;
  if (level.startsWith('C')) return 1.05;
  return 1;
};

export default function ListeningExercise({ onBack }) {
  // Navigation
  const [stage, setStage] = useState('level-select');
  const [selectedLevel, setSelectedLevel] = useState(null);

  // Exercise list
  const [exerciseList, setExerciseList] = useState([]);
  const [exerciseCounts, setExerciseCounts] = useState({});
  const [listLoading, setListLoading] = useState(false);

  // Individual exercise
  const [currentExercise, setCurrentExercise] = useState(null);
  const [gistQuestions, setGistQuestions] = useState([]);
  const [detailQuestions, setDetailQuestions] = useState([]);

  // Exercise stage: intro → gist → detail → review
  const [exerciseStage, setExerciseStage] = useState('intro');

  // Answers
  const [gistAnswers, setGistAnswers] = useState({});
  const [detailAnswers, setDetailAnswers] = useState({});
  const [gapInputs, setGapInputs] = useState({});
  const [gistSubmitted, setGistSubmitted] = useState(false);
  const [detailSubmitted, setDetailSubmitted] = useState(false);
  const [showTranscript, setShowTranscript] = useState(false);

  // Audio
  const audioRef = useRef(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);

  // Fetch counts on mount
  useEffect(() => { fetchCounts(); }, []);

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

  // ── Level select ──
  const selectLevel = (level) => {
    if ((exerciseCounts[level.key] || 0) === 0) return;
    setSelectedLevel(level);
    setStage('exercise-list');
    fetchExerciseList(level.dbLevels);
  };

  const fetchExerciseList = async (dbLevels) => {
    setListLoading(true);
    const { data } = await supabase
      .from('listening_exercises')
      .select('id, title, description, level, topic, duration_seconds, image_url')
      .in('level', dbLevels)
      .order('created_at', { ascending: true });
    if (data) setExerciseList(data);
    setListLoading(false);
  };

  // ── Open exercise ──
  const openExercise = async (exercise) => {
    const { data: fullExercise } = await supabase
      .from('listening_exercises')
      .select('*')
      .eq('id', exercise.id)
      .single();

    const { data: qData } = await supabase
      .from('listening_questions')
      .select('*')
      .eq('listening_exercise_id', exercise.id)
      .order('question_number', { ascending: true });

    setCurrentExercise(fullExercise);
    setGistQuestions((qData || []).filter(q => q.stage === 'gist'));
    setDetailQuestions((qData || []).filter(q => q.stage === 'detail'));
    setGistAnswers({});
    setDetailAnswers({});
    setGapInputs({});
    setGistSubmitted(false);
    setDetailSubmitted(false);
    setShowTranscript(false);
    setIsPlaying(false);
    setCurrentTime(0);
    setDuration(0);
    setExerciseStage('intro');
    setStage('exercise');
    window.scrollTo({ top: 0, behavior: 'instant' });
  };

  // ── Audio ──
  const togglePlay = () => {
    if (!audioRef.current) return;
    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
    } else {
      audioRef.current.playbackRate = getPlaybackSpeed(currentExercise?.level);
      audioRef.current.play();
      setIsPlaying(true);
    }
  };

  const replayFromStart = () => {
    if (!audioRef.current) return;
    audioRef.current.currentTime = 0;
    audioRef.current.playbackRate = getPlaybackSpeed(currentExercise?.level);
    audioRef.current.play();
    setIsPlaying(true);
  };

  const handleAudioEnded = () => { setIsPlaying(false); };
  const handleTimeUpdate = () => {
    if (audioRef.current) setCurrentTime(audioRef.current.currentTime);
  };
  const handleLoadedMetadata = () => {
    if (audioRef.current) setDuration(audioRef.current.duration);
  };

  const formatTime = (s) => {
    const m = Math.floor(s / 60);
    const sec = Math.floor(s % 60);
    return `${m}:${sec.toString().padStart(2, '0')}`;
  };

  // ── Answer handling ──
  const selectGistAnswer = (qId, answer) => {
    if (gistSubmitted) return;
    setGistAnswers(prev => ({ ...prev, [qId]: answer }));
  };

  const selectDetailAnswer = (qId, answer) => {
    if (detailSubmitted) return;
    setDetailAnswers(prev => ({ ...prev, [qId]: answer }));
  };

  const handleDetailGapInput = (qId, value) => {
    if (detailSubmitted) return;
    setGapInputs(prev => ({ ...prev, [qId]: value }));
    setDetailAnswers(prev => ({ ...prev, [qId]: value }));
  };

  const isAnswerCorrect = (q, userAnswer) => {
    const ua = (userAnswer || '').toLowerCase().trim();
    if (q.type === 'gap_fill') {
      const correct = q.correct_answers
        ? (Array.isArray(q.correct_answers) ? q.correct_answers : JSON.parse(q.correct_answers))
        : [q.correct_answer];
      return correct.map(a => a.toLowerCase().trim()).includes(ua);
    }
    return ua === (q.correct_answer || '').toLowerCase().trim();
  };

  const submitGist = () => {
    setGistSubmitted(true);
  };

  const submitDetail = () => {
    setDetailSubmitted(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const moveToDetail = () => {
    setExerciseStage('detail');
    setIsPlaying(false);
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
    }
    window.scrollTo({ top: 0, behavior: 'instant' });
  };

  const moveToReview = () => {
    setExerciseStage('review');
    window.scrollTo({ top: 0, behavior: 'instant' });
  };

  // Score calculation
  const totalQuestions = gistQuestions.length + detailQuestions.length;
  const gistCorrect = gistQuestions.filter(q => isAnswerCorrect(q, gistAnswers[q.id])).length;
  const detailCorrect = detailQuestions.filter(q => isAnswerCorrect(q, detailAnswers[q.id])).length;
  const totalCorrect = gistCorrect + detailCorrect;

  // Navigation
  const backToLevelSelect = () => {
    window.scrollTo({ top: 0, behavior: 'instant' });
    setSelectedLevel(null);
    setExerciseList([]);
    setStage('level-select');
    if (audioRef.current) audioRef.current.pause();
    fetchCounts();
  };

  const backToExerciseList = () => {
    window.scrollTo({ top: 0, behavior: 'instant' });
    setCurrentExercise(null);
    setStage('exercise-list');
    if (audioRef.current) audioRef.current.pause();
  };

  // Gist all answered?
  const gistAllAnswered = gistQuestions.length > 0 &&
    gistQuestions.every(q => gistAnswers[q.id] && gistAnswers[q.id].trim() !== '');

  // Detail all answered?
  const detailAllAnswered = detailQuestions.length > 0 &&
    detailQuestions.every(q => detailAnswers[q.id] && detailAnswers[q.id].trim() !== '');

  // ── Shared: Audio player bar ──
  const renderAudioPlayer = (stageLabel) => {
    const progressPercent = duration > 0 ? (currentTime / duration) * 100 : 0;
    const speed = getPlaybackSpeed(currentExercise?.level);

    return (
      <div style={{
        background: '#f7fafc', borderRadius: '12px',
        padding: '1.25rem', marginBottom: '1.25rem',
        border: '1px solid #e2e8f0'
      }}>
        <div style={{
          fontSize: '0.8rem', fontWeight: 600, color: '#667eea',
          marginBottom: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.5px'
        }}>
          {stageLabel}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <button onClick={togglePlay} style={{
            width: '48px', height: '48px', borderRadius: '50%',
            background: 'linear-gradient(135deg, #667eea, #764ba2)',
            color: 'white', border: 'none', fontSize: '1.2rem',
            cursor: 'pointer', display: 'flex', alignItems: 'center',
            justifyContent: 'center', flexShrink: 0
          }}>
            {isPlaying ? '⏸' : '▶'}
          </button>
          <div style={{ flex: 1 }}>
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
              <span>{speed !== 1 ? `Speed: ${speed}x` : ''}</span>
              <span>{duration > 0 ? formatTime(duration) : '--:--'}</span>
            </div>
          </div>
        </div>
        {!isPlaying && currentTime > 0 && (
          <button onClick={replayFromStart} style={{
            marginTop: '0.75rem', padding: '6px 14px', background: '#667eea',
            color: 'white', border: 'none', borderRadius: '6px',
            fontSize: '0.85rem', fontWeight: 600, cursor: 'pointer'
          }}>
            Replay from Start
          </button>
        )}
      </div>
    );
  };

  // ── Shared: Question renderer ──
  const renderQuestion = (q, answers, setAnswer, isSubmitted, gapState) => {
    const userAnswer = answers[q.id] || '';
    const correct = isSubmitted ? isAnswerCorrect(q, userAnswer) : null;

    return (
      <div key={q.id} style={{
        border: `2px solid ${isSubmitted ? (correct ? '#48bb78' : '#f56565') : '#e2e8f0'}`,
        background: isSubmitted ? (correct ? '#f0fff4' : '#fff5f5') : 'white',
        borderRadius: '8px', padding: '1.25rem', marginBottom: '1rem'
      }}>
        <div style={{ fontWeight: 700, color: '#667eea', fontSize: '0.85rem', marginBottom: '6px' }}>
          Question {q.question_number}
        </div>
        <div style={{ fontSize: '1.05rem', color: '#2d3748', marginBottom: '12px', lineHeight: 1.6 }}>
          {q.question}
        </div>

        {(q.type === 'multiple_choice' || q.type === 'true_false') && (
          <div style={{
            display: 'grid',
            gridTemplateColumns: q.type === 'true_false' ? '1fr 1fr' : '1fr',
            gap: '10px'
          }}>
            {(Array.isArray(q.options) ? q.options : JSON.parse(q.options || '[]')).map(opt => {
              const selected = answers[q.id] === opt;
              let bg = '#f7fafc', border = '#e2e8f0', color = '#2d3748';

              if (isSubmitted) {
                if (opt.toLowerCase().trim() === (q.correct_answer || '').toLowerCase().trim()) {
                  bg = '#48bb78'; border = '#48bb78'; color = 'white';
                } else if (selected) {
                  bg = '#f56565'; border = '#f56565'; color = 'white';
                }
              } else if (selected) {
                bg = '#667eea'; border = '#667eea'; color = 'white';
              }

              return (
                <button key={opt} onClick={() => setAnswer(q.id, opt)} disabled={isSubmitted}
                  style={{
                    padding: '10px', background: bg, border: `2px solid ${border}`,
                    borderRadius: '6px', color, cursor: isSubmitted ? 'default' : 'pointer',
                    fontWeight: 500, fontSize: '0.95rem', transition: 'all 0.2s',
                    textAlign: 'left'
                  }}
                >
                  {opt}
                </button>
              );
            })}
          </div>
        )}

        {q.type === 'gap_fill' && (
          <input
            type="text"
            value={gapState[q.id] || ''}
            onChange={(e) => {
              const val = e.target.value;
              if (gapState === gapInputs) {
                handleDetailGapInput(q.id, val);
              }
            }}
            disabled={isSubmitted}
            placeholder="Type your answer..."
            style={{
              width: '100%', padding: '10px 14px', fontSize: '1rem',
              border: `2px solid ${isSubmitted ? (correct ? '#48bb78' : '#f56565') : '#e2e8f0'}`,
              borderRadius: '6px', boxSizing: 'border-box', color: '#2d3748',
              backgroundColor: isSubmitted ? (correct ? '#f0fff4' : '#fff5f5') : 'white'
            }}
          />
        )}

        {isSubmitted && (
          <div style={{
            marginTop: '10px', padding: '10px', borderRadius: '6px',
            background: correct ? '#c6f6d5' : '#fed7d7',
            color: correct ? '#22543d' : '#742a2a',
            borderLeft: `4px solid ${correct ? '#48bb78' : '#f56565'}`,
            fontSize: '0.9rem', lineHeight: 1.5
          }}>
            <strong>{correct ? '✓ Correct!' : `✗ Incorrect — ${q.correct_answer}`}</strong>
            {q.explanation && <><br />{q.explanation}</>}
          </div>
        )}
      </div>
    );
  };

  // ── Shared: Image display ──
  const renderImage = () => {
    if (!currentExercise?.image_url) return null;
    return (
      <div style={{ textAlign: 'center', marginBottom: '1.25rem' }}>
        <img
          src={currentExercise.image_url}
          alt={currentExercise.title}
          style={{
            maxWidth: '100%', maxHeight: '300px', borderRadius: '12px',
            objectFit: 'cover', boxShadow: '0 4px 16px rgba(0,0,0,0.1)'
          }}
        />
      </div>
    );
  };

  // Hidden audio element
  const renderAudioElement = () => (
    <audio
      ref={audioRef}
      src={currentExercise?.audio_url}
      onEnded={handleAudioEnded}
      onTimeUpdate={handleTimeUpdate}
      onLoadedMetadata={handleLoadedMetadata}
      preload="metadata"
    />
  );

  // ═══════════════════════════════════════════
  // RENDER: LEVEL SELECT
  // ═══════════════════════════════════════════
  if (stage === 'level-select') {
    return (
      <div style={{ maxWidth: '800px', margin: '0 auto' }}>
        <div style={{
          background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
          borderRadius: '12px 12px 0 0', padding: '2.5rem 2rem 2rem',
          textAlign: 'center', color: 'white', position: 'relative'
        }}>
          <h1 style={{ margin: 0, fontSize: '1.8rem' }}>Listening Exercises</h1>
          <p style={{ margin: '8px 0 0', opacity: 0.9 }}>
            Practise your listening skills with audio exercises
          </p>
        </div>
        <div style={{
          background: 'white', padding: '2rem',
          borderRadius: '0 0 12px 12px', boxShadow: '0 10px 40px rgba(0,0,0,0.15)'
        }}>
          <h2 style={{ color: '#2d3748', fontSize: '1.15rem', fontWeight: 600, margin: '0 0 6px', textAlign: 'center' }}>
            Choose your level
          </h2>
          <p style={{ color: '#718096', fontSize: '0.9rem', margin: '0 0 24px', textAlign: 'center' }}>
            Select a difficulty to see available exercises
          </p>
          <div style={{ display: 'grid', gap: '16px' }}>
            {LEVELS.map(level => {
              const count = exerciseCounts[level.key] || 0;
              const available = count > 0;
              return (
                <div key={level.key} onClick={() => available && selectLevel(level)}
                  style={{
                    border: `2px solid ${available ? level.colour : '#e2e8f0'}`,
                    borderRadius: '12px', padding: '1.25rem 1.5rem',
                    cursor: available ? 'pointer' : 'default',
                    background: available ? level.colourLight : '#f9fafb',
                    opacity: available ? 1 : 0.55,
                    transition: 'transform 0.15s ease, box-shadow 0.15s ease',
                    display: 'flex', alignItems: 'center', gap: '1rem'
                  }}
                  onMouseEnter={e => { if (available) { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = `0 4px 16px ${level.colour}30`; }}}
                  onMouseLeave={e => { e.currentTarget.style.transform = 'none'; e.currentTarget.style.boxShadow = 'none'; }}
                >
                  <div style={{ fontSize: '2rem', flexShrink: 0 }}>{level.icon}</div>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                      <span style={{ fontSize: '1.1rem', fontWeight: 700, color: '#2d3748' }}>{level.label}</span>
                      <span style={{
                        background: available ? level.colour : '#a0aec0', color: 'white',
                        padding: '2px 10px', borderRadius: '20px', fontSize: '0.8rem', fontWeight: 600
                      }}>{level.sublabel}</span>
                    </div>
                    <p style={{ margin: '4px 0 0', fontSize: '0.88rem', color: '#4a5568', lineHeight: 1.4 }}>
                      {level.description}
                    </p>
                    <span style={{ display: 'inline-block', marginTop: '6px', fontSize: '0.8rem', color: available ? '#4a5568' : '#a0aec0', fontWeight: 500 }}>
                      {available ? `${count} exercise${count !== 1 ? 's' : ''} available` : 'Coming soon'}
                    </span>
                  </div>
                  {available && <div style={{ fontSize: '1.3rem', color: level.colour, flexShrink: 0 }}>→</div>}
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
              }}>← Back to Exercises</button>
            </div>
          )}
        </div>
      </div>
    );
  }

  // ═══════════════════════════════════════════
  // RENDER: EXERCISE LIST
  // ═══════════════════════════════════════════
  if (stage === 'exercise-list') {
    return (
      <div style={{ maxWidth: '800px', margin: '0 auto' }}>
        <div style={{
          background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
          borderRadius: '12px 12px 0 0', padding: '2.5rem 2rem 2rem',
          textAlign: 'center', color: 'white', position: 'relative'
        }}>
          <h1 style={{ margin: 0, fontSize: '1.8rem' }}>Listening Exercises</h1>
          <p style={{ margin: '8px 0 0', opacity: 0.9 }}>Choose an exercise to start listening</p>
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
            <div style={{ textAlign: 'center', padding: '3rem 1rem', color: '#666' }}>Loading exercises...</div>
          )}
          {!listLoading && exerciseList.length === 0 && (
            <div style={{ textAlign: 'center', padding: '2rem' }}>
              <div style={{ fontSize: '2.5rem', marginBottom: '0.75rem' }}>🎧</div>
              <h2 style={{ color: '#2C3E50', marginBottom: '0.5rem' }}>Coming Soon!</h2>
              <p style={{ color: '#666' }}>Listening exercises for this level are being added.</p>
            </div>
          )}
          {!listLoading && exerciseList.length > 0 && (
            <div style={{ display: 'grid', gap: '12px' }}>
              {exerciseList.map(ex => (
                <div key={ex.id} onClick={() => openExercise(ex)}
                  style={{
                    border: '2px solid #e2e8f0', borderRadius: '12px',
                    padding: '1.25rem', cursor: 'pointer', transition: 'all 0.15s ease',
                    display: 'flex', alignItems: 'center', gap: '1rem'
                  }}
                  onMouseEnter={e => { e.currentTarget.style.borderColor = selectedLevel.colour; e.currentTarget.style.transform = 'translateY(-1px)'; e.currentTarget.style.boxShadow = '0 2px 8px rgba(0,0,0,0.08)'; }}
                  onMouseLeave={e => { e.currentTarget.style.borderColor = '#e2e8f0'; e.currentTarget.style.transform = 'none'; e.currentTarget.style.boxShadow = 'none'; }}
                >
                  {ex.image_url ? (
                    <img src={ex.image_url} alt="" style={{
                      width: '56px', height: '56px', borderRadius: '10px',
                      objectFit: 'cover', flexShrink: 0
                    }} />
                  ) : (
                    <div style={{
                      width: '56px', height: '56px', borderRadius: '10px',
                      background: selectedLevel.colourLight, border: `1px solid ${selectedLevel.colour}30`,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: '1.4rem', flexShrink: 0
                    }}>🎧</div>
                  )}
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 700, color: '#2d3748', fontSize: '1rem', marginBottom: '2px' }}>{ex.title}</div>
                    <div style={{ fontSize: '0.85rem', color: '#718096', lineHeight: 1.4 }}>{ex.description}</div>
                    <div style={{ display: 'flex', gap: '12px', marginTop: '6px', fontSize: '0.78rem', color: '#a0aec0' }}>
                      <span>{ex.level}</span>
                      {ex.duration_seconds && <span>{Math.ceil(ex.duration_seconds / 60)} min</span>}
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
            }}>← Change Level</button>
          </div>
        </div>
      </div>
    );
  }

  // ═══════════════════════════════════════════
  // RENDER: EXERCISE PAGE
  // ═══════════════════════════════════════════
  if (stage === 'exercise' && currentExercise) {
    return (
      <div style={{ maxWidth: '800px', margin: '0 auto' }}>
        {renderAudioElement()}

        {/* Header */}
        <div style={{
          background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
          borderRadius: '12px 12px 0 0', padding: '2.5rem 2rem 2rem',
          textAlign: 'center', color: 'white', position: 'relative'
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

          {/* ── INTRO STAGE ── */}
          {exerciseStage === 'intro' && (
            <>
              {renderImage()}
              {currentExercise.intro_text && (
                <div style={{
                  background: '#f7fafc', borderRadius: '10px', padding: '1.25rem',
                  marginBottom: '1.25rem', border: '1px solid #e2e8f0',
                  fontSize: '1rem', color: '#2d3748', lineHeight: 1.7
                }}>
                  {currentExercise.intro_text}
                </div>
              )}
              <button onClick={() => setExerciseStage('gist')} style={{
                width: '100%', padding: '1rem', fontSize: '1.05rem',
                background: 'linear-gradient(135deg, #667eea, #764ba2)',
                color: 'white', border: 'none', borderRadius: '10px',
                cursor: 'pointer', fontWeight: 600
              }}>
                Start Listening — Exercise 1
              </button>
            </>
          )}

          {/* ── GIST STAGE ── */}
          {exerciseStage === 'gist' && (
            <>
              {renderImage()}
              <div style={{
                fontSize: '0.85rem', fontWeight: 600, color: '#4a5568',
                marginBottom: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.3px'
              }}>
                Exercise 1 — Gist
              </div>
              <p style={{
                color: '#718096', fontSize: '0.9rem', marginBottom: '1rem', marginTop: 0
              }}>
                Listen and answer the question. What is the general idea?
              </p>
              {renderAudioPlayer('First Listen')}

              {gistQuestions.map(q => renderQuestion(q, gistAnswers, selectGistAnswer, gistSubmitted, {}))}

              {!gistSubmitted && (
                <button onClick={submitGist} disabled={!gistAllAnswered} style={{
                  width: '100%', padding: '1rem', fontSize: '1rem',
                  background: gistAllAnswered ? 'linear-gradient(135deg, #667eea, #764ba2)' : '#cbd5e0',
                  color: 'white', border: 'none', borderRadius: '10px',
                  cursor: gistAllAnswered ? 'pointer' : 'not-allowed', fontWeight: 600
                }}>
                  Check Answer
                </button>
              )}

              {gistSubmitted && (
                <button onClick={moveToDetail} style={{
                  width: '100%', padding: '1rem', fontSize: '1rem', marginTop: '0.5rem',
                  background: 'linear-gradient(135deg, #667eea, #764ba2)',
                  color: 'white', border: 'none', borderRadius: '10px',
                  cursor: 'pointer', fontWeight: 600
                }}>
                  Continue to Exercise 2 →
                </button>
              )}
            </>
          )}

          {/* ── DETAIL STAGE ── */}
          {exerciseStage === 'detail' && (
            <>
              {renderImage()}
              <div style={{
                fontSize: '0.85rem', fontWeight: 600, color: '#4a5568',
                marginBottom: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.3px'
              }}>
                Exercise 2 — Detail
              </div>
              <p style={{
                color: '#718096', fontSize: '0.9rem', marginBottom: '1rem', marginTop: 0
              }}>
                Listen again more carefully and answer the questions below.
              </p>
              {renderAudioPlayer('Second Listen')}

              {detailQuestions.map(q => renderQuestion(q, detailAnswers, selectDetailAnswer, detailSubmitted, gapInputs))}

              {!detailSubmitted && (
                <button onClick={submitDetail} disabled={!detailAllAnswered} style={{
                  width: '100%', padding: '1rem', fontSize: '1rem',
                  background: detailAllAnswered ? 'linear-gradient(135deg, #667eea, #764ba2)' : '#cbd5e0',
                  color: 'white', border: 'none', borderRadius: '10px',
                  cursor: detailAllAnswered ? 'pointer' : 'not-allowed', fontWeight: 600
                }}>
                  Submit Answers
                </button>
              )}

              {detailSubmitted && (
                <button onClick={moveToReview} style={{
                  width: '100%', padding: '1rem', fontSize: '1rem', marginTop: '0.5rem',
                  background: 'linear-gradient(135deg, #667eea, #764ba2)',
                  color: 'white', border: 'none', borderRadius: '10px',
                  cursor: 'pointer', fontWeight: 600
                }}>
                  See Results →
                </button>
              )}
            </>
          )}

          {/* ── REVIEW STAGE ── */}
          {exerciseStage === 'review' && (
            <>
              {/* Score */}
              <div style={{
                background: totalCorrect >= Math.ceil(totalQuestions * 0.7) ? '#f0fff4' : '#fff5f5',
                border: `2px solid ${totalCorrect >= Math.ceil(totalQuestions * 0.7) ? '#48bb78' : '#f56565'}`,
                borderRadius: '8px', padding: '1.5rem', marginBottom: '1.5rem', textAlign: 'center'
              }}>
                <div style={{ fontSize: '2rem', marginBottom: '0.25rem' }}>
                  {totalCorrect >= totalQuestions ? '🏆' : totalCorrect >= Math.ceil(totalQuestions * 0.7) ? '⭐' : '💪'}
                </div>
                <div style={{
                  fontSize: '1.8rem', fontWeight: 700,
                  color: totalCorrect >= Math.ceil(totalQuestions * 0.7) ? '#48bb78' : '#f56565'
                }}>
                  {totalCorrect}/{totalQuestions}
                </div>
                <p style={{ color: '#4a5568', margin: '6px 0 0', fontSize: '0.95rem' }}>
                  {totalCorrect >= totalQuestions
                    ? 'Perfect! Excellent listening!'
                    : totalCorrect >= Math.ceil(totalQuestions * 0.7)
                    ? 'Well done! Strong listening skills.'
                    : 'Keep practising — try listening again for the details you missed.'}
                </p>
              </div>

              {renderImage()}

              {/* Third listen + transcript */}
              <div style={{
                fontSize: '0.85rem', fontWeight: 600, color: '#4a5568',
                marginBottom: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.3px'
              }}>
                Review — Listen Again
              </div>
              <p style={{
                color: '#718096', fontSize: '0.9rem', marginBottom: '1rem', marginTop: 0
              }}>
                Listen one more time and follow along with the transcript.
              </p>
              {renderAudioPlayer('Third Listen')}

              {/* Transcript toggle */}
              {currentExercise.transcript && (
                <div style={{ marginBottom: '1.5rem' }}>
                  <button onClick={() => setShowTranscript(!showTranscript)} style={{
                    width: '100%', padding: '0.75rem', fontSize: '0.95rem',
                    background: showTranscript ? '#667eea' : '#f7fafc',
                    color: showTranscript ? 'white' : '#4a5568',
                    border: showTranscript ? 'none' : '1px solid #e2e8f0',
                    borderRadius: '8px', cursor: 'pointer', fontWeight: 500
                  }}>
                    {showTranscript ? 'Hide Transcript' : 'Show Transcript'}
                  </button>
                  {showTranscript && (
                    <div style={{
                      marginTop: '0.75rem', padding: '1.25rem', background: '#f7fafc',
                      borderRadius: '8px', border: '1px solid #e2e8f0',
                      fontSize: '0.95rem', color: '#2d3748', lineHeight: 1.8,
                      whiteSpace: 'pre-wrap'
                    }}>
                      {currentExercise.transcript}
                    </div>
                  )}
                </div>
              )}

              {/* Navigation */}
              <div style={{
                display: 'flex', gap: '12px', justifyContent: 'center',
                flexWrap: 'wrap', marginTop: '0.5rem'
              }}>
                <button onClick={() => openExercise(currentExercise)} style={{
                  padding: '10px 24px', background: '#667eea', color: 'white',
                  border: 'none', borderRadius: '6px', fontWeight: 600,
                  cursor: 'pointer', fontSize: '1rem'
                }}>Try Again</button>
                <button onClick={backToExerciseList} style={{
                  padding: '10px 24px', background: '#4a5568', color: 'white',
                  border: 'none', borderRadius: '6px', fontWeight: 600,
                  cursor: 'pointer', fontSize: '1rem'
                }}>More Exercises</button>
                {onBack && (
                  <button onClick={onBack} style={{
                    padding: '10px 24px', background: 'transparent', color: '#718096',
                    border: '1px solid #e2e8f0', borderRadius: '6px', fontWeight: 500,
                    cursor: 'pointer', fontSize: '1rem'
                  }}>Back to Exercises</button>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    );
  }

  return null;
}
