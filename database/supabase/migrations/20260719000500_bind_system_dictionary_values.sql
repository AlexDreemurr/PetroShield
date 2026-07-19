alter table public.system_dictionary_item
add column business_value text;

update public.system_dictionary_item item
set business_value = mapping.business_value
from (values
  ('dict-group-alarm-type', 'AREA_INTRUSION', '越界'),
  ('dict-group-alarm-type', 'PPE_MISSING', '未佩戴安全帽'),
  ('dict-group-alarm-type', 'DEVICE_OFFLINE', '离线'),
  ('dict-group-risk-level', 'SEVERE', '严重'),
  ('dict-group-risk-level', 'MEDIUM', '中等'),
  ('dict-group-risk-level', 'GENERAL', '一般'),
  ('dict-group-person-type', 'EMPLOYEE', '员工'),
  ('dict-group-person-type', 'CONTRACTOR', '承包商'),
  ('dict-group-person-type', 'VISITOR', '访客'),
  ('dict-group-device-type', 'CAMERA', '摄像头'),
  ('dict-group-device-type', 'SENSOR', '气体探测器'),
  ('dict-group-device-type', 'ACCESS', '门禁'),
  ('dict-group-area-type', 'DANGER', 'danger'),
  ('dict-group-area-type', 'RESTRICTED', 'restricted'),
  ('dict-group-area-type', 'NORMAL', 'normal')
) as mapping(group_id, code, business_value)
where item.group_id = mapping.group_id and item.code = mapping.code;

update public.system_dictionary_item
set business_value = code
where business_value is null;

alter table public.system_dictionary_item
alter column business_value set not null;

alter table public.system_dictionary_item
add constraint system_dictionary_item_group_value_unique
unique (group_id, business_value);

comment on column public.system_dictionary_item.business_value is
  '业务表或 API 中实际存储的稳定值；显示名称与颜色可独立修改';

insert into public.system_dictionary_group (
  id, code, name, description, sort_order
) values
  ('dict-group-area-risk-level', 'area_risk_level', '区域风险等级', '风险区域接口使用的 low/medium/high 等级', 25),
  ('dict-group-device-status', 'device_status', '设备运行状态', '设备实时状态及地图标记', 45)
on conflict (code) do nothing;

insert into public.system_dictionary_item (
  id, group_id, code, business_value, name, color, sort_order, status, remark
) values
  ('dict-alarm-device-abnormal', 'dict-group-alarm-type', 'DEVICE_ABNORMAL', '设备异常', '设备异常', '#f97316', 25, 'active', '设备运行参数或状态异常'),
  ('dict-alarm-ai-review', 'dict-group-alarm-type', 'AI_REVIEW', '识别异常', '识别异常', '#f59e0b', 30, 'active', '视频 AI 识别结果需要人工复核'),
  ('dict-alarm-person-fall', 'dict-group-alarm-type', 'PERSON_FALL', '跌倒', '人员跌倒', '#dc2626', 40, 'active', '识别到人员疑似跌倒'),
  ('dict-risk-critical', 'dict-group-risk-level', 'CRITICAL', '重大', '重大', '#991b1b', 5, 'active', '立即升级上报并启动应急响应'),
  ('dict-area-risk-low', 'dict-group-area-risk-level', 'LOW', 'low', '低风险', '#22c55e', 10, 'active', '常规巡检与监控'),
  ('dict-area-risk-medium', 'dict-group-area-risk-level', 'MEDIUM', 'medium', '中风险', '#f59e0b', 20, 'active', '加强巡检并限制停留'),
  ('dict-area-risk-high', 'dict-group-area-risk-level', 'HIGH', 'high', '高风险', '#dc2626', 30, 'active', '严格准入并重点监控'),
  ('dict-device-uwb', 'dict-group-device-type', 'UWB', 'UWB', 'UWB 定位设备', '#2563eb', 5, 'active', '定位基站和人员标签'),
  ('dict-device-pump', 'dict-group-device-type', 'PUMP', '泵', '泵设备', '#0ea5e9', 30, 'active', '生产泵类设备'),
  ('dict-device-meter', 'dict-group-device-type', 'METER', '仪表', '仪表设备', '#8b5cf6', 40, 'active', '压力及工艺仪表'),
  ('dict-device-temperature', 'dict-group-device-type', 'TEMPERATURE', '温度传感器', '温度传感器', '#ef4444', 50, 'active', '温度采集设备'),
  ('dict-device-drone', 'dict-group-device-type', 'DRONE', '无人机', '巡检无人机', '#06b6d4', 60, 'active', '移动巡检设备'),
  ('dict-area-prohibited', 'dict-group-area-type', 'PROHIBITED', 'prohibited', '禁入区域', '#7f1d1d', 25, 'active', '未经专项授权禁止进入'),
  ('dict-device-status-online', 'dict-group-device-status', 'ONLINE', 'online', '在线', '#10b981', 10, 'active', '心跳和数据上报正常'),
  ('dict-device-status-offline', 'dict-group-device-status', 'OFFLINE', 'offline', '离线', '#64748b', 20, 'active', '设备心跳超时'),
  ('dict-device-status-alarm', 'dict-group-device-status', 'ALARM', 'alarm', '告警', '#f97316', 30, 'active', '设备存在活动告警'),
  ('dict-device-status-fault', 'dict-group-device-status', 'FAULT', 'fault', '故障', '#dc2626', 40, 'active', '设备发生故障'),
  ('dict-device-status-maintenance', 'dict-group-device-status', 'MAINTENANCE', 'maintenance', '维护中', '#8b5cf6', 50, 'active', '设备处于维护状态')
on conflict (group_id, code) do nothing;

update public.system_dictionary_item
set status = 'active'
where id = 'dict-area-normal';
