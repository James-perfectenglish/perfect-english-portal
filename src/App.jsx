import { BrowserRouter, Routes, Route, Navigate, useNavigate } from 'react-router-dom'
import { useState, useEffect } from 'react'
import { supabase } from './supabaseClient'
import Login from './Login'
import Signup from './Signup'
import Admin from './Admin'
import ExerciseList from './ExerciseList'
import PracticePage from './components/PracticePage'
import StudentDashboard from './StudentDashboard'
import TeacherDashboard from './TeacherDashboard'
import Progress from './Progress'
import LyricsExercise from './LyricsExercise'
import Blurt from './Blurt'
import TeacherBrowse from './TeacherBrowse'
import WordSnake from './WordSnake'
import NavBar from './components/NavBar'
import TeacherSidebar from './components/TeacherSidebar'
import PronunciationExercise from './PronunciationExercise'
import { TRACK_CYCLE } from './components/TeacherToolbar'

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

function buildEffectiveProfile(profile, teacherTrack) {
  if (!profile || !teacherTrack || teacherTrack === 'en') return profile
  if (teacherTrack === 'spanish') return { ...profile, level: 'Spanish', tracks: ['spanish'] }
  return { ...profile, tracks: [teacherTrack] }
}

function PresentModeBar({ onExit }) {
  return (
    <div style={{
      background: 'linear-gradient(135deg, #553C9A, #667eea)',
      color: 'white',
      padding: '6px 16px',
      fontSize: '0.8rem',
      fontWeight: 600,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      position: 'sticky',
      top: 0,
      zIndex: 2000,
    }}>
      <span>▶ Present Mode — students see this view</span>
      <button
        onClick={onExit}
        style={{
          background: 'rgba(255,255,255,0.2)',
          border: 'none',
          color: 'white',
          borderRadius: '4px',
          padding: '3px 10px',
          fontSize: '0.78rem',
          fontWeight: 600,
          cursor: 'pointer',
        }}
      >
        ✕ Exit
      </button>
    </div>
  )
}

