create table public.system_dictionary_group (
  id text primary key default extensions.gen_random_uuid()::text,
  code text not null unique,
  name text not null,
  description text,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint system_dictionary_group_code_format check (code ~ '^[a-z][a-z0-9_]{1,39}$')
);

create trigger trg_system_dictionary_group_set_updated_at
before update on public.system_dictionary_group
for each row execute function public.set_updated_at();

create table public.system_dictionary_item (
  id text primary key default extensions.gen_random_uuid()::text,
  group_id text not null references public.system_dictionary_group(id) on update cascade on delete cascade,
  code text not null,
  name text not null,
  color text not null default '#2563eb',
  sort_order integer not null default 0,
  status text not null default 'active',
  remark text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint system_dictionary_item_group_code_unique unique (group_id, code),
  constraint system_dictionary_item_code_format check (code ~ '^[A-Z][A-Z0-9_]{1,63}$'),
  constraint system_dictionary_item_color_format check (color ~ '^#[0-9A-Fa-f]{6}$'),
  constraint system_dictionary_item_status_check check (status in ('active', 'disabled'))
);

create index idx_system_dictionary_item_group_sort
  on public.system_dictionary_item(group_id, sort_order, code);

create trigger trg_system_dictionary_item_set_updated_at
before update on public.system_dictionary_item
for each row execute function public.set_updated_at();

insert into public.system_dictionary_group (id, code, name, description, sort_order) values
  ('dict-group-alarm-type', 'alarm_type', '告警类型', '告警识别与统计分类', 10),
  ('dict-group-risk-level', 'risk_level', '风险等级', '风险区域与事件等级', 20),
  ('dict-group-person-type', 'person_type', '人员类型', '人员档案身份分类', 30),
  ('dict-group-device-type', 'device_type', '设备类型', '设备台账分类', 40),
  ('dict-group-area-type', 'area_type', '区域类型', '电子围栏管控类型', 50)
on conflict (code) do update set
  name = excluded.name,
  description = excluded.description,
  sort_order = excluded.sort_order;

insert into public.system_dictionary_item (
  id, group_id, code, name, color, sort_order, status, remark
) values
  ('dict-alarm-area-intrusion', 'dict-group-alarm-type', 'AREA_INTRUSION', '区域入侵', '#ef4444', 10, 'active', '人员进入未授权风险区域'),
  ('dict-alarm-ppe-missing', 'dict-group-alarm-type', 'PPE_MISSING', '未佩戴安全帽', '#f59e0b', 20, 'active', '视频AI识别防护用品缺失'),
  ('dict-alarm-device-offline', 'dict-group-alarm-type', 'DEVICE_OFFLINE', '设备离线', '#64748b', 30, 'active', '设备心跳超时'),
  ('dict-risk-severe', 'dict-group-risk-level', 'SEVERE', '严重', '#dc2626', 10, 'active', '立即处置并升级上报'),
  ('dict-risk-medium', 'dict-group-risk-level', 'MEDIUM', '中等', '#f59e0b', 20, 'active', '限时确认并派发'),
  ('dict-risk-general', 'dict-group-risk-level', 'GENERAL', '一般', '#3b82f6', 30, 'active', '常规处理'),
  ('dict-person-employee', 'dict-group-person-type', 'EMPLOYEE', '员工', '#2563eb', 10, 'active', '企业正式员工'),
  ('dict-person-contractor', 'dict-group-person-type', 'CONTRACTOR', '承包商', '#8b5cf6', 20, 'active', '外协及施工人员'),
  ('dict-person-visitor', 'dict-group-person-type', 'VISITOR', '访客', '#14b8a6', 30, 'active', '临时入厂人员'),
  ('dict-device-camera', 'dict-group-device-type', 'CAMERA', '视频设备', '#2563eb', 10, 'active', '固定或移动摄像头'),
  ('dict-device-sensor', 'dict-group-device-type', 'SENSOR', '传感器', '#10b981', 20, 'active', '环境及工艺传感设备'),
  ('dict-device-access', 'dict-group-device-type', 'ACCESS', '门禁设备', '#f59e0b', 30, 'active', '闸机及门禁控制器'),
  ('dict-area-danger', 'dict-group-area-type', 'DANGER', '危险区域', '#dc2626', 10, 'active', '需要授权进入'),
  ('dict-area-restricted', 'dict-group-area-type', 'RESTRICTED', '限制区域', '#d97706', 20, 'active', '限制人员或时段'),
  ('dict-area-normal', 'dict-group-area-type', 'NORMAL', '普通区域', '#15803d', 30, 'disabled', '仅用于位置归属')
on conflict (group_id, code) do nothing;

comment on table public.system_dictionary_group is '平台数据字典分类';
comment on table public.system_dictionary_item is '平台数据字典项，编码在分类内唯一';
