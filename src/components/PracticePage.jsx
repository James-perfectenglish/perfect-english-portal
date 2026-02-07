import { useState } from 'react';
import RandomPracticeExercise from './RandomPracticeExercise.jsx';
export default function PracticePage() {
  const [showExercise, setShowExercise] = useState(false);

  if (showExercise) {
    return <RandomPracticeExercise />;
  }

  return (
    <div style={{ maxWidth: '900px', margin: '0 auto', padding: '2rem' }}>
      <h1 style={{ fontSize: '2.5rem', color: '#2C3E50', marginBottom: '1rem' }}>
        Random Practice
      </h1>
      
      <div style={{
        backgroundColor: '#f5f7fa',
        padding: '2rem',
        borderRadius: '12px',
        marginBottom: '2rem'
      }}>
        <h2 style={{ fontSize: '1.5rem', color: '#2C3E50', marginBottom: '1rem' }}>
          How it works
        </h2>
        <ul style={{ 
          fontSize: '1.1rem', 
          lineHeight: '1.8',
          color: '#4a5568',
          paddingLeft: '1.5rem'
        }}>
          <li>You'll get <strong>20 random questions</strong> mixing grammar, vocabulary, and structures</li>
          <li>Questions are at your <strong>Intermediate (B1-B2) level</strong></li>
          <li>You have <strong>3 lives</strong> ❤️❤️❤️ - lose one for each wrong answer</li>
          <li>Get a <strong>hint on your last life</strong> to help you out</li>
          <li><strong>Immediate feedback</strong> after each answer so you learn as you go</li>
          <li>Every time you play, you'll get <strong>different questions</strong> - so it stays fresh!</li>
        </ul>
      </div>

      <div style={{
        backgroundColor: '#fff3cd',
        padding: '1.5rem',
        borderRadius: '12px',
        marginBottom: '2rem',
        border: '1px solid #ffc107'
      }}>
        <p style={{ fontSize: '1rem', color: '#856404', margin: 0 }}>
          💡 <strong>Pro tip:</strong> Don't worry about making mistakes! This is practice. 
          The more you try, the more you learn. Take your time and read the feedback carefully.
        </p>
      </div>

      <div style={{ textAlign: 'center' }}>
        <button
          onClick={() => setShowExercise(true)}
          style={{
            padding: '1.25rem 3rem',
            fontSize: '1.3rem',
            backgroundColor: '#3498DB',
            color: 'white',
            border: 'none',
            borderRadius: '12px',
            cursor: 'pointer',
            fontWeight: '600',
            boxShadow: '0 4px 6px rgba(0,0,0,0.1)',
            transition: 'transform 0.2s, box-shadow 0.2s'
          }}
          onMouseOver={(e) => {
            e.target.style.transform = 'translateY(-2px)';
            e.target.style.boxShadow = '0 6px 12px rgba(0,0,0,0.15)';
          }}
          onMouseOut={(e) => {
            e.target.style.transform = 'translateY(0)';
            e.target.style.boxShadow = '0 4px 6px rgba(0,0,0,0.1)';
          }}
        >
          Start Practice →
        </button>
      </div>

      <div style={{
        marginTop: '3rem',
        padding: '2rem',
        backgroundColor: '#e8f4f8',
        borderRadius: '12px',
        borderLeft: '4px solid #3498DB'
      }}>
        <h3 style={{ fontSize: '1.2rem', color: '#2C3E50', marginBottom: '1rem' }}>
          Why Random Practice?
        </h3>
        <p style={{ fontSize: '1rem', color: '#4a5568', lineHeight: '1.7', margin: 0 }}>
          Research shows that <strong>mixed practice</strong> (switching between different topics) 
          helps you remember better than studying one topic at a time. By randomly mixing grammar 
          and vocabulary, your brain works harder and learns deeper. Plus, it's more like real 
          English - where you need everything at once!
        </p>
      </div>
    </div>
  );
}