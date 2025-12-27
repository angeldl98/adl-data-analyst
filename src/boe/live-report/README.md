BOE Live Report
===============

Propósito
---------
Generar un informe inmediato de oportunidades de subastas BOE activas consultando la web pública en tiempo real, sin depender del pipeline histórico. Uso puntual (no ingestión masiva).

Diferencias vs pipeline histórico
---------------------------------
- No usa el raw-scraper ni la BD boe_prod; consulta directamente la web pública (RSS/HTML).
- No descarga PDFs ni hace enriquecimiento profundo.
- Orientado a informes rápidos para validación comercial.

Flujo
-----
1) `fetchListing`: lee el RSS público de subastas BOE y obtiene URLs de detalle (máx `BOE_LIVE_MAX_LISTING`, default 50).
2) `fetchDetail`: visita hasta `BOE_LIVE_MAX_DETAILS` (default 30) páginas de detalle con delays humanos y extrae precio, valor, descripción.
3) `parser`: normaliza y calcula descuento cuando hay valor.
4) `ranker`: puntúa orientado a inversor novel y selecciona TOP_N (default 20).
5) `report`: genera PDF y CSV en `/opt/adl-suite/data/reports/boe-live/YYYY-MM-DD/`.

Ejemplo de ejecución
--------------------
```
BOE_LIVE_DRY_RUN=true \
BOE_LIVE_TOPN=20 \
BOE_LIVE_MAX_LISTING=50 \
BOE_LIVE_MAX_DETAILS=30 \
BOE_LIVE_OUTPUT_DIR=/opt/adl-suite/data/reports/boe-live \
node dist/src/boe/live-report/run.js
```

Salida esperada
---------------
- `RUN_OK | fetched=X | ranked=Y | output_pdf=... | output_csv=...`
- TOP10 por stdout.
- Archivos: `.../YYYY-MM-DD/live.pdf` y `live.csv`.

Límites y riesgos
-----------------
- No se garantiza cobertura completa (solo primeras entradas del RSS y máx 30 detalles).
- No se descargan PDFs; datos solo de HTML.
- Riesgo de cambios en HTML/estructura del BOE; en ese caso RUN_FAIL con error explícito.
- No se escribe en BD, solo ficheros y stdout.

