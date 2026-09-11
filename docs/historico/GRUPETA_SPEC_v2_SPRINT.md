# GRUPETA — Especificación MVP v2 (Sprint 11-21 junio 2026)

**Estado**: CONGELADA. Ningún cambio de alcance hasta el 22 de junio.
**Misión del sprint**: MVP web vivo en producción + primer grupo de compra REAL cerrado el domingo 21 de junio a las 22:00.
**Nicho**: Ciclismo España. **Primer producto**: una sola referencia (cubierta de carretera de referencia, modelo y medida únicos, a confirmar con el vendedor).

---

## 1. Qué es Grupeta (en 5 líneas)

Marketplace vertical de compra colectiva. Un comprador busca un producto: si existe grupo, se une; si no, crea la petición. Los vendedores verificados pujan con tablas de precios por volumen (tramos). El precio visible baja en directo a medida que entran compradores (y cuando un vendedor mejora su puja). Todos los grupos cierran el domingo a las 22:00. Todos pagan el mismo precio final, da igual cuándo entraron.

**Lema**: "Cuantos más, menos pagas."

---

## 2. Reglas del mecanismo (el contrato del producto)

1. **Cierre dominical fijo** a las 22:00. Sin prórrogas en V0. (V1: una única extensión de 7 días si el grupo queda a <10% del siguiente tramo).
2. **Precio único de liquidación**: todos los miembros pagan el precio correspondiente al N final del cierre.
3. **Tramos por UNIDADES, no por compradores** (un ciclista que pide 2 pares empuja el precio de todos).
4. **Pujas mejorables, jamás retirables ni empeorables** una vez hay miembros en el grupo.
5. **Incremento mínimo para desbancar**: una puja nueva debe mejorar el precio al N actual en ≥3%.
6. **Desempate y prioridad**: a igual precio, gana la puja más antigua. Si el N final supera el stock del ganador: (a) se ofrece el excedente al 2º mejor al precio del ganador; (b) si no acepta, los miembros en excedente eligen aceptar el precio del 2º o cancelar sin coste; (c) la prioridad de adjudicación es por orden de entrada al grupo.
7. **Precio garantizado**: el tramo 1 de toda puja debe ser ≤ al mejor precio público verificable del vendedor.
8. **Anonimato del vendedor durante la semana**: el comprador ve curvas de precio, no nombres. El vendedor adjudicado se revela en el cierre.
9. **Modo de precio**: "fluido" por defecto (interpolación lineal entre tramos: cada unidad nueva baja algo el precio); "escalonado" opcional para el vendedor.
10. **Mínimo de ejecución y stock máximo**: campos obligatorios de toda puja.

## 3. Pagos en V0 (decisión cerrada)

**Sin pasarela integrada.** Flujo: unirse es gratis (nombre + teléfono + email + cantidad) → domingo 22:00 cierre y anuncio del precio provisional → ventana de pago de 48h por transferencia/Bizum DIRECTA a la cuenta del vendedor (la app genera instrucciones y concepto) → miércoles: confirmación de pagos con el vendedor y envíos.

- **Cláusula de tolerancia (pactada con el vendedor antes de lanzar)**: honra el precio del tramo de cierre si paga ≥75% de las unidades comprometidas; por debajo, se aplica el tramo de lo realmente pagado. Al comprador se le comunica: "tu precio final estará entre X (garantizado) y Y (si pagamos todos)".
- **Métrica clave que esto genera**: conversión comprometido→pagado. Es el dato que justificará (o no) Stripe en V1.
- La plataforma NO toca dinero, NO cobra comisión en V0, y el vendedor es quien factura al comprador.

---

## 4. Modelo de datos (Supabase / PostgreSQL)

### `users`
- id (uuid, pk) · email (unique) · phone · name · role (enum: buyer | seller | admin) · created_at

### `groups`
- id (uuid) · product_name · product_spec (medida/variante única) · product_url (opc) · image_url (opc)
- status (enum: open | closing | closed | cancelled)
- closes_at (timestamp — siempre un domingo 22:00 Europe/Madrid)
- current_price (numeric, cacheado) · next_price (numeric, cacheado: "si entra 1 ud más")
- final_price (numeric, null) · winner_bid_id (uuid, null)
- total_units (int, cacheado) · created_by (uuid) · created_at

### `group_members`
- id · group_id (fk) · user_id (fk) · quantity (int ≥1)
- guaranteed_price (numeric — tramo 1 vigente al unirse)
- final_price (numeric, null) · join_order (int — prioridad)
- payment_status (enum: pending | instructed | paid | cancelled | refund_due)
- created_at
- **Unique**: (group_id, phone del user) — dedupe.

