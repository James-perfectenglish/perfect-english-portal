import { useState, useEffect } from 'react';
import { useLocation, useSearchParams } from 'react-router-dom';
import RandomPracticeExercise from './RandomPracticeExercise.jsx';
import SurvivalMode from './SurvivalMode.jsx';
import { TRACK_EMOJI, TRACK_LABEL } from './TeacherToolbar';
import Breadcrumb from './Breadcrumb';

const LEVEL_CONFIG = [
  {
    id: 'beginner',
    title: 'Beginner',
    subtitle: 'A1 / A2',
    description: 'Essential grammar and everyday vocabulary. Build your confidence with foundational English.',
    levels: ['A1', 'A2'],
    emoji: '🌱',
    gradient: 'linear-gradient(135deg, #43b581, #2ecc71)',
    shadow: 'rgba(46, 204, 113, 0.3)',
    language: 'en',
  },
  {
    id: 'intermediate',
    title: 'Intermediate',
    subtitle: 'B1 / B2',
    description: 'Tenses, conditionals, and real-world usage. Strengthen your command of English.',
    levels: ['B1', 'B2'],
    emoji: '📚',
    gradient: 'linear-gradient(135deg, #3498DB, #667eea)',
    shadow: 'rgba(52, 152, 219, 0.3)',
    language: 'en',
  },
  {
    id: 'advanced',
    title: 'Advanced',
    subtitle: 'C1 / C2',
    description: 'Complex structures, nuance, and precision. Perfect your English at the highest level.',
    levels: ['C1', 'C2'],
    emoji: '🎯',
    gradient: 'linear-gradient(135deg, #ed8936, #f6ad55)',
    shadow: 'rgba(237, 137, 54, 0.3)',
    language: 'en',
  },
];

const SPANISH_CONFIG = {
  levels: [],
  levelTitle: 'Español',
  levelSubtitle: null,
  gradient: 'linear-gradient(135deg, #667eea, #764ba2)',
  language: 'es',
};

const BTN = {
  height: '34px',
  borderRadius: '8px',
  background: '#f0f0f5',
  border: 'none',
  cursor: 'pointer',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  color: '#4a5568',
};

function getLevelConfigForProfile(profileLevel) {
  if (!profileLevel) return LEVEL_CONFIG[1];
  const l = profileLevel.toUpperCase();
  if (l.startsWith('A')) return LEVEL_CONFIG[0];
  if (l.startsWith('C')) return LEVEL_CONFIG[2];
  return LEVEL_CONFIG[1];
}

