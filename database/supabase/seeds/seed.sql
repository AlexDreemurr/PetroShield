-- 区域由风险管控页面维护。Seed 只消费当前区域，绝不创建或覆盖区域。
do $$
begin
  if not exists (select 1 from public.area where enable is not false) then
    raise exception '请先在风险管控页面创建并启用至少一个区域，再运行通用 seed';
  end if;
end;
$$;

insert into public.device (
  id, name, type, category, model, manufacturer, serial_number, install_date, region_id, location
) values
  (
    'dev-uwb-bs-a01',
    'UWB定位基站01',
    'UWB',
    '感知设备',
    'UWB-BS-2000',
    '华测安全',
    'UWB-A01-2026',
    '2026-01-12 08:00:00+08',
    null,
    '{"z": 8.0}'::jsonb
  ),
  (
    'dev-uwb-tag-p001',
    '人员定位标签P001',
    'UWB',
    '感知设备',
    'UWB-TAG-5',
    '华测安全',
    'TAG-P001',
    '2026-02-01 09:30:00+08',
    null,
    '{"z": 1.2}'::jsonb
  ),
  (
    'dev-uwb-tag-p002',
    '人员定位标签P002',
    'UWB',
    '感知设备',
    'UWB-TAG-5',
    '华测安全',
    'TAG-P002',
    '2026-02-01 09:35:00+08',
    null,
    '{"z": 1.2}'::jsonb
  ),
  (
    'dev-camera-a01',
    '防爆摄像头01',
    '摄像头',
    '安防设备',
    'EX-CAM-4K',
    '海安视觉',
    'CAM-A01-2026',
    '2026-01-15 14:00:00+08',
    null,
    '{"z": 6.5, "view": "区域全景"}'::jsonb
  ),
  (
    'dev-camera-b02',
    '防爆摄像头02',
    '摄像头',
    '安防设备',
    'EX-CAM-4K',
    '海安视觉',
    'CAM-B02-2026',
    '2026-01-20 10:00:00+08',
    null,
    '{"z": 5.8, "view": "区域全景"}'::jsonb
  ),
  (
    'dev-gas-a01',
    '可燃气体探测器01',
    '气体探测器',
    '感知设备',
    'GAS-LEL-100',
    '安科仪表',
    'GAS-A01-2026',
    '2026-01-18 11:15:00+08',
    null,
    '{"z": 1.8, "medium": "可燃气"}'::jsonb
  ),
  (
    'dev-pump-c01',
    '循环泵01',
    '泵',
    '生产设备',
    'PUMP-CX-80',
    '中化泵业',
    'PUMP-C01-2026',
    '2026-01-25 13:20:00+08',
    null,
    '{"z": 0.0, "asset_no": "P-001"}'::jsonb
  ),
  (
    'dev-meter-c01',
    '压力仪表01',
    '仪表',
    '生产设备',
    'PRESS-60',
    '安科仪表',
    'METER-C01-2026',
    '2026-01-25 13:40:00+08',
    null,
    '{"z": 1.4, "unit": "MPa"}'::jsonb
  )
on conflict (id) do update set
  name = excluded.name,
  type = excluded.type,
  category = excluded.category,
  model = excluded.model,
  manufacturer = excluded.manufacturer,
  serial_number = excluded.serial_number,
  install_date = excluded.install_date,
  region_id = excluded.region_id,
  location = excluded.location;

insert into public.device (
  id, name, type, category, model, manufacturer, serial_number, install_date, region_id, location
) values
  ('dev-uwb-tag-p009', '人员定位标签P009', 'UWB', '感知设备', 'UWB-TAG-5', '华测安全', 'TAG-P009', '2026-03-01 09:00:00+08', null, '{"z":1.2}'::jsonb),
  ('dev-uwb-tag-p010', '人员定位标签P010', 'UWB', '感知设备', 'UWB-TAG-5', '华测安全', 'TAG-P010', '2026-03-01 09:05:00+08', null, '{"z":1.2}'::jsonb),
  ('dev-camera-c03', '防爆摄像头03', '摄像头', '安防设备', 'EX-CAM-4K', '海安视觉', 'CAM-C03-2026', '2026-02-10 10:00:00+08', null, '{"z":6.0,"view":"区域全景"}'::jsonb),
  ('dev-camera-office01', '智能摄像头04', '摄像头', '安防设备', 'AI-CAM-2K', '海安视觉', 'CAM-O01-2026', '2026-02-12 10:00:00+08', null, '{"z":3.2,"view":"区域入口"}'::jsonb),
  ('dev-gas-b02', '有毒气体探测器02', '气体探测器', '感知设备', 'GAS-H2S-80', '安科仪表', 'GAS-B02-2026', '2026-02-15 11:00:00+08', null, '{"z":1.8,"medium":"硫化氢"}'::jsonb),
  ('dev-temp-c01', '温度传感器01', '温度传感器', '感知设备', 'TEMP-PT100', '安科仪表', 'TEMP-C01-2026', '2026-02-18 08:30:00+08', null, '{"z":1.0,"unit":"℃"}'::jsonb),
  ('dev-access-b01', '防爆门禁01', '门禁', '安防设备', 'ACCESS-EX-10', '华测安全', 'ACCESS-B01-2026', '2026-02-20 14:00:00+08', null, '{"z":1.4,"gate":"区域入口"}'::jsonb),
  ('dev-drone-a01', '巡检无人机01', '无人机', '感知设备', 'UAV-EX-6', '华测安全', 'UAV-A01-2026', '2026-03-02 09:00:00+08', null, '{"z":20.0,"dock":"巡检机库"}'::jsonb)
