"""Puente Agente <-> Discord (bucle background del bot).

Dos colas en Neon (migracion 25) que convierten la memoria del agente en DMs:

  1. agent_events  · incidentes nuevos (o reabiertos) con notificado = false
     y severidad warn/error/critical → DM al dueno → notificado = true.
  2. agent_comandos · respuestas del agente a ordenes del dueno con
     entregado = false → DM con la respuesta → entregado = true.

Asi, si el bot de Discord esta vivo, el dueno ve TODO el agente sin tocar
nada; si Discord no funciona, la evidencia queda en Neon igualmente y el
ciclo del cuartel (VANTSNET/flask-Agents, workflow agente.yml) publica el
resumen en GitHub.

Mismo patron que supervisor.py (reintentos, holgura anti rate-limit).
"""

import asyncio
import logging
import os

import discord

from utils.db import execute, fetch_all, fetch_one

log = logging.getLogger("vants.agente_bridge")

INTERVAL = int(os.getenv("AGENTE_BRIDGE_INTERVAL") or "25")
DM_ID = int(os.getenv("SUPERVISOR_DM_ID") or "1532612429295521930")
MAX_ATTEMPTS = 3
VERSION = "agente-bridge-1"

COLORES = {"info": 0x3DDC84, "warn": 0xFFB547, "error": 0xED4245, "critical": 0xED4245}

_task: asyncio.Task | None = None


def _txt(value, limit: int = 200) -> str:
    text = str(value if value not in (None, "") else "—")
    text = text.replace("@everyone", "@\u200beveryone").replace("@here", "@\u200bhere")
    return text[:limit]


def _embed_incidente(row: dict) -> discord.Embed:
    severity = row.get("severity") if row.get("severity") in COLORES else "info"
    e = discord.Embed(
        title=f"Agente VANTS · [{severity.upper()}] {_txt(row.get('kind'), 40)}",
        description=_txt(row.get("titulo"), 250),
        color=COLORES[severity],
    )
    sugerida = row.get("accion_sugerida")
    if sugerida:
        e.add_field(name="Accion sugerida", value=_txt(sugerida, 80))
    e.set_footer(text=f"incidente #{row['id']} · /agente resolver {row['id']}")
    return e


async def _ciclo_incidentes(client: discord.Client) -> None:
    filas = await fetch_all(
        "SELECT id, kind, severity, titulo, accion_sugerida, created_at FROM agent_events "
        "WHERE notificado = false AND estado = 'abierto' "
        "AND severity IN ('warn','error','critical') ORDER BY id LIMIT 10"
    )
    for row in filas:
        try:
            user = client.get_user(DM_ID) or await client.fetch_user(DM_ID)
            await user.send(embed=_embed_incidente(row), allowed_mentions=discord.AllowedMentions.none())
            await execute(
                "UPDATE agent_events SET notificado = true, updated_at = now() WHERE id = %s",
                (row["id"],),
            )
        except discord.Forbidden:
            await execute(
                "UPDATE agent_events SET notificado = true WHERE id = %s", (row["id"],)
            )
            log.warning("Agente bridge: el dueno no acepta DMs")
        except Exception as exc:  # noqa: BLE001
            log.warning("Agente bridge: fallo al notificar incidente %s: %s", row["id"], exc)
        await asyncio.sleep(0.5)


async def _ciclo_respuestas(client: discord.Client) -> None:
    filas = await fetch_all(
        "SELECT id, texto, respuesta, estado, respondido_at FROM agent_comandos "
        "WHERE entregado = false AND estado IN ('hecho','error') ORDER BY id LIMIT 10"
    )
    for row in filas:
        try:
            user = client.get_user(DM_ID) or await client.fetch_user(DM_ID)
            texto = f"Orden: {_txt(row.get('texto'), 150)}\n\n{_txt(row.get('respuesta'), 1500)}"
            color = 0x3DDC84 if row.get("estado") == "hecho" else 0xED4245
            e = discord.Embed(title="Agente VANTS · respuesta", description=texto[:4000], color=color)
            await user.send(embed=e, allowed_mentions=discord.AllowedMentions.none())
            await execute(
                "UPDATE agent_comandos SET entregado = true WHERE id = %s", (row["id"],)
            )
        except discord.Forbidden:
            await execute(
                "UPDATE agent_comandos SET entregado = true WHERE id = %s", (row["id"],)
            )
        except Exception as exc:  # noqa: BLE001
            log.warning("Agente bridge: fallo al entregar respuesta %s: %s", row["id"], exc)
        await asyncio.sleep(0.5)


async def _loop(client: discord.Client) -> None:
    while True:
        try:
            await _ciclo_incidentes(client)
            await _ciclo_respuestas(client)
        except asyncio.CancelledError:
            raise
        except Exception:
            log.exception("Fallo en el ciclo del puente del agente")
        await asyncio.sleep(INTERVAL)


def start_agent_bridge(client: discord.Client) -> None:
    """Arranca el bucle una sola vez (on_ready puede dispararse varias veces)."""
    global _task
    if _task is None or _task.done():
        _task = asyncio.create_task(_loop(client))
