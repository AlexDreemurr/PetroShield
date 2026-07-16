-- 人员定位模拟数据。
-- 每人生成锚点日及前 6 天的半小时间隔历史点，并生成最近 5 分钟、每秒 1 条实时轨迹点。
-- 依赖迁移 20260713000100_add_person_position_current.sql：
-- 插入 position 后会由触发器自动同步 person_position_current 实时快照。

do $$
begin
  if (select count(*) from public.person) = 0 then
    raise exception 'seed_person_positions.sql 依赖 public.person，请先执行基础 seed 或导入人员数据';
  end if;

  if to_regclass('public.person_position_current') is null then
    raise exception 'seed_person_positions.sql 依赖 person_position_current，请先执行 20260713000100_add_person_position_current.sql';
  end if;
end;
$$;

-- 固定 ID 的时间窗口会随执行时间移动；先清理上一批，只删除本 seed 生成的数据。
delete from public.position
where id like 'pos-seed-%'
   or id like 'pos-history-seed-%'
   or id ~ '^pos-0(0[1-9]|1[0-6])$';

-- 7 天稀疏历史轨迹：过去 6 个完整自然日固定 48 点，锚点日只生成到 seed_now。
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
      else (anchor_date::timestamp + time '23:59:00') at time zone 'Asia/Shanghai'
    end as seed_now
  from seed_clock
),
seeded_person as (
  select
    p.id as person_id,
    p.device_type,
    p.location_zone,
    p.status,
    p.risk_level,
    row_number() over (order by p.id)::integer as person_order
  from public.person p
),
person_anchor as (
  select
    sp.*,
    case
      when sp.location_zone like '%A区%' or sp.location_zone like '%储罐%' then 220.0
      when sp.location_zone like '%B区%' or sp.location_zone like '%装卸%' then 360.0
      when sp.location_zone like '%C区%' or sp.location_zone like '%泵房%' then 520.0
      when sp.location_zone like '%办公%' or sp.location_zone like '%综合%' then 130.0
      else 300.0
    end + (((sp.person_order - 1) % 5) - 2) * 18.0 as base_x,
    case
      when sp.location_zone like '%A区%' or sp.location_zone like '%储罐%' then 170.0
      when sp.location_zone like '%B区%' or sp.location_zone like '%装卸%' then 225.0
      when sp.location_zone like '%C区%' or sp.location_zone like '%泵房%' then 335.0
      when sp.location_zone like '%办公%' or sp.location_zone like '%综合%' then 115.0
      else 230.0
    end + ((((sp.person_order - 1) / 5) % 5) - 2) * 16.0 as base_y
  from seeded_person sp
),
history_sample as (
  select
    pa.*,
    day_offset,
    slot,
    (
      c.anchor_date::timestamp
      - make_interval(days => day_offset)
      + make_interval(mins => slot * 30)
    ) at time zone 'Asia/Shanghai' as observed_at
  from person_anchor pa
  cross join generate_series(0, 6) as day_value(day_offset)
  cross join generate_series(0, 47) as slot_value(slot)
  cross join clock c
)
insert into public.position (
  id, person_id, x, y, z, source, confidence, "timestamp", speed, direction
)
select
  format('pos-history-seed-%s-d%s-t%s', person_id, day_offset, lpad(slot::text, 2, '0')),
  person_id,
  round((base_x + sin((day_offset * 48 + slot + person_order)::double precision / 4.5) * 14)::numeric, 3)::double precision,
  round((base_y + cos((day_offset * 48 + slot + person_order)::double precision / 5.5) * 11)::numeric, 3)::double precision,
  1.0 + (person_order % 4) * 0.1,
  case
    when device_type is not null then device_type
    when status in ('异常', '风险', '禁止进入') then '视觉融合'
    when person_order % 5 = 0 then '北斗'
    else 'UWB'
  end,
  case
    when status = '离线' then 0.58
    when risk_level in ('高', '极高') then 0.84
    else 0.93
  end,
  observed_at,
  case when status = '离线' then 0 else round((0.35 + (person_order % 7) * 0.12)::numeric, 2)::double precision end,
  ((slot * 17 + person_order * 23) % 360)::double precision
