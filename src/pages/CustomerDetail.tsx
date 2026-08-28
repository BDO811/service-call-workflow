import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db'

export default function CustomerDetail() {
  const { id } = useParams()
  const customerId = Number(id)
  const navigate = useNavigate()

  const customer = useLiveQuery(() => db.customers.get(customerId), [customerId])
  const orders = useLiveQuery(
    () => db.workOrders.where('customerId').equals(customerId).reverse().sortBy('createdAt'),
    [customerId],
  )

  const [editing, setEditing] = useState(false)
  const [form, setForm] = useState({ name: '', phone: '', email: '', address: '', notes: '' })

  function startEdit() {
    if (!customer) return
    setForm({
      name: customer.name,
      phone: customer.phone,
      email: customer.email,
      address: customer.address,
      notes: customer.notes,
    })
    setEditing(true)
  }

  async function saveEdit() {
    if (!customer) return
    await db.customers.update(customer.id!, form)
    setEditing(false)
  }

  async function deleteCustomer() {
    if (!customer) return
    if (orders && orders.length > 0) {
      alert('This customer has work orders on file and cannot be deleted. Delete their work orders first.')
      return
    }
    if (!confirm('Delete this customer?')) return
    await db.customers.delete(customer.id!)
    navigate('/customers')
  }

  const systems = orders
    ? Array.from(
        new Set(
          orders
            .map((o) => {
              const parts = [o.brand, o.model].filter(Boolean).join(' ')
              return o.serial ? `${parts} (S/N ${o.serial})` : parts
            })
            .filter(Boolean),
        ),
      )
    : []

  if (!customer || !orders) return <p>Loading…</p>

  return (
    <div>
      <div className="page-header">
        <h1>{customer.name}</h1>
        <div className="header-actions">
          {editing ? (
            <button className="btn btn-primary" onClick={saveEdit}>
              Save
            </button>
          ) : (
            <button className="btn" onClick={startEdit}>
              Edit
            </button>
          )}
          <button className="btn btn-danger" onClick={deleteCustomer}>
            Delete
          </button>
        </div>
      </div>

      <div className="detail-grid">
        <section className="card">
          <h2>Contact Info</h2>
          {editing ? (
            <>
              <div className="field">
                <label>Name</label>
                <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
              </div>
              <div className="field">
                <label>Phone</label>
                <input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
              </div>
              <div className="field">
                <label>Email</label>
                <input value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
              </div>
              <div className="field">
                <label>Address</label>
                <input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} />
              </div>
              <div className="field">
                <label>Notes</label>
                <textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} rows={3} />
              </div>
            </>
          ) : (
            <dl className="detail-list">
              <dt>Phone</dt>
              <dd>{customer.phone ? <a href={`tel:${customer.phone}`}>{customer.phone}</a> : '—'}</dd>
              <dt>Email</dt>
              <dd>{customer.email ? <a href={`mailto:${customer.email}`}>{customer.email}</a> : '—'}</dd>
              <dt>Service Address</dt>
              <dd>{customer.address || '—'}</dd>
              <dt>Notes</dt>
              <dd>{customer.notes || '—'}</dd>
            </dl>
          )}
        </section>

        <section className="card">
          <h2>Systems on File</h2>
          {systems.length === 0 ? (
            <p className="muted">No equipment recorded yet.</p>
          ) : (
            <ul className="systems-list">
              {systems.map((s, i) => (
                <li key={i}>{s}</li>
              ))}
            </ul>
          )}
        </section>

        <section className="card card-full">
          <h2>Job History</h2>
          {orders.length === 0 ? (
            <p className="muted">No service orders yet.</p>
          ) : (
            <table className="table">
              <thead>
                <tr>
                  <th>Claim #</th>
                  <th>Covered Item</th>
                  <th>Dispatched By</th>
                  <th>Status</th>
                  <th>Created</th>
                </tr>
              </thead>
              <tbody>
                {orders.map((o) => (
                  <tr key={o.id}>
                    <td>
                      <Link to={`/orders/${o.id}`}>{o.claimNumber || `#${o.id}`}</Link>
                    </td>
                    <td>{[o.brand, o.model].filter(Boolean).join(' ') || '—'}</td>
                    <td className="wrap-cell">
                      {o.vendorName && <div>{o.vendorName}</div>}
                      {o.vendorContactName && <div>{o.vendorContactName}</div>}
                      {o.vendorEmail && (
                        <div>
                          <a href={`mailto:${o.vendorEmail}`}>{o.vendorEmail}</a>
                        </div>
                      )}
                      {!o.vendorName && !o.vendorContactName && !o.vendorEmail && '—'}
                    </td>
                    <td>
                      <span className={`status-pill status-${o.status.replace(/\s+/g, '-')}`}>{o.status}</span>
                    </td>
                    <td>{new Date(o.createdAt).toLocaleDateString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>
      </div>
    </div>
  )
}
