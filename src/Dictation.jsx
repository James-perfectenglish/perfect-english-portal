import { useState, useEffect, useRef } from 'react';
import { supabase } from './supabaseClient';
import { LevelBadge, TopicBadge, AiMarkedBadge, ExcerptBadge } from './components/BadgePill';
import SentenceChallenge from './components/SentenceChallenge';

const LEVELS = [
  {
    key: 'beginner',
    label: 'Beginner',
    sublabel: 'A1 – A2',
    badgeLabel: 'Level: A1-A2',
    description: 'Listen and type one or two words that you hear.',
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
    description: 'Listen and type a phrase or clause that you hear.',
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
    description: 'Listen and type the complete sentence that you hear.',
    colour: '#ed8936',
    colourLight: '#fffaf0',
    dbLevels: ['C1', 'C2'],
    icon: '🎓'
  }
];

const SPEED_OPTIONS = [
  { label: 'Slower', value: 0.9 },
  { label: 'Normal', value: 1.0 },
  { label: 'Faster', value: 1.1 },
];

const GRADIENT = 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)';

// ── Levenshtein distance ──
function levenshtein(a, b) {
  const m = a.length, n = b.length;
  const dp = Array.from({ length: m + 1 }, (_, i) => [i, ...Array(n).fill(0)]);
  for (let j = 0; j <= n; j++) dp[0][j] = j;
  for (let i = 1; i <= m; i++)
    for (let j = 1; j <= n; j++)
      dp[i][j] = a[i-1] === b[j-1] ? dp[i-1][j-1] : 1 + Math.min(dp[i-1][j], dp[i][j-1], dp[i-1][j-1]);
  return dp[m][n];
}

