create table public.video_camera_channel (
  id text primary key default extensions.gen_random_uuid()::text,
  device_id text references public.device(id) on update cascade on delete set null,
  area_id text references public.area(id) on update cascade on delete set null,
  name text not null,
  group_name text not null default '默认分组',
  stream_url text,
  preview_url text,
  status text not null default 'online',
  sort_order integer not null default 0,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint video_camera_channel_status_check check (status in ('online', 'offline', 'fault', 'maintenance'))
);

create trigger trg_video_camera_channel_set_updated_at
before update on public.video_camera_channel
for each row execute function public.set_updated_at();

create table public.video_ai_inference_job (
  id text primary key default extensions.gen_random_uuid()::text,
  camera_id text references public.video_camera_channel(id) on update cascade on delete set null,
  media_type text not null,
  media_name text,
  provider text not null,
  model text,
  status text not null default 'processing',
  request_metadata jsonb not null default '{}'::jsonb,
  response_payload jsonb,
  error_message text,
  latency_ms integer,
  created_at timestamptz not null default now(),
  completed_at timestamptz,
  constraint video_ai_inference_job_media_type_check check (media_type in ('image', 'video')),
  constraint video_ai_inference_job_status_check check (status in ('processing', 'completed', 'failed'))
);

create index idx_video_ai_inference_job_created_at on public.video_ai_inference_job(created_at desc);

create table public.video_ai_event (
  id text primary key default extensions.gen_random_uuid()::text,
  camera_id text references public.video_camera_channel(id) on update cascade on delete set null,
  inference_job_id text references public.video_ai_inference_job(id) on update cascade on delete set null,
  event_type text not null,
  category text not null,
  risk_level text not null,
  status text not null default 'suspected',
  confidence double precision not null,
  summary text not null,
  detected_at timestamptz not null default now(),
  objects jsonb not null default '[]'::jsonb,
  evidence jsonb not null default '{}'::jsonb,
  fusion_data jsonb not null default '{}'::jsonb,
  linked_alarm_id text references public.alarm(id) on update cascade on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint video_ai_event_confidence_range check (confidence >= 0 and confidence <= 1),
  constraint video_ai_event_category_check check (category in ('person', 'vehicle', 'equipment', 'environment')),
  constraint video_ai_event_risk_level_check check (risk_level in ('一般', '中等', '严重', '重大')),
  constraint video_ai_event_status_check check (status in ('suspected', 'confirmed', 'ignored', 'promoted'))
);

create index idx_video_ai_event_detected_at on public.video_ai_event(detected_at desc);
create index idx_video_ai_event_camera_time on public.video_ai_event(camera_id, detected_at desc);
create index idx_video_ai_event_status_time on public.video_ai_event(status, detected_at desc);

create trigger trg_video_ai_event_set_updated_at
before update on public.video_ai_event
for each row execute function public.set_updated_at();

create table public.sensor_anomaly_prediction (
  id text primary key default extensions.gen_random_uuid()::text,
  device_id text not null references public.device(id) on update cascade on delete cascade,
  metric text not null,
  observed_value double precision,
  expected_value double precision,
  predicted_value double precision,
  anomaly_score double precision not null,
  horizon_minutes integer not null default 15,
  risk_level text not null,
  status text not null default 'active',
  observed_at timestamptz not null,
  explanation text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint sensor_anomaly_prediction_score_range check (anomaly_score >= 0 and anomaly_score <= 1),
  constraint sensor_anomaly_prediction_horizon_positive check (horizon_minutes > 0),
  constraint sensor_anomaly_prediction_status_check check (status in ('active', 'resolved', 'ignored'))
);

create index idx_sensor_anomaly_prediction_time on public.sensor_anomaly_prediction(observed_at desc);
create index idx_sensor_anomaly_prediction_device_time on public.sensor_anomaly_prediction(device_id, observed_at desc);

insert into public.system_permission (code, module, action, name, description, sort_order) values
  ('video.analyze', 'video', 'analyze', '执行视频AI识别', '上传图片或视频并调用多模态模型分析', 61),
  ('video.promote', 'video', 'promote', '转为正式告警', '将已复核的视频AI疑似事件转入告警中心', 62)
on conflict (code) do update set
  module = excluded.module,
  action = excluded.action,
  name = excluded.name,
  description = excluded.description,
  sort_order = excluded.sort_order;

insert into public.system_role_permission (role_id, permission_code) values
  ('role-super-admin', 'video.analyze'),
  ('role-super-admin', 'video.promote'),
  ('role-safety-admin', 'video.analyze'),
  ('role-safety-admin', 'video.promote'),
  ('role-dispatcher', 'video.analyze')
on conflict do nothing;

with alarm_dictionary as (
  select id from public.system_dictionary_group where code = 'alarm_type' limit 1
)
insert into public.system_dictionary_item
  (group_id, code, business_value, name, color, sort_order, status, remark)
select alarm_dictionary.id, item.code, item.business_value, item.name, item.color, item.sort_order, 'active', '视频AI识别事件'
from alarm_dictionary
cross join (values
  ('VIDEO_AREA_INTRUSION', '区域入侵', '区域入侵', '#f59e0b', 60),
  ('VIDEO_PERSON_FALL', '人员跌倒', '人员跌倒', '#ef4444', 61),
  ('VIDEO_SMOKE', '烟雾识别', '烟雾识别', '#ef4444', 62),
  ('VIDEO_VEHICLE_DWELL', '车辆异常停留', '车辆异常停留', '#f59e0b', 63),
  ('VIDEO_PPE_CLOTHING', '防护服穿戴异常', '防护服穿戴异常', '#f59e0b', 64)
) as item(code, business_value, name, color, sort_order)
on conflict (group_id, business_value) do update set
  name = excluded.name,
  color = excluded.color,
  sort_order = excluded.sort_order,
  status = excluded.status,
  remark = excluded.remark;

comment on table public.video_camera_channel is '视频AI摄像头通道及区域绑定';
comment on table public.video_ai_inference_job is '多模态模型调用与失败审计记录';
comment on table public.video_ai_event is '视频AI识别产生的疑似或已复核事件';
comment on table public.sensor_anomaly_prediction is '设备时序数据异常检测及短期预测结果';
