#!/usr/bin/env python3
"""
Great Expectations validation for BOE calculated rows.
Reads JSON array from stdin and outputs a JSON summary to stdout.
Exits 0 on success, 1 on any expectation failure.
"""
import json
import sys
import logging
from typing import Any, Dict, List

import pandas as pd

logging.basicConfig(stream=sys.stderr, level=logging.INFO)


REQUIRED_NON_NULL = [
    "subasta_id",
    "identificador",
    "boe_uid",
    "fecha_inicio",
    "fecha_fin",
    "precio_salida",
    "url_detalle",
]

OPTIONAL_NON_NULL = [
    "valor_tasacion",
]

REQUIRED_NON_NEGATIVE = ["precio_salida"]
OPTIONAL_NON_NEGATIVE = ["valor_tasacion", "descuento_pct"]


def main() -> int:
    def emit(output: Dict[str, Any], exit_code: int) -> int:
        # Always emit structured JSON
        print(json.dumps(output))
        return exit_code

    try:
        data = json.load(sys.stdin)
    except Exception as exc:  # pragma: no cover
        return emit({"success": False, "results": [], "total_records": 0, "error": f"invalid_input:{exc}"}, 1)

    df = pd.DataFrame(data if isinstance(data, list) else [])
    total_records = int(len(df))

    # Ensure all expected columns exist to avoid KeyErrors
    for col in REQUIRED_NON_NULL + OPTIONAL_NON_NULL + REQUIRED_NON_NEGATIVE + OPTIONAL_NON_NEGATIVE:
        if col not in df.columns:
            df[col] = None

    results: List[Dict[str, Any]] = []
    all_success = total_records > 0

    # Required non-null
    for col in REQUIRED_NON_NULL:
        total = total_records
        failed = int(df[col].isnull().sum())
        success = failed == 0 and total > 0
        results.append(
            {
                "field": col,
                "total": total,
                "failed": failed,
                "completeness": 0 if total == 0 else (total - failed) / total,
                "notes": "required_non_null",
                "success": success,
            }
        )
        all_success = all_success and success

    # Optional non-null (record completeness, do not fail run)
    for col in OPTIONAL_NON_NULL:
        total = total_records
        failed = int(df[col].isnull().sum())
        success = failed == 0 and total > 0
        results.append(
            {
                "field": col,
                "total": total,
                "failed": failed,
                "completeness": 0 if total == 0 else (total - failed) / total,
                "notes": "optional_non_null",
                "success": success,
            }
        )

    # Required non-negative
    for col in REQUIRED_NON_NEGATIVE:
        series = df[col].dropna()
        total = int(len(series))
        failed = int((series.astype(float) < 0).sum())
        success = failed == 0 and total > 0
        results.append(
            {
                "field": col,
                "total": total,
                "failed": failed,
                "completeness": 0 if total == 0 else (total - failed) / total,
                "notes": "required_non_negative",
                "success": success,
            }
        )
        all_success = all_success and success

    # Optional non-negative (record completeness, do not fail run)
    for col in OPTIONAL_NON_NEGATIVE:
        series = df[col].dropna()
        total = int(len(series))
        failed = int((series.astype(float) < 0).sum())
        success = failed == 0 and total > 0
        results.append(
            {
                "field": col,
                "total": total,
                "failed": failed,
                "completeness": 0 if total == 0 else (total - failed) / total,
                "notes": "optional_non_negative",
                "success": success,
            }
        )

    if total_records == 0:
        # Explicitly mark empty dataset as failure with structured result
        results.append(
            {
                "field": "__dataset__",
                "total": 0,
                "failed": 0,
                "completeness": 0,
                "notes": "empty_dataset",
                "success": False,
            }
        )
        all_success = False

    output = {
        "success": all_success,
        "results": results,
        "total_records": total_records,
    }

    return emit(output, 0 if all_success else 1)


if __name__ == "__main__":
    sys.exit(main())

