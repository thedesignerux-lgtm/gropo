import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!

// supabase-js no acepta { cache } por query, así que forzamos no-store en su
// fetch: las lecturas REST de este cliente anon (páginas públicas SSR) nunca se
// sirven desde la Data Cache de Next → total_units y el listado, siempre frescos.
export const supabase = createClient(supabaseUrl, supabaseKey, {
  global: {
    fetch: (input, init) => fetch(input, { ...init, cache: 'no-store' }),
  },
})
