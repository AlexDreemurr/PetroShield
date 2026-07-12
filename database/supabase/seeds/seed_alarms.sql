-- 最近 7 天告警趋势模拟数据。
--
-- 使用前提：目标数据库已经执行过 seed.sql，存在本文件引用的区域、人员和设备。
-- 使用方式：可以在 Supabase SQL Editor 中单独执行，也会在本地 db reset 时于 seed.sql 后执行。
-- 重复执行：不会产生重复记录；固定 ID 对应的记录会刷新到执行当天的最近 7 天。

begin;

do $$
begin
  if (select count(*) from public.person where id ~ '^person-(00[1-9]|01[0-9]|02[0-5])$') <> 25
     or (select count(*) from public.device) < 16
     or not exists (select 1 from public.area where id = 'area-tank-a')
     or not exists (select 1 from public.area where id = 'area-loading-b')
     or not exists (select 1 from public.area where id = 'area-office')
     or not exists (select 1 from public.area where id = 'area-pump-c')
     or not exists (select 1 from public.person where id = 'person-001')
     or not exists (select 1 from public.person where id = 'person-003')
     or not exists (select 1 from public.person where id = 'person-007')
     or not exists (select 1 from public.person where id = 'person-008')
     or not exists (select 1 from public.device where id = 'dev-camera-a01')
     or not exists (select 1 from public.device where id = 'dev-camera-b02')
     or not exists (select 1 from public.device where id = 'dev-gas-a01')
     or not exists (select 1 from public.device where id = 'dev-pump-c01')
     or not exists (select 1 from public.device where id = 'dev-meter-c01') then
    raise exception 'seed_alarms.sql 依赖 seed.sql 的基础区域、人员和设备，请先执行 seed.sql';
  end if;
end;
$$;

