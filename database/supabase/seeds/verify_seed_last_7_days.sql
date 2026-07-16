do $$
declare
  anchor_date date := coalesce(
    nullif(current_setting('petroshield.seed_anchor_date', true), '')::date,
    (now() at time zone 'Asia/Shanghai')::date
  );
  window_start timestamptz;
  window_end timestamptz;
begin
  window_start := (
    (anchor_date - 6)::timestamp at time zone 'Asia/Shanghai'
  );
  window_end := (
    (anchor_date + 1)::timestamp at time zone 'Asia/Shanghai'
  );

  if (select count(*) from public.alarm where evidence ->> 'seed_source' = 'seed_alarms.sql') <> 50 then
    raise exception 'Alarm seed validation failed: expected 50 rows.';
  end if;

  if (select count(*) from public.person_health_observation where id like 'health-seed-%') <> 175 then
    raise exception 'Person health seed validation failed: expected 175 rows.';
  end if;

  if (select count(*) from public.device_realtime_observation where id like 'device-status-seed-%') <> 112 then
    raise exception 'Device observation seed validation failed: expected 112 rows.';
  end if;

  if (select count(*) from public.position where id like 'pos-seed-%') <> 7500 then
    raise exception 'Realtime position seed validation failed: expected 7500 rows.';
  end if;

  if (select count(*) from public.position where id like 'pos-history-seed-%') < 7200 then
    raise exception 'Historical position seed validation failed: expected at least 7200 rows.';
  end if;

  if (
    select count(*)
    from public.person_position_current
    where person_id ~ '^person-(00[1-9]|01[0-9]|02[0-5])$'
  ) <> 25 then
    raise exception 'Current person position validation failed: expected 25 rows.';
  end if;

  if (select count(*) from public.device_realtime where device_id like 'dev-%') <> 16 then
    raise exception 'Device realtime snapshot validation failed: expected 16 rows.';
  end if;

  if exists (
    select 1
    from public.alarm
    where evidence ->> 'seed_source' = 'seed_alarms.sql'
      and ("time" < window_start or "time" >= window_end)
  ) then
    raise exception 'Alarm seed contains rows outside the rolling 7-day window.';
  end if;

  if exists (
    select 1
    from public.person_health_observation
    where id like 'health-seed-%'
      and (observation_time < window_start or observation_time >= window_end)
  ) then
    raise exception 'Person health seed contains rows outside the rolling 7-day window.';
  end if;

  if exists (
    select 1
    from public.device_realtime_observation
    where id like 'device-status-seed-%'
      and (observation_time < window_start or observation_time >= window_end)
  ) then
    raise exception 'Device observation seed contains rows outside the rolling 7-day window.';
  end if;

  if exists (
    select 1
    from public.position
    where (id like 'pos-history-seed-%' or id like 'pos-seed-%')
      and ("timestamp" < window_start or "timestamp" >= window_end)
  ) then
    raise exception 'Position seed contains rows outside the rolling 7-day window.';
  end if;
end;
$$;

select
  nullif(current_setting('petroshield.seed_anchor_date', true), '')::date as anchor_date,
  (select count(*) from public.area where id like 'area-%') as seeded_areas,
  (select count(*) from public.device where id like 'dev-%') as seeded_devices,
  (
    select count(*)
    from public.person
    where id ~ '^person-(00[1-9]|01[0-9]|02[0-5])$'
  ) as seeded_people,
  (
    select count(*)
    from public.alarm
    where evidence ->> 'seed_source' = 'seed_alarms.sql'
  ) as seeded_alarms,
  (select count(*) from public.position where id like 'pos-history-seed-%') as historical_positions,
  (select count(*) from public.position where id like 'pos-seed-%') as realtime_positions,
  (select count(*) from public.person_health_observation where id like 'health-seed-%') as health_observations,
  (
    select count(*)
    from public.device_realtime_observation
    where id like 'device-status-seed-%'
  ) as device_observations;
