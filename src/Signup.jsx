import { useState } from 'react'
import { supabase } from './supabaseClient'

function Signup() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [fullName, setFullName] = useState('')
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')

  const handleSignup = async (e) => {
    e.preventDefault()
    setLoading(true)
    setMessage('')

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: fullName,
        }
      }
    })

    if (error) {
      setMessage('Error: ' + error.message)
    } else {
      setMessage('Success! Please check your email to confirm your account.')
    }
    setLoading(false)
  }

  return (
    <div style={{ maxWidth: '400px', margin: '50px auto', padding: '20px' }}>
      <h1>Sign Up for Perfect <span style={{ color: '#3498DB' }}>English</span></h1>
      
      <form onSubmit={handleSignup}>
        <div style={{ marginBottom: '15px' }}>
          <label>Full Name:</label>
          <input
            type="text"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            required
            style={{ width: '100%', padding: '8px', marginTop: '5px' }}
          />
        </div>

        <div style={{ marginBottom: '15px' }}>
          <label>Email:</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            style={{ width: '100%', padding: '8px', marginTop: '5px' }}
          />
        </div>

        <div style={{ marginBottom: '15px' }}>
          <label>Password:</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength="6"
            style={{ width: '100%', padding: '8px', marginTop: '5px' }}
          />
        </div>

        <button 
          type="submit" 
          disabled={loading}
          style={{ 
            width: '100%', 
            padding: '10px', 
            backgroundColor: '#2196F3',
            color: 'white',
            border: 'none',
            cursor: 'pointer'
          }}
        >
          {loading ? 'Loading...' : 'Sign Up'}
        </button>
      </form>

      {message && (
        <p style={{ marginTop: '15px', color: message.includes('Error') ? 'red' : 'green' }}>
          {message}
        </p>
      )}

      <p style={{ marginTop: '20px' }}>
        Already have an account? <a href="/login">Login here</a>
      </p>
    </div>
  )
}

export default Signup