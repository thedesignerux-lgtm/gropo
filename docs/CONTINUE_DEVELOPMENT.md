# CONTINUE_DEVELOPMENT.md — Gropo

# GUÍA OPERATIVA — se aplica DESPUÉS de haber leído `AI_HANDOFF.md`.

Este es el manual de operación para cualquier IA (o persona) que vaya a tocar Gropo.
**No es el punto de entrada del proyecto: ese es `AI_HANDOFF.md`.**
Una vez leído aquel, léelo entero antes de escribir una sola línea.
Está redactado a partir de una auditoría
realizada el **6 de septiembre de 2026** contra el código (`main @ 7c49ef3`) y contra la base de
datos de producción `xpktkuozspreuxucnguh`.

---

## LOS 10 MANDAMIENTOS

### 1. Understand production reality first
La documentación de este proyecto describe un sistema que **ya no existe** en varios puntos.
Antes de razonar sobre cualquier función SQL, **extrae su definición real de producción**.
No hay atajo. Ver § "Comandos de verificación" más abajo.

### 2. Never assume migrations represent production
**No hay sistema de migraciones.** Los ficheros `supabase/*.sql` son copias manuales, y
**7 de ellas están desfasadas**. `supabase/prepare_join.sql` está **corrupto y no parsea**.
`supabase/revoke_join_group.sql` referencia una función (`join_group`) que **ya no existe**.
Reconstruir la base de datos desde el repositorio produciría un sistema funcionalmente distinto
y peor. Ver `DATABASE.md` §9 y `ALGORITHM.md` §12.

### 3. Never modify payment logic without understanding idempotency
El sistema es **hold-then-capture** con `capture_method: 'manual'`. La idempotencia descansa en
piezas concretas y frágiles:
- `group_members.stripe_payment_intent_id` **UNIQUE** (`uniq_group_members_pi`).
- La rama `EXCEPTION WHEN unique_violation` de `confirm_join` que discrimina por
  `CONSTRAINT_NAME` y devuelve `already_processed` — **jamás `needs_release`** para
  `uniq_group_members_pi`: cancelar el hold de una membresía que ya existe sería un desastre.
- `captureGroupPayments` opera **por estado en BD** y reconcilia contra Stripe.
- El **500** deliberado del webhook cuando falla `paymentIntents.cancel`, para forzar el
  reintento de Stripe.
Lee `PAYMENTS.md` completo antes de tocar nada de esto.

### 4. Never modify group membership without understanding concurrency
El mecanismo central de todo el sistema es una sola línea:
```sql
PERFORM 1 FROM groups WHERE id = p_group_id AND status = 'open' FOR UPDATE;
```
en `confirm_join`. **Serializa todas las altas del mismo grupo** y es lo único que hace correcto
el guard de stock. Es **el mismo lock** que toma `close_group`, de modo que una unión y un
cierre nunca se solapan. Si lo quitas, hay overselling. Ver `ALGORITHM.md` §5 y §4.

### 5. Never modify pricing without reading ALGORITHM.md
El motor tiene una asimetría deliberada que es la sutileza más peligrosa del proyecto:
```
compute_price / tier_demand:  join_mode='comprar' → PMA = ∞
close_group:                  join_mode='comprar' → PMA = guaranteed_price
```
No la "arregles" sin entender ADR-09. Y recuerda: **`groups.total_units` NO es un contador de
stock** — es demanda firme al precio vigente y **puede bajar**, incluso a 0 con 15 miembros
vivos.

### 6. Never trust historical SQL as current implementation
Un fichero `.sql` en el repositorio es **historia**, no implementación. Aunque su cabecera diga
*"Definición VIVA sincronizada desde producción"* — las de `compute_price.sql` y
`close_group.sql` lo dicen y **son falsas** desde el 22 de junio.

### 7. Preserve existing business invariants
Antes de proponer un cambio, di en voz alta qué invariantes podría romper.
La lista completa está en `PROJECT_KNOWLEDGE_PACK.md` § INVARIANTES. Las que ya están **rotas**
(y no debes empeorar) son: unicidad de membresía, unicidad de teléfono, y la ausencia de salida
del estado `closing`.

