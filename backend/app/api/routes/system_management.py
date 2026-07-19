from datetime import date
from typing import Literal

import asyncpg
from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from pydantic import BaseModel, Field, field_validator

from app.security import connect_database, get_current_user, request_ip, require_permission, write_operation_log

router = APIRouter()


class UserCreate(BaseModel):
    username: str = Field(min_length=3, max_length=40, pattern=r"^[A-Za-z][A-Za-z0-9._-]+$")
    password: str = Field(min_length=8, max_length=128)
    display_name: str = Field(min_length=1, max_length=80)
    department: str | None = Field(default=None, max_length=120)
    role_id: str = Field(min_length=1, max_length=80)
    status: Literal["active", "disabled"] = "active"

    @field_validator("username")
    @classmethod
    def normalize_username(cls, value: str) -> str:
        return value.strip().lower()


class UserUpdate(BaseModel):
    display_name: str = Field(min_length=1, max_length=80)
    department: str | None = Field(default=None, max_length=120)
    role_id: str = Field(min_length=1, max_length=80)
    status: Literal["active", "disabled"]


class PasswordReset(BaseModel):
    password: str = Field(min_length=8, max_length=128)


class RoleCreate(BaseModel):
    name: str = Field(min_length=2, max_length=80)
    description: str | None = Field(default=None, max_length=240)


class RolePermissionsUpdate(BaseModel):
    permission_codes: list[str] = Field(default_factory=list, max_length=200)


class DictionaryItemCreate(BaseModel):
    code: str = Field(min_length=2, max_length=64, pattern=r"^[A-Za-z][A-Za-z0-9_]+$")
    value: str = Field(min_length=1, max_length=120)
    name: str = Field(min_length=1, max_length=80)
    color: str = Field(default="#2563eb", pattern=r"^#[0-9A-Fa-f]{6}$")
    order: int = Field(default=0, ge=0, le=99999)
    status: Literal["active", "disabled"] = "active"
    remark: str | None = Field(default=None, max_length=300)

    @field_validator("code")
    @classmethod
    def normalize_code(cls, value: str) -> str:
        return value.strip().upper()


class DictionaryItemUpdate(BaseModel):
    value: str = Field(min_length=1, max_length=120)
    name: str = Field(min_length=1, max_length=80)
    color: str = Field(pattern=r"^#[0-9A-Fa-f]{6}$")
    order: int = Field(ge=0, le=99999)
    status: Literal["active", "disabled"]
    remark: str | None = Field(default=None, max_length=300)


def iso(value):
    return value.isoformat() if value else None


def user_item(row: asyncpg.Record) -> dict:
    return {
        "id": row["id"], "username": row["username"], "display_name": row["display_name"],
        "department": row["department"], "status": row["status"], "role_id": row["role_id"],
        "role_name": row["role_name"], "last_login_at": iso(row["last_login_at"]),
        "created_at": iso(row["created_at"]),
    }


@router.get("/users")
async def list_users(user: dict = Depends(require_permission("system.users.view"))):
    connection = await connect_database()
    try:
        rows = await connection.fetch(
            """
            select u.id, u.username, u.display_name, u.department, u.status,
                   u.role_id, r.name as role_name, u.last_login_at, u.created_at
            from public.system_user u join public.system_role r on r.id = u.role_id
            order by u.created_at, u.username
            """
        )
        return {"items": [user_item(row) for row in rows], "total": len(rows)}
    finally:
        await connection.close()


@router.post("/users", status_code=status.HTTP_201_CREATED)
async def create_user(payload: UserCreate, request: Request, user: dict = Depends(require_permission("system.users.create"))):
    connection = await connect_database()
    try:
        async with connection.transaction():
            row = await connection.fetchrow(
                """
                insert into public.system_user (
                  username, password_hash, display_name, department, role_id, status
                ) values ($1, extensions.crypt($2, extensions.gen_salt('bf', 12)), $3, $4, $5, $6)
                returning id
                """,
                payload.username, payload.password, payload.display_name.strip(),
                payload.department.strip() if payload.department else None, payload.role_id, payload.status,
            )
            await write_operation_log(connection, user=user, module="用户管理", action="新增用户", target_type="system_user", target_id=row["id"], ip_address=request_ip(request), detail=f"创建账号 {payload.username}")
        return {"id": row["id"]}
    except asyncpg.UniqueViolationError as exc:
        raise HTTPException(status_code=409, detail="登录账号已存在") from exc
    except asyncpg.ForeignKeyViolationError as exc:
        raise HTTPException(status_code=422, detail="所选角色不存在") from exc
    finally:
        await connection.close()


