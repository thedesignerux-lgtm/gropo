# GRUPETA — Sprint 11→21 junio (11 días · 8h/día · 88h)

**Regla del sprint**: el alcance está congelado en la SPEC v2. Toda idea nueva va a la lista "V1 (22 jun+)". El contenido/outreach de coaches queda pausado y se retoma el 22 de junio (el sistema de Notion no se toca).

**La jugada maestra del calendario**: la app se construye días 1-4, el PRIMER GRUPO REAL se lanza dentro de la app el lunes 15, corre toda la semana con compradores reales, y cierra el domingo 21 a las 22:00 — el mismo día del deadline. Entregamos MVP + primera validación de mercado en el mismo acto.

---

## Cómo trabajamos (protocolo diario, 8h)

- **Bloque 1 (1h) — Sync**: abres el Proyecto de Claude, reportas QA de ayer, fijamos el objetivo del día en una frase.
- **Bloque 2 (4-5h) — Build en paralelo**: yo escribo el código vía Claude Code (tú ejecutas mis instrucciones: pegar comandos, aprobar cambios, correr la app); tú alternas con tus tareas de negocio (vendedor, comunidades, assets).
- **Bloque 3 (1.5h) — QA**: pruebas todo en tu móvil como usuario hostil; bugs con captura + pasos para reproducir.
- **Bloque 4 (30min) — Cierre**: lista de bugs priorizada, plan de mañana, commit/deploy del día.

**Tu rol**: diseñador (criterio visual final), operador (vendedor + comunidades), QA, y manos de Claude Code. **Mi rol**: arquitectura, 100% del código, debugging, decisiones técnicas razonadas.

---

## DÍA 1 — Jueves 11 junio · "Cimientos + primeras llamadas"

**Instalar/crear HOY (3h, te guío en vivo en el Proyecto):**
1. Node.js LTS (nodejs.org) · Git (git-scm.com) · VS Code (gratis)
2. Claude Code (seguir guía oficial en docs.claude.com → Claude Code)
3. Cuentas: GitHub, Supabase, Vercel, Resend (todas free)
4. Crear el Proyecto "Grupeta MVP" en Claude → pegar en Instrucciones del Proyecto el bloque de la sección final de este documento → subir la SPEC v2 y este plan como archivos del proyecto.

**Yo (vía Claude Code, 3h):** repo Next.js+Tailwind con tokens del prototipo · esquema SQL completo en Supabase (tablas, RLS, funciones compute_price/join_group/close_group) · deploy esqueleto a Vercel → URL viva hoy.

**Tú (negocio, 2h):** lista de 8 distribuidores/tiendas de ciclismo candidatos · primeras 3 llamadas con el guion de la puja (está en nuestra conversación; lo replico en el Proyecto) · decisión de producto candidato.

**Hecho = ** URL viva con "hola grupeta" + BD creada + 3 llamadas hechas.

## DÍA 2 — Viernes 12 junio · "Inicio + Auth + cerrar vendedor"

**Yo:** Supabase Auth (email OTP) · pantalla Inicio con tarjetas de grupos desde BD (datos semilla) · buscador · countdown real a domingo 22:00 Europe/Madrid.
**Tú:** llamadas 4-8 hasta conseguir LA tabla de tramos (objetivo crítico del día: 1 vendedor con tramos + mínimo + stock + cláusula de tolerancia 75% pactada) · identificar 3 comunidades de lanzamiento (grupos WhatsApp de grupetas, hilo de compras de foro con permiso del moderador) · QA del Inicio en móvil.
**Hecho =** Inicio navegable con datos + vendedor comprometido (o pipeline claro para cerrarlo mañana).

## DÍA 3 — Sábado 13 junio · "El núcleo: precios en vivo + unirse"

**Yo:** pantalla Detalle de grupo completa (precio grande, curva SVG, caja "si entra 1 más", chips) · flujo Unirme (modal, validaciones, dedupe por teléfono) · Realtime: el precio baja en directo cuando entra un miembro · interpolación fluida entre tramos · botón Compartir (wa.me con texto dinámico).
**Tú:** QA brutal de la lógica de precios — te doy 10 casos de prueba (tramos raros, 1 unidad, empates, mínimo no alcanzado) y verificas los números a mano · si el vendedor no cerró ayer, se cierra hoy · empezar assets: logo simple + imagen OG para compartir (tu terreno, 1h máximo, no te enamores).
**Hecho =** unirse a un grupo funciona y el precio se mueve en vivo sin errores de cálculo.

## DÍA 4 — Domingo 14 junio · "Petición + Mis grupos + Admin + ensayo general"