### 8. Inspect callers before modifying critical functions
`ALGORITHM.md` lista los llamantes de cada función crítica, y `PROJECT_KNOWLEDGE_PACK.md`
§ DEPENDENCY MAP el grafo completo. **Confírmalo siempre con búsquedas reales**: para una
función SQL, búscala en todo `src/` **y** dentro del cuerpo de las otras 20 funciones
(`pg_get_functiondef`).
Casos que sorprenden: `tier_demand` está en el camino del dinero por dos vías (valida el
`target_price` del hold y alimenta `pulse_state` → cargos off-session); el `INSERT INTO events`
de `confirm_join` es el latido de la UI en vivo vía Realtime.

### 9. Run tests / typecheck / lint where available
**No hay tests.** Lo que sí hay:
```bash
npm run build   # falla ante errores de TypeScript — es el typecheck de facto
npm run lint
```
Sustituye los tests por: consultas SQL de verificación con datos reales antes y después, y un
guion de QA manual paso a paso para que lo ejecute Benjamin.

### 10. Clearly distinguish current behaviour / requested change / recommendation
Al terminar, entrega siempre estas cuatro cosas por separado:
- **Comportamiento actual** (lo que hace hoy, con evidencia).
- **Cambio solicitado** (lo que me has pedido).
- **Qué modifiqué** (fichero por fichero, con el porqué).
- **Recomendación** (lo que yo haría, marcado como opinión, no como hecho).
Y añade: **qué riesgos veo**, **qué no he podido verificar**, y **qué decisiones de producto he
detectado pero NO he tomado por mi cuenta**.

---

## PROTOCOLO PARA CAMBIOS MONEY-CRITICAL ⚡

Son money-critical: `compute_price`, `tier_demand`, `prepare_join`, `confirm_join`,
`close_group`, `pulse_check_and_lock`, `pulse_state`, las políticas RLS, y todo lo que llame a
`stripe.paymentIntents.capture` / `.cancel` / `.create`.

```
a) Avisa con el marcador ⚡ y recomienda subir la potencia del modelo.
b) Presenta la PROPUESTA completa. No ejecutes nada todavía.
c) Espera confirmación explícita.
d) Ejecuta.
e) VERIFICA contra la BD viva y contra Stripe:
     · sobrecargas duplicadas  (pg_proc)
     · permisos                (has_function_privilege)
     · datos reales antes y después
f) Si tocaste una función SQL, re-extráela con pg_get_functiondef y ACTUALIZA el fichero
   correspondiente en supabase/.
```

Dos reglas de PL/pgSQL que ya han causado incidentes en este proyecto:
- **`CREATE OR REPLACE` con una firma distinta crea una SOBRECARGA, no reemplaza.**
- **`DROP + CREATE` resetea los permisos a `PUBLIC EXECUTE`.** Re-blíndalos siempre.

---

## CÓMO TRABAJA BENJAMIN

- **No escribe código.** Ejecuta comandos que le des y opera dashboards (Supabase, Stripe,
  Vercel, Sendcloud, GitHub).
- Necesita instrucciones **paso a paso extremadamente detalladas**: dónde hacer clic, qué
  pantalla verá, qué texto copiar, qué comando pegar, qué resultado debe aparecer.
- **Distingue siempre y de forma explícita** entre `ACCIÓN DEL USUARIO` y `ACCIÓN DE LA IA`.
- Escribe **en castellano**.
- Avísale **antes** de cualquier acción que pueda romper producción, perder datos o generar
  costes.
- **Nunca toques `.git/`.** Git lo ejecuta él desde su terminal.
- SQL largo: vía fichero (`pbpaste`), nunca por chat (se trunca).

---

## COMANDOS DE VERIFICACIÓN (seguros, solo lectura)

### Repositorio
```bash
git status                 # ¿working tree limpio?
git branch -vv             # rama actual y seguimiento del remoto
git log --oneline -20      # historial reciente
git log origin/main..HEAD --oneline   # commits sin subir
```

### Estado de la aplicación
```bash
npm run build              # typecheck de facto
npm run lint
```

### Base de datos — definición real de una función
```sql
SELECT pg_get_functiondef(p.oid)
FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public' AND p.proname = '<nombre>';
```

