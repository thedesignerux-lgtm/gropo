import { createClient } from '@supabase/supabase-js'

// Server-side only — never import this in Client Components
//
// El `fetch` con `cache: 'no-store'` NO es opcional (mismo patrón que en
// `supabase.ts`, el cliente anon). Next.js parchea el fetch global y cachea las
// lecturas REST de Supabase indefinidamente. Verificado en producción el
// 12-sep-2026 con grupos sonda: la ficha y el checkout servían los datos de su
// PRIMER render para siempre — precio, total_units y tramos congelados — pese a
// tener `export const dynamic = 'force-dynamic'`. En un producto cuyo precio baja
// en vivo, eso es anunciar un precio que ya no existe.
export const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  {
    auth: { autoRefreshToken: false, persistSession: false },
    global: {
      fetch: (input, init) => fetch(input, { ...init, cache: 'no-store' }),
    },
  },
)
