import logging
from typing import Annotated

import redis.asyncio as aioredis
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from backend.dependencies import get_current_user, get_redis

from .utils.compression import compress, decompress

logger = logging.getLogger(__name__)
router = APIRouter(
    prefix="/invitation-lists",
    dependencies=[Depends(get_current_user)],
)

UNIVERSAL_SETTER_ROLE = "universal-invitation-list-setter"

# Redis keys
ALL_LIST_IDS_KEY = (
    "invitation_lists:all_ids"  # Redis hash: list_id -> compressed ListMetadata
)
FINAL_LIST_ID_KEY = "invitation_lists:final_id"  # Redis string: list_id


def _list_entries_key(list_id: str) -> str:
    return f"invitation_lists:entries:{list_id}"


class InvitationEntry(BaseModel):
    person_id: str
    invited: bool


class ListMetadata(BaseModel):
    id: str
    name: str
    owner_sub: str
    owner_name: str


class InvitationList(BaseModel):
    metadata: ListMetadata
    entries: list[InvitationEntry]


class EntriesData(BaseModel):
    entries: list[InvitationEntry]


async def _get_list_by_id(redis: aioredis.Redis, list_id: str) -> InvitationList | None:
    meta_raw = await redis.hget(ALL_LIST_IDS_KEY, list_id)
    if meta_raw is None:
        return None

    metadata = ListMetadata.model_validate_json(decompress(meta_raw))
    entries_raw = await redis.get(_list_entries_key(list_id))
    entries = (
        EntriesData.model_validate_json(decompress(entries_raw)).entries
        if entries_raw is not None
        else []
    )
    return InvitationList(metadata=metadata, entries=entries)


@router.get("/get-all-ids")
async def get_all_ids(
    redis: Annotated[aioredis.Redis, Depends(get_redis)],
) -> list[ListMetadata]:
    raw = await redis.hgetall(ALL_LIST_IDS_KEY)
    return [ListMetadata.model_validate_json(decompress(v)) for v in raw.values()]


@router.get("/get/{list_id}")
async def get_list(
    list_id: str,
    redis: Annotated[aioredis.Redis, Depends(get_redis)],
) -> InvitationList:
    inv_list = await _get_list_by_id(redis, list_id)
    if inv_list is None:
        raise HTTPException(status_code=404, detail="List not found")
    return inv_list


class SetListRequest(BaseModel):
    list_name: str
    entries: list[InvitationEntry]


@router.post("/set/{list_id}")
async def set_list(
    list_id: str,
    redis: Annotated[aioredis.Redis, Depends(get_redis)],
    user: Annotated[dict, Depends(get_current_user)],
    request_body: SetListRequest,
):
    meta_raw = await redis.hget(ALL_LIST_IDS_KEY, list_id)
    if meta_raw is not None:
        # Update existing list — check ownership
        metadata = ListMetadata.model_validate_json(decompress(meta_raw))
        is_owner = metadata.owner_sub == user.get("sub")
        is_universal = UNIVERSAL_SETTER_ROLE in user.get("roles", [])
        if not is_owner and not is_universal:
            raise HTTPException(status_code=403, detail="Not allowed to edit this list")
        metadata.name = request_body.list_name
    else:
        # Create new list — caller becomes owner
        metadata = ListMetadata(
            id=list_id,
            name=request_body.list_name,
            owner_sub=user.get("sub", ""),
            owner_name=user.get("name", ""),
        )

    await redis.hset(ALL_LIST_IDS_KEY, list_id, compress(metadata.model_dump_json()))
    await redis.set(
        _list_entries_key(list_id),
        compress(EntriesData(entries=request_body.entries).model_dump_json()),
    )


@router.post("/set-final/{list_id}")
async def set_final(
    list_id: str,
    redis: Annotated[aioredis.Redis, Depends(get_redis)],
    user: Annotated[dict, Depends(get_current_user)],
):
    if UNIVERSAL_SETTER_ROLE not in user.get("roles", []):
        raise HTTPException(status_code=403, detail="Insufficient permissions")

    exists = await redis.hexists(ALL_LIST_IDS_KEY, list_id)
    if not exists:
        raise HTTPException(status_code=404, detail="List not found")

    await redis.set(FINAL_LIST_ID_KEY, list_id)


@router.post("/unset-final")
async def unset_final(
    redis: Annotated[aioredis.Redis, Depends(get_redis)],
    user: Annotated[dict, Depends(get_current_user)],
):
    if UNIVERSAL_SETTER_ROLE not in user.get("roles", []):
        raise HTTPException(status_code=403, detail="Insufficient permissions")

    await redis.delete(FINAL_LIST_ID_KEY)


@router.get("/get-final")
async def get_final(
    redis: Annotated[aioredis.Redis, Depends(get_redis)],
) -> InvitationList | None:
    final_id = await redis.get(FINAL_LIST_ID_KEY)
    if final_id is None:
        raise HTTPException(status_code=404, detail="List not found")
    return await _get_list_by_id(redis, final_id)
