"""PetroShield OpenAPI documentation metadata.

This module keeps the public API contract readable without mixing long Swagger
descriptions into the route implementation files.
"""

from copy import deepcopy
from typing import Any

from fastapi import FastAPI
from fastapi.openapi.utils import get_openapi


API_DESCRIPTION = """
石安盾多源融合安全监管平台后端接口，覆盖首页态势、人员与设备、风险区域、
告警闭环、统计分析及系统管理。

### 调用约定

1. 除健康检查和登录外，接口均需要登录，并受角色权限控制。
2. 调用 `POST /api/v1/auth/login` 获取 `access_token` 后，点击右上角
   **Authorize**，填入令牌即可调试受保护接口。
3. 请求和响应默认使用 `application/json`；时间采用 ISO 8601 格式，业务统计按
   **Asia/Shanghai（中国标准时间）** 计算。
4. 错误响应统一使用 `{"detail": "错误原因"}`。`401` 表示未登录或令牌失效，
   `403` 表示角色权限不足，`422` 表示参数或业务校验失败，`503` 表示数据库或
   外部服务暂时不可用。
5. 删除类接口成功后返回 `204 No Content`，响应体为空。

### 告警闭环

告警状态按“新建 → 确认 → 处理中 → 待复核 → 关闭”流转。确认告警时后端会调用
DeepSeek 生成处置建议；若 AI 服务不可用，告警确认仍然成功，并保存本地兜底建议。
"""


OPENAPI_TAGS = [
    {"name": "系统状态", "description": "服务存活与部署状态检查，无需登录。"},
    {"name": "登录认证", "description": "登录、读取当前会话和退出登录。"},
    {"name": "首页", "description": "首页核心指标、实时告警及趋势分析数据。"},
    {"name": "人员管理", "description": "人员档案、实时位置、区域归属和移动轨迹。"},
    {"name": "设备管理", "description": "设备台账、实时状态、维保合规及设备告警。"},
    {"name": "风险管控", "description": "电子围栏、风险区域及区域规则配置。"},
    {"name": "告警中心", "description": "告警检索、详情查看、派单、反馈、复核和关闭。"},
    {"name": "统计分析", "description": "风险态势统计及风险事件全过程追溯。"},
    {"name": "系统管理", "description": "用户、角色权限、数据字典和操作日志。"},
]


def _doc(
    summary: str,
    description: str,
    *,
    permission: str | None = None,
    parameters: dict[str, Any] | None = None,
    request_examples: dict[str, Any] | None = None,
    response_example: Any = None,
    response_description: str = "请求成功",
    response_status: str = "200",
    errors: tuple[int, ...] = (),
) -> dict[str, Any]:
    if permission:
        description = f"**所需权限：** `{permission}`\n\n{description}"
    return {
        "summary": summary,
        "description": description,
        "parameters": parameters or {},
        "request_examples": request_examples,
        "response_example": response_example,
        "response_description": response_description,
        "response_status": response_status,
        "errors": errors,
    }


AREA_REQUEST = {
    "polygon_area": {
        "summary": "创建多边形高风险区域",
        "value": {
            "name": "一号罐区",
            "type": "danger",
            "risk_level": "high",
            "shape": "polygon",
            "polygon": [
                {"x": 121.4931, "y": 31.2412},
                {"x": 121.4954, "y": 31.2415},
                {"x": 121.4948, "y": 31.2396},
            ],
            "center": None,
            "radius": None,
            "enabled": True,
            "manager_name": "李强",
            "manager_department": "安全管理部",
            "rules": {
                "cross_boundary": True,
                "dwell_enabled": True,
                "dwell_minutes": 15,
                "capacity_enabled": True,
                "max_people": 20,
                "priority": "high",
            },
        },
    },
    "circle_area": {
        "summary": "创建圆形限制区域",
        "value": {
            "name": "装卸作业区",
            "type": "restricted",
            "risk_level": "medium",
            "shape": "circle",
            "polygon": [],
            "center": {"x": 121.4962, "y": 31.2401},
            "radius": 80,
            "enabled": True,
            "manager_name": "王五",
            "manager_department": "生产部",
            "rules": {
                "cross_boundary": True,
                "dwell_enabled": False,
                "dwell_minutes": 30,
                "capacity_enabled": False,
                "max_people": 10,
                "priority": "medium",
            },
        },
    },
}


ALARM_ACTION_EXAMPLES = {
    "confirm": {
        "summary": "确认告警并生成 AI 处置建议",
        "value": {"action": "confirm", "comment": "已核对视频与定位，确认为真实告警"},
    },
    "dispatch": {
        "summary": "派发处理任务",
        "value": {
            "action": "dispatch",
            "assignee_id": "person-001",
            "department": "安全管理部",
            "priority": "urgent",
            "instruction": "立即疏散人员并检查区域准入记录",
            "due_time": "2026-07-19T18:30:00+08:00",
        },
    },
    "feedback": {
        "summary": "提交现场处理反馈",
        "value": {
            "action": "submit_feedback",
            "comment": "人员已撤离，围栏告警规则及现场警示已复核",
            "evidence": [{"type": "image", "url": "https://example.com/evidence/alarm-001.jpg"}],
        },
    },
    "approve": {
        "summary": "复核通过并关闭",
        "value": {"action": "review_approve", "comment": "处置结果符合要求，同意闭环"},
    },
}


