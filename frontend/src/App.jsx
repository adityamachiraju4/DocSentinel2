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
import Dashboard from './pages/dashboard/Dashboard'

// Module Pages
import Vault from './pages/vault/Vault'
import Invoices from './pages/invoices/Invoices'
import Contracts from './pages/contracts/Contracts'
import HR from './pages/hr/HR'


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

      <Route path="/dashboard" element={<Dashboard />} />

      {/* { Protected}
      { <Route path="/dashboard" element={
        <ProtectedRoute><Dashboard /></ProtectedRoute>
      } /> } */}
      <Route path="/vault" element={
        <ProtectedRoute><Vault /></ProtectedRoute>
      } />
      <Route path="/invoices" element={
        <ProtectedRoute><Invoices /></ProtectedRoute>
      } />
      <Route path="/contracts" element={
        <ProtectedRoute><Contracts /></ProtectedRoute>
      } />
      <Route path="/hr" element={
        <ProtectedRoute><HR /></ProtectedRoute>
      } />

      {/* Fallback */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}