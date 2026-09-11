# VONDA — Estado y plan de arranque (handoff para nueva sesión)

**Fecha de cierre de sesión:** 15 jun 2026 · **Próxima sesión:** desde 16 jun

---

## Qué es

MVP de compra colectiva para ciclismo en España. El precio baja en vivo según entran compradores. Cierre dominical 22:00 Europe/Madrid. Todos pagan el mismo precio final de liquidación.

**Primer producto real:** Continental GP5000 S TR 700x28c (Tubeless Ready, Black/Black)
- PVP: 79,95 € · Tramos: 10→74,90 · 25→69,90 · 50→64,90 · 100→59,90
- Mínimo: 10 uds · Stock: 120 uds · Modo: stepped · Cláusula 75%: sí

---

## Estado actual (15 jun)

- ✅ App en producción, grupo real renderizando bien en ficha + Inicio
- ✅ Motor de precios verificado sano (`compute_price`, `join_group`, `close_group`)
- ✅ BD limpia (borrados los 17 grupos de prueba)
- ✅ Deploys desbloqueados (causa raíz era el email de git inválido)
- ⏳ **Dominio `vonda.es`** comprado en **one.com** — en revisión de seguridad (hasta 24h). Cuando llegue el email de activación → configurar DNS: web → Vercel, emails → Resend
- 🔴 **Resend** sin verificar — bloquea los emails a compradores reales. Se desbloquea con el dominio (un mismo dominio sirve web + emails)
- 📅 **Lanzamiento aplazado al domingo 28 jun** (semana extra para meter Stripe)

---

## Cambios de modelo decididos en esta sesión

### 1. Pagos vía Stripe (decisión firme)

- El cobro vive en Vonda, **NO** en la tienda del vendedor → independencia total de PrestaShop / WooCommerce / Magento. No supeditamos el modelo a ninguna tienda.
- **Depósito del 20% al unirse** (autorización en tarjeta, no cargo) + **80% restante al cierre** del domingo, cuando el precio es definitivo.
- Si el grupo no llega al mínimo → se libera la autorización, **cero cargo**.
- Técnicamente: Stripe Payment Intents con **captura separada** (autorizar al unirse, capturar al cierre).

### 2. Logística (modelo objetivo, aún SIN construir)

Flujo objetivo:
Vonda cobra → pedido único pagado al distribuidor → el vendedor empaqueta por cantidad y marca la caja → courier (SEUR / Correos) recoge y entrega a cada comprador.

- Las etiquetas las genera Vonda. Para el primer grupo: **semi-manual** (portal del courier o agregador tipo Sendcloud / Packlink). La integración por API es V1.
- Negociación de tarifas de volumen con courier = **post-validación**, no ahora (sin volumen no hay palanca de negociación).
- **Vonda pasa a ser "merchant of record"** → responsabilidad fiscal del cobro + atención al cliente de incidencias de envío. Tenerlo en el radar.

---

## Pendiente que SOLO se resuelve con la llamada al distribuidor

**Pregunta clave:** ¿acepta preparar los paquetes desde la lista/etiquetas de Vonda (modelo limpio), o exige que el pedido entre por su tienda (otro diseño distinto)?

*Nota: Stripe va igual pase lo que pase. Esto solo afecta a la última milla (cómo le entra el pedido al distribuidor), no al cobro.*

---

## Para arrancar la sesión de Stripe — necesito de ti

1. **Crear la cuenta de Stripe** (si no está hecha):
   - stripe.com → Start now
   - Email: `benjaminperezsouto@gmail.com`
   - Negocio: **Vonda** · País: **España** · Tipo: **Individual** · Categoría: **Retail / E-commerce**
   - La verificación para pagos reales tarda 1-2 días → crearla cuanto antes
2. **Clave publicable** `pk_test_...` → es pública, se puede pegar en el chat
3. **Clave secreta** `sk_test_...` → **NO pegar en el chat.** Va directa a variable de entorno en Vercel
4. Empezamos en **modo test** (tarjetas de prueba, cero dinero real). Al verificar todo → claves `live`

---

## ⚡ Recordatorio de potencia del modelo

La sesión de Stripe toca el **núcleo financiero** (cobros, depósitos, captura diferida, reembolsos). Un error aquí = dinero mal calculado.
**Usa el modelo más potente disponible** para esta sesión: Claude Fable 5 si está disponible; si no, Opus 4.8.

---

## Cambios de datos que se prepararán

- `group_members` → añadir `stripe_payment_intent_id`, `deposit_amount`, `remaining_amount`, y campos de dirección de envío
- Nueva función de captura de pagos integrada dentro de `close_group`
- Webhook de Stripe para confirmar autorizaciones

---

## Otros pendientes (del handoff anterior, no bloquean Stripe)

- Estado "Cerrando…" cuando el reloj pasó pero `status` sigue `open`
- Mover el join a un route handler que revalide (hoy es `rpc` desde cliente)
- Versionar SQL pendiente: `create_petition.sql` + `ALTER TYPE event_type ADD VALUE 'petition_created'`
- Limpiar console.logs del Realtime
- Permitir dominios de imagen externos en `next.config`
- Probar el **cierre manual end-to-end** con un grupo clon antes del Día D (el cron en Hobby no es fiable → el botón manual es el método principal)

---

**Primer paso al abrir la nueva sesión:** confirmar si la cuenta de Stripe está creada.
- Si sí → claves test y arrancamos el build
- Si no → la montamos como paso 1
