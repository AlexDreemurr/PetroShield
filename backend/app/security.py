import base64
import hashlib
import hmac
import json
import os
import time
from collections.abc import Callable
from typing import Any

import asyncpg
from fastapi import Depends, HTTPException, Request, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from app.api.routes.dashboard import create_ssl_context, get_database_url, should_use_ssl

bearer_scheme = HTTPBearer(auto_error=False)


def _encode_part(value: bytes) -> str:
    return base64.urlsafe_b64encode(value).rstrip(b"=").decode("ascii")


def _decode_part(value: str) -> bytes:
    return base64.urlsafe_b64decode(value + "=" * (-len(value) % 4))


def get_jwt_secret() -> str:
    secret = os.getenv("AUTH_JWT_SECRET", "").strip()
    if len(secret) < 32:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="AUTH_JWT_SECRET must be configured with at least 32 characters",
        )
    return secret


def create_access_token(user_id: str) -> tuple[str, int]:
    now = int(time.time())
    expires_in = int(os.getenv("AUTH_TOKEN_EXPIRE_MINUTES", "480")) * 60
    header = _encode_part(json.dumps({"alg": "HS256", "typ": "JWT"}, separators=(",", ":")).encode())
    payload = _encode_part(json.dumps({"sub": user_id, "iat": now, "exp": now + expires_in}, separators=(",", ":")).encode())
    signature = _encode_part(hmac.new(get_jwt_secret().encode(), f"{header}.{payload}".encode(), hashlib.sha256).digest())
    return f"{header}.{payload}.{signature}", expires_in


def decode_access_token(token: str) -> dict[str, Any]:
    try:
        header, payload, signature = token.split(".")
        expected = _encode_part(hmac.new(get_jwt_secret().encode(), f"{header}.{payload}".encode(), hashlib.sha256).digest())
        if not hmac.compare_digest(signature, expected):
            raise ValueError("invalid signature")
        claims = json.loads(_decode_part(payload))
        if int(claims["exp"]) <= int(time.time()):
            raise ValueError("expired token")
        return claims
    except (ValueError, KeyError, TypeError, json.JSONDecodeError) as exc:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="登录状态已失效，请重新登录") from exc


async def connect_database() -> asyncpg.Connection:
    database_url = get_database_url()
    if not database_url:
        raise HTTPException(status_code=503, detail="DATABASE_URL or SUPABASE_DB_URL is not configured")
    return await asyncpg.connect(
        database_url,
        ssl=create_ssl_context() if should_use_ssl(database_url) else None,
        statement_cache_size=0,
    )


def serialize_current_user(row: asyncpg.Record) -> dict[str, Any]:
    return {
        "id": row["id"],
        "username": row["username"],
        "display_name": row["display_name"],
        "department": row["department"],
        "status": row["status"],
        "last_login_at": row["last_login_at"].isoformat() if row["last_login_at"] else None,
        "role": {"id": row["role_id"], "name": row["role_name"]},
        "permissions": list(row["permissions"] or []),
    }


async def get_current_user(
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer_scheme),
) -> dict[str, Any]:
    if credentials is None or credentials.scheme.lower() != "bearer":
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="请先登录")
    claims = decode_access_token(credentials.credentials)
    connection = await connect_database()
    try:
        row = await connection.fetchrow(
            """
            select u.id, u.username, u.display_name, u.department, u.status,
                   u.last_login_at, r.id as role_id, r.name as role_name,
                   coalesce(array_agg(rp.permission_code order by rp.permission_code)
                     filter (where rp.permission_code is not null), '{}') as permissions
            from public.system_user u
            join public.system_role r on r.id = u.role_id and r.enabled = true
            left join public.system_role_permission rp on rp.role_id = r.id
            where u.id = $1 and u.status = 'active'
            group by u.id, r.id
            """,
            claims["sub"],
        )
    finally:
        await connection.close()
    if not row:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="账号已停用或不存在")
    return serialize_current_user(row)


def require_permission(code: str) -> Callable:
    async def dependency(user: dict[str, Any] = Depends(get_current_user)) -> dict[str, Any]:
        if code not in user["permissions"]:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=f"缺少权限：{code}")
        return user
    return dependency


def ensure_permission(user: dict[str, Any], code: str) -> None:
    if code not in user["permissions"]:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=f"缺少权限：{code}")


def request_ip(request: Request) -> str | None:
    forwarded = request.headers.get("x-forwarded-for")
    if forwarded:
        return forwarded.split(",", 1)[0].strip()
    return request.client.host if request.client else None


async def write_operation_log(
    connection: asyncpg.Connection,
    *,
    user: dict[str, Any] | None,
    module: str,
    action: str,
    target_type: str | None = None,
    target_id: str | None = None,
    result: str = "success",
    ip_address: str | None = None,
    detail: str | None = None,
    changes: dict[str, Any] | None = None,
) -> None:
    await connection.execute(
        """
        insert into public.system_operation_log (
          user_id, username, display_name, module, action, target_type,
          target_id, result, ip_address, detail, changes
        ) values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11::jsonb)
        """,
        user["id"] if user else None,
        user["username"] if user else None,
        user["display_name"] if user else None,
        module,
        action,
        target_type,
        target_id,
        result,
        ip_address,
        detail,
        json.dumps(changes or {}, ensure_ascii=False),
    )
