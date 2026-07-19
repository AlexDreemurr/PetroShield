-- 16 台模拟设备最近 7 天的维护记录，共 48 条，可重复执行。
do $$
begin
  if to_regclass('public.device_maintenance_record') is null then
    raise exception '请先执行 migration 20260719000400_add_device_maintenance_record.sql';
  end if;
end;
$$;

delete from public.device_maintenance_record
where seed_source = 'seed_device_maintenance_records.sql';

with seed_clock as (
  select coalesce(
    nullif(current_setting('petroshield.seed_anchor_date', true), '')::date,
    (now() at time zone 'Asia/Shanghai')::date
  ) as anchor_date
),
seeded_device as (
  select
    device.id as device_id,
    row_number() over (order by device.id)::integer as device_order
  from public.device device
  where device.id in (
    'dev-uwb-bs-a01', 'dev-uwb-tag-p001', 'dev-uwb-tag-p002',
    'dev-camera-a01', 'dev-camera-b02', 'dev-gas-a01', 'dev-pump-c01',
    'dev-meter-c01', 'dev-uwb-tag-p009', 'dev-uwb-tag-p010',
    'dev-camera-c03', 'dev-camera-office01', 'dev-gas-b02', 'dev-temp-c01',
    'dev-access-b01', 'dev-drone-a01'
  )
),
maintenance_sample as (
  select
    device.*,
    sample.record_order,
    case sample.record_order when 1 then '巡检' when 2 then '保养' else '校准' end as maintenance_type,
    (clock.anchor_date::timestamp
      - make_interval(days => sample.record_order * 2 - 1)
      + time '08:00:00'
      + make_interval(mins => device.device_order * 7)
    ) at time zone 'Asia/Shanghai' as started_at
  from seeded_device device
  cross join generate_series(1, 3) as sample(record_order)
  cross join seed_clock clock
)
insert into public.device_maintenance_record (
  id, device_id, maintenance_type, content, result, status,
  maintainer_id, department, started_at, completed_at,
  next_due_at, remark, seed_source
)
select
  format('device-maintenance-seed-%s-r%s', device_id, record_order),
  device_id,
  maintenance_type,
  case maintenance_type
    when '巡检' then '检查供电、通信、安装固定状态及外观完整性'
    when '保养' then '清洁设备外壳与探头，紧固接线并复核网络连接'
    else '使用标准源复核采集精度并校正检测参数'
  end,
  case
    when (device_order + record_order) % 7 = 0 then '发现轻微信号波动，已调整天线方向'
    when maintenance_type = '校准' then '校准完成，数据误差处于允许范围内'
    else '检查正常，设备继续投入运行'
  end,
  'completed',
  case when device_order % 2 = 0 then 'person-005' else 'person-006' end,
  case when device_order % 2 = 0 then '设备部' else '仪表部' end,
  started_at,
  started_at + interval '45 minutes',
  started_at + case maintenance_type when '巡检' then interval '7 days' when '保养' then interval '30 days' else interval '90 days' end,
  '最近 7 天滚动模拟维护记录',
  'seed_device_maintenance_records.sql'
from maintenance_sample
on conflict (id) do update set
  maintenance_type = excluded.maintenance_type,
  content = excluded.content,
  result = excluded.result,
  status = excluded.status,
  maintainer_id = excluded.maintainer_id,
  department = excluded.department,
  started_at = excluded.started_at,
  completed_at = excluded.completed_at,
  next_due_at = excluded.next_due_at,
  remark = excluded.remark,
  seed_source = excluded.seed_source;
