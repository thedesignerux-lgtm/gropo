import Link from 'next/link'
import { notFound } from 'next/navigation'
import { supabaseAdmin } from '@/lib/supabase-admin'
import CloseGroupButton from './CloseGroupButton'
import GenerateLabelsButton from './GenerateLabelsButton'
import EditGroupForm from './EditGroupForm'
import AssignSellerForm from './AssignSellerForm'
import { resolveGroupBadge } from '@/lib/statusBadge'

export const dynamic = 'force-dynamic'

const PAYMENT_BADGE: Record<string, { label: string; cls: string }> = {
  pending:     { label: 'Pendiente',         cls: 'bg-gray-100 text-gray-600' },
  authorized:  { label: 'Autorizado',        cls: 'bg-blue-100 text-blue-700' },
  instructed:  { label: 'Instruido',         cls: 'bg-orange-100 text-orange-700' },
  paid:        { label: 'Pagado',            cls: 'bg-green-100 text-green-700' },
  released:    { label: 'Liberado',          cls: 'bg-gray-100 text-gray-600' },
  cancelled:   { label: 'Cancelado',         cls: 'bg-gray-100 text-gray-600' },
  auth_failed: { label: 'Autorización fallida', cls: 'bg-red-100 text-red-700' },
}

function fmt(n: number) {
  return (n % 1 === 0 ? String(n) : n.toFixed(2).replace('.', ',')) + ' €'
}

function fmtDate(iso: string) {
  return new Intl.DateTimeFormat('es-ES', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
    timeZone: 'Europe/Madrid',
  }).format(new Date(iso))
}

