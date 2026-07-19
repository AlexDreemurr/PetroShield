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

  if (select count(*) from public.person_health_observation where id like 'health-seed-%') <> 350 then
    raise exception 'Person health seed validation failed: expected 350 rows.';
  end if;

  if (select count(*) from public.device_realtime_observation where id like 'device-status-seed-%') <> 112 then
    raise exception 'Device observation seed validation failed: expected 112 rows.';
  end if;

  if (select count(*) from public.position where id like 'pos-seed-%') <> 15000 then
    raise exception 'Realtime position seed validation failed: expected 15000 rows.';
  end if;

  if (select count(*) from public.position where id like 'pos-history-seed-%') < 14400 then
    raise exception 'Historical position seed validation failed: expected at least 14400 rows.';
  end if;

  if (
    select count(*)
    from public.person_position_current
    where person_id ~ '^person-(00[1-9]|0[1-4][0-9]|050)$'
  ) <> 50 then
    raise exception 'Current person position validation failed: expected 50 rows.';
  end if;

  if (
    select count(*)
    from public.device_realtime
    where device_id in (
      'dev-uwb-bs-a01', 'dev-uwb-tag-p001', 'dev-uwb-tag-p002',
      'dev-camera-a01', 'dev-camera-b02', 'dev-gas-a01', 'dev-pump-c01',
      'dev-meter-c01', 'dev-uwb-tag-p009', 'dev-uwb-tag-p010',
      'dev-camera-c03', 'dev-camera-office01', 'dev-gas-b02', 'dev-temp-c01',
      'dev-access-b01', 'dev-drone-a01'
    )
  ) <> 16 then
    raise exception 'Device realtime snapshot validation failed: expected 16 rows.';
  end if;

  if not exists (select 1 from public.area where enable is not false) then
    raise exception 'Area validation failed: create at least one enabled risk-control area first.';
  end if;

  if exists (
    select 1
    from public.device device
    left join public.area area on area.id = device.region_id and area.enable is not false
    where device.id in (
      'dev-uwb-bs-a01', 'dev-uwb-tag-p001', 'dev-uwb-tag-p002',
      'dev-camera-a01', 'dev-camera-b02', 'dev-gas-a01', 'dev-pump-c01',
      'dev-meter-c01', 'dev-uwb-tag-p009', 'dev-uwb-tag-p010',
      'dev-camera-c03', 'dev-camera-office01', 'dev-gas-b02', 'dev-temp-c01',
      'dev-access-b01', 'dev-drone-a01'
    )
      and area.id is null
  ) then
    raise exception 'Device area validation failed: every seeded device must belong to a current enabled area.';
  end if;

  if exists (
    select 1
    from public.person person
    where person.id ~ '^person-(00[1-9]|0[1-4][0-9]|050)$'
      and not exists (
        select 1 from public.area area
        where area.enable is not false and area.name = person.location_zone
      )
  ) then
    raise exception 'Person area validation failed: every seeded person must use a current enabled area name.';
  end if;

  if exists (
    select 1
    from public.alarm alarm
    left join public.area area on area.id = alarm.location ->> 'area_id'
    where alarm.evidence ->> 'seed_source' = 'seed_alarms.sql'
      and (area.id is null or area.enable is false)
  ) then
    raise exception 'Alarm area validation failed: every seeded alarm must belong to a current enabled area.';
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
  (select count(*) from public.area where enable is not false) as current_enabled_areas,
  (
    select count(*) from public.device
    where id in (
      'dev-uwb-bs-a01', 'dev-uwb-tag-p001', 'dev-uwb-tag-p002',
      'dev-camera-a01', 'dev-camera-b02', 'dev-gas-a01', 'dev-pump-c01',
      'dev-meter-c01', 'dev-uwb-tag-p009', 'dev-uwb-tag-p010',
      'dev-camera-c03', 'dev-camera-office01', 'dev-gas-b02', 'dev-temp-c01',
      'dev-access-b01', 'dev-drone-a01'
    )
  ) as seeded_devices,
  (
    select count(*)
    from public.person
    where id ~ '^person-(00[1-9]|0[1-4][0-9]|050)$'
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
