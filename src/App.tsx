import { NavLink, Outlet } from 'react-router-dom'

function App() {
  return (
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
        </nav>
      </header>
      <main className="content">
        <Outlet />
      </main>
    </div>
  )
}

export default App
