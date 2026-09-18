import { Routes, Route, Link, Navigate, useNavigate } from 'react-router-dom'
import { useAuth } from './context/AuthContext'
import RequireAuth from './components/RequireAuth'
import PublicTimeline from './pages/PublicTimeline'
import OwnTimeline from './pages/OwnTimeline'
import Login from './pages/Login'
import SignUp from './pages/SignUp'
import CreatePost from './pages/CreatePost'

function Nav() {
  const { session, displayName, signOut } = useAuth()
  const navigate = useNavigate()

  const handleSignOut = async () => {
    await signOut()
    navigate('/')            // FR-09: back to the public timeline
  }

  return (
    <header className="nav">
      <Link to="/" className="brand">SimpleSocial</Link>
      <nav>
        {session ? (
          <>
            <Link to="/me">My posts</Link>
            <Link to="/compose" className="btn btn-primary">Create post</Link>
            <span className="who">{displayName}</span>
            <button className="btn btn-ghost" onClick={handleSignOut}>Log out</button>
          </>
        ) : (
          <>
            <Link to="/login">Log in</Link>
            <Link to="/signup" className="btn btn-primary">Sign up</Link>
          </>
        )}
      </nav>
    </header>
  )
}

export default function App() {
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
