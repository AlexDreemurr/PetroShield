comment on table public.position is '人员短期轨迹点表：保存近几分钟或近一段时间的定位观测，实时快照由 person_position_current 承担';

create table public.person_position_current (
  person_id text primary key references public.person(id) on update cascade on delete cascade,
  device_id text references public.device(id) on update cascade on delete set null,
  x double precision not null,
  y double precision not null,
  z double precision,
  source text not null,
  confidence double precision not null,
  "timestamp" timestamptz not null,
  speed double precision,
  direction double precision,
  track_position_id text references public.position(id) on update cascade on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint person_position_current_confidence_range
    check (confidence >= 0 and confidence <= 1),
  constraint person_position_current_speed_non_negative
    check (speed is null or speed >= 0)
);

comment on table public.person_position_current is '人员实时位置快照表：每名人员最多一条最新位置，用于地图实时展示和快速查询';
comment on column public.person_position_current.person_id is '人员ID，一人一条实时位置快照';
comment on column public.person_position_current.device_id is '产生该位置的绑定定位设备ID，来自 person.device_id 快照';
comment on column public.person_position_current.x is '当前X坐标，沿用 position.x 的厂区局部坐标体系';
comment on column public.person_position_current.y is '当前Y坐标，沿用 position.y 的厂区局部坐标体系';
comment on column public.person_position_current.z is '当前Z坐标，可选';
comment on column public.person_position_current.source is '定位来源：北斗/UWB/视觉融合等';
comment on column public.person_position_current.confidence is '定位置信度，0到1';
comment on column public.person_position_current."timestamp" is '该实时位置对应的定位时间';
comment on column public.person_position_current.speed is '移动速度';
comment on column public.person_position_current.direction is '移动方向';
comment on column public.person_position_current.track_position_id is '该快照来源的短期轨迹点ID';
comment on column public.person_position_current.created_at is '快照首次创建时间';
comment on column public.person_position_current.updated_at is '快照更新时间';

create index idx_person_position_current_device_id
on public.person_position_current(device_id);

create index idx_person_position_current_timestamp
on public.person_position_current("timestamp" desc);

create index idx_person_position_current_source_timestamp
on public.person_position_current(source, "timestamp" desc);

create trigger trg_person_position_current_set_updated_at
before update on public.person_position_current
for each row execute function public.set_updated_at();

create or replace function public.sync_person_position_current(target_person_id text)
returns void
language plpgsql
as $$
declare
  latest_position public.position%rowtype;
  target_device_id text;
begin
  if target_person_id is null then
    return;
  end if;

  select *
  into latest_position
  from public.position
  where person_id = target_person_id
  order by "timestamp" desc, create_time desc, id desc
  limit 1;

  if latest_position.id is null then
    delete from public.person_position_current
    where person_id = target_person_id;
    return;
  end if;

  select device_id
  into target_device_id
  from public.person
  where id = target_person_id;

  insert into public.person_position_current (
    person_id,
    device_id,
    x,
    y,
    z,
    source,
    confidence,
    "timestamp",
    speed,
    direction,
    track_position_id
  ) values (
    latest_position.person_id,
    target_device_id,
    latest_position.x,
    latest_position.y,
    latest_position.z,
    latest_position.source,
    latest_position.confidence,
    latest_position."timestamp",
    latest_position.speed,
    latest_position.direction,
    latest_position.id
  )
  on conflict (person_id) do update set
    device_id = excluded.device_id,
    x = excluded.x,
    y = excluded.y,
    z = excluded.z,
    source = excluded.source,
    confidence = excluded.confidence,
    "timestamp" = excluded."timestamp",
    speed = excluded.speed,
    direction = excluded.direction,
    track_position_id = excluded.track_position_id;
end;
$$;

comment on function public.sync_person_position_current(text) is '根据指定人员在 position 短期轨迹表中的最新点，同步 person_position_current 实时快照';

create or replace function public.handle_position_change_sync_current()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'DELETE' then
    perform public.sync_person_position_current(old.person_id);
    return old;
  end if;

  if tg_op = 'UPDATE' and old.person_id is distinct from new.person_id then
    perform public.sync_person_position_current(old.person_id);
  end if;

  perform public.sync_person_position_current(new.person_id);
  return new;
end;
$$;

comment on function public.handle_position_change_sync_current() is 'position 短期轨迹点变化后同步实时位置快照';

create trigger trg_position_sync_person_position_current
after insert or update or delete on public.position
for each row execute function public.handle_position_change_sync_current();

insert into public.person_position_current (
  person_id,
  device_id,
  x,
  y,
  z,
  source,
  confidence,
  "timestamp",
  speed,
  direction,
  track_position_id
)
select
  latest.person_id,
  p.device_id,
  latest.x,
  latest.y,
  latest.z,
  latest.source,
  latest.confidence,
  latest."timestamp",
  latest.speed,
  latest.direction,
  latest.id
from (
  select distinct on (person_id)
    id,
    person_id,
    x,
    y,
    z,
    source,
    confidence,
    "timestamp",
    speed,
    direction
  from public.position
  order by person_id, "timestamp" desc, create_time desc, id desc
) latest
join public.person p on p.id = latest.person_id
on conflict (person_id) do update set
  device_id = excluded.device_id,
  x = excluded.x,
  y = excluded.y,
  z = excluded.z,
  source = excluded.source,
  confidence = excluded.confidence,
  "timestamp" = excluded."timestamp",
  speed = excluded.speed,
  direction = excluded.direction,
  track_position_id = excluded.track_position_id;
