-- 16 台模拟设备最近 7 天的状态观测，共 112 条，可重复执行。
begin;

do $$
begin
  if (select count(*) from public.device) < 16 then
    raise exception 'seed_device_realtime_observation.sql 依赖 seed.sql 中的 16 台设备，请先执行 seed.sql';
  end if;
end;
$$;

create temporary table seed_device_current_snapshot
on commit drop
as
select * from public.device_realtime;

delete from public.device_realtime_observation
where id like 'device-status-seed-%';

with seeded_device as (
  select
    d.id as device_id,
    row_number() over (order by d.id)::integer as device_order,
    dr.status as current_status,
    dr.battery,
    dr.signal_strength,
    dr.cpu_usage,
    dr.temperature,
    dr.health_score
  from public.device d
  join seed_device_current_snapshot dr on dr.device_id = d.id
  order by d.id
  limit 16
),
day_offset as (
  select generate_series(0, 6) as value
),
observation_sample as (
  select
    sd.*,
    day_offset.value as day_offset,
    case
      when day_offset.value = 0 then now() - make_interval(secs => sd.device_order)
      else (
        date_trunc('day', now() at time zone 'Asia/Shanghai')
        - make_interval(days => day_offset.value)
        + time '08:00:00'
        + make_interval(mins => sd.device_order * 20)
      ) at time zone 'Asia/Shanghai'
    end as observation_time,
    case
      when day_offset.value = 0 then sd.current_status
      when (sd.device_order + day_offset.value) % 13 = 0 then 'fault'
      when (sd.device_order + day_offset.value) % 9 = 0 then 'maintenance'
      when (sd.device_order + day_offset.value) % 5 = 0 then 'offline'
      else 'online'
    end as observed_status
  from seeded_device sd
  cross join day_offset
)
insert into public.device_realtime_observation (
  id, device_id, observation_time, status, battery, signal_strength,
  cpu_usage, temperature, last_heartbeat, health_score
)
select
  format('device-status-seed-%s-d%s', device_id, day_offset),
  device_id,
  observation_time,
  observed_status,
  case when battery is null then null else greatest(5, battery - day_offset * 2) end,
  case when observed_status = 'offline' then 0 else greatest(20, coalesce(signal_strength, 70) - day_offset) end,
  case when cpu_usage is null then null else least(100, cpu_usage + day_offset) end,
  case when temperature is null then null else temperature + day_offset * 0.3 end,
  observation_time - interval '10 seconds',
  case
    when observed_status = 'fault' then greatest(20, coalesce(health_score, 80) - 25)
    when observed_status = 'maintenance' then greatest(30, coalesce(health_score, 80) - 15)
    when observed_status = 'offline' then greatest(25, coalesce(health_score, 80) - 20)
    else coalesce(health_score, 90)
  end
from observation_sample
on conflict (id) do update set
  observation_time = excluded.observation_time,
  status = excluded.status,
  battery = excluded.battery,
  signal_strength = excluded.signal_strength,
  cpu_usage = excluded.cpu_usage,
  temperature = excluded.temperature,
  last_heartbeat = excluded.last_heartbeat,
  health_score = excluded.health_score;

commit;

select
  (observation_time at time zone 'Asia/Shanghai')::date as observation_date,
  status,
  count(*) as observation_count
from public.device_realtime_observation
where id like 'device-status-seed-%'
group by 1, 2
order by 1, 2;
