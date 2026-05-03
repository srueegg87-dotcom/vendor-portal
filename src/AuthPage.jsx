import { useState, useEffect } from 'react'
import { useAuth } from './AuthContext'
import { supabase } from './supabaseClient'

export default function AuthPage() {
  const { signIn, updatePassword, requestPasswordReset } = useAuth()
  // mode: login | setpassword | forgot | forgotsent
  const [mode, setMode] = useState('login')
  const [form, setForm] = useState({ email: '', password: '', password2: '' })
  const [error, setError] = useState('')
  const [info, setInfo] = useState('')
  const [loading, setLoading] = useState(false)

  // URL-Hash auswerten: erkennen ob Invite- oder Reset-Flow
  useEffect(() => {
    const hash = window.location.hash
    if (!hash) return
    const params = new URLSearchParams(hash.replace(/^#/, ''))
    const type = params.get('type')
    const errorDescription = params.get('error_description')

    if (errorDescription) {
      setError(decodeURIComponent(errorDescription).replace(/\+/g, ' '))
      // Hash entfernen, damit er nicht hängenbleibt
      window.history.replaceState(null, '', window.location.pathname)
      return
    }

    if (type === 'invite' || type === 'recovery' || type === 'signup') {
      // Supabase verarbeitet den Token automatisch via onAuthStateChange.
      // Wir wechseln einfach in den Passwort-Setzen-Modus.
      setMode('setpassword')
      setInfo(type === 'invite'
        ? 'Willkommen! Bitte setze dein Passwort, um dich einzuloggen.'
        : 'Bitte setze ein neues Passwort.')
      // Hash entfernen für saubere URL
      window.history.replaceState(null, '', window.location.pathname)
    }
  }, [])

  // Wenn ein Recovery-Event vom AuthState kommt, auch in setpassword wechseln
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') {
        setMode('setpassword')
        setInfo('Bitte setze ein neues Passwort.')
      }
    })
    return () => subscription.unsubscribe()
  }, [])

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  async function handleLogin(e) {
    e.preventDefault()
    setError(''); setLoading(true)
    try {
      const { error } = await signIn(form.email, form.password)
      if (error) setError(error.message === 'Invalid login credentials'
        ? 'E-Mail oder Passwort falsch.'
        : error.message)
    } finally {
      setLoading(false)
    }
  }

  async function handleSetPassword(e) {
    e.preventDefault()
    setError('')
    if (form.password.length < 6) { setError('Passwort muss mindestens 6 Zeichen lang sein.'); return }
    if (form.password !== form.password2) { setError('Passwörter stimmen nicht überein.'); return }
    setLoading(true)
    try {
      const { error } = await updatePassword(form.password)
      if (error) {
        setError(error.message)
      } else {
        // Erfolg: Supabase ist nun eingeloggt -> AuthContext wird Dashboard zeigen
        setInfo('Passwort gesetzt! Du wirst weitergeleitet...')
      }
    } finally {
      setLoading(false)
    }
  }

  async function handleForgot(e) {
    e.preventDefault()
    setError(''); setLoading(true)
    try {
      const { error } = await requestPasswordReset(form.email)
      if (error) setError(error.message)
      else setMode('forgotsent')
    } finally {
      setLoading(false)
    }
  }

  // ───── UI: Passwort vergessen → E-Mail gesendet ─────
  if (mode === 'forgotsent') return (
    <div style={styles.page}>
      <div style={styles.card}>
        <div style={styles.logoWrap}>
          <img src="/logo.png" alt="Rüegg's Familienbörse" style={styles.logoImg} />
          <div style={styles.logoSub}>Verkäufer-Portal</div>
        </div>
        <div style={styles.successBox}>
          <p style={{ fontWeight: 500, marginBottom: 6 }}>E-Mail versendet</p>
          <p style={{ fontSize: 14, color: '#555' }}>
            Falls ein Konto mit dieser E-Mail existiert, hast du einen Link zum Zurücksetzen deines Passworts erhalten.
          </p>
        </div>
        <button style={styles.btnSecondary} onClick={() => { setMode('login'); setError(''); setInfo('') }}>
          Zurück zur Anmeldung
        </button>
      </div>
    </div>
  )

  // ───── UI: Passwort setzen (Invite oder Recovery) ─────
  if (mode === 'setpassword') return (
    <div style={styles.page}>
      <div style={styles.card}>
        <div style={styles.logoWrap}>
          <img src="/logo.png" alt="Rüegg's Familienbörse" style={styles.logoImg} />
          <div style={styles.logoSub}>Verkäufer-Portal</div>
        </div>
        <h2 style={styles.title}>Passwort setzen</h2>
        <p style={styles.sub}>{info || 'Bitte setze dein Passwort.'}</p>
        <form onSubmit={handleSetPassword}>
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
            {loading ? 'Bitte warten...' : 'Passwort speichern & einloggen'}
          </button>
        </form>
      </div>
    </div>
  )

  // ───── UI: Passwort vergessen ─────
  if (mode === 'forgot') return (
    <div style={styles.page}>
      <div style={styles.card}>
        <div style={styles.logoWrap}>
          <img src="/logo.png" alt="Rüegg's Familienbörse" style={styles.logoImg} />
          <div style={styles.logoSub}>Verkäufer-Portal</div>
        </div>
        <h2 style={styles.title}>Passwort vergessen?</h2>
        <p style={styles.sub}>Gib deine E-Mail-Adresse ein. Wir senden dir einen Link zum Zurücksetzen.</p>
        <form onSubmit={handleForgot}>
          <div style={styles.field}>
            <label style={styles.label}>E-Mail</label>
            <input style={styles.input} type="email" placeholder="deine@email.ch" value={form.email}
              onChange={e => set('email', e.target.value)} required autoFocus />
          </div>
          {error && <p style={styles.error}>{error}</p>}
          <button style={styles.btnPrimary} type="submit" disabled={loading}>
            {loading ? 'Bitte warten...' : 'Link zusenden'}
          </button>
        </form>
        <p style={styles.toggle}>
          <span style={styles.link} onClick={() => { setMode('login'); setError('') }}>← Zurück zur Anmeldung</span>
        </p>
      </div>
    </div>
  )

  // ───── UI: Standard-Login ─────
  return (
    <div style={styles.page}>
      <div style={styles.card}>
        <div style={styles.logoWrap}>
          <img src="/logo.png" alt="Rüegg's Familienbörse" style={styles.logoImg} />
          <div style={styles.logoSub}>Verkäufer-Portal</div>
        </div>

        <h2 style={styles.title}>Anmelden</h2>
        <p style={styles.sub}>Melde dich an, um deine Inserate zu verwalten.</p>

        <form onSubmit={handleLogin}>
          <div style={styles.field}>
            <label style={styles.label}>E-Mail</label>
            <input style={styles.input} type="email" placeholder="deine@email.ch" value={form.email}
              onChange={e => set('email', e.target.value)} required />
          </div>
          <div style={styles.field}>
            <label style={styles.label}>Passwort</label>
            <input style={styles.input} type="password" placeholder="dein Passwort" value={form.password}
              onChange={e => set('password', e.target.value)} required />
          </div>
          {error && <p style={styles.error}>{error}</p>}
          <button style={styles.btnPrimary} type="submit" disabled={loading}>
            {loading ? 'Bitte warten...' : 'Anmelden'}
          </button>
        </form>

        <p style={styles.toggle}>
          <span style={styles.link} onClick={() => { setMode('forgot'); setError('') }}>
            Passwort vergessen?
          </span>
        </p>

        <p style={{ ...styles.toggle, marginTop: 8, fontSize: 12 }}>
          Noch kein Konto? Bitte den Shop kontaktieren – Konten werden vom Laden eingerichtet.
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
