import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { IconAlert } from '../components/Icons'

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

  const field = (
    id: string, label: string, type: string, value: string,
    set: (v: string) => void, autoComplete: string, placeholder?: string,
  ) => (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      <input id={id} type={type} value={value} autoComplete={autoComplete}
             placeholder={placeholder}
             onChange={(e) => set(e.target.value)}
             aria-invalid={!!errors[id]} />
      {errors[id] && <p className="field-error">{errors[id]}</p>}
    </div>
  )

  return (
    <div className="card form-card">
      <h1>Create your account</h1>
      <p className="page-sub">You can start posting straight away.</p>

      <form onSubmit={onSubmit} noValidate>
        {field('displayName', 'Display name', 'text', displayName, setDisplayName, 'nickname', 'Ada Lovelace')}
        {field('email', 'Email', 'email', email, setEmail, 'email', 'you@example.com')}
        {field('password', 'Password', 'password', password, setPassword, 'new-password', 'At least 8 characters')}
        {field('confirm', 'Confirm password', 'password', confirm, setConfirm, 'new-password', '••••••••')}

        {formError && (
          <div className="form-error row" role="alert">
            <IconAlert />
            <span>{formError}</span>
          </div>
        )}

        <button className="btn btn-primary btn-block" disabled={busy} style={{ marginTop: 18 }}>
          {busy ? <><span className="spinner" /> Creating account</> : 'Sign up'}
        </button>
      </form>

      <hr className="divider" />
      <p className="center muted small" style={{ margin: 0 }}>
        Already have an account? <Link to="/login">Log in</Link>
      </p>
    </div>
  )
}
