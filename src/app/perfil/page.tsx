'use client'

import { useState, useEffect, useRef } from 'react'
import { createClient } from '@/lib/supabase-browser'
import AuthPanel from '@/components/AuthPanel'
import DesktopNavbar from '@/components/desktop/DesktopNavbar'
import BottomNav from '@/components/BottomNav'

// ── Datos ──────────────────────────────────────────────
interface Addr {
  id: string; label?: string | null; line1: string; line2?: string | null
  city?: string | null; province?: string | null; postal_code?: string | null; country?: string | null; is_default: boolean
}
interface VUser { name: string; email: string; phone: string }
interface AddrForm { line1: string; line2: string; postal_code: string; city: string; province: string; label: string }

const EMPTY_FORM: AddrForm = { line1: '', line2: '', postal_code: '', city: '', province: '', label: '' }
const CATS = ['Carretera', 'MTB', 'Gravel', 'Componentes', 'Ropa', 'Electrónica', 'Zapatillas']

function addrLine2(a: Addr): string {
  return [a.line2, [a.postal_code, a.city].filter(Boolean).join(' '), a.country].filter(v => v && String(v).trim()).join(' · ')
}

// ── Iconos ─────────────────────────────────────────────
const pencil = <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden="true"><path d="M12 20h9" /><path d="M16.5 3.5a2.1 2.1 0 013 3L7 19l-4 1 1-4z" /></svg>
const check = <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3} aria-hidden="true"><path d="M5 12l5 5 9-11" /></svg>
const kebab = <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><circle cx="12" cy="5" r="2" /><circle cx="12" cy="12" r="2" /><circle cx="12" cy="19" r="2" /></svg>
const pin = <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.9} aria-hidden="true"><path d="M12 21s-7-6-7-11a7 7 0 0114 0c0 5-7 11-7 11z" /><circle cx="12" cy="10" r="2.5" /></svg>

