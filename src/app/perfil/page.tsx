'use client'

import { useState, useEffect, useRef } from 'react'
import HomeSidebar from '@/components/desktop/HomeSidebar'
import BottomNav from '@/components/BottomNav'

// ── Datos ──────────────────────────────────────────────
interface Addr { id: number; def: boolean; a1: string; a2: string }
interface VUser { name: string; email: string; phone: string }

const DEFAULT_ADDRS: Addr[] = [
  { id: 1, def: true, a1: 'Calle Aragón 123, 5ºB', a2: '08015 Barcelona · España' },
]
const CATS = ['Carretera', 'MTB', 'Gravel', 'Componentes', 'Ropa', 'Electrónica', 'Zapatillas']

// ── Iconos ─────────────────────────────────────────────
const pencil = <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden="true"><path d="M12 20h9" /><path d="M16.5 3.5a2.1 2.1 0 013 3L7 19l-4 1 1-4z" /></svg>
const check = <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3} aria-hidden="true"><path d="M5 12l5 5 9-11" /></svg>
const kebab = <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><circle cx="12" cy="5" r="2" /><circle cx="12" cy="12" r="2" /><circle cx="12" cy="19" r="2" /></svg>
const pin = <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.9} aria-hidden="true"><path d="M12 21s-7-6-7-11a7 7 0 0114 0c0 5-7 11-7 11z" /><circle cx="12" cy="10" r="2.5" /></svg>