from history_sample
cross join clock c
where observed_at <= c.seed_now
on conflict (id) do update set
  person_id = excluded.person_id,
  x = excluded.x,
  y = excluded.y,
  z = excluded.z,
  source = excluded.source,
  confidence = excluded.confidence,
  "timestamp" = excluded."timestamp",
  speed = excluded.speed,
  direction = excluded.direction;

with seed_clock as (
  select
    coalesce(
      nullif(current_setting('petroshield.seed_anchor_date', true), '')::date,
      (now() at time zone 'Asia/Shanghai')::date
    ) as anchor_date
),
clock as (
  select
    case
      when anchor_date = (now() at time zone 'Asia/Shanghai')::date then now()
      else (anchor_date::timestamp + time '23:59:00') at time zone 'Asia/Shanghai'
    end as seed_now
  from seed_clock
),
seeded_person as (
  select
    p.id as person_id,
    p.device_id,
    p.device_type,
    p.location_zone,
    p.status,
    p.risk_level,
    row_number() over (order by p.id)::integer as person_order,
    count(*) over ()::integer as person_count
  from public.person p
),
second_offset as (
  select generate_series(299, 0, -1)::integer as value
),
person_anchor as (
  select
    sp.*,
    case
      when sp.location_zone like '%A区%' or sp.location_zone like '%储罐%' then 220.0
      when sp.location_zone like '%B区%' or sp.location_zone like '%装卸%' then 360.0
      when sp.location_zone like '%C区%' or sp.location_zone like '%泵房%' then 520.0
      when sp.location_zone like '%办公%' or sp.location_zone like '%综合%' then 130.0
      else 300.0
    end
      + (((sp.person_order - 1) % 5) - 2) * 120.0
      + sin(sp.person_order::double precision * 1.37) * 7.0 as base_x,
    case
      when sp.location_zone like '%A区%' or sp.location_zone like '%储罐%' then 170.0
      when sp.location_zone like '%B区%' or sp.location_zone like '%装卸%' then 225.0
      when sp.location_zone like '%C区%' or sp.location_zone like '%泵房%' then 335.0
      when sp.location_zone like '%办公%' or sp.location_zone like '%综合%' then 115.0
      else 230.0
    end
      + ((((sp.person_order - 1) / 5) % 5) - 2) * 90.0
      + cos(sp.person_order::double precision * 1.91) * 6.0 as base_y
  from seeded_person sp
),
person_path_base as (
  select
    pa.*,
    (1 + floor(random() * 6))::integer as segment_count,
    radians(floor(random() * 8) * 45.0 + random() * 18.0 - 9.0) as start_angle,
    case
      when random() < 0.5 then -1.0
      else 1.0
    end * radians(38.0 + random() * 74.0) as turn_angle,
    case
      when pa.status = '离线' then 450.0
      when pa.status in ('异常', '风险', '禁止进入') then 2600.0
      else 2100.0
    end as path_length
  from person_anchor pa
),
track_sample as (
  select
    ppb.*,
    so.value as second_offset,
    c.seed_now - make_interval(secs => so.value) as position_time,
    case
      when ppb.device_type is not null then ppb.device_type
      when ppb.status = '离线' then 'UWB'
      when ppb.status in ('异常', '风险', '禁止进入') then '视觉融合'
      when ppb.person_order % 5 = 0 then '北斗'
      when ppb.person_order % 3 = 0 then '蓝牙AOA'
      else 'UWB'
    end as location_source,
    case
      when ppb.status = '离线' then 0.58
      when ppb.status in ('异常', '风险', '禁止进入') then 0.82
      when ppb.risk_level in ('高', '极高') then 0.86
      else 0.94
    end as confidence_base,
    case
      when ppb.status = '离线' then 0.04
      when ppb.status in ('异常', '风险', '禁止进入') then 1.85
      else 0.85
    end as movement_scale
  from person_path_base ppb
  cross join second_offset so
  cross join clock c
),
path_segment as (
  select
    ppb.person_id,
    ppb.segment_count,
    segment_index,
    ppb.start_angle
      + ppb.turn_angle * segment_index
      + (random() - 0.5) * radians(20.0) as angle,
    ppb.path_length
      * (0.75 + random() * 0.5)
      / ppb.segment_count as segment_length
  from person_path_base ppb
  cross join lateral generate_series(0, ppb.segment_count - 1) as segment(segment_index)
),
path_vector as (
  select
    ps.*,
    cos(ps.angle) * ps.segment_length as dx,
    sin(ps.angle) * ps.segment_length as dy
  from path_segment ps
),
path_geometry as (
  select
    pv.*,
    coalesce(
      sum(dx) over (
        partition by person_id
        order by segment_index
        rows between unbounded preceding and 1 preceding
      ),
      0
    ) as start_dx,
    coalesce(
      sum(dy) over (
        partition by person_id
        order by segment_index
        rows between unbounded preceding and 1 preceding
      ),
      0
    ) as start_dy,
    sum(dx) over (partition by person_id) as total_dx,
    sum(dy) over (partition by person_id) as total_dy
  from path_vector pv
),
track_progress as (
  select
    ts.*,
    (299 - second_offset)::double precision / 299.0 as progress,
    least(
      floor(((299 - second_offset)::double precision / 299.0) * segment_count),
      segment_count - 1
    )::integer as segment_index,
    case
      when (299 - second_offset) = 299 then 1.0
      else (((299 - second_offset)::double precision / 299.0) * segment_count)
        - floor(((299 - second_offset)::double precision / 299.0) * segment_count)
    end as segment_progress
  from track_sample ts
),
track_plan as (
  select
    tp.*,
    pg.angle,
    pg.segment_length,
    pg.dx,
    pg.dy,
    pg.start_dx,
    pg.start_dy,
    pg.total_dx,
    pg.total_dy
  from track_progress tp
  join path_geometry pg
    on pg.person_id = tp.person_id
   and pg.segment_index = tp.segment_index
),
position_sample as (
  select
    format('pos-seed-%s-s%03s', person_id, second_offset) as id,
    person_id,
    base_x - total_dx / 2.0 + start_dx + dx * segment_progress as x,
    base_y - total_dy / 2.0 + start_dy + dy * segment_progress as y,
    1.0 + ((person_order % 4) * 0.1) as z,
    location_source as source,
    least(
      0.99,
      greatest(
        0.35,
        confidence_base
          + sin((299 - second_offset + person_order)::double precision / 31.0) * 0.025
      )
    ) as confidence,
    position_time as "timestamp",
    greatest(
      0,
      segment_length / greatest(1, 299.0 / segment_count)
    ) as speed,
    case
      when degrees(atan2(dy, dx)) < 0
        then degrees(atan2(dy, dx)) + 360.0
      else degrees(atan2(dy, dx))
    end::double precision as direction
  from track_plan
)
insert into public.position (
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
)
select
  id,
  person_id,
  round(x::numeric, 3)::double precision,
  round(y::numeric, 3)::double precision,
  round(z::numeric, 2)::double precision,
  source,
  round(confidence::numeric, 3)::double precision,
  "timestamp",
  round(speed::numeric, 2)::double precision,
  round(direction::numeric, 1)::double precision
from position_sample
on conflict (id) do update set
  person_id = excluded.person_id,
  x = excluded.x,
  y = excluded.y,
  z = excluded.z,
  source = excluded.source,
  confidence = excluded.confidence,
  "timestamp" = excluded."timestamp",
  speed = excluded.speed,
  direction = excluded.direction;

-- 保险起见，显式刷新一次快照。正常情况下，position 触发器已经完成同步。
select public.sync_person_position_current(id)
from public.person;

update public.person p
set last_active_time = current_position."timestamp"
from public.person_position_current current_position
where current_position.person_id = p.id
  and p.id ~ '^person-(00[1-9]|01[0-9]|02[0-5])$';

select
  count(distinct person_id) as person_count,
  count(*) as position_count,
  min("timestamp") as earliest_time,
  max("timestamp") as latest_time
from public.position
where id like 'pos-seed-%';

select count(*) as current_snapshot_count
from public.person_position_current;

-- 如需删除本文件生成的模拟轨迹，可单独执行：
-- delete from public.position where id like 'pos-seed-%' or id like 'pos-history-seed-%';
