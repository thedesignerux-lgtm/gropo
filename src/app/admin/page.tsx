import { supabaseAdmin } from '@/lib/supabase-admin'
import Link from 'next/link'
import { resolveGroupBadge } from '@/lib/statusBadge'

export const dynamic = 'force-dynamic'

function fmtDate(iso: string): string {
  return new Intl.DateTimeFormat('es-ES', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
    timeZone: 'Europe/Madrid',
  }).format(new Date(iso))
}

function fmtPrice(n: number): string {
  return (n % 1 === 0 ? String(n) : n.toFixed(2).replace('.', ',')) + ' €'
}

export default async function AdminDashboard() {
  const { data: groups } = await supabaseAdmin
    .from('groups')
    .select(`id, product_name, status, total_units, current_price, closes_at, group_members(count)`)
    .order('closes_at', { ascending: false })

  const { data: activeBids } = await supabaseAdmin
    .from('bids')
    .select('group_id')
    .eq('status', 'active')

  const bidsByGroup = (activeBids ?? []).reduce<Record<string, number>>((acc, b) => {
    acc[b.group_id] = (acc[b.group_id] ?? 0) + 1
    return acc
  }, {})

  return (
    <>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Grupos</h1>
        <Link
          href="/admin/grupos/new"
          className="bg-brand text-white text-sm font-semibold px-4 py-2 rounded-xl hover:bg-brand-dark transition-colors"
        >
          + Nuevo grupo
        </Link>
      </div>

      {!groups?.length ? (
        <p className="text-sm text-gray-500">No hay grupos todavía.</p>
      ) : (
        <div className="bg-white rounded-2xl border border-gray-200 overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b border-gray-200">
              <tr className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                <th className="px-4 py-3 text-left">Producto</th>
                <th className="px-4 py-3 text-left">Estado</th>
                <th className="px-4 py-3 text-right">Uds</th>
                <th className="px-4 py-3 text-right">Precio</th>
                <th className="px-4 py-3 text-right">Miembros</th>
                <th className="px-4 py-3 text-right">Pujas activas</th>
                <th className="px-4 py-3 text-left">Cierre</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {(groups ?? []).map((g) => {
                const badge = resolveGroupBadge(g.status, bidsByGroup[g.id] ?? 0)
                const members = (g.group_members as any)?.[0]?.count ?? 0
                return (
                  <tr key={g.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3 font-medium text-gray-900">{g.product_name}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-semibold ${badge.cls}`}>
                        {badge.label}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right text-gray-700">{g.total_units ?? 0}</td>
                    <td className="px-4 py-3 text-right font-semibold text-teal-700">
                      {fmtPrice(Number(g.current_price ?? 0))}
                    </td>
                    <td className="px-4 py-3 text-right text-gray-700">{members}</td>
                    <td className="px-4 py-3 text-right text-gray-700">{bidsByGroup[g.id] ?? 0}</td>
                    <td className="px-4 py-3 text-gray-600 whitespace-nowrap">
                      {g.closes_at ? fmtDate(g.closes_at) : '—'}
                    </td>
                    <td className="px-4 py-3">
                      <Link
                        href={`/admin/grupos/${g.id}`}
                        className="text-xs font-semibold text-brand hover:underline whitespace-nowrap"
                      >
                        Gestionar →
                      </Link>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </>
  )
}