@router.put("/users/{user_id}")
async def update_user(user_id: str, payload: UserUpdate, request: Request, user: dict = Depends(require_permission("system.users.edit"))):
    connection = await connect_database()
    try:
        async with connection.transaction():
            current = await connection.fetchrow("select u.*, r.name as role_name from public.system_user u join public.system_role r on r.id=u.role_id where u.id=$1 for update", user_id)
            if not current:
                raise HTTPException(status_code=404, detail="用户不存在")
            if current["role_name"] == "超级管理员" and (payload.status == "disabled" or payload.role_id != current["role_id"]):
                count = await connection.fetchval("select count(*) from public.system_user u join public.system_role r on r.id=u.role_id where r.name='超级管理员' and u.status='active'")
                if count <= 1:
                    raise HTTPException(status_code=409, detail="不能停用或降级最后一个超级管理员")
            updated = await connection.fetchrow(
                """update public.system_user set display_name=$2, department=$3, role_id=$4, status=$5
                   where id=$1 returning id""",
                user_id, payload.display_name.strip(), payload.department.strip() if payload.department else None,
                payload.role_id, payload.status,
            )
            await write_operation_log(connection, user=user, module="用户管理", action="编辑用户", target_type="system_user", target_id=user_id, ip_address=request_ip(request), detail=f"编辑账号 {current['username']}", changes={"before": {"role_id": current["role_id"], "status": current["status"]}, "after": {"role_id": payload.role_id, "status": payload.status}})
        return {"id": updated["id"]}
    except asyncpg.ForeignKeyViolationError as exc:
        raise HTTPException(status_code=422, detail="所选角色不存在") from exc
    finally:
        await connection.close()


@router.post("/users/{user_id}/reset-password", status_code=status.HTTP_204_NO_CONTENT)
async def reset_password(user_id: str, payload: PasswordReset, request: Request, user: dict = Depends(require_permission("system.users.reset"))):
    connection = await connect_database()
    try:
        result = await connection.execute("update public.system_user set password_hash=extensions.crypt($2, extensions.gen_salt('bf', 12)), password_changed_at=now() where id=$1", user_id, payload.password)
        if result == "UPDATE 0":
            raise HTTPException(status_code=404, detail="用户不存在")
        await write_operation_log(connection, user=user, module="用户管理", action="重置密码", target_type="system_user", target_id=user_id, ip_address=request_ip(request), detail="管理员重置用户密码")
    finally:
        await connection.close()


@router.get("/permissions")
async def list_permissions(user: dict = Depends(require_permission("system.roles.view"))):
    connection = await connect_database()
    try:
        rows = await connection.fetch("select code, module, action, name, description, sort_order from public.system_permission order by sort_order, code")
        return {"items": [dict(row) for row in rows]}
    finally:
        await connection.close()


@router.get("/roles")
async def list_roles(user: dict = Depends(require_permission("system.roles.view"))):
    connection = await connect_database()
    try:
        rows = await connection.fetch(
            """
            select r.id, r.name, r.description, r.is_system, r.enabled,
                   count(distinct u.id) as user_count,
                   coalesce(array_agg(distinct rp.permission_code order by rp.permission_code)
                     filter (where rp.permission_code is not null), '{}') as permission_codes
            from public.system_role r
            left join public.system_user u on u.role_id=r.id
            left join public.system_role_permission rp on rp.role_id=r.id
            group by r.id order by r.is_system desc, r.created_at
            """
        )
        return {"items": [{**dict(row), "permission_codes": list(row["permission_codes"] or [])} for row in rows]}
    finally:
        await connection.close()


@router.post("/roles", status_code=status.HTTP_201_CREATED)
async def create_role(payload: RoleCreate, request: Request, user: dict = Depends(require_permission("system.roles.edit"))):
    connection = await connect_database()
    try:
        row = await connection.fetchrow("insert into public.system_role (name, description) values ($1,$2) returning id", payload.name.strip(), payload.description.strip() if payload.description else None)
        await write_operation_log(connection, user=user, module="角色权限", action="新增角色", target_type="system_role", target_id=row["id"], ip_address=request_ip(request), detail=f"创建角色 {payload.name.strip()}")
        return {"id": row["id"]}
    except asyncpg.UniqueViolationError as exc:
        raise HTTPException(status_code=409, detail="角色名称已存在") from exc
    finally:
        await connection.close()


