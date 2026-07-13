# HANDOFF — VONDA PULSE V1 (sesión 12 jul 2026, tarde)

**Lanzamiento previsto:** ~26 julio. **Spec:** `VONDA_PULSE_SPEC.md` (decisiones P1–P4).

## Qué es

Compromiso condicional para usuarios de Mi Radar: eligen un precio de la escalera
("Esperar en un precio"), y cuando comprometidos + aceptaciones alcanzan las unidades del
tramo, se dispara la retención automática para todos los que aceptaron (tarjeta guardada
antes con SetupIntent, 0 €). El convertido entra como **esperador con target = su tier**
por el pipeline verificado (PI off-session → webhook → confirm_join). Visual: onda naranja
(latente) / impulso morado (compromisos) / círculo sólido (alcanzado) en las barras de
Home, Mi Radar y Mis Grupos.

## Invariante verificado

**CERO cambios en compute_price / close_group / confirm_join / prepare_join / tier_demand.**
Un pledge sin hold es invisible para el dinero. Si la masa no se consolida (tarjeta falla),
el hold del resto se libera al cierre por la mecánica esperador existente.

## Hecho esta sesión

**BD (2 migraciones + 1 fix):** `pulse_pledges` (enum `pulse_status`, RLS owner-only-select,
escritura solo service_role, único parcial por grupo+usuario vivo) + RPCs `pulse_pledge_upsert`,
`pulse_pledge_cancel`, `pulse_state`, `pulse_check_and_lock` (advisory lock, disparo por
antigüedad D3, verificación de masa pre-marca). Permisos verificados: solo service_role,
sin overloads. Batería SQL T1–T7 en verde (regresión, semántica PMA, umbral exacto,
D3, idempotencia, guardas) — fixture sintético con ROLLBACK.

**Backend:** `src/lib/pulse.ts` (motor: PI off-session confirm, idempotencyKey por pledge,
reintento de ciclo si falla tarjeta, expiración), rutas `/api/pulse/pledge` (POST/DELETE),
`/api/pulse/accept` (SetupIntent off_session, rate-limited), `/api/pulse/accept/complete`
(verificación server-authoritative del SI contra Stripe), `/api/group/[id]/pulse` (agregado
público: buckets 0–3 + surge + reachable, sin cifras — P3), `/api/cron/pulse` (respaldo
cada 10 min, Bearer CRON_SECRET) + hook no-fatal en el webhook (compra normal también
re-evalúa masa; guard anti-recursión por `pulse_pledge_id`). `vercel.json`: cron añadido.

**UI:** keyframes en `globals.css` (motion-reduce safe) · `PulseRings` · `PulseAura`
(autoalimentada, Home `DesktopProductCard` + `MgCard` Mis Grupos) · `TierProgress` con
prop `pulse` (anillos por nodo + impulso morado viajando por el track) · `PulseZone`
(Mi Radar: selector de precio + cantidades, chips de estado, CTA morado "Aceptar") ·
`PulseAcceptModal` (portal, datos envío + PaymentElement sobre SetupIntent, copy "0 € hoy").
`tsc --noEmit` en verde.

## Pulse Visual — LENGUAJE DEFINITIVO (aprobado por Benjamin, iterado v2→v4 misma sesión)

**La barra se lee sin leyenda. Solo verde y morado; el naranja vive únicamente en la pill de urgencia.**

- **Verde sólido** (izq→der): demanda firme al precio actual. Verde total = meta alcanzada (tarjeta entera verde).
- **Morado sólido continuo** naciendo EXACTAMENTE en el nodo del tier, hacia atrás: TODOS los
  comprometidos con tarjeta — holds de esperadores clásicos + tarjetas guardadas del Pulse.
  Misma naturaleza, mismo material (nunca texturas intercaladas). Ancho mínimo visible (1 tarjeta ya se ve).
- **Morado difuminado** a continuación del sólido: intención marcada (clic en tier, sin tarjeta),
  proporcional al hueco; puede rebasar la demanda firme (~4% overflow) si sobran interesados.
