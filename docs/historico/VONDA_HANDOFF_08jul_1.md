# VONDA — HANDOFF 08 jul 2026 (sesión auth + favoritos + perfil)

**Sesión:** miércoles 8 jul (~19:00–21:30)
**Modelo:** Opus 4.6 (UI/CRUD, no toca lógica de dinero)
**Contexto:** el motor multi-puja (G0–G5) está completo y en producción. Lanzamiento movido al **30 de julio**. Esta sesión abre el frente de autenticación de usuario final + favoritos + perfil.

---

## 1. Objetivo actual

Construir la infraestructura de **autenticación por magic link** (email, sin contraseña) para usuarios finales de Vonda, y encima de ella las páginas de **favoritos** y **perfil**. Hasta ahora Vonda no tenía login de usuario — los compradores se identificaban solo por email/nombre en el flujo de Stripe, sin sesión persistente.

**Decisión de producto:** magic link por email (`signInWithOtp`), sin contraseña, sin OAuth social (se puede añadir después). El copy de confirmación usa "Cuenta vinculada" (no "creada") porque con magic link no se sabe si es alta o login, y porque el `public.users` ya existe por las compras previas.

---

## 2. Estado actual — qué está hecho y qué falta

### ✅ Hecho en BD (migraciones aplicadas en Supabase)

1. **Columna `auth_id`** añadida a `public.users` (`uuid UNIQUE REFERENCES auth.users(id)`) — vincula el usuario público (de compras) con el usuario auth (de login).

2. **Trigger `on_auth_user_created`** en `auth.users` → función `handle_new_auth_user()`:
   - Al primer login, busca en `public.users` por email y lo vincula (`SET auth_id = NEW.id`).
   - Si no existe usuario público con ese email, crea uno nuevo (role `'buyer'`).
   - `SECURITY DEFINER`, `search_path = 'public'`.

3. **Supabase Auth configurado en dashboard:**
   - Email provider: ✅ habilitado
   - Allow new users to sign up: ✅
   - Confirm email: ✅
   - Site URL: `https://www.vonda.es`
   - Redirect URLs: `https://www.vonda.es/auth/callback`, `http://localhost:3000/auth/callback`, `http://localhost:3001/auth/callback`

4. **Paquete `@supabase/ssr` instalado** en el proyecto (`npm install @supabase/ssr` ejecutado).

### ⏳ Pendiente — 6 archivos de auth por crear

Estos 6 archivos están diseñados y listos para escribir. **Ninguno existe aún en el repo.** El env var del anon key es `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` (no la estándar `ANON_KEY`).

| # | Archivo | Propósito |
|---|---|---|
| 1 | `src/lib/supabase-browser.ts` | Cliente auth para Client Components (cookies de sesión). Usa `createBrowserClient` de `@supabase/ssr`. |
| 2 | `src/lib/supabase-server.ts` | Cliente auth para Server Components / Route Handlers (lee cookies). Usa `createServerClient` de `@supabase/ssr`. |
| 3 | `src/middleware.ts` | Middleware de Next.js — refresca la sesión en cada request llamando `supabase.auth.getUser()`. Matcher excluye assets estáticos. |
| 4 | `src/app/auth/callback/route.ts` | Route Handler GET — procesa el magic link: `exchangeCodeForSession(code)`, redirige a `/` o a la URL con `?intent=` para cross-device. |
| 5 | `src/app/login/page.tsx` | Página de login: input de email → `signInWithOtp` → pantalla "Revisa tu correo". Client Component. Estilo visual coherente con Vonda. |
| 6 | `src/hooks/useUser.ts` | Hook `useUser()` → `{ user, loading }`. Escucha `onAuthStateChange`. Para Client Components que necesiten saber si hay sesión. |

**Nota importante sobre clientes Supabase existentes:**
- `src/lib/supabase.ts` — cliente anon público SIN auth (para lecturas públicas SSR). **No tocar.**
- `src/lib/supabase-admin.ts` — cliente `service_role` (para server actions, cron, etc.). **No tocar.**
- Los nuevos `supabase-browser.ts` y `supabase-server.ts` son **adicionales**, específicos para auth con cookies.

### ⏳ Pendiente — Después de auth: favoritos

