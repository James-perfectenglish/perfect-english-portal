import { useState } from 'react';
import RandomPracticeExercise from './RandomPracticeExercise.jsx';
import SurvivalMode from './SurvivalMode.jsx';
import { useLocation } from 'react-router-dom'
const LEVEL_CONFIG = [
  {
    id: 'beginner',
    title: 'Beginner',
    subtitle: 'A1 / A2',
    description: 'Essential grammar and everyday vocabulary. Build your confidence with foundational English.',
    levels: ['A1', 'A2'],
    emoji: '🌱',
    gradient: 'linear-gradient(135deg, #43b581, #2ecc71)',
    shadow: 'rgba(46, 204, 113, 0.3)'
  },
  {
    id: 'intermediate',
    title: 'Intermediate',
    subtitle: 'B1 / B2',
    description: 'Tenses, conditionals, and real-world usage. Strengthen your command of English.',
    levels: ['B1', 'B2'],
    emoji: '📚',
    gradient: 'linear-gradient(135deg, #3498DB, #667eea)',
    shadow: 'rgba(52, 152, 219, 0.3)'
  },
  {
    id: 'advanced',
    title: 'Advanced',
    subtitle: 'C1 / C2',
    description: 'Complex structures, nuance, and precision. Perfect your English at the highest level.',
    levels: ['C1', 'C2'],
    emoji: '🎯',
    gradient: 'linear-gradient(135deg, #8e44ad, #e74c3c)',
    shadow: 'rgba(142, 68, 173, 0.3)'
  }
];

