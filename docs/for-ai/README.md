# PetroShield Codex 上下文恢复指南

> 最后核对：2026-07-12  
> 用途：当 Codex 上下文窗口压缩、切换任务或由新的会话接手时，先阅读本文件，再阅读与当前任务直接相关的源文件。本文记录项目结构、已实现边界、关键契约和协作约束，不替代源代码。

## 1. 项目概况

PetroShield（石安盾）是石化厂多源融合安全监管平台。目前仓库包括：

- `frontend/`：React 单页应用，首页 Dashboard 是当前开发重点。
- `backend/`：FastAPI API，通过 `asyncpg` 直接查询 Supabase PostgreSQL。
- `database/`：Supabase CLI 配置、初始化迁移和模拟数据 seed。
- `docs/`：数据库结构和供后续 AI 恢复上下文的文档。
- `tools/`：此前用于处理 LeftBar 技术文档的辅助脚本，不参与应用运行。

线上地址：

- 前端：<https://petroshield.netlify.app/>
- 后端：<https://petroshield.onrender.com/>
- API 前缀：`https://petroshield.onrender.com/api/v1`

## 2. 技术栈与运行命令

### 前端

- React 19、React Router 8、styled-components 6、lucide-react、Vite 8。
- 包管理器：npm；锁文件为 `frontend/package-lock.json`。
- 字体和通用颜色集中在 `frontend/src/constants/STYLES.js`。

```powershell
cd frontend
npm install
npm run dev
npm run lint
npm run build
```

前端读取 `VITE_API_BASE_URL`，代码中的默认值是：

```text
http://127.0.0.1:8000/api/v1
```

`frontend/.env.production` 当前指向线上 Render API。`.env.local` 可覆盖本地开发地址。修改 Vite 环境变量后必须重启开发服务器。

### 后端

- FastAPI、Uvicorn、asyncpg、python-dotenv。
- 从 `backend/.env` 读取数据库配置；不要把真实连接串或密码写进文档和提交。

```powershell
cd backend
python -m pip install -r requirements.txt
uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```

Render 的 Start Command：

```text
uvicorn app.main:app --host 0.0.0.0 --port $PORT
```

后端环境变量：

- `DATABASE_URL`：首选 PostgreSQL 连接串。
- `SUPABASE_DB_URL`：`DATABASE_URL` 不存在时的备用变量。
- `DB_SSL_VERIFY`：默认 `true`；仅在明确确认代理或证书链问题时才设为 `false`。

### 数据库

Supabase 工作目录是 `database/`，配置位于 `database/supabase/config.toml`。

```powershell
cd database
supabase db reset
supabase db push
```

`db reset` 会应用迁移并执行 `supabase/seed.sql`。`db push` 会影响远程数据库，必须由用户自己执行，详见第 10 节。

## 3. 仓库结构与职责

```text
petroshield/
├─ frontend/
│  ├─ src/App.jsx                       # 页面路由
│  ├─ src/layouts/MainLayout.jsx        # Header + LeftBar + Outlet
│  ├─ src/pages/Dashboard.jsx           # 首页及首页数据请求、图表原型
│  ├─ src/components/Header/Header.jsx  # 顶部栏、搜索框、用户菜单
│  ├─ src/components/LeftBar/LeftBar.jsx# 可收缩侧栏与抽屉导航
│  ├─ src/components/Icon/Icon.jsx      # 图标封装
│  └─ src/constants/STYLES.js           # COLORS、FONT_SIZES
├─ backend/
│  ├─ app/main.py                       # FastAPI、CORS、/api/v1 前缀
│  ├─ app/api/router.py                 # API 路由汇总
│  └─ app/api/routes/dashboard.py       # 首页指标和实时告警接口
├─ database/supabase/
│  ├─ migrations/20260710000100_init_core_tables.sql
│  ├─ seed.sql                          # 8 张业务表的基础模拟数据
│  ├─ seed_alarms.sql                   # 相对当前日期生成的告警趋势模拟数据
│  └─ config.toml
└─ docs/for-ai/
   ├─ README.md                         # 本文
   └─ database-schema.md                # 数据表字段、关系和枚举说明
```

