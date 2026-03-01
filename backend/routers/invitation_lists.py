import base64
import logging
import zlib
from typing import Annotated, Any

import redis.asyncio as aioredis
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from backend.dependencies import get_current_user, get_redis

logger = logging.getLogger(__name__)
router = APIRouter(
    prefix="/invitation_lists",
    dependencies=[Depends(get_current_user)],
)

REDIS_KEY = "invitation_list"


class InvitationIds(BaseModel):
    ids: list[str]


class InvitationListModel(BaseModel):
    """Invitation list is a list of all the guests together with seating information etc.

    Everything is stored in field self.data.
    """

    name: str
    """Name of the invitation list."""

    owner: str
    """Email of the owner of the invitation list."""

    data: Any
    """Data in the invitation list."""


@router.get("/get-ids", tags=["invitation_lists"])
async def get_ids(
    redis: Annotated[aioredis.Redis, Depends(get_redis)],
) -> InvitationIds:
    ids = await redis.smembers(REDIS_KEY)
    return InvitationIds(ids=sorted(ids))


@router.post("/add-invitation-list", tags=["invitation_lists"])
async def add_invitation_list(
    invitation_list: InvitationListModel,
    redis: Annotated[aioredis.Redis, Depends(get_redis)],
):
    compressed = base64.b64encode(
        zlib.compress(invitation_list.model_dump_json().encode())
    ).decode()
    await redis.sadd(REDIS_KEY, invitation_list.name)
    await redis.set(name=invitation_list.name, value=compressed)


@router.get("/get-invitation-list/{name}", tags=["invitation_lists"])
async def get_invitation_list(
    name: str,
    redis: Annotated[aioredis.Redis, Depends(get_redis)],
) -> InvitationListModel:
    value = await redis.get(name)
    if value is None:
        raise HTTPException(
            status_code=404, detail=f"Invitation list '{name}' not found"
        )
    return InvitationListModel.model_validate_json(
        zlib.decompress(base64.b64decode(value)).decode()
    )


@router.get("/remove-invitation-list/{name}", tags=["invitation_lists"])
async def remove_invitation_list(
    name: str,
    redis: Annotated[aioredis.Redis, Depends(get_redis)],
):
    logger.info(f"Removing invitation list: '{name}'")
    await redis.srem(REDIS_KEY, name)
    await redis.delete(name)
    return {"result", "success"}
