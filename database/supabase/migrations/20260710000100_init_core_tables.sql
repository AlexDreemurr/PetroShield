create extension if not exists pgcrypto with schema extensions;

create or replace function public.set_update_time()
returns trigger
language plpgsql
as $$
begin
  new.update_time = now();
  return new;
end;
$$;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table public.area (
  id text primary key default extensions.gen_random_uuid()::text,
  name text not null,
  type text not null,
  polygon jsonb not null default '[]'::jsonb,
  center jsonb,
  radius double precision,
  rule_config jsonb not null default '{}'::jsonb,
  risk_level text,
  enable boolean not null default true,
  create_time timestamptz not null default now(),
  update_time timestamptz not null default now(),
  constraint area_radius_non_negative check (radius is null or radius >= 0)
);

comment on table public.area is '定义电子围栏与风险区域';
comment on column public.area.id is '区域唯一标识';
comment on column public.area.name is '区域名称';
comment on column public.area.type is '区域类型：禁入/限制/普通/危险';
comment on column public.area.polygon is '多边形坐标集合';
comment on column public.area.center is '中心点坐标';
comment on column public.area.radius is '半径（圆形区域）';
comment on column public.area.rule_config is '规则配置：越界/停留/人数限制等';
comment on column public.area.risk_level is '风险等级';
comment on column public.area.enable is '是否启用';
comment on column public.area.create_time is '创建时间';
comment on column public.area.update_time is '更新时间';

create trigger trg_area_set_update_time
before update on public.area
for each row execute function public.set_update_time();