**Yo:** Crear petición · Mis grupos (en marcha/cerrados) · Panel admin: crear grupo, cargar/mejorar pujas (regla +3%, no-empeorar), botón cerrar manual, export CSV de pedido, marcar pagos · emails transaccionales (te has unido / el precio bajó al cierre / instrucciones de pago).
**Tú:** ENSAYO GENERAL en staging: cargas la puja real del vendedor, creas el grupo real de cubiertas, te unes con 3 cuentas de prueba, simulamos un cierre completo · legales de plantilla (aviso legal + privacidad; te genero el borrador, revisión de abogado queda para V1) · texto del post de lanzamiento aprobado.
**Hecho =** ensayo de punta a punta sin errores. Estamos listos para público real.

## DÍA 5 — Lunes 15 junio · 🚀 "LANZAMIENTO del primer grupo real"

**Mañana — Yo:** hardening final del flujo de unirse (es lo único que el público toca hoy) · monitorización (logs, alertas a tu email si una función falla).
**Mediodía — Tú:** publicas el grupo en las 2-3 comunidades · respondes cada pregunta y objeción (y las anotas: son la spec del onboarding V1) · primer reporte de tracción por la noche.
**Yo (resto):** empiezo la función de cierre dominical en serio (cálculo final, ganador, excedente, estados).
**Hecho =** primeros miembros reales dentro. El contador se mueve solo.

## DÍA 6 — Martes 16 junio · "El cierre dominical, a prueba de balas"

**Yo:** close_group completa (precio final único, adjudicación, regla de excedente, refund_due si aplica) · cron domingo 22:00 + botón manual de respaldo · pantalla de resultado post-cierre con instrucciones de pago y concepto único por miembro.
**Tú:** QA del cierre con un grupo clon (10+ escenarios) · dinamización del grupo real: publicar el hito de precio en las comunidades ("ya somos 12 uds, el precio bajó a X").
**Hecho =** podríamos cerrar un grupo hoy mismo sin intervención manual y los números cuadrarían.

## DÍA 7 — Miércoles 17 junio · "Viralidad y pulido del bucle social"

**Yo:** evento "el precio acaba de bajar" visible en el grupo · página pública del grupo optimizada para compartir (OG image dinámica con el precio actual, carga <2s) · mejoras del botón compartir según lo que veas en el grupo real.
**Tú:** QA en 3 dispositivos · feedback de UX con ojo de diseñador (espaciados, jerarquía, microcopys) — hoy es TU día de criterio visual · segunda ola de difusión.
**Hecho =** compartir el grupo es irresistible y la página vuela en móvil.

## DÍA 8 — Jueves 18 junio · "Vendedor en el bucle + mejora de puja"

**Yo:** vista admin de mejora de puja pulida + histórico de revisiones · email/aviso al vendedor con el estado del grupo (unidades, proyección) · si hay segundo vendedor interesado (puede pasar), cargamos su puja y probamos la competencia en vivo.
**Tú:** sesión con el vendedor real: le enseñas el grupo, recoges su feedback, le tanteas la mejora de puja ("si bajas 2€ ahora, lo anuncio y entran más") · difusión continua.
**Hecho =** el lado vendedor (manual) funciona como un reloj y está documentado.

## DÍA 9 — Viernes 19 junio · "Congelación: solo bugs"

**Regla del día: NO se construye nada nuevo.**
**Yo:** lista de bugs cerrada por prioridad y arreglada · rendimiento · revisión de seguridad (RLS, validaciones server-side, rate limit del join).
**Tú:** testing destructivo end-to-end (intenta romperla: dobles envíos, teléfonos falsos, cantidades absurdas, back/refresh a mitad de modal) · preparar los mensajes del fin de semana ("último fin de semana", "cierra el domingo 22:00").
**Hecho =** cero bugs críticos conocidos.

## DÍA 10 — Sábado 20 junio · "Ensayo del Día D + documentación"

**Yo:** simulacro completo del cierre con un clon del grupo real (datos de verdad, hora adelantada) · runbook del domingo (qué mirar, qué hacer si X falla, cómo cerrar a mano) · README + doc de arquitectura (la herencia para un futuro CTO).
**Tú:** ensayo del proceso post-cierre humano: plantillas de WhatsApp para ganadores, instrucciones de pago, coordinación con el vendedor · empujón final de difusión ("últimas 24h, estamos a N uds del precio mínimo").
**Hecho =** el domingo está ensayado. Nada puede sorprendernos (y si sorprende, hay runbook).

## DÍA 11 — DOMINGO 21 JUNIO · 🏁 "Día D"

