import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext'
import ProtectedRoute from './context/ProtectedRoute'
import LoginPage from './pages/LoginPage'
import RegisterPage from './pages/RegisterPage'
import TwoFactorVerifyPage from './pages/TwoFactorVerifyPage'
import DashboardPage from './pages/DashboardPage'
import SecurityPage from './pages/SecurityPage'
import AdminDashboardPage from './pages/AdminDashboardPage'
import KeyManagementPage from './pages/KeyManagementPage'
import MessagesPage from './pages/MessagesPage'
import NewConversationPage from './pages/NewConversationPage'

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Navigate to="/login" replace />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
          <Route path="/verify-2fa" element={<TwoFactorVerifyPage />} />
          <Route element={<ProtectedRoute />}>
            <Route path="/dashboard" element={<DashboardPage />} />
            <Route path="/messages" element={<MessagesPage />} />
            <Route path="/messages/new" element={<NewConversationPage />} />
            <Route path="/security" element={<SecurityPage />} />
            <Route path="/keys" element={<KeyManagementPage />} />
            <Route path="/admin" element={<AdminDashboardPage />} />
          </Route>
          <Route path="*" element={<Navigate to="/login" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  )
}

export default App