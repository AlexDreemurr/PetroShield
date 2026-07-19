-- 根据当前启用区域生成最近 7 天人员轨迹。
-- 每条轨迹均为从相邻厂区驶向人员当前厂区的二次贝塞尔曲线，不会自交。

do $$
begin
  if (select count(*) from public.person) = 0 then
    raise exception 'seed_person_positions.sql 依赖 public.person';
  end if;
  if not exists (select 1 from public.area where enable is not false) then
    raise exception '请先在风险管控页面创建并启用至少一个区域';
  end if;
  if to_regclass('public.person_position_current') is null then
    raise exception 'seed_person_positions.sql 依赖 person_position_current';
  end if;
end;
$$;

delete from public.position
where id like 'pos-seed-%'
   or id like 'pos-history-seed-%'
   or id ~ '^pos-0(0[1-9]|1[0-6])$';

-- 半小时间隔的 7 天历史轨迹。每天都完整记录一次跨厂区移动。
with seed_clock as (
  select coalesce(
    nullif(current_setting('petroshield.seed_anchor_date', true), '')::date,
    (now() at time zone 'Asia/Shanghai')::date
  ) as anchor_date
),
clock as (
  select anchor_date,
    case
      when anchor_date = (now() at time zone 'Asia/Shanghai')::date then now()
      else (anchor_date::timestamp + time '23:59:00') at time zone 'Asia/Shanghai'
    end as seed_now
  from seed_clock
),
area_geometry as (
  select
    area.id,
    area.name,
    row_number() over (order by area.create_time, area.id)::integer as area_order,
    count(*) over ()::integer as area_count,
    coalesce(nullif(area.center ->> 'x', '')::double precision, points.avg_x, 300.0) as center_x,
    coalesce(nullif(area.center ->> 'y', '')::double precision, points.avg_y, 220.0) as center_y,
    greatest(6.0, coalesce(points.max_x - points.min_x, area.radius * 0.7, 20.0)) as span_x,
    greatest(6.0, coalesce(points.max_y - points.min_y, area.radius * 0.7, 20.0)) as span_y
  from public.area area
  left join lateral (
    select
      avg((point ->> 'x')::double precision) as avg_x,
      avg((point ->> 'y')::double precision) as avg_y,
      min((point ->> 'x')::double precision) as min_x,
      max((point ->> 'x')::double precision) as max_x,
      min((point ->> 'y')::double precision) as min_y,
      max((point ->> 'y')::double precision) as max_y
    from jsonb_array_elements(coalesce(area.polygon, '[]'::jsonb)) point
  ) points on true
  where area.enable is not false
),
route_base as (
  select
    person.id as person_id,
    person.device_type,
    person.status,
    person.risk_level,
    row_number() over (partition by destination.id order by person.id)::integer as person_order,
    origin.center_x + (mod(abs(hashtextextended(person.id, 101)), 1000000)::double precision / 999999.0 * 2.0 - 1.0) * origin.span_x * 0.50 as start_x,
    origin.center_y + (mod(abs(hashtextextended(person.id, 211)), 1000000)::double precision / 999999.0 * 2.0 - 1.0) * origin.span_y * 0.50 as start_y,
    destination.center_x + (mod(abs(hashtextextended(person.id, 307)), 1000000)::double precision / 999999.0 * 2.0 - 1.0) * destination.span_x * 0.50 as end_x,
    destination.center_y + (mod(abs(hashtextextended(person.id, 401)), 1000000)::double precision / 999999.0 * 2.0 - 1.0) * destination.span_y * 0.50 as end_y,
    case when mod(abs(hashtextextended(person.id, 503)), 2) = 0 then 0.10 else -0.10 end as bend
  from public.person person
  cross join lateral (
    select area.* from area_geometry area
    order by case when area.name = person.location_zone then 0 else 1 end, area.area_order
    limit 1
  ) destination
  cross join lateral (
    select area.* from area_geometry area
    where area.area_order = case
      when destination.area_count = 1 then destination.area_order
      when destination.area_order = 1 then destination.area_count
      else destination.area_order - 1
    end
    limit 1
  ) origin
  where person.id ~ '^person-(00[1-9]|0[1-4][0-9]|050)$'
),
person_route as (
  select route_base.*,
    (start_x + end_x) / 2.0 - (end_y - start_y) * bend as control_x,
    (start_y + end_y) / 2.0 + (end_x - start_x) * bend as control_y
  from route_base
),
history_sample as (
  select route.*,
    day_offset,
    slot,
    slot::double precision / 47.0 as progress,
    (clock.anchor_date::timestamp - make_interval(days => day_offset) + make_interval(mins => slot * 30))
      at time zone 'Asia/Shanghai' as observed_at
  from person_route route
  cross join generate_series(0, 6) day_value(day_offset)
  cross join generate_series(0, 47) slot_value(slot)
  cross join clock
)
insert into public.position (id, person_id, x, y, z, source, confidence, "timestamp", speed, direction)
select
  format('pos-history-seed-%s-d%s-t%s', person_id, day_offset, lpad(slot::text, 2, '0')),
  person_id,
  round((power(1 - progress, 2) * start_x + 2 * (1 - progress) * progress * control_x + power(progress, 2) * end_x)::numeric, 3)::double precision,
  round((power(1 - progress, 2) * start_y + 2 * (1 - progress) * progress * control_y + power(progress, 2) * end_y)::numeric, 3)::double precision,
  1.0 + (person_order % 4) * 0.1,
  coalesce(device_type, case when person_order % 5 = 0 then '北斗' else 'UWB' end),
  case when status = '离线' then 0.58 when risk_level in ('高', '极高') then 0.84 else 0.93 end,
  observed_at,
  case when status = '离线' then 0 else round((0.55 + (person_order % 6) * 0.12)::numeric, 2)::double precision end,
  mod(round(degrees(atan2(
    -(2 * (1 - progress) * (control_y - start_y) + 2 * progress * (end_y - control_y)),
    2 * (1 - progress) * (control_x - start_x) + 2 * progress * (end_x - control_x)
  )))::integer + 360, 360)::double precision
