import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { HashRouter, Routes, Route } from 'react-router-dom'
import './index.css'
import App from './App'
import Dashboard from './pages/Dashboard'
import NewOrder from './pages/NewOrder'
import WorkOrders from './pages/WorkOrders'
import WorkOrderDetail from './pages/WorkOrderDetail'
import Customers from './pages/Customers'
import CustomerDetail from './pages/CustomerDetail'
import EmailSync from './pages/EmailSync'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <HashRouter>
      <Routes>
        <Route path="/" element={<App />}>
          <Route index element={<Dashboard />} />
          <Route path="orders/new" element={<NewOrder />} />
          <Route path="orders" element={<WorkOrders />} />
          <Route path="orders/:id" element={<WorkOrderDetail />} />
          <Route path="customers" element={<Customers />} />
          <Route path="customers/:id" element={<CustomerDetail />} />
          <Route path="email-sync" element={<EmailSync />} />
        </Route>
      </Routes>
    </HashRouter>
  </StrictMode>,
)