export default function PerfilPage() {
  const [sb] = useState(() => createClient())
  const [user, setUser] = useState<VUser | null>(null)
  const [addrs, setAddrs] = useState<Addr[]>([])
  const [openMenu, setOpenMenu] = useState<string | null>(null)
  const [active, setActive] = useState<string[]>([])
  const [budget, setBudget] = useState(500)
  const [editingBudget, setEditingBudget] = useState(false)
  const [editField, setEditField] = useState<keyof VUser | null>(null)
  const [saving, setSaving] = useState<'saved' | 'saving'>('saved')
  const [toast, setToast] = useState<{ kind: 'ok' | 'warn'; msg: string } | null>(null)
  const [adding, setAdding] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState<AddrForm>(EMPTY_FORM)
  const [formDefault, setFormDefault] = useState(false)
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Sesión real (Supabase Auth). undefined = comprobando · null = sin sesión.
  const [sessionEmail, setSessionEmail] = useState<string | null | undefined>(undefined)
  useEffect(() => {
    sb.auth.getUser().then(({ data }) => setSessionEmail(data.user?.email ?? null))
  }, [])

  async function handleSignOut() {
    // Cierre de sesión DE VERDAD: antes solo se borraba localStorage, así que
    // no había forma de volver a entrar (nunca hubo sesión que reabrir).
    try { await sb.auth.signOut() } catch { /* best-effort */ }
    try { localStorage.removeItem('vonda_user') } catch { /* ignorar */ }
    window.location.href = '/'
  }

  // Cargar identidad y traer el perfil (direcciones + preferencias) del servidor
  useEffect(() => {
    let u: VUser
    try { const raw = localStorage.getItem('vonda_user'); u = raw ? JSON.parse(raw) : { name: '', email: '', phone: '' } }
    catch { u = { name: '', email: '', phone: '' } }
    // El email de la sesión manda sobre el de localStorage
    if (sessionEmail) u = { ...u, email: sessionEmail }
    setUser(u)
    if (u.email) {
      sb.rpc('get_profile', { p_phone: u.phone, p_email: u.email }).then(({ data }) => {
        if (data) {
          if (Array.isArray(data.addresses)) setAddrs(data.addresses)
          if (data.radar) { if (Array.isArray(data.radar.categories)) setActive(data.radar.categories); if (data.radar.max_price != null) setBudget(Number(data.radar.max_price)) }
        }
      })
    }
  }, [sessionEmail])

  // Cerrar menú con ESC / clic fuera
  useEffect(() => {
    function onKey(e: KeyboardEvent) { if (e.key === 'Escape') setOpenMenu(null) }
    function onClick() { setOpenMenu(null) }
    document.addEventListener('keydown', onKey)
    document.addEventListener('click', onClick)
    return () => { document.removeEventListener('keydown', onKey); document.removeEventListener('click', onClick) }
  }, [])

  function showToast(kind: 'ok' | 'warn', msg: string) {
    setToast({ kind, msg })
    if (toastTimer.current) clearTimeout(toastTimer.current)
    toastTimer.current = setTimeout(() => setToast(null), 2800)
  }

  function saveRadar(nextActive: string[], nextBudget: number) {
    setSaving('saving')
    const done = () => { if (saveTimer.current) clearTimeout(saveTimer.current); saveTimer.current = setTimeout(() => setSaving('saved'), 400) }
    if (user?.email) {
      sb.rpc('radar_prefs_save', { p_phone: user?.phone ?? '', p_email: user?.email ?? sessionEmail ?? '', p_categories: nextActive, p_max_price: nextBudget }).then(done)
    } else done()
  }
  function toggleCat(c: string) { const next = active.includes(c) ? active.filter(x => x !== c) : [...active, c]; setActive(next); saveRadar(next, budget) }

  function saveContact(field: keyof VUser, value: string) {
    if (!user) return
    const next = { ...user, [field]: value }
    setUser(next); setEditField(null)
    try { localStorage.setItem('vonda_user', JSON.stringify(next)) } catch {}
    showToast('ok', 'Datos actualizados')
  }

  async function makeDefault(id: string) {
    if (!sessionEmail) return
    const { data } = await sb.rpc('address_set_default', { p_phone: user?.phone ?? '', p_email: user?.email ?? sessionEmail ?? '', p_id: id })
    setOpenMenu(null)
    if (data?.ok) { setAddrs(data.addresses); showToast('ok', 'Dirección predeterminada actualizada') }
  }
  async function removeAddr(id: string) {
    if (!sessionEmail) return
    const { data } = await sb.rpc('address_delete', { p_phone: user?.phone ?? '', p_email: user?.email ?? sessionEmail ?? '', p_id: id })
    setOpenMenu(null)
    if (data?.ok) { setAddrs(data.addresses); showToast('ok', 'Dirección eliminada') }
    else if (data?.reason === 'default') showToast('warn', 'Debes asignar otra dirección como predeterminada antes de eliminar esta')
  }
  function closeForm() { setAdding(false); setEditingId(null); setForm(EMPTY_FORM); setFormDefault(false) }
  async function submitAddr() {
    if (!sessionEmail) { showToast('warn', 'Necesitas identificarte primero'); return }
    if (!form.line1.trim()) { showToast('warn', 'La calle es obligatoria'); return }
    const idParams = { p_phone: user?.phone ?? '', p_email: user?.email ?? sessionEmail ?? '' }
    const args = {
      ...idParams,
      p_line1: form.line1, p_line2: form.line2, p_city: form.city, p_province: form.province, p_postal: form.postal_code, p_label: form.label,
    }
    const prevIds = new Set(addrs.map(a => a.id))
    const { data } = editingId
      ? await sb.rpc('address_update', { ...args, p_id: editingId })
      : await sb.rpc('address_add', args)
    if (!data?.ok) { showToast('warn', 'No se pudo guardar la dirección'); return }
    let list = data.addresses as Addr[]
    // Marcar como predeterminada si el toggle está activo y aún no lo es.
    const targetId = editingId ?? list.find(a => !prevIds.has(a.id))?.id ?? null
    if (formDefault && targetId && !list.find(a => a.id === targetId)?.is_default) {
      const { data: d2 } = await sb.rpc('address_set_default', { ...idParams, p_id: targetId })
      if (d2?.ok) list = d2.addresses as Addr[]
    }
    setAddrs(list)
    closeForm()
    showToast('ok', editingId ? 'Dirección actualizada' : 'Dirección añadida')
  }
  function openEdit(a: Addr) {
    setOpenMenu(null)
    setForm({ line1: a.line1, line2: a.line2 || '', postal_code: a.postal_code || '', city: a.city || '', province: a.province || '', label: a.label || '' })
    setEditingId(a.id); setFormDefault(a.is_default); setAdding(true)
  }

  const menuItems = (a: Addr) => (
    <>
      {!a.is_default && <MenuItem onClick={() => makeDefault(a.id)} icon={check}>Hacer predeterminada</MenuItem>}
      <MenuItem onClick={() => openEdit(a)} icon={pencil}>Editar dirección</MenuItem>
      <MenuItem danger onClick={() => removeAddr(a.id)} icon={<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path d="M3 6h18M8 6V4h8v2M6 6l1 14h10l1-14" /></svg>}>Eliminar dirección</MenuItem>
    </>
  )
  const menuAddr = addrs.find(a => a.id === openMenu) || null
  const initials = (user?.name || 'V').trim().split(/\s+/).map(w => w[0]).slice(0, 2).join('').toUpperCase() || 'V'
  const inputCls = 'w-full text-sm border border-neutral-200 rounded-lg px-3 py-2 outline-none focus:border-brand focus:ring-2 focus:ring-brand/15'

  // Comprobando sesión
  if (sessionEmail === undefined) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: '#F7F9FC' }}>
        <p className="text-sm text-neutral-400">···</p>
      </div>
    )
  }

  // PUERTA DE ACCESO: el perfil es privado. Tras cerrar sesión se vuelve aquí,
  // y desde aquí se puede volver a entrar con Google o email.
  if (sessionEmail === null) {
    return (
      <div className="min-h-screen" style={{ backgroundColor: '#F7F9FC' }}>
        <div className="hidden lg:block"><DesktopNavbar /></div>
        <div className="max-w-md mx-auto px-4 pt-10 pb-28">
          <div className="bg-white border border-neutral-200 rounded-2xl p-6">
            <AuthPanel
              title="Entra en tu perfil"
              subtitle="Tus datos, direcciones y preferencias del Radar"
              ctaLabel="Entrar con el email"
              icon={
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" className="text-brand">
                  <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                  <circle cx="12" cy="7" r="4" />
                </svg>
              }
            />
          </div>
        </div>
        <div className="lg:hidden"><BottomNav /></div>
      </div>
    )
  }

  return (
    <div className="min-h-screen" style={{ backgroundColor: '#F7F9FC' }}>
      <div className="hidden lg:block"><DesktopNavbar /></div>

      <div className="flex-1 min-w-0 flex flex-col pb-24 lg:pb-0">
        <main className="w-full max-w-[1180px] mx-auto px-4 lg:px-8 pt-5 lg:pt-8 pb-10">
          <div className="flex items-center gap-4 lg:gap-5 mb-6">
            <div className="w-16 h-16 lg:w-[72px] lg:h-[72px] rounded-full bg-brand/10 text-brand flex items-center justify-center text-2xl font-extrabold shrink-0">{initials}</div>
            <div className="min-w-0">
              <h1 className="text-2xl lg:text-[26px] font-extrabold tracking-tight truncate">{user?.name || 'Mi perfil'}</h1>
              <p className="text-sm text-neutral-500 mt-0.5 truncate">{user?.email}</p>
            </div>
          </div>

          <div className="grid gap-5 grid-cols-1 lg:grid-cols-[minmax(0,1fr)_320px] items-start">
            <div className="flex flex-col gap-[18px]">
              <Card num="1" title="Datos de contacto">
                <ContactRow label="Nombre" value={user?.name || ''} editing={editField === 'name'} onEdit={() => setEditField('name')} onSave={v => saveContact('name', v)} />
                <ContactRow label="Email" value={user?.email || ''} verified={!!user?.email} editing={editField === 'email'} onEdit={() => setEditField('email')} onSave={v => saveContact('email', v)} />
                <ContactRow label="Teléfono" value={user?.phone || ''} last editing={editField === 'phone'} onEdit={() => setEditField('phone')} onSave={v => saveContact('phone', v)} />
              </Card>

              <Card num="2" title="Método de pago">
                <div className="flex items-center gap-3.5">
                  <span className="w-[46px] h-8 rounded-md bg-[#1A1F71] text-white text-[11px] font-extrabold italic flex items-center justify-center">VISA</span>
                  <div className="min-w-0">
                    <div className="text-[14.5px] font-semibold">Gestionado por Stripe</div>
                    <div className="text-xs text-neutral-500">Tu método de pago está seguro en la pasarela</div>
                  </div>
                  <a href="https://billing.stripe.com" target="_blank" rel="noopener noreferrer" className="ml-auto inline-flex items-center gap-1.5 text-[13px] font-bold text-brand shrink-0">
                    Gestionar en Stripe
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path d="M7 17L17 7M9 7h8v8" /></svg>
                  </a>
                </div>
              </Card>

              <Card num="3" title="Dirección de envío">
                {addrs.length === 0 && !adding && (
                  <p className="text-[13px] text-neutral-400 mb-3">Aún no tienes direcciones guardadas.</p>
                )}
                {addrs.map(a => (
                  <div key={a.id} className="relative flex items-start gap-3 p-3.5 border border-neutral-200 rounded-xl mb-3">
                    <span className="w-[34px] h-[34px] rounded-lg bg-neutral-100 text-neutral-500 flex items-center justify-center shrink-0">{pin}</span>
                    <div className="min-w-0">
                      <span className={`inline-flex items-center text-[10.5px] font-bold rounded-full px-2 py-0.5 mb-1.5 uppercase tracking-wide ${a.is_default ? 'bg-brand/10 text-brand' : 'bg-neutral-100 text-neutral-500'}`}>{a.is_default ? 'Predeterminada' : 'Secundaria'}</span>
                      <div className="text-sm font-semibold truncate">{a.line1}</div>
                      <div className="text-[12.5px] text-neutral-500 truncate">{addrLine2(a)}</div>
                    </div>
                    <button
                      onClick={e => { e.stopPropagation(); setOpenMenu(openMenu === a.id ? null : a.id) }}
                      aria-label="Opciones de la dirección" aria-haspopup="menu"
                      className="ml-auto w-8 h-8 rounded-lg text-neutral-400 hover:bg-neutral-100 flex items-center justify-center shrink-0"
                    >{kebab}</button>
                    {openMenu === a.id && (
                      <div role="menu" onClick={e => e.stopPropagation()} className="hidden lg:block absolute top-12 right-3 z-20 min-w-[210px] bg-white border border-neutral-200 rounded-lg p-1.5" style={{ boxShadow: '0 10px 30px rgba(15,23,42,.14)' }}>
                        {menuItems(a)}
                      </div>
                    )}
                  </div>
                ))}

                <button onClick={() => { setEditingId(null); setForm(EMPTY_FORM); setFormDefault(addrs.length === 0); setAdding(true) }} className="flex items-center justify-center gap-2 w-full border-[1.5px] border-dashed border-brand/30 text-brand rounded-xl py-3 text-[13.5px] font-bold">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.4}><path d="M12 5v14M5 12h14" /></svg>
                  Añadir dirección
                </button>
              </Card>

              <Card num="4" title="Preferencias del Radar" right={
                saving === 'saving'
                  ? <span className="flex items-center gap-1.5 text-[12.5px] font-semibold text-brand"><span className="w-3.5 h-3.5 rounded-full border-2 border-brand/30 border-t-brand animate-spin" />Guardando…</span>
                  : <span className="flex items-center gap-1.5 text-[12.5px] font-semibold text-emerald-500">{check} Guardado</span>
              }>
                <p className="text-[12.5px] font-bold uppercase tracking-wide text-neutral-500 mb-2.5">Categorías que sigo</p>
                <div className="flex flex-wrap gap-2">
                  {CATS.map(c => (
                    <button key={c} onClick={() => toggleCat(c)} className={`rounded-full px-3.5 py-1.5 text-[13px] font-semibold border transition-colors ${active.includes(c) ? 'bg-brand text-white border-brand' : 'bg-white text-neutral-600 border-neutral-200'}`}>{c}</button>
                  ))}
                </div>
                <p className="text-[12.5px] font-bold uppercase tracking-wide text-neutral-500 mt-5 mb-2.5">Presupuesto</p>
                <div className="flex items-center gap-1.5 flex-wrap bg-[#F6F8FB] rounded-xl px-4 py-3.5 text-[14.5px]">
                  Avisarme solo si el producto cuesta menos de{' '}
                  {editingBudget ? (
                    <input
                      type="number" defaultValue={budget} autoFocus
                      onBlur={e => { const v = parseInt(e.target.value) || budget; setBudget(v); setEditingBudget(false); saveRadar(active, v) }}
                      onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur() }}
                      className="w-[70px] text-right font-extrabold text-brand border border-brand/30 rounded-lg px-2 py-0.5 outline-none focus:ring-2 focus:ring-brand/20"
                    />
                  ) : (
                    <button onClick={() => setEditingBudget(true)} className="inline-flex items-center gap-1.5 font-extrabold text-brand">
                      {budget} €<span className="text-neutral-400">{pencil}</span>
                    </button>
                  )}
                </div>
              </Card>
            </div>

            <div className="flex flex-col gap-[18px]">
              <div className="bg-white border border-neutral-200 rounded-2xl p-5">
                <h3 className="text-sm font-bold mb-3.5">Tu actividad</h3>
                <Stat l="Grupos activos" v="2" />
                <Stat l="En tu radar" v="3" />
                <Stat l="Ahorro total" v="85 €" ok />
                <Stat l="Compras completadas" v="6" last />
              </div>
              <div className="bg-white border border-neutral-200 rounded-2xl p-5">
                <h3 className="text-sm font-bold mb-2.5">Sesión</h3>
                <p className="text-[12.5px] text-neutral-500 leading-relaxed mb-3">Tu Radar seguirá buscando ofertas por ti mientras no estás.</p>
                <button
                  onClick={handleSignOut}
                  className="w-full border border-neutral-200 hover:border-neutral-300 rounded-xl py-2.5 text-[13.5px] font-bold text-neutral-700"
                >Cerrar sesión</button>
              </div>
            </div>
          </div>
        </main>
      </div>

      <div className="lg:hidden"><BottomNav /></div>

      {/* Bottom sheet móvil para el menú de dirección */}
      <div className="lg:hidden">
        <div onClick={() => setOpenMenu(null)} className={`fixed inset-0 z-40 bg-black/40 transition-opacity ${openMenu !== null ? 'opacity-100' : 'opacity-0 pointer-events-none'}`} />
        <div role="menu" onClick={e => e.stopPropagation()} className={`fixed left-0 right-0 bottom-0 z-50 bg-white rounded-t-2xl p-3 pb-7 transition-transform duration-300 ${openMenu !== null ? 'translate-y-0' : 'translate-y-full'}`} style={{ boxShadow: '0 -8px 30px rgba(15,23,42,.15)' }}>
          <div className="w-10 h-1 rounded-full bg-neutral-200 mx-auto mb-3" />
          {menuAddr && <div className="px-2.5 pb-2 text-xs text-neutral-400 truncate">{menuAddr.line1}</div>}
          {menuAddr && menuItems(menuAddr)}
        </div>
      </div>

      {/* Modal (desktop) / hoja inferior (móvil): añadir o editar dirección */}
      <div onClick={closeForm} className={`fixed inset-0 z-[55] bg-black/40 transition-opacity ${adding ? 'opacity-100' : 'opacity-0 pointer-events-none'}`} />
      <div
        role="dialog" aria-modal="true" aria-label={editingId ? 'Editar dirección' : 'Añadir dirección'}
        onClick={e => e.stopPropagation()}
        className={`fixed z-[56] inset-x-0 bottom-0 lg:inset-0 lg:m-auto lg:h-fit lg:max-w-[440px] bg-white rounded-t-2xl lg:rounded-2xl p-5 lg:p-6 pb-8 lg:pb-6 max-h-[92vh] overflow-y-auto transition-all duration-300 ${adding ? 'translate-y-0 opacity-100' : 'translate-y-full lg:translate-y-3 opacity-0 pointer-events-none'}`}
        style={{ boxShadow: '0 -8px 40px rgba(15,23,42,.18)' }}
      >
        <div className="w-10 h-1 rounded-full bg-neutral-200 mx-auto mb-4 lg:hidden" />
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-base font-extrabold">{editingId ? 'Editar dirección' : 'Añadir dirección'}</h3>
          <button onClick={closeForm} aria-label="Cerrar" className="w-8 h-8 rounded-lg text-neutral-400 hover:bg-neutral-100 flex items-center justify-center">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2}><path d="M6 6l12 12M18 6L6 18" /></svg>
          </button>
        </div>
        <div className="space-y-3">
          <Field label="Calle y número" required>
            <input className={inputCls} placeholder="Rúa do Ensino 14" value={form.line1} onChange={e => setForm({ ...form, line1: e.target.value })} />
          </Field>
          <Field label="Piso, puerta">
            <input className={inputCls} placeholder="3ºB (opcional)" value={form.line2} onChange={e => setForm({ ...form, line2: e.target.value })} />
          </Field>
          <div className="flex gap-3">
            <div className="w-[38%]">
              <Field label="C.P." required>
                <input className={inputCls} inputMode="numeric" placeholder="15686" value={form.postal_code} onChange={e => setForm({ ...form, postal_code: e.target.value })} />
              </Field>
            </div>
            <div className="flex-1">
              <Field label="Ciudad" required>
                <input className={inputCls} placeholder="Ponte Carreira" value={form.city} onChange={e => setForm({ ...form, city: e.target.value })} />
              </Field>
            </div>
          </div>
          <Field label="Provincia">
            <input className={inputCls} placeholder="A Coruña" value={form.province} onChange={e => setForm({ ...form, province: e.target.value })} />
          </Field>
          <Field label="Etiqueta">
            <input className={inputCls} placeholder="Casa, Trabajo… (opcional)" value={form.label} onChange={e => setForm({ ...form, label: e.target.value })} />
          </Field>
          <button type="button" role="switch" aria-checked={formDefault} onClick={() => setFormDefault(v => !v)} className="flex items-center justify-between w-full pt-1">
            <span className="text-[13.5px] font-semibold text-neutral-700">Marcar como predeterminada</span>
            <span className={`relative w-11 h-6 rounded-full transition-colors shrink-0 ${formDefault ? 'bg-brand' : 'bg-neutral-300'}`}>
              <span className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white transition-transform ${formDefault ? 'translate-x-5' : ''}`} />
            </span>
          </button>
        </div>
        <div className="flex gap-3 pt-5">
          <button onClick={closeForm} className="px-5 py-3 rounded-xl border border-neutral-200 text-[13.5px] font-semibold text-neutral-600">Cancelar</button>
          <button onClick={submitAddr} className="flex-1 bg-brand text-white rounded-xl py-3 text-[13.5px] font-bold">{editingId ? 'Guardar cambios' : 'Guardar dirección'}</button>
        </div>
      </div>

      {/* Toast */}
      <div className={`fixed bottom-24 lg:bottom-6 left-1/2 z-[60] flex items-center gap-2.5 rounded-xl px-4 py-3 text-[13.5px] text-white transition-all ${toast ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-3 pointer-events-none'}`} style={{ transform: 'translateX(-50%)', backgroundColor: '#0E1220', boxShadow: '0 12px 30px rgba(15,23,42,.25)', maxWidth: '90vw' }}>
        {toast?.kind === 'warn'
          ? <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#FBBF24" strokeWidth={2.4} className="shrink-0"><path d="M12 3l9 16H3z" /><path d="M12 10v4M12 17h.01" /></svg>
          : <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#4ADE80" strokeWidth={3} className="shrink-0"><path d="M5 12l5 5 9-11" /></svg>}
        <span>{toast?.msg}</span>
      </div>
    </div>
  )
}

