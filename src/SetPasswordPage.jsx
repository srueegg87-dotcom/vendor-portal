import { useState } from 'react'
import { useAuth } from './AuthContext'
import { supabase } from './supabaseClient'

export default function SetPasswordPage() {
  const { user, signOut } = useAuth()
  const [form, setForm] = useState({ password: '', password2: '' })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    if (form.password.length < 6) { setError('Passwort muss mindestens 6 Zeichen lang sein.'); return }
    if (form.password !== form.password2) { setError('Passwörter stimmen nicht überein.'); return }
    setLoading(true)
    try {
      const { error } = await supabase.auth.updateUser({
        password: form.password,
        data: { password_set: true }
      })
      if (error) {
        setError(error.message)
      } else {
        // Session refreshen, damit user_metadata.password_set sofort verfügbar ist
        await supabase.auth.refreshSession()
        // Hard reload, damit AuthContext frische User-Metadaten lädt
        window.location.reload()
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={styles.page}>
      <div style={styles.card}>
        <div style={styles.logoWrap}>
          <img src="/logo.png" alt="Rüegg's Familienbörse" style={styles.logoImg} />
          <div style={styles.logoSub}>Verkäufer-Portal</div>
        </div>

        <h2 style={styles.title}>Willkommen!</h2>
        <p style={styles.sub}>
          Bevor du loslegst, setze bitte dein Passwort. Damit kannst du dich künftig anmelden.
        </p>

        {user?.email && (
          <div style={styles.emailBox}>
            <div style={styles.emailLabel}>Konto:</div>
            <div style={styles.emailValue}>{user.email}</div>
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div style={styles.field}>
            <label style={styles.label}>Neues Passwort</label>
            <input style={styles.input} type="password" placeholder="mind. 6 Zeichen" value={form.password}
              onChange={e => set('password', e.target.value)} required minLength={6} autoFocus />
          </div>
          <div style={styles.field}>
            <label style={styles.label}>Passwort bestätigen</label>
            <input style={styles.input} type="password" placeholder="nochmal dasselbe Passwort" value={form.password2}
              onChange={e => set('password2', e.target.value)} required minLength={6} />
          </div>
          {error && <p style={styles.error}>{error}</p>}
          <button style={styles.btnPrimary} type="submit" disabled={loading}>
            {loading ? 'Bitte warten...' : 'Passwort speichern'}
          </button>
        </form>

        <p style={styles.toggle}>
          <span style={styles.linkSmall} onClick={signOut}>Abmelden</span>
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
  title: { fontSize: 22, fontWeight: 500, marginBottom: 4 },
  sub: { fontSize: 14, color: '#666', marginBottom: '1.25rem', lineHeight: 1.5 },
  emailBox: { background: '#f5f4f0', borderRadius: 8, padding: '0.75rem 1rem', marginBottom: '1rem' },
  emailLabel: { fontSize: 11, color: '#888', textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 2 },
  emailValue: { fontSize: 14, color: '#333', fontWeight: 500 },
  field: { marginBottom: '0.875rem' },
  label: { display: 'block', fontSize: 13, color: '#666', marginBottom: 5 },
  input: { width: '100%', padding: '10px 12px', border: '0.5px solid #ccc', borderRadius: 8, fontSize: 14, boxSizing: 'border-box', outline: 'none' },
  error: { color: '#c0392b', fontSize: 13, marginBottom: 10 },
  btnPrimary: { width: '100%', padding: 11, background: '#0F6E56', color: '#fff', border: 'none', borderRadius: 8, fontSize: 14, fontWeight: 500, cursor: 'pointer', marginTop: 4 },
  toggle: { textAlign: 'center', marginTop: '1rem', fontSize: 13, color: '#888' },
  linkSmall: { color: '#888', cursor: 'pointer', textDecoration: 'underline' },
}
