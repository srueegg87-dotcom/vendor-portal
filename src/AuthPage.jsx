import { useState } from 'react'
import { useAuth } from './AuthContext'

export default function AuthPage() {
  const { signIn, signUp } = useAuth()
  const [mode, setMode] = useState('login')
  const [form, setForm] = useState({ name: '', email: '', password: '' })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  async function handleSubmit(e) {
    e.preventDefault()
    setError(''); setLoading(true)
    try {
      if (mode === 'login') {
        const { error } = await signIn(form.email, form.password)
        if (error) setError(error.message)
      } else {
        const { error } = await signUp(form.email, form.password, form.name)
        if (error) setError(error.message)
        else setSuccess(true)
      }
    } finally {
      setLoading(false)
    }
  }

  if (success) return (
    <div style={styles.page}>
      <div style={styles.card}>
        <div style={styles.logo}>Rüegg's Familienbörse</div>
        <div style={styles.successBox}>
          <p style={{ fontWeight: 500, marginBottom: 6 }}>Konto erstellt!</p>
          <p style={{ fontSize: 14, color: '#555' }}>Prüfe deine E-Mail und bestätige die Registrierung. Danach kannst du dich anmelden.</p>
        </div>
        <button style={styles.btnSecondary} onClick={() => { setSuccess(false); setMode('login') }}>
          Zur Anmeldung
        </button>
      </div>
    </div>
  )

  return (
    <div style={styles.page}>
      <div style={styles.card}>
        <div style={styles.logoWrap}>
          <img src="/logo.png" alt="Rüegg's Familienbörse" style={styles.logoImg} />
          <div style={styles.logoSub}>Verkäufer-Portal</div>
        </div>

        <h2 style={styles.title}>{mode === 'login' ? 'Anmelden' : 'Konto erstellen'}</h2>
        <p style={styles.sub}>
          {mode === 'login' ? 'Melde dich an um deine Inserate zu verwalten.' : 'Erstelle ein Konto und starte mit deinem ersten Inserat.'}
        </p>

        <form onSubmit={handleSubmit}>
          {mode === 'register' && (
            <div style={styles.field}>
              <label style={styles.label}>Dein Name</label>
              <input style={styles.input} type="text" placeholder="z. B. Anna Müller" value={form.name}
                onChange={e => set('name', e.target.value)} required />
            </div>
          )}
          <div style={styles.field}>
            <label style={styles.label}>E-Mail</label>
            <input style={styles.input} type="email" placeholder="deine@email.ch" value={form.email}
              onChange={e => set('email', e.target.value)} required />
          </div>
          <div style={styles.field}>
            <label style={styles.label}>Passwort</label>
            <input style={styles.input} type="password" placeholder="mind. 6 Zeichen" value={form.password}
              onChange={e => set('password', e.target.value)} required minLength={6} />
          </div>
          {error && <p style={styles.error}>{error}</p>}
          <button style={styles.btnPrimary} type="submit" disabled={loading}>
            {loading ? 'Bitte warten...' : mode === 'login' ? 'Anmelden' : 'Konto erstellen'}
          </button>
        </form>

        <p style={styles.toggle}>
          {mode === 'login' ? 'Noch kein Konto? ' : 'Bereits ein Konto? '}
          <span style={styles.link} onClick={() => { setMode(mode === 'login' ? 'register' : 'login'); setError('') }}>
            {mode === 'login' ? 'Registrieren' : 'Anmelden'}
          </span>
        </p>
      </div>
    </div>
  )
}

const styles = {
  page: { minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f5f4f0', padding: 16 },
  card: { background: '#fff', borderRadius: 16, border: '0.5px solid #e0ddd5', padding: '2rem', width: '100%', maxWidth: 420 },
  logoWrap: { display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: '1.5rem' },
  logoImg: { height: 64, mixBlendMode: 'multiply', marginBottom: 6 },
  logoSub: { fontSize: 12, color: '#888', textAlign: 'center' },
  title: { fontSize: 20, fontWeight: 500, marginBottom: 4 },
  sub: { fontSize: 14, color: '#666', marginBottom: '1.25rem' },
  field: { marginBottom: '0.875rem' },
  label: { display: 'block', fontSize: 13, color: '#666', marginBottom: 5 },
  input: { width: '100%', padding: '10px 12px', border: '0.5px solid #ccc', borderRadius: 8, fontSize: 14, boxSizing: 'border-box', outline: 'none' },
  error: { color: '#c0392b', fontSize: 13, marginBottom: 10 },
  btnPrimary: { width: '100%', padding: 11, background: '#0F6E56', color: '#fff', border: 'none', borderRadius: 8, fontSize: 14, fontWeight: 500, cursor: 'pointer', marginTop: 4 },
  btnSecondary: { width: '100%', padding: 11, background: 'transparent', color: '#666', border: '0.5px solid #ccc', borderRadius: 8, fontSize: 14, cursor: 'pointer', marginTop: 8 },
  toggle: { textAlign: 'center', marginTop: '1rem', fontSize: 13, color: '#888' },
  link: { color: '#0F6E56', cursor: 'pointer', fontWeight: 500 },
  successBox: { background: '#E1F5EE', border: '0.5px solid #5DCAA5', borderRadius: 8, padding: '1rem', marginBottom: '1rem' },
}
