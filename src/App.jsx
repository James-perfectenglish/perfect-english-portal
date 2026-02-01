import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { useState, useEffect } from 'react'
import { supabase } from './supabaseClient'
import Login from './Login'
import Signup from './Signup'
import Admin from './Admin'
import ExerciseList from './ExerciseList'
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
          path="/" 
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

// Dashboard component with approval check
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
            cursor: 'pointer'
          }}
        >
          Logout
        </button>
      </div>
    )
  }

  // Approved user - show dashboard
  return (
    <div style={{ maxWidth: '800px', margin: '50px auto', padding: '20px' }}>
      <h1>Perfect English Student Portal</h1>
      <p>Welcome, {profile.full_name}!</p>
      <p>Email: {session.user.email}</p>
      <p>Your Level: {profile.level || 'Not assigned yet'}</p>
      <ExerciseList userLevel={profile.level} />
      <button 
        onClick={handleLogout}
        style={{ 
          padding: '10px 20px', 
          backgroundColor: '#f44336',
          color: 'white',
          border: 'none',
          cursor: 'pointer'
        }}
      >
        Logout
      </button>
    </div>
  )
}
export default App