# DEPRECATED (migración Neon -> Supabase)

Estas Neon Functions viven ahora, con el mismo código, en el Worker de
Cloudflare `vants-functions` del repo **Vantsgames** (`vants-functions/functions/`).

- Las URLs de Neon (`...-<fn>.compute...neon.tech`) siguen respondiendo solo
  durante el paralelo: se apagan al pausar el proyecto Neon.
- Las URLs nuevas son `https://vants-functions.vants.workers.dev/fn/<nombre>/`.
- Esta copia del launcher se queda congelada como referencia; el deploy real
  lo hace el workflow de Vantsgames.