@router.put("/roles/{role_id}/permissions", status_code=status.HTTP_204_NO_CONTENT)
async def update_role_permissions(role_id: str, payload: RolePermissionsUpdate, request: Request, user: dict = Depends(require_permission("system.roles.edit"))):
    connection = await connect_database()
    try:
        async with connection.transaction():
            role = await connection.fetchrow("select id, name from public.system_role where id=$1 for update", role_id)
            if not role:
                raise HTTPException(status_code=404, detail="角色不存在")
            if role["name"] == "超级管理员":
                raise HTTPException(status_code=409, detail="超级管理员固定拥有全部权限")
            valid_codes = set(await connection.fetchval("select coalesce(array_agg(code), '{}') from public.system_permission"))
            requested = set(payload.permission_codes)
            unknown = requested - valid_codes
            if unknown:
                raise HTTPException(status_code=422, detail=f"存在无效权限：{', '.join(sorted(unknown))}")
            before = list(await connection.fetchval("select coalesce(array_agg(permission_code), '{}') from public.system_role_permission where role_id=$1", role_id))
            await connection.execute("delete from public.system_role_permission where role_id=$1", role_id)
            if requested:
                await connection.executemany("insert into public.system_role_permission (role_id, permission_code) values ($1,$2)", [(role_id, code) for code in sorted(requested)])
            await write_operation_log(connection, user=user, module="角色权限", action="修改权限", target_type="system_role", target_id=role_id, ip_address=request_ip(request), detail=f"更新角色 {role['name']} 权限", changes={"before": before, "after": sorted(requested)})
    finally:
        await connection.close()


@router.get("/dictionaries")
async def list_dictionaries(user: dict = Depends(require_permission("system.dictionaries.view"))):
    connection = await connect_database()
    try:
        group_rows = await connection.fetch(
            """select id, code, name, description, sort_order
               from public.system_dictionary_group order by sort_order, code"""
        )
        item_rows = await connection.fetch(
            """select i.id, g.code as group_code, i.code, i.business_value, i.name, i.color,
                      i.sort_order, i.status, i.remark, i.updated_at
               from public.system_dictionary_item i
               join public.system_dictionary_group g on g.id=i.group_id
               order by g.sort_order, i.sort_order, i.code"""
        )
        items_by_group: dict[str, list[dict]] = {}
        for row in item_rows:
            items_by_group.setdefault(row["group_code"], []).append({
                "id": row["id"], "code": row["code"], "value": row["business_value"], "name": row["name"],
                "color": row["color"], "order": row["sort_order"],
                "status": row["status"], "remark": row["remark"] or "",
                "updated_at": iso(row["updated_at"]),
            })
        groups = [
            {
                "id": row["code"], "database_id": row["id"], "name": row["name"],
                "description": row["description"] or "", "order": row["sort_order"],
                "items": items_by_group.get(row["code"], []),
            }
            for row in group_rows
        ]
        return {"items": groups, "total": len(groups)}
    finally:
        await connection.close()


@router.get("/dictionaries/runtime")
async def get_runtime_dictionaries(user: dict = Depends(get_current_user)):
    connection = await connect_database()
    try:
        group_rows = await connection.fetch(
            "select code from public.system_dictionary_group order by sort_order, code"
        )
        rows = await connection.fetch(
            """
            select g.code as group_code, i.code, i.business_value,
                   i.name, i.color, i.sort_order, i.remark, i.updated_at
            from public.system_dictionary_item i
            join public.system_dictionary_group g on g.id = i.group_id
            where i.status = 'active'
            order by g.sort_order, i.sort_order, i.code;
            """
        )
        revision = max((row["updated_at"] for row in rows), default=None)
        groups: dict[str, list[dict]] = {row["code"]: [] for row in group_rows}
        for row in rows:
            groups.setdefault(row["group_code"], []).append({
                "code": row["code"],
                "value": row["business_value"],
                "name": row["name"],
                "color": row["color"],
                "order": row["sort_order"],
                "remark": row["remark"] or "",
            })
        return {"revision": iso(revision), "groups": groups}
    finally:
        await connection.close()