OPERATION_DOCS: dict[tuple[str, str], dict[str, Any]] = {
    ("get", "/api/v1/health"): _doc(
        "检查服务健康状态", "用于部署探针、CDN 回源检查和人工排障，不访问数据库。",
        response_example={"status": "ok", "message": "PetroShield API is running"},
    ),
    ("post", "/api/v1/auth/login"): _doc(
        "登录并获取访问令牌",
        "校验系统用户与角色状态，登录成功后更新最后登录时间并写入操作日志。",
        request_examples={"default_admin": {"summary": "默认超级管理员", "value": {"username": "zhangsan", "password": "PetroShield@2026"}}},
        response_example={
            "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
            "token_type": "bearer", "expires_in": 28800,
            "user": {"id": "user-super-admin-zhangsan", "username": "zhangsan", "display_name": "张三", "department": "运营中心", "status": "active", "role": {"id": "role-super-admin", "name": "超级管理员"}, "permissions": ["*"]},
        }, errors=(401, 422, 503),
    ),
    ("get", "/api/v1/auth/me"): _doc(
        "获取当前登录用户", "解析 Bearer Token，返回用户、角色及权限列表。",
        response_example={"id": "user-super-admin-zhangsan", "username": "zhangsan", "display_name": "张三", "department": "运营中心", "status": "active", "role": {"id": "role-super-admin", "name": "超级管理员"}, "permissions": ["*"]}, errors=(401, 503),
    ),
    ("post", "/api/v1/auth/logout"): _doc(
        "退出当前登录会话", "记录主动退出操作。JWT 为无状态令牌，客户端仍需清除本地令牌。",
        response_status="204", response_description="退出记录成功，响应体为空", errors=(401, 503),
    ),
    ("get", "/api/v1/dashboard/metrics"): _doc(
        "获取首页核心指标", "返回人员、设备、风险区域和当日告警指标，以及同比数据和分类分布。",
        permission="dashboard.view", response_example={"person_count": {"value": 50, "unit": "人", "comparison": 12.4}, "device_count": {"value": 48, "unit": "台", "comparison": 5.7}, "risk_area_count": {"value": 4, "unit": "处", "comparison": 0}, "today_alarm_count": {"value": 12, "unit": "次", "comparison": -8.6}}, errors=(401, 403, 503),
    ),
    ("get", "/api/v1/dashboard/realtime-alarms"): _doc(
        "获取首页实时告警", "仅返回未关闭、未判定为误报的最新告警，供首页列表轮询展示。",
        permission="dashboard.view", parameters={"limit": "返回条数，范围 1～20，默认 5。"},
        response_example={"items": [{"id": "alarm-trend-022", "type": "人员进入危险区域", "title": "人员越界告警", "level": "严重", "status": "新建", "time": "2026-07-19T10:32:15+08:00", "description": "未授权人员进入一号罐区", "person_name": "张伟", "device_name": None}]}, errors=(401, 403, 503),
    ),
    ("get", "/api/v1/dashboard/alarm-trend"): _doc(
        "查询首页告警趋势", "按小时、天或周聚合重大、严重和一般告警数量，并补齐无数据时间点。",
        permission="dashboard.view", parameters={"days": "统计最近天数，范围 1～31。", "granularity": "聚合粒度：hour（小时）、day（天）或 week（周）。"},
        response_example={"range": "last_7_days", "granularity": "day", "items": [{"bucket_start": "2026-07-19T00:00:00", "major": 1, "severe": 3, "general": 6}]}, errors=(401, 403, 422, 503),
    ),
    ("get", "/api/v1/dashboard/person-health-analysis"): _doc(
        "查询人员健康风险分析", "按启用区域和时间桶统计被观测人员、中高风险人数及风险比例。",
        permission="dashboard.view", parameters={"days": "统计最近天数，范围 1～31。", "granularity": "聚合粒度：day（天）或 week（周）。"},
        response_example={"range": "last_7_days", "granularity": "day", "zones": ["一号罐区"], "buckets": ["2026-07-19T00:00:00"], "items": [{"location_zone": "一号罐区", "bucket_start": "2026-07-19T00:00:00", "observed_people": 12, "medium_risk_people": 2, "high_risk_people": 1, "risk_people": 3, "risk_ratio": 25.0}]}, errors=(401, 403, 422, 503),
    ),
    ("get", "/api/v1/dashboard/device-online-trend"): _doc(
        "查询设备在线率趋势", "按天或周返回设备在线率，用于首页设备运行趋势图。",
        permission="dashboard.view", parameters={"days": "统计最近天数，范围 1～31。", "granularity": "聚合粒度：day（天）或 week（周）。"},
        response_example={"range": "last_7_days", "granularity": "day", "items": [{"bucket_start": "2026-07-19T00:00:00", "total": 48, "online": 46, "online_rate": 95.8}]}, errors=(401, 403, 422, 503),
    ),
    ("get", "/api/v1/people/locations"): _doc(
        "获取人员位置与轨迹", "返回人员档案、当前坐标、所属区域、健康与准入状态，以及用于地图回放的近期轨迹。",
        permission="people.view", response_example={"items": [{"id": "person-001", "name": "张伟", "department": "生产部", "position": "班组长", "location_zone": "一号罐区", "status": "在线", "position_x": 121.4942, "position_y": 31.2404, "track": [{"x": 121.4910, "y": 31.2380, "time": "2026-07-19T09:30:00+08:00"}]}]}, errors=(401, 403, 503),
    ),
    ("get", "/api/v1/devices/overview"): _doc(
        "获取设备管理总览", "返回设备台账、实时状态、维保、合规、区域归属及近期告警。",
        permission="devices.view", response_example={"items": [{"id": "dev-camera-a01", "name": "一号罐区摄像机 A01", "type": "视频设备", "category": "摄像机", "region_id": "area-example", "location": {"x": 121.4941, "y": 31.2402}, "realtime": {"status": "online", "health_score": 96}, "alarm_count": 2}]}, errors=(401, 403, 503),
    ),
    ("get", "/api/v1/devices/{device_id}/activity"): _doc(
        "获取设备运行与维护明细", "返回设备当前运行快照、近 7 天运行观测、最近 50 条关联告警及最近 50 条维护记录。",
        permission="devices.view", parameters={"device_id": "设备唯一编号。"}, response_example={"device": {"id": "dev-camera-a01", "name": "一号罐区摄像机 A01"}, "runtime": {"current": {"status": "online", "cpu_usage": 42, "temperature": 43.3, "health_score": 89}, "history": [{"observation_time": "2026-07-19T08:00:00+08:00", "status": "online", "health_score": 89}]}, "alarms": [{"id": "alarm-001", "type": "视频设备离线", "level": "严重", "status": "关闭"}], "maintenance": {"summary": {"maintenance_status": "正常"}, "records": [{"id": "device-maintenance-seed-dev-camera-a01-r1", "type": "巡检", "content": "检查供电、通信和安装状态", "result": "检查正常", "status": "completed", "maintainer": {"id": "person-005", "name": "王五"}}]}}, errors=(401, 403, 404, 503),
    ),
    ("put", "/api/v1/devices/{device_id}"): _doc(
        "更新设备档案", "更新设备基础信息、区域与坐标，并同步写入最新实时状态。区域编号必须真实存在。",
        permission="devices.edit", parameters={"device_id": "设备唯一编号。"},
        request_examples={"camera": {"summary": "更新摄像设备", "value": {"name": "一号罐区摄像机 A01", "type": "视频设备", "category": "摄像机", "model": "DS-2CD7A", "manufacturer": "海康威视", "serial_number": "CAM-A01-2026", "install_date": "2026-06-01T08:00:00+08:00", "region_id": "area-example", "location": {"x": 121.4941, "y": 31.2402}, "realtime_status": "online"}}},
        response_example={"id": "dev-camera-a01", "updated": True}, errors=(401, 403, 404, 422, 503),
    ),
    ("delete", "/api/v1/devices/{device_id}"): _doc(
        "删除设备", "删除指定设备；关联表按数据库外键规则一并处理。该操作不可撤销。",
        permission="devices.delete", parameters={"device_id": "待删除设备唯一编号。"}, response_status="204", response_description="删除成功，响应体为空", errors=(401, 403, 404, 503),
    ),
    ("get", "/api/v1/risk-control/overview"): _doc(
        "获取风险管控总览", "返回全部电子围栏、规则、人数、设备数、未闭环告警数及可选负责人。",
        permission="risk.view", response_example={"items": [{"id": "area-example", "name": "一号罐区", "type": "danger", "risk_level": "high", "shape": "polygon", "polygon": [{"x": 121.4931, "y": 31.2412}], "enabled": True, "people_count": 12, "device_count": 8, "alert_count": 2}], "managers": [{"id": "person-001", "name": "李强", "department": "安全管理部"}]}, errors=(401, 403, 503),
    ),
    ("post", "/api/v1/risk-control/areas"): _doc(
        "创建风险区域", "创建多边形或圆形电子围栏。多边形至少 3 个点；圆形必须提供中心和正半径。",
        permission="risk.create", request_examples=AREA_REQUEST, response_status="201", response_example={"id": "area-example", "name": "一号罐区", "type": "danger", "risk_level": "high", "shape": "polygon", "enabled": True}, errors=(401, 403, 422, 503),
    ),
    ("get", "/api/v1/risk-control/areas/import-template"): _doc(
        "下载区域导入模板", "生成标准 .xlsx 模板，包含区域数据、填写示例和填写说明三个工作表。",
        permission="risk.create", response_description="Excel 模板文件", errors=(401, 403, 503),
    ),
    ("post", "/api/v1/risk-control/areas/import"): _doc(
        "批量导入风险区域", "读取 multipart/form-data 中的 .xlsx 文件。a 模式保留现有区域并追加；w 模式在单一数据库事务中解除旧关联、删除现有区域并按新表重建。整表校验或任意写入失败时全部回滚。",
        permission="risk.create；w 模式还需要 risk.delete", parameters={"mode": "导入模式：a 表示追加，w 表示覆盖。"}, response_example={"mode": "a", "imported_count": 3, "removed_count": 0, "area_ids": ["area-1", "area-2", "area-3"], "message": "已追加导入 3 个区域"}, errors=(401, 403, 409, 413, 422, 503),
    ),
    ("put", "/api/v1/risk-control/areas/{area_id}"): _doc(
        "修改风险区域", "整体替换区域几何、风险级别、负责人和告警规则。请求体字段与创建接口一致。",
        permission="risk.edit", parameters={"area_id": "风险区域唯一编号。"}, request_examples=AREA_REQUEST, response_example={"id": "area-example", "name": "一号罐区", "risk_level": "high", "enabled": True}, errors=(401, 403, 404, 422, 503),
    ),
    ("delete", "/api/v1/risk-control/areas/{area_id}"): _doc(
        "删除风险区域", "删除区域前会清空以区域名称关联的人员区域字段。该操作不可撤销。",
        permission="risk.delete", parameters={"area_id": "待删除风险区域唯一编号。"}, response_status="204", response_description="删除成功，响应体为空", errors=(401, 403, 404, 503),
    ),
    ("get", "/api/v1/alarms"): _doc(
        "分页筛选告警", "按日期、类型、等级、状态和关键词组合检索，同时返回前端筛选项。结束日期包含当天。",
        permission="alarms.view", parameters={"start_date": "开始日期，格式 YYYY-MM-DD。", "end_date": "结束日期，包含当天。", "alarm_type": "告警类型精确匹配。", "level": "风险等级精确匹配。", "status": "告警当前状态。", "keyword": "模糊匹配告警编号、描述、人员、设备或区域。", "page": "页码，从 1 开始。", "page_size": "每页条数，范围 5～50。"},
        response_example={"items": [{"id": "alarm-trend-022", "type": "人员进入危险区域", "level": "严重", "status": "新建", "time": "2026-07-19T10:32:15+08:00", "area": {"id": "area-example", "name": "一号罐区"}, "subject": {"kind": "person", "id": "person-001", "name": "张伟"}}], "total": 1, "page": 1, "page_size": 10, "options": {"types": ["人员进入危险区域"], "levels": ["严重"], "statuses": ["新建"]}}, errors=(401, 403, 422, 503),
    ),
    ("get", "/api/v1/alarms/operators"): _doc(
        "获取告警处理人员", "返回当前非离线人员，供派单选择；优先排列主管和班组长。",
        permission="alarms.view", response_example={"items": [{"id": "person-001", "name": "李强", "department": "安全管理部", "position": "班组长"}]}, errors=(401, 403, 503),
    ),
    ("get", "/api/v1/alarms/{alarm_id}"): _doc(
        "获取告警完整详情", "返回告警主体、区域、证据、处理日志、派单信息及 AI 处置建议。",
        permission="alarms.view", parameters={"alarm_id": "告警唯一编号。"}, response_example={"id": "alarm-trend-022", "type": "人员进入危险区域", "level": "严重", "status": "确认", "description": "未授权人员进入一号罐区", "ai_advice": {"status": "completed", "content": "1. 立即联系现场人员撤离危险区域。\n2. 核查准入权限与电子围栏规则。"}, "action_logs": []}, errors=(401, 403, 404, 503),
    ),
    ("post", "/api/v1/alarms/{alarm_id}/actions"): _doc(
        "执行告警流程动作",
        "按当前状态执行确认、误报、派单、反馈、复核或关闭。确认、误报、反馈、复核和关闭必须填写说明；派单必须提供处理人员、处置要求和未来的完成时间。确认后自动生成 AI 建议。非法状态流转返回 409。",
        permission="按 action 分别校验 alarms.confirm / alarms.dispatch / alarms.close", parameters={"alarm_id": "告警唯一编号。"}, request_examples=ALARM_ACTION_EXAMPLES,
        response_example={"id": "alarm-trend-022", "status": "处理中", "assignment": {"assignee_id": "person-001", "priority": "urgent", "status": "assigned"}, "action_logs": [{"action": "dispatch", "from_status": "确认", "to_status": "处理中"}]}, errors=(401, 403, 404, 409, 422, 503),
    ),
    ("get", "/api/v1/statistics/risk-events"): _doc(
        "获取风险事件追溯数据", "返回风险事件列表、相关区域和主体轨迹，用于事件地图回放、里程碑及责任链展示。",
        permission="statistics.view", response_example={"items": [{"id": "alarm-trend-022", "name": "人员进入危险区域", "level": "严重", "status": "关闭", "start_time": "2026-07-19T10:32:15+08:00", "person": {"id": "person-001", "name": "张伟"}, "area": {"id": "area-example", "name": "一号罐区"}, "track": [{"x": 121.491, "y": 31.238, "time": "2026-07-19T10:30:00+08:00"}]}], "areas": []}, errors=(401, 403, 503),
    ),
    ("get", "/api/v1/statistics/overview"): _doc(
        "获取风险态势统计总览", "返回指标卡、趋势、占比、热力、TOP5 和设备类型统计。可使用最近天数或完整日期范围；传入任一日期时必须同时传入开始和结束日期，范围最长 366 天。",
        permission="statistics.view", parameters={"days": "最近天数，范围 1～30；未指定日期范围时生效。", "start_date": "自定义开始日期，必须与 end_date 同时提供。", "end_date": "自定义结束日期，必须与 start_date 同时提供，且不得早于开始日期。"},
        response_example={"range": {"start_date": "2026-07-13", "end_date": "2026-07-19", "days": 7}, "metrics": {"alarm_total": 128, "person_total": 50, "device_total": 48, "risk_area_total": 4, "device_online_rate": 95.8, "today_alarm_total": 12}, "alarm_trend": [], "risk_device_top5": []}, errors=(401, 403, 422, 503),
    ),
    ("get", "/api/v1/system/users"): _doc(
        "获取系统用户列表", "返回用户、角色、状态及最后登录时间。",
        permission="system.users.view", response_example={"items": [{"id": "user-super-admin-zhangsan", "username": "zhangsan", "display_name": "张三", "department": "运营中心", "status": "active", "role_id": "role-super-admin", "role_name": "超级管理员"}], "total": 1}, errors=(401, 403, 503),
    ),
    ("post", "/api/v1/system/users"): _doc(
        "创建系统用户", "创建可登录账号并绑定一个已有角色；用户名会自动转换为小写。",
        permission="system.users.create", request_examples={"user": {"summary": "创建安全员账号", "value": {"username": "safety.li", "password": "Safety@2026", "display_name": "李安全", "department": "安全管理部", "role_id": "role-safety-admin", "status": "active"}}}, response_status="201", response_example={"id": "user-example", "username": "safety.li", "display_name": "李安全", "status": "active", "role_id": "role-safety-admin", "role_name": "安全管理员"}, errors=(401, 403, 409, 422, 503),
    ),
    ("put", "/api/v1/system/users/{user_id}"): _doc(
        "修改系统用户", "修改显示名、部门、角色和启停状态，不修改用户名与密码。",
        permission="system.users.edit", parameters={"user_id": "系统用户唯一编号。"}, request_examples={"active_user": {"summary": "调整用户角色", "value": {"display_name": "李安全", "department": "安全管理部", "role_id": "role-safety-admin", "status": "active"}}}, response_example={"id": "user-example", "username": "safety.li", "display_name": "李安全", "status": "active", "role_name": "安全管理员"}, errors=(401, 403, 404, 422, 503),
    ),
    ("post", "/api/v1/system/users/{user_id}/reset-password"): _doc(
        "重置用户密码", "管理员重置指定用户密码，密码至少 8 位，并记录操作日志。",
        permission="system.users.reset", parameters={"user_id": "系统用户唯一编号。"}, request_examples={"password": {"summary": "设置新密码", "value": {"password": "NewPassword@2026"}}}, response_status="204", response_description="密码重置成功，响应体为空", errors=(401, 403, 404, 422, 503),
    ),
    ("get", "/api/v1/system/permissions"): _doc(
        "获取权限点目录", "返回后端支持的权限代码和所属模块，供角色权限矩阵使用。",
        permission="system.roles.view", response_example={"items": [{"code": "alarms.confirm", "name": "确认告警", "module": "告警中心"}]}, errors=(401, 403, 503),
    ),
    ("get", "/api/v1/system/roles"): _doc(
        "获取角色及权限", "返回所有角色、说明、启用状态、用户数量及已分配权限。",
        permission="system.roles.view", response_example={"items": [{"id": "role-safety-admin", "name": "安全管理员", "description": "负责风险区域与告警闭环", "enabled": True, "user_count": 3, "permission_codes": ["alarms.view", "alarms.confirm"]}]}, errors=(401, 403, 503),
    ),
    ("post", "/api/v1/system/roles"): _doc(
        "创建系统角色", "创建启用状态的空权限角色，随后使用权限更新接口分配权限点。",
        permission="system.roles.edit", request_examples={"role": {"summary": "创建巡检主管角色", "value": {"name": "巡检主管", "description": "负责设备巡检与告警处理"}}}, response_status="201", response_example={"id": "role-example", "name": "巡检主管", "description": "负责设备巡检与告警处理", "enabled": True, "permission_codes": []}, errors=(401, 403, 409, 422, 503),
    ),
    ("put", "/api/v1/system/roles/{role_id}/permissions"): _doc(
        "更新角色权限", "整体替换角色的权限点集合。未知权限代码会被拒绝；超级管理员角色受后端保护。",
        permission="system.roles.edit", parameters={"role_id": "系统角色唯一编号。"}, request_examples={"permissions": {"summary": "分配告警与设备权限", "value": {"permission_codes": ["dashboard.view", "devices.view", "alarms.view", "alarms.confirm", "alarms.dispatch"]}}}, response_status="204", response_description="权限更新成功，响应体为空", errors=(401, 403, 404, 422, 503),
    ),
    ("get", "/api/v1/system/dictionaries"): _doc(
        "获取数据字典", "返回管理端字典分组及全部字典项。value 是与业务表真实字段匹配的稳定值，name 和 color 是可动态调整的界面语义。",
        permission="system.dictionaries.view", response_example={"items": [{"code": "alarm_type", "name": "告警类型", "items": [{"id": "dict-alarm-area-intrusion", "code": "AREA_INTRUSION", "value": "人员进入危险区域", "name": "危险区域闯入", "color": "#ef4444", "order": 10, "status": "active", "remark": None}]}]}, errors=(401, 403, 503),
    ),
    ("get", "/api/v1/system/dictionaries/runtime"): _doc(
        "获取运行时数据字典", "返回所有启用字典项并按分组代码聚合。地图、筛选器、图例和状态标签使用该接口统一解析业务值、显示名称与颜色。",
        permission="登录用户", response_example={"revision": "2026-07-19T10:45:20+00:00", "groups": {"risk_level": [{"code": "HIGH", "value": "严重", "name": "严重风险", "color": "#ef4444", "order": 10, "remark": None}]}}, errors=(401, 503),
    ),
    ("post", "/api/v1/system/dictionaries/{group_code}/items"): _doc(
        "新增字典项", "向指定分组新增持久化字典项。code 是不可变管理编码；value 必须与业务接口和数据库字段的实际取值一致。",
        permission="system.dictionaries.edit", parameters={"group_code": "字典分组代码，例如 alarm_type。"}, request_examples={"item": {"summary": "新增告警类型", "value": {"code": "GAS_LEAK", "value": "可燃气体泄漏", "name": "气体泄漏", "color": "#ef4444", "order": 20, "status": "active", "remark": "气体传感器触发"}}}, response_status="201", response_example={"id": "dict-example"}, errors=(401, 403, 404, 409, 422, 503),
    ),
    ("put", "/api/v1/system/dictionaries/items/{item_id}"): _doc(
        "修改字典项", "修改显示名称、颜色、排序、状态和备注。code 与 value 均是稳定数据绑定键，创建后不可修改。",
        permission="system.dictionaries.edit", parameters={"item_id": "字典项唯一编号。"}, request_examples={"item": {"summary": "调整字典展示", "value": {"value": "可燃气体泄漏", "name": "气体泄漏", "color": "#dc2626", "order": 10, "status": "active", "remark": "高优先级气体告警"}}}, response_example={"id": "dict-example"}, errors=(401, 403, 404, 409, 422, 503),
    ),
    ("delete", "/api/v1/system/dictionaries/items/{item_id}"): _doc(
        "删除字典项", "永久删除指定字典项并记录操作日志。该操作不可撤销。",
        permission="system.dictionaries.edit", parameters={"item_id": "待删除字典项唯一编号。"}, response_status="204", response_description="删除成功，响应体为空", errors=(401, 403, 404, 503),
    ),
    ("get", "/api/v1/system/operation-logs"): _doc(
        "查询系统操作日志", "按模块、结果、关键词和日期筛选审计日志，按时间倒序返回。",
        permission="system.logs.view", parameters={"module": "业务模块精确匹配。", "result": "操作结果，例如 success 或 failure。", "keyword": "模糊匹配用户名、显示名、目标编号、动作或日志编号。", "date": "日志日期，格式 YYYY-MM-DD。", "limit": "最大返回条数，范围 1～500，默认 200。"}, response_example={"items": [{"id": "log-example", "created_at": "2026-07-19T10:45:20+08:00", "username": "zhangsan", "display_name": "张三", "module": "数据字典", "action": "修改字典项", "target_type": "dictionary_item", "target_id": "dict-example", "result": "success", "ip_address": "127.0.0.1", "detail": "更新字典项 GAS_LEAK", "changes": {}}], "total": 1}, errors=(401, 403, 422, 503),
    ),
}