function Dashboard({ session }) {
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)
  const [presentMode, setPresentMode] = useState(false)
  const [globalLang, setGlobalLang] = useState(
    () => localStorage.getItem('pep_teach_lang') || 'en'
  )
  const [teacherTrack, setTeacherTrack] = useState(
    () => localStorage.getItem('pep_teacher_track') || 'en'
  )
  const navigate = useNavigate()

  useEffect(() => {
    const fetchProfile = async () => {
      const { data } = await supabase.from('profiles').select('*').eq('id', session.user.id).single()
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

  const cycleTrack = () => {
    const idx = TRACK_CYCLE.indexOf(teacherTrack)
    const next = TRACK_CYCLE[(idx + 1) % TRACK_CYCLE.length]
    setTeacherTrack(next)
    localStorage.setItem('pep_teacher_track', next)
    const lang = next === 'spanish' ? 'es' : 'en'
    setGlobalLang(lang)
    localStorage.setItem('pep_teach_lang', lang)
  }

  if (loading) return <div style={{ textAlign: 'center', marginTop: '50px' }}>Loading...</div>

  if (!profile?.approved) {
    return (
      <div style={{ maxWidth: '600px', margin: '50px auto', padding: '20px', textAlign: 'center' }}>
        <h1>Account Pending Approval</h1>
        <p>Thank you for signing up! Your account is waiting for teacher approval.</p>
        <p>You'll receive an email once your account has been approved.</p>
        <button onClick={handleLogout} style={{ marginTop: '20px', padding: '10px 20px', backgroundColor: '#f44336', color: 'white', border: 'none', cursor: 'pointer', borderRadius: '6px' }}>
          Logout
        </button>
      </div>
    )
  }

  const isTeacher = profile?.is_teacher || false
  const effectiveProfile = isTeacher ? buildEffectiveProfile(profile, teacherTrack) : profile

  // ── Teacher layout ────────────────────────────────────────────────────────
  if (isTeacher) {

    // Present Mode — purple bar + student NavBar + routes, no teacher chrome
    if (presentMode) {
      return (
        <div>
          <PresentModeBar onExit={() => setPresentMode(false)} />
          <NavBar isTeacher={false} />
          <div className="pep-page-content">
            <StudentRoutes
              session={session}
              profile={effectiveProfile}
              handleLogout={handleLogout}
            />
          </div>
        </div>
      )
    }

    // Normal teacher view — sidebar + header + routes
    return (
      <div style={{ display: 'flex', alignItems: 'flex-start' }}>
        <TeacherSidebar
          teacherTrack={teacherTrack}
          onCycleTrack={cycleTrack}
          onBrowseClick={() => navigate('/teacher/browse')}
          onTeacherClick={() => navigate('/teacher')}
          onPresentMode={() => setPresentMode(true)}
        />
        <div style={{ flex: 1, minWidth: 0 }}>
          <header style={{ background: 'white', boxShadow: '0 2px 10px rgba(0,0,0,0.05)', position: 'sticky', top: 0, zIndex: 1000, width: '100%' }}>
            <div style={{ width: '100%', padding: '1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', boxSizing: 'border-box' }}>
              <a href="https://perfect-english.org" target="_blank" rel="noopener noreferrer" style={{ textDecoration: 'none' }}>
                <h1 style={{ fontSize: 'clamp(1.2rem, 4vw, 1.8rem)', fontWeight: '700', margin: 0 }}>
                  <span style={{ color: '#2C3E50' }}>Perfect</span>
                  <span style={{ color: '#3498DB' }}> English</span>
                </h1>
              </a>
              <nav>
                <ul style={{ listStyle: 'none', display: 'flex', gap: 'clamp(0.5rem, 3vw, 2rem)', margin: 0, padding: 0, alignItems: 'center' }}>
                  <li><a href="/" style={{ textDecoration: 'none', color: '#4a5568', fontWeight: '500', fontSize: 'clamp(0.875rem, 2vw, 1rem)' }} onClick={e => { e.preventDefault(); navigate('/') }}>Home</a></li>
                  <li><a href="/practise" style={{ textDecoration: 'none', color: '#4a5568', fontWeight: '500', fontSize: 'clamp(0.875rem, 2vw, 1rem)' }} onClick={e => { e.preventDefault(); navigate('/practise') }}>Practise</a></li>
                  <li><a href="/learn" style={{ textDecoration: 'none', color: '#4a5568', fontWeight: '500', fontSize: 'clamp(0.875rem, 2vw, 1rem)' }} onClick={e => { e.preventDefault(); navigate('/learn') }}>Exercises</a></li>
                </ul>
              </nav>
            </div>
          </header>
          <TeacherRoutes
            session={session}
            profile={profile}
            effectiveProfile={effectiveProfile}
            teacherTrack={teacherTrack}
            globalLang={globalLang}
            toggleLang={toggleLang}
            cycleTrack={cycleTrack}
            handleLogout={handleLogout}
            navigate={navigate}
          />
        </div>
      </div>
    )
  }

  // ── Student layout ────────────────────────────────────────────────────────
  return (
    <div>
      <NavBar isTeacher={false} />
      <StudentRoutes
        session={session}
        profile={effectiveProfile}
        handleLogout={handleLogout}
      />
    </div>
  )
}

// ── Student routes ────────────────────────────────────────────────────────────
function StudentRoutes({ session, profile, handleLogout }) {
  return (
    <Routes>
      <Route path="/" element={
        <StudentDashboard profile={profile} session={session} />
      } />
      <Route path="/practise" element={
        <PracticePage profile={profile} isTeacher={false} />
      } />
      <Route path="/practice" element={<Navigate to="/practise" replace />} />
      <Route path="/learn" element={
        <ExerciseList
          userLevel={profile.level}
          userTracks={profile.tracks || []}
          defaultTab="learn"
        />
      } />
      <Route path="/play" element={
        <ExerciseList
          userLevel={profile.level}
          userTracks={profile.tracks || []}
          defaultTab="play"
        />
      } />
      <Route path="/listen" element={
        <ExerciseList
          userLevel={profile.level}
          userTracks={profile.tracks || []}
          defaultTab="listen"
        />
      } />
      <Route path="/speak" element={
        <PronunciationExercise profile={profile} />
      } />
      <Route path="/progress" element={
        <Progress session={session} profile={profile} handleLogout={handleLogout} />
      } />
      <Route path="/lyrics"    element={<LyricsExercise user={session.user} />} />
      <Route path="/blurt"     element={<Blurt user={session.user} />} />
      <Route path="/wordsnake" element={<WordSnake user={session.user} />} />
      <Route path="/exercises" element={<Navigate to="/learn" replace />} />
      <Route path="*"          element={<Navigate to="/" replace />} />
    </Routes>
  )
}

// ── Teacher routes ────────────────────────────────────────────────────────────
function TeacherRoutes({ session, profile, effectiveProfile, teacherTrack, globalLang, toggleLang, cycleTrack, handleLogout, navigate }) {
  return (
    <Routes>
      <Route path="/" element={
        <StudentDashboard profile={effectiveProfile} session={session} />
      } />
      <Route path="/practise" element={
        <PracticePage
          profile={effectiveProfile}
          isTeacher={false}
        />
      } />
      <Route path="/practice" element={<Navigate to="/practise" replace />} />
      <Route path="/learn" element={
        <ExerciseList
          userLevel={effectiveProfile.level}
          userTracks={effectiveProfile.tracks || []}
          isTeacher={true}
          defaultTab="learn"
        />
      } />
      <Route path="/play" element={
        <ExerciseList
          userLevel={effectiveProfile.level}
          userTracks={effectiveProfile.tracks || []}
          isTeacher={true}
          defaultTab="play"
        />
      } />
      <Route path="/listen" element={
        <ExerciseList
          userLevel={effectiveProfile.level}
          userTracks={effectiveProfile.tracks || []}
          isTeacher={true}
          defaultTab="listen"
        />
      } />
      <Route path="/speak" element={
        <PronunciationExercise profile={effectiveProfile} />
      } />
      <Route path="/exercises" element={<Navigate to="/learn" replace />} />
      <Route path="/progress" element={
        <Progress session={session} profile={profile} handleLogout={handleLogout} />
      } />
      <Route path="/lyrics"    element={<LyricsExercise user={session.user} />} />
      <Route path="/blurt"     element={
        <Blurt user={session.user} profileOverride={teacherTrack !== 'en' ? effectiveProfile : null} />
      } />
      <Route path="/wordsnake" element={
        <WordSnake user={session.user} profileOverride={teacherTrack !== 'en' ? effectiveProfile : null} />
      } />
      <Route path="/teacher" element={
        <TeacherDashboard
          profile={profile}
          handleLogout={handleLogout}
          globalLang={globalLang}
          onToggleLang={toggleLang}
          onBrowseClick={() => navigate('/teacher/browse')}
          onHomeClick={() => navigate('/')}
          teacherTrack={teacherTrack}
          onCycleTrack={cycleTrack}
        />
      } />
      <Route path="/teacher/browse" element={
        <TeacherBrowse user={session.user} globalLang={globalLang} />
      } />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

export default App
