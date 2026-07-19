create table public.device_maintenance_record (
  id text primary key default extensions.gen_random_uuid()::text,
  device_id text not null references public.device(id) on update cascade on delete cascade,
  maintenance_type text not null,
  content text not null,
  result text,
  status text not null default 'completed',
  maintainer_id text references public.person(id) on update cascade on delete set null,
  department text,
  started_at timestamptz not null,
  completed_at timestamptz,
  next_due_at timestamptz,
  remark text,
  seed_source text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint device_maintenance_record_status_check
    check (status in ('scheduled', 'in_progress', 'completed', 'cancelled')),
  constraint device_maintenance_record_time_check
    check (completed_at is null or completed_at >= started_at)
);

comment on table public.device_maintenance_record is '设备巡检、保养、维修和校准的历史明细';
comment on column public.device_maintenance_record.maintenance_type is '巡检/保养/维修/校准';
comment on column public.device_maintenance_record.content is '本次维护工作内容';
comment on column public.device_maintenance_record.result is '维护结果或检查结论';
comment on column public.device_maintenance_record.status is 'scheduled/in_progress/completed/cancelled';
comment on column public.device_maintenance_record.seed_source is '模拟数据来源，真实记录为空';

create index idx_device_maintenance_record_device_time
on public.device_maintenance_record(device_id, started_at desc);

create trigger trg_device_maintenance_record_set_updated_at
before update on public.device_maintenance_record
for each row execute function public.set_updated_at();