ERROR_RESPONSES: dict[int, dict[str, Any]] = {
    401: {"description": "未登录、账号不可用或访问令牌已失效", "content": {"application/json": {"examples": {"unauthorized": {"summary": "未登录", "value": {"detail": "请先登录"}}, "expired": {"summary": "令牌失效", "value": {"detail": "登录状态已失效，请重新登录"}}}}}},
    403: {"description": "当前角色缺少所需权限", "content": {"application/json": {"example": {"detail": "缺少权限：alarms.confirm"}}}},
    404: {"description": "指定资源不存在", "content": {"application/json": {"example": {"detail": "Resource not found"}}}},
    409: {"description": "资源冲突或当前业务状态不允许该操作", "content": {"application/json": {"example": {"detail": "当前状态不允许执行该操作，请刷新后重试"}}}},
    422: {"description": "请求参数格式错误或未通过业务校验", "content": {"application/json": {"examples": {"validation": {"summary": "字段校验失败", "value": {"detail": [{"loc": ["body", "name"], "msg": "Field required", "type": "missing"}]}}, "business": {"summary": "业务校验失败", "value": {"detail": "开始日期不得晚于结束日期"}}}}}},
    503: {"description": "数据库、AI 服务或其他后端依赖暂时不可用", "content": {"application/json": {"example": {"detail": "Service temporarily unavailable"}}}},
}


