-- =============================================================================
-- 10 · Horários, exceções por data e bloqueios (Fase 4 · E4-1)
-- Referência: DATABASE.md §5.12–§5.16
-- Escritas somente via RPC (migration availability_engine); a API só lê.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Horário semanal do estabelecimento
-- -----------------------------------------------------------------------------
create table public.establishment_working_hours (
  id               uuid primary key default gen_random_uuid(),
  establishment_id uuid not null references public.establishments (id) on delete cascade,
  weekday          smallint not null check (weekday between 0 and 6),
  start_time       time not null,
  end_time         time not null,
  created_at       timestamptz not null default now(),
  constraint establishment_working_hours_order check (start_time < end_time),
  constraint establishment_working_hours_no_overlap exclude using gist (
    establishment_id with =, weekday with =, public.timerange(start_time, end_time) with &&
  )
);

create index establishment_working_hours_lookup_idx
  on public.establishment_working_hours (establishment_id, weekday);

-- -----------------------------------------------------------------------------
-- Jornada semanal do profissional
-- Sem nenhuma linha: o profissional segue o horário do estabelecimento (D23).
-- -----------------------------------------------------------------------------
create table public.professional_working_hours (
  id               uuid primary key default gen_random_uuid(),
  establishment_id uuid not null,
  professional_id  uuid not null,
  weekday          smallint not null check (weekday between 0 and 6),
  start_time       time not null,
  end_time         time not null,
  created_at       timestamptz not null default now(),
  constraint professional_working_hours_professional_fk foreign key (establishment_id, professional_id)
    references public.professionals (establishment_id, id) on delete cascade,
  constraint professional_working_hours_order check (start_time < end_time),
  constraint professional_working_hours_no_overlap exclude using gist (
    professional_id with =, weekday with =, public.timerange(start_time, end_time) with &&
  )
);

create index professional_working_hours_lookup_idx
  on public.professional_working_hours (professional_id, weekday);

-- -----------------------------------------------------------------------------
-- Exceções por data local (feriado, horário especial, folga)
-- Ao menos uma linha na data substitui o horário semanal daquele dia.
-- `closed` ocupa o dia inteiro na EXCLUDE, então não convive com outras linhas na mesma data.
-- -----------------------------------------------------------------------------
create table public.establishment_date_overrides (
  id               uuid primary key default gen_random_uuid(),
  establishment_id uuid not null references public.establishments (id) on delete cascade,
  date             date not null,
  kind             public.date_override_kind not null,
  start_time       time,
  end_time         time,
  label            text check (label is null or char_length(label) <= 80),
  created_by       uuid references public.profiles (id) on delete set null,
  created_at       timestamptz not null default now(),
  constraint establishment_date_overrides_shape check (
    (kind = 'closed' and start_time is null and end_time is null)
    or (kind = 'custom_hours' and start_time is not null and end_time is not null and start_time < end_time)
  ),
  constraint establishment_date_overrides_no_overlap exclude using gist (
    establishment_id with =, date with =,
    public.timerange(coalesce(start_time, '00:00'), coalesce(end_time, '24:00')) with &&
  )
);

create index establishment_date_overrides_lookup_idx
  on public.establishment_date_overrides (establishment_id, date);

create table public.professional_date_overrides (
  id               uuid primary key default gen_random_uuid(),
  establishment_id uuid not null,
  professional_id  uuid not null,
  date             date not null,
  kind             public.date_override_kind not null,
  start_time       time,
  end_time         time,
  label            text check (label is null or char_length(label) <= 80),
  created_by       uuid references public.profiles (id) on delete set null,
  created_at       timestamptz not null default now(),
  constraint professional_date_overrides_professional_fk foreign key (establishment_id, professional_id)
    references public.professionals (establishment_id, id) on delete cascade,
  constraint professional_date_overrides_shape check (
    (kind = 'closed' and start_time is null and end_time is null)
    or (kind = 'custom_hours' and start_time is not null and end_time is not null and start_time < end_time)
  ),
  constraint professional_date_overrides_no_overlap exclude using gist (
    professional_id with =, date with =,
    public.timerange(coalesce(start_time, '00:00'), coalesce(end_time, '24:00')) with &&
  )
);

