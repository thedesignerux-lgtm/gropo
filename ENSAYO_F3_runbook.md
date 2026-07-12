# ENSAYO 3 — Cierre con esperadores (runbook)

**Objetivo:** probar, con dinero real de Stripe (modo test), que al cerrar un grupo se **cobra** a quien acepta el precio final y se **libera la retención** (sin cargo) a quien puso su tope por debajo. Es el último seguro antes de cobrar a clientes reales.

**Dónde:** en `https://www.vonda.es` (producción usa Stripe en modo test y ya tiene el webhook configurado, así que las uniones se confirman solas). No hace falta terminal.

**Tarjeta de prueba (para las 4 uniones):**
- Número: `4242 4242 4242 4242`
- Caducidad: cualquiera futura (ej. `12/34`) · CVC: cualquiera (ej. `123`) · CP: cualquiera (ej. `08001`)

---

## El grupo (ya creado)
- Producto: **ENSAYO_F3_esperadores** · precio 100 € → 80 € (3 uds) → 60 € (5 uds) · mínimo para ejecutar: 3 uds
- Enlace directo: `https://www.vonda.es/grupo/23015632-5651-43f6-99ef-813a416e2991`

---

## FASE A — Unir 4 compradores

Entra en el enlace del grupo y pulsa **Asegurar precio / Unirme**. Repite el proceso **4 veces**, una por comprador, usando estos datos (nombre/email/teléfono distintos cada vez y la tarjeta de prueba de arriba):

| # | Nombre | Email | Teléfono | Modo | Cantidad |
|---|---|---|---|---|---|
| A | Ensayo A | ensayo-f3-a@vonda-test.es | 611111111 | **Comprar ahora** | 1 |
| B | Ensayo B | ensayo-f3-b@vonda-test.es | 622222222 | **Comprar ahora** | 1 |
| C | Ensayo C | ensayo-f3-c@vonda-test.es | 633333333 | **Esperar a precio → 80 €** | 1 |
| D | Ensayo D | ensayo-f3-d@vonda-test.es | 644444444 | **Esperar a precio → 60 €** | 1 |

- En "Esperar a precio", elige el objetivo indicado (80 € para C, 60 € para D).
- Dirección de envío: cualquiera válida (ej. Calle Prueba 1, 08001 Barcelona).
- Al terminar cada unión debe quedar una **retención** en tu tarjeta de prueba (no un cobro).

👉 **Cuando tengas los 4 unidos, avísame.** Yo verifico el **Checkpoint 1**.

---

## CHECKPOINT 1 — (lo hace Claude)
Compruebo en la base de datos que hay **4 miembros con retención activa** (`authorized`) y los importes retenidos. Y tú confirmas en `dashboard.stripe.com` (modo test) → **Payments** que ves las 4 retenciones ("uncaptured").

---

## FASE B — Cerrar el grupo

En el panel de administración, abre el grupo y pulsa **Cerrar / Close manual**:
`https://www.vonda.es/admin/grupos/23015632-5651-43f6-99ef-813a416e2991`

Esto ejecuta la adjudicación: fija el precio final (80 €), **captura** los pagos de quien corresponde y **libera** el resto.

👉 **Cuando lo hayas cerrado, avísame.** Yo verifico el **Checkpoint 2**.

---

## CHECKPOINT 2 — (lo hace Claude + tú)
Resultado esperado:
- **A, B, C → cobrados a 80 €** (capturado). En la BD: `paid` / capturado.
- **D → retención liberada, 0 € cobrado** (su tope era 60 y el final fue 80). En la BD: `released`.
- Grupo en estado `closed`, precio final 80 €.

Yo lo verifico en la BD; tú lo confirmas en el dashboard de Stripe (A/B/C con importe capturado 80 €, D con la retención cancelada). Si algo no cuadra, **paramos** y lo revisamos — es el punto donde más importa que todo esté perfecto.

---

## LIMPIEZA (al final)
Cuando el ensayo esté verde, Claude elimina el grupo de prueba y sus miembros de la base de datos para dejarla limpia.

---

### Notas
- Si en alguna unión el precio proyectado que ves no es exactamente el esperado, no pasa nada: lo que importa es el **precio final al cerrar** (80 €) y que las capturas/liberaciones cuadren.
- Todo es Stripe en **modo test**: ningún cargo real a tu tarjeta.
