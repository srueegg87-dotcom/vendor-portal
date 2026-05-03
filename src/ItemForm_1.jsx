import { useState, useEffect, useRef } from 'react'
import { supabase } from './supabaseClient'
import { useAuth } from './AuthContext'

const SUPABASE_URL = 'https://quhqhqhfyzqknnoldyke.supabase.co'

// Bekannte Kategorien (KI darf neue vorschlagen)
const CATEGORIES = [
  'Kinderwagen & Buggys', 'Kleidung 0-12 Monate', 'Kleidung 1-4 Jahre',
  'Kleidung 5-12 Jahre', 'Spielzeug & Spiele', 'Bücher & Lernmaterial',
  'Babyausstattung', 'Möbel & Zimmer', 'Sport & Outdoor',
  'Accessoires', 'Sonstiges'
]

const isClothing = (cat) => (cat || '').toLowerCase().includes('kleidung')

// Frist-Berechnung (für die Anzeige)
function fristMonate(category) {
  const c = (category || '').toLowerCase()
  if (c.includes('spielzeug')) return 6
  return 3
}

export default function ItemForm({ item, onBack, onSaved }) {
  const { vendor } = useAuth()
  const isEdit = !!item

  // Steps: upload | analyzing | preview | edit (manuell oder bestehend bearbeiten)
  const [step, setStep] = useState(isEdit ? 'edit' : 'upload')
  const [imgData, setImgData] = useState(null)   // DataURL (für Anzeige)
  const [imgFile, setImgFile] = useState(null)   // File-Objekt (für Storage-Upload)
  const [imgB64, setImgB64] = useState(null)     // reines Base64 (für KI)

  const [form, setForm] = useState({
    name: item?.name || '',
    description: item?.description || '',
    cost: item?.cost || '',
    category: item?.category || '',
  })

  const [existingPhotos, setExistingPhotos] = useState([])
  const [extraPhotos, setExtraPhotos] = useState([])  // weitere Fotos {file, preview}

  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)
  const fileRef = useRef(null)
  const camRef = useRef(null)
  const extraRef = useRef(null)
  const savingRef = useRef(false)

  // Bestehende Fotos laden im Edit-Modus
  useEffect(() => {
    if (isEdit && item.item_photos?.length > 0) {
      const sorted = [...item.item_photos]
        .sort((a, b) => a.reihenfolge - b.reihenfolge)
        .map(p => ({
          existing: true,
          path: p.storage_path,
          preview: `${SUPABASE_URL}/storage/v1/object/public/item-fotos/${p.storage_path}`
        }))
      setExistingPhotos(sorted)
    }
  }, [])

  // ───── Foto laden + komprimieren ─────
  const loadFile = (file) => {
    if (!file) return
    setImgFile(file)
    const reader = new FileReader()
    reader.onload = e => {
      setImgData(e.target.result)
      const img = new Image()
      img.onload = () => {
        const cv = document.createElement('canvas')
        const MAX = 900
        let w = img.width, h = img.height
        if (w > MAX || h > MAX) {
          if (w > h) { h = h * MAX / w; w = MAX } else { w = w * MAX / h; h = MAX }
        }
        cv.width = w; cv.height = h
        cv.getContext('2d').drawImage(img, 0, 0, w, h)
        setImgB64(cv.toDataURL('image/jpeg', 0.85).split(',')[1])
      }
      img.src = e.target.result
    }
    reader.readAsDataURL(file)
  }

  // ───── KI-Analyse ─────
  const analyze = async () => {
    setStep('analyzing'); setError('')
    try {
      const res = await fetch('https://secondhand-lovat.vercel.app/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          imageBase64: imgB64,
          vendorNames: vendor?.name || '',
          categories: CATEGORIES.join(', ')
        })
      })
      const s = await res.json()
      if (!res.ok || s.error) throw new Error(s.error || 'KI-Fehler')

      setForm({
        name: s.name || '',
        category: s.category || 'Sonstiges',
        description: s.description || '',
        // Bei Kleidung: Preis komplett leer (Shop bestimmt)
        cost: isClothing(s.category) ? '' : (s.price?.toString() || ''),
      })
      setStep('preview')
    } catch (e) {
      setError('KI-Analyse fehlgeschlagen: ' + e.message)
      setStep('upload')
    }
  }

  // ───── weitere Fotos hinzufügen (im preview/edit-Step) ─────
  const handleExtraFiles = (e) => {
    const files = Array.from(e.target.files)
    const newPhotos = files.slice(0, 7 - extraPhotos.length - existingPhotos.length).map(file => ({
      file,
      preview: URL.createObjectURL(file)
    }))
    setExtraPhotos(p => [...p, ...newPhotos])
  }

  const removeExtra = (idx) => {
    setExtraPhotos(p => p.filter((_, i) => i !== idx))
  }

  const removeExisting = async (idx) => {
    if (!window.confirm('Foto wirklich entfernen?')) return
    const photo = existingPhotos[idx]
    await supabase.from('item_photos').delete().eq('storage_path', photo.path)
    await supabase.storage.from('item-fotos').remove([photo.path])
    setExistingPhotos(p => p.filter((_, i) => i !== idx))
  }

  // ───── Storage-Upload für Fotos ─────
  async function uploadPhotos(itemId, photoFiles) {
    const paths = []
    for (let i = 0; i < photoFiles.length; i++) {
      const file = photoFiles[i]
      const ext = file.name.split('.').pop() || 'jpg'
      const path = `${vendor.id}/${itemId}/${Date.now()}-${i}.${ext}`
      const { error } = await supabase.storage.from('item-fotos').upload(path, file)
      if (!error) paths.push({ path, reihenfolge: existingPhotos.length + i })
    }
    return paths
  }

  // ───── Speichern (neu oder bearbeiten) ─────
  const save = async () => {
    if (savingRef.current) return
    if (!form.name.trim()) { setError('Bitte Artikelname eingeben.'); return }
    if (!form.category) { setError('Bitte Kategorie wählen.'); return }
    if (!isClothing(form.category) && !form.cost) { setError('Bitte Preis eingeben.'); return }

    savingRef.current = true
    setSaving(true); setError('')

    try {
      const cat = form.category
      const cost = isClothing(cat) ? null : Number(form.cost)

      const ablauf = new Date()
      ablauf.setMonth(ablauf.getMonth() + fristMonate(cat))
      const ablaufdatum = ablauf.toISOString().split('T')[0]

      let itemId
      if (isEdit) {
        const { error } = await supabase.from('items').update({
          name: form.name,
          description: form.description,
          cost,
          category: cat,
        }).eq('id', item.id)
        if (error) throw error
        itemId = item.id
      } else {
        const { data, error } = await supabase.from('items').insert({
          name: form.name,
          description: form.description,
          cost,
          category: cat,
          status: 'pending',
          vendor_id: vendor.id,
          vendor_name: vendor.name,
          added: new Date().toISOString().split('T')[0],
          ablaufdatum,
        }).select().single()
        if (error) throw error
        itemId = data.id
      }

      // Fotos hochladen: KI-Hauptfoto + extra Fotos
      const filesToUpload = []
      if (imgFile) filesToUpload.push(imgFile)
      filesToUpload.push(...extraPhotos.map(p => p.file))

      if (filesToUpload.length > 0) {
        const uploaded = await uploadPhotos(itemId, filesToUpload)
        if (uploaded.length > 0) {
          await supabase.from('item_photos').insert(
            uploaded.map(({ path, reihenfolge }) => ({
              item_id: itemId,
              storage_path: path,
              reihenfolge
            }))
          )
        }
      }

      setSuccess(true)
      setTimeout(() => onSaved(), 1200)
    } catch (err) {
      setError(err.message || 'Fehler beim Speichern.')
    } finally {
      setSaving(false)
      savingRef.current = false
    }
  }

  // ═════════════════════ UI ═════════════════════

  // ─── Step: UPLOAD ───
  if (step === 'upload') return (
    <div style={s.page}>
      <div style={s.topbar}>
        <button style={s.backBtn} onClick={onBack}>← Zurück</button>
        <img src="/logo.png" alt="Rüegg's Familienbörse" style={{ height: 32, mixBlendMode: 'multiply' }} />
        <div style={{ width: 70 }} />
      </div>
      <div style={s.content}>
        <h2 style={s.title}>📸 Foto & KI</h2>
        <p style={s.sub}>Foto aufnehmen → die KI erkennt Marke, Beschreibung und schlägt einen Preis vor.</p>

        {error && <div style={s.errorBox}>{error}</div>}

        {!imgData ? (
          <>
            <button onClick={() => camRef.current?.click()} style={s.bigBtn}>
              <span style={{ fontSize: 44 }}>📷</span>
              <span style={{ fontWeight: 700, fontSize: 16, color: '#0F6E56' }}>Foto aufnehmen</span>
            </button>
            <button onClick={() => fileRef.current?.click()} style={s.bigBtnAlt}>
              <span style={{ fontSize: 28 }}>🖼️</span>
              <span style={{ fontWeight: 600, fontSize: 15 }}>Bild aus Galerie</span>
            </button>
          </>
        ) : (
          <>
            <div style={s.imgPreview}>
              <img src={imgData} alt="" style={{ width: '100%', maxHeight: 280, objectFit: 'contain', display: 'block' }} />
              <button onClick={() => { setImgData(null); setImgFile(null); setImgB64(null) }} style={s.imgRemove}>×</button>
            </div>
            <button onClick={analyze} style={s.aiBtn}>🤖 Mit KI analysieren</button>
            <button onClick={() => setStep('edit')} style={s.linkBtn}>Lieber manuell erfassen →</button>
          </>
        )}

        <input ref={fileRef} type="file" accept="image/*" style={{ display: 'none' }}
          onChange={e => loadFile(e.target.files[0])} />
        <input ref={camRef} type="file" accept="image/*" capture="environment" style={{ display: 'none' }}
          onChange={e => loadFile(e.target.files[0])} />
      </div>
    </div>
  )

  // ─── Step: ANALYZING ───
  if (step === 'analyzing') return (
    <div style={s.page}>
      <div style={s.topbar}>
        <div style={{ width: 70 }} />
        <img src="/logo.png" alt="" style={{ height: 32, mixBlendMode: 'multiply' }} />
        <div style={{ width: 70 }} />
      </div>
      <div style={{ ...s.content, textAlign: 'center', paddingTop: '3rem' }}>
        {imgData && <img src={imgData} alt="" style={{ width: 100, height: 100, objectFit: 'cover', borderRadius: 12, marginBottom: 24, filter: 'brightness(0.7)' }} />}
        <div style={{ display: 'flex', justifyContent: 'center', gap: 8, marginBottom: 16 }}>
          {[0, 1, 2].map(i => (
            <div key={i} style={{
              width: 12, height: 12, background: '#0F6E56', borderRadius: '50%',
              animation: `vp-pulse 1.3s ${i * 0.22}s ease-in-out infinite`
            }} />
          ))}
        </div>
        <h2 style={{ fontSize: 18, fontWeight: 500, marginBottom: 6 }}>🤖 KI analysiert dein Foto…</h2>
        <p style={{ color: '#888', fontSize: 14 }}>Marke, Beschreibung & Preis werden erkannt.</p>
        <style>{`@keyframes vp-pulse { 0%,100%{transform:scale(.7);opacity:.5} 50%{transform:scale(1);opacity:1} }`}</style>
      </div>
    </div>
  )

  // ─── Step: PREVIEW (KI-Vorschlag prüfen) oder EDIT (manuell/bearbeiten) ───
  return (
    <div style={s.page}>
      <div style={s.topbar}>
        <button style={s.backBtn} onClick={() => isEdit ? onBack() : setStep('upload')}>← Zurück</button>
        <img src="/logo.png" alt="" style={{ height: 32, mixBlendMode: 'multiply' }} />
        <div style={{ width: 70 }} />
      </div>

      <div style={s.content}>
        {success && <div style={s.successBanner}>✓ Gespeichert! Wird vom Shop geprüft.</div>}

        <h2 style={s.title}>
          {step === 'preview' ? '✨ KI-Vorschlag prüfen' : (isEdit ? 'Inserat bearbeiten' : 'Neues Inserat')}
        </h2>
        {step === 'preview' && (
          <p style={s.sub}>Schau alles kurz an und passe an, falls nötig.</p>
        )}

        {error && <div style={s.errorBox}>{error}</div>}

        {/* Foto-Vorschau */}
        {imgData && (
          <div style={s.imgPreviewSmall}>
            <img src={imgData} alt="" style={{ width: '100%', maxHeight: 200, objectFit: 'contain', display: 'block' }} />
          </div>
        )}

        {/* Bestehende Fotos im Edit-Modus + Galerie */}
        {(existingPhotos.length > 0 || extraPhotos.length > 0) && (
          <div style={s.photoGrid}>
            {existingPhotos.map((p, i) => (
              <div key={'e' + i} style={s.photoThumb}>
                <img src={p.preview} alt="" style={s.photoImg} />
                <button type="button" style={s.removeBtn} onClick={() => removeExisting(i)}>×</button>
              </div>
            ))}
            {extraPhotos.map((p, i) => (
              <div key={'n' + i} style={s.photoThumb}>
                <img src={p.preview} alt="" style={s.photoImg} />
                <button type="button" style={s.removeBtn} onClick={() => removeExtra(i)}>×</button>
              </div>
            ))}
          </div>
        )}

        {/* Weitere Fotos hinzufügen */}
        {(existingPhotos.length + extraPhotos.length + (imgFile ? 1 : 0)) < 8 && (
          <button type="button" style={s.addPhotoBtn} onClick={() => extraRef.current?.click()}>
            + weitere Fotos hinzufügen
          </button>
        )}
        <input ref={extraRef} type="file" accept="image/*" multiple style={{ display: 'none' }}
          onChange={handleExtraFiles} />

        {/* Form-Felder */}
        <div style={s.field}>
          <label style={s.label}>Artikelname</label>
          <input style={s.input} value={form.name}
            onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
            placeholder="z.B. Maxi-Cosi Babyschale" />
        </div>

        <div style={s.field}>
          <label style={s.label}>Kategorie</label>
          <select style={s.input} value={form.category}
            onChange={e => setForm(f => ({ ...f, category: e.target.value }))}>
            <option value="">— bitte wählen —</option>
            {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
            {form.category && !CATEGORIES.includes(form.category) && (
              <option value={form.category}>{form.category} (KI-Vorschlag)</option>
            )}
          </select>
          {form.category && (
            <div style={s.helper}>Frist bei dieser Kategorie: {fristMonate(form.category)} Monate</div>
          )}
        </div>

        <div style={s.field}>
          <label style={s.label}>Beschreibung</label>
          <textarea style={{ ...s.input, minHeight: 80, resize: 'vertical' }} value={form.description}
            onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
            placeholder="Zustand, Material, Besonderheiten…" />
        </div>

        <div style={s.field}>
          <label style={s.label}>
            Preis (CHF){isClothing(form.category) && <span style={{ color: '#888', fontWeight: 400 }}> – wird vom Shop bestimmt</span>}
          </label>
          <input style={{ ...s.input, ...(isClothing(form.category) ? s.inputDisabled : {}) }}
            type="number" step="0.05" value={form.cost}
            onChange={e => setForm(f => ({ ...f, cost: e.target.value }))}
            disabled={isClothing(form.category)}
            placeholder={isClothing(form.category) ? 'Wird vom Shop festgelegt' : 'z.B. 25.00'} />
        </div>

        <div style={s.actions}>
          <button type="button" style={s.btnSecondary} onClick={onBack}>Abbrechen</button>
          <button type="button" style={s.btnPrimary} onClick={save} disabled={saving}>
            {saving ? 'Speichert…' : (isEdit ? '💾 Speichern' : '✓ Inserieren')}
          </button>
        </div>
      </div>
    </div>
  )
}

