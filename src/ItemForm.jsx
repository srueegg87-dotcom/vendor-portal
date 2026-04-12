import { useState, useEffect } from 'react'
import { supabase } from './supabaseClient'
import { useAuth } from './AuthContext'

const GEMINI_KEY = import.meta.env.VITE_GEMINI_API_KEY
const SUPABASE_URL = 'https://quhqhqhfyzqknnoldyke.supabase.co'

const CATEGORIES = [
  'Kinderwagen & Buggys','Kleidung 0–12 Monate','Kleidung 1–4 Jahre',
  'Kleidung 5–12 Jahre','Spielzeug & Spiele','Bücher & Lernmaterial',
  'Babyausstattung','Möbel & Zimmer','Sport & Outdoor',
  'Accessoires','Sonstiges'
]

export default function ItemForm({ item, onBack, onSaved }) {
  const { vendor } = useAuth()
  const isEdit = !!item

  const [form, setForm] = useState({
    name: item?.name || '',
    description: item?.description || '',
    cost: item?.cost || '',
    category: item?.category || '',
    status: item?.status || 'pending',
  })
  const [photos, setPhotos] = useState([]) // { file, preview, existing, path }
  const [saving, setSaving] = useState(false)
  const [aiLoading, setAiLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  useEffect(() => {
    if (isEdit && item.item_photos?.length > 0) {
      const existing = [...item.item_photos]
        .sort((a, b) => a.reihenfolge - b.reihenfolge)
        .map(p => ({
          existing: true,
          path: p.storage_path,
          preview: `${SUPABASE_URL}/storage/v1/object/public/item-fotos/${p.storage_path}`
        }))
      setPhotos(existing)
    }
  }, [])

  function handleFiles(e) {
    const files = Array.from(e.target.files)
    const newPhotos = files.slice(0, 8 - photos.length).map(file => ({
      file,
      preview: URL.createObjectURL(file),
      existing: false,
    }))
    setPhotos(p => [...p, ...newPhotos])
  }

  function removePhoto(idx) {
    setPhotos(p => p.filter((_, i) => i !== idx))
  }

  async function generateWithGemini() {
    if (!form.name && photos.length === 0) return
    setAiLoading(true)
    try {
      const parts = []
      if (form.name) parts.push({ text: `Artikelname: ${form.name}` })
      if (form.category) parts.push({ text: `Kategorie: ${form.category}` })

      // Erstes Foto als Base64 mitsenden falls vorhanden
      const firstNew = photos.find(p => !p.existing && p.file)
      if (firstNew) {
        const base64 = await fileToBase64(firstNew.file)
        parts.push({ inline_data: { mime_type: firstNew.file.type, data: base64 } })
      }

      parts.push({
        text: `Schreibe eine kurze, ansprechende Produktbeschreibung auf Deutsch für ein Secondhand-Inserat auf Rüegg's Familienbörse (Schweiz). 
Max. 3-4 Sätze. Erwähne Zustand, Eignung und einen freundlichen Aufruf zur Kontaktaufnahme. 
Kein "Ich verkaufe". Direkt und persönlich. Nur die Beschreibung, kein Titel.`
      })

      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_KEY}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ contents: [{ parts }] })
        }
      )
      const data = await res.json()
      const text = data?.candidates?.[0]?.content?.parts?.[0]?.text
      if (text) set('description', text.trim())
    } catch (e) {
      console.error(e)
    } finally {
      setAiLoading(false)
    }
  }

  function fileToBase64(file) {
    return new Promise((res, rej) => {
      const reader = new FileReader()
      reader.onload = () => res(reader.result.split(',')[1])
      reader.onerror = rej
      reader.readAsDataURL(file)
    })
  }

  async function uploadPhotos(itemId) {
    const paths = []
    const newPhotos = photos.filter(p => !p.existing && p.file)
    for (let i = 0; i < newPhotos.length; i++) {
      const p = newPhotos[i]
      const ext = p.file.name.split('.').pop()
      const path = `${vendor.id}/${itemId}/${Date.now()}-${i}.${ext}`
      const { error } = await supabase.storage
        .from('item-fotos')
        .upload(path, p.file, { upsert: true })
      if (!error) paths.push({ path, reihenfolge: i })
    }
    return paths
  }

  async function handleSubmit(e) {
    e.preventDefault()
    if (!form.name.trim()) { setError('Bitte Titel eingeben.'); return }
    setSaving(true); setError('')

    try {
      const itemData = {
        name: form.name.trim(),
        description: form.description.trim(),
        cost: parseFloat(form.cost) || 0,
        category: form.category,
        status: form.status,
        vendor_id: vendor.id,
        vendor_name: vendor.name,
      }

      let itemId
      if (isEdit) {
        const { error } = await supabase.from('items').update(itemData).eq('id', item.id)
        if (error) throw error
        itemId = item.id
      } else {
        const { data, error } = await supabase.from('items').insert(itemData).select().single()
        if (error) throw error
        itemId = data.id
      }

      // Fotos hochladen
      const uploadedPaths = await uploadPhotos(itemId)
      if (uploadedPaths.length > 0) {
        await supabase.from('item_photos').insert(
          uploadedPaths.map(({ path, reihenfolge }) => ({ item_id: itemId, storage_path: path, reihenfolge }))
        )
      }

      setSuccess(true)
      setTimeout(() => onSaved(), 1200)
    } catch (err) {
      setError(err.message || 'Fehler beim Speichern.')
    } finally {
      setSaving(false)
    }
  }

  const canAi = form.name.length > 2 || photos.some(p => !p.existing)

  return (
    <div style={styles.page}>
      <div style={styles.topbar}>
        <button style={styles.backBtn} onClick={onBack}>← Zurück</button>
        <img src="/logo.png" alt="Rüegg's Familienbörse" style={{ height: 32, mixBlendMode: 'multiply' }} />
        <div style={{ width: 70 }} />
      </div>

      <form onSubmit={handleSubmit} style={styles.content}>
        {success && (
          <div style={styles.successBanner}>
            ✓ Gespeichert! Wird nach Prüfung freigeschaltet.
          </div>
        )}

        {/* Fotos */}
        <div style={styles.section}>
          <div style={styles.sectionLabel}>Fotos</div>
          <div style={styles.photoGrid}>
            {photos.map((p, i) => (
              <div key={i} style={styles.photoThumb}>
                <img src={p.preview} alt="" style={styles.photoImg} />
                <button type="button" style={styles.removeBtn} onClick={() => removePhoto(i)}>×</button>
              </div>
            ))}
            {photos.length < 8 && (
              <label style={styles.uploadBox}>
                <input type="file" accept="image/*" multiple onChange={handleFiles} style={{ display: 'none' }} />
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#aaa" strokeWidth="1.5">
                  <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/>
                  <polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/>
                </svg>
                <span style={{ fontSize: 12, color: '#aaa', marginTop: 4 }}>Foto hinzufügen</span>
              </label>
            )}
          </div>
          <div style={{ fontSize: 12, color: '#aaa', marginTop: 6, textAlign: 'center' }}>Bis zu 8 Bilder · JPG, PNG</div>
        </div>

        {/* Titel */}
        <div style={styles.section}>
          <label style={styles.label}>Titel *</label>
          <input style={styles.input} type="text" placeholder="z. B. Kinderwagen Bugaboo Fox, wie neu"
            value={form.name} onChange={e => set('name', e.target.value)} required />
        </div>

        {/* Beschreibung + KI */}
        <div style={styles.section}>
          <label style={styles.label}>Beschreibung</label>
          <textarea style={styles.textarea} placeholder="Beschreibe den Artikel: Zustand, Grösse, Besonderheiten..."
            value={form.description} onChange={e => set('description', e.target.value)} rows={5} />
          <div style={styles.aiBar}>
            <button type="button" style={{ ...styles.aiBtn, opacity: canAi ? 1 : 0.4 }}
              onClick={generateWithGemini} disabled={!canAi || aiLoading}>
              {aiLoading ? (
                <>
                  <span style={styles.dot} /><span style={styles.dot} /><span style={styles.dot} />
                  <span style={{ marginLeft: 6 }}>Gemini schreibt...</span>
                </>
              ) : (
                <>
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
                  </svg>
                  Mit Gemini KI generieren
                </>
              )}
            </button>
            <span style={{ fontSize: 12, color: '#aaa' }}>Aus Titel {photos.some(p => !p.existing) ? '+ Foto ' : ''}generieren</span>
          </div>
        </div>

        {/* Preis & Kategorie */}
        <div style={styles.row}>
          <div style={{ flex: 1 }}>
            <label style={styles.label}>Preis (CHF)</label>
            <input style={styles.input} type="number" placeholder="0.00" min="0" step="0.50"
              value={form.cost} onChange={e => set('cost', e.target.value)} />
          </div>
          <div style={{ flex: 1 }}>
            <label style={styles.label}>Kategorie</label>
            <select style={styles.select} value={form.category} onChange={e => set('category', e.target.value)}>
              <option value="">Bitte wählen</option>
              {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
        </div>

        {/* Status (nur bei Edit) */}
        {isEdit && (
          <div style={styles.section}>
            <label style={styles.label}>Status</label>
            <select style={styles.select} value={form.status} onChange={e => set('status', e.target.value)}>
              <option value="pending">Ausstehend</option>
              <option value="active">Aktiv</option>
              <option value="sold">Verkauft</option>
              <option value="archived">Archiviert</option>
            </select>
          </div>
        )}

        {error && <p style={styles.error}>{error}</p>}

        <div style={styles.actions}>
          <button type="button" style={styles.btnSecondary} onClick={onBack}>Abbrechen</button>
          <button type="submit" style={styles.btnPrimary} disabled={saving}>
            {saving ? 'Speichert...' : isEdit ? 'Änderungen speichern' : 'Inserat aufgeben'}
          </button>
        </div>
      </form>
    </div>
  )
}

