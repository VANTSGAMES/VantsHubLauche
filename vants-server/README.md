# VANTS GAMES — Arena Competitiva

Worker de Cloudflare que sirve la web estática y envía notificaciones a Discord vía REST API.

## Arquitectura

- **Web estática**: se sirve desde `public/` (poner `index.html` ahí)
- **API**: endpoint `POST /api/discord/notify` que envía embeds a un canal de Discord
- **Runtime**: Cloudflare Workers (V8 isolates, no Node.js)

## Tipos de notificación

| Tipo | Color | Descripción |
|------|-------|-------------|
| `torneo_inscripcion` | 🔴 Rojo | Nueva inscripción a torneo |
| `membresia` | 💜 Violeta | Nueva membresía activada |
| `live` | 🟣 Twitch | Stream en directo |
| `campeon` | 🟡 Oro | Nuevo campeón de torneo |

## Ejemplo de petición

```bash
curl -X POST https://vants.geimerjhoan099.workers.dev/api/discord/notify \
  -H "Content-Type: application/json" \
  -d '{
    "type": "torneo_inscripcion",
    "data": {
      "team": "Los Pro",
      "tag": "LPRO",
      "tournament": "Copa VANTS 2026"
    }
  }'
