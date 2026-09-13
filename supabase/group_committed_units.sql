-- group_committed_units — unidades que OCUPAN STOCK en un grupo.
--
-- P2-01. Existían tres números distintos y la interfaz usaba el que no era:
--
--   1. UNIDADES COMPROMETIDAS (esto)  = SUM(quantity) de todos los miembros
--      vivos (authorized/instructed/paid), SIN filtrar por join_mode.
--      Un esperador ocupa una plaza igual que un comprador.
--      Es lo que mira `prepare_join` para aceptar o rechazar una compra
--      (v_committed_units) y lo que `close_group` llama v_gross_units.
--
--   2. DEMANDA EFECTIVA a un precio P = SUM(quantity) de los miembros vivos
--      que comprarían a P (comprar, o esperar con target >= P). Es lo que
--      devuelve `tier_demand` y lo que decide si un tramo se desbloquea.
--
--   3. groups.total_units = el caso particular de (2) al precio actual,
--      guardado en la fila. Además se queda OBSOLETO: solo lo reescribe
--      `confirm_join`, así que si un miembro se libera no baja.
--
-- La ficha de checkout calculaba el stock restante con (3), que es siempre
-- menor o igual que (1): sobreestimaba lo disponible y dejaba pedir unidades
-- que el servidor iba a rechazar después, ya con el formulario relleno.
--
-- Esta función es la lectura de (1) para el servidor de Next.js. Solo lectura,
-- no toca nada, y deja la definición escrita UNA vez y al lado de las otras.
-- Deuda pendiente: `prepare_join` y `close_group` siguen con su copia en
-- línea; unificarlas es un cambio en ruta de dinero y va aparte.
--
-- Permisos: solo service_role. La llama el server component de /unirme, que
-- ya usa la service key. Ningún cliente la necesita, así que no se expone.

create or replace function public.group_committed_units(p_group_id uuid)
returns integer
language sql
stable
set search_path to 'public'
as $$
  select coalesce(sum(gm.quantity), 0)::int
  from group_members gm
  where gm.group_id = p_group_id
    and gm.payment_status in ('authorized','instructed','paid');
$$;

revoke all on function public.group_committed_units(uuid) from public;
revoke all on function public.group_committed_units(uuid) from anon;
revoke all on function public.group_committed_units(uuid) from authenticated;
grant execute on function public.group_committed_units(uuid) to service_role;

comment on function public.group_committed_units(uuid) is
'Unidades que OCUPAN STOCK en un grupo: suma de quantity de todos los miembros vivos (authorized/instructed/paid), sin filtrar por join_mode. Un esperador ocupa stock igual que un comprador. Definicion identica a prepare_join.v_committed_units y a close_group.v_gross_units. NO confundir con groups.total_units, que es demanda EFECTIVA al precio actual (excluye esperadores con target por debajo) y ademas se queda obsoleta cuando un miembro se libera. Solo service_role.';
