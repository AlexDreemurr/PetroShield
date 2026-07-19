from fastapi import APIRouter, Depends, HTTPException, Request, status
from pydantic import BaseModel, Field, field_validator

from app.security import (
    connect_database,
    create_access_token,
    get_current_user,
    request_ip,
    serialize_current_user,
    write_operation_log,
)

router = APIRouter()


class LoginRequest(BaseModel):
    username: str = Field(min_length=3, max_length=40)
    password: str = Field(min_length=8, max_length=128)

    @field_validator("username")
    @classmethod
    def normalize_username(cls, value: str) -> str:
        return value.strip().lower()


@router.post("/login")
async def login(payload: LoginRequest, request: Request):
    connection = await connect_database()
    try:
        ip_address = request_ip(request)
        recent_failures = await connection.fetchval(
            """
            select count(*) from public.system_operation_log
            where module = '系统认证' and action = '登录' and result = 'failure'
              and target_id = $1 and coalesce(ip_address, '') = coalesce($2, '')
              and created_at >= now() - interval '10 minutes'
            """,
            payload.username,
            ip_address,
        )
        if recent_failures >= 5:
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail="登录失败次数过多，请10分钟后重试",
            )
        row = await connection.fetchrow(
            """
            select u.id, u.username, u.display_name, u.department, u.status,
                   u.last_login_at, r.id as role_id, r.name as role_name,
                   coalesce(array_agg(rp.permission_code order by rp.permission_code)
                     filter (where rp.permission_code is not null), '{}') as permissions
            from public.system_user u
            join public.system_role r on r.id = u.role_id and r.enabled = true
            left join public.system_role_permission rp on rp.role_id = r.id
            where lower(u.username) = $1
              and u.password_hash = extensions.crypt($2, u.password_hash)
            group by u.id, r.id
            """,
            payload.username,
            payload.password,
        )
        if not row or row["status"] != "active":
            await write_operation_log(
                connection,
                user=None,
                module="系统认证",
                action="登录",
                target_type="system_user",
                target_id=payload.username,
                result="failure",
                ip_address=ip_address,
                detail="用户名、密码错误或账号已停用",
            )
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="账号或密码错误")

        await connection.execute(
            "update public.system_user set last_login_at = now() where id = $1",
            row["id"],
        )
        user = serialize_current_user(row)
        await write_operation_log(
            connection,
            user=user,
            module="系统认证",
            action="登录",
            target_type="system_user",
            target_id=user["id"],
            ip_address=ip_address,
            detail="登录成功",
        )
        token, expires_in = create_access_token(user["id"])
        return {"access_token": token, "token_type": "bearer", "expires_in": expires_in, "user": user}
    finally:
        await connection.close()


@router.get("/me")
async def me(user: dict = Depends(get_current_user)):
    return user


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
async def logout(request: Request, user: dict = Depends(get_current_user)):
    connection = await connect_database()
    try:
        await write_operation_log(
            connection,
            user=user,
            module="系统认证",
            action="退出登录",
            target_type="system_user",
            target_id=user["id"],
            ip_address=request_ip(request),
            detail="用户主动退出登录",
        )
    finally:
        await connection.close()
