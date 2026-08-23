"""Links to external documents (Google Docs meeting notes, plans, ...).

The whole structure — the collapsible sections and the links inside them — lives
in Redis, so sections can be added/renamed/reordered from the app without a
redeploy.
"""

import logging
import uuid
from typing import Annotated

import redis.asyncio as aioredis
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, field_validator

from backend.dependencies import get_current_user, get_redis

from .utils.compression import compress, decompress

DOCUMENTS_VIEWER_ROLE = "documents-viewer"
DOCUMENTS_EDITOR_ROLE = "documents-editor"

logger = logging.getLogger(__name__)

# Redis hashes: entity_id -> compressed JSON
SECTIONS_KEY = "documents:sections"
ITEMS_KEY = "documents:items"


def _require_viewer(user: Annotated[dict, Depends(get_current_user)]) -> dict:
    """Require viewer role for reading the endpoint."""
    if DOCUMENTS_VIEWER_ROLE not in (user.get("roles") or []):
        raise HTTPException(status_code=403, detail="Insufficient permissions")
    return user


def _require_editor(user: Annotated[dict, Depends(get_current_user)]) -> dict:
    """Require the edior role for editing the documents."""
    if DOCUMENTS_EDITOR_ROLE not in (user.get("roles") or []):
        raise HTTPException(status_code=403, detail="Insufficient permissions")
    return user


router = APIRouter(
    prefix="/documents",
    dependencies=[Depends(_require_viewer)],
)


class SectionInput(BaseModel):
    title: str
    description: str = ""


class Section(SectionInput):
    id: str
    order: int
    """Position among the sections; the tree is returned sorted by it."""


class DocumentInput(BaseModel):
    section_id: str
    title: str
    url: str
    description: str = ""

    @field_validator("url")
    @classmethod
    def _validate_url(cls, value: str) -> str:
        value = value.strip()
        if not value.startswith(("http://", "https://")):
            raise ValueError("URL must start with http:// or https://")  # noqa: TRY003
        return value


class Document(DocumentInput):
    id: str
    order: int
    """Position within its section."""


class SectionWithDocuments(Section):
    documents: list[Document]


class ReorderInput(BaseModel):
    ids: list[str]
    """The ids in their new order; unlisted entities keep their relative order."""


async def _load_sections(redis: aioredis.Redis) -> list[Section]:
    raw = await redis.hgetall(SECTIONS_KEY)
    sections = [Section.model_validate_json(decompress(v)) for v in raw.values()]
    return sorted(sections, key=lambda s: (s.order, s.title))


async def _load_documents(redis: aioredis.Redis) -> list[Document]:
    raw = await redis.hgetall(ITEMS_KEY)
    documents = [Document.model_validate_json(decompress(v)) for v in raw.values()]
    return sorted(documents, key=lambda d: (d.order, d.title))


def _next_order(entities: list[Section] | list[Document]) -> int:
    """Position that appends after everything currently stored."""
    return max((e.order for e in entities), default=-1) + 1


async def _reorder(redis: aioredis.Redis, key: str, model, ids: list[str]) -> None:
    """Renumber the listed entities' ``order`` to match the given sequence."""
    raw = await redis.hmget(key, ids)
    mapping = {}
    for order, (entity_id, value) in enumerate(zip(ids, raw, strict=True)):
        if value is None:
            raise HTTPException(status_code=404, detail=f"Unknown id {entity_id}")
        entity = model.model_validate_json(decompress(value))
        entity.order = order
        mapping[entity_id] = compress(entity.model_dump_json())
    if mapping:
        await redis.hset(key, mapping=mapping)


@router.get("/")
async def get_tree(
    redis: Annotated[aioredis.Redis, Depends(get_redis)],
) -> list[SectionWithDocuments]:
    """Get the full tree: every section with the documents it holds, both ordered."""
    sections = await _load_sections(redis)
    documents = await _load_documents(redis)
    by_section: dict[str, list[Document]] = {section.id: [] for section in sections}
    for document in documents:
        # Documents of a deleted section are dropped from the tree (deleting a
        # section deletes its documents, so this should not normally happen).
        if document.section_id in by_section:
            by_section[document.section_id].append(document)
    return [
        SectionWithDocuments(**section.model_dump(), documents=by_section[section.id])
        for section in sections
    ]


# ---- Sections ----


