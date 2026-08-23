import { useEffect } from 'react'
import { NavLink, Outlet } from 'react-router-dom'
import AuthGate from './AuthGate'
import { syncEnabled } from './api'
import { syncInboxOrders } from './emailSync'

const SYNC_INTERVAL_MS = 60_000

function App() {
  useEffect(() => {
    if (!syncEnabled) return
    syncInboxOrders()
    const id = setInterval(syncInboxOrders, SYNC_INTERVAL_MS)
    return () => clearInterval(id)
  }, [])

  return (
    <AuthGate>
      <div className="app-shell">
        <header className="topbar">
          <div className="brand">Service Call Workflow</div>
          <nav className="nav">
            <NavLink to="/" end>
              Dashboard
            </NavLink>
            <NavLink to="/orders">Work Orders</NavLink>
            <NavLink to="/orders/new">New Order</NavLink>
            <NavLink to="/customers">Customers</NavLink>
            {syncEnabled && <NavLink to="/email-sync">Email Sync</NavLink>}
          </nav>
        </header>
        <main className="content">
          <Outlet />
        </main>
      </div>
    </AuthGate>
  )
}

export default App
