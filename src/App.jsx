import { useState } from 'react'
import { AuthProvider, useAuth } from './AuthContext'
import AuthPage from './AuthPage'
import SetPasswordPage from './SetPasswordPage'
import ConsentPage from './ConsentPage'
import Dashboard from './Dashboard'
import ItemForm from './ItemForm'

function AppInner() {
  const { user, vendor, loading, recoveryMode } = useAuth()
  const [view, setView] = useState('dashboard') // dashboard | new | edit
  const [editItem, setEditItem] = useState(null)

  if (loading) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f5f4f0' }}>
      <div style={{ color: '#aaa', fontSize: 14 }}>Lädt...</div>
    </div>
  )

  // 1. Nicht eingeloggt -> Login/Forgot/Invite-Page
  if (!user) return <AuthPage />

  // 2. Recovery-Link aus E-Mail -> Passwort-Setzen erzwingen, egal ob password_set bereits true ist
  if (recoveryMode) return <SetPasswordPage mode="recovery" />

  // 3. Eingeloggt, aber Passwort noch nicht gesetzt (z.B. nach Invite)
  const passwordSet = user.user_metadata?.password_set === true
  if (!passwordSet) return <SetPasswordPage mode="invite" />

  // 4. Geschäftsbedingungen noch nicht digital bestätigt
  if (vendor && vendor.gb_akzeptiert !== true) return <ConsentPage />

  // 3. Normaler Flow
  if (view === 'new') return (
    <ItemForm
      item={null}
      onBack={() => setView('dashboard')}
      onSaved={() => setView('dashboard')}
    />
  )
  if (view === 'edit') return (
    <ItemForm
      item={editItem}
      onBack={() => setView('dashboard')}
      onSaved={() => setView('dashboard')}
    />
  )
  return (
    <Dashboard
      onNewItem={() => setView('new')}
      onEditItem={(item) => { setEditItem(item); setView('edit') }}
    />
  )
}

export default function App() {
  return (
    <AuthProvider>
      <AppInner />
    </AuthProvider>
  )
}
