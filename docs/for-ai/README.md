# PetroShield Codex 上下文恢复指南

> 最后核对：2026-07-13
> 用途：新的 Codex 会话或压缩后的上下文恢复时，先读本文件，再按任务阅读真实源码、迁移和 seed。本文是稳定上下文摘要，不替代源码。

## 1. 项目概况

PetroShield（石安盾）是石化厂多源融合安全监管平台。当前仓库分为：

- `frontend/`：React + Vite 单页应用，使用 `styled-components`。
- `backend/`：FastAPI API，使用 `asyncpg` 直连 Supabase PostgreSQL。
- `database/`：Supabase CLI 配置、迁移、seed、一次性 backfill 脚本。
- `docs/for-ai/`：给后续 AI/Codex 恢复上下文使用的文档。
- `tools/`：历史辅助脚本，不参与应用运行。

线上地址：

- 前端：[https://petroshield.netlify.app](https://petroshield.netlify.app)
- 后端：[https://petroshield.onrender.com](https://petroshield.onrender.com)
- API 前缀：`https://petroshield.onrender.com/api/v1`

## 2. 技术栈与常用命令

### 前端

- React 19、React Router 8、styled-components 6、lucide-react、Vite 8。
- 包管理器：npm；锁文件：`frontend/package-lock.json`。
- 样式常量集中在 `frontend/src/constants/STYLES.js`，字号优先改 `FONT_SIZES`，不要到处硬编码。

```powershell
cd frontend
npm install
npm run dev
npm run lint
npm run build
```

前端读取：

- `VITE_API_BASE_URL`：API 地址。代码默认值为 `http://127.0.0.1:8000/api/v1`。
- `VITE_BAIDU_MAP_AK`：百度地图浏览器端 AK，用于首页地图和人员管理地图。通常放在 `frontend/.env.local`，不要写入文档或提交真实密钥。

修改 Vite 环境变量后必须重启 dev server。

### 后端

- FastAPI、Uvicorn、asyncpg、python-dotenv。
- `backend/app/main.py` 会加载 `backend/.env`。

```powershell
cd backend
python -m pip install -r requirements.txt
uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```

Render Start Command：

```text
uvicorn app.main:app --host 0.0.0.0 --port $PORT
```

后端环境变量：

- `DATABASE_URL`：首选 PostgreSQL 连接串。
- `SUPABASE_DB_URL`：备用连接串。
- `DB_SSL_VERIFY`：默认 `true`；只在明确知道代理/证书链问题时临时设为 `false`。

### 数据库

Supabase 工作目录是 `database/`，配置在 `database/supabase/config.toml`。

```powershell
cd database
supabase db reset
supabase db push
```

注意：

- 用户本机之前没有 Docker Desktop 时，`supabase db reset` 会失败；Docker 是 Supabase 本地开发数据库的前提。
- 远端 Supabase 是演示/协作数据源。不要擅自对远端执行 `supabase db push`、`--include-seed` 或破坏性 SQL，必须由用户明确要求或用户自行执行。
- `db reset` 会按 `config.toml` 的 `sql_paths` 顺序执行 seed。

## 3. 仓库结构重点

```text
petroshield/
├─ frontend/
│  ├─ src/App.jsx
│  ├─ src/layouts/MainLayout.jsx
│  ├─ src/pages/Dashboard.jsx
│  ├─ src/pages/PeopleManagement.jsx
│  ├─ src/pages/AlarmCenter.jsx
│  ├─ src/pages/DeviceManagement.jsx
│  ├─ src/pages/RiskControl.jsx
│  ├─ src/pages/VideoAI.jsx
│  ├─ src/pages/StatisticsAnalysis.jsx
│  ├─ src/pages/SystemManagement.jsx
│  ├─ src/components/BaiduSatelliteMap/
│  ├─ src/components/PeopleLocationMap/
│  ├─ src/components/Header/
│  ├─ src/components/LeftBar/
│  └─ src/constants/STYLES.js
├─ backend/
│  ├─ app/main.py
│  ├─ app/api/router.py
│  └─ app/api/routes/
│     ├─ health.py
│     ├─ dashboard.py
│     ├─ people.py
│     └─ devices.py
├─ database/supabase/
│  ├─ migrations/
│  │  ├─ 20260710000100_init_core_tables.sql
│  │  ├─ 20260712000200_add_person_health_observation.sql
│  │  ├─ 20260712000300_add_device_realtime_observation.sql
│  │  └─ 20260713000100_add_person_position_current.sql
│  ├─ seeds/
│  │  ├─ seed.sql
│  │  ├─ seed_person_positions.sql
│  │  ├─ seed_alarms.sql
│  │  ├─ seed_person_health.sql
│  │  └─ seed_device_realtime_observation.sql
│  ├─ backfill_person_health_observation.sql
│  ├─ backfill_device_realtime_observation.sql
│  └─ config.toml
└─ docs/for-ai/
   ├─ README.md
   └─ database-schema.md
```

## 4. 前端路由

所有页面都在 `MainLayout` 下：

| 路由 | 当前状态 |
| --- | --- |
| `/` | Dashboard，已接多项后端数据 |
| `/people-management` | 人员管理，已接人员定位/轨迹接口，地图为百度卫星图 |
| `/alarm-center` | 告警中心页面，当前仍偏占位/原型 |
| `/device-management` | 设备管理，已按原型实现卡片列表、筛选、分页和右侧设备详情抽屉；后端提供设备概览接口，前端保留原型演示数据兜底 |
| `/risk-control` | 风险管控，占位/原型 |
| `/video-ai` | 视频 AI，占位/原型 |
| `/statistics-analysis` 及其子路由 | 统计分析占位/原型 |
| `/system-management` 及其子路由 | 系统管理占位/原型 |

注意：`App.jsx` 里部分子路由标题仍有历史乱码文本，不代表页面功能已完整实现。

## 5. Dashboard 当前实现

主要文件：

- 前端：`frontend/src/pages/Dashboard.jsx`
- 后端：`backend/app/api/routes/dashboard.py`
- 地图：`frontend/src/components/BaiduSatelliteMap/BaiduSatelliteMap.jsx`

已接后端：

- 顶部 KPI：在线人员、设备在线率、今日告警、风险区域；`/dashboard/metrics` 同时返回 `metric_comparisons`，用于展示真实“较昨日”差值。
- 人员状态分布。
- 设备状态分布。
- 实时告警列表，`查看更多` 跳转 `/alarm-center`。
- 告警趋势分析：支持近 1/3/7/30 天与 hour/day/week 粒度。
- 人员健康分析：基于 `person_health_observation`。
- 设备在线率趋势：基于 `device_realtime_observation`。

地图：

- 首页静态占位已替换为 `BaiduSatelliteMap`。
- 使用百度地图 JS API，AK 读取 `VITE_BAIDU_MAP_AK`。
- 默认卫星图，支持拖动、滚轮缩放、缩放控件、比例尺、中心 marker。
- 中心点 BD-09：经度 `121.671271`，纬度 `29.978283`。

仍需谨慎：

- 部分 Dashboard 视觉/文案仍是原型性质。
- 修改图表交互时要同时检查 `Dashboard.jsx` 和 `dashboard.py` 的参数契约。

## 6. 人员管理当前实现

主要文件：

- 页面：`frontend/src/pages/PeopleManagement.jsx`
- 地图组件：`frontend/src/components/PeopleLocationMap/PeopleLocationMap.jsx`
- 后端接口：`backend/app/api/routes/people.py`

当前行为：

- 页面上半部分：左侧百度卫星地图，右侧选中人员卡片。
- 页面下半部分：人员列表。
- 搜索框是受控组件，会实时影响地图和列表。
- 点击地图 marker 或列表行会选中人员。
- 列表“查看/更多”会打开人员详情弹窗。
- 表头支持筛选值、升序、降序、取消排序；姓名/工号使用模糊搜索，姓名可按姓氏筛选，最近更新时间使用起止时间筛选。
- 右侧人员卡片底部有：
  - `查看轨迹`：控制地图是否显示被选中人员近 5 分钟轨迹；默认关闭。
  - `呼叫对讲`：当前只是 UI 按钮，尚未接真实通信能力。
  - `更多`：打开详情弹窗。
- 地图组件内部有“显示所有人员”和“显示姓名”开关；“显示所有人员”默认打开，关闭后只显示当前选中人员，轨迹显示由父组件通过 `showTrack` prop 控制。

人员轨迹：

- 只画被选中的人员；没有选中人员时不画轨迹。
- 轨迹数据来自 `/api/v1/people/locations` 返回的 `track`。
- 前端优先使用轨迹点的 `direction` 字段做分段，避免把多段路径误合并。
- 每段线段中间画一个箭头；拐弯处画小圆点；轨迹主色为蓝色系。
- `PeopleLocationMap` 将数据库局部坐标 `x/y` 映射到百度 BD-09 附近。当前是演示级映射，不是正式 GIS 坐标转换。

人员管理页近期注意事项：

- 该文件曾有历史中文乱码，已清理了当前参与渲染/筛选的关键区域；如果继续遇到乱码，优先用 UTF-8 方式读取和小范围修复，不要盲目大面积重写。
- 调整字号优先更新 `STYLES.js`，例如 `peopleSearchInput`、`peopleCardAction`。

## 7. 后端 API 契约

健康检查：

```http
GET /api/v1/health
```

Dashboard：

```http
GET /api/v1/dashboard/metrics
GET /api/v1/dashboard/realtime-alarms?limit=20
GET /api/v1/dashboard/alarm-trend?days=7&granularity=day
GET /api/v1/dashboard/person-health-analysis?days=7&granularity=day
GET /api/v1/dashboard/device-online-trend?days=7&granularity=day
```

参数要点：

- `realtime-alarms.limit`：1 到 20。
- `alarm-trend.days`：1 到 31；`granularity` 支持 `hour`、`day`、`week`。
- `person-health-analysis.days`：1 到 31；`granularity` 支持 `day`、`week`。
- `device-online-trend.days`：1 到 31；`granularity` 支持 `day`、`week`。
- 趋势类接口按 `Asia/Shanghai` 业务日期处理。

人员定位：

```http
GET /api/v1/people/locations
```

返回每名人员的：

- `person` 基础字段。
- `latest_position`：来自 `person_position_current` 实时快照表。
- `track`：来自 `position` 短期轨迹表。后端按“每个人最新轨迹点往前 5 分钟”取轨迹，而不是死用数据库当前 `now()`，这样演示 seed 不会过几分钟就全部过期。

设备管理：

```http
GET /api/v1/devices/overview
```

返回每台设备的基础信息、`device_realtime` 最新状态、维护信息、合规年检信息、告警数量和最近告警。前端设备管理页默认使用原型一致的演示数据，接口可用且有数据时会归一化为页面卡片/详情抽屉消费结构。

后端 CORS 当前允许：

- `http://localhost:5173`
- `http://127.0.0.1:5173`
- `http://localhost:5174`
- `http://127.0.0.1:5174`
- `http://localhost:5175`
- `http://127.0.0.1:5175`
- `https://petroshield.netlify.app`

如果 Vite 自动换到其他端口，可能被 CORS 拒绝。

## 8. 数据库与 seed 摘要

完整字段和约束见 [`database-schema.md`](./database-schema.md) 与迁移 SQL。当前核心业务表共 11 张：

| 表 | 作用 |
| --- | --- |
| `area` | 电子围栏、风险区域、作业区域 |
| `device` | 设备基础档案 |
| `device_realtime` | 设备实时状态快照 |
| `device_realtime_observation` | 设备状态历史观测，最新观测同步到 `device_realtime` |
| `device_maintenance` | 设备运维 |
| `device_compliance` | 设备合规/年检 |
| `person` | 人员基础、状态、培训、健康、安全行为字段 |
| `person_health_observation` | 人员健康历史观测，最新观测同步回 `person` 健康字段 |
| `alarm` | 告警事件 |
| `position` | 人员短期轨迹点 |
| `person_position_current` | 人员实时位置快照，一人最多一条 |

关键设计：

- `person` 绑定定位设备：`person.device_id -> device.id`。
- `position` 是短期轨迹表，不作为实时位置快照直接查询源。
- `person_position_current` 是实时位置快照表，由 `position` 的触发器自动同步最新点。
- `person_health_observation` 中最新记录会同步回 `person` 的健康字段。
- `device_realtime_observation` 中最新记录会同步回 `device_realtime`。

Seed 文件顺序在 `database/supabase/config.toml`：

```toml
sql_paths = [
  "./seeds/seed.sql",
  "./seeds/seed_person_positions.sql",
  "./seeds/seed_alarms.sql",
  "./seeds/seed_person_health.sql",
  "./seeds/seed_device_realtime_observation.sql"
]
```

当前 seed 覆盖：

- `seed.sql`：基础区域、25 名人员、16 台设备、基础告警、基础位置等。
- `seed_person_positions.sql`：按当前 `person` 集合动态生成最近 5 分钟逐秒短期轨迹。25 人时约 7,500 条 `position`，并同步 `person_position_current`。轨迹是 1 到 6 段随机折线，供人员管理地图演示。
- `seed_alarms.sql`：相对当前日期生成告警趋势演示数据。
- `seed_person_health.sql`：约 7 天范围的人员健康观测。
- `seed_device_realtime_observation.sql`：约 7 天范围的设备状态观测。

一次性 backfill：

- `database/supabase/backfill_person_health_observation.sql`
- `database/supabase/backfill_device_realtime_observation.sql`

这些 backfill 不由 `db reset` 自动执行；用于远端已有数据迁移后的手动补齐。

## 9. 常见问题与排查

### Docker / Supabase 本地 reset

如果执行 `supabase db reset` 报 Docker pipe/service 错误，意思是本地 Docker Desktop 没启动或没安装。Docker 不是线上数据库，而是 Supabase 本地开发数据库依赖。

用户当前倾向：很多演示数据最终需要写入远端 Supabase，方便远程开发者查看。仍然不要替用户擅自 push/seed 远端。

### 后端提示未配置数据库

错误：

```text
DATABASE_URL or SUPABASE_DB_URL is not configured
```

检查：

1. `backend/.env` 是否存在。
2. 变量名是否是 `DATABASE_URL` 或 `SUPABASE_DB_URL`。
3. Uvicorn 是否从预期项目目录启动。

### `getaddrinfo failed`

数据库主机名无法解析。检查 Supabase 连接串是否完整；如果网络只支持 IPv4，可考虑 Supabase pooler 地址。

### `CERTIFICATE_VERIFY_FAILED`

通常是本地代理或证书链问题。生产环境尽量保持 `DB_SSL_VERIFY=true`。只在明确理解风险后，临时关闭本地 SSL 验证。

### PowerShell 中文乱码

PowerShell `Get-Content` 可能显示乱码，不一定代表 UTF-8 源文件损坏。判断源码时优先：

- 用编辑器查看。
- 用构建/lint 结果确认。
- 必要时用明确 UTF-8 的脚本读取。

不要因为终端乱码就大面积重写中文。

## 10. 协作与操作边界

后续 Codex 必须遵守：

1. 不要擅自执行远端 `supabase db push`、`--include-seed`、破坏性 SQL 或真实数据删除。
2. 不要擅自 push GitHub、提交 PR 或改远端状态，除非用户明确要求。
3. 工作区可能已有用户改动；改前先看 `git status --short` 和相关 diff，不回退无关改动。
4. 前端继续使用 React + styled-components + lucide-react，不随意引入新 UI 框架。
5. 调整字号、颜色、公共风格时优先检查 `frontend/src/constants/STYLES.js`。
6. 用户说“先讨论/分析”时，不要直接改代码；用户说“修改/实现”时再落地并验证。
7. 真实密钥、数据库连接串、百度地图 AK 不写入文档和最终回复。
8. 涉及数据库 schema/seed 时，同步考虑迁移、seed、backfill、后端查询和前端消费。

## 11. 新会话接手清单

新的 Codex 会话开始时建议：

1. 读本文件。
2. 运行 `git status --short`，确认当前未提交改动。
3. 根据任务读真实源码，不只依赖本文摘要。
4. 涉及数据库时读迁移、seed、`database-schema.md`。
5. 涉及 Dashboard 时同时读 `Dashboard.jsx`、`dashboard.py`、`STYLES.js`。
6. 涉及人员管理时同时读 `PeopleManagement.jsx`、`PeopleLocationMap.jsx`、`people.py`、`seed_person_positions.sql`。
7. 前端改动通常运行：

```powershell
cd frontend
npm run lint
npm run build
```

8. 后端改动至少做语法/导入检查；如用 `py_compile` 生成 `__pycache__`，结束前清理或不要提交。
9. 最终回复说明改了哪些文件、验证结果、是否需要用户执行 seed/部署。

## 12. 文档维护规则

出现以下变化时同步更新本文件：

- 新增/删除关键页面、路由、模块。
- 修改 API 契约、环境变量、部署地址、CORS 白名单。
- 新增迁移、表、关键关系或 seed 策略。
- 原型页面接入真实后端，或已实现功能退回占位。
- 用户给出新的长期协作约束。

本文只保存稳定且高价值的信息；一次性日志、临时命令输出、密钥不应写入。
