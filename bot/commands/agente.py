"""Comandos /agente — el mando del dueno sobre el Agente VANTS.

El agente vive en el cuartel VANTSNET/flask-Agents (services/agent-service)
y se ejecuta:
  a) cada 30 min en CI desde el cuartel (workflow agente.yml), guardando su
     memoria en Neon (agent_runs / agent_events / agent_comandos, migracion 25);
  b) opcionalmente como servicio HTTP (AGENT_URL + AGENT_TOKEN), con respuesta
     instantanea.

Este modulo permite AL DRON (bot) consultar y ordenar al agente:
  /agente estado            · ultimo ciclo + incidentes abiertos
  /agente informe           · diagnostico completo (via servicio si hay URL)
  /agente incidentes        · lista de incidentes abiertos
  /agente resolver <id>     · cerrar un incidente
  /agente comando <texto>   · orden libre (lenguaje natural)
       - con AGENT_URL: respuesta inmediata del servicio
       - sin AGENT_URL: queda en cola (agent_comandos) y el proximo ciclo
         del agente la procesa; agent_bridge la entrega por DM.
"""

import logging
import os

import discord

from utils.db import execute, fetch_all, fetch_one

log = logging.getLogger("vants.agente")

AGENT_URL = os.getenv("AGENT_URL", "").rstrip("/")
AGENT_TOKEN = os.getenv("AGENT_TOKEN", "")

COLORES = {"UP": 0x3DDC84, "DEGRADED": 0xFFB547, "DOWN": 0xED4245}


async def _estado_row() -> dict | None:
    return await fetch_one(
        "SELECT estado_global, resumen, started_at, fuente, modo, error "
        "FROM agent_runs ORDER BY id DESC LIMIT 1"
    )


async def _incidentes(limite: int = 15) -> list[dict]:
    return await fetch_all(
        "SELECT id, severity, titulo, accion_sugerida, created_at FROM agent_events "
        "WHERE estado = 'abierto' ORDER BY "
        "CASE severity WHEN 'critical' THEN 0 WHEN 'error' THEN 1 WHEN 'warn' THEN 2 ELSE 3 END, "
        "id DESC LIMIT %s",
        (limite,),
    )


def _embed_estado(run: dict | None, incidentes: list[dict]) -> discord.Embed:
    estado = (run or {}).get("estado_global") or "DESCONOCIDO"
    e = discord.Embed(
        title="Agente VANTS · estado",
        description=f"Estado global: **{estado}**",
        color=COLORES.get(estado, 0x5865F2),
    )
    if run:
        e.add_field(name="Ultimo ciclo", value=str(run.get("started_at"))[:16], inline=True)
        e.add_field(name="Fuente", value=f"{run.get('fuente')} / {run.get('modo')}", inline=True)
        if run.get("resumen"):
            e.add_field(name="Resumen", value=str(run["resumen"])[:200], inline=False)
        if run.get("error"):
            e.add_field(name="Error", value=str(run["error"])[:200], inline=False)
    else:
        e.description = "El agente aún no ha corrido (espera al ciclo del cuartel flask-Agents)."
    if incidentes:
        lineas = []
        for inc in incidentes:
            ic = {"critical": "🔴", "error": "🟠", "warn": "🟡", "info": "⚪"}.get(inc["severity"], "·")
            linea = f"{ic} `#{inc['id']}` {str(inc['titulo'])[:90]}"
            lineas.append(linea)
        e.add_field(name=f"Incidentes abiertos ({len(incidentes)})", value="\n".join(lineas)[:1000], inline=False)
    else:
        e.add_field(name="Incidentes abiertos", value="Ninguno ✅", inline=False)
    e.set_footer(text="Agente VANTS · /agente comando <orden> para actuar")
    return e


async def _via_servidor(texto: str) -> dict | None:
    """Llama al servicio del agente si AGENT_URL está configurado."""
    if not AGENT_URL:
        return None
    try:
        import aiohttp

        async with aiohttp.ClientSession() as sesion:
            async with sesion.post(
                f"{AGENT_URL}/api/v1/comando",
                json={"texto": texto, "creado_por": "discord"},
                headers={"authorization": f"Bearer {AGENT_TOKEN}"} if AGENT_TOKEN else {},
                timeout=aiohttp.ClientTimeout(total=30),
            ) as resp:
                if resp.status != 200:
                    return None
                return await resp.json()
    except Exception:  # noqa: BLE001
        log.exception("Llamada al servicio del agente falló; uso la ruta Neon")
        return None