## 4. 前端路由

所有页面都位于 `MainLayout` 内：

| 路由 | 页面/含义 |
| --- | --- |
| `/` | Dashboard 首页 |
| `/people-management` | 人员管理 |
| `/alarm-center` | 告警中心 |
| `/device-management` | 设备管理 |
| `/risk-control` | 风险管控 |
| `/video-ai` | 视频 AI |
| `/statistics-analysis` | 统计分析父页面 |
| `/statistics-analysis/risk-overview` | 风险态势总览 |
| `/statistics-analysis/risk-events` | 风险事件追溯 |
| `/statistics-analysis/alarm-stats` | 告警统计分析 |
| `/statistics-analysis/person-tracks` | 人员轨迹分析 |
| `/statistics-analysis/device-stats` | 设备统计分析 |
| `/system-management` | 系统管理父页面 |
| `/system-management/user-settings` | 用户设置 |

除 Dashboard 外，多数页面目前仍是简单占位页面。不要误认为它们已经接入业务数据。

## 5. 布局组件的重要行为

### Header

- 搜索框为白色背景，左侧放大镜图标，占位文字为“搜索人员，设备，风险，事件等”。
- 右侧用户区域为圆形头像、用户名“张三”、身份“运营管理员”和下三角。
- 用户菜单包含“用户设置”和“退出登录”；目前主要是 UI 行为。
- 窄屏时依次隐藏平台名称、搜索框和用户文字，避免横向溢出。

### LeftBar

- 展开宽度 `10rem`，收缩宽度 `4rem`，宽度过渡为 `180ms ease`。
- 图标使用固定 grid 列，收缩前后图标位置保持稳定；文字通过透明度隐藏。
- “统计分析”和“系统管理”是带子项的抽屉。
- 展开状态点击抽屉父项只控制开合；收缩状态点击父项会跳到该组第一个子路由。
- 从收缩切回展开时，不自动展开任何父抽屉。
- 菜单收起时会关闭所有父抽屉。
- 子项只有自身路由激活时显示蓝底白字；父抽屉的活动样式和普通 NavLink 不完全相同，修改前要检查现有交互要求。

## 6. Dashboard 当前实现

### 已接后端的内容

- 顶部四张指标卡：在线人员、设备在线率、今日告警总数、风险区域。
- 人员状态分布：正常、高风险、中风险、离线，包含数量与比例。
- 设备状态分布：在线、离线、告警，包含数量与比例。
- 实时告警列表：最多请求 20 条，前端每页固定显示 5 个槽位。
- 告警趋势分析：查询最近 7 个自然日，按日统计重大、严重、一般告警。

### 仍为前端静态原型的内容

- 厂区人员与设备分布地图及标记。
- 人员健康分析热力图数据。
- 设备在线率趋势历史数据（仅末端会参考当前在线率）。
- 顶部指标卡下方的“较昨日”变化值。

不要把静态原型数据描述为数据库实时数据。后续接入时，应先确定新的后端契约，再替换相应常量。

### Dashboard 响应式布局

- 宽屏：四张 KPI 同行；中间为状态分布、地图、实时告警三列；底部三张图同行。
- `max-width: 1280px`：页面改为自然高度并允许主内容纵向滚动；状态分布与地图同排，告警另起一行。
- `max-width: 1180px`：KPI 改两列，底部图表改单列。
- `max-width: 980px`：中间主区域改单列；两张状态分布卡可并排。
- `max-width: 760px`：KPI 和状态分布卡都改单列。
- 宽屏目标是单屏无滚动；窄屏目标是保持卡片可读尺寸，通过换行和纵向滚动适配，而不是无限压缩内容。

### UI 细节约束

- 饼图为空心圆环，中间显示灰色“总数”和黑色总数值。
- 人员颜色：正常蓝、高风险红、中风险橙、离线灰。
- 设备颜色：在线蓝、离线橙、告警红。
- 饼图图例每项必须单行显示：色点、状态、数量、比例；数量列左对齐，各行上下对齐。
- 实时告警不能使用假列表填充。加载、失败或无数据时显示对应状态文字。
- 告警每页 5 个固定高度槽位；分页始终显示左右箭头，不能翻页的箭头必须禁用；页码最多显示 4 个。
- 调整字号优先修改 `frontend/src/constants/STYLES.js` 中的 `FONT_SIZES`，不要重新散落硬编码字号。

