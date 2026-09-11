# VONDA — HANDOFF 2 JUL 2026

Sesión money-critical completa (Fable 5). Tres frentes cerrados: guard de stock, liberación automática de excedente, y Ensayo de integración end-to-end con Stripe test-mode real. Cutover a live iniciado y bloqueado por alta de autónomo.

---

## 1. FIX: Guard de stock en `confirm_join` y `prepare_join` (APLICADO Y VALIDADO)

**Bug:** ambas funciones comparaban contra `groups.total_units` (demanda firme al precio vigente, fluctúa con el precio) en vez del techo físico real → overselling posible.

**Fix aplicado (migraciones `fix_stock_guard_confirm_join`, `fix_stock_guard_prepare_join`):**
- Fuente del guard sustituida por suma real de unidades vivas:
  SELECT COALESCE(SUM(quantity),0) FROM group_members
  WHERE group_id = p_group_id AND payment_status IN ('authorized','instructed','paid')
- **`confirm_join` además:** candado anti-carrera. La re-validación de grupo abierto ahora es
  `PERFORM 1 FROM groups WHERE id = p_group_id AND status = 'open' FOR UPDATE;`
  → serializa confirm_join concurrentes del mismo grupo (dos webhooks simultáneos ya no pueden pasar el guard a la vez).
- **`prepare_join` además:** mensaje con `GREATEST(v_max_stock - v_committed_units, 0)` (evita "quedan -4 unidades" en grupos oversold heredados). Variable nueva `v_committed_units` en DECLARE. Sin candado a propósito: es feedback pre-hold; el guard atómico es el de confirm_join.

**Verificado tras aplicar:** un solo overload por función, permisos intactos (solo `service_role`), test funcional contra grupo oversold real (rechazo `out_of_stock` sin insertar nada).

**Validación de integración extra (no planeada):** durante el Ensayo F2, el guard rechazó un `confirm_join` real con hold vivo de Stripe (`needs_release/out_of_stock`). Fix validado a nivel SQL **y** de integración.

**Consecuencia arquitectónica importante:** con el guard activo, el excedente ya **no puede nacer por el camino normal de uniones** mientras la puja que limita las uniones sea la misma que gana al cierre. Sigue siendo posible si la puja ganadora al cierre tiene menos `max_stock` que la vigente durante las uniones (bid-swap). Por eso el fix del punto 3 sigue siendo necesario como red de seguridad.

---

## 2. LIMPIEZA: grupo de overselling `8838d617` (HECHO)

- 3 holds test-mode cancelados por Benjamin en el dashboard de Stripe (procedimiento completo, como hábito para producción): `pi_3Tnkf0...`, `pi_3Tnkgw...`, `pi_3Tnksa...` → todos `canceled`.
- Grupo + miembros + pujas + eventos borrados de la BD. Verificado a cero.

---

## 3. FIX: Liberación automática de excedente en `close_group` (APLICADO Y VALIDADO)

**Diagnóstico previo (grupo Shimano `66529396` en `closing`):** `close_group` NO tenía bug. El camino surplus dejaba deliberadamente el grupo en `closing` y el hold del excedente en `authorized`, esperando la resolución de 2ª puja (admin-manual) que no está construida. `captureGroupPayments` salta los `authorized` por diseño.

**Fix aplicado (migración `surplus_auto_release_no_second_bid`):** la rama 9B (excedente) se parte en dos:
- **9B-i — SIN segunda puja:** los miembros que quedan `authorized` tras la adjudicación (= exactamente el excedente) se marcan `cancelled`; el grupo pasa a `closed` (no `closing`); evento y retorno con `result:'closed'`, `surplus_units`, `surplus_released:true`. A partir de ahí `captureGroupPayments` (capa app, ya existente y probada) libera esos holds en Stripe → `released`. **Cero cambios en TypeScript.**
- **9B-ii — CON segunda puja:** comportamiento manual actual INTACTO (`closing`, holds vivos, resolución admin pendiente = V1).

