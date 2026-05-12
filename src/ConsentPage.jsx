import { useState } from 'react'
import { useAuth } from './AuthContext'
import { supabase } from './supabaseClient'

export default function ConsentPage() {
  const { vendor, fetchVendor, user, signOut } = useAuth()
  const [agreed, setAgreed] = useState(false)
  const [entsorgung, setEntsorgung] = useState(true)
  const [rueckgabe, setRueckgabe] = useState('') // 'rueckgabe' | 'spenden'
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    if (!agreed) { setError('Bitte bestätige, dass du die Geschäftsbedingungen gelesen hast.'); return }
    if (!rueckgabe) { setError('Bitte wähle, was mit nicht verkauften Sachen passieren soll.'); return }
    setLoading(true)
    try {
      const { error } = await supabase
        .from('vendors')
        .update({
          gb_akzeptiert: true,
          gb_akzeptiert_am: new Date().toISOString(),
          entsorgung_ok: entsorgung,
          rueckgabe_regelung: rueckgabe,
        })
        .eq('id', vendor.id)
      if (error) { setError(error.message); setLoading(false); return }
      await fetchVendor(user.id)
    } catch (e) {
      setError(e.message || 'Fehler beim Speichern.')
      setLoading(false)
    }
  }

  return (
    <div style={s.page}>
      <div style={s.card}>
        <div style={s.logoWrap}>
          <img src="/logo.png" alt="Rüegg's Familienbörse" style={s.logoImg} />
          <div style={s.logoSub}>Verkäufer-Portal</div>
        </div>

        <h2 style={s.title}>Geschäftsbedingungen</h2>
        <p style={s.sub}>
          Schön, dass du dabei bist, {vendor?.name?.split(' ')[0] || ''}! Bitte lies die Bedingungen einmal durch und triff deine Wahl, damit wir loslegen können.
        </p>

        <div style={s.gbBox}>
          <h3 style={s.gbHead}>Annahme</h3>
          <ul style={s.gbList}>
            <li>Wir nehmen <b>saisonale, saubere, flecken- und löcherfreie</b> Kleidung, Schuhe und Spielzeug an.</li>
            <li>Spiele und Puzzles bitte nur vollständig.</li>
            <li>Voranmeldung ab 5 Artikeln. Keine Annahme an Samstagen und in den Schulferien.</li>
          </ul>

          <h3 style={s.gbHead}>Provision &amp; Fristen</h3>
          <ul style={s.gbList}>
            <li>Bei Kommissionsverkauf erhältst du deinen vereinbarten Anteil; die Familienbörse behält die abgemachte Provision ein.</li>
            <li>Verkaufsfrist: <b>Spielzeug 6 Monate</b>, Kleidung &amp; Schuhe <b>3 Monate</b> ab Anlieferung.</li>
            <li>Nach Fristablauf hast du je nach Wahl ca. 4 Wochen Zeit, deine Sachen wieder abzuholen.</li>
            <li>Bei kostenpflichtiger Rückgabe: <b>CHF 1.– pro Artikel</b> Rückgabegebühr.</li>
          </ul>
        </div>

        <form onSubmit={handleSubmit}>
          <label style={s.option}>
            <input type="checkbox" checked={agreed} onChange={e => setAgreed(e.target.checked)} style={s.cb} />
            <span>
              <b>Ich habe die Geschäftsbedingungen gelesen und bin damit einverstanden.</b>
              <br /><span style={s.opSub}>Pflichtfeld, ohne deine Zustimmung können wir leider keine Artikel annehmen.</span>
            </span>
          </label>

          <label style={s.option}>
            <input type="checkbox" checked={entsorgung} onChange={e => setEntsorgung(e.target.checked)} style={s.cb} />
            <span>
              <b>Entsorgung gegen Unkostenbeitrag erlauben.</b>
              <br /><span style={s.opSub}>Sachen mit Flecken, Löchern usw. dürfen gegen einen kleinen Unkostenbeitrag entsorgt werden.</span>
            </span>
          </label>

          <div style={s.radioGroup}>
            <div style={s.radioHead}>Was soll mit Sachen passieren, die nicht verkauft wurden?</div>
            <label style={{ ...s.option, ...(rueckgabe === 'rueckgabe' ? s.optionActive : {}) }}>
              <input type="radio" name="rueck" value="rueckgabe" checked={rueckgabe === 'rueckgabe'} onChange={() => setRueckgabe('rueckgabe')} style={s.cb} />
              <span>
                <b>Ich möchte sie retour.</b>
                <br /><span style={s.opSub}>Abholung innerhalb 4 Wochen, CHF 1.– pro Artikel Rückgabegebühr.</span>
              </span>
            </label>
            <label style={{ ...s.option, ...(rueckgabe === 'spenden' ? s.optionActive : {}) }}>
              <input type="radio" name="rueck" value="spenden" checked={rueckgabe === 'spenden'} onChange={() => setRueckgabe('spenden')} style={s.cb} />
              <span>
                <b>Sie dürfen gespendet werden.</b>
                <br /><span style={s.opSub}>Wir geben sie an die Familienbörse oder eine soziale Einrichtung weiter.</span>
              </span>
            </label>
          </div>

          {error && <p style={s.error}>{error}</p>}
          <button style={s.btnPrimary} type="submit" disabled={loading}>
            {loading ? 'Speichert…' : 'Bestätigen & loslegen'}
          </button>
        </form>

        <p style={s.toggle}>
          <span style={s.linkSmall} onClick={signOut}>Abmelden</span>
        </p>
      </div>
    </div>
  )
}

