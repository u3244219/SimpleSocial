import { useState, type FormEvent } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { IconAlert } from '../components/Icons'

export default function Login() {
  const navigate = useNavigate()
  const location = useLocation()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError(null)
    setBusy(true)

    const { error: authError } = await supabase.auth.signInWithPassword({
      email: email.trim().toLowerCase(),
      password,
    })
    setBusy(false)

    if (authError) {
      // FR-07: never reveal which field was wrong.
      setError('Invalid email or password.')
      return
    }

    // FR-10: return the user to the page they originally asked for.
    const from = (location.state as { from?: string } | null)?.from ?? '/'
    navigate(from, { replace: true })
  }

  return (
    <div className="card form-card">
      <h1>Welcome back</h1>
      <p className="page-sub">Log in to publish and manage your posts.</p>

      <form onSubmit={onSubmit} noValidate>
        <div className="field">
          <label htmlFor="email">Email</label>
          <input id="email" type="email" value={email} autoComplete="email"
                 placeholder="you@example.com"
                 onChange={(e) => setEmail(e.target.value)} />
        </div>

        <div className="field">
          <label htmlFor="password">Password</label>
          <input id="password" type="password" value={password} autoComplete="current-password"
                 placeholder="••••••••"
                 onChange={(e) => setPassword(e.target.value)} />
        </div>

        {error && (
          <div className="form-error row" role="alert">
            <IconAlert />
            <span>{error}</span>
          </div>
        )}

        <button className="btn btn-primary btn-block" disabled={busy} style={{ marginTop: 18 }}>
          {busy ? <><span className="spinner" /> Logging in</> : 'Log in'}
        </button>
      </form>

      <hr className="divider" />
      <p className="center muted small" style={{ margin: 0 }}>
        No account? <Link to="/signup">Sign up</Link>
      </p>
    </div>
  )
}
