import logging
import uuid
from typing import Annotated, Any

import redis.asyncio as aioredis
from fastapi import APIRouter, Body, Depends, HTTPException
from pydantic import BaseModel

from backend.dependencies import get_current_user, get_redis

from .utils.compression import compress, decompress

logger = logging.getLogger(__name__)
router = APIRouter(
    prefix="/family-structure",
    dependencies=[Depends(get_current_user)],
)


class FamilyGraph(BaseModel):
    nodes: Any
    edges: Any


# family structure is saved in such a way that it's easy to retrieve all the history
class FamilyStructure(BaseModel):
    previous_id: str | None = None
    this_id: str | None = None
    data: FamilyGraph | None = None


CURRENT_FAMILY_STRUCTURE_ID_KEY: str = "current_family_structure_id"
FAMILY_STRUCTURE_RW_STATUS_KEY: str = "family_structure_rw_status"


@router.get("/get")
async def get_family_structure(
    redis: Annotated[aioredis.Redis, Depends(get_redis)],
) -> Any:
    current_key = await redis.get(CURRENT_FAMILY_STRUCTURE_ID_KEY)
    if current_key is None:
        return None

    value = await redis.get(current_key)
    family_structure = FamilyStructure.model_validate_json(decompress(value))
    return family_structure.data


@router.post("/set")
async def set_family_structure(
    redis: Annotated[aioredis.Redis, Depends(get_redis)],
    request_body: Annotated[Any, Body()],
):
    status = await redis.get(FAMILY_STRUCTURE_RW_STATUS_KEY)
    if status != "read-write":
        raise HTTPException(
            status_code=403, detail="Family structure is in read-only mode"
        )

    current_key = await redis.get(CURRENT_FAMILY_STRUCTURE_ID_KEY)
    next_key = str(uuid.uuid4())
    await redis.set(
        name=next_key,
        value=compress(
            FamilyStructure(
                previous_id=current_key, this_id=next_key, data=request_body
            ).model_dump_json()
        ),
    )
    await redis.set(name=CURRENT_FAMILY_STRUCTURE_ID_KEY, value=next_key)


@router.get("/get-status")
async def get_family_structure_status(
    redis: Annotated[aioredis.Redis, Depends(get_redis)],
) -> str:
    status = await redis.get(FAMILY_STRUCTURE_RW_STATUS_KEY)
    return status or "read"


@router.post("/change-status")
async def change_family_structure_status(
    redis: Annotated[aioredis.Redis, Depends(get_redis)],
    user: Annotated[dict, Depends(get_current_user)],
) -> str:
    if "change-genealogy-tree-rw-status" not in user.get("roles", []):
        raise HTTPException(status_code=403, detail="Insufficient permissions")

    current = await redis.get(FAMILY_STRUCTURE_RW_STATUS_KEY)
    new_status = "read-write" if current != "read-write" else "read"
    await redis.set(FAMILY_STRUCTURE_RW_STATUS_KEY, new_status)
    return new_status