create index professional_date_overrides_lookup_idx
  on public.professional_date_overrides (professional_id, date);

-- -----------------------------------------------------------------------------
-- Bloqueios por intervalo absoluto (pausa, compromisso, férias, evento)
-- professional_id nulo = bloqueio do estabelecimento inteiro.
-- -----------------------------------------------------------------------------
create table public.availability_blocks (
  id               uuid primary key default gen_random_uuid(),
  establishment_id uuid not null references public.establishments (id) on delete cascade,
  professional_id  uuid,
  period           tstzrange not null,
  all_day          boolean not null default false,
  kind             public.block_kind not null default 'other',
  reason           text check (reason is null or char_length(reason) <= 200),
  created_by       uuid references public.profiles (id) on delete set null,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  constraint availability_blocks_professional_fk foreign key (establishment_id, professional_id)
    references public.professionals (establishment_id, id) on delete cascade,
  constraint availability_blocks_period check (
    not isempty(period) and lower_inc(period) and not upper_inc(period)
    and not lower_inf(period) and not upper_inf(period)
    and upper(period) - lower(period) <= interval '366 days'
  )
);

create index availability_blocks_professional_idx
  on public.availability_blocks using gist (professional_id, period);
create index availability_blocks_establishment_idx
  on public.availability_blocks using gist (establishment_id, period) where professional_id is null;

create trigger availability_blocks_set_updated_at
  before update on public.availability_blocks
  for each row execute function private.set_updated_at();

create trigger establishment_working_hours_tenant before update on public.establishment_working_hours
  for each row execute function private.prevent_tenant_change();
create trigger professional_working_hours_tenant before update on public.professional_working_hours
  for each row execute function private.prevent_tenant_change();
create trigger establishment_date_overrides_tenant before update on public.establishment_date_overrides
  for each row execute function private.prevent_tenant_change();
create trigger professional_date_overrides_tenant before update on public.professional_date_overrides
  for each row execute function private.prevent_tenant_change();
create trigger availability_blocks_tenant before update on public.availability_blocks
  for each row execute function private.prevent_tenant_change();

-- -----------------------------------------------------------------------------
-- RLS (somente leitura pela API)
-- -----------------------------------------------------------------------------
alter table public.establishment_working_hours  enable row level security;
alter table public.professional_working_hours   enable row level security;
alter table public.establishment_date_overrides enable row level security;
alter table public.professional_date_overrides  enable row level security;
alter table public.availability_blocks          enable row level security;

create policy establishment_working_hours_select on public.establishment_working_hours
  for select to authenticated using ((select private.is_member(establishment_id)));
create policy establishment_date_overrides_select on public.establishment_date_overrides
  for select to authenticated using ((select private.is_member(establishment_id)));

-- Jornada e exceções do profissional: admin vê todas; staff vê as próprias.
create policy professional_working_hours_select on public.professional_working_hours
  for select to authenticated using (
    (select private.is_establishment_admin(establishment_id))
    or professional_id = (select private.my_professional_id(establishment_id))
  );
create policy professional_date_overrides_select on public.professional_date_overrides
  for select to authenticated using (
    (select private.is_establishment_admin(establishment_id))
    or professional_id = (select private.my_professional_id(establishment_id))
  );

-- Bloqueios: admin vê todos; staff vê os próprios e os do estabelecimento.
create policy availability_blocks_select on public.availability_blocks
  for select to authenticated using (
    (select private.is_establishment_admin(establishment_id))
    or (
      (select private.is_member(establishment_id))
      and (professional_id is null or professional_id = (select private.my_professional_id(establishment_id)))
    )
  );

-- -----------------------------------------------------------------------------
-- Grants
-- -----------------------------------------------------------------------------
revoke all on public.establishment_working_hours, public.professional_working_hours,
              public.establishment_date_overrides, public.professional_date_overrides,
              public.availability_blocks from anon, authenticated;
grant select on public.establishment_working_hours, public.professional_working_hours,
                public.establishment_date_overrides, public.professional_date_overrides,
                public.availability_blocks to authenticated;
grant select, insert, update, delete on public.establishment_working_hours, public.professional_working_hours,
      public.establishment_date_overrides, public.professional_date_overrides,
      public.availability_blocks to service_role;

revoke execute on all functions in schema private from public, anon;
