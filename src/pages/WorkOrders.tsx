import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, STATUSES, logActivity, type Status, type WorkOrder } from '../db'

export default function WorkOrders() {
  const workOrders = useLiveQuery(() => db.workOrders.toArray(), [])
  const customers = useLiveQuery(() => db.customers.toArray(), [])
  const [view, setView] = useState<'board' | 'list'>('board')
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<Status | 'all'>('all')

  const customerName = (id: number) => customers?.find((c) => c.id === id)?.name ?? 'Unknown'

  const filtered = useMemo(() => {
    if (!workOrders) return []
    const q = search.trim().toLowerCase()
    return workOrders.filter((o) => {
      if (statusFilter !== 'all' && o.status !== statusFilter) return false
      if (!q) return true
      return (
        o.claimNumber.toLowerCase().includes(q) ||
        o.technicianName.toLowerCase().includes(q) ||
        customerName(o.customerId).toLowerCase().includes(q)
      )
    })
  }, [workOrders, search, statusFilter, customers])

  async function moveStatus(order: WorkOrder, status: Status) {
    if (order.status === status) return
    await db.workOrders.update(order.id!, {
      status,
      updatedAt: Date.now(),
      activityLog: logActivity(order, `Status changed to "${status}".`),
    })
  }

  if (!workOrders || !customers) return <p>Loading…</p>

  return (
    <div>
      <div className="page-header">
        <h1>Work Orders</h1>
        <Link className="btn btn-primary" to="/orders/new">
          + New Service Order
        </Link>
      </div>

      <div className="toolbar">
        <input
          className="search-input"
          placeholder="Search by claim #, customer, or technician…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as Status | 'all')}>
          <option value="all">All statuses</option>
          {STATUSES.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
        <div className="view-toggle">
          <button className={view === 'board' ? 'active' : ''} onClick={() => setView('board')}>
            Board
          </button>
          <button className={view === 'list' ? 'active' : ''} onClick={() => setView('list')}>
            List
          </button>
        </div>
      </div>

      {view === 'board' ? (
        <div className="kanban">
          {STATUSES.map((status) => (
            <div
              key={status}
              className="kanban-col"
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                const id = Number(e.dataTransfer.getData('text/plain'))
                const order = workOrders.find((o) => o.id === id)
                if (order) moveStatus(order, status)
              }}
            >
              <div className="kanban-col-header">
                <span>{status}</span>
                <span className="count">{filtered.filter((o) => o.status === status).length}</span>
              </div>
              <div className="kanban-col-body">
                {filtered
                  .filter((o) => o.status === status)
                  .map((o) => (
                    <div
                      key={o.id}
                      className="kanban-card"
                      draggable
                      onDragStart={(e) => e.dataTransfer.setData('text/plain', String(o.id))}
                    >
                      <Link to={`/orders/${o.id}`} className="kanban-card-title">
                        {o.claimNumber || `#${o.id}`}
                      </Link>
                      <div className="kanban-card-sub">{customerName(o.customerId)}</div>
                      {o.technicianName && <div className="kanban-card-tech">Tech: {o.technicianName}</div>}
                      {o.source === 'email' && (
                        <div className="kanban-card-badges">
                          <span className="badge badge-email">{o.vendorName || 'Email'}</span>
                          {o.needsReview && <span className="badge badge-review">Needs Review</span>}
                        </div>
                      )}
                    </div>
                  ))}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <table className="table">
          <thead>
            <tr>
              <th>Claim #</th>
              <th>Customer</th>
              <th>Covered Item</th>
              <th>Status</th>
              <th>Source</th>
              <th>Technician</th>
              <th>Updated</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((o) => (
              <tr key={o.id}>
                <td>
                  <Link to={`/orders/${o.id}`}>{o.claimNumber || `#${o.id}`}</Link>
                </td>
                <td>{customerName(o.customerId)}</td>
                <td>
                  {[o.brand, o.model].filter(Boolean).join(' ') || '—'}
                </td>
                <td>
                  <span className={`status-pill status-${o.status.replace(/\s+/g, '-')}`}>{o.status}</span>
                </td>
                <td>
                  {o.source === 'email' ? (
                    <span className="badge badge-email">{o.vendorName || 'Email'}</span>
                  ) : (
                    '—'
                  )}
                  {o.needsReview && <span className="badge badge-review">Needs Review</span>}
                </td>
                <td>{o.technicianName || '—'}</td>
                <td>{new Date(o.updatedAt).toLocaleString()}</td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={7} className="muted">
                  No matching work orders.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      )}
    </div>
  )
}