## 7. 后端 API 契约

健康检查：

```http
GET /api/v1/health
```

首页指标：

```http
GET /api/v1/dashboard/metrics
```

响应结构：

```json
{
  "online_person_count": 7,
  "device_online_rate": 75.0,
  "today_alarm_count": 0,
  "risk_area_count": 3,
  "person_status_distribution": {
    "normal": { "label": "正常", "count": 5, "ratio": 62.5 },
    "high_risk": { "label": "高风险", "count": 1, "ratio": 12.5 },
    "medium_risk": { "label": "中风险", "count": 1, "ratio": 12.5 },
    "offline": { "label": "离线", "count": 1, "ratio": 12.5 }
  },
  "device_status_distribution": {
    "online": { "label": "在线", "count": 6, "ratio": 75.0 },
    "offline": { "label": "离线", "count": 0, "ratio": 0.0 },
    "alarm": { "label": "告警", "count": 2, "ratio": 25.0 }
  }
}
```

实时告警：

```http
GET /api/v1/dashboard/realtime-alarms?limit=20
```

- `limit` 范围为 1 到 20，后端默认 5。
- 排除状态为“关闭”和“误报”的告警。
- 按告警时间、创建时间倒序。
- 关联人员和设备，返回展示所需的 `title`、`level`、`time`、`meta` 等字段。

```json
{
  "items": [
    {
      "id": 1,
      "type": "设备异常",
      "title": "设备异常告警",
      "level": "严重",
      "status": "处理中",
      "time": "2026-07-12T10:52:11+00:00",
      "description": "...",
      "meta": "设备名称 / 设备类型",
      "person_name": null,
      "department": null,
      "company": null,
      "device_name": "...",
      "device_type": "..."
    }
  ]
}
```

告警趋势：

```http
GET /api/v1/dashboard/alarm-trend?days=7&granularity=day
```

- `days` 范围为 1 到 31，首页支持最近 7 天和最近 30 天。
- `granularity` 支持 `hour`、`day`、`week`，分别表示按小时、按日、按周聚合。
- 以 `Asia/Shanghai` 时区的系统当前日期为截止日，返回连续自然日；无告警的日期也返回零值。
- 按数据库约定统计 `重大`、`严重`、`一般` 三种等级。

```json
{
  "range": "last_7_days",
  "granularity": "day",
  "items": [
    {
      "bucket_start": "2026-07-12T00:00:00",
      "major": 1,
      "severe": 2,
      "general": 3
    }
  ]
}
```

后端 CORS 当前允许：

- `http://localhost:5173`
- `http://127.0.0.1:5173`
- `https://petroshield.netlify.app`

若 Vite 自动切换到 5174 等其他端口，浏览器请求会被 CORS 拒绝。应优先让前端使用 5173，或明确更新 CORS 白名单。

## 8. 数据库结构摘要

当前初始化迁移创建 8 张业务表：

| 表 | 作用 |
| --- | --- |
| `area` | 电子围栏、危险和限制区域 |
| `device` | 设备基础信息 |
| `person` | 人员基础信息及设备绑定 |
| `device_realtime` | 设备实时状态，一对一扩展 `device` |
| `device_maintenance` | 设备维护记录 |
| `device_compliance` | 设备合规与年检记录 |
| `alarm` | 人员或设备产生的告警事件 |
| `position` | 人员实时及历史定位数据 |

“设备”被拆为基础、实时、维护、合规四张表，用于分离不同更新频率、生命周期和一对多记录。完整字段、外键、检查约束、状态值与索引请以 [`database-schema.md`](./database-schema.md) 和迁移 SQL 为准。

关键关系：

- `device.region_id -> area.id`
- `person.device_id -> device.id`
- `device_realtime.device_id -> device.id`，且唯一
- `device_maintenance.device_id -> device.id`
- `device_maintenance.maintainer_id -> person.id`
- `device_compliance.device_id -> device.id`
- `alarm.person_id -> person.id`，可空
- `alarm.device_id -> device.id`，可空
- `position.person_id -> person.id`