### `bids`
- id · group_id (fk) · seller_id (fk)
- tiers (jsonb: [{min_units, price}] ordenado ascendente)
- price_mode (enum: fluid | stepped)
- min_execution (int) · max_stock (int)
- status (enum: active | outbid | winner | declined)
- created_at · improved_at (las mejoras versionan: nunca se borra histórico → `bid_revisions` jsonb append-only)

### `events` (log de auditoría y motor del contador en vivo)
- id · group_id · type (member_joined | bid_placed | bid_improved | price_dropped | group_closed) · payload (jsonb) · created_at

### Funciones críticas (SQL/Edge Functions)
1. `compute_price(group_id, units)` → recorre pujas activas, aplica interpolación si fluid, devuelve {best_price, best_bid_id, next_price}.
2. `join_group(...)` → transacción: inserta miembro, recalcula caches, inserta evento.
3. `close_group(group_id)` → precio final, ganador, excedente (regla 6), estados de pago, eventos. Disparada por cron (domingo 22:00) Y por botón de admin (respaldo manual).
4. RLS: los miembros ven el grupo y su propia fila; los vendedores ven solo sus pujas y los agregados del grupo (unidades totales, mejor precio — NO los datos de los miembros); admin ve todo.

---

## 5. Pantallas (5 + admin) — el prototipo hi-fi existente es la spec visual

1. **Inicio**: buscador, tarjetas de grupos activos (precio actual vs PVP tachado, barra de progreso al siguiente tramo, "a X uds de bajar a Y€", countdown "cierra dom 22:00"), CTA crear petición.
2. **Detalle de grupo (núcleo)**: precio grande en vivo, curva SVG precio/unidades con punto actual, caja "si entra 1 ud más: Y€ para todos", chips ("N vendedores compitiendo · verificados"), precio garantizado, botón Unirme (modal: nombre, email, teléfono, cantidad), botón Compartir (wa.me con texto pre-armado que incluye el precio-si-entra-uno-más).
3. **Crear petición**: producto exacto + variante, link de referencia, cantidad. "Gratis y sin compromiso."
4. **Mis grupos**: en marcha (precio autorizado vs actual, "ya ahorras X€"), cerrados (precio final, instrucciones de pago, estado), peticiones (pujas recibidas).
5. **Cierre/Resultado** (post-domingo): precio final, vendedor revelado, instrucciones de pago con concepto único, deadline 48h.
6. **Admin (solo tú)**: crear/editar grupos, cargar y mejorar pujas en nombre de vendedores (el lado vendedor es manual en V0: te pasan la tabla por WhatsApp y la metes tú), botón "cerrar grupo" manual, export CSV del pedido para el vendedor, marcar pagos confirmados.

**Decisión**: NO hay panel de vendedor self-service en V0. Tú eres el panel de vendedor. Ahorra ~2 días de build y el vendedor real lo prefiere.

---

## 6. Stack (cerrado)

| Capa | Elección | Nota |
|---|---|---|
| Framework | Next.js 14 (App Router) + React | Web app / PWA. NUNCA app nativa en V0: el bucle de crecimiento son enlaces de WhatsApp. |
| Estilos | Tailwind CSS | Tokens del prototipo hi-fi (teal #0F6E56 como marca). |
| BD/Auth/Realtime | Supabase | Realtime para el precio en vivo; Auth por email OTP (+ teléfono como campo). |
| Emails | Resend (free tier) | Confirmación de unión, cierre, instrucciones de pago. |
| Hosting | Vercel (free) | Deploy continuo desde GitHub. |
| Cron | Vercel Cron / Supabase pg_cron | Cierre domingos 22:00 Europe/Madrid + botón manual de respaldo. |
| Pagos | NINGUNO en V0 | Ver sección 3. |

Coste fijo del sprint: 0€ (free tiers) + dominio opcional ~12€.

---

## 7. Métricas del Día D (domingo 21, 22:00)

| Métrica | Continuar | Revisar | Abandonar |
|---|---|---|---|
| Unidades comprometidas | ≥15 | 8-14 | <8 con 200+ alcanzados |
| Conversión comprometido→pagado (48h) | ≥60% | 40-60% | <40% |
| Vendedores con puja real | ≥1 | — | 0 tras 8 llamadas |
| Ahorro vs PVP | 10-18% | 5-10% | <5% |
| Compartidos por miembros (eventos) | ≥30% de miembros comparten | — | — |

---

## 8. Fuera de alcance V0 (lista negra, no se discute hasta el 22 de junio)

Stripe/pagos integrados · panel vendedor self-service · subasta multi-vendedor automatizada end-to-end (las pujas las carga el admin) · extensión de 7 días · ratings · notificaciones push · chat · app nativa · multi-nicho · comisiones · SEO/blog · analítica avanzada (Vercel Analytics básico y listo).