| Paso | Detalle |
|---|---|
| Tabla `favorites` | `auth_id uuid NOT NULL, group_id uuid NOT NULL REFERENCES groups(id), created_at timestamptz DEFAULT now()`. PK compuesta `(auth_id, group_id)`. RLS: `auth.uid() = auth_id`. |
| API/actions | Toggle favorito (INSERT/DELETE) — Server Action o Route Handler con `supabase-server.ts`. |
| Botón corazón | Componente `FavoriteButton.tsx` en tarjetas del escaparate y ficha de grupo. Estados: default/loading/success/error. Si no hay sesión → redirige a `/login?next=/grupo/X&intent=base64(favorite,groupId)`. |
| Página `/favoritos` | Lista de grupos guardados con sus precios actuales. Server Component con `supabase-server.ts`. |
| Intent cross-device | Al volver del magic link, si la URL tiene `?intent=`, ejecutar la acción pendiente (guardar favorito). Toast de confirmación ("❤️ Guardado"). |

### ⏳ Pendiente — Después de favoritos: perfil

| Paso | Detalle |
|---|---|
| Página `/perfil` | Datos del usuario (nombre, email) + historial de grupos en los que participó. Botón de cerrar sesión (`supabase.auth.signOut()`). |
| `BottomNav` | Ya tiene tab "Perfil" (`/perfil`) con icono — falta mostrar estado de sesión. |

---

## 3. Decisiones clave ya tomadas

| Decisión | Detalle |
|---|---|
| Auth method | Magic link por email (`signInWithOtp`), sin contraseña |
| Copy de confirmación | "Cuenta vinculada" (no "creada") — funciona para alta y login |
| Cross-device intent | Pasar intención en URL del redirect (`?intent=base64`) |
| Confirmation UX | Toast enriquecido (no overlay bloqueante con temporizador) |
| No over-engineering | NO construir un "Pending Action Manager" genérico |
| Tabla favorites | Con `auth_id` directo (no a través de `public.users.id`) — RLS más simple |

---

## 4. Request exacto para Cowork

