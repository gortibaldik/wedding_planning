import asyncio
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
HOTELS_KEY = "invitation_lists:hotels"  # Redis hash: hotel_id -> compressed HotelEntry


def _list_entries_key(list_id: str) -> str:
    return f"invitation_lists:entries:{list_id}"


class RSVPEnum(str, Enum):
    NOT_ANSWERED = "NOT_ANSWERED"
    WILL_COME = "WILL_COME"
    WONT_COME = "WONT_COME"


class AccommodationPaymentEnum(str, Enum):
    WE_PAID = "WE_PAID"
    """We paid for the accommodation as a gift; no reimbursement expected."""

    WE_RESERVED = "WE_RESERVED"
    """We fronted/reserved it; ``paid_back`` tracks whether the guest reimbursed us."""

    THEY_RESERVED_AND_PAID = "THEY_RESERVED_AND_PAID"
    """The guest handled and paid for the accommodation themselves."""


class HotelEntry(BaseModel):
    id: str
    name: str
    google_maps_link: str = ""


class AccommodationEntry(BaseModel):
    hotel_id: str
    payment: AccommodationPaymentEnum
    paid_back: bool = False
    """Whether the guest reimbursed us. Only meaningful when ``payment`` is WE_RESERVED."""


class FinalInvitationListEntry(BaseModel):
    person_id: str

    invitation_given: bool = False
    """Whether the person already received the invitation."""

    rsvpd: RSVPEnum = RSVPEnum.NOT_ANSWERED
    """Whether the person already answered the RSVP."""

    notes: str = ""
    """Any notes about the person."""

    accommodation: AccommodationEntry | None = None
    """Accommodation arranged for the person, if any."""


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


async def _get_entries(
    redis: aioredis.Redis, list_id: str
) -> list[InvitationEntry] | None:
    entries_raw = await redis.get(_list_entries_key(list_id))
    if entries_raw is None:
        return None

    return EntriesData.model_validate_json(decompress(entries_raw)).entries


async def _get_final_entries(
    redis: aioredis.Redis,
) -> list[FinalInvitationListEntry] | None:
    entries_raw = await redis.get(FINAL_LIST_ENTRIES_KEY)
    if entries_raw is None:
        return None

    return SetFinalEntriesRequest.model_validate_json(
        decompress(entries_raw)
    ).final_entries


async def _get_list_by_id(
    redis: aioredis.Redis, list_id: str
) -> InvitationList | FinalInvitationList | None:
    """Load a full invitation list (metadata + entries) by its id.

    Returns ``None`` if no list with ``list_id`` exists. If the list is the
    one currently marked as final, a ``FinalInvitationList`` is returned with
    its final entries populated; otherwise a plain ``InvitationList`` is
    returned.
    """
    meta_task = redis.hget(ALL_LIST_IDS_KEY, list_id)
    final_list_task = redis.get(FINAL_LIST_ID_KEY)
    meta_raw, final_list_id = await asyncio.gather(meta_task, final_list_task)
    if meta_raw is None:
        return None

    metadata = ListMetadata.model_validate_json(decompress(meta_raw))

    if metadata.id == final_list_id:
        invitation_list = FinalInvitationList(
            metadata=metadata, entries=[], final_entries=[]
        )
    else:
        invitation_list = InvitationList(metadata=metadata, entries=[])

    get_entries_task = _get_entries(redis=redis, list_id=list_id)
    if isinstance(invitation_list, FinalInvitationList):
        get_final_entries_task = _get_final_entries(redis)
        entries, final_entries = await asyncio.gather(
            get_entries_task, get_final_entries_task
        )
        invitation_list.final_entries = final_entries or []
    else:
        entries = await get_entries_task

    invitation_list.entries = entries or []
    return invitation_list


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
) -> InvitationList | FinalInvitationList:
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
    final_list_id = await redis.get(FINAL_LIST_ID_KEY)
    if final_list_id == list_id:
        await redis.delete(FINAL_LIST_ID_KEY)
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
    assert isinstance(invitation_list, FinalInvitationList)  # noqa: S101
    return invitation_list


@router.post("/set-final-entries")
async def set_final_entries(
    request: SetFinalEntriesRequest,
    redis: Annotated[aioredis.Redis, Depends(get_redis)],
    user: Annotated[dict, Depends(get_current_user)],
):
    if not _is_universal_list_setter(user):
        raise HTTPException(status_code=403, detail="Insufficient permissions")

    await redis.set(FINAL_LIST_ENTRIES_KEY, compress(request.model_dump_json()))


@router.get("/hotels")
async def get_hotels(
    redis: Annotated[aioredis.Redis, Depends(get_redis)],
) -> list[HotelEntry]:
    raw = await redis.hgetall(HOTELS_KEY)
    return [HotelEntry.model_validate_json(decompress(v)) for v in raw.values()]


@router.post("/hotels")
async def upsert_hotel(
    hotel: HotelEntry,
    redis: Annotated[aioredis.Redis, Depends(get_redis)],
    user: Annotated[dict, Depends(get_current_user)],
):
    """Create or update a single hotel by its id.

    Referenced from ``AccommodationEntry.hotel_id``. Hotels are stored
    independently of any invitation list.
    """
    if not _is_universal_list_setter(user):
        raise HTTPException(status_code=403, detail="Insufficient permissions")

    await redis.hset(HOTELS_KEY, hotel.id, compress(hotel.model_dump_json()))


def _clear_hotel_references(
    final_entries: list[FinalInvitationListEntry] | None, hotel_id: str
) -> tuple[bool, list[FinalInvitationListEntry]]:
    """Clear references to ``hotel_id`` from the final entries.

    Pure: the input entries are not mutated. Any entry whose accommodation
    points at ``hotel_id`` is replaced by a copy with ``accommodation`` set to
    ``None``; every other entry is returned unchanged. A ``None`` input (no
    final entries stored yet) is treated as an empty list.

    Returns ``(changed, entries)`` where ``changed`` is ``True`` iff at least
    one entry referenced the hotel — letting the caller skip a persist (and a
    full-list ``==`` comparison) when nothing changed.
    """
    changed = False
    cleared: list[FinalInvitationListEntry] = []
    for entry in final_entries or []:
        if entry.accommodation and entry.accommodation.hotel_id == hotel_id:
            cleared.append(entry.model_copy(update={"accommodation": None}))
            changed = True
        else:
            cleared.append(entry)
    return changed, cleared


@router.delete("/hotels/{hotel_id}")
async def delete_hotel(
    hotel_id: str,
    redis: Annotated[aioredis.Redis, Depends(get_redis)],
    user: Annotated[dict, Depends(get_current_user)],
):
    """Delete a single hotel by its id.

    Accommodation entries in the final list referencing this hotel are cleared
    (their ``accommodation`` is set to ``None``) so no entry is left pointing at
    a hotel that no longer exists.
    """
    if not _is_universal_list_setter(user):
        raise HTTPException(status_code=403, detail="Insufficient permissions")

    removed = await redis.hdel(HOTELS_KEY, hotel_id)
    if not removed:
        raise HTTPException(status_code=404, detail="Hotel not found")

    # Clear any final entries that still reference the deleted hotel.
    # (Same cavalier stance on race conditions as the rest of this module.)
    final_entries = await _get_final_entries(redis)
    changed, new_final_entries = _clear_hotel_references(final_entries, hotel_id)
    if changed:
        await redis.set(
            FINAL_LIST_ENTRIES_KEY,
            compress(
                SetFinalEntriesRequest(
                    final_entries=new_final_entries
                ).model_dump_json()
            ),
        )

    return {"status": "ok"}
