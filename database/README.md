# PetroShield 数据库 Seed

## 一键刷新最近 7 天

运行前必须先在“风险管控”页面创建并启用至少一个区域。Seed 不会创建、恢复或覆盖区域，而会把模拟设备、人员、轨迹、健康观测和告警全部映射到运行时数据库中的当前区域。

Windows 下双击：

```text
run-all-seeds.cmd
```

脚本默认读取 `../backend/.env` 中的 `DATABASE_URL` 或 `SUPABASE_DB_URL`，显示数据库主机和锚点日期后，要求输入 `SEED` 确认。它不会执行 migration、`db push` 或全库清空，只会刷新 PetroShield 固定 seed ID 和带 seed 标记的数据。

默认锚点是执行当天（Asia/Shanghai）。脚本生成锚点日及前 6 个自然日的数据，并将全部语句封装为一个服务器端 `DO` 命令执行；因此兼容 Supabase CLI 的 prepared statement 限制，同时保持单事务。任意 seed 或最终校验失败都会回滚。

命令行示例：

```powershell
# 使用 backend/.env，锚点为今天
.\run-all-seeds.ps1

# 指定任意锚点日期
.\run-all-seeds.ps1 -AnchorDate 2026-07-16

# 本地 Supabase
.\run-all-seeds.ps1 -Local

# 已通过 Supabase CLI link 的项目
.\run-all-seeds.ps1 -Linked

# 自动化场景跳过 SEED 确认
.\run-all-seeds.ps1 -Force
```

## 数据范围

- 基础档案：保留用户当前区域，生成 16 台设备、50 名人员，以及设备维护和合规快照。
- 空间归属：设备均匀分布到当前启用区域；人员跟随绑定设备或轮换分布；轨迹和告警坐标取自对应区域几何。
- 告警：50 条，覆盖锚点日及前 6 天。
- 人员健康观测：350 条，即 50 人乘 7 天。
- 设备状态观测：112 条，即 16 台设备乘 7 天。
- 设备维护明细：48 条，即 16 台设备各 3 条最近维护记录。
- 人员历史位置：前 6 个完整自然日每 30 分钟 1 点，锚点日生成到执行时刻；50 人至少 14,400 条。
- 人员实时轨迹：每人最近 5 分钟每秒 1 点，共 15,000 条，并同步 `person_position_current`。

重复执行时，脚本只删除或更新以下模拟数据范围：

- `alarm-001` 至 `alarm-006`，以及 `evidence.seed_source = seed_alarms.sql` 的告警。
- `seed_alarm_workflow.sql` 会为滚动告警重建确认、派单、建议与审计日志。
- `pos-001` 至 `pos-016`、`pos-seed-*`、`pos-history-seed-*` 定位。
- `health-seed-*` 健康观测。
- `device-status-seed-*` 设备状态观测。
- `device-maintenance-seed-*` 设备维护明细。

其他 ID、没有 seed 标记的数据以及真实业务记录不会按日期范围清理。

## 本地重置

`database/supabase/config.toml` 保留完整 seed 顺序，因此本地 Docker/Supabase 可继续使用：

```powershell
supabase db reset
```

本地重置默认以执行当天为锚点。不要对远端项目使用 `db reset`。
