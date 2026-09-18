import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'

export default function SignUp() {
  const navigate = useNavigate()
  const [displayName, setDisplayName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [formError, setFormError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  // FR-02: client-side validation for fast feedback. The database re-checks
  // display_name length, and Supabase re-checks email + password rules.
  const validate = () => {
    const next: Record<string, string> = {}
    if (displayName.trim().length < 2 || displayName.trim().length > 50)
      next.displayName = 'Display name must be 2 to 50 characters.'
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
      next.email = 'Enter a valid email address.'
    if (password.length < 8)
      next.password = 'Password must be at least 8 characters.'
    if (password !== confirm)
      next.confirm = 'Passwords do not match.'
    setErrors(next)
    return Object.keys(next).length === 0
  }

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setFormError(null)
    if (!validate()) return

    setBusy(true)
    const { data, error } = await supabase.auth.signUp({
      email: email.trim().toLowerCase(),        // BR-02: email compared case-insensitively
      password,
      options: { data: { display_name: displayName.trim() } },
    })
    setBusy(false)

    if (error) {
      // FR-03 / AC-02: duplicate email must not create an account.
      setFormError(
        /already|registered|exists/i.test(error.message)
          ? 'That email address is already registered.'
          : error.message,
      )
      return
    }

    // FR-05: sign-up activates the session immediately and opens the timeline.
    if (data.session) navigate('/', { replace: true })
    else setFormError('Account created. Please log in.')
  }

  return (
    <div className="card form-card">
      <h1>Create your account</h1>
      <form onSubmit={onSubmit} noValidate>
        <label htmlFor="displayName">Display name</label>
        <input id="displayName" value={displayName} autoComplete="nickname"
               onChange={(e) => setDisplayName(e.target.value)}
               aria-invalid={!!errors.displayName} />
        {errors.displayName && <p className="field-error">{errors.displayName}</p>}

        <label htmlFor="email">Email</label>
        <input id="email" type="email" value={email} autoComplete="email"
               onChange={(e) => setEmail(e.target.value)}
               aria-invalid={!!errors.email} />
        {errors.email && <p className="field-error">{errors.email}</p>}

        <label htmlFor="password">Password</label>
        <input id="password" type="password" value={password} autoComplete="new-password"
               onChange={(e) => setPassword(e.target.value)}
               aria-invalid={!!errors.password} />
        {errors.password && <p className="field-error">{errors.password}</p>}

        <label htmlFor="confirm">Confirm password</label>
        <input id="confirm" type="password" value={confirm} autoComplete="new-password"
               onChange={(e) => setConfirm(e.target.value)}
               aria-invalid={!!errors.confirm} />
        {errors.confirm && <p className="field-error">{errors.confirm}</p>}

        {formError && <p className="form-error" role="alert">{formError}</p>}

        <button className="btn btn-primary btn-block" disabled={busy}>
          {busy ? 'Creating account…' : 'Sign up'}
        </button>
      </form>
      <p className="muted">Already have an account? <Link to="/login">Log in</Link></p>
    </div>
  )
}
