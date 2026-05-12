import { useEffect, useState } from 'react'
import { supabase } from './supabaseClient'
import { useAuth } from './AuthContext'

const SUPABASE_URL = 'https://quhqhqhfyzqknnoldyke.supabase.co'
const STATUS_LABEL = { pending: 'Ausstehend', active: 'Aktiv', sold: 'Verkauft', archived: 'Archiviert' }
const STATUS_COLOR = {
  pending: { bg: '#FAEEDA', color: '#633806' },
  active:  { bg: '#E1F5EE', color: '#085041' },
  sold:    { bg: '#E6F1FB', color: '#0C447C' },
  archived:{ bg: '#F1EFE8', color: '#444441' },
}

// Frist je Kategorie (Monate)
function fristMonate(category) {
  const c = (category || '').toLowerCase()
  if (c.includes('spielzeug')) return 6
  return 3
}

function daysSince(dateStr) {
  if (!dateStr) return 0
  return Math.floor((Date.now() - new Date(dateStr).getTime()) / (1000 * 60 * 60 * 24))
}

function tageBisAblauf(item) {
  const start = new Date(item.added || item.created_at)
  const monate = fristMonate(item.category)
  const ablauf = new Date(start)
  ablauf.setMonth(ablauf.getMonth() + monate)
  const diff = Math.floor((ablauf.getTime() - Date.now()) / (1000 * 60 * 60 * 24))
  return diff
}

function formatCHF(val) {
  return 'CHF ' + Number(val || 0).toFixed(2)
}

