import logging
from enum import Enum
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

UNIVERSAL_INVITATION_LIST_SETTER_ROLE = "universal-invitation-list-setter"

# Redis keys
ALL_LIST_IDS_KEY = (
    "invitation_lists:all_ids"  # Redis hash: list_id -> compressed ListMetadata
)
FINAL_LIST_ID_KEY = "invitation_lists:final_id"  # Redis string: list_id
FINAL_LIST_ENTRIES_KEY = "invitation_lists:final:entries"


def _list_entries_key(list_id: str) -> str:
    return f"invitation_lists:entries:{list_id}"


class RSVPEnum(str, Enum):
    NOT_ANSWERED = "NOT_ANSWERED"
    WILL_COME = "WILL_COME"
    WONT_COME = "WONT_COME"


class FinalInvitationListEntry(BaseModel):
    person_id: str

    invitation_given: bool = False
    """Whether the person already received the invitation."""

    rsvpd: RSVPEnum = RSVPEnum.NOT_ANSWERED
    """Whether the person already answered the RSVP."""

    notes: str = ""
    """Any notes about the person."""


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


class FinalInvitationList(BaseModel):
    metadata: ListMetadata
    entries: list[InvitationEntry]
    final_entries: list[FinalInvitationListEntry]


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


def _is_universal_list_setter(user: dict):
    """Flag signifying that this user is allowed to make changes to any list."""
    return UNIVERSAL_INVITATION_LIST_SETTER_ROLE in user.get("roles", [])


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
        if not is_owner and not _is_universal_list_setter(user):
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


@router.delete("/set/{list_id}")
async def delete_list(
    list_id: str,
    redis: Annotated[aioredis.Redis, Depends(get_redis)],
    user: Annotated[dict, Depends(get_current_user)],
):
    meta_raw = await redis.hget(ALL_LIST_IDS_KEY, list_id)
    if meta_raw is not None:
        # Update existing list — check ownership
        metadata = ListMetadata.model_validate_json(decompress(meta_raw))
        is_owner = metadata.owner_sub == user.get("sub")
        if not is_owner and not _is_universal_list_setter(user):
            raise HTTPException(
                status_code=403, detail="Not allowed to delete this list"
            )
    else:
        raise HTTPException(
            status_code=404, detail=f"The list with id '{list_id}' does not exist."
        )

    # lol, this is very unsafe for any race conditions, but I decided to live with it
    await redis.delete(_list_entries_key(list_id))
    await redis.hdel(ALL_LIST_IDS_KEY, list_id)
    return {"status": "ok"}


class SetFinalEntriesRequest(BaseModel):
    final_entries: list[FinalInvitationListEntry]


@router.post("/set-final/{list_id}")
async def set_final(
    list_id: str,
    redis: Annotated[aioredis.Redis, Depends(get_redis)],
    user: Annotated[dict, Depends(get_current_user)],
):
    if not _is_universal_list_setter(user):
        raise HTTPException(status_code=403, detail="Insufficient permissions")

    exists = await redis.hexists(ALL_LIST_IDS_KEY, list_id)
    if not exists:
        raise HTTPException(status_code=404, detail="List not found")

    await redis.set(FINAL_LIST_ID_KEY, list_id)

    # again a beautiful race condition, I decided to live with it
    final_entries_exist = await redis.exists(FINAL_LIST_ENTRIES_KEY)
    if not final_entries_exist:
        await redis.set(
            FINAL_LIST_ENTRIES_KEY,
            compress(SetFinalEntriesRequest(final_entries=[]).model_dump_json()),
        )


@router.post("/unset-final")
async def unset_final(
    redis: Annotated[aioredis.Redis, Depends(get_redis)],
    user: Annotated[dict, Depends(get_current_user)],
):
    if not _is_universal_list_setter(user):
        raise HTTPException(status_code=403, detail="Insufficient permissions")

    await redis.delete(FINAL_LIST_ID_KEY)


@router.get("/get-final")
async def get_final(
    redis: Annotated[aioredis.Redis, Depends(get_redis)],
) -> FinalInvitationList | None:
    final_id = await redis.get(FINAL_LIST_ID_KEY)
    if final_id is None:
        raise HTTPException(status_code=404, detail="List not found")
    invitation_list = await _get_list_by_id(redis, final_id)
    final_entries_raw = decompress(await redis.get(FINAL_LIST_ENTRIES_KEY))
    final_entries = SetFinalEntriesRequest.model_validate_json(final_entries_raw)
    logger.warning(
        f"FINAL_ENTRIES from redis: {final_entries.model_dump_json(indent=2)}"
    )
    return FinalInvitationList(
        metadata=invitation_list.metadata,
        entries=invitation_list.entries,
        final_entries=final_entries.final_entries,
    )


@router.post("/set-final-entries")
async def set_final_entries(
    request: SetFinalEntriesRequest,
    redis: Annotated[aioredis.Redis, Depends(get_redis)],
    user: Annotated[dict, Depends(get_current_user)],
):
    if not _is_universal_list_setter(user):
        raise HTTPException(status_code=403, detail="Insufficient permissions")

    logger.warning(f"FINAL_ENTRIES that arrived: {request.model_dump_json(indent=2)}")
    await redis.set(FINAL_LIST_ENTRIES_KEY, compress(request.model_dump_json()))