const s = {
  page: { minHeight: '100vh', background: '#f5f4f0' },
  topbar: { background: '#fff', borderBottom: '0.5px solid #e0ddd5', padding: '0.75rem 1rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between' },
  backBtn: { background: 'none', border: 'none', fontSize: 14, color: '#0F6E56', cursor: 'pointer', padding: '4px 8px', minWidth: 70, textAlign: 'left' },
  content: { maxWidth: 600, margin: '0 auto', padding: '1.5rem 1rem' },
  title: { fontSize: 22, fontWeight: 500, marginBottom: 4 },
  sub: { fontSize: 14, color: '#666', marginBottom: '1.25rem' },
  errorBox: { background: '#FCEBEB', color: '#791F1F', borderRadius: 8, padding: '12px 16px', marginBottom: 16, fontSize: 14 },
  successBanner: { background: '#E1F5EE', color: '#085041', borderRadius: 8, padding: '12px 16px', marginBottom: 16, fontSize: 14, fontWeight: 500 },

  // Upload-Step
  bigBtn: { width: '100%', padding: '32px 20px', background: '#E1F5EE', border: '2px dashed #0F6E56', borderRadius: 16, cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10, marginBottom: 12 },
  bigBtnAlt: { width: '100%', padding: '20px', background: '#fff', border: '2px dashed #ccc', borderRadius: 16, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12, color: '#555' },
  imgPreview: { position: 'relative', borderRadius: 16, overflow: 'hidden', background: '#f0ede9', marginBottom: 12 },
  imgPreviewSmall: { position: 'relative', borderRadius: 12, overflow: 'hidden', background: '#f0ede9', marginBottom: 16 },
  imgRemove: { position: 'absolute', top: 10, right: 10, background: 'rgba(0,0,0,0.6)', color: '#fff', border: 'none', borderRadius: '50%', width: 34, height: 34, cursor: 'pointer', fontSize: 18, fontWeight: 700 },
  aiBtn: { width: '100%', padding: '16px', background: '#0F6E56', color: '#fff', border: 'none', borderRadius: 12, fontSize: 16, fontWeight: 700, cursor: 'pointer', marginBottom: 8 },
  linkBtn: { width: '100%', padding: '12px', background: 'transparent', color: '#888', border: 'none', cursor: 'pointer', fontSize: 13, textDecoration: 'underline' },

  // Foto-Galerie
  photoGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(80px, 1fr))', gap: 8, marginBottom: 12 },
  photoThumb: { position: 'relative', aspectRatio: '1', borderRadius: 8, overflow: 'hidden', background: '#f0ede9' },
  photoImg: { width: '100%', height: '100%', objectFit: 'cover' },
  removeBtn: { position: 'absolute', top: 4, right: 4, background: 'rgba(0,0,0,0.7)', color: '#fff', border: 'none', borderRadius: '50%', width: 22, height: 22, cursor: 'pointer', fontSize: 14, lineHeight: 1, padding: 0 },
  addPhotoBtn: { width: '100%', padding: '10px', background: 'transparent', color: '#666', border: '1px dashed #ccc', borderRadius: 8, cursor: 'pointer', fontSize: 13, marginBottom: 16 },

  // Form
  field: { marginBottom: '1rem' },
  label: { display: 'block', fontSize: 13, color: '#666', marginBottom: 5, fontWeight: 500 },
  input: { width: '100%', padding: '10px 12px', border: '0.5px solid #ccc', borderRadius: 8, fontSize: 14, boxSizing: 'border-box', outline: 'none', fontFamily: 'inherit', background: '#fff' },
  inputDisabled: { background: '#f5f4f0', color: '#aaa', cursor: 'not-allowed' },
  helper: { fontSize: 12, color: '#888', marginTop: 4 },
  actions: { display: 'flex', gap: 10, marginTop: '1.5rem' },
  btnPrimary: { flex: 1, padding: 11, background: '#0F6E56', color: '#fff', border: 'none', borderRadius: 8, fontSize: 14, fontWeight: 500, cursor: 'pointer' },
  btnSecondary: { flex: 1, padding: 11, background: 'transparent', color: '#666', border: '0.5px solid #ccc', borderRadius: 8, fontSize: 14, cursor: 'pointer' },
}
