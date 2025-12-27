BOE Reports (interno)
=====================

Objetivo
--------
Generar informes semanales de oportunidades BOE por provincia (PDF/CSV) y enviarlos por correo a suscriptores internos (si SMTP está configurado). No se expone en web.

Campos consumidos (boe_prod.subastas_pro)
-----------------------------------------
- `subasta_id`
- `provincia`
- `municipio`
- `precio_salida` (como precio)
- `valor_tasacion` (como valor)
- `descuento_pct` (o calculado: (1 - precio/valor)*100)
- `fecha_fin` (deadline)
- `url_detalle`

Esquema reports
---------------
SQL en `src/boe/reports/schema.sql` crea:
- `boe_reports.subscribers(email pk, province, plan, is_active, created_at)`
- `boe_reports.reports(report_id uuid pk, province, period_start, period_end, generated_at, file_path_pdf, file_path_csv, items_count, run_id)`
- `boe_reports.report_items(report_id fk, subasta_id, score, discount_pct, precio, valor, deadline, municipio, url)`

Ejecución
---------
```
cd /opt/adl-suite/adl-data-analyst
npm install
npm run build
BOE_REPORT_DRY_RUN=true \
BOE_REPORT_TOPN=20 \
BOE_REPORT_MIN_DISCOUNT=30 \
BOE_REPORT_OUTPUT_DIR=/opt/adl-suite/data/reports/boe \
node dist/src/boe/reports/run.js
```

ENV de correo (opcional para envío):
- SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, SMTP_FROM
- BOE_REPORT_DRY_RUN=true evita envío aunque SMTP exista.

Salida esperada en logs:
- `RUN_OK | provinces=X | reports=Y | items=Z`

Ubicación de PDFs/CSVs:
- `/opt/adl-suite/data/reports/boe/YYYY-WW/<province>.pdf` (y .csv)