@router.post("/dictionaries/{group_code}/items", status_code=status.HTTP_201_CREATED)
async def create_dictionary_item(group_code: str, payload: DictionaryItemCreate, request: Request, user: dict = Depends(require_permission("system.dictionaries.edit"))):
    connection = await connect_database()
    try:
        async with connection.transaction():
            group = await connection.fetchrow("select id, name from public.system_dictionary_group where code=$1", group_code)
            if not group:
                raise HTTPException(status_code=404, detail="字典分类不存在")
            row = await connection.fetchrow(
                """insert into public.system_dictionary_item
                     (group_id, code, business_value, name, color, sort_order, status, remark)
                     values ($1,$2,$3,$4,$5,$6,$7,$8) returning id""",
                group["id"], payload.code, payload.value.strip(), payload.name.strip(), payload.color,
                payload.order, payload.status, payload.remark.strip() if payload.remark else None,
            )
            await write_operation_log(connection, user=user, module="数据字典", action="新增字典项", target_type="system_dictionary_item", target_id=row["id"], ip_address=request_ip(request), detail=f"在{group['name']}中新增 {payload.code}")
        return {"id": row["id"]}
    except asyncpg.UniqueViolationError as exc:
        raise HTTPException(status_code=409, detail="该分类下的字典编码或业务值已存在") from exc
    finally:
        await connection.close()


@router.put("/dictionaries/items/{item_id}")
async def update_dictionary_item(item_id: str, payload: DictionaryItemUpdate, request: Request, user: dict = Depends(require_permission("system.dictionaries.edit"))):
    connection = await connect_database()
    try:
        async with connection.transaction():
            current = await connection.fetchrow("select * from public.system_dictionary_item where id=$1 for update", item_id)
            if not current:
                raise HTTPException(status_code=404, detail="字典项不存在")
            if payload.value.strip() != current["business_value"]:
                raise HTTPException(status_code=409, detail="业务值是数据绑定键，创建后不可修改；请新建字典项")
            await connection.execute(
                """update public.system_dictionary_item
                   set name=$2, color=$3, sort_order=$4, status=$5, remark=$6 where id=$1""",
                item_id, payload.name.strip(), payload.color, payload.order,
                payload.status, payload.remark.strip() if payload.remark else None,
            )
            await write_operation_log(connection, user=user, module="数据字典", action="编辑字典项", target_type="system_dictionary_item", target_id=item_id, ip_address=request_ip(request), detail=f"编辑字典项 {current['code']}", changes={"before": {"value": current["business_value"], "name": current["name"], "color": current["color"], "order": current["sort_order"], "status": current["status"], "remark": current["remark"]}, "after": payload.model_dump()})
        return {"id": item_id}
    except asyncpg.UniqueViolationError as exc:
        raise HTTPException(status_code=409, detail="该分类下的业务值已存在") from exc
    finally:
        await connection.close()


@router.delete("/dictionaries/items/{item_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_dictionary_item(item_id: str, request: Request, user: dict = Depends(require_permission("system.dictionaries.edit"))):
    connection = await connect_database()
    try:
        async with connection.transaction():
            current = await connection.fetchrow("delete from public.system_dictionary_item where id=$1 returning code, name", item_id)
            if not current:
                raise HTTPException(status_code=404, detail="字典项不存在")
            await write_operation_log(connection, user=user, module="数据字典", action="删除字典项", target_type="system_dictionary_item", target_id=item_id, ip_address=request_ip(request), detail=f"删除字典项 {current['code']} / {current['name']}")
    finally:
        await connection.close()


@router.get("/operation-logs")
async def list_operation_logs(
    module: str | None = None,
    result: str | None = None,
    keyword: str | None = None,
    log_date: date | None = Query(default=None, alias="date"),
    limit: int = Query(default=200, ge=1, le=500),
    user: dict = Depends(require_permission("system.logs.view")),
):
    connection = await connect_database()
    try:
        rows = await connection.fetch(
            """
            select id, created_at, username, display_name, module, action,
                   target_type, target_id, result, ip_address, detail, changes
            from public.system_operation_log
            where ($1::text is null or module=$1)
              and ($2::text is null or result=$2)
              and ($3::text is null or concat_ws(' ', username, display_name, target_id, action, id) ilike '%' || $3 || '%')
              and ($4::date is null or created_at >= $4::date and created_at < $4::date + interval '1 day')
            order by created_at desc limit $5
            """,
            module, result, keyword.strip() if keyword else None, log_date, limit,
        )
        return {"items": [{**dict(row), "created_at": iso(row["created_at"]), "changes": row["changes"] or {}} for row in rows], "total": len(rows)}
    finally:
        await connection.close()
