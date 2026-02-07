import { BrowserRouter, Routes, Route, Navigate, Link } from 'react-router-dom'
import { useState, useEffect } from 'react'
import { supabase } from './supabaseClient'
import Login from './Login'
import Signup from './Signup'
import Admin from './Admin'
import ExerciseList from './ExerciseList'
import PracticePage from './components/PracticePage'

function App() {
  const [session, setSession] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // Check current session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      setLoading(false)
    })

    // Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
    })

    return () => subscription.unsubscribe()
  }, [])

  if (loading) {
    return <div style={{ textAlign: 'center', marginTop: '50px' }}>Loading...</div>
  }

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/signup" element={<Signup />} />
        <Route path="/admin" element={<Admin />} />
        <Route 
          path="/*" 
          element={
            session ? (
              <Dashboard session={session} />
            ) : (
              <Navigate to="/login" />
            )
          } 
        />
      </Routes>
    </BrowserRouter>
  )
}

// Dashboard component with approval check and routing
function Dashboard({ session }) {
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // Fetch user profile
    const fetchProfile = async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', session.user.id)
        .single()

      if (data) {
        setProfile(data)
      }
      setLoading(false)
    }

    fetchProfile()
  }, [session])

  const handleLogout = async () => {
    await supabase.auth.signOut()
  }

  if (loading) {
    return <div style={{ textAlign: 'center', marginTop: '50px' }}>Loading...</div>
  }

  // Check if user is approved
  if (!profile?.approved) {
    return (
      <div style={{ maxWidth: '600px', margin: '50px auto', padding: '20px', textAlign: 'center' }}>
        <h1>Account Pending Approval</h1>
        <p>Thank you for signing up! Your account is waiting for teacher approval.</p>
        <p>You'll receive an email once your account has been approved and you can start learning.</p>
        <button 
          onClick={handleLogout}
          style={{ 
            marginTop: '20px',
            padding: '10px 20px', 
            backgroundColor: '#f44336',
            color: 'white',
            border: 'none',
            cursor: 'pointer',
            borderRadius: '6px'
          }}
        >
          Logout
        </button>
      </div>
    )
  }

  // Approved user - show app with navigation
  return (
    <div>
      {/* Header with Navigation */}
      <header style={{
        background: 'white',
        boxShadow: '0 2px 10px rgba(0,0,0,0.05)',
        position: 'sticky',
        top: 0,
        zIndex: 1000,
        marginBottom: '2rem'
      }}>
        <div style={{
          maxWidth: '1400px',
          margin: '0 auto',
          padding: '1rem 2rem',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <Link to="/" style={{ textDecoration: 'none', display: 'flex', alignItems: 'center' }}>
            <h1 style={{ fontSize: '1.8rem', fontWeight: '700', margin: 0 }}>
              <span style={{ color: '#2C3E50' }}>Perfect</span>
              <span style={{ color: '#3498DB' }}> English</span>
            </h1>
          </Link>
          
          <nav>
            <ul style={{ 
              listStyle: 'none', 
              display: 'flex', 
              gap: '2rem', 
              margin: 0, 
              padding: 0 
            }}>
              <li>
                <Link to="/" style={{ 
                  textDecoration: 'none', 
                  color: '#4a5568', 
                  fontWeight: '500',
                  transition: 'color 0.3s'
                }}>
                  Home
                </Link>
              </li>
              <li>
                <Link to="/practice" style={{ 
                  textDecoration: 'none', 
                  color: '#4a5568', 
                  fontWeight: '500',
                  transition: 'color 0.3s'
                }}>
                  Practice
                </Link>
              </li>
              <li>
                <Link to="/exercises" style={{ 
                  textDecoration: 'none', 
                  color: '#4a5568', 
                  fontWeight: '500',
                  transition: 'color 0.3s'
                }}>
                  Exercises
                </Link>
              </li>
            </ul>
          </nav>

          <button 
            onClick={handleLogout}
            style={{ 
              padding: '0.5rem 1rem', 
              backgroundColor: '#f44336',
              color: 'white',
              border: 'none',
              cursor: 'pointer',
              borderRadius: '6px',
              fontWeight: '500'
            }}
          >
            Logout
          </button>
        </div>
      </header>

      {/* Main Content Area with Routes */}
      <Routes>
        <Route path="/" element={<HomePage profile={profile} />} />
        <Route path="/practice" element={<PracticePage />} />
        <Route path="/exercises" element={<ExercisesPage profile={profile} />} />
      </Routes>
    </div>
  )
}

// Home Page
function HomePage({ profile }) {
  return (
    <div style={{ maxWidth: '900px', margin: '0 auto', padding: '2rem' }}>
      <h1 style={{ fontSize: '2.5rem', marginBottom: '1rem', color: '#2C3E50' }}>
        Welcome back, {profile.full_name}!
      </h1>
      
      <div style={{
        backgroundColor: '#e8f4f8',
        padding: '1.5rem',
        borderRadius: '12px',
        marginBottom: '2rem',
        borderLeft: '4px solid #3498DB'
      }}>
        <p style={{ fontSize: '1.1rem', margin: 0, color: '#2C3E50' }}>
          <strong>Your Level:</strong> {profile.level || 'Not assigned yet'}
        </p>
      </div>

      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
        gap: '1.5rem',
        marginTop: '2rem'
      }}>
        {/* Practice Card */}
        <Link to="/practice" style={{ textDecoration: 'none' }}>
          <div style={{
            backgroundColor: 'white',
            padding: '2rem',
            borderRadius: '12px',
            boxShadow: '0 4px 6px rgba(0,0,0,0.1)',
            transition: 'transform 0.2s, box-shadow 0.2s',
            cursor: 'pointer',
            border: '2px solid transparent'
          }}
          onMouseOver={(e) => {
            e.currentTarget.style.transform = 'translateY(-4px)';
            e.currentTarget.style.boxShadow = '0 8px 12px rgba(0,0,0,0.15)';
            e.currentTarget.style.borderColor = '#3498DB';
          }}
          onMouseOut={(e) => {
            e.currentTarget.style.transform = 'translateY(0)';
            e.currentTarget.style.boxShadow = '0 4px 6px rgba(0,0,0,0.1)';
            e.currentTarget.style.borderColor = 'transparent';
          }}>
            <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>🎯</div>
            <h2 style={{ fontSize: '1.5rem', color: '#2C3E50', marginBottom: '0.5rem' }}>
              Random Practice
            </h2>
            <p style={{ color: '#4a5568', fontSize: '1rem', lineHeight: '1.6' }}>
              Test your skills with 20 random questions mixing all topics. Every time is different!
            </p>
          </div>
        </Link>

        {/* Exercises Card */}
        <Link to="/exercises" style={{ textDecoration: 'none' }}>
          <div style={{
            backgroundColor: 'white',
            padding: '2rem',
            borderRadius: '12px',
            boxShadow: '0 4px 6px rgba(0,0,0,0.1)',
            transition: 'transform 0.2s, box-shadow 0.2s',
            cursor: 'pointer',
            border: '2px solid transparent'
          }}
          onMouseOver={(e) => {
            e.currentTarget.style.transform = 'translateY(-4px)';
            e.currentTarget.style.boxShadow = '0 8px 12px rgba(0,0,0,0.15)';
            e.currentTarget.style.borderColor = '#3498DB';
          }}
          onMouseOut={(e) => {
            e.currentTarget.style.transform = 'translateY(0)';
            e.currentTarget.style.boxShadow = '0 4px 6px rgba(0,0,0,0.1)';
            e.currentTarget.style.borderColor = 'transparent';
          }}>
            <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>📚</div>
            <h2 style={{ fontSize: '1.5rem', color: '#2C3E50', marginBottom: '0.5rem' }}>
              All Exercises
            </h2>
            <p style={{ color: '#4a5568', fontSize: '1rem', lineHeight: '1.6' }}>
              Browse all available exercises organized by topic and type.
            </p>
          </div>
        </Link>
      </div>

      <div style={{
        marginTop: '3rem',
        padding: '2rem',
        backgroundColor: '#f5f7fa',
        borderRadius: '12px'
      }}>
        <h3 style={{ fontSize: '1.3rem', color: '#2C3E50', marginBottom: '1rem' }}>
          💡 Getting Started
        </h3>
        <p style={{ fontSize: '1rem', color: '#4a5568', lineHeight: '1.7', margin: 0 }}>
          New to the platform? Try the <strong>Random Practice</strong> first to see what level you're at. 
          Then explore specific exercises to work on areas where you need more practice. Remember: 
          making mistakes is part of learning!
        </p>
      </div>
    </div>
  )
}

// Exercises Page (your existing exercise list)
function ExercisesPage({ profile }) {
  return (
    <div style={{ maxWidth: '900px', margin: '0 auto', padding: '2rem' }}>
      <h1 style={{ fontSize: '2.5rem', marginBottom: '2rem', color: '#2C3E50' }}>
        All Exercises
      </h1>
      <ExerciseList userLevel={profile.level} />
    </div>
  )
}

export default App