SCHEMA_DOCS: dict[str, dict[str, Any]] = {
    "LoginRequest": {
        "description": "登录凭据。用户名不区分大小写，密码区分大小写。",
        "fields": {"username": "登录账号，3～40 个字符。", "password": "登录密码，8～128 个字符。"},
        "example": {"username": "zhangsan", "password": "PetroShield@2026"},
    },
    "DeviceUpdate": {
        "description": "设备档案及实时状态的完整更新数据。",
        "fields": {
            "name": "设备名称。", "type": "设备大类，例如视频设备、传感器。", "category": "设备细分类别。",
            "model": "产品型号。", "manufacturer": "生产厂商。", "serial_number": "设备序列号。",
            "install_date": "安装时间，ISO 8601 格式。", "region_id": "所属风险区域编号，可为空。",
            "location": "地图坐标及可选位置文字，通常包含 x、y。", "realtime_status": "最新运行状态。",
        },
        "example": {"name": "一号罐区摄像机 A01", "type": "视频设备", "category": "摄像机", "model": "DS-2CD7A", "manufacturer": "海康威视", "serial_number": "CAM-A01-2026", "install_date": "2026-06-01T08:00:00+08:00", "region_id": "area-example", "location": {"x": 121.4941, "y": 31.2402}, "realtime_status": "online"},
    },
    "Coordinate": {
        "description": "百度地图坐标点。",
        "fields": {"x": "经度。", "y": "纬度。"},
        "example": {"x": 121.4941, "y": 31.2402},
    },
    "RiskRules": {
        "description": "电子围栏触发规则。",
        "fields": {"cross_boundary": "是否启用越界告警。", "dwell_enabled": "是否启用超时停留告警。", "dwell_minutes": "允许停留分钟数。", "capacity_enabled": "是否启用区域超员告警。", "max_people": "区域允许的最大人数。", "priority": "规则触发后的处置优先级。"},
        "example": {"cross_boundary": True, "dwell_enabled": True, "dwell_minutes": 15, "capacity_enabled": True, "max_people": 20, "priority": "high"},
    },
    "AreaWrite": {
        "description": "风险区域及其电子围栏配置。多边形使用 polygon；圆形使用 center 和 radius。",
        "fields": {"name": "区域名称。", "type": "区域类型：danger 危险、restricted 限制、prohibited 禁入、normal 普通。", "risk_level": "风险等级：low、medium、high。", "shape": "围栏形状：polygon 多边形或 circle 圆形。", "polygon": "多边形顶点列表，至少 3 个点。", "center": "圆形中心点。", "radius": "圆形半径，单位米。", "enabled": "区域规则是否启用。", "manager_name": "区域负责人姓名。", "manager_department": "负责人所属部门。", "rules": "电子围栏触发规则。"},
    },
    "AlarmAction": {
        "description": "告警状态流转操作。操作人姓名与角色以后端当前登录用户为准，客户端传值会被覆盖。",
        "fields": {"action": "动作：confirm 确认、mark_false_positive 误报、dispatch 派单、submit_feedback 反馈、review_approve 复核通过、review_reject 退回、close 关闭。", "operator_name": "操作人姓名；由后端覆盖。", "operator_role": "操作人角色；由后端覆盖。", "comment": "操作说明；除派单外的大多数流程动作必填。", "assignee_id": "处理人员编号，派单时必填。", "department": "处理部门。", "priority": "派单优先级。", "instruction": "处置要求，派单时必填。", "due_time": "要求完成时间，派单时必填且必须晚于当前时间。", "evidence": "现场反馈证据列表，可包含图片或视频 URL。"},
        "example": {"action": "confirm", "comment": "已核对视频与定位，确认为真实告警"},
    },
    "UserCreate": {
        "description": "新建后台登录用户。",
        "fields": {"username": "登录账号，以字母开头，只允许字母、数字、点、下划线和连字符。", "password": "初始密码，至少 8 位。", "display_name": "界面显示姓名。", "department": "所属部门。", "role_id": "绑定角色编号。", "status": "账号状态：active 启用、disabled 停用。"},
        "example": {"username": "safety.li", "password": "Safety@2026", "display_name": "李安全", "department": "安全管理部", "role_id": "role-safety-admin", "status": "active"},
    },
    "UserUpdate": {
        "description": "修改后台用户资料与角色，不包含用户名和密码。",
        "fields": {"display_name": "界面显示姓名。", "department": "所属部门。", "role_id": "绑定角色编号。", "status": "账号状态：active 启用、disabled 停用。"},
        "example": {"display_name": "李安全", "department": "安全管理部", "role_id": "role-safety-admin", "status": "active"},
    },
    "PasswordReset": {
        "description": "管理员重置用户密码。",
        "fields": {"password": "新密码，8～128 个字符。"},
        "example": {"password": "NewPassword@2026"},
    },
    "RoleCreate": {
        "description": "新建系统角色。",
        "fields": {"name": "角色名称。", "description": "角色职责说明。"},
        "example": {"name": "巡检主管", "description": "负责设备巡检与告警处理"},
    },
    "RolePermissionsUpdate": {
        "description": "角色权限点的完整集合，提交后覆盖原权限。",
        "fields": {"permission_codes": "权限代码列表，代码必须存在于权限目录中。"},
        "example": {"permission_codes": ["dashboard.view", "devices.view", "alarms.view", "alarms.confirm"]},
    },
    "DictionaryItemCreate": {
        "description": "新建数据字典项。",
        "fields": {"code": "字典项管理编码，以字母开头，保存时转换为大写。", "value": "业务值，必须与业务表或接口字段的真实取值完全一致。", "name": "界面显示名称。", "color": "十六进制主题色，例如 #ef4444。", "order": "排序值，越小越靠前。", "status": "状态：active 启用、disabled 停用。", "remark": "用途或业务备注。"},
        "example": {"code": "GAS_LEAK", "value": "可燃气体泄漏", "name": "气体泄漏", "color": "#ef4444", "order": 20, "status": "active", "remark": "气体传感器触发"},
    },
    "DictionaryItemUpdate": {
        "description": "修改数据字典项的展示属性，代码和业务值不可修改。",
        "fields": {"value": "原业务值，用于并发校验，不允许修改。", "name": "界面显示名称。", "color": "十六进制主题色。", "order": "排序值，越小越靠前。", "status": "状态：active 启用、disabled 停用。", "remark": "用途或业务备注。"},
        "example": {"value": "可燃气体泄漏", "name": "气体泄漏", "color": "#dc2626", "order": 10, "status": "active", "remark": "高优先级气体告警"},
    },
}


