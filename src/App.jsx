import { useState } from 'react'
import { AuthProvider, useAuth } from './AuthContext'
import AuthPage from './AuthPage'
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

  if (!user) return <AuthPage />

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
