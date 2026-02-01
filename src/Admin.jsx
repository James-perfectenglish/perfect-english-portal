import { useState, useEffect } from 'react'
import { supabase } from './supabaseClient'

function Admin() {
  const [students, setStudents] = useState([])
  const [loading, setLoading] = useState(true)
  const [session, setSession] = useState(null)

  useEffect(() => {
    // Check if user is logged in
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
    })

    fetchStudents()
  }, [])

  const fetchStudents = async () => {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .order('created_at', { ascending: false })

    if (data) {
      setStudents(data)
    }
    setLoading(false)
  }

  const approveStudent = async (studentId) => {
    const { error } = await supabase
      .from('profiles')
      .update({ approved: true })
      .eq('id', studentId)

    if (!error) {
      fetchStudents() // Refresh the list
    }
  }

  const updateLevel = async (studentId, newLevel) => {
    const { error } = await supabase
      .from('profiles')
      .update({ level: newLevel })
      .eq('id', studentId)

    if (!error) {
      fetchStudents()
    }
  }

  const handleLogout = async () => {
    await supabase.auth.signOut()
    window.location.href = '/login'
  }

  if (!session) {
    return (
      <div style={{ textAlign: 'center', marginTop: '50px' }}>
        <p>Please log in to access admin panel</p>
        <a href="/login">Go to Login</a>
      </div>
    )
  }

  if (loading) {
    return <div style={{ textAlign: 'center', marginTop: '50px' }}>Loading...</div>
  }

  return (
    <div style={{ maxWidth: '1000px', margin: '50px auto', padding: '20px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '30px' }}>
        <h1>Teacher Admin - Student Management</h1>
        <button onClick={handleLogout} style={{ padding: '10px 20px', backgroundColor: '#f44336', color: 'white', border: 'none', cursor: 'pointer' }}>
          Logout
        </button>
      </div>

      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr style={{ backgroundColor: '#f5f5f5' }}>
            <th style={{ padding: '10px', textAlign: 'left', border: '1px solid #ddd' }}>Name</th>
            <th style={{ padding: '10px', textAlign: 'left', border: '1px solid #ddd' }}>Email</th>
            <th style={{ padding: '10px', textAlign: 'left', border: '1px solid #ddd' }}>Level</th>
            <th style={{ padding: '10px', textAlign: 'left', border: '1px solid #ddd' }}>Status</th>
            <th style={{ padding: '10px', textAlign: 'left', border: '1px solid #ddd' }}>Actions</th>
          </tr>
        </thead>
        <tbody>
          {students.map((student) => (
            <tr key={student.id}>
              <td style={{ padding: '10px', border: '1px solid #ddd' }}>{student.full_name}</td>
              <td style={{ padding: '10px', border: '1px solid #ddd' }}>{student.email}</td>
              <td style={{ padding: '10px', border: '1px solid #ddd' }}>
                <select
                  value={student.level || ''}
                  onChange={(e) => updateLevel(student.id, e.target.value)}
                  style={{ padding: '5px' }}
                >
                  <option value="">Not assigned</option>
                  <option value="A2">A2</option>
                  <option value="B1">B1</option>
                  <option value="B2">B2</option>
                  <option value="C1">C1</option>
                  <option value="C2">C2</option>
                </select>
              </td>
              <td style={{ padding: '10px', border: '1px solid #ddd' }}>
                {student.approved ? '✅ Approved' : '⏳ Pending'}
              </td>
              <td style={{ padding: '10px', border: '1px solid #ddd' }}>
                {!student.approved && (
                  <button
                    onClick={() => approveStudent(student.id)}
                    style={{ padding: '5px 15px', backgroundColor: '#4CAF50', color: 'white', border: 'none', cursor: 'pointer' }}
                  >
                    Approve
                  </button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {students.length === 0 && (
        <p style={{ textAlign: 'center', marginTop: '20px' }}>No students yet</p>
      )}
    </div>
  )
}

export default Admin