async def _comando_libre(texto: str, creado_por: str) -> str:
    via = await _via_servidor(texto)
    if via and via.get("respuesta"):
        return f"{via['respuesta']}\n\n_(via servicio, intencion: {via.get('intencion')})_"
    # Ruta sin servidor: el proximo ciclo del agente la procesa (≤30 min)
    await execute(
        "INSERT INTO agent_comandos (texto, creado_por) VALUES (%s, %s)", (texto, creado_por)
    )
    return (
        "Orden en cola para el agente ✅ La procesará en su próximo ciclo "
        "(máx. ~30 min) y te llegará por DM.\n"
        "_(Para respuesta instantánea, publica el agent-service y define AGENT_URL._)"
    )


def registrar(tree: discord.app_commands.CommandTree, guild: discord.Object) -> None:
    grupo = discord.app_commands.Group(
        name="agente", description="Control del Agente VANTS (web, launcher, BD, CI)"
    )

    @grupo.command(name="estado", description="Ultimo ciclo del agente + incidentes abiertos")
    async def estado(interaction: discord.Interaction) -> None:
        await interaction.response.defer(ephemeral=True)
        run = await _estado_row()
        incidentes = await _incidentes(5)
        await interaction.followup.send(embed=_embed_estado(run, incidentes), ephemeral=True)

    @grupo.command(name="informe", description="Diagnostico completo del agente")
    async def informe(interaction: discord.Interaction) -> None:
        await interaction.response.defer(ephemeral=True)
        via = await _via_servidor("informe")
        if via and via.get("respuesta"):
            await interaction.followup.send(f"```\n{str(via['respuesta'])[:1800]}\n```", ephemeral=True)
            return
        run = await _estado_row()
        incidentes = await _incidentes(15)
        if not run:
            await interaction.followup.send(
                "El agente aún no ha corrido. El ciclo corre desde el cuartel flask-Agents.",
                ephemeral=True,
            )
            return
        hallazgos = []
        lineas = [f"Estado global: **{run['estado_global']}**"]
        if run.get("resumen"):
            lineas.append(str(run["resumen"])[:200])
        for inc in incidentes:
            lineas.append(f"`#{inc['id']}` [{inc['severity']}] {str(inc['titulo'])[:80]}")
        await interaction.followup.send("```\n" + "\n".join(lineas)[:1800] + "\n```", ephemeral=True)

    @grupo.command(name="incidentes", description="Lista los incidentes abiertos")
    async def incidentes(interaction: discord.Interaction) -> None:
        await interaction.response.defer(ephemeral=True)
        lista = await _incidentes(15)
        if not lista:
            await interaction.followup.send("Sin incidentes abiertos ✅", ephemeral=True)
            return
        lineas = [
            f"{'🔴' if i['severity']=='critical' else '🟠' if i['severity']=='error' else '🟡'} "
            f"`#{i['id']}` {str(i['titulo'])[:90]}"
            for i in lista
        ]
        await interaction.followup.send(
            "**Incidentes abiertos**\n" + "\n".join(lineas)[:1800], ephemeral=True
        )

    @grupo.command(name="resolver", description="Marca un incidente como resuelto")
    @discord.app_commands.describe(id_incidente="Numero del incidente (ver /agente incidentes)")
    async def resolver(interaction: discord.Interaction, id_incidente: int) -> None:
        await interaction.response.defer(ephemeral=True)
        fila = await fetch_one(
            "UPDATE agent_events SET estado='resuelto', resolucion='resuelto por el dueno (Discord)', "
            "resolved_at=now(), updated_at=now() WHERE id=%s AND estado IN ('abierto','gestionando') "
            "RETURNING id",
            (id_incidente,),
        )
        if fila:
            await interaction.followup.send(f"Incidente `#{id_incidente}` resuelto ✅", ephemeral=True)
        else:
            await interaction.followup.send(
                f"No encontré un incidente abierto `#{id_incidente}`.", ephemeral=True
            )

    @grupo.command(name="comando", description="Orden libre al agente (ej: despliega la web)")
    @discord.app_commands.describe(texto="Lo que quieres que haga el agente")
    async def comando(interaction: discord.Interaction, texto: str) -> None:
        await interaction.response.defer(ephemeral=True)
        respuesta = await _comando_libre(texto, f"discord:{interaction.user.id}")
        await interaction.followup.send(respuesta[:1900], ephemeral=True)

    tree.add_command(grupo, guild=guild)