- **Bruma morada tenue**: SOLO cuando no hay más que observadores; desaparece con la primera
  tarjeta o el primer tier marcado.
- Nodos: 18px, equiespaciados, precio encima (morado si activo, gris si no); sin actividad = gris
  neutro (feedback de acción real al tocar); ancla del usuario elevada con conector punteado.
- **Pills:** naranja SOLO si faltan <4 uds (urgencia) · morada en el resto (continuidad) · verde meta.
- **CTAs (una primaria por estado, estilo soft):** sin ancla → "Asegurar plaza · X €" · con ancla →
  "Asegurar precio · [nodo] €" (→ `/unirme?mode=esperar&target=X&qty=N`, prefill YA soportado) ·
  masa alcanzada → morado sólido "Ya sois suficientes → Aceptar X €" · meta → verde "Entrar al precio mínimo".
- Marcar tier = tocar el nodo (Mi Radar). Home y Mis Grupos: misma barra en solo lectura (`PulseBar`).

Cambios técnicos: `pulse_state` v2 (+`marked_units`; DROP+CREATE con ritual de permisos ✔),
endpoint (+`glow`, `marked`, `markedFraction`, `committed`, `acceptedFraction`), `TierProgress` v4,
`PulseZone` v3 (CTA única + errores visibles), `PulseBar` (Home/MisGrupos), `PulseAura.tsx` OBSOLETO
(borrar: `rm src/components/PulseAura.tsx`). Guard nuevo en `pulse_pledge_upsert`: miembros vivos
no pueden marcar Pulse en su grupo. Webhook marca pledge `failed` si su conversión acaba en
`needs_release`. IdempotencyKey de PIs por intento (`pledge_id + triggered_at`).

**Grupos de prueba en BD (borrar antes del cierre del domingo 19 — miembros/PIs ficticios):**
`ENSAYO_PULSE` (ac0809a8, 3 holds test vivos: cancelar PIs primero), `ENSAYO_PULSE_2` (2428b745),
`DEMO · Casco Aero` (2f85a1e0), `DEMO · Zapatillas Carbon` (8ccc328a), `DEMO · GPS Ciclocomputador`
(185a1590) + usuarios `demo_pulse_*@vonda.test` (public.users y auth.users) y sus favoritos/pledges.

## Pendiente

1. **Ensayo E2E con Stripe test** — runbook listo: `ENSAYO_PULSE_runbook.md` (necesita a
   Benjamin: localhost + stripe listen + 2 cuentas). BLOQUEANTE antes de lanzar el Pulse.
2. `npm run build` local (el sandbox no pudo terminarlo; `tsc --noEmit` pasó en verde).
   ⚠️ ANTES: `rm -rf .next` — un build cancelado del sandbox pudo dejar caché a medias.
   Secuencia: `Ctrl+C` al dev si está abierto → `rm -rf .next` → `npm run build` → `npm run dev`.
3. Git: add/commit por Benjamin (Claude no toca .git).
4. Copy/UX fina: revisar textos de PulseZone/modal contra `VONDA_PRODUCT_GUIDELINES.md`.
5. V2: notificación "tu tramo está al 80%", pulse en la ficha del grupo, reintento
   de tarjeta fallida sin re-pledge, Realtime en vez de polling 20 s.

## Detalles con intención (no tocar sin pensar)

- `min_execution` no filtra el pulse público (coherente con curva fusionada §3.1 multibid).
- Pledge de tier T cuenta para todo salto price ≤ T (semántica PMA).
- `pulse_check_and_lock` verifica disponibilidad ANTES de marcar holding (sin revert imposible).
- Conversión = esperador target T: paga ≤ T o se libera. Nunca 'comprar'.
- Webhook solo re-dispara el pulse si el PI NO nació del pulse (anti-recursión).
- Los favoritos pesan 1 unidad en `latent_units` (solo intensidad visual, jamás en disparo).
