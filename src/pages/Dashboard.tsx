import { Link } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, STATUSES } from '../db'

export default function Dashboard() {
  const workOrders = useLiveQuery(() => db.workOrders.toArray(), [])
  const customers = useLiveQuery(() => db.customers.toArray(), [])

  if (!workOrders || !customers) return <p>Loading…</p>

  const counts = STATUSES.map((status) => ({
    status,
    count: workOrders.filter((o) => o.status === status).length,
  }))

  const recent = [...workOrders]
    .sort((a, b) => b.updatedAt - a.updatedAt)
    .slice(0, 8)

  const customerFor = (id: number) => customers.find((c) => c.id === id)

  return (
    <div>
      <div className="page-header">
        <h1>Dashboard</h1>
        <Link className="btn btn-primary" to="/orders/new">
          + New Service Order
        </Link>
      </div>

      <div className="stat-grid">
        {counts.map(({ status, count }) => (
          <div key={status} className="stat-card">
            <div className="stat-number">{count}</div>
            <div className="stat-label">{status}</div>
          </div>
        ))}
      </div>

      <h2>Recent Activity</h2>
      {recent.length === 0 ? (
        <p className="muted">No work orders yet. Create your first service order to get started.</p>
      ) : (
        <table className="table">
          <thead>
            <tr>
              <th>Dispatched By</th>
              <th>Claim #</th>
              <th>Customer</th>
              <th>Issue</th>
              <th>Preferred Dates</th>
              <th>Cost</th>
              <th>Status</th>
              <th>Last Updated</th>
            </tr>
          </thead>
          <tbody>
            {recent.map((o) => {
              const customer = customerFor(o.customerId)
              return (
                <tr key={o.id}>
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
                    <Link to={`/orders/${o.id}`}>{o.claimNumber || `#${o.id}`}</Link>
                  </td>
                  <td className="wrap-cell">
                    {customer ? <Link to={`/customers/${customer.id}`}>{customer.name}</Link> : 'Unknown'}
                  </td>
                  <td className="wrap-cell">{o.reportedProblem || '—'}</td>
                  <td className="wrap-cell">
                    {o.appointmentPreference
                      ? o.appointmentPreference
                          .split(';')
                          .map((d) => d.trim())
                          .filter(Boolean)
                          .map((d, i) => <div key={i}>{d}</div>)
                      : '—'}
                  </td>
                  <td className="wrap-cell">
                    {o.authorizationLimit && <div>{o.authorizationLimit}</div>}
                    {o.repairRate && <div>{o.repairRate}</div>}
                    {!o.authorizationLimit && !o.repairRate && '—'}
                  </td>
                  <td>
                    <span className={`status-pill status-${o.status.replace(/\s+/g, '-')}`}>{o.status}</span>
                  </td>
                  <td>{new Date(o.updatedAt).toLocaleString()}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      )}
    </div>
  )
}