def _apply_parameter_docs(operation: dict[str, Any], docs: dict[str, Any]) -> None:
    parameter_docs = docs.get("parameters", {})
    for parameter in operation.get("parameters", []):
        value = parameter_docs.get(parameter.get("name"))
        if isinstance(value, str):
            parameter["description"] = value
        elif isinstance(value, dict):
            parameter.update(value)


def _apply_request_examples(operation: dict[str, Any], examples: dict[str, Any] | None) -> None:
    if not examples:
        return
    request_body = operation.get("requestBody", {})
    media_type = request_body.get("content", {}).get("application/json")
    if media_type is not None:
        media_type.pop("example", None)
        media_type["examples"] = deepcopy(examples)


def _apply_response_docs(operation: dict[str, Any], docs: dict[str, Any]) -> None:
    responses = operation.setdefault("responses", {})
    status_code = docs["response_status"]
    response = responses.setdefault(status_code, {})
    response["description"] = docs["response_description"]
    if docs["response_example"] is not None and status_code != "204":
        media_type = response.setdefault("content", {}).setdefault("application/json", {})
        media_type["example"] = deepcopy(docs["response_example"])
    for error_code in docs["errors"]:
        responses[str(error_code)] = deepcopy(ERROR_RESPONSES[error_code])


def _apply_schema_docs(schema: dict[str, Any]) -> None:
    schemas = schema.get("components", {}).get("schemas", {})
    for schema_name, docs in SCHEMA_DOCS.items():
        component = schemas.get(schema_name)
        if component is None:
            continue
        component["description"] = docs["description"]
        if docs.get("example") is not None:
            component["example"] = deepcopy(docs["example"])
        for field_name, description in docs.get("fields", {}).items():
            field = component.get("properties", {}).get(field_name)
            if field is not None:
                field["description"] = description


def configure_openapi(app: FastAPI) -> None:
    """Attach Chinese operation docs and realistic samples to the app schema."""

    def custom_openapi() -> dict[str, Any]:
        if app.openapi_schema:
            return app.openapi_schema
        schema = get_openapi(
            title=app.title,
            version=app.version,
            summary=app.summary,
            description=app.description,
            routes=app.routes,
            tags=app.openapi_tags,
            servers=app.servers,
        )
        for (method, path), docs in OPERATION_DOCS.items():
            operation = schema.get("paths", {}).get(path, {}).get(method)
            if operation is None:
                continue
            operation["summary"] = docs["summary"]
            operation["description"] = docs["description"]
            _apply_parameter_docs(operation, docs)
            _apply_request_examples(operation, docs["request_examples"])
            _apply_response_docs(operation, docs)
        _apply_schema_docs(schema)
        app.openapi_schema = schema
        return schema

    app.openapi = custom_openapi