### Base de datos — sobrecargas y permisos
```sql
SELECT p.oid::regprocedure AS firma,
       has_function_privilege('anon',          p.oid, 'EXECUTE') AS anon,
       has_function_privilege('authenticated', p.oid, 'EXECUTE') AS auth,
       has_function_privilege('service_role',  p.oid, 'EXECUTE') AS svc
FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public' ORDER BY p.proname;
```

### Base de datos — RLS y políticas
```sql
SELECT c.relname, c.relrowsecurity, pol.polname, pol.polcmd::text,
       pg_get_expr(pol.polqual, pol.polrelid)      AS using_expr,
       pg_get_expr(pol.polwithcheck, pol.polrelid) AS check_expr
FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
LEFT JOIN pg_policy pol ON pol.polrelid = c.oid
WHERE n.nspname = 'public' AND c.relkind = 'r' ORDER BY 1;
```

### Base de datos — comprobar los problemas conocidos
```sql
-- P0-01 (RESUELTO 11-sep-2026): duplicados VIVOS. Debe devolver 0 filas.
-- Los duplicados históricos en 'cancelled' son esperados y el índice parcial los ignora.
SELECT group_id, user_id, count(*) FROM group_members
 WHERE payment_status IN ('authorized','instructed','paid')
 GROUP BY 1,2 HAVING count(*) > 1;
-- P1-07: teléfonos duplicados
SELECT phone, count(*) FROM users WHERE phone IS NOT NULL GROUP BY 1 HAVING count(*) > 1;
-- P1-03: ¿hay algún grupo con más de una puja activa?
SELECT group_id, count(*) FROM bids WHERE status='active' GROUP BY 1 HAVING count(*) > 1;
-- P1-04: ¿algún grupo atrapado en 'closing'?
SELECT id, product_name, closes_at FROM groups WHERE status = 'closing';
-- Miembros en limbo
SELECT gm.payment_status, count(*) FROM group_members gm
JOIN groups g ON g.id = gm.group_id
WHERE g.status IN ('closed','cancelled') AND gm.payment_status IN ('authorized','instructed')
GROUP BY 1;
```

### Entorno
```bash
sed -E 's/=.*/=***/' .env.local     # nombres de variables, SIN valores
grep -rho "process\.env\.[A-Z_0-9]*" src | sort -u   # variables que el código usa
```
⚠️ **Nunca imprimas valores de variables de entorno ni secretos.**

### Lo que NO se puede verificar desde aquí
Stripe (modo, webhooks dados de alta, eventos, claves) y las variables de entorno realmente
configuradas en Vercel. Requieren acceso a esos paneles. Ver `PAYMENTS.md` §12.

---

## MAPA DE DOCUMENTACIÓN

| Necesito saber… | Documento |
|---|---|
| Qué es el proyecto y por dónde empezar | ⭐ **`AI_HANDOFF.md`** — punto de entrada |
| Panorama, invariantes, jerarquía de fuentes, qué no asumir | `PROJECT_KNOWLEDGE_PACK.md` (anexo) |
| Cómo funciona el precio, la adjudicación y el cierre | **`ALGORITHM.md`** |
| Qué tablas, columnas, constraints, índices, RLS y funciones existen | `DATABASE.md` |
| Cómo funciona el dinero, los holds, el webhook, la idempotencia | `PAYMENTS.md` |
| Qué reglas de negocio están implementadas de verdad | `BUSINESS_RULES.md` |
| Qué endpoints hay y qué hacen | `API.md` |
| Qué pantallas y flujos existen, qué es real y qué es decoración | `UX_AND_FLOWS.md` |
| Cómo está montado el sistema y por qué (ADR) | `ARCHITECTURE.md` |
| Qué vulnerabilidades hay | `SECURITY.md` |
| Qué está roto y con qué prioridad | `KNOWN_ISSUES.md` |
| Qué hace el proyecto caro de cambiar | `TECHNICAL_DEBT.md` |
| Qué documentos legales hay, qué falta y qué bloquea el lanzamiento | `LEGAL.md` |

---

## ANTES DE EMPEZAR CUALQUIER TAREA — CHECKLIST