`database/supabase/seed.sql` 已为上述 8 张业务表生成基础模拟数据；`seed_alarms.sql` 使用相对系统当前日期生成最近 7 天的告警趋势数据。`config.toml` 会在重置数据库时按该顺序执行两个文件。修改 schema 后必须同步检查 seed 是否仍能执行。

## 9. 常见问题与排查顺序

### 后端返回未配置数据库

错误：

```text
DATABASE_URL or SUPABASE_DB_URL is not configured
```

检查 `backend/.env` 是否存在、变量名是否正确，以及 Uvicorn 是否从预期项目目录启动。`main.py` 会显式加载 `backend/.env`。

### `getaddrinfo failed`

数据库主机名无法解析。优先核对 Supabase 连接串是否完整，尤其是 host；网络只支持 IPv4 时可使用 Supabase pooler 地址。

### `CERTIFICATE_VERIFY_FAILED`

通常是本地代理或自签名证书链导致。生产环境尽量保持 `DB_SSL_VERIFY=true`。只有明确理解风险后，才在受控本地环境临时关闭验证。

### 本地前端失败、Netlify 正常

依次检查：

1. `.env.local` 中的 `VITE_API_BASE_URL` 是否指向实际运行的后端。
2. 修改 env 后是否重启 Vite。
3. 前端端口是否在后端 CORS 白名单中。
4. 浏览器 Network 面板中的实际请求 URL、HTTP 状态和 CORS 信息。
5. Render 免费实例是否处于冷启动阶段。

### PowerShell 显示中文乱码

部分 `Get-Content` 输出可能因终端代码页显示乱码，不代表 UTF-8 源文件损坏。不要基于乱码输出批量重写中文；应通过编辑器、构建结果或明确指定 UTF-8 后再判断。

## 10. 协作与操作边界

以下是用户明确提出的长期要求，后续 Codex 必须遵守：

1. 生成或修改数据库迁移、seed 后，不要执行 `supabase db push`，由用户自行检查并 push。
2. 不要擅自 push GitHub；只有用户明确要求时才提交或推送。
3. 工作区可能已有用户改动。修改前先看 `git status` 和相关 diff，不回退无关改动。
4. 前端修改应延续现有 React + styled-components + lucide-react 结构，不随意引入新的 UI 框架。
5. Dashboard 视觉目标参考石化厂监控大屏原型：紧凑、清晰、可扫描；卡片内容不可重叠或溢出。
6. 用户要求“先分析/讨论”时，只给原因和方案，不直接改代码；用户要求“修改/实现”时再落地并验证。

## 11. 新会话接手清单

后续 Codex 开始任务时按以下顺序恢复上下文：

1. 阅读本文件。
2. 运行 `git status --short`，确认用户已有改动。
3. 根据任务阅读真实源文件，不仅依赖本文摘要。
4. 涉及数据库时阅读迁移、seed 和 `database-schema.md`。
5. 涉及首页时同时阅读 `Dashboard.jsx`、`STYLES.js` 和 `dashboard.py`，避免破坏前后端契约。
6. 修改后至少运行与范围匹配的验证：前端通常为 `npm run lint` 和 `npm run build`；后端至少做导入/语法检查，条件允许时调用健康接口。
7. 响应式 UI 修改需要检查宽屏与窄屏，重点观察横向溢出、文字重叠、固定行高和分页状态。
8. 最终说明改了哪些文件、验证结果和仍需用户执行的操作；不要替用户 push。

## 12. 文档维护规则

出现以下变化时同步更新本文：

- 新增或删除顶层目录、关键模块或页面路由。
- 修改环境变量、部署地址、启动命令或 CORS 白名单。
- 新增 API，或修改 Dashboard 的响应字段。
- 新增迁移、表、关键关系或 seed 策略。
- 静态原型完成后端接入，或已实现功能退回占位状态。
- 用户给出新的长期协作约束。

本文只保存稳定且高价值的信息。临时调试日志、一次性命令输出和密钥不应写入。