const normalise = (s) => s.toLowerCase().trim().replace(/[.,!?;:'"()]/g, '').replace(/\s+/g, ' ');

function isFuzzyMatch(studentNorm, correctNorm) {
  if (correctNorm.split(' ').length <= 2) {
    const dist = levenshtein(studentNorm, correctNorm);
    if (dist === 1) return true;
    if (dist === 2 && correctNorm.length >= 6) return true;
    return false;
  }
  const sWords = studentNorm.split(' ');
  const cWords = correctNorm.split(' ');
  if (Math.abs(sWords.length - cWords.length) > 1) return false;
  let mismatches = 0;
  const len = Math.max(sWords.length, cWords.length);
  for (let i = 0; i < len; i++) {
    const sw = sWords[i] || '';
    const cw = cWords[i] || '';
    if (sw !== cw) {
      const d = levenshtein(sw, cw);
      if (d > 2) return false;
      mismatches++;
      if (mismatches > 1) return false;
    }
  }
  return mismatches <= 1;
}

const formatTime = (s) => {
  const m = Math.floor(s / 60);
  return `${m}:${Math.floor(s % 60).toString().padStart(2, '0')}`;
};

export default function Dictation({ onBack, userTracks = [] }) {
  const [stage, setStage]           = useState('level-select');
  const [selectedLevel, setSelectedLevel] = useState(null);
  const [exerciseList, setExerciseList]   = useState([]);
  const [exerciseCounts, setExerciseCounts] = useState({});
  const [listLoading, setListLoading]     = useState(false);
  const [completedIds, setCompletedIds]   = useState(new Set());

  const [currentExercise, setCurrentExercise] = useState(null);
  const [userAnswer, setUserAnswer]     = useState('');
  const [feedback, setFeedback]         = useState(null);
  const [isChecking, setIsChecking]     = useState(false);
  const [hasPlayed, setHasPlayed]       = useState(false);

  // ── Sentence challenge ──
  const [showChallenge, setShowChallenge] = useState(false);
  const [challengeWord, setChallengeWord] = useState('');
  const challengeFiredRef = useRef(false);

  const audioRef = useRef(null);
  const [isPlaying, setIsPlaying]       = useState(false);
  const [currentTime, setCurrentTime]   = useState(0);
  const [duration, setDuration]         = useState(0);
  const [playbackSpeed, setPlaybackSpeed] = useState(1.0);

  useEffect(() => { fetchCounts(); }, []);

  const applyTrackFilter = (query) => {
    if (!userTracks || userTracks.length === 0) return query;
    return query.overlaps('tracks', userTracks);
  };

  const fetchCounts = async () => {
    let query = supabase.from('dictation_exercises').select('level').eq('dictation_type', 'class');
    query = applyTrackFilter(query);
    const { data } = await query;
    if (data) {
      const counts = {};
      LEVELS.forEach(lv => { counts[lv.key] = data.filter(e => lv.dbLevels.includes(e.level)).length; });
      setExerciseCounts(counts);
    }
  };

  const selectLevel = (level) => {
    if ((exerciseCounts[level.key] || 0) === 0) return;
    setSelectedLevel(level);
    setStage('exercise-list');
    fetchExerciseList(level.dbLevels);
  };

  const fetchExerciseList = async (dbLevels) => {
    setListLoading(true);
    let query = supabase
      .from('dictation_exercises')
      .select('id, title, level, topic, excerpt_type, image_url')
      .eq('dictation_type', 'class')
      .in('level', dbLevels)
      .order('created_at', { ascending: true });
    query = applyTrackFilter(query);
    const { data } = await query;
    if (data) setExerciseList(data);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data: sessions } = await supabase
          .from('dictation_sessions')
          .select('exercise_id')
          .eq('student_id', user.id);
        if (sessions) setCompletedIds(new Set(sessions.map(s => s.exercise_id)));
      }
    } catch (e) { /* silent */ }
    setListLoading(false);
  };

  const openExercise = async (exercise) => {
    const { data } = await supabase
      .from('dictation_exercises')
      .select('*')
      .eq('id', exercise.id)
      .single();
    setCurrentExercise(data);
    setUserAnswer('');
    setFeedback(null);
    setIsPlaying(false);
    setCurrentTime(0);
    setDuration(0);
    setPlaybackSpeed(1.0);
    setHasPlayed(false);
    setShowChallenge(false);
    challengeFiredRef.current = false;
    setStage('exercise');
    window.scrollTo({ top: 0, behavior: 'instant' });
  };

  const renderImage = () => {
    if (!currentExercise?.image_url) return null;
    return (
      <div style={{ textAlign: 'center', marginBottom: '1.25rem' }}>
        <img
          src={currentExercise.image_url}
          alt={currentExercise.title}
          style={{ maxWidth: '100%', maxHeight: '300px', borderRadius: '12px', objectFit: 'cover', objectPosition: 'top', boxShadow: '0 4px 16px rgba(0,0,0,0.1)' }}
        />
      </div>
    );
  };

  const togglePlay = () => {
    if (!audioRef.current) return;
    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
    } else {
      audioRef.current.playbackRate = playbackSpeed;
      audioRef.current.play();
      setIsPlaying(true);
      setHasPlayed(true);
    }
  };

  const replayFromStart = () => {
    if (!audioRef.current) return;
    audioRef.current.currentTime = 0;
    audioRef.current.playbackRate = playbackSpeed;
    audioRef.current.play();
    setIsPlaying(true);
  };

  const changeSpeed = (newSpeed) => {
    setPlaybackSpeed(newSpeed);
    if (audioRef.current) audioRef.current.playbackRate = newSpeed;
  };

  const handleAudioEnded    = () => setIsPlaying(false);
  const handleTimeUpdate    = () => { if (audioRef.current) setCurrentTime(audioRef.current.currentTime); };
  const handleLoadedMetadata = () => { if (audioRef.current) setDuration(audioRef.current.duration); };

  const checkAnswer = async () => {
    if (!userAnswer.trim() || isChecking || !currentExercise) return;

    const student = userAnswer.trim();
    const correct = currentExercise.answer;
    const normStudent = normalise(student);
    const normCorrect = normalise(correct);

    let resultType = 'incorrect';
    let nudge = null;

    if (student === correct) {
      resultType = 'correct';
    }

    if (resultType === 'incorrect' && normStudent === normCorrect) {
      resultType = 'correct';
    }

    if (resultType === 'incorrect' && isFuzzyMatch(normStudent, normCorrect)) {
      resultType = 'fuzzy';
    }

    if (resultType === 'incorrect') {
      setIsChecking(true);
      try {
        const response = await fetch('/api/mark-gap', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            type: 'dictation',
            correctAnswer: correct,
            studentAnswer: student,
            excerptType: currentExercise.excerpt_type,
            language: currentExercise.language || 'en',
            acceptableAlternatives: currentExercise.acceptable_alternatives || [],
          }),
        });
        if (response.ok) {
          const result = await response.json();
          if (result.valid === true) {
            resultType = 'soft-pass';
            nudge = result.reason || null;
          }
        }
      } catch (e) {
        console.error('mark-dictation error:', e);
      }
      setIsChecking(false);
    }

    const isCorrect = ['correct', 'fuzzy', 'soft-pass'].includes(resultType);
    setFeedback({ type: resultType, isCorrect, student, correct, nudge });
    saveSession(student, isCorrect, resultType === 'soft-pass');
  };

  const saveSession = async (studentAnswer, isCorrect, isSoftPass) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user || !currentExercise) return;
      await supabase.from('dictation_sessions').insert({
        student_id:     user.id,
        exercise_id:    currentExercise.id,
        student_answer: studentAnswer,
        is_correct:     isCorrect,
        is_soft_pass:   isSoftPass,
      });
      setCompletedIds(prev => new Set([...prev, currentExercise.id]));
    } catch (e) { console.error('Error saving dictation session:', e); }
  };

  const CHALLENGE_STOP_WORDS = new Set(['a','an','the','and','but','or','so','in','on','at','to','for','of','with','by','from','up','as','is','was','are','were','be','been','has','had','have','it','its','this','that','i','he','she','they','we','you','what','how','when','where','who','which','not','do','did','can','could','would','will','my','his','her','their','our','its']);

  const getDictationChallengeWord = (answer) => {
    const words = answer.trim().split(/\s+/);
    if (words.length <= 5) return answer; // short phrase — fine to use whole thing
    // C-level: answer is a full sentence — extract most meaningful word
    const meaningful = words.filter(w => w.length >= 4 && !CHALLENGE_STOP_WORDS.has(w.toLowerCase().replace(/[.,!?;:'"]/g, '')));
    const pool = meaningful.length > 0 ? meaningful : words;
    return pool.reduce((a, b) => b.length > a.length ? b : a).replace(/[.,!?;:'"]/g, '');
  };

  const handleMoreExercises = () => {
    if (!challengeFiredRef.current && feedback?.isCorrect && currentExercise?.answer) {
      challengeFiredRef.current = true;
      setChallengeWord(getDictationChallengeWord(currentExercise.answer));
      setShowChallenge(true);
      return;
    }
    backToExerciseList();
  };

  const tryAgain = () => {
    setUserAnswer('');
    setFeedback(null);
    setIsPlaying(false);
    setHasPlayed(false);
    if (audioRef.current) { audioRef.current.pause(); audioRef.current.currentTime = 0; }
  };

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

  const renderAudioPlayer = (stageLabel) => {
    const progressPercent = duration > 0 ? (currentTime / duration) * 100 : 0;
    return (
      <div style={{ background: '#f7fafc', borderRadius: '12px', padding: '1.25rem', marginBottom: '1.25rem', border: '1px solid #e2e8f0' }}>
        <div style={{ fontSize: '0.8rem', fontWeight: 600, color: '#667eea', marginBottom: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.5px' }}>{stageLabel}</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <button onClick={togglePlay} style={{ width: '48px', height: '48px', borderRadius: '50%', background: GRADIENT, color: 'white', border: 'none', fontSize: '1.2rem', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            {isPlaying ? '⏸' : '▶'}
          </button>
          <div style={{ flex: 1 }}>
            <div style={{ width: '100%', height: '6px', background: '#e2e8f0', borderRadius: '3px', overflow: 'hidden', marginBottom: '6px' }}>
              <div style={{ width: `${progressPercent}%`, height: '100%', background: GRADIENT, borderRadius: '3px', transition: 'width 0.3s' }} />
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem', color: '#718096' }}>
              <span>{formatTime(currentTime)}</span>
              <span>{duration > 0 ? formatTime(duration) : '--:--'}</span>
            </div>
          </div>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '0.75rem', flexWrap: 'wrap', gap: '0.5rem' }}>
          <div style={{ display: 'flex', gap: '6px' }}>
            {SPEED_OPTIONS.map(opt => (
              <button key={opt.value} onClick={() => changeSpeed(opt.value)} style={{ padding: '5px 12px', fontSize: '0.8rem', fontWeight: 600, borderRadius: '6px', cursor: 'pointer', transition: 'all 0.15s', border: playbackSpeed === opt.value ? '2px solid #667eea' : '1px solid #d1d5db', background: playbackSpeed === opt.value ? '#667eea' : 'white', color: playbackSpeed === opt.value ? 'white' : '#4a5568' }}>
                {opt.label}
              </button>
            ))}
          </div>
          {!isPlaying && currentTime > 0 && (
            <button onClick={replayFromStart} style={{ padding: '5px 14px', background: '#667eea', color: 'white', border: 'none', borderRadius: '6px', fontSize: '0.8rem', fontWeight: 600, cursor: 'pointer' }}>Replay</button>
          )}
        </div>
      </div>
    );
  };

  // ── LEVEL SELECT ──────────────────────────────────────────────────────────────
  if (stage === 'level-select') {
    return (
      <div style={{ backgroundColor: '#f8f9fa', minHeight: '100vh' }}>
      <div style={{ maxWidth: '800px', margin: '0 auto', padding: '1rem' }}>
        <div style={{ background: GRADIENT, borderRadius: '12px', padding: '2.5rem 2rem 2rem', textAlign: 'center', color: 'white', marginBottom: '1.5rem' }}>
          <h1 style={{ margin: 0, fontSize: '1.8rem' }}>⌨️ Dictation</h1>
          <p style={{ margin: '8px 0 0', opacity: 0.9 }}>Listen and write what you hear</p>
        </div>
        <div style={{ background: 'white', padding: '2rem', borderRadius: '12px', boxShadow: '0 10px 40px rgba(0,0,0,0.15)' }}>
          <h2 style={{ color: '#2d3748', fontSize: '1.15rem', fontWeight: 600, margin: '0 0 6px', textAlign: 'center' }}>Choose your level</h2>
          <p style={{ color: '#718096', fontSize: '0.9rem', margin: '0 0 24px', textAlign: 'center' }}>Select a difficulty to see available exercises</p>
          <div style={{ display: 'grid', gap: '16px' }}>
            {LEVELS.map(level => {
              const count = exerciseCounts[level.key] || 0;
              const available = count > 0;
              return (
                <div key={level.key} onClick={() => available && selectLevel(level)}
                  style={{ border: `2px solid ${available ? level.colour : '#e2e8f0'}`, borderRadius: '12px', padding: '1.25rem 1.5rem', cursor: available ? 'pointer' : 'default', background: available ? level.colourLight : '#f9fafb', opacity: available ? 1 : 0.55, transition: 'transform 0.15s, box-shadow 0.15s', display: 'flex', alignItems: 'center', gap: '1rem' }}
                  onMouseEnter={e => { if (available) { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = `0 4px 16px ${level.colour}30`; }}}
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
              <button onClick={onBack} style={{ padding: '10px 24px', background: 'transparent', color: '#718096', border: '1px solid #e2e8f0', borderRadius: '6px', fontWeight: 500, cursor: 'pointer', fontSize: '0.95rem' }}>← Back to Exercises</button>
            </div>
          )}
        </div>
      </div>
      </div>
    );
  }

  // ── EXERCISE LIST ──────────────────────────────────────────────────────────────
  if (stage === 'exercise-list') {
    return (
      <div style={{ backgroundColor: '#f8f9fa', minHeight: '100vh' }}>
      <div style={{ maxWidth: '800px', margin: '0 auto', padding: '1rem' }}>
        <div style={{ background: GRADIENT, borderRadius: '12px', padding: '2.5rem 2rem 2rem', textAlign: 'center', color: 'white', marginBottom: '1.5rem' }}>
          <h1 style={{ margin: 0, fontSize: '1.8rem' }}>⌨️ Dictation</h1>
          <p style={{ margin: '8px 0 0', opacity: 0.9 }}>Choose an exercise to start</p>
          {selectedLevel && <span style={{ display: 'inline-block', background: selectedLevel.colour, padding: '4px 12px', borderRadius: '20px', fontSize: '0.85rem', fontWeight: 600, marginTop: '8px' }}>Level: {selectedLevel.sublabel}</span>}
        </div>
        <div style={{ background: 'white', padding: '2rem', borderRadius: '12px', boxShadow: '0 10px 40px rgba(0,0,0,0.15)' }}>
          {listLoading && <div style={{ textAlign: 'center', padding: '3rem 1rem', color: '#666' }}>Loading exercises...</div>}
          {!listLoading && exerciseList.length === 0 && (
            <div style={{ textAlign: 'center', padding: '2rem' }}>
              <div style={{ fontSize: '2.5rem', marginBottom: '0.75rem' }}>🎧</div>
              <h2 style={{ color: '#2C3E50', marginBottom: '0.5rem' }}>Coming Soon!</h2>
              <p style={{ color: '#666' }}>Dictation exercises for this level are being added.</p>
            </div>
          )}
          {!listLoading && exerciseList.length > 0 && (
            <div style={{ display: 'grid', gap: '12px' }}>
              {exerciseList.map(ex => (
                <div key={ex.id} onClick={() => openExercise(ex)}
                  style={{ border: '2px solid #e2e8f0', borderRadius: '12px', padding: '1.25rem', cursor: 'pointer', transition: 'all 0.15s', display: 'flex', alignItems: 'center', gap: '1rem' }}
                  onMouseEnter={e => { e.currentTarget.style.borderColor = selectedLevel.colour; e.currentTarget.style.transform = 'translateY(-1px)'; e.currentTarget.style.boxShadow = '0 2px 8px rgba(0,0,0,0.08)'; }}
                  onMouseLeave={e => { e.currentTarget.style.borderColor = '#e2e8f0'; e.currentTarget.style.transform = 'none'; e.currentTarget.style.boxShadow = 'none'; }}
                >
                  {ex.image_url
                    ? <img src={`${ex.image_url}?width=112&height=112&resize=cover`} alt="" style={{ width: '56px', height: '56px', borderRadius: '10px', objectFit: 'cover', objectPosition: 'top', flexShrink: 0 }} />
                    : <div style={{ width: '56px', height: '56px', borderRadius: '10px', background: selectedLevel.colourLight, border: `1px solid ${selectedLevel.colour}30`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.4rem', flexShrink: 0 }}>⌨️</div>
                  }
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 700, color: '#2d3748', fontSize: '1rem', marginBottom: '4px' }}>{ex.title}</div>
                    <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                      <LevelBadge level={ex.level} />
                      <ExcerptBadge excerptType={ex.excerpt_type} />
                      <TopicBadge topic={ex.topic} />
                    </div>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px', flexShrink: 0 }}>
                    {completedIds.has(ex.id) && <span style={{ fontSize: '1rem' }}>✅</span>}
                    <span style={{ fontSize: '1.3rem', color: '#cbd5e0' }}>→</span>
                  </div>
                </div>
              ))}
            </div>
          )}
          <div style={{ textAlign: 'center', marginTop: '24px' }}>
            <button onClick={backToLevelSelect} style={{ padding: '10px 24px', background: 'transparent', color: '#718096', border: '1px solid #e2e8f0', borderRadius: '6px', fontWeight: 500, cursor: 'pointer', fontSize: '0.95rem' }}>← Change Level</button>
          </div>
        </div>
      </div>
      </div>
    );
  }

  // ── EXERCISE ──────────────────────────────────────────────────────────────────
  if (stage === 'exercise' && currentExercise) {
    const isCorrect    = feedback?.isCorrect;
    const isFuzzy      = feedback?.type === 'fuzzy';
    const isSoftPass   = feedback?.type === 'soft-pass';
    const borderColour = !feedback ? '#e2e8f0' : isCorrect ? '#48bb78' : '#f56565';
    const bgColour     = !feedback ? 'white' : isCorrect ? '#f0fff4' : '#fff5f5';
    const hasTemplate  = currentExercise.sentence_template && currentExercise.sentence_template.includes('_');

    return (
      <div style={{ backgroundColor: '#f8f9fa', minHeight: '100vh' }}>
      <div style={{ maxWidth: '800px', margin: '0 auto', padding: '1rem' }}>
        <audio ref={audioRef} src={currentExercise.audio_url} onEnded={handleAudioEnded} onTimeUpdate={handleTimeUpdate} onLoadedMetadata={handleLoadedMetadata} preload="metadata" />

        <div style={{ background: GRADIENT, borderRadius: '12px', padding: '2.5rem 2rem 2rem', textAlign: 'center', color: 'white', marginBottom: '1.5rem' }}>
          <h1 style={{ margin: 0, fontSize: '1.8rem' }}>⌨️ Dictation</h1>
          <p style={{ margin: '8px 0 0', opacity: 0.9 }}>{currentExercise.title}</p>
          {selectedLevel && <span style={{ display: 'inline-block', background: selectedLevel.colour, padding: '4px 12px', borderRadius: '20px', fontSize: '0.85rem', fontWeight: 600, marginTop: '8px' }}>{selectedLevel.badgeLabel}</span>}
        </div>

        <div style={{ background: 'white', padding: '2rem', borderRadius: '12px', boxShadow: '0 10px 40px rgba(0,0,0,0.15)' }}>

          {renderImage()}

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '1.25rem' }}>
            <LevelBadge level={currentExercise.level} />
            <TopicBadge topic={currentExercise.topic} />
            <AiMarkedBadge />
          </div>

          <p style={{ color: '#718096', fontSize: '0.95rem', marginTop: 0, marginBottom: hasTemplate ? '0.75rem' : '1.25rem', fontStyle: 'italic' }}>
            {currentExercise.excerpt_type === 'word'
              ? 'Listen and type the one or two words you hear that complete the sentence.'
              : currentExercise.excerpt_type === 'phrase'
              ? 'Listen and type the word or short phrase you hear that completes the sentence.'
              : 'Listen and type the complete sentence you hear.'}
          </p>

          {hasTemplate && (
            <div style={{ background: '#F8FBFF', border: '1px solid #AED6F1', borderRadius: '10px', padding: '1rem 1.25rem', marginBottom: '1.25rem', fontSize: '1rem', color: '#2d3748', lineHeight: 1.8 }}>
              {currentExercise.sentence_template}
            </div>
          )}

          {renderAudioPlayer('Listen')}

          {!feedback && (
            <>
              <div style={{ fontSize: '0.75rem', color: '#718096', fontWeight: 600, marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                What did you hear?
              </div>
              <div style={{ display: 'flex', gap: '10px', marginBottom: '1rem' }}>
                <input
                  type="text"
                  value={userAnswer}
                  onChange={e => setUserAnswer(e.target.value)}
                  onKeyPress={e => e.key === 'Enter' && !isChecking && checkAnswer()}
                  placeholder="Type what you heard..."
                  disabled={isChecking}
                  autoComplete="off"
                  style={{ flex: 1, padding: '0.9rem 1rem', fontSize: 'clamp(1rem, 3.5vw, 1.15rem)', borderRadius: '8px', border: '2px solid #667eea', boxSizing: 'border-box', color: '#2d3748', fontWeight: 500, backgroundColor: '#EDE9FE', opacity: isChecking ? 0.6 : 1 }}
                />
                <button
                  onClick={checkAnswer}
                  disabled={!userAnswer.trim() || isChecking || !hasPlayed}
                  style={{ padding: '0 1.5rem', background: (userAnswer.trim() && !isChecking && hasPlayed) ? GRADIENT : '#cbd5e0', color: 'white', border: 'none', borderRadius: '8px', cursor: (userAnswer.trim() && !isChecking && hasPlayed) ? 'pointer' : 'not-allowed', fontWeight: 600, fontSize: '1rem', minHeight: '48px', whiteSpace: 'nowrap' }}
                >
                  {isChecking ? '🤖...' : 'Check'}
                </button>
              </div>
              {!hasPlayed && (
                <p style={{ fontSize: '0.82rem', color: '#a0aec0', textAlign: 'center', margin: 0 }}>▶ Press play first</p>
              )}
              {isChecking && (
                <div style={{ textAlign: 'center', padding: '0.75rem', color: '#553C9A', fontSize: '0.9rem', border: '2px dashed #EDE9FE', borderRadius: '8px' }}>
                  🤖 Checking your answer...
                </div>
              )}
            </>
          )}

          {feedback && (
            <div style={{ border: `2px solid ${borderColour}`, borderRadius: '12px', overflow: 'hidden', marginBottom: '1rem' }}>
              <div style={{ background: isCorrect ? '#48bb78' : '#f56565', color: 'white', padding: '0.6rem 1rem', fontWeight: 700, fontSize: '1rem' }}>
                {isFuzzy     ? '✅ Correct — watch your spelling!'
                 : isSoftPass ? '✅ Close enough!'
                 : isCorrect  ? '✅ Correct!'
                 : '❌ Not quite'}
              </div>
              <div style={{ background: bgColour, padding: '1rem' }}>
                <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.5rem' }}>
                  <span style={{ fontWeight: 600, color: '#4a5568', minWidth: '110px' }}>You wrote:</span>
                  <span style={{ fontWeight: 600, color: isCorrect ? '#276749' : '#c53030', wordBreak: 'break-word' }}>{feedback.student}</span>
                </div>
                <div style={{ display: 'flex', gap: '0.5rem', marginBottom: feedback.nudge ? '0.75rem' : 0 }}>
                  <span style={{ fontWeight: 600, color: '#4a5568', minWidth: '110px' }}>Correct:</span>
                  <span style={{ fontWeight: 700, color: '#276749', wordBreak: 'break-word' }}>{feedback.correct}</span>
                </div>
                {feedback.nudge && (
                  <div style={{ borderTop: `1px solid ${borderColour}`, paddingTop: '0.75rem', color: '#4a5568', fontSize: '0.9rem', lineHeight: 1.6 }}>
                    {feedback.nudge}
                  </div>
                )}
                {!isCorrect && currentExercise.hint && (
                  <div style={{ borderTop: `1px solid ${borderColour}`, paddingTop: '0.75rem', color: '#744210', fontSize: '0.9rem', lineHeight: 1.6 }}>
                    💡 {currentExercise.hint}
                  </div>
                )}
              </div>
            </div>
          )}

          {feedback && (
            <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
              {!isCorrect && (
                <button onClick={tryAgain} style={{ flex: 1, padding: '0.9rem', background: GRADIENT, color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 600, fontSize: '1rem' }}>
                  Try Again ↩
                </button>
              )}
              <button onClick={isCorrect ? handleMoreExercises : backToExerciseList} style={{ flex: 1, padding: '0.9rem', background: isCorrect ? GRADIENT : 'transparent', color: isCorrect ? 'white' : '#667eea', border: isCorrect ? 'none' : '2px solid #667eea', borderRadius: '8px', cursor: 'pointer', fontWeight: 600, fontSize: '1rem' }}>
                {isCorrect ? 'More Exercises →' : 'Skip'}
              </button>
            </div>
          )}
        </div>

        <div style={{ textAlign: 'center', marginTop: '16px' }}>
          <button onClick={backToLevelSelect} style={{ padding: '8px 20px', background: 'transparent', color: '#718096', border: '1px solid #e2e8f0', borderRadius: '6px', fontWeight: 500, cursor: 'pointer', fontSize: '0.9rem' }}>← Change Level</button>
        </div>
      </div>

      {showChallenge && (
        <SentenceChallenge
          word={challengeWord}
          language={currentExercise?.language || 'en'}
          exercise="dictation"
          onClose={() => { setShowChallenge(false); backToExerciseList(); }}
        />
      )}
      </div>
    );
  }

  return null;
}