with alarm_samples (
  id, day_offset, event_time, type, level, location, status,
  person_id, device_id, confidence, description, evidence
) as (
  values
    (
      'alarm-trend-001', 0, time '09:12:00', '越界', '严重',
      '{"area_id":"area-tank-a","x":251.0,"y":196.0}'::jsonb,
      '新建', 'person-007', 'dev-camera-a01', 0.94,
      '孙华进入A区储罐围栏限制边界，系统触发越界告警',
      '{"images":["mock://evidence/alarm-trend-001.jpg"],"model":"boundary-detection-v1"}'::jsonb
    ),
    (
      'alarm-trend-002', 0, time '10:05:00', '设备异常', '严重',
      '{"area_id":"area-pump-c","x":545.0,"y":342.0}'::jsonb,
      '处理中', null, 'dev-pump-c01', 0.89,
      'C区循环泵振动与温度连续超过预警阈值',
      '{"sensor":{"temperature":59.2,"vibration":8.7}}'::jsonb
    ),
    (
      'alarm-trend-003', 0, time '11:18:00', '离线', '一般',
      '{"area_id":"area-loading-b","x":390.0,"y":220.0}'::jsonb,
      '确认', 'person-008', null, null,
      '吴迪的定位标签连续离线超过五分钟',
      '{"source":"uwb","offline_minutes":6}'::jsonb
    ),
    (
      'alarm-trend-004', 1, time '08:46:00', '跌倒', '重大',
      '{"area_id":"area-loading-b","x":338.4,"y":171.8}'::jsonb,
      '处理中', 'person-003', 'dev-camera-b02', 0.92,
      'AI识别到王强在B区装卸作业区疑似跌倒',
      '{"images":["mock://evidence/alarm-trend-004.jpg"],"model":"fall-detection-v1"}'::jsonb
    ),
    (
      'alarm-trend-005', 1, time '13:27:00', '设备异常', '一般',
      '{"area_id":"area-pump-c","x":552.0,"y":350.0}'::jsonb,
      '确认', null, 'dev-meter-c01', 0.84,
      'C区压力仪表读数短时波动，已通知仪表人员复核',
      '{"sensor":{"pressure":1.86,"unit":"MPa"}}'::jsonb
    ),
    (
      'alarm-trend-006', 2, time '07:55:00', '越界', '重大',
      '{"area_id":"area-tank-a","x":258.0,"y":202.0}'::jsonb,
      '关闭', 'person-007', 'dev-camera-a01', 0.96,
      '高风险作业人员进入A区储罐围栏核心禁入范围',
      '{"images":["mock://evidence/alarm-trend-006.jpg"],"video":"mock://evidence/alarm-trend-006.mp4"}'::jsonb
    ),
    (
      'alarm-trend-007', 2, time '10:32:00', '识别异常', '一般',
      '{"area_id":"area-office","x":72.0,"y":88.0}'::jsonb,
      '误报', 'person-001', null, 0.65,
      '办公区人员证件识别置信度偏低，人工复核为误报',
      '{"model":"badge-ocr-v1","reviewed":true}'::jsonb
    ),
    (
      'alarm-trend-008', 2, time '15:14:00', '离线', '一般',
      '{"area_id":"area-loading-b","x":382.0,"y":214.0}'::jsonb,
      '确认', 'person-008', null, null,
      '承包商定位信号离线超过设定阈值',
      '{"source":"uwb","offline_minutes":9}'::jsonb
    ),
    (
      'alarm-trend-009', 3, time '09:08:00', '设备异常', '严重',
      '{"area_id":"area-loading-b","x":365.0,"y":122.0}'::jsonb,
      '处理中', null, 'dev-camera-b02', 0.90,
      'B区装卸摄像头视频流中断并伴随设备温度升高',
      '{"sensor":{"signal_strength":31,"temperature":52.4}}'::jsonb
    ),
    (
      'alarm-trend-010', 3, time '11:36:00', '越界', '严重',
      '{"area_id":"area-loading-b","x":424.0,"y":246.0}'::jsonb,
      '新建', 'person-003', 'dev-camera-b02', 0.88,
      '承包商未完成作业许可校验进入B区限制区域',
      '{"images":["mock://evidence/alarm-trend-010.jpg"],"rule":"permit_required"}'::jsonb
    ),
    (
      'alarm-trend-011', 3, time '14:22:00', '识别异常', '一般',
      '{"area_id":"area-office","x":68.0,"y":82.0}'::jsonb,
      '确认', 'person-001', null, 0.78,
      '办公区门禁人脸识别连续两次失败',
      '{"model":"face-recognition-v2","retry_count":2}'::jsonb
    ),
    (
      'alarm-trend-012', 3, time '17:03:00', '离线', '一般',
      '{"area_id":"area-loading-b","x":390.0,"y":220.0}'::jsonb,
      '关闭', 'person-008', null, null,
      '定位标签离线，确认人员已正常离场',
      '{"source":"uwb","manual_confirmed":true}'::jsonb
    ),
    (
      'alarm-trend-013', 4, time '08:18:00', '跌倒', '重大',
      '{"area_id":"area-loading-b","x":345.0,"y":180.0}'::jsonb,
      '确认', 'person-003', 'dev-camera-b02', 0.93,
      'B区装卸平台检测到人员倒地并持续未起身',
      '{"images":["mock://evidence/alarm-trend-013.jpg"],"duration_seconds":18}'::jsonb
    ),
    (
      'alarm-trend-014', 4, time '10:41:00', '越界', '严重',
      '{"area_id":"area-tank-a","x":248.0,"y":194.0}'::jsonb,
      '处理中', 'person-007', 'dev-camera-a01', 0.91,
      'A区储罐巡检人员接近高风险边界',
      '{"images":["mock://evidence/alarm-trend-014.jpg"],"distance_to_boundary":1.2}'::jsonb
    ),
    (
      'alarm-trend-015', 4, time '16:09:00', '设备异常', '一般',
      '{"area_id":"area-pump-c","x":552.0,"y":350.0}'::jsonb,
      '新建', null, 'dev-meter-c01', 0.82,
      'C区压力仪表通信延迟超过设备健康阈值',
      '{"sensor":{"latency_ms":1680,"health_score":76}}'::jsonb
    ),
    (
      'alarm-trend-016', 5, time '09:53:00', '识别异常', '严重',
      '{"area_id":"area-tank-a","x":190.0,"y":145.0}'::jsonb,
      '确认', 'person-007', 'dev-camera-a01', 0.87,
      'A区摄像头识别到人员未按要求佩戴防护装备',
      '{"images":["mock://evidence/alarm-trend-016.jpg"],"model":"ppe-detection-v1"}'::jsonb
    ),
    (
      'alarm-trend-017', 5, time '14:37:00', '离线', '一般',
      '{"area_id":"area-loading-b","x":386.0,"y":216.0}'::jsonb,
      '关闭', 'person-008', null, null,
      '定位标签短时离线，信号恢复后自动关闭',
      '{"source":"uwb","offline_minutes":3,"recovered":true}'::jsonb
    ),
    (
      'alarm-trend-018', 6, time '08:25:00', '越界', '严重',
      '{"area_id":"area-tank-a","x":253.0,"y":199.0}'::jsonb,
      '确认', 'person-007', 'dev-camera-a01', 0.92,
      '人员进入A区储罐围栏预警范围',
      '{"images":["mock://evidence/alarm-trend-018.jpg"],"model":"boundary-detection-v1"}'::jsonb
    ),
    (
      'alarm-trend-019', 6, time '12:16:00', '设备异常', '严重',
      '{"area_id":"area-tank-a","x":238.0,"y":205.0}'::jsonb,
      '处理中', null, 'dev-gas-a01', 0.90,
      'A区可燃气体探测器读数达到严重告警阈值',
      '{"sensor":{"lel":24.8,"unit":"%LEL"}}'::jsonb
    ),
    (
      'alarm-trend-020', 6, time '16:48:00', '离线', '一般',
      '{"area_id":"area-loading-b","x":390.0,"y":220.0}'::jsonb,
      '新建', 'person-008', null, null,
      '承包商定位信号离线，等待现场人员确认',
      '{"source":"uwb","offline_minutes":5}'::jsonb
    )
),
current_day as (
  select date_trunc('day', now() at time zone 'Asia/Shanghai') as day_start
)
insert into public.alarm (
  id, type, level, location, "time", status, person_id, device_id,
  confidence, description, evidence
)
select
  a.id,
  a.type,
  a.level,
  a.location,
  (
    c.day_start - make_interval(days => a.day_offset) + a.event_time
  ) at time zone 'Asia/Shanghai',
  a.status,
  a.person_id,
  a.device_id,
  a.confidence,
  a.description,
  a.evidence || jsonb_build_object(
    'seed_source', 'seed_alarms.sql',
    'mock_data', true
  )