const s = {
  page: { minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f5f4f0', padding: 16 },
  card: { background: '#fff', borderRadius: 16, border: '0.5px solid #e0ddd5', padding: '2rem', width: '100%', maxWidth: 560 },
  logoWrap: { display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: '1.5rem' },
  logoImg: { height: 64, mixBlendMode: 'multiply', marginBottom: 6 },
  logoSub: { fontSize: 12, color: '#888', textAlign: 'center' },
  title: { fontSize: 22, fontWeight: 500, marginBottom: 4 },
  sub: { fontSize: 14, color: '#666', marginBottom: '1.25rem', lineHeight: 1.5 },
  gbBox: { background: '#f5f4f0', borderRadius: 12, padding: '1rem 1.25rem', marginBottom: '1.25rem', fontSize: 13, lineHeight: 1.65 },
  gbHead: { fontSize: 13, fontWeight: 600, color: '#0F6E56', marginTop: '0.75rem', marginBottom: '0.4rem', textTransform: 'uppercase', letterSpacing: '.05em' },
  gbList: { margin: 0, paddingLeft: '1.1rem', color: '#444' },
  option: { display: 'flex', gap: 10, alignItems: 'flex-start', padding: '12px 14px', border: '0.5px solid #ccc', borderRadius: 10, marginBottom: 10, cursor: 'pointer', fontSize: 14, lineHeight: 1.4 },
  optionActive: { borderColor: '#0F6E56', background: '#E1F5EE' },
  cb: { marginTop: 3, flexShrink: 0, accentColor: '#0F6E56' },
  opSub: { fontSize: 12, color: '#666' },
  radioGroup: { marginTop: '1rem', marginBottom: '0.5rem' },
  radioHead: { fontSize: 13, fontWeight: 600, color: '#444', marginBottom: 8 },
  error: { color: '#c0392b', fontSize: 13, marginBottom: 10 },
  btnPrimary: { width: '100%', padding: 13, background: '#0F6E56', color: '#fff', border: 'none', borderRadius: 10, fontSize: 15, fontWeight: 500, cursor: 'pointer', marginTop: 8 },
  toggle: { textAlign: 'center', marginTop: '1rem', fontSize: 13, color: '#888' },
  linkSmall: { color: '#888', cursor: 'pointer', textDecoration: 'underline' },
}
