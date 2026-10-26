# Bot de Discord VANTS — configuración

Bot en Python (`discord.py`, conexión gateway) que lee y escribe en la **base de datos** (PostgreSQL; Supabase tras la migracion desde Neon)
(PostgreSQL). Se despliega fuera del repo estático (Railway, Render, etc.).

## 1. Portal de desarrolladores de Discord

1. Abre la aplicación del bot en https://discord.com/developers/applications
2. **Bot → Reset Token** si no lo tienes e invita el bot con los permisos
   *View Channels*, *Send Messages*, *Embed Links* y los de moderación que uses.
3. Deja vacío **Interactions Endpoint URL**: el bot recibe los comandos por gateway.

## 2. Variables de entorno

| Variable | Para qué |
| --- | --- |
| `DISCORD_TOKEN` | Token del bot |
| `DISCORD_GUILD_ID` | Servidor donde se registran los comandos |
| `DATABASE_URL` | Cadena de conexión de la base, pooler de sesión (`sslmode=require`) |
| `PORT` | Puerto del health check (por defecto 8080) |

Nunca subas el `.env` al repo. Copia `.env.example` a `.env` en local.

## 3. Arranque

```bash
cd bot
pip install -r requirements.txt
cp .env.example .env
python main.py
```

Al arrancar, el bot sincroniza los comandos con el servidor (`tree.sync`).

## Tablas de la base que usa el bot

`players`, `leaderboard` (vista), `seasons`, `tournaments`, `tournament_entries`,
`ranked_matches`, `events`, `user_game_accounts`, `player_discord_accounts`,
`discord_channels`.

`/setup` solo rellena las categorías de `discord_channels` que estén vacías; no
pisa lo configurado con `/vants canal`.

## Notas

- `register_commands.py` registra los comandos de una función antigua de
  Supabase que ya no existe. No lo ejecutes: reemplaza todos los comandos del
  servidor.