export default function PracticePage() {
  const [selectedLevel, setSelectedLevel] = useState(null);
  const [survivalMode, setSurvivalMode] = useState(false);
const location = useLocation()
useEffect(() => { setSelectedLevel(null); setSurvivalMode(false); }, [location.key])
  if (survivalMode) {
    return <SurvivalMode onBack={() => setSurvivalMode(false)} />;
  }

  if (selectedLevel) {
    return (
      <RandomPracticeExercise
        levels={selectedLevel.levels}
        levelTitle={selectedLevel.title}
        levelSubtitle={selectedLevel.subtitle}
        gradient={selectedLevel.gradient}
        onBack={() => setSelectedLevel(null)}
      />
    );
  }

  return (
    <div style={{
      width: '100%',
      minHeight: '80vh',
      backgroundColor: '#f8f9fa',
      padding: '1rem',
      boxSizing: 'border-box'
    }}>
      <div style={{
        maxWidth: '700px',
        margin: '0 auto',
        textAlign: 'center'
      }}>
        <h1 style={{
          fontSize: 'clamp(1.8rem, 6vw, 2.5rem)',
          color: '#2C3E50',
          marginBottom: '0.5rem',
          fontWeight: '700'
        }}>
          Random Practice
        </h1>
        <p style={{
          fontSize: 'clamp(1rem, 3vw, 1.15rem)',
          color: '#666',
          marginBottom: '2rem',
          lineHeight: '1.5'
        }}>
          Choose your level. 20 random questions, 3 lives. Let's go!
        </p>

        <div style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '1.25rem'
        }}>
          {LEVEL_CONFIG.map((level) => (
            <button
              key={level.id}
              onClick={() => setSelectedLevel(level)}
              style={{
                background: 'white',
                border: '2px solid #e2e8f0',
                borderRadius: '16px',
                padding: 'clamp(1.25rem, 4vw, 1.75rem)',
                cursor: 'pointer',
                textAlign: 'left',
                transition: 'all 0.2s',
                display: 'flex',
                alignItems: 'center',
                gap: '1.25rem',
                width: '100%',
                boxSizing: 'border-box'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = '#667eea';
                e.currentTarget.style.boxShadow = `0 4px 16px ${level.shadow}`;
                e.currentTarget.style.transform = 'translateY(-2px)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = '#e2e8f0';
                e.currentTarget.style.boxShadow = 'none';
                e.currentTarget.style.transform = 'translateY(0)';
              }}
            >
              {/* Level badge */}
              <div style={{
                background: level.gradient,
                borderRadius: '12px',
                width: 'clamp(55px, 15vw, 70px)',
                height: 'clamp(55px, 15vw, 70px)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 'clamp(1.5rem, 5vw, 2rem)',
                flexShrink: 0
              }}>
                {level.emoji}
              </div>

              {/* Text content */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{
                  display: 'flex',
                  alignItems: 'baseline',
                  gap: '0.5rem',
                  flexWrap: 'wrap',
                  marginBottom: '0.3rem'
                }}>
                  <span style={{
                    fontSize: 'clamp(1.15rem, 4vw, 1.35rem)',
                    fontWeight: '700',
                    color: '#2C3E50'
                  }}>
                    {level.title}
                  </span>
                  <span style={{
                    fontSize: 'clamp(0.85rem, 2.5vw, 0.95rem)',
                    fontWeight: '600',
                    color: '#667eea',
                    backgroundColor: '#f0f0ff',
                    padding: '2px 8px',
                    borderRadius: '6px'
                  }}>
                    {level.subtitle}
                  </span>
                </div>
                <p style={{
                  fontSize: 'clamp(0.85rem, 2.5vw, 0.95rem)',
                  color: '#666',
                  margin: 0,
                  lineHeight: '1.4'
                }}>
                  {level.description}
                </p>
              </div>

              {/* Arrow */}
              <div style={{
                fontSize: '1.5rem',
                color: '#cbd5e0',
                flexShrink: 0
              }}>
                →
              </div>
            </button>
          ))}

          {/* Divider */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '1rem',
            margin: '0.5rem 0'
          }}>
            <div style={{ flex: 1, height: '1px', backgroundColor: '#e2e8f0' }} />
            <span style={{ fontSize: '0.85rem', color: '#aaa', fontWeight: '500' }}>or</span>
            <div style={{ flex: 1, height: '1px', backgroundColor: '#e2e8f0' }} />
          </div>

          {/* Survival Mode Card */}
          <button
            onClick={() => setSurvivalMode(true)}
            style={{
              background: 'linear-gradient(135deg, #1a1a2e, #16213e)',
              border: '2px solid #e74c3c',
              borderRadius: '16px',
              padding: 'clamp(1.25rem, 4vw, 1.75rem)',
              cursor: 'pointer',
              textAlign: 'left',
              transition: 'all 0.2s',
              display: 'flex',
              alignItems: 'center',
              gap: '1.25rem',
              width: '100%',
              boxSizing: 'border-box'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.borderColor = '#ff6b6b';
              e.currentTarget.style.boxShadow = '0 4px 20px rgba(231, 76, 60, 0.4)';
              e.currentTarget.style.transform = 'translateY(-2px)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = '#e74c3c';
              e.currentTarget.style.boxShadow = 'none';
              e.currentTarget.style.transform = 'translateY(0)';
            }}
          >
            {/* Survival badge */}
            <div style={{
              background: 'linear-gradient(135deg, #e74c3c, #8e44ad)',
              borderRadius: '12px',
              width: 'clamp(55px, 15vw, 70px)',
              height: 'clamp(55px, 15vw, 70px)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 'clamp(1.5rem, 5vw, 2rem)',
              flexShrink: 0
            }}>
              ⚔️
            </div>

            {/* Text content */}
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{
                display: 'flex',
                alignItems: 'baseline',
                gap: '0.5rem',
                flexWrap: 'wrap',
                marginBottom: '0.3rem'
              }}>
                <span style={{
                  fontSize: 'clamp(1.15rem, 4vw, 1.35rem)',
                  fontWeight: '700',
                  color: 'white'
                }}>
                  Survival Mode
                </span>
                <span style={{
                  fontSize: 'clamp(0.75rem, 2vw, 0.8rem)',
                  fontWeight: '600',
                  color: '#e74c3c',
                  backgroundColor: 'rgba(231, 76, 60, 0.15)',
                  padding: '2px 8px',
                  borderRadius: '6px',
                  textTransform: 'uppercase',
                  letterSpacing: '0.5px'
                }}>
                  Challenge
                </span>
              </div>
              <p style={{
                fontSize: 'clamp(0.85rem, 2.5vw, 0.95rem)',
                color: '#adb5bd',
                margin: 0,
                lineHeight: '1.4'
              }}>
                5 lives. Start at Beginner, level up through Intermediate to Advanced. How far can you go?
              </p>
            </div>

            {/* Arrow */}
            <div style={{
              fontSize: '1.5rem',
              color: '#e74c3c',
              flexShrink: 0
            }}>
              →
            </div>
          </button>
        </div>
      </div>
    </div>
  );
}
