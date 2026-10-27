-- ============================================================
-- VERSA — Esquema de base de datos (Supabase / PostgreSQL)
-- Ejecutar completo en: Supabase > SQL Editor > New query > Run
-- Es idempotente en lo posible; para reiniciar, borra las tablas antes.
-- ============================================================

-- ---------- PERFILES ----------
create table if not exists public.profiles (
  id           uuid primary key references auth.users(id) on delete cascade,
  role         text not null check (role in ('musico','estudio','manager','disquera')),
  display_name text not null check (char_length(display_name) between 2 and 80),
  bio          text check (char_length(bio) <= 600),
  city         text not null default 'Medellín' check (char_length(city) <= 60),
  zone         text check (char_length(zone) <= 80),
  genres       text[] not null default '{}',
  services     text check (char_length(services) <= 600),
  price_note   text check (char_length(price_note) <= 120),
  instagram    text check (char_length(instagram) <= 100),
  website      text check (char_length(website) <= 200),
  is_public    boolean not null default false,
  consent_at   timestamptz,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

-- Datos de contacto: solo visibles para usuarios con sesión iniciada
create table if not exists public.contacts (
  profile_id    uuid primary key references public.profiles(id) on delete cascade,
  whatsapp      text check (whatsapp ~ '^[0-9+ ]{7,20}$'),
  contact_email text check (char_length(contact_email) <= 120)
);

-- ---------- TRABAJOS (registro de trayectoria) ----------
create table if not exists public.works (
  id               uuid primary key default gen_random_uuid(),
  owner_id         uuid not null references public.profiles(id) on delete cascade,
  title            text not null check (char_length(title) between 2 and 120),
  kind             text not null check (kind in ('grabacion','ensayo','concierto','produccion','colaboracion','otro')),
  description      text check (char_length(description) <= 500),
  work_date        date not null,
  counterpart_id   uuid references public.profiles(id) on delete set null,
  counterpart_name text check (char_length(counterpart_name) <= 80),
  status           text not null default 'autodeclarado'
                   check (status in ('autodeclarado','pendiente','verificado','rechazado')),
  confirmed_at     timestamptz,
  created_at       timestamptz not null default now()
);
create index if not exists works_owner_idx on public.works(owner_id, work_date desc);
create index if not exists works_counterpart_idx on public.works(counterpart_id) where status = 'pendiente';

-- ---------- REPORTES ----------
create table if not exists public.reports (
  id            uuid primary key default gen_random_uuid(),
  reporter_id   uuid not null references auth.users(id) on delete cascade,
  target_id     uuid not null references public.profiles(id) on delete cascade,
  reason        text not null check (char_length(reason) between 5 and 500),
  created_at    timestamptz not null default now()
);

-- ============================================================
-- TRIGGERS Y FUNCIONES
-- ============================================================

-- Crea el perfil al registrarse (toma rol y nombre de los metadatos del signUp)
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  r text := new.raw_user_meta_data->>'role';
  n text := nullif(trim(new.raw_user_meta_data->>'display_name'), '');
begin
  insert into public.profiles (id, role, display_name, consent_at)
  values (
    new.id,
    case when r in ('musico','estudio','manager','disquera') then r else 'musico' end,
    left(coalesce(n, 'Usuario ' || substr(new.id::text, 1, 4)), 80),
    now()
  );
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- updated_at + el rol no se puede cambiar desde la app
create or replace function public.profiles_guard()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  if auth.uid() is not null and new.role is distinct from old.role then
    raise exception 'El tipo de cuenta no se puede cambiar.';
  end if;
  return new;
end $$;

drop trigger if exists profiles_guard on public.profiles;
create trigger profiles_guard
  before update on public.profiles
  for each row execute function public.profiles_guard();

-- Reglas de verificación de trabajos:
--  * El dueño nunca fija el estado: sin contraparte = 'autodeclarado'; con contraparte = 'pendiente'.
--  * Solo la contraparte (vía respond_work) puede pasarlo a 'verificado' o 'rechazado'.
--  * Un trabajo verificado no se edita (se puede retirar).
create or replace function public.works_guard()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  bypass boolean := coalesce(current_setting('versa.bypass', true), '') = '1';
begin
  if new.work_date > current_date then
    raise exception 'La fecha del trabajo no puede ser futura.';
  end if;
  if new.counterpart_id is not null and new.counterpart_id = new.owner_id then
    raise exception 'No puedes ser tu propia contraparte.';
  end if;

  if new.counterpart_id is not null then
    select display_name into new.counterpart_name from public.profiles where id = new.counterpart_id;
  end if;

  if bypass then
    return new;
  end if;

  if tg_op = 'UPDATE' and auth.uid() is not null then
    if old.status = 'verificado' then
      raise exception 'Un trabajo verificado no se puede editar. Puedes retirarlo.';
    end if;
    new.owner_id := old.owner_id;
  end if;

  new.status := case when new.counterpart_id is null then 'autodeclarado' else 'pendiente' end;
  new.confirmed_at := null;
  return new;
end $$;

drop trigger if exists works_guard on public.works;
create trigger works_guard
  before insert or update on public.works
  for each row execute function public.works_guard();

-- La contraparte confirma o rechaza un trabajo pendiente
create or replace function public.respond_work(p_work uuid, p_accept boolean)
returns void language plpgsql security definer set search_path = public as $$
begin
  perform set_config('versa.bypass', '1', true);
  update public.works
     set status = case when p_accept then 'verificado' else 'rechazado' end,
         confirmed_at = now()
   where id = p_work
     and counterpart_id = auth.uid()
     and status = 'pendiente';
  if not found then
    raise exception 'No hay un trabajo pendiente por responder.';
  end if;
end $$;

-- Derecho a borrar la cuenta y todos sus datos
create or replace function public.delete_my_account()
returns void language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then
    raise exception 'Sesión requerida.';
  end if;
  delete from auth.users where id = auth.uid();
end $$;

revoke all on function public.respond_work(uuid, boolean) from public, anon;
revoke all on function public.delete_my_account() from public, anon;
grant execute on function public.respond_work(uuid, boolean) to authenticated;
grant execute on function public.delete_my_account() to authenticated;

-- ---------- ESTADÍSTICAS PÚBLICAS POR PERFIL ----------
create or replace view public.profile_stats
with (security_invoker = true) as
select p.id as profile_id,
       count(w.id) filter (where w.status = 'verificado') as verified_count,
       count(w.id) filter (where w.status in ('autodeclarado','pendiente')) as declared_count
  from public.profiles p
  left join public.works w on w.owner_id = p.id
 group by p.id;

grant select on public.profile_stats to anon, authenticated;

-- ============================================================
-- SEGURIDAD A NIVEL DE FILA (RLS)
-- ============================================================
alter table public.profiles enable row level security;
alter table public.contacts enable row level security;
alter table public.works    enable row level security;
alter table public.reports  enable row level security;

-- PERFILES: públicos solo si la persona lo decidió; siempre visible para su dueño
-- ¿Tengo un trabajo pendiente con este perfil como dueño? (security definer para evitar
-- recursión de políticas entre profiles y works). Permite ver quién pide la confirmación.
create or replace function public.has_pending_request_from(p_owner uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.works w
     where w.owner_id = p_owner
       and w.counterpart_id = auth.uid()
       and w.status = 'pendiente'
  );
$$;
grant execute on function public.has_pending_request_from(uuid) to authenticated;

drop policy if exists profiles_select on public.profiles;
create policy profiles_select on public.profiles for select
  using (is_public or id = auth.uid() or public.has_pending_request_from(id));

drop policy if exists profiles_update on public.profiles;
create policy profiles_update on public.profiles for update
  using (id = auth.uid()) with check (id = auth.uid());

-- (No hay policy de insert: el perfil lo crea el trigger. Borrado: se hace borrando la cuenta.)

-- CONTACTOS: solo con sesión iniciada, y de perfiles públicos o propios
drop policy if exists contacts_select on public.contacts;
create policy contacts_select on public.contacts for select to authenticated
  using (
    profile_id = auth.uid()
    or exists (select 1 from public.profiles p where p.id = profile_id and p.is_public)
  );

drop policy if exists contacts_insert on public.contacts;
create policy contacts_insert on public.contacts for insert to authenticated
  with check (profile_id = auth.uid());

drop policy if exists contacts_update on public.contacts;
create policy contacts_update on public.contacts for update to authenticated
  using (profile_id = auth.uid()) with check (profile_id = auth.uid());

drop policy if exists contacts_delete on public.contacts;
create policy contacts_delete on public.contacts for delete to authenticated
  using (profile_id = auth.uid());

-- TRABAJOS: visibles si el dueño es público, o si eres dueño o contraparte
drop policy if exists works_select on public.works;
create policy works_select on public.works for select
  using (
    owner_id = auth.uid()
    or counterpart_id = auth.uid()
    or exists (select 1 from public.profiles p where p.id = owner_id and p.is_public)
  );

drop policy if exists works_insert on public.works;
create policy works_insert on public.works for insert to authenticated
  with check (owner_id = auth.uid());

drop policy if exists works_update on public.works;
create policy works_update on public.works for update to authenticated
  using (owner_id = auth.uid()) with check (owner_id = auth.uid());

drop policy if exists works_delete on public.works;
create policy works_delete on public.works for delete to authenticated
  using (owner_id = auth.uid());

-- REPORTES: cualquiera con sesión puede reportar; nadie los lee desde la app (solo el panel de Supabase)
drop policy if exists reports_insert on public.reports;
create policy reports_insert on public.reports for insert to authenticated
  with check (reporter_id = auth.uid());
