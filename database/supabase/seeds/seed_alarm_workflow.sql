-- 为滚动 7 天告警补齐闭环演示数据；只重建 seed_alarms.sql 生成的告警关联记录。
delete from public.alarm_action_log log
using public.alarm alarm
where log.alarm_id = alarm.id
  and alarm.evidence ->> 'seed_source' = 'seed_alarms.sql';

delete from public.alarm_ai_advice advice
using public.alarm alarm
where advice.alarm_id = alarm.id
  and alarm.evidence ->> 'seed_source' = 'seed_alarms.sql';

delete from public.alarm_assignment assignment
using public.alarm alarm
where assignment.alarm_id = alarm.id
  and alarm.evidence ->> 'seed_source' = 'seed_alarms.sql';

insert into public.alarm_action_log (
  id, alarm_id, action, from_status, to_status, operator_name,
  operator_role, comment, create_time
)
select
  alarm.id || '-created', alarm.id, 'create', null, '新建', '系统',
  '告警引擎', '多源融合规则自动生成告警', alarm."time"
from public.alarm alarm
where alarm.evidence ->> 'seed_source' = 'seed_alarms.sql';

insert into public.alarm_action_log (
  id, alarm_id, action, from_status, to_status, operator_name,
  operator_role, comment, create_time
)
select
  alarm.id || '-confirmed', alarm.id, 'confirm', '新建', '确认', '张三',
  '运营管理员', '已核对人员、设备及现场证据，确认告警有效',
  alarm."time" + interval '4 minutes'
from public.alarm alarm
where alarm.evidence ->> 'seed_source' = 'seed_alarms.sql'
  and alarm.status in ('确认', '处理中', '待复核', '关闭');

insert into public.alarm_ai_advice (
  id, alarm_id, content, source, generated_at, adopted
)
select
  alarm.id || '-advice', alarm.id,
  case alarm.type
    when '越界' then '立即通知人员撤离限制区域，核验作业许可，并调取邻近摄像头确认现场状态。'
    when '跌倒' then '优先确认人员意识与生命体征，派遣就近救援力量，并保持视频通道畅通。'
    when '设备异常' then '隔离异常设备影响范围，核对实时测点和最近维护记录，安排专业人员现场复核。'
    when '离线' then '联系人员或现场负责人确认安全状态，检查定位标签电量、信号和绑定关系。'
    else '复核告警证据和关联资源，根据风险等级组织现场确认并保留处置记录。'
  end,
  'rule-assisted', alarm."time" + interval '4 minutes 5 seconds', false
from public.alarm alarm
where alarm.evidence ->> 'seed_source' = 'seed_alarms.sql'
  and alarm.status in ('确认', '处理中', '待复核', '关闭');

insert into public.alarm_assignment (
  id, alarm_id, assignee_id, department, priority, instruction, due_time,
  status, assigned_by, assigned_at, accepted_at, completed_at,
  feedback, feedback_evidence
)
select
  alarm.id || '-assignment', alarm.id,
  case when alarm.type = '设备异常' then 'person-005' else 'person-002' end,
  case when alarm.type = '设备异常' then '设备部' else 'HSE部' end,
  case when alarm.level = '重大' then 'urgent' when alarm.level = '严重' then 'high' else 'medium' end,
  '到场核实告警，控制风险并反馈现场处置结果',
  alarm."time" + interval '40 minutes',
  case when alarm.status in ('待复核', '关闭') then 'completed' else 'accepted' end,
  '张三', alarm."time" + interval '7 minutes', alarm."time" + interval '9 minutes',
  case when alarm.status in ('待复核', '关闭') then alarm."time" + interval '24 minutes' end,
  case when alarm.status in ('待复核', '关闭') then '现场风险已解除，关联人员和设备状态恢复正常' end,
  case when alarm.status in ('待复核', '关闭') then '[{"type":"text","name":"现场处置记录"}]'::jsonb else '[]'::jsonb end
from public.alarm alarm
where alarm.evidence ->> 'seed_source' = 'seed_alarms.sql'
  and alarm.status in ('处理中', '待复核', '关闭');

insert into public.alarm_action_log (
  id, alarm_id, action, from_status, to_status, operator_name,
  operator_role, comment, create_time
)
select
  alarm.id || '-feedback', alarm.id, 'submit_feedback', '处理中', '待复核',
  case when alarm.type = '设备异常' then '陈磊' else '李娜' end,
  '现场处置人员', '现场风险已解除，提交处置记录等待复核',
  alarm."time" + interval '24 minutes'
from public.alarm alarm
where alarm.evidence ->> 'seed_source' = 'seed_alarms.sql'
  and alarm.status in ('待复核', '关闭');

insert into public.alarm_action_log (
  id, alarm_id, action, from_status, to_status, operator_name,
  operator_role, comment, create_time
)
select
  alarm.id || '-dispatched', alarm.id, 'dispatch', '确认', '处理中', '张三',
  '运营管理员', '已派发现场处置任务', alarm."time" + interval '7 minutes'
from public.alarm alarm
where alarm.evidence ->> 'seed_source' = 'seed_alarms.sql'
  and alarm.status in ('处理中', '待复核', '关闭');

insert into public.alarm_action_log (
  id, alarm_id, action, from_status, to_status, operator_name,
  operator_role, comment, create_time
)
select
  alarm.id || '-closed', alarm.id, 'review_approve', '待复核', '关闭', '张三',
  '运营管理员', '复核通过，事件闭环', alarm."time" + interval '28 minutes'
from public.alarm alarm
where alarm.evidence ->> 'seed_source' = 'seed_alarms.sql'
  and alarm.status = '关闭';
