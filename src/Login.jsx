import { useState, useEffect, useRef } from 'react'
import { supabase } from './supabaseClient'

const TURNSTILE_SITE_KEY = '0x4AAAAAAChUFyqzDKDJIHBT'

function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')
  const [turnstileToken, setTurnstileToken] = useState('')
  const widgetRef = useRef(null)

  useEffect(() => {
    const script = document.createElement('script')
    script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js'
    script.async = true
    script.defer = true
    document.head.appendChild(script)

    script.onload = () => {
      if (window.turnstile && widgetRef.current) {
        window.turnstile.render(widgetRef.current, {
          sitekey: TURNSTILE_SITE_KEY,
          callback: (token) => setTurnstileToken(token),
          'expired-callback': () => setTurnstileToken(''),
          'error-callback': () => setTurnstileToken(''),
        })
      }
    }

    return () => {
      document.head.removeChild(script)
    }
  }, [])

  const handleLogin = async (e) => {
    e.preventDefault()

    if (!turnstileToken) {
      setMessage('Error: Please complete the security check.')
      return
    }

    setLoading(true)
    setMessage('')

    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
      options: {
        captchaToken: turnstileToken,
      }
    })

    if (error) {
      setMessage('Error: ' + error.message)
      if (window.turnstile && widgetRef.current) {
        window.turnstile.reset(widgetRef.current)
        setTurnstileToken('')
      }
    } else {
      setMessage('Login successful!')
      window.location.href = '/'
    }
    setLoading(false)
  }

  return (
    <div style={{ maxWidth: '400px', margin: '50px auto', padding: '20px' }}>
      <h1 style={{ fontSize: '2rem', marginBottom: '2rem', color: '#2C3E50' }}>
        Login to Perfect <span style={{ color: '#3498DB' }}>English</span>
      </h1>
      
      <form onSubmit={handleLogin}>
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
            style={{ width: '100%', padding: '8px', marginTop: '5px' }}
          />
        </div>

        {/* Turnstile widget */}
        <div ref={widgetRef} style={{ marginBottom: '15px' }} />

        <button 
          type="submit" 
          disabled={loading || !turnstileToken}
          style={{ 
            width: '100%', 
            padding: '10px', 
            backgroundColor: loading || !turnstileToken ? '#aaa' : '#4CAF50',
            color: 'white',
            border: 'none',
            cursor: loading || !turnstileToken ? 'not-allowed' : 'pointer'
          }}
        >
          {loading ? 'Loading...' : 'Login'}
        </button>
      </form>

      {message && (
        <p style={{ marginTop: '15px', color: message.includes('Error') ? 'red' : 'green' }}>
          {message}
        </p>
      )}

      <p style={{ marginTop: '20px' }}>
        Don't have an account? <a href="/signup">Sign up here</a>
      </p>
    </div>
  )
}

export default Login
