import { Navigate, Route, Routes } from 'react-router'
import AppLayout from './components/AppLayout'
import RequireAuth from './components/RequireAuth'
import AppearancePage from './pages/AppearancePage'
import ComingSoonPage from './pages/ComingSoonPage'
import LoginPage from './pages/LoginPage'
import RegisterPage from './pages/RegisterPage'
import TodayPage from './pages/TodayPage'
import MedicationDetailPage from './pages/MedicationDetailPage'
import NewMedicationPage from './pages/NewMedicationPage'
import MedicationsPage from './pages/MedicationsPage'

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />
      <Route element={<RequireAuth />}>
        <Route element={<AppLayout />}>
          <Route index element={<TodayPage />} />
          <Route path="medications" element={<MedicationsPage />} />
          <Route path="medications/new" element={<NewMedicationPage />} />
          <Route path="medications/:id" element={<MedicationDetailPage />} />
          <Route path="appointments" element={<ComingSoonPage title="Appointments" />} />
          <Route path="history" element={<ComingSoonPage title="History" />} />
          <Route path="care" element={<ComingSoonPage title="Care circle" />} />
          <Route path="settings/appearance" element={<AppearancePage />} />
        </Route>
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}