@router.post("/sections", dependencies=[Depends(_require_editor)])
async def create_section(
    section_input: SectionInput,
    redis: Annotated[aioredis.Redis, Depends(get_redis)],
) -> Section:
    """Append a new section at the end."""
    order = _next_order(await _load_sections(redis))
    section = Section(id=str(uuid.uuid4()), order=order, **section_input.model_dump())
    await redis.hset(SECTIONS_KEY, section.id, compress(section.model_dump_json()))
    return section


@router.put("/sections/{section_id}", dependencies=[Depends(_require_editor)])
async def update_section(
    section_id: str,
    section_input: SectionInput,
    redis: Annotated[aioredis.Redis, Depends(get_redis)],
) -> Section:
    """Rename a section (its position is kept; use /sections/reorder to move it)."""
    raw = await redis.hget(SECTIONS_KEY, section_id)
    if raw is None:
        raise HTTPException(status_code=404, detail="Section not found")
    existing = Section.model_validate_json(decompress(raw))
    section = Section(id=section_id, order=existing.order, **section_input.model_dump())
    await redis.hset(SECTIONS_KEY, section_id, compress(section.model_dump_json()))
    return section


@router.delete("/sections/{section_id}", dependencies=[Depends(_require_editor)])
async def delete_section(
    section_id: str,
    redis: Annotated[aioredis.Redis, Depends(get_redis)],
):
    """Delete a section together with every document inside it."""
    if not await redis.hexists(SECTIONS_KEY, section_id):
        raise HTTPException(status_code=404, detail="Section not found")
    orphans = [d.id for d in await _load_documents(redis) if d.section_id == section_id]
    if orphans:
        await redis.hdel(ITEMS_KEY, *orphans)
    await redis.hdel(SECTIONS_KEY, section_id)
    return {"status": "ok", "deleted_documents": len(orphans)}


@router.post("/sections/reorder", dependencies=[Depends(_require_editor)])
async def reorder_sections(
    reorder_input: ReorderInput,
    redis: Annotated[aioredis.Redis, Depends(get_redis)],
):
    """Set the order of the sections to the given sequence of ids."""
    await _reorder(redis, SECTIONS_KEY, Section, reorder_input.ids)
    return {"status": "ok"}


# ---- Documents ----


@router.post("/items", dependencies=[Depends(_require_editor)])
async def create_document(
    document_input: DocumentInput,
    redis: Annotated[aioredis.Redis, Depends(get_redis)],
) -> Document:
    """Append a new document link at the end of its section."""
    if not await redis.hexists(SECTIONS_KEY, document_input.section_id):
        raise HTTPException(status_code=404, detail="Section not found")
    siblings = [
        d
        for d in await _load_documents(redis)
        if d.section_id == document_input.section_id
    ]
    document = Document(
        id=str(uuid.uuid4()),
        order=_next_order(siblings),
        **document_input.model_dump(),
    )
    await redis.hset(ITEMS_KEY, document.id, compress(document.model_dump_json()))
    return document


@router.put("/items/{document_id}", dependencies=[Depends(_require_editor)])
async def update_document(
    document_id: str,
    document_input: DocumentInput,
    redis: Annotated[aioredis.Redis, Depends(get_redis)],
) -> Document:
    """Update a document link; moving it to another section appends it there."""
    raw = await redis.hget(ITEMS_KEY, document_id)
    if raw is None:
        raise HTTPException(status_code=404, detail="Document not found")
    if not await redis.hexists(SECTIONS_KEY, document_input.section_id):
        raise HTTPException(status_code=404, detail="Section not found")
    existing = Document.model_validate_json(decompress(raw))
    order = existing.order
    if existing.section_id != document_input.section_id:
        siblings = [
            d
            for d in await _load_documents(redis)
            if d.section_id == document_input.section_id
        ]
        order = _next_order(siblings)
    document = Document(id=document_id, order=order, **document_input.model_dump())
    await redis.hset(ITEMS_KEY, document_id, compress(document.model_dump_json()))
    return document


@router.delete("/items/{document_id}", dependencies=[Depends(_require_editor)])
async def delete_document(
    document_id: str,
    redis: Annotated[aioredis.Redis, Depends(get_redis)],
):
    """Delete a document link."""
    if not await redis.hdel(ITEMS_KEY, document_id):
        raise HTTPException(status_code=404, detail="Document not found")
    return {"status": "ok"}


@router.post("/items/reorder", dependencies=[Depends(_require_editor)])
async def reorder_documents(
    reorder_input: ReorderInput,
    redis: Annotated[aioredis.Redis, Depends(get_redis)],
):
    """Set the order of documents within one section to the given sequence of ids."""
    await _reorder(redis, ITEMS_KEY, Document, reorder_input.ids)
    return {"status": "ok"}
