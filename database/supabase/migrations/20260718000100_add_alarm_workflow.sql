create table public.alarm_assignment (
  id text primary key default extensions.gen_random_uuid()::text,
  alarm_id text not null references public.alarm(id) on update cascade on delete cascade,
  assignee_id text references public.person(id) on update cascade on delete set null,
  department text,
  priority text not null default 'medium',
  instruction text not null,
  due_time timestamptz,
  status text not null default 'assigned',
  assigned_by text not null,
  assigned_at timestamptz not null default now(),
  accepted_at timestamptz,
  completed_at timestamptz,
  feedback text,
  feedback_evidence jsonb not null default '[]'::jsonb,
  constraint alarm_assignment_priority_check
    check (priority in ('low', 'medium', 'high', 'urgent')),
  constraint alarm_assignment_status_check
    check (status in ('assigned', 'accepted', 'completed', 'cancelled'))
);

comment on table public.alarm_assignment is '告警派单与现场处置反馈';

create index idx_alarm_assignment_alarm_time
on public.alarm_assignment(alarm_id, assigned_at desc);

create index idx_alarm_assignment_assignee_status
on public.alarm_assignment(assignee_id, status);

create table public.alarm_ai_advice (
  id text primary key default extensions.gen_random_uuid()::text,
  alarm_id text not null references public.alarm(id) on update cascade on delete cascade,
  content text not null,
  source text not null default 'rule-assisted',
  generated_at timestamptz not null default now(),
  adopted boolean not null default false,
  edited_content text
);

comment on table public.alarm_ai_advice is '告警确认后生成的辅助处置建议';

create index idx_alarm_ai_advice_alarm_time
on public.alarm_ai_advice(alarm_id, generated_at desc);

create table public.alarm_action_log (
  id text primary key default extensions.gen_random_uuid()::text,
  alarm_id text not null references public.alarm(id) on update cascade on delete cascade,
  action text not null,
  from_status text,
  to_status text,
  operator_name text not null,
  operator_role text,
  comment text,
  metadata jsonb not null default '{}'::jsonb,
  create_time timestamptz not null default now()
);

comment on table public.alarm_action_log is '告警全生命周期操作审计记录';

create index idx_alarm_action_log_alarm_time
on public.alarm_action_log(alarm_id, create_time asc);