export default async function AdminGroupDetailPage({ params }: { params: { id: string } }) {
  const { id } = params

  const [{ data: group }, { data: members }, { data: bids }] = await Promise.all([
    supabaseAdmin
      .from('groups')
      .select('id, product_name, product_spec, product_url, image_url, pvp, status, closes_at, current_price, total_units')
      .eq('id', id)
      .single(),
    supabaseAdmin
      .from('group_members')
      .select('id, join_order, quantity, guaranteed_price, final_price, payment_status, users(name, email, phone)')
      .eq('group_id', id)
      .order('join_order'),
    supabaseAdmin
      .from('bids')
      .select('id, price_mode, tiers, status, min_execution, max_stock, users(name)')
      .eq('group_id', id)
      .order('created_at', { ascending: false }),
  ])

  if (!group) notFound()

  const memberCount = members?.length ?? 0
  const totalUnits = group.total_units ?? 0
  const hasActiveBid = (bids ?? []).some((b) => b.status === 'active')
  const badge = resolveGroupBadge(group.status, hasActiveBid ? 1 : 0)

  return (
    <div className="space-y-8">

      {/* ── BACK + HEADER ── */}
      <div>
        <Link href="/admin" className="text-sm text-gray-400 hover:text-gray-700 transition-colors">
          ← Todos los grupos
        </Link>
        <div className="flex items-start justify-between mt-3 gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{group.product_name}</h1>
            {group.product_spec && (
              <p className="text-sm text-gray-500 mt-0.5">{group.product_spec}</p>
            )}
          </div>
          <span className={`inline-flex px-3 py-1 rounded-full text-sm font-semibold flex-shrink-0 ${badge.cls}`}>
            {badge.label}
          </span>
        </div>

        {/* Stat chips */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-5">
          {[
            { label: 'Precio actual', value: fmt(Number(group.current_price ?? 0)) },
            { label: 'Unidades totales', value: totalUnits },
            { label: 'Miembros', value: memberCount },
            { label: 'Cierre', value: group.closes_at ? fmtDate(group.closes_at) : '—' },
          ].map(({ label, value }) => (
            <div key={label} className="bg-white rounded-xl border border-gray-200 px-4 py-3">
              <p className="text-xs text-gray-500 mb-1">{label}</p>
              <p className="text-sm font-semibold text-gray-900">{value}</p>
            </div>
          ))}
        </div>
      </div>

      {/* ── EDITAR GRUPO ── */}
      <EditGroupForm
        groupId={id}
        initial={{
          product_name: group.product_name ?? '',
          product_spec: (group as any).product_spec ?? '',
          product_url: (group as any).product_url ?? '',
          image_url: (group as any).image_url ?? '',
          pvp: (group as any).pvp != null ? String((group as any).pvp) : '',
          closes_date: group.closes_at ? group.closes_at.slice(0, 10) : '',
        }}
      />

      {/* ── MIEMBROS ── */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-base font-bold text-gray-900">Miembros ({memberCount})</h2>
          <a
            href={`/admin/grupos/${id}/csv`}
            className="text-xs font-semibold text-brand hover:underline"
          >
            ↓ Exportar CSV
          </a>
        </div>

        {!memberCount ? (
          <p className="text-sm text-gray-400">Ningún miembro todavía.</p>
        ) : (
          <div className="bg-white rounded-2xl border border-gray-200 overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-gray-200">
                <tr className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                  <th className="px-4 py-3 text-left">#</th>
                  <th className="px-4 py-3 text-left">Nombre</th>
                  <th className="px-4 py-3 text-left">Teléfono</th>
                  <th className="px-4 py-3 text-left">Email</th>
                  <th className="px-4 py-3 text-right">Cant.</th>
                  <th className="px-4 py-3 text-right">Precio</th>
                  <th className="px-4 py-3 text-right">Total</th>
                  <th className="px-4 py-3 text-left">Pago</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {(members ?? []).map((m) => {
                  const u = m.users as any
                  const payBadge = PAYMENT_BADGE[m.payment_status] ?? PAYMENT_BADGE.pending
                  // final_price (liquidación) si el grupo ya cerró; si no, guaranteed_price (precio de unión)
                  const unitPrice = Number(m.final_price ?? m.guaranteed_price)
                  return (
                    <tr key={m.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-3 text-gray-400">{m.join_order ?? '—'}</td>
                      <td className="px-4 py-3 font-medium text-gray-900">{u?.name ?? '—'}</td>
                      <td className="px-4 py-3 text-gray-600">{u?.phone ?? '—'}</td>
                      <td className="px-4 py-3 text-gray-600">{u?.email ?? '—'}</td>
                      <td className="px-4 py-3 text-right text-gray-700">{m.quantity}</td>
                      <td className="px-4 py-3 text-right text-gray-700">{fmt(unitPrice)}</td>
                      <td className="px-4 py-3 text-right font-semibold text-gray-900">
                        {fmt(unitPrice * m.quantity)}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-semibold ${payBadge.cls}`}>
                          {payBadge.label}
                        </span>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
              {memberCount > 0 && (
                <tfoot className="border-t border-gray-200 bg-gray-50">
                  <tr className="text-sm font-semibold text-gray-900">
                    <td colSpan={4} className="px-4 py-3">Total</td>
                    <td className="px-4 py-3 text-right">{totalUnits}</td>
                    <td />
                    <td className="px-4 py-3 text-right">
                      {fmt((members ?? []).reduce((s, m) => s + Number(m.final_price ?? m.guaranteed_price) * m.quantity, 0))}
                    </td>
                    <td />
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        )}
      </section>

      {/* ── PUJAS ── */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-base font-bold text-gray-900">Pujas ({bids?.length ?? 0})</h2>
          {hasActiveBid && (
            <button
              disabled
              className="text-xs font-semibold text-gray-300 cursor-not-allowed"
              title="Próximamente"
            >
              + Mejorar puja
            </button>
          )}
        </div>

        {!hasActiveBid && (
          <div className="mb-3">
            <AssignSellerForm
              groupId={id}
              initialClosesDate={group.closes_at ? group.closes_at.slice(0, 10) : ''}
            />
          </div>
        )}

        {!bids?.length ? (
          <p className="text-sm text-gray-400">Sin pujas.</p>
        ) : (
          <div className="space-y-3">
            {bids.map((bid, i) => {
              const seller = (bid.users as any)?.name ?? '—'
              const tierList = Array.isArray(bid.tiers) ? bid.tiers : []
              const isActive = bid.status === 'active'
              return (
                <div key={bid.id} className={`bg-white rounded-2xl border p-5 ${isActive ? 'border-brand/40' : 'border-gray-200 opacity-60'}`}>
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold text-gray-900">{seller}</span>
                      {i === 0 && isActive && (
                        <span className="text-xs bg-brand text-white px-2 py-0.5 rounded-full font-semibold">Mejor puja</span>
                      )}
                    </div>
                    <span className="text-xs text-gray-400 capitalize">{bid.price_mode} · min {bid.min_execution} uds · max {bid.max_stock} uds</span>
                  </div>
                  <div className="flex gap-3 flex-wrap">
                    {tierList.map((t: any, j: number) => (
                      <div key={j} className="bg-gray-50 rounded-lg px-3 py-2 text-center">
                        <p className="text-xs text-gray-500">≥{t.min_units} uds</p>
                        <p className="text-sm font-semibold text-gray-900">{Number(t.price).toFixed(2).replace('.', ',')} €</p>
                      </div>
                    ))}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </section>

      {/* ── CERRAR GRUPO ── */}
      <section className="border-t border-gray-200 pt-6">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-sm font-semibold text-gray-900">Cerrar grupo manualmente</p>
            <p className="text-xs text-gray-400 mt-0.5">
              {group.status === 'closed'
                ? 'El grupo ya está cerrado.'
                : group.status === 'cancelled'
                ? 'El grupo está cancelado.'
                : group.status === 'closing'
                ? 'Cierre en curso (excedente pendiente de resolución).'
                : 'Calcula el precio final de liquidación y instruye los pagos. Irreversible.'}
            </p>
          </div>
          <CloseGroupButton
            groupId={id}
            productName={group.product_name}
            disabled={group.status === 'closed' || group.status === 'cancelled' || group.status === 'closing'}
          />
        </div>
      </section>

      {/* ── GENERAR ETIQUETAS ── */}
      <section className="border-t border-gray-200 pt-6">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-sm font-semibold text-gray-900">Generar etiquetas de envío</p>
            <p className="text-xs text-gray-400 mt-0.5">
              Una etiqueta Sendcloud por miembro adjudicado (instruido/pagado). Normalmente tras el cierre.
            </p>
          </div>
          <GenerateLabelsButton groupId={id} />
        </div>
      </section>

    </div>
  )
}
