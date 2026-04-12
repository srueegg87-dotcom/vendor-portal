import { useEffect, useState } from 'react'
import { supabase } from './supabaseClient'
import { useAuth } from './AuthContext'

const STATUS_LABEL = { pending: 'Ausstehend', active: 'Aktiv', sold: 'Verkauft', archived: 'Archiviert' }
const STATUS_COLOR = { pending: { bg: '#FAEEDA', color: '#633806' }, active: { bg: '#E1F5EE', color: '#085041' }, sold: { bg: '#E6F1FB', color: '#0C447C' }, archived: { bg: '#F1EFE8', color: '#444441' } }

export default function Dashboard({ onNewItem, onEditItem }) {
  const { vendor, signOut } = useAuth()
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState('all')

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

  const filtered = tab === 'all' ? items : items.filter(i => i.status === tab)
  const stats = {
    total: items.length,
    active: items.filter(i => i.status === 'active').length,
    sold: items.filter(i => i.status === 'sold').length,
  }

  function getThumb(item) {
    if (item.item_photos?.length > 0) {
      const sorted = [...item.item_photos].sort((a, b) => a.reihenfolge - b.reihenfolge)
      return `https://quhqhqhfyzqknnoldyke.supabase.co/storage/v1/object/public/item-fotos/${sorted[0].storage_path}`
    }
    if (item.image) return item.image
    return null
  }

  return (
    <div style={styles.page}>
      <div style={styles.topbar}>
        <div style={styles.topbarLeft}>
          <img src="/logo.png" alt="Rüegg's Familienbörse" style={{ height: 36, mixBlendMode: 'multiply' }} />
          <div style={styles.logoSub}>Hallo, {vendor?.name || 'Verkäufer'}</div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button style={styles.btnNew} onClick={onNewItem}>+ Neues Inserat</button>
          <button style={styles.btnOut} onClick={signOut}>Abmelden</button>
        </div>
      </div>

      <div style={styles.content}>
        <div style={styles.statsRow}>
          <div style={styles.stat}><div style={styles.statLabel}>Inserate</div><div style={styles.statVal}>{stats.total}</div></div>
          <div style={styles.stat}><div style={styles.statLabel}>Aktiv</div><div style={styles.statVal}>{stats.active}</div></div>
          <div style={styles.stat}><div style={styles.statLabel}>Verkauft</div><div style={styles.statVal}>{stats.sold}</div></div>
        </div>

        <div style={styles.tabs}>
          {['all', 'pending', 'active', 'sold'].map(t => (
            <button key={t} style={{ ...styles.tab, ...(tab === t ? styles.tabActive : {}) }} onClick={() => setTab(t)}>
              {t === 'all' ? 'Alle' : STATUS_LABEL[t]}
            </button>
          ))}
        </div>

        {loading ? (
          <div style={styles.empty}>Lädt...</div>
        ) : filtered.length === 0 ? (
          <div style={styles.empty}>
            {tab === 'all' ? 'Noch keine Inserate. Erstelle dein erstes!' : 'Keine Inserate in diesem Status.'}
          </div>
        ) : (
          <div style={styles.list}>
            {filtered.map(item => {
              const thumb = getThumb(item)
              const sc = STATUS_COLOR[item.status] || STATUS_COLOR.pending
              return (
                <div key={item.id} style={styles.itemCard} onClick={() => onEditItem(item)}>
                  <div style={styles.thumb}>
                    {thumb ? <img src={thumb} alt="" style={styles.thumbImg} /> : <span style={{ fontSize: 22 }}>🏷️</span>}
                  </div>
                  <div style={styles.itemInfo}>
                    <div style={styles.itemName}>{item.name}</div>
                    <div style={styles.itemMeta}>{item.category || '–'}</div>
                  </div>
                  <div style={{ textAlign: 'right', display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6 }}>
                    <div style={styles.price}>CHF {Number(item.cost || 0).toFixed(2)}</div>
                    <span style={{ ...styles.badge, background: sc.bg, color: sc.color }}>
                      {STATUS_LABEL[item.status] || item.status}
                    </span>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}

const styles = {
  page: { minHeight: '100vh', background: '#f5f4f0' },
  topbar: { background: '#fff', borderBottom: '0.5px solid #e0ddd5', padding: '1rem 1.5rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between' },
  topbarLeft: { display: 'flex', alignItems: 'center', gap: 10 },
  logoSub: { fontSize: 12, color: '#888' },
  btnNew: { padding: '8px 14px', background: '#0F6E56', color: '#fff', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 500, cursor: 'pointer' },
  btnOut: { padding: '8px 14px', background: 'transparent', color: '#888', border: '0.5px solid #ccc', borderRadius: 8, fontSize: 13, cursor: 'pointer' },
  content: { maxWidth: 680, margin: '0 auto', padding: '1.5rem 1rem' },
  statsRow: { display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, marginBottom: '1.5rem' },
  stat: { background: '#fff', border: '0.5px solid #e0ddd5', borderRadius: 10, padding: '1rem' },
  statLabel: { fontSize: 12, color: '#888', marginBottom: 4 },
  statVal: { fontSize: 24, fontWeight: 500 },
  tabs: { display: 'flex', gap: 4, marginBottom: '1rem', borderBottom: '0.5px solid #e0ddd5', paddingBottom: 0 },
  tab: { padding: '8px 14px', fontSize: 13, color: '#888', background: 'none', border: 'none', borderBottom: '2px solid transparent', marginBottom: -1, cursor: 'pointer' },
  tabActive: { color: '#0F6E56', borderBottomColor: '#0F6E56', fontWeight: 500 },
  list: { display: 'flex', flexDirection: 'column', gap: 10 },
  itemCard: { background: '#fff', border: '0.5px solid #e0ddd5', borderRadius: 12, padding: '1rem', display: 'flex', gap: 12, alignItems: 'center', cursor: 'pointer' },
  thumb: { width: 56, height: 56, borderRadius: 8, background: '#f5f4f0', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, overflow: 'hidden' },
  thumbImg: { width: '100%', height: '100%', objectFit: 'cover' },
  itemInfo: { flex: 1, minWidth: 0 },
  itemName: { fontSize: 14, fontWeight: 500, marginBottom: 3, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' },
  itemMeta: { fontSize: 12, color: '#888' },
  price: { fontSize: 15, fontWeight: 500, color: '#0F6E56' },
  badge: { display: 'inline-block', padding: '2px 9px', borderRadius: 99, fontSize: 11, fontWeight: 500 },
  empty: { textAlign: 'center', padding: '3rem 1rem', color: '#aaa', fontSize: 14 },
}
