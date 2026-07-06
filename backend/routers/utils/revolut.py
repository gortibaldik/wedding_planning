"""Parse a Revolut XLSX statement export, fixing its double-encoded text.

Revolut's statement export declares UTF-8 but writes text as double-encoded
UTF-8: the original UTF-8 bytes are reinterpreted as Latin-1/CP1252 and
re-encoded to UTF-8. :func:`fix_mojibake` recovers the original text (e.g.
``zahÃ¡jenÃ­`` -> ``zahájení``) and :func:`parse_statement` returns the rows as
``{header: value}`` dicts with every string cell repaired.
"""

import re
from io import BytesIO
from typing import Any

import openpyxl

# OOXML escapes control chars as ``_xHHHH_`` (4 hex digits). openpyxl hands
# these back as literal text rather than un-escaping them, so we do it here.
_OOXML_ESCAPE = re.compile(r"_x([0-9A-Fa-f]{4})_")

# Column headers, in their repaired (correct) form.
COL_TYPE = "Typ"
COL_DESCRIPTION = "Popis"
COL_AMOUNT = "Částka"
COL_STARTED = "Datum zahájení"
COL_COMPLETED = "Datum dokončení"
COL_STATE = "State"
COL_CURRENCY = "Měna"


def _unescape_ooxml(value: str) -> str:
    return _OOXML_ESCAPE.sub(lambda m: chr(int(m.group(1), 16)), value)


def fix_mojibake(value: Any) -> Any:
    """Undo Latin-1 -> UTF-8 double-encoding for a single string cell.

    Non-string values are returned unchanged. OOXML ``_xHHHH_`` control-char
    escapes are resolved first, because the mojibake for Czech letters such as
    ``č``/``ě``/``ř`` produces C1 control bytes that Revolut writes that way.
    Strings that are not actually double-encoded (the round-trip fails) are
    returned as-is.
    """
    if not isinstance(value, str):
        return value
    unescaped = _unescape_ooxml(value)
    try:
        return unescaped.encode("latin-1").decode("utf-8")
    except (UnicodeEncodeError, UnicodeDecodeError):
        return value


def parse_statement(data: bytes) -> list[dict[str, Any]]:
    """Read the workbook bytes into a list of ``{header: value}`` rows.

    Every string cell is repaired via :func:`fix_mojibake`; fully empty rows are
    skipped. Header names are the repaired first-row labels (see the ``COL_*``
    constants).
    """
    workbook = openpyxl.load_workbook(BytesIO(data), read_only=True, data_only=True)
    try:
        worksheet = workbook.active
        rows = worksheet.iter_rows(values_only=True)
        header = [fix_mojibake(cell) for cell in next(rows, ())]
        result: list[dict[str, Any]] = []
        for row in rows:
            if all(cell is None for cell in row):
                continue
            result.append(
                {h: fix_mojibake(v) for h, v in zip(header, row, strict=False)}
            )
        return result
    finally:
        workbook.close()
