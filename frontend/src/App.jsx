// ─────────────────────────────────────────
// DocSentinel v2 — App Router
// PhRedSec™ | App.jsx
// ─────────────────────────────────────────
import { Routes, Route, Navigate } from 'react-router-dom'
import { useAuth } from './hooks/useAuth'
// Auth Pages
import Login from './pages/auth/Login'
import Register from './pages/auth/Register'
// Main Pages
import Landing from './pages/Landing'
import DashboardLayout from './layouts/DashboardLayout'
import CollectionView from './pages/collections/CollectionView'
import Dashboard from './pages/dashboard/Dashboard'
// Module Pages
import Vault from './pages/vault/Vault'
import Invoices from './pages/invoices/Invoices'
import Contracts from './pages/contracts/Contracts'
import HR from './pages/hr/HR'
import Settings from './pages/settings/Settings'
// ── Protected Route ──────────────────────
function ProtectedRoute({ children }) {
  const { user, loading } = useAuth()
  if (loading) return <div className="app-loading">Loading...</div>
  if (!user) return <Navigate to="/login" replace />
  return children
}
// ── App ──────────────────────────────────
export default function App() {
  return (
    <Routes>
      {/* Public */}
      <Route path="/" element={<Landing />} />
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />
      {/* Protected — all rendered inside the shared DashboardLayout */}
      <Route
        element={
          <ProtectedRoute>
            <DashboardLayout />
          </ProtectedRoute>
        }
      >
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/vault" element={<Vault />} />
        <Route path="/invoices" element={<Invoices />} />
        <Route path="/contracts" element={<Contracts />} />
        <Route path="/hr" element={<HR />} />
        <Route path="/settings" element={<Settings />} />
        <Route path="/collections/:slug" element={<CollectionView />} />
      </Route>
      {/* Fallback */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
