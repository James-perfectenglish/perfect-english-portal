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
import WordSnake from './WordSnake'
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

// ── Compute effectiveProfile for teacher track simulation ──────────────────
// Spanish override sets level so PracticePage/Blurt/WordSnake detect it correctly.
function buildEffectiveProfile(profile, teacherTrack) {
  if (!profile || !teacherTrack || teacherTrack === 'en') return profile
  if (teacherTrack === 'spanish') return { ...profile, level: 'Spanish', tracks: ['spanish'] }
  return { ...profile, tracks: [teacherTrack] }
}

function Dashboard({ session }) {
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)
  const [globalLang, setGlobalLang] = useState(
    () => localStorage.getItem('pep_teach_lang') || 'en'
  )
  const [teacherTrack, setTeacherTrack] = useState(
    () => localStorage.getItem('pep_teacher_track') || 'en'
  )
  const navigate = useNavigate()

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

  const cycleTrack = () => {
    const idx = TRACK_CYCLE.indexOf(teacherTrack)
    const next = TRACK_CYCLE[(idx + 1) % TRACK_CYCLE.length]
    setTeacherTrack(next)
    localStorage.setItem('pep_teacher_track', next)
    // keep globalLang in sync for TeacherBrowse
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
        <p>You'll receive an email once your account has been approved and you can start learning.</p>
        <button onClick={handleLogout} style={{ marginTop: '20px', padding: '10px 20px', backgroundColor: '#f44336', color: 'white', border: 'none', cursor: 'pointer', borderRadius: '6px' }}>
          Logout
        </button>
      </div>
    )
  }

  const isTeacher = profile?.is_teacher || false
  const effectiveProfile = isTeacher ? buildEffectiveProfile(profile, teacherTrack) : profile

  return (
    <div>
      {/* HEADER */}
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
              <li><Link to="/"          style={{ textDecoration: 'none', color: '#4a5568', fontWeight: '500', fontSize: 'clamp(0.875rem, 2vw, 1rem)' }}>Home</Link></li>
              <li><Link to="/practice"  style={{ textDecoration: 'none', color: '#4a5568', fontWeight: '500', fontSize: 'clamp(0.875rem, 2vw, 1rem)' }}>Test</Link></li>
              <li><Link to="/exercises" style={{ textDecoration: 'none', color: '#4a5568', fontWeight: '500', fontSize: 'clamp(0.875rem, 2vw, 1rem)' }}>Exercises</Link></li>
            </ul>
          </nav>
        </div>
      </header>

      {/* ROUTES */}
      <Routes>
        <Route path="/" element={
          <StudentDashboard
            profile={effectiveProfile}
            session={session}
            handleLogout={handleLogout}
            globalLang={globalLang}
            onToggleLang={isTeacher ? toggleLang : undefined}
            onBrowseClick={isTeacher ? () => navigate('/teacher/browse') : undefined}
            onTeacherClick={isTeacher ? () => navigate('/teacher') : undefined}
            teacherTrack={isTeacher ? teacherTrack : undefined}
            onCycleTrack={isTeacher ? cycleTrack : undefined}
          />
        } />
        <Route path="/practice" element={
          <PracticePageWrapper
            profile={effectiveProfile}
            isTeacher={isTeacher}
            teacherTrack={teacherTrack}
            onCycleTrack={isTeacher ? cycleTrack : undefined}
            globalLang={globalLang}
            toggleLang={toggleLang}
          />
        } />
        <Route path="/exercises" element={
          <ExercisesPage
            profile={effectiveProfile}
            globalLang={globalLang}
            toggleLang={toggleLang}
            isTeacher={isTeacher}
            teacherTrack={teacherTrack}
            onCycleTrack={isTeacher ? cycleTrack : undefined}
          />
        } />
        <Route path="/lyrics"    element={<LyricsExercise user={session.user} />} />
        <Route path="/blurt"     element={
          <Blurt
            user={session.user}
            profileOverride={isTeacher && teacherTrack !== 'en' ? effectiveProfile : null}
          />
        } />
        <Route path="/teacher" element={
          isTeacher
            ? <TeacherDashboard
                profile={profile}
                handleLogout={handleLogout}
                globalLang={globalLang}
                onToggleLang={toggleLang}
                onBrowseClick={() => navigate('/teacher/browse')}
                onHomeClick={() => navigate('/')}
                teacherTrack={teacherTrack}
                onCycleTrack={cycleTrack}
              />
            : <Navigate to="/" />
        } />
        <Route path="/teacher/browse" element={
          isTeacher
            ? <TeacherBrowse user={session.user} globalLang={globalLang} />
            : <Navigate to="/" />
        } />
        <Route path="/wordsnake" element={
          <WordSnake
            user={session.user}
            profileOverride={isTeacher && teacherTrack !== 'en' ? effectiveProfile : null}
          />
        } />
      </Routes>
    </div>
  )
}

function ExercisesPage({ profile, globalLang, toggleLang, isTeacher, teacherTrack, onCycleTrack }) {
  const navigate = useNavigate()
  return (
    <ExerciseList
      userLevel={profile.level}
      userTracks={profile.tracks || []}
      isTeacher={isTeacher}
      onTeacherClick={isTeacher ? () => navigate('/teacher') : undefined}
      onBrowseClick={isTeacher ? () => navigate('/teacher/browse') : undefined}
      globalLang={globalLang}
      onToggleLang={isTeacher ? toggleLang : undefined}
      teacherTrack={teacherTrack}
      onCycleTrack={onCycleTrack}
    />
  )
}

function PracticePageWrapper({ profile, isTeacher, teacherTrack, onCycleTrack, globalLang, toggleLang }) {
  const navigate = useNavigate()
  return (
    <PracticePage
      profile={profile}
      isTeacher={isTeacher}
      teacherTrack={teacherTrack}
      onCycleTrack={onCycleTrack}
      onTeacherClick={isTeacher ? () => navigate('/teacher') : undefined}
      onBrowseClick={isTeacher ? () => navigate('/teacher/browse') : undefined}
      globalLang={globalLang}
      onToggleLang={isTeacher ? toggleLang : undefined}
    />
  )
}

export default App
