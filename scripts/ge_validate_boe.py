#!/usr/bin/env python3
"""
Great Expectations validation for BOE calculated rows.
Reads JSON array from stdin and outputs a JSON summary to stdout.
Exits 0 on success, 1 on any expectation failure.
"""
import json
import sys
from typing import Any, Dict, List

import pandas as pd
import great_expectations as ge


REQUIRED_NON_NULL = [
    "subasta_id",
    "identificador",
    "boe_uid",
    "fecha_inicio",
    "fecha_fin",
    "precio_salida",
    "valor_tasacion",
    "url_detalle",
]

NON_NEGATIVE = ["precio_salida", "valor_tasacion", "descuento_pct"]


def main() -> int:
    try:
        data = json.load(sys.stdin)
    except Exception as exc:  # pragma: no cover
        print(json.dumps({"success": False, "error": f"invalid_input:{exc}"}))
        return 1

    df = pd.DataFrame(data)
    gdf = ge.from_pandas(df)

    results: List[Dict[str, Any]] = []
    all_success = True

    for col in REQUIRED_NON_NULL:
        res = gdf.expect_column_values_to_not_be_null(col)
        total = res["result"].get("element_count", 0) or 0
        failed = len(res["result"].get("unexpected_index_list", []))
        success = bool(res["success"])
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

    for col in NON_NEGATIVE:
        res = gdf.expect_column_values_to_be_greater_than_or_equal_to(col, 0)
        total = res["result"].get("element_count", 0) or 0
        failed = len(res["result"].get("unexpected_index_list", []))
        success = bool(res["success"])
        results.append(
            {
                "field": col,
                "total": total,
                "failed": failed,
                "completeness": 0 if total == 0 else (total - failed) / total,
                "notes": "must_be_non_negative",
                "success": success,
            }
        )
        all_success = all_success and success

    output = {
        "success": all_success,
        "results": results,
        "total_records": int(len(df)),
    }

    print(json.dumps(output))
    return 0 if all_success else 1


if __name__ == "__main__":
    sys.exit(main())