**Verificado:** firma sin cambios, un overload, permisos `service_role` only. Test SQL con cierre surplus fresco (3 compradores 3+2+4 uds vs stock 5): adjudicados → `instructed` con final_price, excedente → `cancelled`, grupo → `closed`. Test de integración con dinero real en el Ensayo F2 (abajo).

---

## 4. ENSAYO DE INTEGRACIÓN (COMPLETADO — los 3 caminos de un hold validados contra Stripe real)

### Fase 1 — Cierre limpio (grupo `e1111111-...`, "ENSAYO_F1_cierre_limpio")
Tramos 1→20 / 2→18 / 4→15 / 10→12, stock 20. **Incidente aprovechado:** Benjamin se unió 3 veces por la web real (malentendido de guion) → mejor aún: probó la cadena completa prepare_join → create-intent → Payment Element → webhook → confirm_join. Un 4º miembro (comprar x2) conectado por SQL con hold creado por curl. Dos holds huérfanos de curl (B, C) detectados y cancelados antes del cierre.

Cierre por botón admin. Liquidación 15 EUR. Verificado en BD **y** Stripe:
| Miembro | Modo/target | BD | Stripe |
|---|---|---|---|
| m1 | esperar/18, x2, hold 36 | paid, captured 30 | succeeded, received 3000 (captura PARCIAL, 6 liberados) |
| m2 | esperar/15, x2, hold 30 | paid, captured 30 | succeeded, received 3000 |
| m3 | esperar/12, x1, hold 12 | released | canceled, received 0 |
| A | comprar, x2, hold 36 | paid, captured 30 | succeeded, received 3000 (parcial) |

### Fase 2 — Excedente (grupo `555ac922-...`, "ENSAYO_F2_excedente")
Tramos 1→20 / 2→18, stock 3. D (comprar x2) por confirm_join con hold real. E (comprar x2): confirm_join lo RECHAZÓ (guard nuevo — validación bonus) → insertado por SQL directo como `authorized` para simular el estado legítimo de bid-swap.

Cierre por botón admin. Liquidación 18 EUR. Verificado en BD y Stripe:
| Miembro | BD | Stripe |
|---|---|---|
| D (order 1, cum 2≤3) | paid, captured 36, final 18 | succeeded, received 3600 de 4000 (parcial) |
| E (order 2, cum 4>3, EXCEDENTE) | **released** (vía 9B-i) | **canceled, received 0 — hold liberado AUTOMÁTICAMENTE** |

Grupo → `closed`. Evento: `adjudicated_units:2, surplus_units:2, surplus_released:true`.

**Conclusión: capturar / liberar por PMA / liberar por excedente — los tres destinos de un hold funcionan end-to-end. El motor de dinero está listo para live.**

---

## 5. CUTOVER TEST → LIVE (INICIADO, BLOQUEADO)

**Pre-flight completado:**
- Variables exactas a cambiar en Vercel (3): `STRIPE_SECRET_KEY`, `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`, `STRIPE_WEBHOOK_SECRET`.
- El webhook escucha UN solo evento: `payment_intent.amount_capturable_updated` (NO `payment_intent.succeeded`). El endpoint live debe marcar exactamente ese.

**BLOQUEADO:** Benjamin aún no está dado de alta (autónomo/Seguridad Social) → no puede activar la cuenta de Stripe en live (requiere datos fiscales, IBAN, identidad). Pasos restantes al desbloquear:
1. Activar cuenta live en Stripe (formulario de Benjamin).
2. Generar claves live (nunca por chat).
3. Crear webhook endpoint live → `https://www.vonda.es/api/stripe/webhook` (www, NO apex: Stripe no sigue 308), evento `payment_intent.amount_capturable_updated`, copiar su signing secret propio.
4. Actualizar las 3 variables en Vercel (Production) + redeploy.
5. Prueba de humo con dinero real pequeño + devolución.

