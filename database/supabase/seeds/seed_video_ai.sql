-- 视频AI摄像头、识别事件和异常预测演示数据，可重复执行。
delete from public.video_ai_event where evidence ->> 'seed_source' = 'seed_video_ai.sql';
delete from public.video_ai_inference_job where request_metadata ->> 'seed_source' = 'seed_video_ai.sql';
delete from public.sensor_anomaly_prediction where metadata ->> 'seed_source' = 'seed_video_ai.sql';

with camera_device as (
  select device.id, device.name, device.region_id,
         row_number() over (order by device.id) as camera_order
  from public.device device
  where device.type like '%摄像%'
  order by device.id
  limit 4
)
insert into public.video_camera_channel (
  id, device_id, area_id, name, group_name, preview_url, status, sort_order, metadata
)
select
  'video-camera-' || camera_order,
  id,
  region_id,
  name,
  case when camera_order <= 2 then '生产区域' else '厂区周界' end,
  '/demo/video-ai/camera-sprite.png',
  'online',
  camera_order * 10,
  jsonb_build_object('seed_source', 'seed_video_ai.sql', 'demo', true, 'sprite_index', camera_order - 1)
from camera_device
on conflict (id) do update set
  device_id=excluded.device_id, area_id=excluded.area_id, name=excluded.name,
  group_name=excluded.group_name, preview_url=excluded.preview_url,
  status=excluded.status, sort_order=excluded.sort_order, metadata=excluded.metadata;

with seed_clock as (
  select case
    when nullif(current_setting('petroshield.seed_anchor_date', true), '') is null then now()
    else ((current_setting('petroshield.seed_anchor_date', true)::date + time '18:00') at time zone 'Asia/Shanghai')
  end as seed_now
), generated as (
  select n,
    case n % 6
      when 0 then '未佩戴安全帽'
      when 1 then '区域入侵'
      when 2 then '人员跌倒'
      when 3 then '烟雾识别'
      when 4 then '车辆异常停留'
      else '防护服穿戴异常'
    end as event_type,
    case n % 6 when 3 then 'environment' when 4 then 'vehicle' else 'person' end as category,
    case when n % 9 = 0 then '重大' when n % 4 = 0 then '严重' when n % 3 = 0 then '中等' else '一般' end as risk_level
  from generate_series(1, 24) n
), camera_sample as (
  select generated.*, camera.id as camera_id, camera.area_id, camera.name as camera_name,
         row_number() over (partition by generated.n order by camera.sort_order) as choice
  from generated
  join public.video_camera_channel camera on true
  where camera.id like 'video-camera-%'
    and mod(generated.n - 1, greatest((select count(*) from public.video_camera_channel where id like 'video-camera-%'), 1)) + 1 = camera.sort_order / 10
)
insert into public.video_ai_event (
  id, camera_id, event_type, category, risk_level, status, confidence,
  summary, detected_at, objects, evidence, fusion_data
)
select
  format('video-event-seed-%s', lpad(sample.n::text, 3, '0')),
  sample.camera_id,
  sample.event_type,
  sample.category,
  sample.risk_level,
  case when sample.n % 7 = 0 then 'ignored' when sample.n % 5 = 0 then 'confirmed' else 'suspected' end,
  0.72 + (sample.n % 24) * 0.01,
  format('%s检测到%s，等待安全人员复核', sample.camera_name, sample.event_type),
  clock.seed_now - make_interval(mins => sample.n * 7),
  jsonb_build_array(jsonb_build_object(
    'label', sample.event_type, 'confidence', 0.72 + (sample.n % 24) * 0.01,
    'bbox', jsonb_build_array(0.25, 0.18, 0.62, 0.88)
  )),
  jsonb_build_object(
    'seed_source', 'seed_video_ai.sql', 'mock_data', true,
    'preview_url', '/demo/video-ai/camera-sprite.png',
    'notes', jsonb_build_array('演示识别事件，不代表真实现场结论')
  ),
  jsonb_build_object(
    'visual_confidence', 0.72 + (sample.n % 24) * 0.01,
    'location_confidence', 0.80 + (sample.n % 12) * 0.01,
    'fusion_confidence', 0.78 + (sample.n % 18) * 0.01,
    'area_id', sample.area_id
  )
from camera_sample sample cross join seed_clock clock
on conflict (id) do update set
  camera_id=excluded.camera_id, event_type=excluded.event_type, category=excluded.category,
  risk_level=excluded.risk_level, status=excluded.status, confidence=excluded.confidence,
  summary=excluded.summary, detected_at=excluded.detected_at, objects=excluded.objects,
  evidence=excluded.evidence, fusion_data=excluded.fusion_data;

with recent_observation as (
  select distinct on (observation.device_id)
    observation.device_id, observation.observation_time, observation.temperature,
    observation.signal_strength, observation.health_score,
    row_number() over (order by observation.device_id) as device_order
  from public.device_realtime_observation observation
  order by observation.device_id, observation.observation_time desc
)
insert into public.sensor_anomaly_prediction (
  id, device_id, metric, observed_value, expected_value, predicted_value,
  anomaly_score, horizon_minutes, risk_level, observed_at, explanation, metadata
)
select
  'sensor-prediction-seed-' || device_id,
  device_id,
  case device_order % 3 when 0 then 'temperature' when 1 then 'signal_strength' else 'health_score' end,
  case device_order % 3 when 0 then temperature when 1 then signal_strength else health_score end,
  case device_order % 3 when 0 then 42 when 1 then 75 else 90 end,
  case device_order % 3 when 0 then coalesce(temperature, 42) + 3.5 when 1 then coalesce(signal_strength, 75) - 8 else coalesce(health_score, 90) - 6 end,
  0.35 + (device_order % 7) * 0.08,
  15,
  case when device_order % 7 >= 5 then '严重' when device_order % 7 >= 3 then '中等' else '一般' end,
  observation_time,
  case device_order % 3
    when 0 then '温度呈持续上升趋势，预计15分钟后偏离近期基线'
    when 1 then '通信信号连续衰减，存在短时离线风险'
    else '健康评分下降速度高于近期平均水平'
  end,
  jsonb_build_object('seed_source', 'seed_video_ai.sql', 'algorithm', 'demo-trend-v1')
from recent_observation
on conflict (id) do update set
  observed_value=excluded.observed_value, expected_value=excluded.expected_value,
  predicted_value=excluded.predicted_value, anomaly_score=excluded.anomaly_score,
  risk_level=excluded.risk_level, observed_at=excluded.observed_at,
  explanation=excluded.explanation, metadata=excluded.metadata;
