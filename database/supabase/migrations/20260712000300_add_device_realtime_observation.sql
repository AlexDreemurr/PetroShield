create table public.device_realtime_observation (
  id text primary key default extensions.gen_random_uuid()::text,
  device_id text not null references public.device(id) on update cascade on delete cascade,
  observation_time timestamptz not null,
  status text not null,
  battery double precision,
  signal_strength double precision,
  cpu_usage double precision,
  temperature double precision,
  last_heartbeat timestamptz,
  health_score double precision,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint device_realtime_observation_device_time_unique unique (device_id, observation_time),
  constraint device_realtime_observation_battery_range check (battery is null or (battery >= 0 and battery <= 100)),
  constraint device_realtime_observation_cpu_usage_range check (cpu_usage is null or (cpu_usage >= 0 and cpu_usage <= 100)),
  constraint device_realtime_observation_health_score_range check (health_score is null or (health_score >= 0 and health_score <= 100))
);

comment on table public.device_realtime_observation is '保存设备实时状态的历史观测版本，device_realtime 保存最新状态快照';
comment on column public.device_realtime_observation.id is '设备状态观测唯一标识';
comment on column public.device_realtime_observation.device_id is '关联设备ID';
comment on column public.device_realtime_observation.observation_time is '状态观测时间';
comment on column public.device_realtime_observation.status is 'online / offline / fault / maintenance';

create index idx_device_realtime_observation_device_time
on public.device_realtime_observation(device_id, observation_time desc);

create index idx_device_realtime_observation_time_status
on public.device_realtime_observation(observation_time desc, status);

create trigger trg_device_realtime_observation_set_updated_at
before update on public.device_realtime_observation
for each row execute function public.set_updated_at();

create or replace function public.sync_device_realtime_snapshot(target_device_id text)
returns void
language plpgsql
set search_path = public
as $$
declare
  latest_observation public.device_realtime_observation%rowtype;
begin
  select *
  into latest_observation
  from public.device_realtime_observation
  where device_id = target_device_id
  order by observation_time desc, created_at desc, id desc
  limit 1;

  if found then
    insert into public.device_realtime (
      device_id, status, battery, signal_strength, cpu_usage,
      temperature, last_heartbeat, health_score
    ) values (
      latest_observation.device_id,
      latest_observation.status,
      latest_observation.battery,
      latest_observation.signal_strength,
      latest_observation.cpu_usage,
      latest_observation.temperature,
      latest_observation.last_heartbeat,
      latest_observation.health_score
    )
    on conflict (device_id) do update set
      status = excluded.status,
      battery = excluded.battery,
      signal_strength = excluded.signal_strength,
      cpu_usage = excluded.cpu_usage,
      temperature = excluded.temperature,
      last_heartbeat = excluded.last_heartbeat,
      health_score = excluded.health_score;
  else
    delete from public.device_realtime where device_id = target_device_id;
  end if;
end;
$$;

create or replace function public.handle_device_realtime_observation_change()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if tg_op = 'DELETE' then
    perform public.sync_device_realtime_snapshot(old.device_id);
    return old;
  end if;

  if tg_op = 'UPDATE' and old.device_id is distinct from new.device_id then
    perform public.sync_device_realtime_snapshot(old.device_id);
  end if;

  perform public.sync_device_realtime_snapshot(new.device_id);
  return new;
end;
$$;

create trigger trg_device_realtime_observation_sync_snapshot
after insert or update or delete on public.device_realtime_observation
for each row execute function public.handle_device_realtime_observation_change();
