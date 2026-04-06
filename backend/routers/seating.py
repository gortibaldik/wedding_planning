import json
import logging
from typing import Annotated, Literal

import redis.asyncio as aioredis
from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel

from backend.dependencies import get_current_user, get_redis

from .utils.compression import compress, decompress

logger = logging.getLogger(__name__)
router = APIRouter(
    prefix="/seating-arrangement",
    dependencies=[Depends(get_current_user)],
)

# Redis keys
ALL_SEATINGS_KEY = "seating:all"  # Hash: seating_id -> compressed Seating JSON
SEATINGS_BY_LIST_KEY = "seating:by_invitation_list"  # Hash: invitation_list_id -> compressed JSON list of seating_ids


class SeatingMetadata(BaseModel):
    owner_sub: str = ""
    """Owner sub, filled from the JWT."""

    owner_name: str = ""
    """Owner name, filled from the JWT."""

    invitation_list_id: str
    """The id of the invitation list from which the table seating is done."""

    id: str
    """The id of the seating arrangement."""

    name: str = ""
    """Display name of the seating arrangement."""


class TableModel(BaseModel):
    id: str
    """The id of the table."""

    name: str
    shape: Literal["rectangular", "circular"]
    seats: int
    position: dict[str, float]
    guests: list[str | None]
    """Ids of guests seated at this table."""


class Seating(BaseModel):
    tables: list[TableModel]
    metadata: SeatingMetadata


async def _get_seating_ids_for_list(
    redis: aioredis.Redis, invitation_list_id: str
) -> list[str]:
    raw = await redis.hget(SEATINGS_BY_LIST_KEY, invitation_list_id)
    if raw is None:
        return []
    return json.loads(decompress(raw))


async def _set_seating_ids_for_list(
    redis: aioredis.Redis, invitation_list_id: str, seating_ids: list[str]
) -> None:
    await redis.hset(
        SEATINGS_BY_LIST_KEY, invitation_list_id, compress(json.dumps(seating_ids))
    )


@router.get("/get")
async def get_seating(
    id: Annotated[str, Query()],
    redis: Annotated[aioredis.Redis, Depends(get_redis)],
) -> Seating:
    """Get the seating arrangement with a given id."""
    raw = await redis.hget(ALL_SEATINGS_KEY, id)
    if raw is None:
        raise HTTPException(status_code=404, detail="Seating arrangement not found")
    return Seating.model_validate_json(decompress(raw))


@router.post("/set")
async def set_seating(
    redis: Annotated[aioredis.Redis, Depends(get_redis)],
    user: Annotated[dict, Depends(get_current_user)],
    seating: Seating,
):
    """Set the seating arrangement."""
    seating_id = seating.metadata.id
    invitation_list_id = seating.metadata.invitation_list_id

    # Check ownership if updating existing
    existing_raw = await redis.hget(ALL_SEATINGS_KEY, seating_id)
    if existing_raw is not None:
        existing = Seating.model_validate_json(decompress(existing_raw))
        if existing.metadata.owner_sub != user.get("sub"):
            raise HTTPException(
                status_code=403, detail="Not allowed to edit this seating arrangement"
            )

    # Fill owner info from JWT
    seating.metadata.owner_sub = user.get("sub", "")
    seating.metadata.owner_name = user.get("name", "")

    # Store the seating
    await redis.hset(ALL_SEATINGS_KEY, seating_id, compress(seating.model_dump_json()))

    # Update the invitation_list -> seating_ids index
    seating_ids = await _get_seating_ids_for_list(redis, invitation_list_id)
    if seating_id not in seating_ids:
        seating_ids.append(seating_id)
        await _set_seating_ids_for_list(redis, invitation_list_id, seating_ids)


@router.get("/get-seatings-for-invitation-list")
async def get_seatings_for_invitation_list(
    invitation_list_id: Annotated[str, Query()],
    redis: Annotated[aioredis.Redis, Depends(get_redis)],
) -> list[SeatingMetadata]:
    """Return metadata of all seating arrangements for the invitation list."""
    seating_ids = await _get_seating_ids_for_list(redis, invitation_list_id)
    result: list[SeatingMetadata] = []
    for sid in seating_ids:
        raw = await redis.hget(ALL_SEATINGS_KEY, sid)
        if raw is not None:
            seating = Seating.model_validate_json(decompress(raw))
            result.append(seating.metadata)
    return result