> Crea estos 6 archivos con el contenido exacto que te doy. NO modifiques ningún archivo existente. La env var del anon key es `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` (no `ANON_KEY`).
>
> **Archivo 1 — `src/lib/supabase-browser.ts`:**
> ```ts
> import { createBrowserClient } from '@supabase/ssr'
>
> export function createClient() {
>   return createBrowserClient(
>     process.env.NEXT_PUBLIC_SUPABASE_URL!,
>     process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
>   )
> }
> ```
>
> **Archivo 2 — `src/lib/supabase-server.ts`:**
> ```ts
> import { createServerClient } from '@supabase/ssr'
> import { cookies } from 'next/headers'
>
> export function createClient() {
>   const cookieStore = cookies()
>   return createServerClient(
>     process.env.NEXT_PUBLIC_SUPABASE_URL!,
>     process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
>     {
>       cookies: {
>         getAll() { return cookieStore.getAll() },
>         setAll(cookiesToSet) {
>           try {
>             cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options))
>           } catch {}
>         },
>       },
>     },
>   )
> }
> ```
>
> **Archivo 3 — `src/middleware.ts` (en la raíz de `src/`, NO dentro de `app/`):**
> ```ts
> import { createServerClient } from '@supabase/ssr'
> import { NextResponse, type NextRequest } from 'next/server'
>
> export async function middleware(request: NextRequest) {
>   let supabaseResponse = NextResponse.next({ request })
>   const supabase = createServerClient(
>     process.env.NEXT_PUBLIC_SUPABASE_URL!,
>     process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
>     {
>       cookies: {
>         getAll() { return request.cookies.getAll() },
>         setAll(cookiesToSet) {
>           cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
>           supabaseResponse = NextResponse.next({ request })
>           cookiesToSet.forEach(({ name, value, options }) => supabaseResponse.cookies.set(name, value, options))
>         },
>       },
>     },
>   )
>   await supabase.auth.getUser()
>   return supabaseResponse
> }
>
> export const config = {
>   matcher: ['/((?!_next/static|_next/image|favicon.ico|logo.png|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
> }
> ```
>
> **Archivo 4 — `src/app/auth/callback/route.ts` (crear carpeta `auth/callback/`):**
> ```ts
> import { createServerClient } from '@supabase/ssr'
> import { cookies } from 'next/headers'
> import { NextResponse } from 'next/server'
>
> export async function GET(request: Request) {
>   const { searchParams, origin } = new URL(request.url)
>   const code = searchParams.get('code')
>   const next = searchParams.get('next') ?? '/'
>   const intent = searchParams.get('intent')
>
>   if (code) {
>     const cookieStore = cookies()
>     const supabase = createServerClient(
>       process.env.NEXT_PUBLIC_SUPABASE_URL!,
>       process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
>       {
>         cookies: {
>           getAll() { return cookieStore.getAll() },
>           setAll(cookiesToSet) {
>             cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options))
>           },
>         },
>       },
>     )
>     const { error } = await supabase.auth.exchangeCodeForSession(code)
>     if (!error) {
>       const redirect = intent ? `${next}?intent=${intent}` : next
>       return NextResponse.redirect(`${origin}${redirect}`)
>     }
>   }
>   return NextResponse.redirect(`${origin}/login?error=auth`)
> }
> ```
>
> **Archivo 5 — `src/app/login/page.tsx` (crear carpeta `login/`):**
> ```tsx
> 'use client'
>
> import { useState } from 'react'
> import Link from 'next/link'
> import { createClient } from '@/lib/supabase-browser'
>
> export default function LoginPage() {
>   const [email, setEmail] = useState('')
>   const [sent, setSent] = useState(false)
>   const [loading, setLoading] = useState(false)
>   const [error, setError] = useState<string | null>(null)
>
>   async function handleSubmit(e: React.FormEvent) {
>     e.preventDefault()
>     if (!email.trim()) return
>     setLoading(true)
>     setError(null)
>
>     const supabase = createClient()
>     const { error: authError } = await supabase.auth.signInWithOtp({
>       email: email.trim(),
>       options: {
>         emailRedirectTo: `${window.location.origin}/auth/callback`,
>       },
>     })
>
>     setLoading(false)
>     if (authError) {
>       setError('No se pudo enviar el enlace. Inténtalo de nuevo.')
>     } else {
>       setSent(true)
>     }
>   }
>
>   if (sent) {
>     return (
>       <div className="min-h-screen bg-[#FAFAFA] flex items-center justify-center px-4">
>         <div className="w-full max-w-sm bg-white rounded-2xl border border-neutral-100 p-8 text-center">
>           <div className="w-14 h-14 rounded-full bg-green-50 flex items-center justify-center mx-auto mb-4">
>             <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-green-600">
>               <rect width="20" height="16" x="2" y="4" rx="2"/>
>               <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/>
>             </svg>
>           </div>
>           <h1 className="text-xl font-bold text-neutral-900 mb-2">Revisa tu correo</h1>
>           <p className="text-sm text-neutral-600 mb-1">Hemos enviado un enlace de acceso a</p>
>           <p className="text-sm font-semibold text-neutral-900 mb-6">{email}</p>
>           <p className="text-xs text-neutral-400">
>             Haz clic en el enlace del email para entrar. Si no lo ves, revisa la carpeta de spam.
>           </p>
>           <button
>             onClick={() => { setSent(false); setError(null) }}
>             className="mt-6 text-sm text-brand font-medium hover:underline"
>           >
>             Usar otro email
>           </button>
>         </div>
>       </div>
>     )
>   }
>
>   return (
>     <div className="min-h-screen bg-[#FAFAFA] flex items-center justify-center px-4">
>       <div className="w-full max-w-sm">
>         <div className="bg-white rounded-2xl border border-neutral-100 p-8">
>           <Link href="/" className="block text-center mb-6">
>             <img src="/logo.png" alt="Vonda" className="h-8 mx-auto" />
>           </Link>
>           <h1 className="text-xl font-bold text-neutral-900 text-center mb-2">Entra en Vonda</h1>
>           <p className="text-sm text-neutral-500 text-center mb-6">
>             Te enviaremos un enlace de acceso por email. Sin contraseñas.
>           </p>
>           <form onSubmit={handleSubmit} className="space-y-4">
>             <div>
>               <label htmlFor="email" className="block text-sm font-medium text-neutral-700 mb-1.5">Email</label>
>               <input
>                 id="email"
>                 type="email"
>                 required
>                 value={email}
>                 onChange={(e) => setEmail(e.target.value)}
>                 placeholder="tu@email.com"
>                 className="w-full px-4 py-3 rounded-xl border border-neutral-200 text-sm text-neutral-900 placeholder:text-neutral-400 focus:outline-none focus:ring-2 focus:ring-brand/20 focus:border-brand transition-colors"
>               />
>             </div>
>             {error && (
>               <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">{error}</p>
>             )}
>             <button
>               type="submit"
>               disabled={loading || !email.trim()}
>               className="w-full py-3 rounded-xl bg-brand text-white font-semibold text-sm hover:bg-brand-dark active:scale-[0.98] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
>             >
>               {loading ? 'Enviando...' : 'Enviar enlace de acceso'}
>             </button>
>           </form>
>         </div>
>         <p className="text-xs text-neutral-400 text-center mt-4">
>           Al continuar, aceptas nuestros términos y política de privacidad.
>         </p>
>       </div>
>     </div>
>   )
> }
> ```
>
> **Archivo 6 — `src/hooks/useUser.ts` (crear carpeta `hooks/` si no existe):**
> ```ts
> 'use client'
>
> import { useEffect, useState } from 'react'
> import { createClient } from '@/lib/supabase-browser'
> import type { User } from '@supabase/supabase-js'
>
> export function useUser() {
>   const [user, setUser] = useState<User | null>(null)
>   const [loading, setLoading] = useState(true)
>
>   useEffect(() => {
>     const supabase = createClient()
>     supabase.auth.getUser().then(({ data }) => {
>       setUser(data.user ?? null)
>       setLoading(false)
>     })
>     const { data: { subscription } } = supabase.auth.onAuthStateChange(
>       (_event, session) => { setUser(session?.user ?? null) },
>     )
>     return () => subscription.unsubscribe()
>   }, [])
>
>   return { user, loading }
> }
> ```
>
> **Después de crear los 6 archivos:**
> ```
> npx tsc --noEmit 2>&1 | head -30
> ```
>
> **Después de verificar tsc limpio:**
> ```
> git add src/lib/supabase-browser.ts src/lib/supabase-server.ts src/middleware.ts src/app/auth/callback/route.ts src/app/login/page.tsx src/hooks/useUser.ts && git commit -m "feat(auth): infraestructura magic link — middleware, clientes SSR/browser, callback, login page, useUser hook" && git push origin main
> ```
>
> **Smoke test (cuando Vercel diga Ready):**
> 1. Abrir `www.vonda.es/login` en incógnito
> 2. Introducir un email real
> 3. Debe aparecer "Revisa tu correo"
> 4. Recibir email con magic link → clic → redirige a `www.vonda.es/`
> 5. Verificar en Supabase Dashboard → Authentication → Users que aparece el email

