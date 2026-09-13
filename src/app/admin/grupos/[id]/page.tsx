import Link from 'next/link'
import { notFound } from 'next/navigation'
import { supabaseAdmin } from '@/lib/supabase-admin'
import CloseGroupButton from './CloseGroupButton'
import ReleaseMemberButton from './ReleaseMemberButton'
import GenerateLabelsButton from './GenerateLabelsButton'
import EditGroupForm from './EditGroupForm'
import AssignSellerForm from './AssignSellerForm'
import WithdrawBidButton from './WithdrawBidButton'
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

const BID_BADGE: Record<string, { label: string; cls: string }> = {
  active:    { label: 'Activa',    cls: 'bg-green-100 text-green-700' },
  winner:    { label: 'Ganadora',  cls: 'bg-brand/10 text-brand' },
  outbid:    { label: 'Superada',  cls: 'bg-gray-100 text-gray-500' },
  declined:  { label: 'Rechazada', cls: 'bg-gray-100 text-gray-500' },
  withdrawn: { label: 'Retirada',  cls: 'bg-orange-100 text-orange-700' },
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
      .select('id, join_order, quantity, guaranteed_price, final_price, payment_status, join_mode, target_price, authorized_amount, users(name, email, phone)')
      .eq('group_id', id)
      .order('join_order'),
    supabaseAdmin
      .from('bids')
      .select('id, price_mode, tiers, status, min_execution, max_stock, users(name)')
      .eq('group_id', id)
      .order('created_at', { ascending: true }),
  ])

  if (!group) notFound()

  const memberCount = members?.length ?? 0
  const totalUnits = group.total_units ?? 0
  const activeBids = (bids ?? []).filter((b) => b.status === 'active')
  const activeBidCount = activeBids.length
  const isGroupOpen = group.status === 'open'
  const badge = resolveGroupBadge(group.status, activeBidCount)

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
                  <th className="px-4 py-3 text-left">Modo</th>
                  <th className="px-4 py-3 text-right">Cant.</th>
                  <th className="px-4 py-3 text-right">Precio</th>
                  <th className="px-4 py-3 text-right">Hold</th>
                  <th className="px-4 py-3 text-left">Pago</th>
                  <th className="px-4 py-3 text-right"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {(members ?? []).map((m) => {
                  const u = m.users as any
                  const payBadge = PAYMENT_BADGE[m.payment_status] ?? PAYMENT_BADGE.pending
                  const isReleased = m.payment_status === 'released' || m.payment_status === 'cancelled'
                  const isEsperar = m.join_mode === 'esperar'
                  // Precio: final_price si cerrado, para esperadores target_price, sino guaranteed_price
                  const unitPrice = isReleased ? 0 : Number(m.final_price ?? (isEsperar ? m.target_price : null) ?? m.guaranteed_price)
                  // Hold: authorized_amount es total en €, dividir por qty para mostrar /ud
                  const holdTotal = m.authorized_amount ? Number(m.authorized_amount) : unitPrice * m.quantity
                  return (
                    <tr key={m.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-3 text-gray-400">{m.join_order ?? '—'}</td>
                      <td className="px-4 py-3 font-medium text-gray-900">{u?.name ?? '—'}</td>
                      <td className="px-4 py-3 text-gray-600">{u?.phone ?? '—'}</td>
                      <td className="px-4 py-3 text-gray-600">{u?.email ?? '—'}</td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-semibold ${
                          isEsperar ? 'bg-amber-100 text-amber-700' : 'bg-blue-100 text-blue-700'
                        }`}>
                          {isEsperar ? 'Esperar' : 'Comprar'}
                        </span>
                        {isEsperar && m.target_price && (
                          <span className="block text-[10px] text-gray-400 mt-0.5">
                            Obj. {fmt(Number(m.target_price))}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right text-gray-700">{m.quantity}</td>
                      <td className="px-4 py-3 text-right text-gray-700">
                        {isReleased ? '—' : fmt(unitPrice)}
                      </td>
                      <td className="px-4 py-3 text-right text-gray-700">
                        {isReleased ? '—' : fmt(holdTotal)}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-semibold ${payBadge.cls}`}>
                          {payBadge.label}
                        </span>
                      </td>
                      {/* Extintor del admin: solo con el grupo abierto y un hold vivo.
                          No existe equivalente para el comprador, y es deliberado. */}
                      <td className="px-4 py-3 text-right whitespace-nowrap">
                        {group.status === 'open' && m.payment_status === 'authorized' ? (
                          <ReleaseMemberButton
                            memberId={m.id}
                            groupId={id}
                            memberName={u?.name ?? 'este miembro'}
                            quantity={m.quantity}
                            holdLabel={fmt(holdTotal)}
                          />
                        ) : null}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
              {memberCount > 0 && (
                <tfoot className="border-t border-gray-200 bg-gray-50">
                  <tr className="text-sm font-semibold text-gray-900">
                    <td colSpan={5} className="px-4 py-3">Total</td>
                    <td className="px-4 py-3 text-right">{totalUnits}</td>
                    <td />
                    <td className="px-4 py-3 text-right">
                      {fmt(
                        (members ?? [])
                          .filter(m => m.payment_status !== 'released' && m.payment_status !== 'cancelled')
                          .reduce((s, m) => s + (m.authorized_amount ? Number(m.authorized_amount) : Number(m.final_price ?? m.guaranteed_price) * m.quantity), 0)
                      )}
                    </td>
                    <td />
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
          <h2 className="text-base font-bold text-gray-900">
            Pujas ({bids?.length ?? 0})
            {activeBidCount > 0 && (
              <span className="text-sm font-normal text-gray-400 ml-2">
                {activeBidCount} activa{activeBidCount > 1 ? 's' : ''}
              </span>
            )}
          </h2>
        </div>

        {/* G5: Formulario de añadir puja — siempre visible en grupos abiertos */}
        {isGroupOpen && (
          <div className="mb-3">
            <AssignSellerForm
              groupId={id}
              initialClosesDate={group.closes_at ? group.closes_at.slice(0, 10) : ''}
              isFirstBid={activeBidCount === 0}
            />
          </div>
        )}

        {!bids?.length ? (
          <p className="text-sm text-gray-400">Sin pujas.</p>
        ) : (
          <div className="space-y-3">
            {bids.map((bid) => {
              const seller = (bid.users as any)?.name ?? '—'
              const tierList = Array.isArray(bid.tiers) ? bid.tiers : []
              const isActive = bid.status === 'active'
              const bidBadge = BID_BADGE[bid.status] ?? { label: bid.status, cls: 'bg-gray-100 text-gray-500' }
              return (
                <div key={bid.id} className={`bg-white rounded-2xl border p-5 ${isActive ? 'border-brand/40' : 'border-gray-200 opacity-60'}`}>
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold text-gray-900">{seller}</span>
                      <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-semibold ${bidBadge.cls}`}>
                        {bidBadge.label}
                      </span>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-xs text-gray-400 capitalize">
                        {bid.price_mode} · min {bid.min_execution} uds · max {bid.max_stock} uds
                      </span>
                      {/* G5: Botón retirar — solo pujas activas en grupos abiertos con 2+ pujas activas */}
                      {isActive && isGroupOpen && activeBidCount > 1 && (
                        <WithdrawBidButton
                          bidId={bid.id}
                          groupId={id}
                          sellerName={seller}
                        />
                      )}
                    </div>
                  </div>
                  <div className="flex gap-3 flex-wrap">
                    {tierList.map((t: any, j: number) => (
                      <div key={j} className="bg-gray-50 rounded-lg px-3 py-2 text-center">
                        <p className="text-xs text-gray-500">≥{t.min_units} uds</p>
                        <p className="text-sm font-semibold text-gray-900">{Number(t.price).toFixed(2).replace('.', ',')} €</p>
                      </div>
                    ))}
                  </div>

                  {/* G5: Panel de retirada inline (WithdrawBidButton maneja su propio estado) */}
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