on conflict (id) do update set
  name = excluded.name,
  type = excluded.type,
  category = excluded.category,
  model = excluded.model,
  manufacturer = excluded.manufacturer,
  serial_number = excluded.serial_number,
  install_date = excluded.install_date,
  region_id = excluded.region_id,
  location = excluded.location;

-- 将所有 seed 设备均匀映射到用户当前划定的启用区域，并使用区域几何中心附近坐标。
with area_geometry as (
  select
    area.id,
    area.name,
    row_number() over (order by area.create_time, area.id)::integer as area_order,
    count(*) over ()::integer as area_count,
    coalesce(
      nullif(area.center ->> 'x', '')::double precision,
      (select avg((point ->> 'x')::double precision) from jsonb_array_elements(area.polygon) point),
      300.0
    ) as center_x,
    coalesce(
      nullif(area.center ->> 'y', '')::double precision,
      (select avg((point ->> 'y')::double precision) from jsonb_array_elements(area.polygon) point),
      220.0
    ) as center_y
  from public.area area
  where area.enable is not false
),
seeded_device as (
  select
    device.id,
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
device_area as (
  select
    device.id as device_id,
    area.id as area_id,
    area.name as area_name,
    area.center_x + (((device.device_order - 1) % 3) - 1) * 3.0 as x,
    area.center_y + ((((device.device_order - 1) / 3) % 3) - 1) * 3.0 as y
  from seeded_device device
  join area_geometry area
    on area.area_order = ((device.device_order - 1) % area.area_count) + 1
)
update public.device device
set
  region_id = mapping.area_id,
  location = coalesce(device.location, '{}'::jsonb) || jsonb_build_object(
    'x', mapping.x,
    'y', mapping.y,
    'zone', mapping.area_name
  )
from device_area mapping
where device.id = mapping.device_id;

insert into public.person (
  id, name, gender, type, department, position, company, id_card, phone,
  device_id, device_type, bind_time, location_zone, status, risk_level,
  access_status, last_active_time, safety_tag, training_status,
  training_score, last_training_time, certificate_status, health_status,
  health_risk_level, last_medical_check, occupational_disease_flag,
  exposure_level, performance_score, violation_count, reward_count,
  near_miss_count, safety_score, remark
) values
  (
    'person-001',
    '张伟',
    '男',
    '员工',
    '生产一部',
    '巡检员',
    '石化厂',
    'EMP-001',
    '13800000001',
    'dev-uwb-tag-p001',
    'UWB',
    '2026-02-02 08:10:00+08',
    '综合办公区',
    '正常',
    '低',
    '允许',
    '2026-07-10 10:56:00+08',
    '巡检',
    '合格',
    92.5,
    '2026-06-12 09:00:00+08',
    '有效',
    '正常',
    '低',
    '2026-05-20 09:30:00+08',
    false,
    '噪声',
    88.0,
    0,
    2,
    1,
    96.0,
    '模拟巡检人员'
  ),
  (
    'person-002',
    '李娜',
    '女',
    '员工',
    'HSE部',
    '安全主管',
    '石化厂',
    'EMP-002',
    '13800000002',
    null,
    null,
    null,
    'A区储罐围栏',
    '正常',
    '低',
    '允许',
    '2026-07-10 10:58:00+08',
    '管理人员',
    '合格',
    96.0,
    '2026-06-01 10:00:00+08',
    '有效',
    '正常',
    '低',
    '2026-05-18 14:00:00+08',
    false,
    null,
    94.0,
    0,
    3,
    0,
    99.0,
    'HSE责任人'
  ),
  (
    'person-003',
    '王强',
    '男',
    '承包商',
    '检维修外协',
    '维修工',
    '安维检修有限公司',
    'CON-003',
    '13800000003',
    'dev-uwb-tag-p002',
    'UWB',
    '2026-03-05 08:00:00+08',
    'B区装卸作业区',
    '风险',
    '中',
    '限制',
    '2026-07-10 10:51:00+08',
    '受限人员',
    '合格',
    81.0,
    '2026-05-28 13:00:00+08',
    '有效',
    '关注',
    '中',
    '2026-04-20 15:00:00+08',
    false,
    '化学',
    76.0,
    1,
    0,
    2,
    72.0,
    '模拟承包商人员'
  ),
  (
    'person-004',
    '赵敏',
    '女',
    '访客',
    '访客',
    '审计顾问',
    '华东安全咨询',
    'VIS-004',
    '13800000004',
    null,
    null,
    null,
    '综合办公区',
    '正常',
    '低',
    '允许',
    '2026-07-10 10:44:00+08',
    '访客',
    '培训中',
    68.0,
    '2026-07-09 15:00:00+08',
    '有效',
    '正常',
    '低',
    null,
    false,
    null,
    70.0,
    0,
    0,
    0,
    80.0,
    '模拟访客'
  ),
  (
    'person-005',
    '陈磊',
    '男',
    '员工',
    '设备部',
    '设备工程师',
    '石化厂',
    'EMP-005',
    '13800000005',
    null,
    null,
    null,
    'C区泵房',
    '正常',
    '低',
    '允许',
    '2026-07-10 10:53:00+08',
    '设备责任人',
    '合格',
    90.0,
    '2026-06-08 09:00:00+08',
    '有效',
    '正常',
    '低',
    '2026-05-09 11:00:00+08',
    false,
    '噪声',
    86.5,
    0,
    1,
    0,
    93.0,
    '设备运维责任人'
  ),
  (
    'person-006',
    '周杰',
    '男',
    '员工',
    '仪表部',
    '仪表工程师',
    '石化厂',
    'EMP-006',
    '13800000006',
    null,
    null,
    null,
    'C区泵房',
    '正常',
    '低',
    '允许',
    '2026-07-10 10:49:00+08',
    '仪表责任人',
    '合格',
    89.0,
    '2026-06-06 09:00:00+08',
    '有效',
    '正常',
    '低',
    '2026-05-10 10:20:00+08',
    false,
    '噪声',
    85.0,
    0,
    1,
    1,
    91.0,
    '仪表维护责任人'
  ),
  (
    'person-007',
    '孙华',
    '男',
    '员工',
    '生产二部',
    '班组长',
    '石化厂',
    'EMP-007',
    '13800000007',
    null,
    null,
    null,
    'A区储罐围栏',
    '异常',
    '高',
    '限制',
    '2026-07-10 10:20:00+08',
    '高危作业',
    '合格',
    84.5,
    '2026-06-10 09:00:00+08',
    '有效',
    '关注',
    '中',
    '2026-05-12 09:00:00+08',
    false,
    '化学',
    82.0,
    2,
    0,
    3,
    70.0,
    '用于高风险看板模拟'
  ),
  (
    'person-008',
    '吴迪',
    '男',
    '承包商',
    '检维修外协',
    '焊工',
    '安维检修有限公司',
    'CON-008',
    '13800000008',
    null,
    null,
    null,
    'B区装卸作业区',
    '离线',
    '中',
    '限制',
    '2026-07-10 09:35:00+08',
    '动火作业',
    '失效',
    59.0,
    '2026-03-01 09:00:00+08',
    '过期',
    '正常',
    '低',
    '2026-04-22 13:00:00+08',
    false,
    '粉尘',
    61.0,
    1,
    0,
    0,
    65.0,
    '用于离线告警模拟'
  )
on conflict (id) do update set
  name = excluded.name,
  gender = excluded.gender,
  type = excluded.type,
  department = excluded.department,
  position = excluded.position,
  company = excluded.company,
  id_card = excluded.id_card,
  phone = excluded.phone,
  device_id = excluded.device_id,
  device_type = excluded.device_type,
  bind_time = excluded.bind_time,
  location_zone = excluded.location_zone,
  status = excluded.status,
  risk_level = excluded.risk_level,
  access_status = excluded.access_status,
  last_active_time = excluded.last_active_time,
  safety_tag = excluded.safety_tag,
  training_status = excluded.training_status,
  training_score = excluded.training_score,
  last_training_time = excluded.last_training_time,
  certificate_status = excluded.certificate_status,
  health_status = excluded.health_status,
  health_risk_level = excluded.health_risk_level,
  last_medical_check = excluded.last_medical_check,
  occupational_disease_flag = excluded.occupational_disease_flag,
  exposure_level = excluded.exposure_level,
  performance_score = excluded.performance_score,
  violation_count = excluded.violation_count,
  reward_count = excluded.reward_count,
  near_miss_count = excluded.near_miss_count,
  safety_score = excluded.safety_score,
  remark = excluded.remark;

with new_person (
  id, name, gender, type, department, position, company, location_zone,
  status, risk_level, access_status, health_status, health_risk_level,
  exposure_level, device_id
) as (
  values
    ('person-009','郑凯','男','员工','生产一部','操作工','石化厂','A区储罐围栏','正常','低','允许','正常','低','化学','dev-uwb-tag-p009'),
    ('person-010','何静','女','员工','设备部','维修工程师','石化厂','C区泵房','正常','低','允许','正常','低','噪声','dev-uwb-tag-p010'),
    ('person-011','刘洋','男','员工','HSE部','安全员','石化厂','B区装卸作业区','正常','低','允许','正常','低','化学',null),
    ('person-012','黄敏','女','员工','仪表部','仪表工','石化厂','C区泵房','正常','中','允许','关注','中','噪声',null),
    ('person-013','马超','男','承包商','检维修外协','焊工','安维检修有限公司','B区装卸作业区','风险','中','限制','关注','中','粉尘',null),
    ('person-014','许芳','女','员工','生产二部','中控员','石化厂','综合办公区','正常','低','允许','正常','低',null,null),
    ('person-015','郭鹏','男','员工','生产一部','巡检员','石化厂','A区储罐围栏','异常','高','限制','限制','高','化学',null),
    ('person-016','冯雪','女','访客','访客','审计员','华东安全咨询','综合办公区','正常','低','允许','正常','低',null,null),
    ('person-017','宋涛','男','承包商','工程外协','架子工','中联工程有限公司','B区装卸作业区','正常','中','限制','正常','中','粉尘',null),
    ('person-018','邓丽','女','员工','质检部','化验员','石化厂','综合办公区','正常','低','允许','关注','中','化学',null),
    ('person-019','曹宇','男','员工','设备部','机械工程师','石化厂','C区泵房','正常','低','允许','正常','低','噪声',null),
    ('person-020','彭佳','女','员工','HSE部','职业健康专员','石化厂','A区储罐围栏','正常','低','允许','正常','低','化学',null),
    ('person-021','唐峰','男','承包商','物流外协','装卸工','恒运物流有限公司','B区装卸作业区','风险','高','限制','限制','高','粉尘',null),
    ('person-022','叶琳','女','员工','生产二部','工艺工程师','石化厂','A区储罐围栏','正常','低','允许','正常','低','化学',null),
    ('person-023','魏强','男','员工','保卫部','门禁管理员','石化厂','综合办公区','正常','低','允许','正常','低',null,null),
    ('person-024','沈悦','女','承包商','检维修外协','电工','安维检修有限公司','C区泵房','正常','中','限制','关注','中','噪声',null),
    ('person-025','韩东','男','员工','生产一部','班组长','石化厂','A区储罐围栏','正常','低','允许','正常','低','化学',null)
)
insert into public.person (
  id, name, gender, type, department, position, company, id_card, phone,
  device_id, device_type, bind_time, location_zone, status, risk_level,
  access_status, last_active_time, safety_tag, training_status,
  training_score, last_training_time, certificate_status, health_status,
  health_risk_level, last_medical_check, occupational_disease_flag,
  exposure_level, performance_score, violation_count, reward_count,
  near_miss_count, safety_score, remark
)
select
  np.id, np.name, np.gender, np.type, np.department, np.position, np.company,
  'MOCK-' || upper(np.id),
  '13800000' || right(np.id, 3),
  np.device_id,
  case when np.device_id is not null then 'UWB' end,
  case when np.device_id is not null then '2026-03-02 08:00:00+08'::timestamptz end,
  np.location_zone, np.status, np.risk_level, np.access_status,
  now() - make_interval(mins => right(np.id, 3)::integer),
  case when np.risk_level in ('高','极高') then '高危作业' else '普通作业' end,
  case when np.type = '访客' then '培训中' else '合格' end,
  (70 + right(np.id, 3)::integer % 27)::double precision,
  now() - make_interval(days => 15 + right(np.id, 3)::integer),
  case when np.type = '访客' then '临时' else '有效' end,
  np.health_status, np.health_risk_level,
  now() - make_interval(days => 30 + right(np.id, 3)::integer * 2),
  np.health_risk_level = '高',
  np.exposure_level,
  (68 + right(np.id, 3)::integer % 29)::double precision,
  case when np.status in ('风险','异常') then 1 else 0 end,
  case when np.type = '员工' then 1 else 0 end,
  case when np.risk_level in ('中','高') then 1 else 0 end,
  (70 + right(np.id, 3)::integer % 28)::double precision,
  '扩展模拟人员数据'
from new_person np
on conflict (id) do update set
  name = excluded.name, gender = excluded.gender, type = excluded.type,
  department = excluded.department, position = excluded.position,
  company = excluded.company, id_card = excluded.id_card, phone = excluded.phone,
  device_id = excluded.device_id, device_type = excluded.device_type,
  bind_time = excluded.bind_time, location_zone = excluded.location_zone,
  status = excluded.status, risk_level = excluded.risk_level,
  access_status = excluded.access_status, last_active_time = excluded.last_active_time,
  safety_tag = excluded.safety_tag, training_status = excluded.training_status,
  training_score = excluded.training_score, last_training_time = excluded.last_training_time,
  certificate_status = excluded.certificate_status, health_status = excluded.health_status,
  health_risk_level = excluded.health_risk_level,
  last_medical_check = excluded.last_medical_check,
  occupational_disease_flag = excluded.occupational_disease_flag,
  exposure_level = excluded.exposure_level, performance_score = excluded.performance_score,
  violation_count = excluded.violation_count, reward_count = excluded.reward_count,
  near_miss_count = excluded.near_miss_count, safety_score = excluded.safety_score,
  remark = excluded.remark;

-- 人员跟随绑定设备所在区域；未绑定设备的人员按当前启用区域均匀分配。
-- 补齐至 50 名模拟人员。人员所在区域在下方按当前启用区域重新分配。
with generated_person as (
  select
    format('person-%s', lpad(person_number::text, 3, '0')) as id,
    (array[
      '周晨','苏倩','罗峰','蒋宁','何伟','陆雪','金涛','方敏','袁杰','夏琳',
      '戴强','孔悦','顾明','任佳','施磊','姚静','邵勇','汪婷','钱坤','余欣',
      '熊凯','白璐','潘浩','侯敏','江波'
    ])[person_number - 25] as name,
    person_number
  from generate_series(26, 50) as generated(person_number)
)
insert into public.person (
  id, name, gender, type, department, position, company, id_card, phone,
  device_id, device_type, bind_time, location_zone, status, risk_level,
  access_status, last_active_time, safety_tag, training_status,
  training_score, last_training_time, certificate_status, health_status,
  health_risk_level, last_medical_check, occupational_disease_flag,
  exposure_level, performance_score, violation_count, reward_count,
  near_miss_count, safety_score, remark
)
select
  generated.id,
  generated.name,
  case when generated.person_number % 3 = 0 then '女' else '男' end,
  case when generated.person_number % 8 = 0 then '承包商' else '员工' end,
  (array['生产一部','生产二部','设备部','仪表部','HSE部','质检部'])[
    ((generated.person_number - 26) % 6) + 1
  ],
  (array['巡检员','操作工','维修工','仪表工','安全员','化验员'])[
    ((generated.person_number - 26) % 6) + 1
  ],
  case when generated.person_number % 8 = 0 then '安维检修有限公司' else '石化厂' end,
  'MOCK-' || upper(generated.id),
  '13800000' || right(generated.id, 3),
  null,
  null,
  null,
  null,
  case when generated.person_number in (31, 44) then '风险' else '正常' end,
  case when generated.person_number in (31, 44) then '高'
       when generated.person_number % 7 = 0 then '中' else '低' end,
  case when generated.person_number in (31, 44) then '限制' else '允许' end,
  now() - make_interval(mins => generated.person_number),
  case when generated.person_number in (31, 44) then '高危作业' else '普通作业' end,
  '合格',
  (72 + generated.person_number % 25)::double precision,
  now() - make_interval(days => generated.person_number),
  '有效',
  case when generated.person_number in (31, 44) then '限制'
       when generated.person_number % 7 = 0 then '关注' else '正常' end,
  case when generated.person_number in (31, 44) then '高'
       when generated.person_number % 7 = 0 then '中' else '低' end,
  now() - make_interval(days => 30 + generated.person_number),
  generated.person_number in (31, 44),
  (array['化学','噪声','粉尘',null])[((generated.person_number - 26) % 4) + 1],
  (70 + generated.person_number % 27)::double precision,
  case when generated.person_number in (31, 44) then 1 else 0 end,
  1,
  case when generated.person_number % 7 = 0 then 1 else 0 end,
  (72 + generated.person_number % 26)::double precision,
  '扩展模拟人员数据'
from generated_person generated
on conflict (id) do update set
  name = excluded.name,
  gender = excluded.gender,
  type = excluded.type,
  department = excluded.department,
  position = excluded.position,
  company = excluded.company,
  id_card = excluded.id_card,
  phone = excluded.phone,
  location_zone = excluded.location_zone,
  status = excluded.status,
  risk_level = excluded.risk_level,
  access_status = excluded.access_status,
  last_active_time = excluded.last_active_time,
  safety_tag = excluded.safety_tag,
  training_status = excluded.training_status,
  training_score = excluded.training_score,
  last_training_time = excluded.last_training_time,
  certificate_status = excluded.certificate_status,
  health_status = excluded.health_status,
  health_risk_level = excluded.health_risk_level,
  last_medical_check = excluded.last_medical_check,
  occupational_disease_flag = excluded.occupational_disease_flag,
  exposure_level = excluded.exposure_level,
  performance_score = excluded.performance_score,
  violation_count = excluded.violation_count,
  reward_count = excluded.reward_count,
  near_miss_count = excluded.near_miss_count,
  safety_score = excluded.safety_score,
  remark = excluded.remark;

with enabled_area as (
  select
    area.id,
    area.name,
    row_number() over (order by area.create_time, area.id)::integer as area_order,
    count(*) over ()::integer as area_count
  from public.area area
  where area.enable is not false
),
seeded_person as (
  select
    person.id,
    person.device_id,
    row_number() over (order by person.id)::integer as person_order
  from public.person person
  where person.id ~ '^person-(00[1-9]|0[1-4][0-9]|050)$'
),
person_area as (
  select
    person.id as person_id,
    coalesce(bound_area.name, fallback_area.name) as area_name
  from seeded_person person
  left join public.device bound_device on bound_device.id = person.device_id
  left join enabled_area bound_area on bound_area.id = bound_device.region_id
  join enabled_area fallback_area
    on fallback_area.area_order = ((person.person_order - 1) % fallback_area.area_count) + 1
)
update public.person person
set location_zone = mapping.area_name
from person_area mapping
where person.id = mapping.person_id;

insert into public.device_realtime (
  device_id, status, battery, signal_strength, cpu_usage, temperature, last_heartbeat, health_score
) values
  ('dev-uwb-bs-a01', 'online', null, 92.0, 18.0, 36.8, '2026-07-10 10:59:30+08', 96.0),
  ('dev-uwb-tag-p001', 'online', 86.0, 78.0, null, 31.2, '2026-07-10 10:59:40+08', 91.0),
  ('dev-uwb-tag-p002', 'online', 64.0, 66.0, null, 32.5, '2026-07-10 10:58:58+08', 83.0),
  ('dev-camera-a01', 'online', null, 88.0, 42.0, 43.3, '2026-07-10 10:59:18+08', 89.0),
  ('dev-camera-b02', 'fault', null, 35.0, 71.0, 51.6, '2026-07-10 10:46:22+08', 58.0),
  ('dev-gas-a01', 'online', null, 81.0, 12.0, 34.1, '2026-07-10 10:59:12+08', 94.0),
  ('dev-pump-c01', 'maintenance', null, 74.0, 22.0, 58.0, '2026-07-10 10:52:10+08', 72.0),
  ('dev-meter-c01', 'online', null, 83.0, 8.0, 39.2, '2026-07-10 10:59:05+08', 90.0)
on conflict (device_id) do update set
  status = excluded.status,
  battery = excluded.battery,
  signal_strength = excluded.signal_strength,
  cpu_usage = excluded.cpu_usage,
  temperature = excluded.temperature,
  last_heartbeat = excluded.last_heartbeat,
  health_score = excluded.health_score;

insert into public.device_realtime (
  device_id, status, battery, signal_strength, cpu_usage, temperature, last_heartbeat, health_score
) values
  ('dev-uwb-tag-p009', 'online', 82.0, 76.0, null, 31.0, now() - interval '20 seconds', 90.0),
  ('dev-uwb-tag-p010', 'online', 71.0, 69.0, null, 32.1, now() - interval '35 seconds', 86.0),
  ('dev-camera-c03', 'online', null, 84.0, 38.0, 42.5, now() - interval '18 seconds', 91.0),
  ('dev-camera-office01', 'online', null, 90.0, 31.0, 38.2, now() - interval '12 seconds', 95.0),
  ('dev-gas-b02', 'alarm', null, 72.0, 15.0, 35.6, now() - interval '25 seconds', 75.0),
  ('dev-temp-c01', 'online', null, 79.0, 9.0, 41.8, now() - interval '22 seconds', 88.0),
  ('dev-access-b01', 'offline', null, 0.0, 0.0, 33.0, now() - interval '18 minutes', 52.0),
  ('dev-drone-a01', 'maintenance', 45.0, 61.0, 28.0, 37.4, now() - interval '4 minutes', 68.0)
on conflict (device_id) do update set
  status = excluded.status,
  battery = excluded.battery,
  signal_strength = excluded.signal_strength,
  cpu_usage = excluded.cpu_usage,
  temperature = excluded.temperature,
  last_heartbeat = excluded.last_heartbeat,
  health_score = excluded.health_score;

insert into public.device_maintenance (
  device_id, maintainer_id, department, maintenance_level, inspect_cycle_days,
  last_inspect_time, next_inspect_time, last_repair_time, repair_count,
  maintenance_status, remark
) values
  ('dev-camera-a01', 'person-005', '设备部', '二级', 7, '2026-07-06 09:00:00+08', '2026-07-13 09:00:00+08', null, 0, '正常', '防爆摄像头例行巡检'),
  ('dev-camera-b02', 'person-005', '设备部', '二级', 7, '2026-07-03 09:00:00+08', '2026-07-10 09:00:00+08', '2026-07-10 10:30:00+08', 1, '维修中', '视频流异常，待更换网口模块'),
  ('dev-pump-c01', 'person-005', '设备部', '一级', 3, '2026-07-09 08:30:00+08', '2026-07-12 08:30:00+08', '2026-06-30 15:00:00+08', 2, '维修中', '泵体温升偏高'),
  ('dev-meter-c01', 'person-006', '仪表部', '普通', 15, '2026-07-01 10:00:00+08', '2026-07-16 10:00:00+08', null, 0, '正常', '压力仪表巡检正常')
on conflict (device_id) do update set
  maintainer_id = excluded.maintainer_id,
  department = excluded.department,
  maintenance_level = excluded.maintenance_level,
  inspect_cycle_days = excluded.inspect_cycle_days,
  last_inspect_time = excluded.last_inspect_time,
  next_inspect_time = excluded.next_inspect_time,
  last_repair_time = excluded.last_repair_time,
  repair_count = excluded.repair_count,
  maintenance_status = excluded.maintenance_status,
  remark = excluded.remark;

insert into public.device_compliance (
  device_id, inspection_required, inspection_type, inspection_cycle_months,
  last_inspection_time, next_inspection_time, inspection_status,
  inspection_agency, certificate_no, risk_level
) values
  ('dev-camera-a01', true, '法检', 12, '2026-01-16 09:00:00+08', '2027-01-16 09:00:00+08', 'pass', '华东防爆检测中心', 'FB-CAM-A01-2026', '中风险'),
  ('dev-gas-a01', true, '法检', 6, '2026-04-01 09:00:00+08', '2026-10-01 09:00:00+08', 'pass', '华东计量检测院', 'GAS-A01-2026', '高风险'),
  ('dev-pump-c01', true, '自检', 3, '2026-06-30 09:00:00+08', '2026-09-30 09:00:00+08', 'pending', '厂内设备部', 'PUMP-C01-SELF-2026', '中风险'),
  ('dev-meter-c01', true, '法检', 12, '2026-02-15 09:00:00+08', '2027-02-15 09:00:00+08', 'pass', '华东计量检测院', 'METER-C01-2026', '低风险')
on conflict (device_id) do update set
  inspection_required = excluded.inspection_required,
  inspection_type = excluded.inspection_type,
  inspection_cycle_months = excluded.inspection_cycle_months,
  last_inspection_time = excluded.last_inspection_time,
  next_inspection_time = excluded.next_inspection_time,
  inspection_status = excluded.inspection_status,
  inspection_agency = excluded.inspection_agency,
  certificate_no = excluded.certificate_no,
  risk_level = excluded.risk_level;

-- 旧版固定区域告警和位置仅保留为历史样例，不再参与任何 seed 执行。
do $legacy_fixed_space_seed$
begin
if false then
insert into public.alarm (
  id, type, level, location, "time", status, person_id, device_id,
  confidence, description, evidence
) values
  (
    'alarm-001',
    '越界',
    '严重',
    '{"area_id": "area-tank-a", "x": 252.0, "y": 198.0}'::jsonb,
    '2026-07-10 10:21:35+08',
    '处理中',
    'person-007',
    'dev-camera-a01',
    0.93,
    '人员进入A区储罐高风险边界附近',
    '{"images": ["mock://evidence/alarm-001.jpg"], "video": "mock://evidence/alarm-001.mp4"}'::jsonb
  ),
  (
    'alarm-002',
    '设备异常',
    '一般',
    '{"area_id": "area-loading-b", "x": 365.0, "y": 122.0}'::jsonb,
    '2026-07-10 10:46:22+08',
    '新建',
    null,
    'dev-camera-b02',
    0.88,
    'B区装卸摄像头视频流异常',
    '{"sensor": {"signal_strength": 35, "temperature": 51.6}}'::jsonb
  ),
  (
    'alarm-003',
    '跌倒',
    '重大',
    '{"area_id": "area-loading-b", "x": 338.4, "y": 171.8}'::jsonb,
    '2026-07-10 10:39:10+08',
    '确认',
    'person-003',
    'dev-camera-b02',
    0.91,
    'AI识别到承包商疑似跌倒',
    '{"images": ["mock://evidence/alarm-003.jpg"], "model": "fall-detection-v1"}'::jsonb
  ),
  (
    'alarm-004',
    '识别异常',
    '一般',
    '{"area_id": "area-office", "x": 72.0, "y": 88.0}'::jsonb,
    '2026-07-10 09:58:04+08',
    '误报',
    'person-004',
    null,
    0.62,
    '访客证件识别置信度偏低，人工复核为误报',
    '{"model": "badge-ocr-v1", "reviewer": "person-002"}'::jsonb
  ),
  (
    'alarm-005',
    '设备异常',
    '严重',
    '{"area_id": "area-pump-c", "x": 545.0, "y": 342.0}'::jsonb,
    '2026-07-10 10:52:10+08',
    '处理中',
    null,
    'dev-pump-c01',
    0.86,
    'C区循环泵温度偏高并进入维修状态',
    '{"sensor": {"temperature": 58.0, "health_score": 72}}'::jsonb
  ),
  (
    'alarm-006',
    '离线',
    '一般',
    '{"area_id": "area-loading-b", "x": 390.0, "y": 220.0}'::jsonb,
    '2026-07-10 09:40:00+08',
    '关闭',
    'person-008',
    null,
    null,
    '承包商定位信号离线超过阈值，已人工确认离场',
    '{"source": "uwb", "last_active_time": "2026-07-10T09:35:00+08:00"}'::jsonb
  )
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

insert into public.position (
  id, person_id, x, y, z, source, confidence, "timestamp", speed, direction
) values
  ('pos-001', 'person-001', 66.0, 70.0, 1.2, 'UWB', 0.96, '2026-07-10 10:45:00+08', 0.8, 45.0),
  ('pos-002', 'person-001', 82.0, 92.0, 1.2, 'UWB', 0.95, '2026-07-10 10:50:00+08', 1.1, 55.0),
  ('pos-003', 'person-001', 122.0, 118.0, 1.2, 'UWB', 0.94, '2026-07-10 10:55:00+08', 1.4, 63.0),
  ('pos-004', 'person-003', 330.0, 160.0, 1.2, 'UWB', 0.89, '2026-07-10 10:30:00+08', 0.6, 12.0),
  ('pos-005', 'person-003', 338.4, 171.8, 1.2, '视觉融合', 0.91, '2026-07-10 10:39:10+08', 0.0, 0.0),
  ('pos-006', 'person-003', 341.0, 173.2, 1.2, 'UWB', 0.82, '2026-07-10 10:42:00+08', 0.2, 5.0),
  ('pos-007', 'person-004', 72.0, 88.0, 1.0, '视觉融合', 0.73, '2026-07-10 09:58:04+08', 0.3, 180.0),
  ('pos-008', 'person-005', 545.0, 342.0, 0.0, '北斗', 0.87, '2026-07-10 10:50:00+08', 0.9, 270.0),
  ('pos-009', 'person-005', 552.0, 348.0, 0.0, '北斗', 0.88, '2026-07-10 10:53:00+08', 0.5, 300.0),
  ('pos-010', 'person-006', 552.0, 350.0, 1.4, '北斗', 0.86, '2026-07-10 10:49:00+08', 0.4, 120.0),
  ('pos-011', 'person-007', 240.0, 190.0, 1.1, 'UWB', 0.90, '2026-07-10 10:15:00+08', 1.0, 35.0),
  ('pos-012', 'person-007', 252.0, 198.0, 1.1, '视觉融合', 0.93, '2026-07-10 10:21:35+08', 0.2, 20.0),
  ('pos-013', 'person-007', 248.0, 192.0, 1.1, 'UWB', 0.89, '2026-07-10 10:25:00+08', 0.4, 210.0),
  ('pos-014', 'person-008', 390.0, 220.0, 1.1, 'UWB', 0.74, '2026-07-10 09:35:00+08', 0.0, 0.0),
  ('pos-015', 'person-002', 190.0, 145.0, 0.0, '北斗', 0.92, '2026-07-10 10:58:00+08', 0.7, 80.0),
  ('pos-016', 'person-002', 205.0, 150.0, 0.0, '北斗', 0.91, '2026-07-10 10:59:00+08', 0.6, 82.0)
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
end if;
end;
$legacy_fixed_space_seed$;