const styles = {
  page: { minHeight: '100vh', background: '#f5f4f0' },
  topbar: { background: '#fff', borderBottom: '0.5px solid #e0ddd5', padding: '0.75rem 1.5rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between' },
  backBtn: { background: 'none', border: '0.5px solid #ccc', borderRadius: 8, padding: '6px 12px', fontSize: 13, cursor: 'pointer', color: '#666' },
  topbarTitle: { fontSize: 16, fontWeight: 500 },
  content: { maxWidth: 640, margin: '0 auto', padding: '1.5rem 1rem' },
  successBanner: { background: '#E1F5EE', border: '0.5px solid #5DCAA5', borderRadius: 8, padding: '12px 16px', marginBottom: '1rem', fontSize: 14, color: '#085041', fontWeight: 500 },
  section: { marginBottom: '1.25rem' },
  row: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: '1.25rem' },
  sectionLabel: { fontSize: 13, color: '#666', marginBottom: 8, fontWeight: 500, textAlign: 'center' },
  label: { display: 'block', fontSize: 13, color: '#666', marginBottom: 6 },
  input: { width: '100%', padding: '10px 12px', border: '0.5px solid #ccc', borderRadius: 8, fontSize: 14, boxSizing: 'border-box', background: '#fff', outline: 'none' },
  textarea: { width: '100%', padding: '10px 12px', border: '0.5px solid #ccc', borderRadius: 8, fontSize: 14, boxSizing: 'border-box', background: '#fff', outline: 'none', resize: 'vertical', fontFamily: 'inherit' },
  select: { width: '100%', padding: '10px 12px', border: '0.5px solid #ccc', borderRadius: 8, fontSize: 14, background: '#fff', outline: 'none' },
  photoGrid: { display: 'flex', flexWrap: 'wrap', gap: 8, justifyContent: 'center' },
  photoThumb: { width: 80, height: 80, borderRadius: 8, overflow: 'hidden', position: 'relative', border: '0.5px solid #e0ddd5' },
  photoImg: { width: '100%', height: '100%', objectFit: 'cover' },
  removeBtn: { position: 'absolute', top: 3, right: 3, width: 20, height: 20, background: 'rgba(0,0,0,0.5)', border: 'none', borderRadius: '50%', color: '#fff', fontSize: 13, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', lineHeight: 1 },
  uploadBox: { width: 80, height: 80, borderRadius: 8, border: '1.5px dashed #ccc', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', background: '#fafaf8' },
  aiBar: { display: 'flex', alignItems: 'center', gap: 10, marginTop: 8 },
  aiBtn: { display: 'flex', alignItems: 'center', gap: 5, padding: '6px 12px', background: '#E1F5EE', color: '#085041', border: 'none', borderRadius: 8, fontSize: 12, fontWeight: 500, cursor: 'pointer' },
  dot: { width: 5, height: 5, borderRadius: '50%', background: '#085041', display: 'inline-block', animation: 'pulse 1.2s infinite', margin: '0 1px' },
  error: { color: '#c0392b', fontSize: 13, marginBottom: 10 },
  actions: { display: 'flex', gap: 10, paddingTop: '1.5rem', borderTop: '0.5px solid #e0ddd5', marginTop: '0.5rem' },
  btnPrimary: { flex: 2, padding: 11, background: '#0F6E56', color: '#fff', border: 'none', borderRadius: 8, fontSize: 14, fontWeight: 500, cursor: 'pointer' },
  btnSecondary: { flex: 1, padding: 11, background: 'transparent', border: '0.5px solid #ccc', borderRadius: 8, fontSize: 14, color: '#666', cursor: 'pointer' },
}
