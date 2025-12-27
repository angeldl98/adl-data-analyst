NPL Importer (interno)
======================

Propósito
---------
Ingerir datasets internos de NPL (ZIP con Excels y documentación) de forma determinista y almacenarlos en tablas raw/norm sin exponer nada a web ni API.

Flujo
-----
1) `ingestZip` extrae el ZIP origen, calcula SHA-256 y guarda metadata en `npl_raw.files`, copiando los ficheros a `/opt/adl-suite/data/npl/raw/import_YYYYMMDD/`.
2) `excelParser` procesa los XLSX en raw y crea activos mínimos en `npl_norm.assets` + `asset_identifiers` con los identificadores encontrados.
3) `documentIndexer` procesa PDFs/DOCX, infiere identificadores desde el nombre (BMOM/BGAL/NDG/ref catastral), clasifica doc_type por palabras clave y vincula al asset si hay match en `asset_identifiers`.
4) `run.ts` ejecuta secuencialmente 1→2→3 y termina en RUN_OK o RUN_FAIL.

Qué NO hace
-----------
- No expone endpoints ni web.
- No interpreta jurídicamente los documentos; solo normaliza campos básicos y heurísticas por nombre.
- No ejecuta OCR ni NLP.

Cómo ejecutar
-------------
```
cd /opt/adl-suite/adl-data-analyst
npm install
npm run build
node dist/src/npl/importer/run.js
```
Logs quedan en stdout (apto para redirección `> /opt/adl-suite/logs/npl-import.log`).
Si el ZIP cambia, volver a ejecutar; los duplicados por SHA se saltan automáticamente.
Variables (opcional):
- `NPL_ZIP_PATH` (por defecto `/mnt/data/dataset fondos.zip`)
- `NPL_TARGET_DIR` (por defecto `/opt/adl-suite/data/npl/raw/import_YYYYMMDD`)
- DB: `POSTGRES_HOST/USER/PASSWORD/DB/PORT` o `DATABASE_URL`
- `SESSION_TOKEN_SECRET` no requerido aquí (solo gateway/web).

Esquema
-------
- SQL en `src/npl/schema.sql` crea `npl_raw.files`, `npl_norm.assets`, `npl_norm.asset_identifiers`, `npl_norm.documents`.

Logs esperados
--------------
- ingestZip: `RUN_OK | files_total=X | inserted=Y | duplicates=Z`
- excelParser: `RUN_OK | excels_parsed=N | assets_created=M`
- documentIndexer: `RUN_OK | documents=N | linked=P | unlinked=Q`

