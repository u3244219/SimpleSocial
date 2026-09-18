import { Routes, Route, Link, Navigate, useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from './context/AuthContext'
import RequireAuth from './components/RequireAuth'
import PublicTimeline from './pages/PublicTimeline'
import OwnTimeline from './pages/OwnTimeline'
import Login from './pages/Login'
import SignUp from './pages/SignUp'
import CreatePost from './pages/CreatePost'
import Reels from './pages/Reels'
import { IconHome, IconPlus, IconReels, IconUser } from './components/Icons'

function Nav() {
  const { session, displayName, signOut } = useAuth()
  const navigate = useNavigate()
  const { pathname } = useLocation()

  const handleSignOut = async () => {
    await signOut()
    navigate('/')            // FR-09: back to the public timeline
  }

  // The label sits in its own span so narrow screens can drop the text and
  // keep the icon, rather than collapsing the whole link.
  const link = (to: string, label: string, icon: React.ReactNode) => (
    <Link to={to} className={`nav-link${pathname === to ? ' active' : ''}`} title={label}>
      {icon}
      <span className="nav-label">{label}</span>
    </Link>
  )

  return (
    <header className="nav">
      <Link to="/" className="brand">
        <span className="brand-mark" />
        <span>SimpleSocial</span>
      </Link>

      <nav className="nav-links">
        {link('/', 'Home', <IconHome size={16} />)}
        {link('/reels', 'Reels', <IconReels size={16} />)}

        {session ? (
          <>
            {link('/me', 'You', <IconUser size={16} />)}
            <Link to="/compose" className="btn btn-primary btn-sm" style={{ marginLeft: 4 }}>
              <IconPlus size={15} />
              <span className="nav-label">Post</span>
            </Link>
            <button className="avatar" onClick={handleSignOut}
                    title={`${displayName ?? 'Account'} — click to log out`}
                    aria-label="Log out" style={{ border: 0, cursor: 'pointer', marginLeft: 4 }}>
              {(displayName ?? '?').slice(0, 1)}
            </button>
          </>
        ) : (
          <>
            <Link to="/login" className="nav-link">Log in</Link>
            <Link to="/signup" className="btn btn-primary btn-sm">Sign up</Link>
          </>
        )}
      </nav>
    </header>
  )
}

export default function App() {
  const { pathname } = useLocation()

  // Reels is a full-bleed, fixed-position view; it replaces the page chrome.
  if (pathname === '/reels') return <Reels />

  return (
    <div className="app">
      <Nav />
      <main>
        <Routes>
          <Route path="/" element={<PublicTimeline />} />
          <Route path="/login" element={<Login />} />
          <Route path="/signup" element={<SignUp />} />
          <Route path="/me" element={<RequireAuth><OwnTimeline /></RequireAuth>} />
          <Route path="/compose" element={<RequireAuth><CreatePost /></RequireAuth>} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
    </div>
  )
}