export default function PracticePage({
  profile,
  isTeacher = false,
  onTeacherClick,
  onBrowseClick,
  globalLang,
  onToggleLang,
  teacherTrack,
  onCycleTrack,
}) {
  const [selectedLevel, setSelectedLevel] = useState(null);
  const [survivalMode, setSurvivalMode] = useState(false);
  const [weakSpotsMode, setWeakSpotsMode] = useState(false);
  const [weakTypes, setWeakTypes] = useState([]);

  const location = useLocation();
  const [searchParams] = useSearchParams();

  const isSpanish =
    profile?.level === 'Spanish' ||
    (Array.isArray(profile?.tracks) && profile.tracks.includes('spanish'));

  const profileLevelConfig = getLevelConfigForProfile(profile?.level);

  useEffect(() => {
    setSelectedLevel(null);
    setSurvivalMode(false);
    setWeakSpotsMode(false);
    setWeakTypes([]);

    const mode = searchParams.get('mode');
    const weak = searchParams.get('weak');
    if (mode === 'weakspots' && weak) {
      const types = weak.split(',').filter(Boolean);
      setWeakTypes(types);
      setWeakSpotsMode(true);
      const levelConfig = getLevelConfigForProfile(profile?.level);
      setSelectedLevel(levelConfig);
    }
  }, [location.key]);

  if (survivalMode) {
    return <SurvivalMode onBack={() => setSurvivalMode(false)} />;
  }

  if (weakSpotsMode && selectedLevel) {
    return (
      <>
        <Breadcrumb section="Practise" title="Weak Spots" onExit={() => { setWeakSpotsMode(false); setSelectedLevel(null); }} />
        <RandomPracticeExercise
          levels={selectedLevel.levels}
          levelTitle="Weak Spots"
          levelSubtitle={selectedLevel.subtitle}
          gradient="linear-gradient(135deg, #e53e3e, #c53030)"
          language={selectedLevel.language}
          userTracks={profile?.tracks || []}
          weakTypes={weakTypes}
          onBack={() => {
            setWeakSpotsMode(false);
            setSelectedLevel(null);
          }}
        />
      </>
    );
  }

  if (isSpanish) {
    return (
      <div style={{ position: 'relative' }}>
        {isTeacher && onCycleTrack && (
          <div style={{ position: 'fixed', top: '70px', right: '1rem', zIndex: 500 }}>
            <button
              onClick={onCycleTrack}
              title={`Track: ${TRACK_LABEL[teacherTrack] || 'English'} — click to cycle`}
              style={{
                height: '34px', width: '34px', borderRadius: '8px',
                background: '#f0f0f5', border: 'none', cursor: 'pointer',
                fontSize: '1.1rem', display: 'flex', alignItems: 'center',
                justifyContent: 'center', boxShadow: '0 2px 8px rgba(0,0,0,0.12)'
              }}
            >
              {TRACK_EMOJI[teacherTrack] || '🇬🇧'}
            </button>
          </div>
        )}
        <RandomPracticeExercise
          levels={SPANISH_CONFIG.levels}
          levelTitle={SPANISH_CONFIG.levelTitle}
          levelSubtitle={SPANISH_CONFIG.levelSubtitle}
          gradient={SPANISH_CONFIG.gradient}
          language={SPANISH_CONFIG.language}
          onBack={null}
        />
      </div>
    );
  }

  if (selectedLevel) {
    return (
      <>
        <Breadcrumb section="Practise" title={selectedLevel.title} onExit={() => setSelectedLevel(null)} />
        <RandomPracticeExercise
          levels={selectedLevel.levels}
          levelTitle={selectedLevel.title}
          levelSubtitle={selectedLevel.subtitle}
          gradient={selectedLevel.gradient}
          language={selectedLevel.language}
          userTracks={profile?.tracks || []}
          onBack={() => setSelectedLevel(null)}
        />
      </>
    );
  }

  return (
    <div style={{ width: '100%', minHeight: '80vh', backgroundColor: '#f8f9fa', padding: '1rem', boxSizing: 'border-box' }}>
      <div style={{ maxWidth: '700px', margin: '0 auto', textAlign: 'center' }}>

        <div style={{ position: 'relative', marginBottom: '0.5rem' }}>
          <h1 style={{ fontSize: 'clamp(1.8rem, 6vw, 2.5rem)', color: '#2C3E50', margin: 0, fontWeight: '700' }}>
            Practise
          </h1>
          {isTeacher && (
            <div style={{
              position: 'absolute', top: '50%', right: 0,
              transform: 'translateY(-50%)',
              display: 'flex', gap: '6px', alignItems: 'center',
            }}>
              {onCycleTrack && (
                <button onClick={onCycleTrack} title={`Track override: ${teacherTrack || 'en'} — click to cycle`} style={{ ...BTN, width: '34px', fontSize: '1.1rem' }}>
                  {teacherTrack === 'spanish' ? '🇪🇸' : teacherTrack === 'bathroom' ? '🛁' : teacherTrack === 'hotels' ? '🏨' : teacherTrack === 'business' ? '💼' : '🇬🇧'}
                </button>
              )}
              {onBrowseClick && (
                <button onClick={onBrowseClick} title="Question browser" style={{ ...BTN, padding: '0 10px', fontSize: '0.75rem', fontWeight: 700, whiteSpace: 'nowrap' }}>
                  🔍 Browse
                </button>
              )}
              {onTeacherClick && (
                <button onClick={onTeacherClick} title="Teacher dashboard" style={{ ...BTN, width: '34px', fontSize: '1rem' }}>
                  👨‍🏫
                </button>
              )}
            </div>
          )}
        </div>

        <p style={{ fontSize: 'clamp(1rem, 3vw, 1.15rem)', color: '#666', marginBottom: '2rem', lineHeight: '1.5' }}>
          Choose your level. 20 random questions, a variety of exercises. Let's go!
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginBottom: '1.5rem' }}>
          {LEVEL_CONFIG.map(level => {
            const isYourLevel = !isTeacher && level.id === profileLevelConfig.id;
            return (
              <button
                key={level.id}
                onClick={() => setSelectedLevel(level)}
                style={{
                  display: 'flex', alignItems: 'center',
                  gap: 'clamp(0.75rem, 3vw, 1.25rem)',
                  padding: 'clamp(1rem, 3vw, 1.5rem)',
                  backgroundColor: 'white',
                  border: isYourLevel ? '2px solid #667eea' : '1px solid #e2e8f0',
                  borderRadius: '16px', cursor: 'pointer', textAlign: 'left',
                  transition: 'all 0.2s',
                  boxShadow: isYourLevel ? '0 4px 16px rgba(102,126,234,0.25)' : `0 4px 12px ${level.shadow}`,
                  width: '100%', boxSizing: 'border-box',
                  position: 'relative',
                }}
              >
                {isYourLevel && (
                  <div style={{
                    position: 'absolute', top: '-1px', right: '14px',
                    background: 'linear-gradient(135deg, #667eea, #764ba2)',
                    color: 'white', fontSize: '0.7rem', fontWeight: '700',
                    padding: '3px 10px', borderRadius: '0 0 8px 8px',
                    letterSpacing: '0.3px',
                  }}>
                    Your level
                  </div>
                )}
                <div style={{
                  background: level.gradient, borderRadius: '12px',
                  width: 'clamp(55px, 15vw, 70px)', height: 'clamp(55px, 15vw, 70px)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 'clamp(1.5rem, 5vw, 2rem)', flexShrink: 0
                }}>
                  {level.emoji}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '0.3rem' }}>
                    <span style={{ fontSize: 'clamp(1.15rem, 4vw, 1.35rem)', fontWeight: '700', color: '#2C3E50' }}>
                      {level.title}
                    </span>
                    <span style={{ fontSize: 'clamp(0.8rem, 2.5vw, 0.9rem)', color: '#888', fontWeight: '500' }}>
                      {level.subtitle}
                    </span>
                  </div>
                  <p style={{ fontSize: 'clamp(0.85rem, 2.5vw, 0.95rem)', color: '#666', margin: 0, lineHeight: '1.4' }}>
                    {level.description}
                  </p>
                </div>
                <div style={{ fontSize: '1.5rem', color: '#ccc', flexShrink: 0 }}>→</div>
              </button>
            );
          })}
        </div>

        <div style={{ marginTop: '0.5rem' }}>
          <button
            onClick={() => setSurvivalMode(true)}
            style={{
              display: 'flex', alignItems: 'center',
              gap: 'clamp(0.75rem, 3vw, 1.25rem)',
              padding: 'clamp(1rem, 3vw, 1.5rem)',
              backgroundColor: '#1a1a2e',
              border: '1px solid #333', borderRadius: '16px',
              cursor: 'pointer', textAlign: 'left', transition: 'all 0.2s',
              boxShadow: '0 4px 12px rgba(237, 137, 54, 0.3)',
              width: '100%', boxSizing: 'border-box'
            }}
          >
            <div style={{
              background: 'linear-gradient(135deg, #ed8936, #e74c3c)',
              borderRadius: '12px',
              width: 'clamp(55px, 15vw, 70px)', height: 'clamp(55px, 15vw, 70px)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 'clamp(1.5rem, 5vw, 2rem)', flexShrink: 0
            }}>
              ⚔️
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '0.3rem' }}>
                <span style={{ fontSize: 'clamp(1.15rem, 4vw, 1.35rem)', fontWeight: '700', color: 'white' }}>
                  Survival Mode
                </span>
                <span style={{
                  fontSize: 'clamp(0.75rem, 2vw, 0.8rem)', fontWeight: '600',
                  color: '#ed8936', backgroundColor: 'rgba(237, 137, 54, 0.15)',
                  padding: '2px 8px', borderRadius: '6px',
                  textTransform: 'uppercase', letterSpacing: '0.5px'
                }}>
                  Challenge
                </span>
              </div>
              <p style={{ fontSize: 'clamp(0.85rem, 2.5vw, 0.95rem)', color: '#adb5bd', margin: 0, lineHeight: '1.4' }}>
                5 lives. Start at Beginner, level up through Intermediate to Advanced. How far can you go?
              </p>
            </div>
            <div style={{ fontSize: '1.5rem', color: '#ed8936', flexShrink: 0 }}>→</div>
          </button>
        </div>

      </div>
    </div>
  );
}
