"""Acceso a la base de datos (PostgreSQL) para el bot de VANTS.

Usa un pool asincrono de psycopg 3. Requiere la variable DATABASE_URL con la
cadena de conexion (sslmode=require). Tras la migracion Neon -> Supabase la
cadena es la del pooler de sesion de Supabase; el codigo no cambia porque
psycopg habla PostgreSQL estandar. El pool se abre en el primer uso.
"""
import asyncio
import os
from typing import Any, Sequence

from psycopg.rows import dict_row
from psycopg_pool import AsyncConnectionPool

_pool: AsyncConnectionPool | None = None
_lock = asyncio.Lock()


async def get_pool() -> AsyncConnectionPool:
    global _pool
    if _pool is not None:
        return _pool
    async with _lock:
        if _pool is None:
            url = os.getenv("DATABASE_URL")
            if not url:
                raise RuntimeError("Falta la variable de entorno DATABASE_URL")
            pool = AsyncConnectionPool(
                url,
                min_size=0,
                max_size=5,
                open=False,
                timeout=15,
                kwargs={"row_factory": dict_row, "autocommit": True},
            )
            await pool.open()
            _pool = pool
    return _pool


async def fetch_all(sql: str, params: Sequence[Any] | None = None) -> list[dict]:
    pool = await get_pool()
    async with pool.connection() as conn:
        cur = await conn.execute(sql, params)
        return await cur.fetchall()


async def fetch_one(sql: str, params: Sequence[Any] | None = None) -> dict | None:
    rows = await fetch_all(sql, params)
    return rows[0] if rows else None


async def fetch_val(sql: str, params: Sequence[Any] | None = None) -> Any:
    row = await fetch_one(sql, params)
    return next(iter(row.values())) if row else None


async def execute(sql: str, params: Sequence[Any] | None = None) -> None:
    pool = await get_pool()
    async with pool.connection() as conn:
        await conn.execute(sql, params)


async def close_pool() -> None:
    global _pool
    if _pool is not None:
        await _pool.close()
        _pool = None