```
[ ] He leído AI_HANDOFF.md entero.
[ ] He leído PROJECT_KNOWLEDGE_PACK.md § SOURCE OF TRUTH y § DO NOT ASSUME
[ ] He ejecutado los comandos de § FIRST THINGS TO CHECK
[ ] Si toco SQL: he extraído la definición real con pg_get_functiondef
[ ] Si toco precios: he leído ALGORITHM.md entero
[ ] Si toco pagos: he leído PAYMENTS.md entero
[ ] Si toco membresía: entiendo el FOR UPDATE de confirm_join
[ ] He localizado TODOS los llamantes de lo que voy a modificar
[ ] Sé qué invariantes podría romper y cómo lo evito
[ ] Si es money-critical: he avisado con ⚡ y espero confirmación explícita
[ ] Tengo un plan de verificación contra la BD viva (no solo "compila")
```

---

## LO QUE NO DEBES HACER POR TU CUENTA

- **No implementes decisiones de producto que no te han pedido.** Si un cambio requiere decidir
  algo de negocio (por ejemplo: *"¿qué pasa si el precio final supera el `guaranteed_price` de
  un comprador?"* — que ya está decidido como opción (b), pero hay casos análogos sin decidir),
  **pregunta con ejemplos numéricos delante**.
- **No refactorices de paso.** No limpies código muerto, no renombres, no reorganices ficheros
  salvo que sea el encargo explícito.
- **No arregles los bugs de `KNOWN_ISSUES.md` sin que te lo pidan**, ni siquiera los P0.
  Están documentados precisamente para que la decisión de cuándo tocarlos sea consciente.
- **No cambies el esquema ni los permisos "de camino" a otra cosa.**
- **No toques `.git/`.**
- Estás autorizado a **decir que no** al scope creep.

---

# ESTADO AL 14 DE SEPTIEMBRE DE 2026

> **Actualizado tras la jornada de auditoría.** La lista de abajo se guardó el 13 de septiembre;
> gran parte se cerró el 14. Lo que sigue abierto está marcado. El detalle de cada hallazgo de UX
> vive en `UX_AUDIT_2.md`; los de dinero y datos, en `KNOWN_ISSUES.md`.

## Lo que se cerró el 14 de septiembre

**Dinero e infraestructura**

| | |
|---|---|
| **P0-09** | El cron de cierre corría solo los domingos pero `closes_at` puede ser cualquier día: un hold podía llegar a la captura por encima del límite de 7 días de Stripe. Cron **diario** a las 22:00 UTC, siempre por detrás del cierre de las 22:00 de Madrid en verano e invierno. Margen recalculado: ~158 h de 168 |
| **A-11** | El plazo de cierre no era una regla que el servidor hiciera cumplir. Guard en `prepare_join` + estado en las dos fichas |
| **A-25** | El email no se validaba **al entrar** (sí al leer, devolviendo lista vacía en silencio). Ahora se valida en `create-intent`, con la misma regex que `get_my_groups` |

**Pantallas que mentían** — A-01, A-02, A-12, A-13, A-18, A-19, A-20, A-21, A-29, A-30, A-11c.
El patrón común: el dato existía y era correcto; la pantalla afirmaba otra cosa.

**Decisiones de producto tomadas e implementadas**

| | |
|---|---|
| **Léxico cerrado** | «Asegurar hasta X €» en todo el producto; personas ≠ unidades. Fijado en `PRODUCT_PRINCIPLES.md` §7 |
| **Las dos superficies** | `/mis-grupos` = estado actual · `/notificaciones` = Purchase Activity Feed. Especificación en `UX_AND_FLOWS.md` §3-bis |

**27 de 37 hallazgos cerrados.** Recuento y detalle en `UX_AUDIT_2.md`.

## Tres lecciones de método, por si sirven en la próxima sesión

1. **«Ya está arreglado» no vale sin comprobar los dos árboles de UI.** Tres veces en el mismo día
   un arreglo existía solo en la mitad del producto (A-11 vivo en escritorio, A-30 vivo en móvil,
   props declaradas-sin-usar en los dos). Es DT-03 cobrando su precio.
2. **Una afirmación de ausencia exige buscar hasta agotar.** Dos hallazgos decían «no existe» y las
   dos veces existía: el email SÍ se validaba (al leer), el ahorro SÍ se calculaba (mal colocado).
   Las dos se descubrieron al ir a implementar, no al auditar.
3. **El contraste y los números se calculan, no se estiman.** El primer degradado propuesto para
   A-05 daba 1,96:1 y habría pasado por bueno; medirlo costó dos minutos.

**A-11b, la última deuda de dinero de la auditoría, resultó ser un FALSO POSITIVO.** `confirm_join`
**sí** comprueba `status = 'open'`, bajo `FOR UPDATE`, y devuelve `needs_release` para que el
webhook cancele el hold — el círculo estaba cerrado de punta a punta, y `PROJECT_KNOWLEDGE_PACK.md`
ya lo documentaba como INV-03. Retirado. **No queda ninguna deuda de dinero abierta de esta
auditoría.**

---

# ESTADO AL 15 DE SEPTIEMBRE DE 2026

## Paquete legal — construido, sin validar

Diez documentos legales en `src/content/legal/` como datos tipados, ruta `/legal/[slug]`, índice
en `/legal`, pie de página en las pantallas públicas y enlaces desde el checkout con la
obligación de pago explícita. `noindex` automático mientras queden huecos por rellenar: hoy **44
huecos, los diez documentos en `noindex`**.

Con esto **A-28 baja de 🔴 a 🟠**: su mitad de producto está cerrada. La mitad jurídica no, y
sigue bloqueando el lanzamiento.

Lo que hace falta ahora, en orden, está en **`docs/LEGAL.md`**. Resumen: constituir la sociedad,
auditar cómo está montado Stripe Connect de verdad, ajustar textos u operativa a lo que diga esa
auditoría, y llevarlo a un abogado español. **No publicar estos textos como definitivos antes de
eso.**

---

## Segunda tanda del 15 de septiembre

| | |
|---|---|
| **A-32** | El checkout no tenía vista de escritorio: 512 px centrados en 1.440 y la barra de acción fija al fondo del viewport. En `lg` pasa a dos columnas (formulario / producto) y la barra es pegajosa dentro de su columna. Solo clases y tres `<div>`: **ni una línea de lógica de dinero**, comprobado con `git diff` |
| **A-33** | Los avatares `['A','B','C']` estaban en **tres** componentes, no en uno: escritorio, ficha móvil y tarjetas de la home — y en las tarjetas se pintaban con el grupo vacío. Sustituidos por `GroupPeopleGlyph`, un símbolo anónimo que no se pinta si no hay nadie |
| **A-34** | Los seis componentes de escritorio huérfanos verificados uno a uno (cero importaciones). Documentados en `TECHNICAL_DEBT.md` DT-04 con el comando de borrado. No los he borrado: eso lo decide y lo ejecuta Benjamin |
| **RULE-018** | Decía que no existía ningún grupo `is_demo=true` en producción. Hay dos. Baja a `PARTIALLY IMPLEMENTED` |

**A-24: aplazado por decisión de Benjamin (15 sep).** Sus dos mitades escriben en producción (un
`UPDATE` sobre el grupo mal marcado y una migración de `get_my_groups`), y hoy las únicas cuentas
afectadas son las suyas. **Debe cerrarse antes del primer cliente real**: cuando un test corra con
un email de verdad, ya será tarde. Detalle y opciones en `UX_AUDIT_2.md` A-24.

**Cuarta vez** que un hallazgo estaba vivo en más sitios de los que decía el hallazgo (A-33 en
tres componentes). La lección 1 de este documento sigue cobrando.

### Corregido el mismo día: la pregunta duplicada de la ficha de escritorio

Benjamin mandó una captura: «¿Cuál es el precio máximo que pagarías?» y «¿Cuál es el máximo que
pagarías?», una debajo de otra. **Lo introduje yo** al cerrar A-03: escribí que el slider de
escritorio «no tenía ningún encabezado» sin abrir el componente, y `GropoTargetSlider` con
`chrome="full"` ya pintaba el suyo.

Arreglado **en origen**, no tapando una de las dos: `chrome` juntaba dos cosas independientes —el
encabezado y la píldora de estado— de modo que una pantalla con su propia pregunta tenía que elegir
entre repetirla o perder la píldora. Nuevo valor `chrome="status"`: píldora sí, título no. La ficha
de escritorio lo usa; los otros ocho usos del slider no cambian.

Es el **quinto** caso de afirmación de ausencia sin agotar la búsqueda, y **el primero que llegó a
producción**. Lección 2 de `UX_AUDIT_2.md`, ampliada con la regla que faltaba: antes de añadir copy
a una pantalla, leer lo que ya pinta el componente de debajo.

---

## A-36 · La incoherencia entre pantallas (15 sep, tercera tanda)

Benjamin mandó cuatro capturas del mismo producto: la ficha decía «faltan 8 uds» y «Mis grupos»
decía «22 / 20 uds · Faltan 0 uds · 100 % completado» del mismo tramo, a la misma hora.

**Causa:** `MisGruposDesktop.derive()` restaba el umbral del tramo menos el TOTAL comprometido
(22) en vez de menos la demanda efectiva DE ESE TRAMO (12). La ficha lo hacía bien. Dos
implementaciones de la misma cuenta; la de Mis grupos la introduje yo al cerrar A-19/A-20.

**Corregido en origen:** `src/lib/ladder.ts` es ahora la única definición y la usan las dos
pantallas. Verificado contra las filas reales del grupo y contra los casos límite; una de las
pruebas encontró un fallo adicional (una fila nula tumbaba la pantalla entera).

**LA REGLA, para no repetirlo:** `min_units` se compara contra la demanda efectiva **de ese mismo
tramo**, nunca contra el total de unidades comprometidas. Están en `ALGORITHM.md` §9 como
magnitudes distintas y lo son.

Detalle en `UX_AUDIT_2.md` A-36 y en `TECHNICAL_DEBT.md` DT-07.

---

# PENDIENTE (lista del 13 de septiembre, actualizada)

## 1 · Bloqueantes de lanzamiento

### L-01 · Cutover de Stripe a modo live — ⏸️ APLAZADO por decisión de Benjamin
Motivo: faltan pruebas en modo test y trabajo de UI. Todo el pre-vuelo está hecho y verificado
en `LAUNCH_CHECKLIST.md` FASE 3.
**Bloqueado por FASE 3.0:** el webhook de test apunta a producción. En cuanto producción use la
`whsec_` de live, ese webhook empezará a fallar la firma **en silencio**. Necesita destino propio
antes de mover nada.

### L-04 · A-24 · Datos de prueba mezclados con datos de cliente — ⏸️ APLAZADO 15 sep 2026
`get_my_groups` no filtra `is_demo`, y un grupo de prueba está además mal marcado
(`a0000000-…-0001`, `is_demo=false`). Hoy solo lo ven las cuentas de Benjamin. El día que un test
se ejecute con un email real, ese comprador verá un pedido que no hizo.
**Cerrar antes del primer cliente.** Opciones y comandos en `UX_AUDIT_2.md` A-24.

### L-02 · `pvp` sin verificar sostiene *"Ahorras X frente a tienda"* — ⚖️ RIESGO LEGAL
`groups.pvp` lo teclea el admin a mano. No hay verificación, ni fuente, ni fecha, ni captura.
Sobre ese número se calcula el ahorro que se anuncia en la home, en la ficha y en el checkout.
Publicidad comparativa con un precio de referencia no verificado. **No soy abogado: hay que
consultarlo.** Ver también RULE-044 (el tramo 1 debe ser ≤ el mejor precio público del vendedor),
que hoy tampoco se comprueba.

### L-03 · RULE-063 · Desistimiento legal — ⚖️ PENDIENTE DE ABOGADO
Los 14 días naturales **no se pueden renunciar por contrato**. RULE-061 (la plaza no se retira)
probablemente es válida antes del cierre, pero **no después del cobro y la entrega**. Falta:
(a) cuándo se perfecciona el contrato en este modelo, (b) si una retención de hasta 6,5 días sin
salida es cláusula admisible, (c) qué debe decir la política de devoluciones — que ya **existe como borrador** en
`src/content/legal/devoluciones.ts`, pero sin revisar.

**L-02, L-03 y la mitad jurídica de A-28 son la misma consulta.** Una sola visita al abogado las
cierra las tres — pero antes hay que responder las cuatro preguntas de `LEGAL.md` §5, porque sin
ellas el abogado no tiene qué revisar.

## 2 · Producto / UX abiertos

### P1-10 · El panel «Ver estado de tu plaza» tenía medio panel en blanco — ✅ HECHO 15 sep 2026
Añadidos: cantidad, precio máximo, hora exacta de cierre y los tres desenlaces al cerrar.
De camino aparecieron dos errores reales: «asegurada hasta 85 €» era ambiguo con varias unidades
(25 de 184 membresías piden más de una, una pide 10) y el techo se leía del campo equivocado para
quien espera a un precio. Detalle y verificación en `UX_AND_FLOWS.md` § P1-10.

<details><summary>Enunciado original</summary>
Detectado el 15-sep en una captura de Benjamin. No está roto: es que ese panel tiene poco que
contar. Hoy enseña el estado, los tres números (compromiso / actual / próximo objetivo), la barra
y una frase de compartir. Debajo quedan ~500 px vacíos en escritorio.

Lo que le falta es información que el comprador querría y que el sistema ya tiene:

- **cuántas unidades pediste** (`group_members.quantity` — hoy no aparece en ningún sitio del panel);
- **la hora exacta de cierre**, no solo «2d 07h restantes»;
- **qué pasa al cerrar, en cada caso**: si el precio final queda en o por debajo de tu máximo se
  cobra el precio final; si queda por encima, no se cobra nada y se libera la retención; si el
  grupo no arranca, tampoco. Eso hoy solo se cuenta en el checkout, y el comprador que vuelve
  días después a mirar su plaza no lo tiene delante.

Benjamin lo ha aprobado el 15-sep para **después** de verificar A-36 en producción. Es trabajo
nuevo, no un arreglo: no tocar hasta entonces.
</details>

### P1-08 · Apple Pay y Google Pay, retirados de la ficha
Se quitaron (UX-04) porque se anunciaban sin funcionar. Para devolverlos: registrar el dominio en
Stripe — **test y live son listas separadas** —, probar en un móvil real y solo entonces
restaurarlos. El registro en modo test quedó como **UNKNOWN**: `GetPaymentMethodDomains` devolvió
permiso denegado en las dos modalidades.

### RULE-062 · El botón de liberar del admin — ✅ PROBADO 13-sep-2026, falta el aviso al comprador
Verificado de extremo a extremo con tres holds reales en modo test: dos liberados (PaymentIntent en
`canceled`) y uno **rechazado por el guard** de precio mínimo con **Stripe intacto**
(`canceled_at: null`), lo que confirma el orden BD-primero.

Lo que sigue abierto de esta regla:

1. **Nadie avisa al comprador.** `releaseMember` no envía ningún email (ver P2-06). Desde el
   14-sep la pantalla ya no miente —`/mis-grupos` distingue «Plaza liberada» de «Objetivo no
   alcanzado», A-18 en `UX_AUDIT_2.md`—, pero solo lo ve quien entra con sesión, y 26 de 28
   compradores no tienen cuenta. Falta plantilla en `src/lib/emails/` y decidir **qué motivo se
   comunica**: hoy el sistema no guarda por qué se liberó una plaza.
2. **El bloqueo mutuo.** Cuando sacar a cualquiera subiría el precio por encima del mínimo
   garantizado, no se puede liberar a nadie. Sin decidir si debe existir una confirmación forzada.

## 3 · Deuda conocida que sigue viva

| # | Qué | Dónde |
|---|-----|-------|
| P2-01 (resto) | `groups.total_units` **no baja** cuando un miembro se libera. Ya no afecta al checkout, sí a la home, la ficha y el admin | `ALGORITHM.md` |
| A-28 | El checkout **no menciona términos, privacidad ni desistimiento**. Cero cadenas. Misma consulta que L-02 y L-03 | `UX_AUDIT_2.md` |
| A-24 / A-34 | Datos `TEST · Algoritmo precio` dentro de cuentas reales, y 710 líneas de componentes de escritorio huérfanos. Los dos necesitan decidir y limpiar, no arreglar | `UX_AUDIT_2.md` |
| P2-02 | Adjudicación sin relleno: si el siguiente miembro no cabe entero, quedan fuera él y todos los posteriores. **UNKNOWN** si es deliberado | `KNOWN_ISSUES.md` |
| P2-03 | `rate_limits` crece sin límite y no tiene primary key | `KNOWN_ISSUES.md` |
| P2-04 | Copy de compartir desactualizado tras el cambio de `next_price` | `KNOWN_ISSUES.md` |
| P2-06 | **Nadie avisa a quien se queda fuera.** Esperadores no alcanzados, cancelados por RULE-032, grupos cancelados y **liberaciones del admin (RULE-062)**: el hold desaparece sin un solo email | `KNOWN_ISSUES.md` |
| P2-08 | La cookie de admin **es** el `ADMIN_SECRET`: sin rotación, sin caducidad, sin 2FA, sin auditoría. El panel mueve dinero real | `SECURITY.md` SEC-03 |
| DT-03 | Móvil y escritorio son árboles de UI duplicados. Cada cambio de copy hay que hacerlo dos o tres veces | `TECHNICAL_DEBT.md` |
| RULE-041/062 | `withdrawBid` y `releaseMember` recalculan **sin lock**. Suposición operativa: "solo Benjamin usa el admin" | `BUSINESS_RULES.md` |

## 3-bis · Lo que quedó a medias a propósito, esperando criterio de Benjamin

| | Qué falta decidir |
|---|---|
| **A-27** | Las etiquetas del checkout van en `sr-only`: el autorrelleno y los lectores de pantalla ya funcionan, pero al escribir sigue sin verse qué es cada caja. Hacerlas visibles cambia la altura del formulario — decisión visual |
| **A-05** | El nombre del producto sobre la foto cumple ya el contraste AA (5,89:1), pero el arreglo de fondo sería sacarlo **fuera** de la imagen, que es el patrón estándar con producto recortado. Cambia la composición de la tarjeta |
| **A-31 (resto)** | El CTA ya es único en todo el producto. Siguen divergiendo la navegación («Explorar» vs «Inicio»), «Grupo destacado» vs «★ Gropo destacada», «Ahorra» vs «Ahorras», y el selector de cantidad que existe en escritorio y no en móvil |
| **A-32** | El checkout no tiene vista de escritorio: una columna de 512 px centrada en 1.440, sin navegación. Es trabajo de diseño de pantalla, no de copy |
| **Contador del feed** | La campana lleva ya a `/notificaciones`, pero sin número. Saber si hay novedades exige cargar membresías y eventos: necesita un endpoint ligero propio antes de meterlo en la home |

## 4 · Basura en producción

- Grupo `bf117565-…` *"probando otra versd"*: abierto, sin puja, 0 miembros. Hoy es invisible
  (la home exige puja) pero aparecería en cuanto alguien le cargue una.
- Grupos `a0000000-…-0001/6/7`: cerrados o cancelados, de ensayos antiguos. `-0001` tiene
  `total_units = 13` con 0 unidades vivas — es el ejemplar que demuestra la obsolescencia del campo.

## 5 · Hallazgos menores encontrados de camino, sin abrir ticket

- **`URGENCY_WINDOW_DAYS = 14` es código muerto.** `JoinFlow` no enseña cuenta atrás si el cierre
  está a más de 14 días, pero `MAX_CLOSE_WINDOW_HOURS = 156` (6,5 días) hace que eso no pueda
  ocurrir nunca. La rama *"Próximo domingo"* es inalcanzable.
- **`groups.image_url` no se ha usado nunca en producción.** Cero grupos con imagen, jamás. Toda
  la maquetación que depende de la foto del producto está sin probar con datos reales.
- **`bids.max_stock` = 0 significa cosas distintas** en dos sitios: para `unirme/page.tsx` es
  "sin límite conocido", para `prepare_join` es "no queda nada" (rechaza siempre). Hoy no se puede
  dar (el formulario de admin fuerza ≥ 1), pero la ambigüedad está escrita.
