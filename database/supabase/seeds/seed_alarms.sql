-- 使用数据库现有人员、设备、区域及其坐标生成最近 7 天的 50 条告警。
-- 重复执行不会产生重复记录；固定 ID 会刷新到执行当天。

do $$
begin
  if not exists (select 1 from public.person) then
    raise exception 'seed_alarms.sql 需要至少一名现有人员';
  end if;
  if not exists (select 1 from public.device) then
    raise exception 'seed_alarms.sql 需要至少一台现有设备';
  end if;
  if not exists (select 1 from public.area where enable is not false) then
    raise exception 'seed_alarms.sql 需要至少一个启用区域';
  end if;
end;
$$;

delete from public.alarm
where id ~ '^alarm-00[1-6]$'
   or evidence ->> 'seed_source' = 'seed_alarms.sql';

with seed_clock as (
  select
    coalesce(
      nullif(current_setting('petroshield.seed_anchor_date', true), '')::date,
      (now() at time zone 'Asia/Shanghai')::date
    ) as anchor_date
),
clock as (
  select
    anchor_date,
    case
      when anchor_date = (now() at time zone 'Asia/Shanghai')::date then now()
      else (anchor_date::timestamp + time '18:00:00') at time zone 'Asia/Shanghai'
    end as seed_now
  from seed_clock
),
generated as (
  select
    n,
    (n - 1) % 7 as day_offset,
    case (n - 1) % 5
      when 0 then '越界'
      when 1 then '设备异常'
      when 2 then '识别异常'
      when 3 then '离线'
      else '跌倒'
    end as alarm_type,
    case
      when n % 11 = 0 then '重大'
      when n % 3 = 0 then '严重'
      else '一般'
    end as alarm_level,
    case n % 6
      when 0 then '新建'
      when 1 then '处理中'
      when 2 then '确认'
      when 3 then '关闭'
      when 4 then '待复核'
      else '误报'
    end as alarm_status
  from generate_series(1, 50) as n
),
entity_samples as (
  select
    g.*,
    person_sample.id as sampled_person_id,
    person_sample.name as person_name,
    person_sample.device_id as bound_device_id,
    person_sample.person_area_id,
    person_sample.position_x,
    person_sample.position_y,
    person_sample.bound_location,
    device_sample.id as sampled_device_id,
    device_sample.name as device_name,
    device_sample.type as device_type,
    device_sample.region_id as device_area_id,
    device_sample.location as device_location
  from generated g
  cross join lateral (
    select
      person.id,
      person.name,
      person.device_id,
      coalesce(zone_area.id, bound_device.region_id) as person_area_id,
      current_position.x as position_x,
      current_position.y as position_y,
      bound_device.location as bound_location
    from public.person person
    left join public.person_position_current current_position
      on current_position.person_id = person.id
    left join public.area zone_area
      on zone_area.name = person.location_zone
     and zone_area.enable is not false
    left join public.device bound_device on bound_device.id = person.device_id
    where person.id ~ '^person-(00[1-9]|0[1-4][0-9]|050)$'
    order by md5(person.id || ':' || g.n::text)
    limit 1
  ) person_sample
  cross join lateral (
    select device.id, device.name, device.type, device.region_id, device.location
    from public.device device
    join public.area device_area
      on device_area.id = device.region_id
     and device_area.enable is not false
    order by
      case
        when g.alarm_type = '设备异常' then 0
        when device.region_id = person_sample.person_area_id and device.type like '%摄像%' then 0
        when device.region_id = person_sample.person_area_id then 1
        else 2
      end,
      md5(device.id || ':' || g.n::text)
    limit 1
  ) device_sample
),
resolved as (
  select
    sample.*,
    area.id as area_id,
    area.name as area_name,
    area.center as area_center
  from entity_samples sample
  cross join lateral (
    select candidate.id, candidate.name, candidate.center
    from public.area candidate
    where candidate.enable is not false
    order by
      case
        when candidate.id = case
          when sample.alarm_type = '设备异常' then sample.device_area_id
          else coalesce(sample.person_area_id, sample.device_area_id)
        end then 0
        else 1
      end,
      candidate.id
    limit 1
  ) area
)
insert into public.alarm (
  id, type, level, location, "time", status, person_id, device_id,
  confidence, description, evidence
)
select
  format('alarm-trend-%s', lpad(data.n::text, 3, '0')),
  data.alarm_type,
  data.alarm_level,
  jsonb_build_object(
    'area_id', data.area_id,
    'area_name', data.area_name,
    'x', coalesce(
      case when data.alarm_type = '设备异常' then nullif(data.device_location ->> 'x', '')::numeric else data.position_x end,
      nullif(data.bound_location ->> 'x', '')::numeric,
      nullif(data.device_location ->> 'x', '')::numeric,
      nullif(data.area_center ->> 'x', '')::numeric,
      300
    ),
    'y', coalesce(
      case when data.alarm_type = '设备异常' then nullif(data.device_location ->> 'y', '')::numeric else data.position_y end,
      nullif(data.bound_location ->> 'y', '')::numeric,
      nullif(data.device_location ->> 'y', '')::numeric,
      nullif(data.area_center ->> 'y', '')::numeric,
      220
    )
  ),
  case
    when data.day_offset = 0 then least(
      (
        clock.anchor_date::timestamp
        + time '07:00:00'
        + make_interval(mins => data.n * 19 % 600)
      ) at time zone 'Asia/Shanghai',
      clock.seed_now - make_interval(secs => data.n)
    )
    else (
      clock.anchor_date::timestamp
      - make_interval(days => data.day_offset)
      + time '07:00:00'
      + make_interval(mins => data.n * 19 % 600)
    ) at time zone 'Asia/Shanghai'
  end,
  data.alarm_status,
  case when data.alarm_type = '设备异常' then null else data.sampled_person_id end,
  case
    when data.alarm_type = '设备异常' then data.sampled_device_id
    when data.alarm_type = '离线' then coalesce(data.bound_device_id, data.sampled_device_id)
    else data.sampled_device_id
  end,
  0.72 + (data.n % 20) * 0.01,
  case data.alarm_type
    when '设备异常' then format('%s在%s触发设备状态异常告警', data.device_name, data.area_name)
    when '越界' then format('%s进入%s限制边界，系统触发越界告警', data.person_name, data.area_name)
    when '识别异常' then format('%s在%s的智能识别结果需要人工核验', data.person_name, data.area_name)
    when '离线' then format('%s的定位设备在%s连续离线超过阈值', data.person_name, data.area_name)
    else format('%s在%s被识别为疑似跌倒', data.person_name, data.area_name)
  end,
  jsonb_build_object(
    'seed_source', 'seed_alarms.sql',
    'mock_data', true,
    'person_id', case when data.alarm_type = '设备异常' then null else data.sampled_person_id end,
    'person_name', case when data.alarm_type = '设备异常' then null else data.person_name end,
    'device_id', data.sampled_device_id,
    'device_name', data.device_name,
    'device_type', data.device_type,
    'area_id', data.area_id,
    'area_name', data.area_name
  )
from resolved data
cross join clock
on conflict (id) do update set
  type = excluded.type,
  level = excluded.level,
  location = excluded.location,
  "time" = excluded."time",
  status = excluded.status,
  person_id = excluded.person_id,
  device_id = excluded.device_id,
  confidence = excluded.confidence,
  description = excluded.description,
  evidence = excluded.evidence;

select
  ("time" at time zone 'Asia/Shanghai')::date as alarm_date,
  level,
  count(*) as alarm_count
from public.alarm
where evidence ->> 'seed_source' = 'seed_alarms.sql'
group by 1, 2
order by 1, 2;
