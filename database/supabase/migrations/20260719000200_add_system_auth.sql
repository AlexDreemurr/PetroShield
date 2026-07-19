create table public.system_permission (
  code text primary key,
  module text not null,
  action text not null,
  name text not null,
  description text,
  sort_order integer not null default 0
);

create table public.system_role (
  id text primary key default extensions.gen_random_uuid()::text,
  name text not null unique,
  description text,
  is_system boolean not null default false,
  enabled boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger trg_system_role_set_updated_at
before update on public.system_role
for each row execute function public.set_updated_at();

create table public.system_role_permission (
  role_id text not null references public.system_role(id) on update cascade on delete cascade,
  permission_code text not null references public.system_permission(code) on update cascade on delete cascade,
  primary key (role_id, permission_code)
);

create table public.system_user (
  id text primary key default extensions.gen_random_uuid()::text,
  username text not null unique,
  password_hash text not null,
  display_name text not null,
  department text,
  role_id text not null references public.system_role(id) on update cascade on delete restrict,
  status text not null default 'active',
  last_login_at timestamptz,
  password_changed_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint system_user_username_format check (username ~ '^[A-Za-z][A-Za-z0-9._-]{2,39}$'),
  constraint system_user_status_check check (status in ('active', 'disabled'))
);

create trigger trg_system_user_set_updated_at
before update on public.system_user
for each row execute function public.set_updated_at();

create table public.system_operation_log (
  id text primary key default extensions.gen_random_uuid()::text,
  user_id text references public.system_user(id) on update cascade on delete set null,
  username text,
  display_name text,
  module text not null,
  action text not null,
  target_type text,
  target_id text,
  result text not null default 'success',
  ip_address text,
  detail text,
  changes jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint system_operation_log_result_check check (result in ('success', 'failure'))
);

create index idx_system_operation_log_created_at on public.system_operation_log(created_at desc);
create index idx_system_operation_log_user_id on public.system_operation_log(user_id, created_at desc);

insert into public.system_permission (code, module, action, name, description, sort_order) values
  ('dashboard.view', 'dashboard', 'view', '查看首页', '查看综合态势首页', 10),
  ('people.view', 'people', 'view', '查看人员', '查看人员列表、位置与轨迹', 20),
  ('people.create', 'people', 'create', '新增人员', '新增人员档案', 21),
  ('people.edit', 'people', 'edit', '编辑人员', '编辑人员档案', 22),
  ('people.export', 'people', 'export', '导出人员', '导出人员数据', 23),
  ('alarms.view', 'alarms', 'view', '查看告警', '查看告警中心', 30),
  ('alarms.confirm', 'alarms', 'confirm', '确认告警', '确认待处理告警', 31),
  ('alarms.dispatch', 'alarms', 'dispatch', '派发告警', '派发现场处置任务', 32),
  ('alarms.close', 'alarms', 'close', '关闭告警', '反馈、复核及关闭告警', 33),
  ('devices.view', 'devices', 'view', '查看设备', '查看设备台账', 40),
  ('devices.create', 'devices', 'create', '新增设备', '新增设备档案', 41),
  ('devices.edit', 'devices', 'edit', '编辑设备', '编辑设备档案', 42),
  ('devices.delete', 'devices', 'delete', '删除设备', '删除设备档案', 43),
  ('risk.view', 'risk', 'view', '查看风险区域', '查看风险区域和规则', 50),
  ('risk.create', 'risk', 'create', '新增风险区域', '创建电子围栏', 51),
  ('risk.edit', 'risk', 'edit', '编辑风险区域', '编辑电子围栏和规则', 52),
  ('risk.delete', 'risk', 'delete', '删除风险区域', '删除电子围栏', 53),
  ('video.view', 'video', 'view', '查看视频AI', '查看视频AI页面', 60),
  ('statistics.view', 'statistics', 'view', '查看统计分析', '查看统计报表', 70),
  ('statistics.export', 'statistics', 'export', '导出统计报表', '导出统计分析数据', 71),
  ('system.users.view', 'system_users', 'view', '查看用户', '查看系统用户', 80),
  ('system.users.create', 'system_users', 'create', '新增用户', '创建登录账号', 81),
  ('system.users.edit', 'system_users', 'edit', '编辑用户', '编辑账号与启停状态', 82),
  ('system.users.reset', 'system_users', 'reset', '重置密码', '重置用户登录密码', 83),
  ('system.roles.view', 'system_roles', 'view', '查看角色', '查看角色及权限', 90),
  ('system.roles.edit', 'system_roles', 'edit', '编辑角色', '创建角色并配置权限', 91),
  ('system.dictionaries.view', 'system_dictionaries', 'view', '查看数据字典', '查看数据字典', 100),
  ('system.dictionaries.edit', 'system_dictionaries', 'edit', '编辑数据字典', '维护数据字典', 101),
  ('system.logs.view', 'system_logs', 'view', '查看操作日志', '查询操作日志', 110),
  ('system.logs.export', 'system_logs', 'export', '导出操作日志', '导出操作日志', 111),
  ('system.api.view', 'system_api', 'view', '查看API配置', '查看API连接配置', 120),
  ('system.api.edit', 'system_api', 'edit', '编辑API配置', '编辑非敏感API参数', 121)
on conflict (code) do update set
  module = excluded.module,
  action = excluded.action,
  name = excluded.name,
  description = excluded.description,
  sort_order = excluded.sort_order;

insert into public.system_role (id, name, description, is_system, enabled) values
  ('role-super-admin', '超级管理员', '拥有平台全部功能与系统配置权限', true, true),
  ('role-safety-admin', '安全管理员', '负责告警处置、风险区域与安全分析', true, true),
  ('role-dispatcher', '值班调度员', '执行日常监控、告警确认及任务派发', true, true),
  ('role-auditor', '只读审计员', '查看业务记录与统计结果，不可修改数据', true, true)
on conflict (id) do update set description = excluded.description, enabled = true;

insert into public.system_role_permission (role_id, permission_code)
select 'role-super-admin', code from public.system_permission
on conflict do nothing;

insert into public.system_role_permission (role_id, permission_code) values
  ('role-safety-admin', 'dashboard.view'), ('role-safety-admin', 'people.view'),
  ('role-safety-admin', 'people.export'), ('role-safety-admin', 'alarms.view'),
  ('role-safety-admin', 'alarms.confirm'), ('role-safety-admin', 'alarms.dispatch'),
  ('role-safety-admin', 'alarms.close'), ('role-safety-admin', 'devices.view'),
  ('role-safety-admin', 'risk.view'), ('role-safety-admin', 'risk.create'),
  ('role-safety-admin', 'risk.edit'), ('role-safety-admin', 'risk.delete'),
  ('role-safety-admin', 'video.view'), ('role-safety-admin', 'statistics.view'),
  ('role-safety-admin', 'statistics.export'),
  ('role-dispatcher', 'dashboard.view'), ('role-dispatcher', 'people.view'),
  ('role-dispatcher', 'alarms.view'), ('role-dispatcher', 'alarms.confirm'),
  ('role-dispatcher', 'alarms.dispatch'), ('role-dispatcher', 'devices.view'),
  ('role-dispatcher', 'risk.view'), ('role-dispatcher', 'video.view'),
  ('role-dispatcher', 'statistics.view'),
  ('role-auditor', 'dashboard.view'), ('role-auditor', 'people.view'),
  ('role-auditor', 'people.export'), ('role-auditor', 'alarms.view'),
  ('role-auditor', 'devices.view'), ('role-auditor', 'risk.view'),
  ('role-auditor', 'video.view'), ('role-auditor', 'statistics.view'),
  ('role-auditor', 'statistics.export'), ('role-auditor', 'system.logs.view')
on conflict do nothing;

insert into public.system_user (
  id, username, password_hash, display_name, department, role_id, status
) values (
  'user-super-admin-zhangsan',
  'zhangsan',
  extensions.crypt('PetroShield@2026', extensions.gen_salt('bf', 12)),
  '张三',
  '运营管理部',
  'role-super-admin',
  'active'
)
on conflict (username) do update set
  display_name = excluded.display_name,
  department = excluded.department,
  role_id = excluded.role_id,
  status = 'active';

comment on table public.system_user is '平台登录用户，密码仅保存 bcrypt 哈希';
comment on table public.system_role is '平台角色';
comment on table public.system_permission is '平台细粒度权限定义';
comment on table public.system_operation_log is '登录及系统管理操作审计日志';
