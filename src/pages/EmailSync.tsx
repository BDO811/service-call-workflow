import { useState, type FormEvent } from 'react'
import { ingestTestEmail } from '../api'
import { syncInboxOrders } from '../emailSync'

export default function EmailSync() {
  const [lastSync, setLastSync] = useState<{ at: number; imported: number } | null>(null)
  const [syncing, setSyncing] = useState(false)

  const [fromHeader, setFromHeader] = useState('')
  const [subject, setSubject] = useState('')
  const [text, setText] = useState('')
  const [testResult, setTestResult] = useState('')

  async function runSync() {
    setSyncing(true)
    try {
      const imported = await syncInboxOrders()
      setLastSync({ at: Date.now(), imported })
    } finally {
      setSyncing(false)
    }
  }

  async function handleTestIngest(e: FormEvent) {
    e.preventDefault()
    setTestResult('')
    if (!fromHeader.trim() || !text.trim()) {
      setTestResult('From header and email body are required.')
      return
    }
    const result = await ingestTestEmail(fromHeader, subject, text)
    if (!result) {
      setTestResult('Ingest failed — check the backend is reachable and you are logged in.')
      return
    }
    setTestResult('Parsed and queued. Click "Sync now" below to pull it into Work Orders.')
    setFromHeader('')
    setSubject('')
    setText('')
  }

  return (
    <div>
      <div className="page-header">
        <h1>Email Sync</h1>
      </div>

      <section className="card" style={{ marginBottom: 16 }}>
        <h2>Status</h2>
        <p className="muted">
          A backend worker parses vendor dispatch emails the moment they arrive and holds them until this app
          pulls them in. Emails become work orders automatically the next time you open the app, or every 60
          seconds while it's open. Orders imported this way are flagged "Needs Review" until you confirm the
          details.
        </p>
        <div className="form-actions">
          <button className="btn btn-primary" onClick={runSync} disabled={syncing}>
            {syncing ? 'Syncing…' : 'Sync now'}
          </button>
        </div>
        {lastSync && (
          <p className="muted">
            Last sync: {new Date(lastSync.at).toLocaleTimeString()} — imported {lastSync.imported} order
            {lastSync.imported === 1 ? '' : 's'}.
          </p>
        )}
      </section>

      <section className="card">
        <h2>Test the parser (no live inbox connected yet)</h2>
        <p className="muted">
          Paste a vendor email here to see how it gets parsed, before a real inbox is wired up to send emails
          automatically.
        </p>
        <form className="form" style={{ maxWidth: 'none', margin: 0 }} onSubmit={handleTestIngest}>
          <div className="field">
            <label>From header (e.g. "Sam Robinson from Armadillo Home Solutions &lt;dispatch@armadillo.one&gt;")</label>
            <input value={fromHeader} onChange={(e) => setFromHeader(e.target.value)} />
          </div>
          <div className="field">
            <label>Subject</label>
            <input value={subject} onChange={(e) => setSubject(e.target.value)} />
          </div>
          <div className="field">
            <label>Email body</label>
            <textarea value={text} onChange={(e) => setText(e.target.value)} rows={14} />
          </div>
          {testResult && <p className="muted">{testResult}</p>}
          <div className="form-actions">
            <button type="submit" className="btn">
              Parse & Queue
            </button>
          </div>
        </form>
      </section>
    </div>
  )
}
