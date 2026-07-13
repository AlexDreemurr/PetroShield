-- 人员短期轨迹模拟数据。
-- 按当前 public.person 真实人员集合动态生成：每人最近 5 分钟、每秒 1 条 position 轨迹点。
-- 依赖迁移 20260713000100_add_person_position_current.sql：
-- 插入 position 后会由触发器自动同步 person_position_current 实时快照。

begin;

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
where id like 'pos-seed-%';

with seeded_person as (
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
      + (((sp.person_order - 1) % 5) - 2) * 36.0
      + sin(sp.person_order::double precision * 1.37) * 7.0 as base_x,
    case
      when sp.location_zone like '%A区%' or sp.location_zone like '%储罐%' then 170.0
      when sp.location_zone like '%B区%' or sp.location_zone like '%装卸%' then 225.0
      when sp.location_zone like '%C区%' or sp.location_zone like '%泵房%' then 335.0
      when sp.location_zone like '%办公%' or sp.location_zone like '%综合%' then 115.0
      else 230.0
    end
      + ((((sp.person_order - 1) / 5) % 5) - 2) * 28.0
      + cos(sp.person_order::double precision * 1.91) * 6.0 as base_y
  from seeded_person sp
),
track_sample as (
  select
    pa.*,
    so.value as second_offset,
    now() - make_interval(secs => so.value) as position_time,
    case
      when pa.device_type is not null then pa.device_type
      when pa.status = '离线' then 'UWB'
      when pa.status in ('异常', '风险', '禁止进入') then '视觉融合'
      when pa.person_order % 5 = 0 then '北斗'
      when pa.person_order % 3 = 0 then '蓝牙AOA'
      else 'UWB'
    end as location_source,
    case
      when pa.status = '离线' then 0.58
      when pa.status in ('异常', '风险', '禁止进入') then 0.82
      when pa.risk_level in ('高', '极高') then 0.86
      else 0.94
    end as confidence_base,
    case
      when pa.status = '离线' then 0.04
      when pa.status in ('异常', '风险', '禁止进入') then 1.85
      else 0.85
    end as movement_scale
  from person_anchor pa
  cross join second_offset so
),
position_sample as (
  select
    format('pos-seed-%s-s%03s', person_id, second_offset) as id,
    person_id,
    base_x
      + sin((299 - second_offset + person_order * 7)::double precision / 17.0) * movement_scale * 7.0
      + cos((299 - second_offset)::double precision / 29.0) * movement_scale * 3.0
      as x,
    base_y
      + cos((299 - second_offset + person_order * 5)::double precision / 19.0) * movement_scale * 6.0
      + sin((299 - second_offset)::double precision / 23.0) * movement_scale * 2.5
      as y,
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
      movement_scale
        + sin((299 - second_offset + person_order)::double precision / 13.0) * 0.18
    ) as speed,
    mod(
      360 + person_order * 17 + (299 - second_offset) * 2,
      360
    )::double precision as direction
  from track_sample
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

commit;

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
-- delete from public.position where id like 'pos-seed-%';