export default function PerfilPage() {
  const [user, setUser] = useState<VUser | null>(null)
  const [addrs, setAddrs] = useState<Addr[]>(DEFAULT_ADDRS)
  const [openMenu, setOpenMenu] = useState<number | null>(null)
  const [active, setActive] = useState<string[]>(['Carretera', 'Componentes', 'Electrónica'])
  const [budget, setBudget] = useState(500)
  const [editingBudget, setEditingBudget] = useState(false)
  const [editField, setEditField] = useState<keyof VUser | null>(null)
  const [saving, setSaving] = useState<'saved' | 'saving'>('saved')
  const [toast, setToast] = useState<{ kind: 'ok' | 'warn'; msg: string } | null>(null)
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Cargar identidad + preferencias locales
  useEffect(() => {
    try {
      const raw = localStorage.getItem('vonda_user')
      setUser(raw ? JSON.parse(raw) : { name: '', email: '', phone: '' })
      const a = localStorage.getItem('vonda_addresses'); if (a) setAddrs(JSON.parse(a))
      const r = localStorage.getItem('vonda_radar'); if (r) { const p = JSON.parse(r); if (Array.isArray(p.active)) setActive(p.active); if (typeof p.budget === 'number') setBudget(p.budget) }
    } catch { setUser({ name: '', email: '', phone: '' }) }
  }, [])

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
  function persistAddrs(next: Addr[]) { setAddrs(next); try { localStorage.setItem('vonda_addresses', JSON.stringify(next)) } catch {} }
  function saveRadar(nextActive: string[], nextBudget: number) {
    setSaving('saving')
    try { localStorage.setItem('vonda_radar', JSON.stringify({ active: nextActive, budget: nextBudget })) } catch {}
    if (saveTimer.current) clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(() => setSaving('saved'), 800)
  }
  function toggleCat(c: string) { const next = active.includes(c) ? active.filter(x => x !== c) : [...active, c]; setActive(next); saveRadar(next, budget) }
  function saveContact(field: keyof VUser, value: string) {
    if (!user) return
    const next = { ...user, [field]: value }
    setUser(next); setEditField(null)
    try { localStorage.setItem('vonda_user', JSON.stringify(next)) } catch {}
    showToast('ok', 'Datos actualizados')
  }
  function makeDefault(id: number) {
    const next = addrs.map(a => ({ ...a, def: a.id === id })).sort((a, b) => Number(b.def) - Number(a.def))
    persistAddrs(next); setOpenMenu(null)
    showToast('ok', 'Dirección predeterminada actualizada')
  }
  function removeAddr(id: number) {
    const a = addrs.find(x => x.id === id)
    if (a?.def) { showToast('warn', 'Debes asignar otra dirección como predeterminada antes de eliminar esta'); setOpenMenu(null); return }
    persistAddrs(addrs.filter(x => x.id !== id)); setOpenMenu(null); showToast('ok', 'Dirección eliminada')
  }
  function addAddr() {
    const id = Math.max(0, ...addrs.map(a => a.id)) + 1
    persistAddrs([...addrs, { id, def: addrs.length === 0, a1: 'Nueva dirección', a2: 'Edítala para completar' }])
    showToast('ok', 'Dirección añadida — edítala para completar')
  }

  const initials = (user?.name || 'V').trim().split(/\s+/).map(w => w[0]).slice(0, 2).join('').toUpperCase() || 'V'

  return (
    <div className="min-h-screen flex" style={{ backgroundColor: '#F7F9FC' }}>
      <HomeSidebar />

      <div className="flex-1 min-w-0 flex flex-col pb-24 lg:pb-0">
        <header className="hidden lg:flex sticky top-0 z-20 px-8 h-16 items-center justify-end gap-4" style={{ backgroundColor: 'rgba(247,249,252,0.85)', backdropFilter: 'blur(8px)' }}>
          <div className="w-9 h-9 rounded-full bg-brand flex items-center justify-center text-sm font-semibold text-white">{initials}</div>
        </header>

        <main className="w-full max-w-[1180px] px-4 lg:px-8 pt-5 lg:pt-2 pb-10">
          {/* Cabecera */}
          <div className="flex items-center gap-4 lg:gap-5 mb-6">
            <div className="w-16 h-16 lg:w-[72px] lg:h-[72px] rounded-full bg-brand/10 text-brand flex items-center justify-center text-2xl font-extrabold shrink-0">{initials}</div>
            <div className="min-w-0">
              <h1 className="text-2xl lg:text-[26px] font-extrabold tracking-tight truncate">{user?.name || 'Mi perfil'}</h1>
              <p className="text-sm text-neutral-500 mt-0.5 truncate">{user?.email}</p>
            </div>
          </div>

          <div className="grid gap-5 grid-cols-1 lg:grid-cols-[minmax(0,1fr)_320px] items-start">
            {/* Izquierda: bloques */}
            <div className="flex flex-col gap-[18px]">
              <Card num="1" title="Datos de contacto">
                <ContactRow label="Nombre" value={user?.name || ''} editing={editField === 'name'} onEdit={() => setEditField('name')} onSave={v => saveContact('name', v)} />
                <ContactRow label="Email" value={user?.email || ''} verified editing={editField === 'email'} onEdit={() => setEditField('email')} onSave={v => saveContact('email', v)} />
                <ContactRow label="Teléfono" value={user?.phone || ''} verified last editing={editField === 'phone'} onEdit={() => setEditField('phone')} onSave={v => saveContact('phone', v)} />
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
                {addrs.map(a => (
                  <div key={a.id} className="relative flex items-start gap-3 p-3.5 border border-neutral-200 rounded-xl mb-3">
                    <span className="w-[34px] h-[34px] rounded-lg bg-neutral-100 text-neutral-500 flex items-center justify-center shrink-0">{pin}</span>
                    <div className="min-w-0">
                      <span className={`inline-flex items-center text-[10.5px] font-bold rounded-full px-2 py-0.5 mb-1.5 uppercase tracking-wide ${a.def ? 'bg-brand/10 text-brand' : 'bg-neutral-100 text-neutral-500'}`}>{a.def ? 'Predeterminada' : 'Secundaria'}</span>
                      <div className="text-sm font-semibold truncate">{a.a1}</div>
                      <div className="text-[12.5px] text-neutral-500 truncate">{a.a2}</div>
                    </div>
                    <button
                      onClick={e => { e.stopPropagation(); setOpenMenu(openMenu === a.id ? null : a.id) }}
                      aria-label="Opciones de la dirección" aria-haspopup="menu"
                      className="ml-auto w-8 h-8 rounded-lg text-neutral-400 hover:bg-neutral-100 flex items-center justify-center shrink-0"
                    >{kebab}</button>
                    {openMenu === a.id && (
                      <div role="menu" onClick={e => e.stopPropagation()} className="absolute top-12 right-3 z-20 min-w-[210px] bg-white border border-neutral-200 rounded-lg p-1.5" style={{ boxShadow: '0 10px 30px rgba(15,23,42,.14)' }}>
                        {!a.def && <MenuItem onClick={() => makeDefault(a.id)} icon={check}>Hacer predeterminada</MenuItem>}
                        <MenuItem onClick={() => { setOpenMenu(null); showToast('ok', 'Editar dirección (abriría el formulario)') }} icon={pencil}>Editar dirección</MenuItem>
                        <MenuItem danger onClick={() => removeAddr(a.id)} icon={<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path d="M3 6h18M8 6V4h8v2M6 6l1 14h10l1-14" /></svg>}>Eliminar dirección</MenuItem>
                      </div>
                    )}
                  </div>
                ))}
                <button onClick={addAddr} className="flex items-center justify-center gap-2 w-full border-[1.5px] border-dashed border-brand/30 text-brand rounded-xl py-3 text-[13.5px] font-bold">
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

            {/* Derecha: widgets */}
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
                  onClick={() => { try { localStorage.removeItem('vonda_user') } catch {}; window.location.href = '/' }}
                  className="w-full border border-neutral-200 hover:border-neutral-300 rounded-xl py-2.5 text-[13.5px] font-bold text-neutral-700"
                >Cerrar sesión</button>
              </div>
            </div>
          </div>
        </main>
      </div>

      <div className="lg:hidden"><BottomNav /></div>

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