create table public.device (
  id text primary key default extensions.gen_random_uuid()::text,
  name text not null,
  type text not null,
  category text not null,
  model text,
  manufacturer text,
  serial_number text,
  install_date timestamptz,
  region_id text references public.area(id) on update cascade on delete set null,
  location jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.device is '管理定位设备及感知设备的基础信息层';
comment on column public.device.id is '设备唯一ID';
comment on column public.device.name is '设备名称';
comment on column public.device.type is '设备类型：UWB/北斗/雷达/摄像头/泵/仪表等';
comment on column public.device.category is '分类：感知设备/生产设备/安防设备';
comment on column public.device.model is '设备型号';
comment on column public.device.manufacturer is '厂商';
comment on column public.device.serial_number is '序列号';
comment on column public.device.install_date is '安装时间';
comment on column public.device.region_id is '所属区域';
comment on column public.device.location is '安装位置：厂区/车间/GIS坐标';
comment on column public.device.created_at is '创建时间';
comment on column public.device.updated_at is '更新时间';

create trigger trg_device_set_updated_at
before update on public.device
for each row execute function public.set_updated_at();

create table public.person (
  id text primary key default extensions.gen_random_uuid()::text,
  name text not null,
  gender text,
  type text not null,
  department text,
  position text,
  company text,
  id_card text,
  phone text,
  device_id text references public.device(id) on update cascade on delete set null,
  device_type text,
  bind_time timestamptz,
  location_zone text,
  status text not null,
  risk_level text,
  access_status text,
  last_active_time timestamptz,
  safety_tag text,
  training_status text,
  training_score double precision,
  last_training_time timestamptz,
  certificate_status text,
  health_status text,
  health_risk_level text,
  last_medical_check timestamptz,
  occupational_disease_flag boolean,
  exposure_level text,
  performance_score double precision,
  violation_count integer not null default 0,
  reward_count integer not null default 0,
  near_miss_count integer not null default 0,
  safety_score double precision,
  create_time timestamptz not null default now(),
  update_time timestamptz not null default now(),
  remark text,
  constraint person_training_score_non_negative check (training_score is null or training_score >= 0),
  constraint person_performance_score_non_negative check (performance_score is null or performance_score >= 0),
  constraint person_safety_score_non_negative check (safety_score is null or safety_score >= 0),
  constraint person_violation_count_non_negative check (violation_count >= 0),
  constraint person_reward_count_non_negative check (reward_count >= 0),
  constraint person_near_miss_count_non_negative check (near_miss_count >= 0)
);

comment on table public.person is '存储厂区人员基础信息及设备绑定关系';
comment on column public.person.id is '人员唯一标识';
comment on column public.person.name is '姓名';
comment on column public.person.gender is '性别';
comment on column public.person.type is '人员类型：员工/承包商/访客';
comment on column public.person.department is '所属部门';
comment on column public.person.position is '岗位';
comment on column public.person.company is '所属单位/承包商公司';
comment on column public.person.id_card is '身份证/工号';
comment on column public.person.phone is '联系方式';
comment on column public.person.device_id is '绑定定位设备ID';
comment on column public.person.device_type is '设备类型：UWB/RFID/GPS/蓝牙';
comment on column public.person.bind_time is '绑定时间';
comment on column public.person.location_zone is '当前所属区域：装置区/行政区/罐区等';
comment on column public.person.status is '状态：正常/异常/离线/风险/禁止进入';
comment on column public.person.risk_level is '风险等级：低/中/高/极高';
comment on column public.person.access_status is '通行状态：允许/限制/禁止';
comment on column public.person.last_active_time is '最近活跃时间';
comment on column public.person.safety_tag is '安全标签：高危作业/受限人员等';
comment on column public.person.training_status is '培训状态：未培训/培训中/合格/失效';
comment on column public.person.training_score is '综合培训评分';
comment on column public.person.last_training_time is '最近培训时间';
comment on column public.person.certificate_status is '证书状态：有效/过期';
comment on column public.person.health_status is '健康状态：正常/关注/限制/禁入';
comment on column public.person.health_risk_level is '职业健康风险等级';
comment on column public.person.last_medical_check is '最近体检时间';
comment on column public.person.occupational_disease_flag is '是否职业病风险人员';
comment on column public.person.exposure_level is '暴露等级：粉尘/化学/噪声等';
comment on column public.person.performance_score is '综合绩效评分';
comment on column public.person.violation_count is '安全违规次数';
comment on column public.person.reward_count is '安全奖励次数';
comment on column public.person.near_miss_count is '未遂事件上报次数';
comment on column public.person.safety_score is '安全积分';
comment on column public.person.create_time is '创建时间';
comment on column public.person.update_time is '更新时间';
comment on column public.person.remark is '备注';

create trigger trg_person_set_update_time
before update on public.person
for each row execute function public.set_update_time();

create table public.device_realtime (
  device_id text primary key references public.device(id) on update cascade on delete cascade,
  status text not null,
  battery double precision,
  signal_strength double precision,
  cpu_usage double precision,
  temperature double precision,
  last_heartbeat timestamptz,
  health_score double precision,
  updated_at timestamptz not null default now(),
  constraint device_realtime_battery_range check (battery is null or (battery >= 0 and battery <= 100)),
  constraint device_realtime_cpu_usage_range check (cpu_usage is null or (cpu_usage >= 0 and cpu_usage <= 100)),
  constraint device_realtime_health_score_range check (health_score is null or (health_score >= 0 and health_score <= 100))
);

comment on table public.device_realtime is '设备实时状态层';
comment on column public.device_realtime.device_id is '关联设备';
comment on column public.device_realtime.status is 'online / offline / fault / maintenance';
comment on column public.device_realtime.battery is '电量（移动设备）';
comment on column public.device_realtime.signal_strength is '信号强度';
comment on column public.device_realtime.cpu_usage is '计算设备 CPU 使用率';
comment on column public.device_realtime.temperature is '设备温度';
comment on column public.device_realtime.last_heartbeat is '最后心跳';
comment on column public.device_realtime.health_score is '健康评分（0~100）';
comment on column public.device_realtime.updated_at is '更新时间';

create trigger trg_device_realtime_set_updated_at
before update on public.device_realtime
for each row execute function public.set_updated_at();

create table public.device_maintenance (
  device_id text primary key references public.device(id) on update cascade on delete cascade,
  maintainer_id text not null references public.person(id) on update cascade on delete restrict,
  department text,
  maintenance_level text,
  inspect_cycle_days integer,
  last_inspect_time timestamptz,
  next_inspect_time timestamptz,
  last_repair_time timestamptz,
  repair_count integer not null default 0,
  maintenance_status text,
  remark text,
  constraint device_maintenance_inspect_cycle_positive check (inspect_cycle_days is null or inspect_cycle_days > 0),
  constraint device_maintenance_repair_count_non_negative check (repair_count >= 0)
);

comment on table public.device_maintenance is '设备运维管理层';
comment on column public.device_maintenance.device_id is '设备ID';
comment on column public.device_maintenance.maintainer_id is '责任人';
comment on column public.device_maintenance.department is '责任部门';
comment on column public.device_maintenance.maintenance_level is '一级/二级/普通';
comment on column public.device_maintenance.inspect_cycle_days is '巡检周期';
comment on column public.device_maintenance.last_inspect_time is '上次巡检';
comment on column public.device_maintenance.next_inspect_time is '下次巡检';
comment on column public.device_maintenance.last_repair_time is '最近维修';
comment on column public.device_maintenance.repair_count is '维修次数';
comment on column public.device_maintenance.maintenance_status is '正常/维修中/停用';
comment on column public.device_maintenance.remark is '备注';

create table public.device_compliance (
  device_id text primary key references public.device(id) on update cascade on delete cascade,
  inspection_required boolean not null default false,
  inspection_type text,
  inspection_cycle_months integer,
  last_inspection_time timestamptz,
  next_inspection_time timestamptz,
  inspection_status text,
  inspection_agency text,
  certificate_no text,
  risk_level text,
  updated_at timestamptz not null default now(),
  constraint device_compliance_inspection_cycle_positive check (inspection_cycle_months is null or inspection_cycle_months > 0)
);

comment on table public.device_compliance is '设备合规年检层';
comment on column public.device_compliance.device_id is '设备ID';
comment on column public.device_compliance.inspection_required is '是否强检设备';
comment on column public.device_compliance.inspection_type is '年检类型：法检/自检';
comment on column public.device_compliance.inspection_cycle_months is '年检周期';
comment on column public.device_compliance.last_inspection_time is '上次年检';
comment on column public.device_compliance.next_inspection_time is '下次年检';
comment on column public.device_compliance.inspection_status is 'pass / pending / expired';
comment on column public.device_compliance.inspection_agency is '检测机构';
comment on column public.device_compliance.certificate_no is '检测证书编号';
comment on column public.device_compliance.risk_level is '高/中/低风险';
comment on column public.device_compliance.updated_at is '更新时间';

create trigger trg_device_compliance_set_updated_at
before update on public.device_compliance
for each row execute function public.set_updated_at();

create table public.alarm (
  id text primary key default extensions.gen_random_uuid()::text,
  type text not null,
  level text not null,
  location jsonb not null,
  "time" timestamptz not null,
  status text not null,
  person_id text references public.person(id) on update cascade on delete set null,
  device_id text references public.device(id) on update cascade on delete set null,
  confidence double precision,
  description text,
  evidence jsonb,
  create_time timestamptz not null default now(),
  update_time timestamptz not null default now(),
  constraint alarm_confidence_range check (confidence is null or (confidence >= 0 and confidence <= 1))
);

comment on table public.alarm is '存储系统产生的所有告警事件';
comment on column public.alarm.id is '告警唯一标识';
comment on column public.alarm.type is '告警类型：越界/跌倒/设备异常/识别异常';
comment on column public.alarm.level is '告警等级：一般/严重/重大';
comment on column public.alarm.location is '发生位置：坐标或区域ID';
comment on column public.alarm."time" is '发生时间';
comment on column public.alarm.status is '状态：新建/确认/处理中/关闭/误报';
comment on column public.alarm.person_id is '关联人员ID';
comment on column public.alarm.device_id is '关联设备ID（可选）';
comment on column public.alarm.confidence is 'AI置信度（0~1）';
comment on column public.alarm.description is '告警描述';
comment on column public.alarm.evidence is '图片/视频/传感器证据';
comment on column public.alarm.create_time is '创建时间';
comment on column public.alarm.update_time is '更新时间';

create trigger trg_alarm_set_update_time
before update on public.alarm
for each row execute function public.set_update_time();

create table public.position (
  id text primary key default extensions.gen_random_uuid()::text,
  person_id text not null references public.person(id) on update cascade on delete cascade,
  x double precision not null,
  y double precision not null,
  z double precision,
  source text not null,
  confidence double precision not null,
  "timestamp" timestamptz not null,
  speed double precision,
  direction double precision,
  create_time timestamptz not null default now(),
  constraint position_confidence_range check (confidence >= 0 and confidence <= 1),
  constraint position_speed_non_negative check (speed is null or speed >= 0)
);

comment on table public.position is '存储人员实时及历史定位数据';
comment on column public.position.id is '定位记录ID';
comment on column public.position.person_id is '人员ID';
comment on column public.position.x is 'X坐标';
comment on column public.position.y is 'Y坐标';
comment on column public.position.z is 'Z坐标（可选3D）';
comment on column public.position.source is '数据来源：北斗/UWB/视觉融合';
comment on column public.position.confidence is '定位置信度';
comment on column public.position."timestamp" is '定位时间';
comment on column public.position.speed is '移动速度';
comment on column public.position.direction is '移动方向';
comment on column public.position.create_time is '入库时间';

create index idx_device_region_id on public.device(region_id);
create index idx_person_device_id on public.person(device_id);
create index idx_person_type_status on public.person(type, status);
create index idx_person_department on public.person(department);
create index idx_device_realtime_status on public.device_realtime(status);
create index idx_device_maintenance_maintainer_id on public.device_maintenance(maintainer_id);
create index idx_alarm_person_id on public.alarm(person_id);
create index idx_alarm_device_id on public.alarm(device_id);
create index idx_alarm_status_time on public.alarm(status, "time" desc);
create index idx_alarm_level_time on public.alarm(level, "time" desc);
create index idx_position_person_timestamp on public.position(person_id, "timestamp" desc);
create index idx_position_source_timestamp on public.position(source, "timestamp" desc);
create index idx_area_type_enable on public.area(type, enable);
