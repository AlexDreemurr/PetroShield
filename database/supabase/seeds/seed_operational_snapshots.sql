-- 将基础 seed 中的当前快照日期刷新到统一锚点日。
-- 锚点由一键脚本写入 petroshield.seed_anchor_date；单独执行时默认北京时间今天。

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
ranked_person as (
  select id, row_number() over (order by id)::integer as item_order
  from public.person
  where id ~ '^person-(00[1-9]|0[1-4][0-9]|050)$'
)
update public.person p
set
  last_active_time = c.seed_now - make_interval(mins => rp.item_order),
  last_training_time = c.seed_now - make_interval(days => 14 + rp.item_order),
  last_medical_check = c.seed_now - make_interval(days => 30 + rp.item_order * 2)
from ranked_person rp
cross join clock c
where p.id = rp.id;

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
      else (anchor_date::timestamp + time '18:00:00') at time zone 'Asia/Shanghai'
    end as seed_now
  from seed_clock
),
ranked_device as (
  select dr.device_id, row_number() over (order by dr.device_id)::integer as item_order
  from public.device_realtime dr
  where dr.device_id like 'dev-%'
)
update public.device_realtime dr
set last_heartbeat = c.seed_now - make_interval(secs => rd.item_order * 5)
from ranked_device rd
cross join clock c
where dr.device_id = rd.device_id;

with seed_clock as (
  select
    coalesce(
      nullif(current_setting('petroshield.seed_anchor_date', true), '')::date,
      (now() at time zone 'Asia/Shanghai')::date
    ) as anchor_date
),
ranked_maintenance as (
  select
    dm.device_id,
    row_number() over (order by dm.device_id)::integer as item_order
  from public.device_maintenance dm
  where dm.device_id like 'dev-%'
)
update public.device_maintenance dm
set
  last_inspect_time = (
    sc.anchor_date::timestamp + time '09:00:00'
    - make_interval(days => rm.item_order)
  ) at time zone 'Asia/Shanghai',
  next_inspect_time = (
    sc.anchor_date::timestamp + time '09:00:00'
    - make_interval(days => rm.item_order)
    + make_interval(days => dm.inspect_cycle_days)
  ) at time zone 'Asia/Shanghai',
  last_repair_time = case
    when dm.repair_count > 0 then (
      sc.anchor_date::timestamp + time '15:00:00'
      - make_interval(days => rm.item_order * 3)
    ) at time zone 'Asia/Shanghai'
    else null
  end
from ranked_maintenance rm
cross join seed_clock sc
where dm.device_id = rm.device_id;

with seed_clock as (
  select
    coalesce(
      nullif(current_setting('petroshield.seed_anchor_date', true), '')::date,
      (now() at time zone 'Asia/Shanghai')::date
    ) as anchor_date
),
ranked_compliance as (
  select
    dc.device_id,
    row_number() over (order by dc.device_id)::integer as item_order
  from public.device_compliance dc
  where dc.device_id like 'dev-%'
)
update public.device_compliance dc
set
  last_inspection_time = (
    sc.anchor_date::timestamp + time '09:00:00'
    - make_interval(months => greatest(1, dc.inspection_cycle_months / 2))
    - make_interval(days => rc.item_order)
  ) at time zone 'Asia/Shanghai',
  next_inspection_time = (
    sc.anchor_date::timestamp + time '09:00:00'
    - make_interval(months => greatest(1, dc.inspection_cycle_months / 2))
    - make_interval(days => rc.item_order)
    + make_interval(months => dc.inspection_cycle_months)
  ) at time zone 'Asia/Shanghai'
from ranked_compliance rc
cross join seed_clock sc
where dc.device_id = rc.device_id;
