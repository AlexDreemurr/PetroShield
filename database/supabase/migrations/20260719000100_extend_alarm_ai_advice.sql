alter table public.alarm_ai_advice
  add column if not exists structured_content jsonb,
  add column if not exists model text,
  add column if not exists generation_status text not null default 'completed',
  add column if not exists error_message text,
  add column if not exists provider_request_id text,
  add column if not exists usage jsonb not null default '{}'::jsonb,
  add column if not exists latency_ms integer,
  add column if not exists prompt_version text;

alter table public.alarm_ai_advice
  drop constraint if exists alarm_ai_advice_generation_status_check;

alter table public.alarm_ai_advice
  add constraint alarm_ai_advice_generation_status_check
  check (generation_status in ('completed', 'fallback'));

comment on column public.alarm_ai_advice.structured_content is '模型返回并经后端校验的结构化处置流程';
comment on column public.alarm_ai_advice.generation_status is 'completed 表示模型生成成功，fallback 表示已降级为规则建议';
comment on column public.alarm_ai_advice.error_message is '模型调用失败原因，不包含 API Key';
comment on column public.alarm_ai_advice.usage is '模型服务返回的 token 使用量等审计信息';