export default function Dashboard({ onNewItem, onEditItem }) {
  const { vendor, signOut } = useAuth()
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState('overview')
  const [showPwModal, setShowPwModal] = useState(false)

  useEffect(() => { if (vendor) fetchItems() }, [vendor])

  async function fetchItems() {
    setLoading(true)
    const { data } = await supabase
      .from('items')
      .select('*, item_photos(storage_path, reihenfolge)')
      .eq('vendor_id', vendor.id)
      .order('created_at', { ascending: false })
    setItems(data || [])
    setLoading(false)
  }

  function getThumb(item) {
    if (item.item_photos?.length > 0) {
      const sorted = [...item.item_photos].sort((a, b) => a.reihenfolge - b.reihenfolge)
      return `${SUPABASE_URL}/storage/v1/object/public/item-fotos/${sorted[0].storage_path}`
    }
    if (item.image) return item.image
    return null
  }

  const commission = vendor?.commission || 30
  const regelung   = vendor?.rueckgabe_regelung || null
  const activeItems  = items.filter(i => i.status === 'active')
  const soldItems    = items.filter(i => i.status === 'sold')
  const pendingItems = items.filter(i => i.status === 'pending')

  const gesamtumsatz    = soldItems.reduce((s, i) => s + Number(i.cost || 0), 0)
  const auszahlungOffen = soldItems.reduce((s, i) => s + Number(i.cost || 0) * (1 - commission / 100), 0)
  const lagerwert       = activeItems.reduce((s, i) => s + Number(i.cost || 0), 0)

  // Abholfristen-Berechnung dynamisch je Kategorie
  const abholenBald  = activeItems.filter(i => { const d = tageBisAblauf(i); return d > 0 && d <= 14 })
  const abholenJetzt = activeItems.filter(i => { const d = tageBisAblauf(i); return d <= 0 && d > -28 })
  const verfallen    = activeItems.filter(i => tageBisAblauf(i) <= -28)
  const pickupItems  = [...verfallen, ...abholenJetzt, ...abholenBald]

  function pickupBadge(item) {
    const d = tageBisAblauf(item)
    if (d <= -28) return { label: 'Geht an Familienbörse', bg: '#FCEBEB', color: '#791F1F' }
    if (d <= 0)   return { label: `Frist abgelaufen (${Math.abs(d)} Tage)`, bg: '#FAEEDA', color: '#633806' }
    return              { label: `Bald abholen (${d} Tage)`, bg: '#FFF9E6', color: '#856B00' }
  }

  const filtered = tab === 'all' ? items
    : tab === 'active'  ? activeItems
    : tab === 'sold'    ? soldItems
    : tab === 'pending' ? pendingItems
    : items

  return (
    <div style={s.page}>
      <div style={s.topbar}>
        <div style={s.topbarLeft}>
          <img src="/logo.png" alt="Rüegg's Familienbörse" style={{ height: 36, mixBlendMode: 'multiply' }} />
          <div style={s.greeting}>Hallo, {vendor?.name || 'Verkäufer'}</div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button style={s.btnNew} onClick={onNewItem}>+ Neues Inserat</button>
          <button style={s.btnOut} onClick={() => setShowPwModal(true)}>🔒 Passwort</button>
          <button style={s.btnOut} onClick={signOut}>Abmelden</button>
        </div>
      </div>
      {showPwModal && <ChangePasswordModal onClose={() => setShowPwModal(false)} />}

      <div style={s.content}>
        <div style={s.tabs}>
          {[
            { key: 'overview', label: 'Übersicht' },
            { key: 'all',      label: `Alle (${items.length})` },
            { key: 'active',   label: `Aktiv (${activeItems.length})` },
            { key: 'sold',     label: `Verkauft (${soldItems.length})` },
            { key: 'pending',  label: `Ausstehend (${pendingItems.length})` },
          ].map(t => (
            <button key={t.key} style={{ ...s.tab, ...(tab === t.key ? s.tabActive : {}) }}
              onClick={() => setTab(t.key)}>{t.label}</button>
          ))}
        </div>

        {tab === 'overview' ? (
          <>
            <div style={s.kpiGrid}>
              <div style={s.kpiCard}>
                <div style={s.kpiLabel}>Gesamtumsatz</div>
                <div style={s.kpiVal}>{formatCHF(gesamtumsatz)}</div>
                <div style={s.kpiSub}>{soldItems.length} Artikel verkauft</div>
              </div>
              <div style={{ ...s.kpiCard, borderColor: '#5DCAA5' }}>
                <div style={s.kpiLabel}>Offene Auszahlung</div>
                <div style={{ ...s.kpiVal, color: '#0F6E56' }}>{formatCHF(auszahlungOffen)}</div>
                <div style={s.kpiSub}>{100 - commission}% Ihrer Verkäufe</div>
              </div>
              <div style={s.kpiCard}>
                <div style={s.kpiLabel}>Lagerwert</div>
                <div style={s.kpiVal}>{formatCHF(lagerwert)}</div>
                <div style={s.kpiSub}>{activeItems.length} Artikel aktiv</div>
              </div>
              <div style={{ ...s.kpiCard, ...(pendingItems.length > 0 ? { borderColor: '#EF9F27' } : {}) }}>
                <div style={s.kpiLabel}>Ausstehend</div>
                <div style={s.kpiVal}>{pendingItems.length}</div>
                <div style={s.kpiSub}>Warten auf Prüfung</div>
              </div>
            </div>

            {pickupItems.length > 0 && (
              <div style={s.section}>
                <div style={s.sectionTitle}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#E24B4A" strokeWidth="2">
                    <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/>
                    <line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
                  </svg>
                  Abholfristen
                </div>
                <div style={s.list}>
                  {pickupItems.map(item => {
                    const badge = pickupBadge(item)
                    const thumb = getThumb(item)
                    return (
                      <div key={item.id} style={s.itemCard} onClick={() => onEditItem(item)}>
                        <div style={s.thumb}>
                          {thumb ? <img src={thumb} alt="" style={s.thumbImg} /> : <span style={{ fontSize: 20 }}>🏷️</span>}
                        </div>
                        <div style={s.itemInfo}>
                          <div style={s.itemName}>{item.name}</div>
                          <div style={s.itemMeta}>{formatCHF(item.cost)} · {item.category || '–'} · {fristMonate(item.category)} Mt.</div>
                        </div>
                        <span style={{ ...s.badge, background: badge.bg, color: badge.color, whiteSpace: 'nowrap' }}>
                          {badge.label}
                        </span>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            {/* === Dynamische Abholregeln je Lieferant === */}
            {regelung === null && (
              <div style={{ ...s.infoBox, borderColor: '#EF9F27', background: '#FFF9E6' }}>
                <div style={{ ...s.infoTitle, color: '#856B00' }}>⚠️ Abholregeln noch nicht festgelegt</div>
                <div style={{ fontSize: 13, color: '#555', lineHeight: 1.5 }}>
                  Bitte kontaktiere den Shop (Tel. 076 200 90 04 oder info@familienbörse.ch),
                  damit deine bevorzugte Regelung bei Ablauf der Frist hinterlegt wird (Spenden oder Rückgabe).
                </div>
              </div>
            )}

            {regelung === 'spenden' && (
              <div style={s.infoBox}>
                <div style={s.infoTitle}>Abholregeln · <span style={{ color: '#0F6E56', fontWeight: 600 }}>Spenden</span></div>
                <div style={s.infoRow}>
                  <div style={{ ...s.infoDot, background: '#E1F5EE', border: '1px solid #5DCAA5' }} />
                  <span>Frist: <strong>3 Monate</strong> für die meisten Artikel, <strong>6 Monate</strong> für Spielzeug</span>
                </div>
                <div style={s.infoRow}>
                  <div style={{ ...s.infoDot, background: '#E6F1FB', border: '1px solid #6BA9DD' }} />
                  <span>Nach Ablauf gehen deine Artikel <strong>als Spende</strong> an Rüegg's Familienbörse</span>
                </div>
                <div style={{ fontSize: 12, color: '#888', marginTop: 8, paddingTop: 8, borderTop: '1px dashed #e0ddd5' }}>
                  Du erhältst keine Erinnerungs-Mails – einfach laufen lassen.
                </div>
              </div>
            )}

            {regelung === 'rueckgabe' && (
              <div style={s.infoBox}>
                <div style={s.infoTitle}>Abholregeln · <span style={{ color: '#856B00', fontWeight: 600 }}>Rückgabe</span></div>
                <div style={s.infoRow}>
                  <div style={{ ...s.infoDot, background: '#E1F5EE', border: '1px solid #5DCAA5' }} />
                  <span>Frist: <strong>3 Monate</strong> für die meisten Artikel, <strong>6 Monate</strong> für Spielzeug</span>
                </div>
                <div style={s.infoRow}>
                  <div style={{ ...s.infoDot, background: '#FAEEDA', border: '1px solid #EF9F27' }} />
                  <span>Bei Ablauf erhältst du eine <strong>Erinnerung per E-Mail</strong></span>
                </div>
                <div style={s.infoRow}>
                  <div style={{ ...s.infoDot, background: '#FFF9E6', border: '1px solid #D4B600' }} />
                  <span>Du hast dann <strong>4 Wochen Zeit</strong>, deine Artikel im Laden abzuholen</span>
                </div>
                <div style={s.infoRow}>
                  <div style={{ ...s.infoDot, background: '#FCEBEB', border: '1px solid #E24B4A' }} />
                  <span>Werden Artikel nicht abgeholt, gehen sie an die <strong>Familienbörse über</strong></span>
                </div>
              </div>
            )}

            {items.length > 0 && (
              <div style={s.section}>
                <div style={s.sectionTitle}>Letzte Inserate</div>
                <div style={s.list}>
                  {items.slice(0, 5).map(item => {
                    const thumb = getThumb(item)
                    const sc = STATUS_COLOR[item.status] || STATUS_COLOR.pending
                    return (
                      <div key={item.id} style={s.itemCard} onClick={() => onEditItem(item)}>
                        <div style={s.thumb}>
                          {thumb ? <img src={thumb} alt="" style={s.thumbImg} /> : <span style={{ fontSize: 20 }}>🏷️</span>}
                        </div>
                        <div style={s.itemInfo}>
                          <div style={s.itemName}>{item.name}</div>
                          <div style={s.itemMeta}>{item.category || '–'}</div>
                        </div>
                        <div style={{ textAlign: 'right', display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4 }}>
                          <div style={s.price}>{formatCHF(item.cost)}</div>
                          <span style={{ ...s.badge, background: sc.bg, color: sc.color }}>
                            {STATUS_LABEL[item.status] || item.status}
                          </span>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}
          </>
        ) : (
          <div style={s.section}>
            {loading ? (
              <div style={s.empty}>Lädt...</div>
            ) : filtered.length === 0 ? (
              <div style={s.empty}>Keine Inserate in dieser Kategorie.</div>
            ) : (
              <div style={s.list}>
                {filtered.map(item => {
                  const thumb = getThumb(item)
                  const sc = STATUS_COLOR[item.status] || STATUS_COLOR.pending
                  const tageRest = tageBisAblauf(item)
                  const fristInfo = item.status === 'active'
                    ? (tageRest > 0 ? `noch ${tageRest} Tage` : `Frist abgelaufen`)
                    : `${daysSince(item.added || item.created_at)} Tage im Lager`
                  return (
                    <div key={item.id} style={s.itemCard} onClick={() => onEditItem(item)}>
                      <div style={s.thumb}>
                        {thumb ? <img src={thumb} alt="" style={s.thumbImg} /> : <span style={{ fontSize: 20 }}>🏷️</span>}
                      </div>
                      <div style={s.itemInfo}>
                        <div style={s.itemName}>{item.name}</div>
                        <div style={s.itemMeta}>{item.category || '–'} · {fristInfo}</div>
                      </div>
                      <div style={{ textAlign: 'right', display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4 }}>
                        <div style={s.price}>{formatCHF(item.cost)}</div>
                        <span style={{ ...s.badge, background: sc.bg, color: sc.color }}>
                          {STATUS_LABEL[item.status] || item.status}
                        </span>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

function ChangePasswordModal({ onClose }) {
  const [pw, setPw] = useState('')
  const [pw2, setPw2] = useState('')
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)
  const [loading, setLoading] = useState(false)
  const [show, setShow] = useState(false)
  const [show2, setShow2] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    if (pw.length < 6) { setError('Passwort muss mindestens 6 Zeichen lang sein.'); return }
    if (pw !== pw2) { setError('Passwörter stimmen nicht überein.'); return }
    setLoading(true)
    try {
      const { error } = await supabase.auth.updateUser({ password: pw })
      if (error) setError(error.message)
      else {
        setSuccess(true)
        setTimeout(onClose, 1400)
      }
    } finally { setLoading(false) }
  }

  return (
    <div style={pwStyles.overlay} onClick={onClose}>
      <div style={pwStyles.modal} onClick={e => e.stopPropagation()}>
        <div style={pwStyles.head}>
          <h3 style={pwStyles.title}>Passwort ändern</h3>
          <button style={pwStyles.close} onClick={onClose}>×</button>
        </div>
        {success ? (
          <div style={pwStyles.success}>✓ Passwort wurde geändert.</div>
        ) : (
          <form onSubmit={handleSubmit}>
            <div style={pwStyles.field}>
              <label style={pwStyles.label}>Neues Passwort</label>
              <div style={pwStyles.inputWrap}>
                <input style={{ ...pwStyles.input, paddingRight: 40 }} type={show ? 'text' : 'password'} value={pw} onChange={e => setPw(e.target.value)}
                  placeholder="mind. 6 Zeichen" required minLength={6} autoFocus />
                <button type="button" style={pwStyles.eye} onClick={() => setShow(s => !s)} aria-label={show ? 'Passwort verbergen' : 'Passwort anzeigen'}>
                  {show ? '🙈' : '👁️'}
                </button>
              </div>
            </div>
            <div style={pwStyles.field}>
              <label style={pwStyles.label}>Passwort bestätigen</label>
              <div style={pwStyles.inputWrap}>
                <input style={{ ...pwStyles.input, paddingRight: 40 }} type={show2 ? 'text' : 'password'} value={pw2} onChange={e => setPw2(e.target.value)}
                  placeholder="nochmal dasselbe" required minLength={6} />
                <button type="button" style={pwStyles.eye} onClick={() => setShow2(s => !s)} aria-label={show2 ? 'Passwort verbergen' : 'Passwort anzeigen'}>
                  {show2 ? '🙈' : '👁️'}
                </button>
              </div>
            </div>
            {error && <p style={pwStyles.error}>{error}</p>}
            <button style={pwStyles.btnPrimary} type="submit" disabled={loading}>
              {loading ? 'Speichert...' : 'Passwort speichern'}
            </button>
          </form>
        )}
      </div>
    </div>
  )
}

const pwStyles = {
  overlay: { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 },
  modal: { background: '#fff', borderRadius: 16, padding: '1.5rem', width: '100%', maxWidth: 380, boxShadow: '0 12px 40px rgba(0,0,0,0.15)' },
  head: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' },
  title: { margin: 0, fontSize: 18, fontWeight: 500 },
  close: { background: 'none', border: 'none', fontSize: 24, color: '#888', cursor: 'pointer', lineHeight: 1, padding: 0 },
  field: { marginBottom: '0.875rem' },
  label: { display: 'block', fontSize: 13, color: '#666', marginBottom: 5 },
  input: { width: '100%', padding: '10px 12px', border: '0.5px solid #ccc', borderRadius: 8, fontSize: 14, boxSizing: 'border-box', outline: 'none' },
  inputWrap: { position: 'relative' },
  eye: { position: 'absolute', right: 6, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', padding: '4px 8px', fontSize: 16, lineHeight: 1, color: '#888' },
  error: { color: '#c0392b', fontSize: 13, margin: '0 0 10px' },
  success: { background: '#E1F5EE', color: '#085041', padding: '14px 16px', borderRadius: 8, fontSize: 14, textAlign: 'center', fontWeight: 500 },
  btnPrimary: { width: '100%', padding: 11, background: '#0F6E56', color: '#fff', border: 'none', borderRadius: 8, fontSize: 14, fontWeight: 500, cursor: 'pointer', marginTop: 4 },
}

const s = {
  page: { minHeight: '100vh', background: '#f5f4f0' },
  topbar: { background: '#fff', borderBottom: '0.5px solid #e0ddd5', padding: '0.875rem 1.5rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between' },
  topbarLeft: { display: 'flex', alignItems: 'center', gap: 10 },
  greeting: { fontSize: 13, color: '#888' },
  btnNew: { padding: '8px 14px', background: '#0F6E56', color: '#fff', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 500, cursor: 'pointer' },
  btnOut: { padding: '8px 14px', background: 'transparent', color: '#888', border: '0.5px solid #ccc', borderRadius: 8, fontSize: 13, cursor: 'pointer' },
  content: { maxWidth: 680, margin: '0 auto', padding: '1.5rem 1rem' },
  tabs: { display: 'flex', gap: 2, marginBottom: '1.5rem', borderBottom: '0.5px solid #e0ddd5', overflowX: 'auto' },
  tab: { padding: '8px 14px', fontSize: 13, color: '#888', background: 'none', border: 'none', borderBottom: '2px solid transparent', marginBottom: -1, cursor: 'pointer', whiteSpace: 'nowrap' },
  tabActive: { color: '#0F6E56', borderBottomColor: '#0F6E56', fontWeight: 500 },
  kpiGrid: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: '1.5rem' },
  kpiCard: { background: '#fff', border: '0.5px solid #e0ddd5', borderRadius: 12, padding: '1rem 1.25rem' },
  kpiLabel: { fontSize: 12, color: '#888', marginBottom: 6 },
  kpiVal: { fontSize: 20, fontWeight: 500, marginBottom: 4 },
  kpiSub: { fontSize: 12, color: '#aaa' },
  section: { marginBottom: '1.5rem' },
  sectionTitle: { fontSize: 14, fontWeight: 500, marginBottom: 10, display: 'flex', alignItems: 'center', gap: 6 },
  list: { display: 'flex', flexDirection: 'column', gap: 8 },
  itemCard: { background: '#fff', border: '0.5px solid #e0ddd5', borderRadius: 12, padding: '0.875rem', display: 'flex', gap: 12, alignItems: 'center', cursor: 'pointer' },
  thumb: { width: 52, height: 52, borderRadius: 8, background: '#f5f4f0', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, overflow: 'hidden' },
  thumbImg: { width: '100%', height: '100%', objectFit: 'cover' },
  itemInfo: { flex: 1, minWidth: 0 },
  itemName: { fontSize: 14, fontWeight: 500, marginBottom: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' },
  itemMeta: { fontSize: 12, color: '#888' },
  price: { fontSize: 14, fontWeight: 500, color: '#0F6E56' },
  badge: { display: 'inline-block', padding: '3px 9px', borderRadius: 99, fontSize: 11, fontWeight: 500 },
  empty: { textAlign: 'center', padding: '3rem 1rem', color: '#aaa', fontSize: 14 },
  infoBox: { background: '#fff', border: '0.5px solid #e0ddd5', borderRadius: 12, padding: '1rem 1.25rem', marginBottom: '1.5rem' },
  infoTitle: { fontSize: 13, fontWeight: 500, marginBottom: 10 },
  infoRow: { display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: '#555', marginBottom: 6 },
  infoDot: { width: 12, height: 12, borderRadius: '50%', flexShrink: 0 },
}
