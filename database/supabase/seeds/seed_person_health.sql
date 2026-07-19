-- 最近 7 天人员健康观测模拟数据。
-- 依赖 seed.sql 中的 person-001 至 person-050，并可重复执行。

do $$
begin
  if (
    select count(*)
    from public.person
    where id ~ '^person-(00[1-9]|0[1-4][0-9]|050)$'
  ) <> 50 then
    raise exception 'seed_person_health.sql 依赖 seed.sql 中的 person-001 至 person-050，请先执行 seed.sql';
  end if;
end;
$$;

create temporary table seed_person_health_snapshot as
select
  id,
  health_status,
  health_risk_level,
  last_medical_check,
  occupational_disease_flag,
  exposure_level,
  location_zone
from public.person
where id ~ '^person-(00[1-9]|0[1-4][0-9]|050)$';

-- 固定 day_offset ID 的日期会随执行日移动；先清理上一批，避免与
-- unique(person_id, observation_time) 在刷新过程中产生临时冲突。
delete from public.person_health_observation
where id like 'health-seed-%';

with seeded_person(person_id, person_order) as (
  select
    id,
    row_number() over (order by id)::integer
  from seed_person_health_snapshot
),
seed_clock as (
  select
    coalesce(
      nullif(current_setting('petroshield.seed_anchor_date', true), '')::date,
      (now() at time zone 'Asia/Shanghai')::date
    ) as anchor_date
),
clock as (
  select
    anchor_date,
    case
      when anchor_date = (now() at time zone 'Asia/Shanghai')::date then now()
      else (anchor_date::timestamp + time '18:00:00') at time zone 'Asia/Shanghai'
    end as seed_now
  from seed_clock
),
day_offset as (
  select generate_series(0, 6) as value
),
health_samples as (
  select
    p.id as person_id,
    sp.person_order,
    d.value as day_offset,
    case
      when d.value = 0 then c.seed_now - make_interval(secs => sp.person_order)
      else (
        c.anchor_date::timestamp
        - make_interval(days => d.value)
        + time '06:00:00'
        + make_interval(mins => sp.person_order * 12)
      ) at time zone 'Asia/Shanghai'
    end as observation_time,
    case
      when d.value = 0 then p.health_status
      when (sp.person_order + d.value) % 9 = 0 then '限制'
      when (sp.person_order + d.value) % 4 = 0 then '关注'
      else '正常'
    end as health_status,
    case
      when d.value = 0 then p.health_risk_level
      when (sp.person_order + d.value) % 9 = 0 then '高'
      when (sp.person_order + d.value) % 4 = 0 then '中'
      else '低'
    end as health_risk_level,
    p.last_medical_check,
    p.occupational_disease_flag,
    p.exposure_level,
    p.location_zone
  from seeded_person sp
  join seed_person_health_snapshot p on p.id = sp.person_id
  cross join day_offset d
  cross join clock c
)
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
  format('health-seed-%s-d%s', person_id, day_offset),
  person_id,
  observation_time,
  health_status,
  health_risk_level,
  last_medical_check,
  occupational_disease_flag,
  exposure_level,
  location_zone
from health_samples
on conflict (id) do update set
  observation_time = excluded.observation_time,
  health_status = excluded.health_status,
  health_risk_level = excluded.health_risk_level,
  last_medical_check = excluded.last_medical_check,
  occupational_disease_flag = excluded.occupational_disease_flag,
  exposure_level = excluded.exposure_level,
  location_zone = excluded.location_zone;

drop table seed_person_health_snapshot;

select
  (observation_time at time zone 'Asia/Shanghai')::date as observation_date,
  health_risk_level,
  count(*) as observation_count
from public.person_health_observation
where id like 'health-seed-%'
group by 1, 2
order by 1, 2;

-- 如需删除本文件生成的模拟健康观测，可单独执行：
-- delete from public.person_health_observation where id like 'health-seed-%';