from alarm_samples a
cross join current_day c
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

with generated_alarm as (
  select
    n,
    (n - 21) % 7 as day_offset,
    case n % 5
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
    case n % 5
      when 0 then '新建'
      when 1 then '处理中'
      when 2 then '确认'
      when 3 then '关闭'
      else '确认'
    end as alarm_status,
    format('person-%s', lpad((((n - 21) % 25) + 1)::text, 3, '0')) as person_id,
    (array[
      'dev-camera-a01', 'dev-camera-b02', 'dev-pump-c01', 'dev-meter-c01',
      'dev-camera-c03', 'dev-camera-office01', 'dev-gas-b02', 'dev-temp-c01',
      'dev-access-b01', 'dev-drone-a01'
    ])[((n - 21) % 10) + 1] as device_id,
    (array['area-tank-a','area-loading-b','area-pump-c','area-office'])[((n - 21) % 4) + 1] as area_id
  from generate_series(21, 50) as n
),
current_day as (
  select date_trunc('day', now() at time zone 'Asia/Shanghai') as day_start
)
insert into public.alarm (
  id, type, level, location, "time", status, person_id, device_id,
  confidence, description, evidence
)
select
  format('alarm-trend-%s', lpad(g.n::text, 3, '0')),
  g.alarm_type,
  g.alarm_level,
  jsonb_build_object(
    'area_id', g.area_id,
    'x', 100 + g.n * 7 % 500,
    'y', 70 + g.n * 11 % 300
  ),
  (
    c.day_start
    - make_interval(days => g.day_offset)
    + time '07:00:00'
    + make_interval(mins => g.n * 19 % 600)
  ) at time zone 'Asia/Shanghai',
  g.alarm_status,
  case when g.alarm_type = '设备异常' then null else g.person_id end,
  case when g.alarm_type in ('离线', '识别异常') then null else g.device_id end,
  0.72 + (g.n % 20) * 0.01,
  format('扩展模拟告警 #%s：%s场景', g.n, g.alarm_type),
  jsonb_build_object(
    'seed_source', 'seed_alarms.sql',
    'mock_data', true,
    'batch', 'expanded'
  )
from generated_alarm g
cross join current_day c
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

commit;

-- 执行完成后返回本批模拟数据的按日、按等级统计，便于在 SQL Editor 中核对。
select
  ("time" at time zone 'Asia/Shanghai')::date as alarm_date,
  level,
  count(*) as alarm_count
from public.alarm
where evidence ->> 'seed_source' = 'seed_alarms.sql'
group by 1, 2
order by 1, 2;

-- 如需删除本文件生成的模拟告警，可单独执行：
-- delete from public.alarm
-- where evidence ->> 'seed_source' = 'seed_alarms.sql';
