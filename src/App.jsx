import { useState } from 'react'
import { AuthProvider, useAuth } from './AuthContext'
import AuthPage from './AuthPage'
import SetPasswordPage from './SetPasswordPage'
import Dashboard from './Dashboard'
import ItemForm from './ItemForm'

function AppInner() {
  const { user, loading } = useAuth()
  const [view, setView] = useState('dashboard') // dashboard | new | edit
  const [editItem, setEditItem] = useState(null)

  if (loading) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f5f4f0' }}>
      <div style={{ color: '#aaa', fontSize: 14 }}>Lädt...</div>
    </div>
  )

  // 1. Nicht eingeloggt -> Login/Forgot/Invite-Page
  if (!user) return <AuthPage />

  // 2. Eingeloggt, aber Passwort noch nicht gesetzt (z.B. nach Invite)
  //    -> Erzwinge Passwort-Setzen, bevor Dashboard freigegeben wird
  const passwordSet = user.user_metadata?.password_set === true
  if (!passwordSet) return <SetPasswordPage />

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