---

## 5. Archivos del repo relevantes (mapa para orientarse)

| Archivo | Qué hace | ¿Se toca? |
|---|---|---|
| `src/lib/supabase.ts` | Cliente anon público (lecturas SSR sin auth) | ❌ NO tocar |
| `src/lib/supabase-admin.ts` | Cliente service_role (server actions, cron) | ❌ NO tocar |
| `src/lib/supabase-browser.ts` | **NUEVO** — cliente auth para browser | Crear |
| `src/lib/supabase-server.ts` | **NUEVO** — cliente auth para server | Crear |
| `src/middleware.ts` | **NUEVO** — refresca sesión auth | Crear |
| `src/app/auth/callback/route.ts` | **NUEVO** — procesa magic link | Crear |
| `src/app/login/page.tsx` | **NUEVO** — página de login | Crear |
| `src/hooks/useUser.ts` | **NUEVO** — hook de sesión client-side | Crear |
| `src/components/BottomNav.tsx` | Nav mobile con tab Perfil (link estático) | Futuro: añadir estado de sesión |
| `src/app/grupo/[id]/page.tsx` | Ficha de grupo | Futuro: botón favorito |
| `src/app/page.tsx` | Home/escaparate | Futuro: botones favorito en tarjetas |

---

## 6. Contexto broader del proyecto

- **Motor multi-puja G0–G5:** completo y en producción. Solo falta G6 (ensayo E2E con Stripe real, requiere Fable 5).
- **Regla de ventana 6,5 días:** protección contra holds de Stripe expirados, verificada de punta a punta.
- **Email de confirmación de compra:** implementado y desplegado.
- **Lanzamiento:** 30 de julio. Sin productos reales de escaparate definidos aún.
- **Grupo de test abierto:** `TEST G4 Smoke` (`9cf168fc`), cierra 12 jul por cron → caerá por Regla 6 (sin miembros).