from history_sample
cross join clock
where observed_at <= clock.seed_now
on conflict (id) do update set
  person_id = excluded.person_id, x = excluded.x, y = excluded.y, z = excluded.z,
  source = excluded.source, confidence = excluded.confidence, "timestamp" = excluded."timestamp",
  speed = excluded.speed, direction = excluded.direction;

-- 最近 5 分钟按秒生成实时轨迹，页面可直接播放完整的跨厂区过程。
with seed_clock as (
  select coalesce(
    nullif(current_setting('petroshield.seed_anchor_date', true), '')::date,
    (now() at time zone 'Asia/Shanghai')::date
  ) as anchor_date
),
clock as (
  select case
    when anchor_date = (now() at time zone 'Asia/Shanghai')::date then now()
    else (anchor_date::timestamp + time '23:59:00') at time zone 'Asia/Shanghai'
  end as seed_now
  from seed_clock
),
area_geometry as (
  select
    area.id,
    area.name,
    row_number() over (order by area.create_time, area.id)::integer as area_order,
    count(*) over ()::integer as area_count,
    coalesce(nullif(area.center ->> 'x', '')::double precision, points.avg_x, 300.0) as center_x,
    coalesce(nullif(area.center ->> 'y', '')::double precision, points.avg_y, 220.0) as center_y,
    greatest(6.0, coalesce(points.max_x - points.min_x, area.radius * 0.7, 20.0)) as span_x,
    greatest(6.0, coalesce(points.max_y - points.min_y, area.radius * 0.7, 20.0)) as span_y
  from public.area area
  left join lateral (
    select avg((point ->> 'x')::double precision) avg_x,
      avg((point ->> 'y')::double precision) avg_y,
      min((point ->> 'x')::double precision) min_x, max((point ->> 'x')::double precision) max_x,
      min((point ->> 'y')::double precision) min_y, max((point ->> 'y')::double precision) max_y
    from jsonb_array_elements(coalesce(area.polygon, '[]'::jsonb)) point
  ) points on true
  where area.enable is not false
),
route_base as (
  select
    person.id person_id, person.device_type, person.status, person.risk_level,
    row_number() over (partition by destination.id order by person.id)::integer person_order,
    origin.center_x + (mod(abs(hashtextextended(person.id, 101)), 1000000)::double precision / 999999.0 * 2.0 - 1.0) * origin.span_x * 0.50 start_x,
    origin.center_y + (mod(abs(hashtextextended(person.id, 211)), 1000000)::double precision / 999999.0 * 2.0 - 1.0) * origin.span_y * 0.50 start_y,
    destination.center_x + (mod(abs(hashtextextended(person.id, 307)), 1000000)::double precision / 999999.0 * 2.0 - 1.0) * destination.span_x * 0.50 end_x,
    destination.center_y + (mod(abs(hashtextextended(person.id, 401)), 1000000)::double precision / 999999.0 * 2.0 - 1.0) * destination.span_y * 0.50 end_y,
    case when mod(abs(hashtextextended(person.id, 503)), 2) = 0 then 0.10 else -0.10 end bend
  from public.person person
  cross join lateral (
    select area.* from area_geometry area
    order by case when area.name = person.location_zone then 0 else 1 end, area.area_order limit 1
  ) destination
  cross join lateral (
    select area.* from area_geometry area
    where area.area_order = case
      when destination.area_count = 1 then destination.area_order
      when destination.area_order = 1 then destination.area_count
      else destination.area_order - 1 end
    limit 1
  ) origin
  where person.id ~ '^person-(00[1-9]|0[1-4][0-9]|050)$'
),
person_route as (
  select route_base.*,
    (start_x + end_x) / 2.0 - (end_y - start_y) * bend control_x,
    (start_y + end_y) / 2.0 + (end_x - start_x) * bend control_y
  from route_base
),
track_sample as (
  select route.*, second_offset,
    clock.seed_now - make_interval(secs => second_offset) observed_at,
    (299 - second_offset)::double precision / 299.0 progress
  from person_route route
  cross join generate_series(299, 0, -1) seconds(second_offset)
  cross join clock
)
insert into public.position (id, person_id, x, y, z, source, confidence, "timestamp", speed, direction)
select
  format('pos-seed-%s-s%s', person_id, lpad(second_offset::text, 3, '0')),
  person_id,
  round((power(1 - progress, 2) * start_x + 2 * (1 - progress) * progress * control_x + power(progress, 2) * end_x)::numeric, 3)::double precision,
  round((power(1 - progress, 2) * start_y + 2 * (1 - progress) * progress * control_y + power(progress, 2) * end_y)::numeric, 3)::double precision,
  1.0 + (person_order % 4) * 0.1,
  coalesce(device_type, case when person_order % 5 = 0 then '北斗' else 'UWB' end),
  case when status = '离线' then 0.58 when risk_level in ('高', '极高') then 0.84 else 0.94 end,
  observed_at,
  case when status = '离线' then 0 else round((0.55 + (person_order % 6) * 0.12)::numeric, 2)::double precision end,
  mod(round(degrees(atan2(
    -(2 * (1 - progress) * (control_y - start_y) + 2 * progress * (end_y - control_y)),
    2 * (1 - progress) * (control_x - start_x) + 2 * progress * (end_x - control_x)
  )))::integer + 360, 360)::double precision
from track_sample
on conflict (id) do update set
  person_id = excluded.person_id, x = excluded.x, y = excluded.y, z = excluded.z,
  source = excluded.source, confidence = excluded.confidence, "timestamp" = excluded."timestamp",
  speed = excluded.speed, direction = excluded.direction;

select public.sync_person_position_current(id) from public.person;

update public.person person
set last_active_time = current_position."timestamp"
from public.person_position_current current_position
where current_position.person_id = person.id
  and person.id ~ '^person-(00[1-9]|0[1-4][0-9]|050)$';

select count(distinct person_id) person_count, count(*) position_count,
  min("timestamp") earliest_time, max("timestamp") latest_time
from public.position where id like 'pos-seed-%';

select count(*) current_snapshot_count from public.person_position_current;
