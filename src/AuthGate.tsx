import { useEffect, useState, type FormEvent, type ReactNode } from 'react'
import { syncEnabled, getToken, login } from './api'
import { syncInboxOrders } from './emailSync'

export default function AuthGate({ children }: { children: ReactNode }) {
  const [authed, setAuthed] = useState(!syncEnabled || Boolean(getToken()))
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    setAuthed(!syncEnabled || Boolean(getToken()))
  }, [])

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError('')
    const ok = await login(password)
    if (ok) {
      setAuthed(true)
      syncInboxOrders()
    } else {
      setError('Wrong password, or the sync backend is unreachable.')
    }
  }

  if (authed) return <>{children}</>

  return (
    <div className="auth-gate">
      <form className="auth-form" onSubmit={handleSubmit}>
        <h1>Service Call Workflow</h1>
        <p className="muted">This app syncs real customer data from a connected inbox. Enter the admin password to continue.</p>
        <input
          type="password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoFocus
        />
        {error && <p className="auth-error">{error}</p>}
        <button type="submit" className="btn btn-primary">
          Unlock
        </button>
      </form>
    </div>
  )
}
