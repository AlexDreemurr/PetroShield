-- 一次性远端数据回填：把 person 当前健康快照提取为每人第一条健康观测。
-- 可在新迁移应用完成后，通过 Supabase SQL Editor 单独执行。

begin;

insert into public.person_health_observation (
  id,
  person_id,
  observation_time,
  health_status,
  health_risk_level,
  last_medical_check,
  occupational_disease_flag,
  exposure_level,
  location_zone
)
select
  'health-initial-' || p.id,
  p.id,
  now(),
  p.health_status,
  p.health_risk_level,
  p.last_medical_check,
  p.occupational_disease_flag,
  p.exposure_level,
  p.location_zone
from public.person p
where p.health_status is not null
   or p.health_risk_level is not null
   or p.last_medical_check is not null
   or p.occupational_disease_flag is not null
   or p.exposure_level is not null
on conflict (id) do nothing;

commit;

select
  count(*) as observation_count,
  count(distinct person_id) as person_count
from public.person_health_observation
where id like 'health-initial-%';
