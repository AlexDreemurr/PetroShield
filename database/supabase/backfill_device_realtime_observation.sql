-- 一次性远端回填：把 device_realtime 当前快照保存为第一条历史观测。
begin;

insert into public.device_realtime_observation (
  id, device_id, observation_time, status, battery, signal_strength,
  cpu_usage, temperature, last_heartbeat, health_score
)
select
  'device-status-initial-' || dr.device_id,
  dr.device_id,
  dr.updated_at,
  dr.status,
  dr.battery,
  dr.signal_strength,
  dr.cpu_usage,
  dr.temperature,
  dr.last_heartbeat,
  dr.health_score
from public.device_realtime dr
on conflict (id) do nothing;

commit;

select count(*) as observation_count
from public.device_realtime_observation
where id like 'device-status-initial-%';
