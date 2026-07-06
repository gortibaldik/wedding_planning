import base64
import logging
import uuid
from datetime import date, datetime
from enum import Enum
from typing import Annotated

import redis.asyncio as aioredis
from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel

from backend.dependencies import get_current_user, get_redis

from .utils.compression import compress, decompress
from .utils.revolut import (
    COL_AMOUNT,
    COL_COMPLETED,
    COL_CURRENCY,
    COL_DESCRIPTION,
    COL_STARTED,
    COL_STATE,
    COL_TYPE,
    parse_statement,
)

FINANCE_ACCESS_ROLE = "finance-access"

logger = logging.getLogger(__name__)


def _require_finance_access(
    user: Annotated[dict, Depends(get_current_user)],
) -> dict:
    """Only users granted the finance-access role may access finances."""
    if FINANCE_ACCESS_ROLE not in (user.get("roles") or []):
        raise HTTPException(status_code=403, detail="Insufficient permissions")
    return user


router = APIRouter(
    prefix="/finance",
    dependencies=[Depends(_require_finance_access)],
)

# Redis hash: item_id -> compressed FinanceItem JSON
ALL_ITEMS_KEY = "finance:items"


class FinanceItemInput(BaseModel):
    name: str
    price: float
    category: str
    date: date
    buyer: str
    """The person who purchased the item."""


class FinanceItem(FinanceItemInput):
    id: str


class GroupBy(str, Enum):
    """Dimensions the items can be grouped by, SQL-``GROUP BY`` style."""

    CATEGORY = "category"
    BUYER = "buyer"
    DATE = "date"
    YEAR = "year"
    MONTH = "month"


class GroupedResult(BaseModel):
    keys: dict[str, str | int]
    """The grouping dimension -> its value for this group (e.g. {"month": 7})."""

    total_price: float
    count: int


def _group_value(item: FinanceItem, dimension: GroupBy) -> str | int:
    if dimension == GroupBy.CATEGORY:
        return item.category
    if dimension == GroupBy.BUYER:
        return item.buyer
    if dimension == GroupBy.DATE:
        return item.date.isoformat()
    if dimension == GroupBy.YEAR:
        return item.date.year
    return item.date.month


async def _load_all_items(redis: aioredis.Redis) -> list[FinanceItem]:
    raw = await redis.hgetall(ALL_ITEMS_KEY)
    return [FinanceItem.model_validate_json(decompress(v)) for v in raw.values()]


def _matches(
    item: FinanceItem,
    category: str | None,
    year: int | None,
    month: int | None,
) -> bool:
    if category is not None and item.category != category:
        return False
    if year is not None and item.date.year != year:
        return False
    if month is not None and item.date.month != month:  # noqa: SIM103
        return False
    return True


@router.get("/get")
async def get_items(
    redis: Annotated[aioredis.Redis, Depends(get_redis)],
    category: Annotated[str | None, Query()] = None,
    year: Annotated[int | None, Query()] = None,
    month: Annotated[int | None, Query(ge=1, le=12)] = None,
) -> list[FinanceItem]:
    """Return the full list of items, optionally filtered by category / year / month."""
    items = await _load_all_items(redis)
    items = [item for item in items if _matches(item, category, year, month)]
    items.sort(key=lambda item: item.date, reverse=True)
    return items


@router.get("/grouped")
async def get_items_grouped(
    redis: Annotated[aioredis.Redis, Depends(get_redis)],
    group_by: Annotated[list[GroupBy], Query()],
    category: Annotated[str | None, Query()] = None,
    year: Annotated[int | None, Query()] = None,
    month: Annotated[int | None, Query(ge=1, le=12)] = None,
) -> list[GroupedResult]:
    """Filter the items, then aggregate them by the requested ``group_by`` dimensions.

    SQL-like: e.g. ``?category=food&group_by=month`` gives the monthly totals for the
    ``food`` category, while ``?group_by=category&group_by=year`` gives per-category
    yearly totals across everything.
    """
    # dedupe while preserving order, so ?group_by=x&group_by=x doesn't double a column
    dimensions = list(dict.fromkeys(group_by))

    items = await _load_all_items(redis)
    groups: dict[tuple[str | int, ...], GroupedResult] = {}
    for item in items:
        if not _matches(item, category, year, month):
            continue
        values = tuple(_group_value(item, dim) for dim in dimensions)
        group = groups.get(values)
        if group is None:
            group = GroupedResult(
                keys={
                    dim.value: val for dim, val in zip(dimensions, values, strict=True)
                },
                total_price=0.0,
                count=0,
            )
            groups[values] = group
        group.total_price += item.price
        group.count += 1
    return sorted(groups.values(), key=lambda g: tuple(g.keys.values()))


@router.get("/categories")
async def get_categories(
    redis: Annotated[aioredis.Redis, Depends(get_redis)],
) -> list[str]:
    """Return the sorted list of distinct categories (useful for building filters)."""
    items = await _load_all_items(redis)
    return sorted({item.category for item in items})


