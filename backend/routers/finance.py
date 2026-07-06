import logging
import uuid
from datetime import date
from enum import Enum
from typing import Annotated

import redis.asyncio as aioredis
from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel

from backend.dependencies import get_current_user, get_redis

from .utils.compression import compress, decompress

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