// ── Subcomponentes ─────────────────────────────────────
function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="block text-[12px] font-semibold text-neutral-600 mb-1">{label}{required && <span className="text-brand"> *</span>}</span>
      {children}
    </label>
  )
}

function Card({ num, title, right, children }: { num: string; title: string; right?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="bg-white border border-neutral-200 rounded-2xl p-5 lg:px-[22px]">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2.5 text-base font-bold">
          <span className="w-6 h-6 rounded-lg bg-brand/10 text-brand flex items-center justify-center text-xs font-extrabold">{num}</span>
          {title}
        </div>
        {right}
      </div>
      {children}
    </div>
  )
}

function ContactRow({ label, value, verified, last, editing, onEdit, onSave }: { label: string; value: string; verified?: boolean; last?: boolean; editing: boolean; onEdit: () => void; onSave: (v: string) => void }) {
  return (
    <div className={`flex items-center justify-between py-2.5 ${last ? '' : 'border-b border-neutral-100'}`}>
      <span className="text-[12.5px] text-neutral-500 w-[80px] shrink-0">{label}</span>
      {editing ? (
        <input
          defaultValue={value} autoFocus
          onBlur={e => onSave(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur() }}
          className="flex-1 text-[14.5px] font-semibold border border-brand/30 rounded-lg px-2.5 py-1.5 outline-none focus:ring-2 focus:ring-brand/20"
        />
      ) : (
        <span className="flex-1 text-[14.5px] font-semibold flex items-center min-w-0">
          <span className="truncate">{value || '—'}</span>
          {verified && <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-500 bg-emerald-50 rounded-full px-2 py-0.5 ml-2 shrink-0">{check}Verificado</span>}
        </span>
      )}
      {!editing && (
        <button onClick={onEdit} aria-label={`Editar ${label}`} className="w-[30px] h-[30px] rounded-lg text-neutral-400 hover:bg-brand/10 hover:text-brand flex items-center justify-center shrink-0 ml-1">{pencil}</button>
      )}
    </div>
  )
}

function MenuItem({ children, icon, danger, onClick }: { children: React.ReactNode; icon: React.ReactNode; danger?: boolean; onClick: () => void }) {
  return (
    <button role="menuitem" onClick={onClick} className={`flex items-center gap-2.5 w-full text-left px-2.5 py-2 rounded-md text-[13.5px] font-medium ${danger ? 'text-red-500 hover:bg-red-50' : 'text-neutral-700 hover:bg-neutral-50'}`}>
      {icon}{children}
    </button>
  )
}

function Stat({ l, v, ok, last }: { l: string; v: string; ok?: boolean; last?: boolean }) {
  return (
    <div className={`flex items-center justify-between py-2.5 ${last ? '' : 'border-b border-neutral-100'}`}>
      <span className="text-[13px] text-neutral-500">{l}</span>
      <span className={`text-base font-extrabold ${ok ? 'text-emerald-500' : ''}`}>{v}</span>
    </div>
  )
}