@router.post("/set")
async def create_item(
    item_input: FinanceItemInput,
    redis: Annotated[aioredis.Redis, Depends(get_redis)],
) -> FinanceItem:
    """Create a new finance item and return it (with its generated id)."""
    item = FinanceItem(id=str(uuid.uuid4()), **item_input.model_dump())
    await redis.hset(ALL_ITEMS_KEY, item.id, compress(item.model_dump_json()))
    return item


@router.put("/set/{item_id}")
async def update_item(
    item_id: str,
    item_input: FinanceItemInput,
    redis: Annotated[aioredis.Redis, Depends(get_redis)],
) -> FinanceItem:
    """Update an existing finance item."""
    if not await redis.hexists(ALL_ITEMS_KEY, item_id):
        raise HTTPException(status_code=404, detail="Item not found")
    item = FinanceItem(id=item_id, **item_input.model_dump())
    await redis.hset(ALL_ITEMS_KEY, item_id, compress(item.model_dump_json()))
    return item


@router.delete("/set/{item_id}")
async def delete_item(
    item_id: str,
    redis: Annotated[aioredis.Redis, Depends(get_redis)],
):
    """Delete a finance item."""
    if not await redis.hdel(ALL_ITEMS_KEY, item_id):
        raise HTTPException(status_code=404, detail="Item not found")
    return {"status": "ok"}


# ---- Revolut statement import ----


class ImportFileRequest(BaseModel):
    """A base64-encoded Revolut XLSX export awaiting a preview parse."""

    filename: str
    content_base64: str


class ImportRow(FinanceItemInput):
    """A previewed, still-editable expense parsed from a Revolut statement.

    The ``source_*`` fields are read-only context to help the user review each
    row; only the inherited :class:`FinanceItemInput` fields are persisted when
    the reviewed rows are committed.
    """

    source_amount: float
    source_currency: str
    source_type: str
    source_state: str


def _row_date(row: dict) -> date | None:
    """Pick the transaction date, preferring completion over start."""
    for col in (COL_COMPLETED, COL_STARTED):
        value = row.get(col)
        if isinstance(value, datetime):
            return value.date()
        if isinstance(value, date):
            return value
        if isinstance(value, str) and value.strip():
            try:
                return datetime.fromisoformat(value.strip()).date()
            except ValueError:
                continue
    return None


def _dedup_key(name: str, price: float, item_date: date) -> tuple[str, float, str]:
    """Identity of an expense for import de-duplication: (name, price, date)."""
    return (name, round(float(price), 2), item_date.isoformat())


@router.post("/import/preview")
async def preview_import(
    request: ImportFileRequest,
    redis: Annotated[aioredis.Redis, Depends(get_redis)],
    user: Annotated[dict, Depends(get_current_user)],
) -> list[ImportRow]:
    """Parse an uploaded Revolut XLSX and return editable expense rows.

    Only outgoing transactions (negative amount) become rows, with
    ``price = |amount|``; incoming transfers/top-ups are dropped. Rows that
    already exist in the database (same name, price and date) are dropped too,
    so re-importing an overlapping statement doesn't duplicate them. Nothing is
    persisted here — the user reviews and edits the rows, then commits them.
    """
    try:
        data = base64.b64decode(request.content_base64, validate=True)
        parsed = parse_statement(data)
    except Exception as e:
        raise HTTPException(status_code=400, detail="Could not parse file") from e

    existing = {
        _dedup_key(item.name, item.price, item.date)
        for item in await _load_all_items(redis)
    }

    # Imported statement expenses default to shared/joint spending.
    buyer = "Joint"
    rows: list[ImportRow] = []
    for entry in parsed:
        amount = entry.get(COL_AMOUNT)
        if not isinstance(amount, int | float) or amount >= 0:
            continue
        item_date = _row_date(entry)
        if item_date is None:
            continue
        name = str(entry.get(COL_DESCRIPTION) or entry.get(COL_TYPE) or "").strip()
        price = round(-float(amount), 2)
        if _dedup_key(name, price, item_date) in existing:
            continue
        rows.append(
            ImportRow(
                name=name,
                price=price,
                category="",
                date=item_date,
                buyer=buyer,
                source_amount=float(amount),
                source_currency=str(entry.get(COL_CURRENCY) or ""),
                source_type=str(entry.get(COL_TYPE) or ""),
                source_state=str(entry.get(COL_STATE) or ""),
            )
        )
    logger.info(
        "Parsed %d expense rows from '%s' for %s",
        len(rows),
        request.filename,
        user.get("sub"),
    )
    return rows


@router.post("/import/commit")
async def commit_import(
    items: list[FinanceItemInput],
    redis: Annotated[aioredis.Redis, Depends(get_redis)],
) -> list[FinanceItem]:
    """Bulk-create the reviewed import rows, returning them with generated ids."""
    created: list[FinanceItem] = []
    mapping: dict[str, str] = {}
    for item_input in items:
        item = FinanceItem(id=str(uuid.uuid4()), **item_input.model_dump())
        mapping[item.id] = compress(item.model_dump_json())
        created.append(item)
    if mapping:
        await redis.hset(ALL_ITEMS_KEY, mapping=mapping)
    return created
