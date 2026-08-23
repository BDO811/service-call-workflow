import { useMemo, useRef, useState, type ChangeEvent } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, DOC_TYPES, STATUSES, logActivity, type DocType, type Status } from '../db'

export default function WorkOrderDetail() {
  const { id } = useParams()
  const orderId = Number(id)
  const navigate = useNavigate()

  const order = useLiveQuery(() => db.workOrders.get(orderId), [orderId])
  const customer = useLiveQuery(
    () => (order ? db.customers.get(order.customerId) : undefined),
    [order?.customerId],
  )
  const documents = useLiveQuery(() => db.documents.where('workOrderId').equals(orderId).toArray(), [orderId])

  const [techName, setTechName] = useState('')
  const [techContact, setTechContact] = useState('')
  const [docType, setDocType] = useState<DocType>('other')
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [showReport, setShowReport] = useState(false)

  const techNameValue = techName || order?.technicianName || ''
  const techContactValue = techContact || order?.technicianContact || ''

  const reportText = useMemo(() => {
    if (!order || !customer) return ''
    return [
      `SERVICE REPORT — Claim #${order.claimNumber || order.id}`,
      ``,
      `Customer: ${customer.name}`,
      `Address: ${customer.address}`,
      `Phone: ${customer.phone}    Email: ${customer.email}`,
      ``,
      `Covered Item: ${[order.brand, order.model].filter(Boolean).join(' ')} ${order.serial ? `(S/N ${order.serial})` : ''}`,
      `Reported Problem: ${order.reportedProblem || '—'}`,
      `Appointment Window: ${order.appointmentPreference || '—'}`,
      `Authorization Limit: ${order.authorizationLimit || '—'}`,
      `Repair Rate: ${order.repairRate || '—'}`,
      ``,
      `Notes: ${order.notes || '—'}`,
    ].join('\n')
  }, [order, customer])

  if (!order || !customer || !documents) return <p>Loading…</p>

  async function updateStatus(status: Status) {
    if (!order || status === order.status) return
    await db.workOrders.update(order.id!, {
      status,
      updatedAt: Date.now(),
      activityLog: logActivity(order, `Status changed to "${status}".`),
    })
  }

  async function saveTechnician() {
    if (!order) return
    await db.workOrders.update(order.id!, {
      technicianName: techNameValue,
      technicianContact: techContactValue,
      updatedAt: Date.now(),
      activityLog: logActivity(order, `Technician set to ${techNameValue || '—'}.`),
    })
    setTechName('')
    setTechContact('')
  }

  async function sendToTechnician() {
    if (!order) return
    const subject = encodeURIComponent(`Service Order — Claim #${order.claimNumber || order.id}`)
    const body = encodeURIComponent(reportText)
    const now = Date.now()
    await db.workOrders.update(order.id!, {
      sentToTechnicianAt: now,
      updatedAt: now,
      activityLog: logActivity(order, `Report sent to technician${techContactValue ? ` (${techContactValue})` : ''}.`),
    })
    window.location.href = `mailto:${order.technicianContact || ''}?subject=${subject}&body=${body}`
  }

  async function handleFiles(e: ChangeEvent<HTMLInputElement>) {
    const files = e.target.files
    if (!files || files.length === 0 || !order) return
    for (const file of Array.from(files)) {
      await db.documents.add({
        workOrderId: order.id!,
        name: file.name,
        docType,
        fileBlob: file,
        uploadedAt: Date.now(),
      })
    }
    await db.workOrders.update(order.id!, {
      updatedAt: Date.now(),
      activityLog: logActivity(order, `Attached ${files.length} document(s).`),
    })
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  function downloadDoc(doc: { name: string; fileBlob: Blob }) {
    const url = URL.createObjectURL(doc.fileBlob)
    const a = document.createElement('a')
    a.href = url
    a.download = doc.name
    a.click()
    URL.revokeObjectURL(url)
  }

  async function deleteDoc(docId: number) {
    await db.documents.delete(docId)
  }

  async function deleteOrder() {
    if (!order) return
    if (!confirm('Delete this work order? This cannot be undone.')) return
    await db.documents.where('workOrderId').equals(order.id!).delete()
    await db.workOrders.delete(order.id!)
    navigate('/orders')
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>Claim #{order.claimNumber || order.id}</h1>
          <Link to={`/customers/${customer.id}`} className="muted-link">
            {customer.name}
          </Link>
        </div>
        <div className="header-actions">
          <select value={order.status} onChange={(e) => updateStatus(e.target.value as Status)}>
            {STATUSES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
          <button className="btn btn-danger" onClick={deleteOrder}>
            Delete
          </button>
        </div>
      </div>

      <div className="detail-grid">
        <section className="card">
          <h2>Job Details</h2>
          <dl className="detail-list">
            <dt>Covered Item</dt>
            <dd>{[order.brand, order.model].filter(Boolean).join(' ') || '—'} {order.serial && `(S/N ${order.serial})`}</dd>
            <dt>Reported Problem</dt>
            <dd>{order.reportedProblem || '—'}</dd>
            <dt>Appointment Preference</dt>
            <dd>{order.appointmentPreference || '—'}</dd>
            <dt>Authorization Limit</dt>
            <dd>{order.authorizationLimit || '—'}</dd>
            <dt>Repair Rate</dt>
            <dd>{order.repairRate || '—'}</dd>
            <dt>Notes</dt>
            <dd>{order.notes || '—'}</dd>
          </dl>
        </section>

        <section className="card">
          <h2>Technician & Report</h2>
          <div className="field">
            <label>Technician Name</label>
            <input value={techNameValue} onChange={(e) => setTechName(e.target.value)} />
          </div>
          <div className="field">
            <label>Technician Contact (email/phone)</label>
            <input value={techContactValue} onChange={(e) => setTechContact(e.target.value)} />
          </div>
          <div className="form-actions">
            <button className="btn" onClick={saveTechnician}>
              Save Technician
            </button>
          </div>
          <hr />
          <div className="form-actions">
            <button className="btn" onClick={() => setShowReport((v) => !v)}>
              {showReport ? 'Hide Report' : 'Generate Report'}
            </button>
            <button className="btn btn-primary" onClick={sendToTechnician}>
              Send to Technician
            </button>
          </div>
          {order.sentToTechnicianAt && (
            <p className="muted">Sent to technician on {new Date(order.sentToTechnicianAt).toLocaleString()}</p>
          )}
          {showReport && (
            <pre className="report-preview" id="printable-report">
              {reportText}
            </pre>
          )}
        </section>

        <section className="card">
          <h2>Attached Documents</h2>
          <div className="field-row">
            <select value={docType} onChange={(e) => setDocType(e.target.value as DocType)}>
              {DOC_TYPES.map((t) => (
                <option key={t} value={t}>
                  {t.replace('_', ' ')}
                </option>
              ))}
            </select>
            <input ref={fileInputRef} type="file" multiple onChange={handleFiles} />
          </div>
          <ul className="doc-list">
            {documents.map((d) => (
              <li key={d.id}>
                <span className="doc-name">{d.name}</span>
                <span className="doc-type">{d.docType.replace('_', ' ')}</span>
                <span className="doc-date">{new Date(d.uploadedAt).toLocaleDateString()}</span>
                <button className="link-btn" onClick={() => downloadDoc(d)}>
                  Download
                </button>
                <button className="link-btn danger" onClick={() => deleteDoc(d.id!)}>
                  Remove
                </button>
              </li>
            ))}
            {documents.length === 0 && <li className="muted">No documents attached.</li>}
          </ul>
        </section>

        <section className="card">
          <h2>Activity Log</h2>
          <ul className="activity-list">
            {[...order.activityLog].reverse().map((a, i) => (
              <li key={i}>
                <span className="activity-ts">{new Date(a.ts).toLocaleString()}</span>
                <span>{a.note}</span>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </div>
  )
}