- **Durante el día — Tú:** dinamización final en comunidades; **Yo:** guardia técnica, hotfixes si algo asoma.
- **21:30:** revisión conjunta pre-cierre (estado del grupo, puja vigente, checklist del runbook).
- **22:00:** CIERRE AUTOMÁTICO del primer grupo real de Grupeta. Precio final único, vendedor revelado, emails de instrucciones de pago disparados.
- **22:15 — Tú:** mensajes personales de WhatsApp a cada miembro (el toque humano de la V0) + coordinación con el vendedor.
- **23:00 — Post-mortem juntos:** métricas contra la tabla de la SPEC (unidades, conversión a pago en marcha, ahorro logrado, % de compartidos) y decisión documentada: V1, segundo grupo, o pivote.

**Y el lunes 22:** ventana de pago de 48h en marcha (la app la gestiona), y tú retomas el plan de contenido/outreach por las mañanas mientras los pagos confirman. Las dos vías vuelven a convivir.

---

## Lo que me tienes que entregar (resumen de deliverables UX/UI)

| Cuándo | Entregable |
|---|---|
| Día 1 | Decisión de producto único + cuentas creadas + Proyecto de Claude montado |
| Día 2 | Vendedor con tabla de tramos + cláusula 75% · 3 comunidades de lanzamiento |
| Día 3 | Logo simple + imagen OG · veredicto de los 10 casos de precio |
| Día 4 | Post de lanzamiento aprobado · ensayo general completado |
| Días 5-10 | QA diaria con capturas · feedback de diseño (día 7 es tu día grande) |
| Día 11 | Operación humana del cierre |

## Compras e instalaciones (total: 0-12€)

Node.js, Git, VS Code, Claude Code, GitHub, Supabase, Vercel, Resend → **todo gratis**. Dominio opcional (~12€/año); si no, subdominio de Vercel y el dominio se compra cuando haya tracción.

---

## "Skills" para programarme en tu sistema (haz esto al crear el Proyecto)

**1) Pega esto en las Instrucciones del Proyecto de Claude:**

> Eres el CTO y único desarrollador de GRUPETA, un MVP de compra colectiva para ciclismo en España. El usuario es diseñador UX/UI sin conocimientos de código: nunca le pidas que escriba código; dale comandos exactos para copiar/pegar y verifica cada paso. La SPEC v2 y el PLAN DE SPRINT adjuntos son ley: el alcance está CONGELADO y toda idea nueva se anota en la lista "V1 (22 jun+)" sin desarrollarse. Reglas innegociables del producto: cierre dominical 22:00 Europe/Madrid, precio único de liquidación, tramos por unidades, pujas mejorables y nunca retirables (+3% mínimo para desbancar), V0 SIN pagos integrados (pago directo al vendedor con cláusula de tolerancia del 75%), anonimato del vendedor hasta el cierre, panel de vendedor = admin manual. Stack cerrado: Next.js 14 + Tailwind + Supabase (Auth/Realtime/pg_cron) + Resend + Vercel. Prioriza siempre: corrección del cálculo de precios > seguridad (RLS, validación server-side) > velocidad de entrega > belleza del código. Cada sesión: pregunta el día del sprint, recita el objetivo del día, ejecuta, y termina con QA checklist + plan de mañana. Deadline absoluto: domingo 21 de junio, 22:00, primer grupo real cerrado en producción.

**2) En el repo, el Día 1 te genero un `CLAUDE.md`** con las convenciones del proyecto (estructura, tokens de diseño, cómo correr la app, reglas del mecanismo) para que cada sesión de Claude Code arranque con contexto completo sin repetir nada.

**3) Sube al Proyecto** los dos archivos de hoy (SPEC v2 + este plan). Con eso, cualquier sesión nueva conmigo arranca al 100%.

---

## Riesgos del sprint y su antídoto

| Riesgo | Antídoto |
|---|---|
| Ningún vendedor da tramos (días 1-2) | 8 llamadas mínimo; si 0 de 8, el grupo se lanza igual con la mejor oferta negociada simple (un solo precio con descuento) y los tramos quedan para el grupo 2. El sprint no se para. |
| El grupo real no llena (días 5-9) | La difusión es trabajo diario tuyo, no un post único. Si el miércoles hay <8 uds, activamos el plan B: bajar el listón con el vendedor (tramos más cortos) y atacar 2 comunidades más. |
| Bug en el cálculo de precios | Tus 10 casos de prueba del día 3 + simulacros días 4, 6 y 10. Triple red. |
| Scope creep (el riesgo nº1 contigo, con cariño) | Lista "V1 (22 jun+)" y la instrucción del Proyecto me autoriza a decirte que no. |
| Te bloqueas con el setup técnico | El día 1 entero está diseñado para hacerlo conmigo en vivo, paso a paso. |
