import { useEffect, useState, type FormEvent, type ReactNode } from 'react'
import { syncEnabled, getToken, login } from './api'
import { syncInboxOrders } from './emailSync'

export default function AuthGate({ children }: { children: ReactNode }) {
  const [authed, setAuthed] = useState(!syncEnabled || Boolean(getToken()))
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    setAuthed(!syncEnabled || Boolean(getToken()))
  }, [])

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError('')
    const ok = await login(email, password)
    if (ok) {
      setAuthed(true)
      syncInboxOrders()
    } else {
      setError('Wrong email or password, or the sync backend is unreachable.')
    }
  }

  if (authed) return <>{children}</>

  return (
    <div className="auth-gate">
      <form className="auth-form" onSubmit={handleSubmit}>
        <h1>Service Call Workflow</h1>
        <p className="muted">This app syncs real customer data from a connected inbox. Sign in with your admin account to continue.</p>
        <input
          type="email"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          autoFocus
          autoComplete="username"
        />
        <input
          type="password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete="current-password"
        />
        {error && <p className="auth-error">{error}</p>}
        <button type="submit" className="btn btn-primary">
          Sign In
        </button>
      </form>
    </div>
  )
}
