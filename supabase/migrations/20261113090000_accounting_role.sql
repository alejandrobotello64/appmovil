-- Rol base «contabilidad»: las funciones de usuarios lo aceptan como válido.
do $$
declare
  fn record;
  def text;
begin
  for fn in
    select p.oid
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname in ('create_app_user', 'update_app_user_access', 'update_app_user_profile')
  loop
    def := pg_get_functiondef(fn.oid);
    if def like '%''contabilidad''%' then
      continue;
    end if;
    def := replace(def, '''servicio'', ''direccion''', '''servicio'', ''contabilidad'', ''direccion''');
    if def not like '%''contabilidad''%' then
      raise exception 'No se encontró la lista de roles en %', fn.oid::regprocedure;
    end if;
    execute def;
  end loop;
end $$;
