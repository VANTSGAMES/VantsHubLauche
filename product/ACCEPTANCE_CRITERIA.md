# ACCEPTANCE_CRITERIA — Criterios de aceptación comprobables

Cada criterio es verificable con un comando/prueba concreto. Las fases no se marcan completas
sin la evidencia correspondiente.

## A. Listado de torneos (F6)

- [ ] AC1 `GET /es/tournaments/valorant/upcoming/` → 200 HTML con el shell strafe y el listado.
- [ ] AC2 Las 3 variantes de estado existen: `upcoming|ongoing|archive` → 200; estado inválido → 307 a `upcoming`.
- [ ] AC3 El listado consume `/api/tournaments?juego=valorant&estado=upcoming` (evidencia en red del navegador).
- [ ] AC4 El orden por fecha de inicio ascendente (upcoming) / descendente (archive) es correcto.
- [ ] AC5 Con 0 resultados se muestra EmptyState visible; con API caída, ErrorState con reintentar.
- [ ] AC6 Deep link directo tras recarga funciona (Worker sirve la ruta sin JS previo).
- [ ] AC7 Las filas son enlaces reales (`<a href="/torneo?slug=…">`) accesibles por teclado.

## B. API (F7)

- [ ] AC8 `GET /api/games` → `{ok:true,data:[…]}` con los juegos activos (valorant, cs2, …).
- [ ] AC9 `GET /api/tournaments?estado=upcoming&juego=valorant&pag=1` → paginado (`pag`,`porPagina`,`total`) con validación: `pag=0`/`abc` → 400 `{ok:false}`.
- [ ] AC10 `GET /api/tournaments/<slug>` → 200 con la ficha; slug inexistente → 404 `{ok:false}`.
- [ ] AC11 `GET /api/matches?estado=live|upcoming|finished` filtra y ordena correctamente.
- [ ] AC12 `GET /api/teams`, `/api/players`, `/api/articles` responden con estructura consistente.
- [ ] AC13 `GET /api/search?q=copa` busca en torneos/equipos/jugadores/artículos; `q` corto → 400.
- [ ] AC14 Ningún error 500 filtra stack/mensaje interno; siempre `{ok:false,error:{message}}`.
- [ ] AC15 Rate limit activo en rutas API (429 tras exceder) documentado.

## C. Datos (F8)

- [ ] AC16 El seed DEMO está etiquetado (`is_demo=true`) y la UI muestra chip "DEMO".
- [ ] AC17 El adaptador FACEIT documenta la fuente real y se activa con la key existente (o queda documentado si se desactiva por cuota).
- [ ] AC18 Sin duplicados: clave estable por slug/uuid externo (UNIQUE).

## D. Páginas complementarias (F9)

- [ ] AC19 `/equipos` y `/jugadores` listan desde la API con estados completos.
- [ ] AC20 `/noticias` lista artículos y `/noticia?id=…` muestra ficha (o DEMO).
- [ ] AC21 `/busqueda?q=…` implementa F5 completo.
- [ ] AC22 Todas las rutas del nav existen y responden 200 (crawler sin 404 internos).

## E. SEO/i18n (F10)

- [ ] AC23 `<title>` y `description` únicos por página (comparación automatizada).
- [ ] AC24 Canonical absoluto correcto en cada página.
- [ ] AC25 hreflang es/en/x-default en la plataforma de torneos.
- [ ] AC26 `sitemap.xml` válido (XML parseable) e incluye las rutas nuevas; `robots.txt` correcto.
- [ ] AC27 `?lang=en` traduce la plataforma sin mezclar idiomas (spans data-i18n cubiertos).

## F. Accesibilidad (F11)

- [ ] AC28 Foco visible en todos los controles interactivos (CSS `:focus-visible`).
- [ ] AC29 Tabs/filtros navegables con Tab/Enter; sin trampas de foco.
- [ ] AC30 `prefers-reduced-motion` desactiva animaciones decorativas.
- [ ] AC31 Todas las imágenes informativas tienen `alt`; decorativas `alt=""`.
- [ ] AC32 Un solo `<h1>` por página.

## G. Seguridad (F12)

- [ ] AC33 Parámetros validados server-side (tipo/rango); SQL parametrizado (sin concatenación).
- [ ] AC34 Cabeceras de seguridad en respuestas (X-Frame-Options/CSP/nosniff…) — revisión de las existentes del Worker.
- [ ] AC35 Sin secretos en el repo (`rg` de patrones de key en el diff).

## H. Pruebas y despliegue (F13-F14)

- [ ] AC36 `npm test` ejecuta la suite plataforma y pasa (unit siempre; integración con Neon si hay DATABASE_URL).
- [ ] AC37 Suites existentes siguen verdes (regresión: test_plataforma, test_mm_fase4, test_vantsbot…; las suites del agente corren en el cuartel `VANTSNET/flask-Agents`).
- [ ] AC38 Push a main → CI SUCCESS → smoke en producción con navegador: rutas críticas 200, 0 errores de consola, capturas guardadas.
- [ ] AC39 Espejo ×3 verificado (hashes iguales en raíz/public/vants-server/public para archivos nuevos).

## I. Documentación (F15)

- [ ] AC40 README actualizado (arranque, variables, pruebas, deploy), docs/TESTING.md, docs/DEPLOYMENT.md, docs/TROUBLESHOOTING.md.
- [ ] AC41 PROJECT_STATUS.md refleja el estado real de todas las fases con evidencia.

## Condición de finalización

Todas las fases evaluadas; MUST satisfechos o bloqueo documentado; build/CI verde; rutas
críticas verificadas en producción; sin errores críticos conocidos sin tratar; documentación
que permite ejecutar y mantener el proyecto.
