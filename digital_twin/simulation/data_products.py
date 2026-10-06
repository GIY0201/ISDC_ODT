"""Data products the twin's satellites register with the data center (DT engine side of ICD-01).

Each satellite follows its production profile from the data center model: every `interval_s` of
simulation time it produces one product of a class with a size drawn deterministically from the
profile's range. Products are keyed by a reference that encodes the node, class and slot so the
same simulation time never yields two different products and re-sent products deduplicate.
"""
from __future__ import annotations

import hashlib
import math
from typing import Any

MAX_PRODUCTS_PER_CALL = 400


def _fraction(text: str) -> float:
    digest = hashlib.sha256(text.encode("utf-8")).digest()
    return int.from_bytes(digest[:4], "big") / 2**32


def validate_product_interval(from_s: float, to_s: float) -> None:
    """Reject invalid SIM seconds before any product loop or range arithmetic."""
    try:
        valid = all(type(value) in (int, float) and math.isfinite(value) for value in (from_s, to_s))
    except OverflowError:
        valid = False
    if not valid:
        raise ValueError("product interval seconds must be finite numbers")


def products_between(profiles: dict[str, list[dict]], from_s: float, to_s: float, available: dict[str, bool] | None = None) -> list[dict[str, Any]]:
    """Products whose production slot ends in (from_s, to_s]; unavailable nodes produce nothing."""
    validate_product_interval(from_s, to_s)
    if to_s <= from_s:
        return []
    products: list[dict[str, Any]] = []
    for node_id, profile in sorted(profiles.items()):
        if available is not None and not available.get(node_id, True):
            continue
        for spec in profile:
            interval = float(spec.get("interval_s") or 0)
            if interval <= 0:
                continue
            low, high = (float(spec["size_mb"][0]), float(spec["size_mb"][1])) if isinstance(spec.get("size_mb"), (list, tuple)) else (float(spec.get("size_mb") or 1), float(spec.get("size_mb") or 1))
            first = int(from_s // interval) + 1
            last = int(to_s // interval)
            for slot in range(first, last + 1):
                ref = f"{node_id}:{spec['class']}:{slot}"
                size = round(low + (high - low) * _fraction(ref), 3)
                products.append({"ref": ref, "class": spec["class"], "source": node_id, "size_mb": size, "priority": int(spec.get("priority", 1)),
                                 "label": f"{node_id} {spec['class']} #{slot}", "created_s": round(slot * interval, 3)})
                if len(products) >= MAX_PRODUCTS_PER_CALL:
                    return products
    return products
