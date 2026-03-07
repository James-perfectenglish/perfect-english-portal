import { BrowserRouter, Routes, Route, Navigate, Link, useNavigate } from 'react-router-dom'
import { useState, useEffect } from 'react'
import { supabase } from './supabaseClient'
import Login from './Login'
import Signup from './Signup'
import Admin from './Admin'
import ExerciseList from './ExerciseList'
import PracticePage from './components/PracticePage'
import StudentDashboard from './StudentDashboard'
import TeacherDashboard from './TeacherDashboard'
import LyricsExercise from './LyricsExercise'
import Blurt from './Blurt'
import TeacherBrowse from './TeacherBrowse'

function App() {
  const [session, setSession] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      setLoading(false)
    })
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
    })
    return () => subscription.unsubscribe()
  }, [])

  if (loading) return <div style={{ textAlign: 'center', marginTop: '50px' }}>Loading...</div>

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login"  element={<Login />} />
        <Route path="/signup" element={<Signup />} />
        <Route path="/admin"  element={<Admin />} />
        <Route path="/*"      element={session ? <Dashboard session={session} /> : <Navigate to="/login" />} />
      </Routes>
    </BrowserRouter>
  )
}

// ── Teacher toolbar (header buttons, all pages) ───────────────────────────────

function TeacherToolbar({ globalLang, toggleLang }) {
  const btnStyle = {
    height: '34px',
    borderRadius: '8px',
    background: '#f0f0f5',
    border: 'none',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: '#4a5568',
  }
  return (
    <div style={{ display: 'flex', gap: '6px', alignItems: 'center', marginLeft: '1rem' }}>
      {/* Language toggle */}
      <button
        onClick={toggleLang}
        title={globalLang === 'en' ? 'Switch to Spanish mode' : 'Switch to English mode'}
        style={{ ...btnStyle, width: '34px', fontSize: '1.1rem' }}
      >
        {globalLang === 'en' ? '🇬🇧' : '🇪🇸'}
      </button>

      {/* Browse */}
      <Link
        to="/teacher/browse"
        style={{ ...btnStyle, padding: '0 10px', textDecoration: 'none', fontSize: '0.75rem', fontWeight: 700, whiteSpace: 'nowrap' }}
      >
        🔍 Browse
      </Link>

      {/* Teacher dashboard */}
      <Link
        to="/teacher"
        style={{ ...btnStyle, width: '34px', fontSize: '1rem', textDecoration: 'none' }}
      >
        👨‍🏫
      </Link>
    </div>
  )
}

// ── Dashboard (authenticated shell) ──────────────────────────────────────────

function Dashboard({ session }) {
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)
  const [globalLang, setGlobalLang] = useState(
    () => localStorage.getItem('pep_teach_lang') || 'en'
  )

  useEffect(() => {
    const fetchProfile = async () => {
      const { data } = await supabase
        .from('profiles').select('*')
        .eq('id', session.user.id).single()
      if (data) setProfile(data)
      setLoading(false)
    }
    fetchProfile()
  }, [session])

  const handleLogout = async () => { await supabase.auth.signOut() }

  const toggleLang = () => {
    const next = globalLang === 'en' ? 'es' : 'en'
    setGlobalLang(next)
    localStorage.setItem('pep_teach_lang', next)
  }

  if (loading) return <div style={{ textAlign: 'center', marginTop: '50px' }}>Loading...</div>

  if (!profile?.approved) {
    return (
      <div style={{ maxWidth: '600px', margin: '50px auto', padding: '20px', textAlign: 'center' }}>
        <h1>Account Pending Approval</h1>
        <p>Thank you for signing up! Your account is waiting for teacher approval.</p>
        <p>You'll receive an email once your account has been approved and you can start learning.</p>
        <button onClick={handleLogout} style={{ marginTop: '20px', padding: '10px 20px', backgroundColor: '#f44336', color: 'white', border: 'none', cursor: 'pointer', borderRadius: '6px' }}>
          Logout
        </button>
      </div>
    )
  }

  const isTeacher = profile?.is_teacher || false

  return (
    <div>
      {/* HEADER */}
      <header style={{ background: 'white', boxShadow: '0 2px 10px rgba(0,0,0,0.05)', position: 'sticky', top: 0, zIndex: 1000, width: '100%' }}>
        <div style={{ width: '100%', padding: '0.75rem 1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', boxSizing: 'border-box' }}>
          <a href="https://perfect-english.org" target="_blank" rel="noopener noreferrer" style={{ textDecoration: 'none' }}>
            <h1 style={{ fontSize: 'clamp(1.2rem, 4vw, 1.8rem)', fontWeight: '700', margin: 0 }}>
              <span style={{ color: '#2C3E50' }}>Perfect</span>
              <span style={{ color: '#3498DB' }}> English</span>
            </h1>
          </a>
          <div style={{ display: 'flex', alignItems: 'center' }}>
            <nav>
              <ul style={{ listStyle: 'none', display: 'flex', gap: 'clamp(0.5rem, 3vw, 2rem)', margin: 0, padding: 0, alignItems: 'center' }}>
                <li><Link to="/"          style={{ textDecoration: 'none', color: '#4a5568', fontWeight: '500', fontSize: 'clamp(0.875rem, 2vw, 1rem)' }}>Home</Link></li>
                <li><Link to="/practice"  style={{ textDecoration: 'none', color: '#4a5568', fontWeight: '500', fontSize: 'clamp(0.875rem, 2vw, 1rem)' }}>Test</Link></li>
                <li><Link to="/exercises" style={{ textDecoration: 'none', color: '#4a5568', fontWeight: '500', fontSize: 'clamp(0.875rem, 2vw, 1rem)' }}>Exercises</Link></li>
              </ul>
            </nav>
            {/* Teacher-only toolbar — visible on all pages */}
            {isTeacher && (
              <TeacherToolbar globalLang={globalLang} toggleLang={toggleLang} />
            )}
          </div>
        </div>
      </header>

      {/* ROUTES */}
      <Routes>
        <Route path="/"                element={<StudentDashboard profile={profile} session={session} handleLogout={handleLogout} />} />
        <Route path="/practice"        element={<PracticePageWrapper profile={profile} />} />
        <Route path="/exercises"       element={<ExercisesPage profile={profile} globalLang={globalLang} toggleLang={toggleLang} />} />
        <Route path="/lyrics"          element={<LyricsExercise user={session.user} />} />
        <Route path="/blurt"           element={<Blurt user={session.user} />} />
        <Route path="/teacher"         element={isTeacher ? <TeacherDashboard profile={profile} handleLogout={handleLogout} /> : <Navigate to="/" />} />
        <Route path="/teacher/browse"  element={isTeacher ? <TeacherBrowse user={session.user} globalLang={globalLang} /> : <Navigate to="/" />} />
      </Routes>
    </div>
  )
}

function ExercisesPage({ profile, globalLang, toggleLang }) {
  return (
    <ExerciseList
      userLevel={profile.level}
      userTracks={profile.tracks || []}
      isTeacher={profile?.is_teacher || false}
    />
  )
}

function PracticePageWrapper({ profile }) {
  const navigate = useNavigate()
  return (
    <PracticePage
      isTeacher={profile?.is_teacher || false}
      onTeacherClick={() => navigate('/teacher')}
    />
  )
}

export default App
