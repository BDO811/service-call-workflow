import { useEffect, useState, type FormEvent, type ReactNode } from 'react'
import { syncEnabled, getToken, login } from './api'
import { localGateEnabled, isLocallyAuthed, localLogin } from './localAuth'
import { syncInboxOrders } from './emailSync'

function computeAuthed(): boolean {
  if (syncEnabled) return Boolean(getToken())
  if (localGateEnabled) return isLocallyAuthed()
  return true
}

export default function AuthGate({ children }: { children: ReactNode }) {
  const [authed, setAuthed] = useState(computeAuthed())
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    setAuthed(computeAuthed())
  }, [])

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError('')
    if (syncEnabled) {
      const ok = await login(email, password)
      if (ok) {
        setAuthed(true)
        syncInboxOrders()
      } else {
        setError('Wrong email or password, or the sync backend is unreachable.')
      }
      return
    }
    const ok = await localLogin(password)
    if (ok) {
      setAuthed(true)
    } else {
      setError('Wrong password.')
    }
  }

  if (authed) return <>{children}</>

  return (
    <div className="auth-gate">
      <form className="auth-form" onSubmit={handleSubmit}>
        <h1>Service Call Workflow</h1>
        <p className="muted">
          {syncEnabled
            ? 'This app syncs real customer data from a connected inbox. Sign in with your admin account to continue.'
            : 'Enter the admin password to continue.'}
        </p>
        {syncEnabled && (
          <input
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoFocus
            autoComplete="username"
          />
        )}
        <input
          type="password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoFocus={!syncEnabled}
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
