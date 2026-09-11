# CONTINUE_DEVELOPMENT.md — Gropo

# READ THIS BEFORE MODIFYING THE PROJECT.

Este es el manual de operación para cualquier IA (o persona) que vaya a tocar Gropo.
Léelo entero antes de escribir una sola línea. Está redactado a partir de una auditoría
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
-- P0-01: miembros duplicados
SELECT group_id, user_id, count(*) FROM group_members GROUP BY 1,2 HAVING count(*) > 1;
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
| Qué es el proyecto, por dónde empezar, qué no asumir | `PROJECT_KNOWLEDGE_PACK.md` |
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

---

## ANTES DE EMPEZAR CUALQUIER TAREA — CHECKLIST

```
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
