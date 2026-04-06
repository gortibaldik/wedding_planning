import logging
from typing import Annotated, Literal

import redis.asyncio as aioredis
from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel

from backend.dependencies import get_current_user, get_redis

logger = logging.getLogger(__name__)
router = APIRouter(
    prefix="/seating-arrangement",
    dependencies=[Depends(get_current_user)],
)


class SeatingMetadata(BaseModel):
    owner_sub: str = ""
    """Owner sub, filled from the JWT."""

    owner_name: str
    """Owner name, filled from the JWT."""

    invitation_list_id: str
    """The id of the invitation list from which the table seating is done."""

    id: str
    """The id of the seating arrangement."""


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


@router.get("/get")
async def get_seating(
    id: Annotated[str, Query()],
    redis: Annotated[aioredis.Redis, Depends(get_redis)],
    user: Annotated[dict, Depends(get_current_user)],
) -> Seating:
    """Get the seating arrangement with a given id."""
    # fill in


@router.post("/set")
async def set_seating(
    redis: Annotated[aioredis.Redis, Depends(get_redis)],
    user: Annotated[dict, Depends(get_current_user)],
    seating: Seating,
):
    """Set the seating arrangement."""
    # fill in


@router.get("/get-seatings-for-invitation_list")
async def get_seatings_for_invitation_list(
    invitation_list_id: Annotated[str, Query()],
    redis: Annotated[aioredis.Redis, Depends(get_redis)],
) -> list[str]:
    """Return all seating arrangements for the invitation list."""
    # fill in
