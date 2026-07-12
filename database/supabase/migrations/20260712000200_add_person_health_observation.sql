create table public.person_health_observation (
  id text primary key default extensions.gen_random_uuid()::text,
  person_id text not null references public.person(id) on update cascade on delete cascade,
  observation_time timestamptz not null,
  health_status text,
  health_risk_level text,
  last_medical_check timestamptz,
  occupational_disease_flag boolean,
  exposure_level text,
  location_zone text,
  create_time timestamptz not null default now(),
  update_time timestamptz not null default now(),
  constraint person_health_observation_person_time_unique
    unique (person_id, observation_time)
);

comment on table public.person_health_observation is '保存人员健康字段的历史观测版本，person 表保存最新健康快照';
comment on column public.person_health_observation.id is '健康观测唯一标识';
comment on column public.person_health_observation.person_id is '关联人员ID';
comment on column public.person_health_observation.observation_time is '该份健康观测的记录或生效时间';
comment on column public.person_health_observation.health_status is '健康状态，与 person.health_status 含义一致';
comment on column public.person_health_observation.health_risk_level is '职业健康风险等级，与 person.health_risk_level 含义一致';
comment on column public.person_health_observation.last_medical_check is '最近体检时间，与 person.last_medical_check 含义一致';
comment on column public.person_health_observation.occupational_disease_flag is '是否职业病风险人员，与 person.occupational_disease_flag 含义一致';
comment on column public.person_health_observation.exposure_level is '暴露等级，与 person.exposure_level 含义一致';
comment on column public.person_health_observation.location_zone is '观测发生时人员所在区域快照，与 person.location_zone 使用相同值域';
comment on column public.person_health_observation.create_time is '记录创建时间';
comment on column public.person_health_observation.update_time is '记录更新时间';

create index idx_person_health_observation_person_time
on public.person_health_observation(person_id, observation_time desc);

create index idx_person_health_observation_time_zone
on public.person_health_observation(observation_time desc, location_zone);

create trigger trg_person_health_observation_set_update_time
before update on public.person_health_observation
for each row execute function public.set_update_time();

create or replace function public.sync_person_health_snapshot(target_person_id text)
returns void
language plpgsql
set search_path = public
as $$
declare
  latest_observation public.person_health_observation%rowtype;
begin
  select *
  into latest_observation
  from public.person_health_observation
  where person_id = target_person_id
  order by observation_time desc, create_time desc, id desc
  limit 1;

  if found then
    update public.person
    set
      health_status = latest_observation.health_status,
      health_risk_level = latest_observation.health_risk_level,
      last_medical_check = latest_observation.last_medical_check,
      occupational_disease_flag = latest_observation.occupational_disease_flag,
      exposure_level = latest_observation.exposure_level
    where id = target_person_id;
  else
    update public.person
    set
      health_status = null,
      health_risk_level = null,
      last_medical_check = null,
      occupational_disease_flag = null,
      exposure_level = null
    where id = target_person_id;
  end if;
end;
$$;

comment on function public.sync_person_health_snapshot(text) is '将人员最新一条健康观测同步到 person 健康快照字段';

create or replace function public.handle_person_health_observation_change()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if tg_op = 'DELETE' then
    perform public.sync_person_health_snapshot(old.person_id);
    return old;
  end if;

  if tg_op = 'UPDATE' and old.person_id is distinct from new.person_id then
    perform public.sync_person_health_snapshot(old.person_id);
  end if;

  perform public.sync_person_health_snapshot(new.person_id);
  return new;
end;
$$;

create trigger trg_person_health_observation_sync_person
after insert or update or delete on public.person_health_observation
for each row execute function public.handle_person_health_observation_change();