---

## 6. BUGS DE DISPLAY NUEVOS (no dinero)

1. **Panel admin, grupo cerrado:** la fila de un miembro `released` muestra su precio/total ORIGINALES (E: "20/40") y la fila Total mezcla capturado + liberado (mostró 76 cuando lo cobrado real fue 36). Sugerencia: released → "—" o "0 (liberado)"; Total = solo capturado.
2. Heredados, siguen pendientes: ProgressToNextPrice apunta al tramo más lejano; total_units=0 con todos esperadores.

---

## 7. ESTADO DE LA BD AL CIERRE DE SESIÓN

- `ENSAYO_F1` (`e1111111-...`) y `ENSAYO_F2` (`555ac922-...`): `closed`, sin holds vivos. Borrables en limpieza futura.
- **Shimano `66529396` (`closing`): CONSERVADO con hold de excedente vivo `pi_3Tnu3AA114rXo3Ka1dg5YFe5` (550 test).** Ya no es imprescindible como fixture (el fix se validó con cierre fresco). Próxima sesión: cancelar ese hold en Stripe y decidir borrar/archivar el grupo. OJO: no borrar sin cancelar el PI primero.
- Grupos GP5000 (3, `open`) con ~15 holds test `authorized` de sesiones previas: limpiar antes de live (cancelar PIs primero; algunos habrán expirado solos a ~7 días).
- Dartmoor `closed`, sano (3 paid).
- Usuarios de test acumulados (`*@vonda-test.es` + uniones web de Benjamin): purga pendiente pre-live.

---

## 8. REVISIÓN RECOMENDADA CON FABLE 5 (próximas sesiones, por prioridad)

1. **Camino `needs_release` del webhook (MONEY-CRITICAL, NO VERIFICADO):** cuando `confirm_join` devuelve `needs_release` (out_of_stock, duplicate, group_closed), ¿el webhook cancela el PaymentIntent en Stripe de verdad? Hoy se ejercitó confirm_join por SQL, sin webhook de por medio. Si ese camino no libera el hold, un cliente rechazado se queda ~7 días con el dinero retenido. Leer `webhook/route.ts` y probarlo.
2. **Auditoría RLS completa** de todas las tablas antes de live (`groups`, `group_members`, `users`, `bids`, `events`): qué puede leer/escribir `anon`. Datos de envío y emails no deben ser legibles públicamente.
3. **Decisión sobre 9B-ii (excedente con 2ª puja):** o se construye la resolución admin (V1), o se declara "una sola puja por grupo" como regla de lanzamiento (9B-ii inalcanzable de momento). Recomendación: lo segundo para el 5 jul.
4. **`join_group`:** ¿sigue vivo o es legado pre-Stripe? Si es legado, deprecar/bloquear para que nadie inserte miembros sin hold.
5. **Pendientes heredados:** guard de `group_id` en el webhook; página "Unido" esperando confirmación del webhook; DST de `closes_at`; centralizar cliente Resend; rotación de clave Sendcloud pre-live.

---

## PROTOCOLO (recordatorios vigentes)

- Cierres reales SIEMPRE por botón admin (close_group solo no toca Stripe).
- Nunca borrar grupos con holds `authorized`/`instructed` sin confirmar el PI en Stripe antes.
- BD viva = fuente de verdad; exigir salida literal, no resúmenes.
- Un gate cada vez en money-critical; verificar permisos tras cualquier cambio de función.
- Claves: nunca por chat. Los curls cargan la clave desde `.env.local` en el mismo bloque (las variables no sobreviven entre pestañas de Terminal).
- Curl a Stripe para cancelar: requiere `-X POST` explícito (sin datos, curl manda GET y Stripe lo rechaza).
- UUIDs de test: SIEMPRE `gen_random_uuid()`, nunca UUIDs "bonitos" manuales (riesgo de colisión con restos de sesiones previas).
