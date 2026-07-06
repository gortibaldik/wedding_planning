import json
import logging
from typing import Annotated, Any

import redis.asyncio as aioredis
from fastapi import APIRouter, Body, Depends, HTTPException

from backend.config import Config
from backend.dependencies import get_config, get_current_user, get_i18n, get_redis
from backend.drive import write_json_file

from .index import COUNTRY_TO_LANG, DEFAULT_LANG
from .utils.compression import decompress

MANAGED_FILES_EDITOR_ROLE = "managed-files-editor"
MANAGED_FILES_DUMP_ROLE = "managed-files-dump"

logger = logging.getLogger(__name__)
router = APIRouter(
    prefix="/managed-files",
    dependencies=[Depends(get_current_user)],
)


def _all_langs() -> list[str]:
    return sorted({*COUNTRY_TO_LANG.values(), DEFAULT_LANG})


def _require_editor(user: dict) -> None:
    if MANAGED_FILES_EDITOR_ROLE not in (user.get("roles") or []):
        raise HTTPException(status_code=403, detail="Insufficient permissions")


def _require_dump_role(user: dict) -> None:
    if MANAGED_FILES_DUMP_ROLE not in (user.get("roles") or []):
        raise HTTPException(status_code=403, detail="Insufficient permissions")


@router.get("/i18n")
async def list_i18n(
    i18n: Annotated[dict[str, dict], Depends(get_i18n)],
):
    langs = _all_langs()
    return {
        "langs": langs,
        "default_lang": DEFAULT_LANG,
        "files": {lang: i18n.get(lang, {}) for lang in langs},
    }


@router.put("/i18n/{lang}")
async def update_i18n(
    lang: str,
    user: Annotated[dict, Depends(get_current_user)],
    config: Annotated[Config, Depends(get_config)],
    i18n: Annotated[dict[str, dict], Depends(get_i18n)],
    payload: Annotated[dict, Body(...)],
):
    _require_editor(user)
    if lang not in _all_langs():
        raise HTTPException(status_code=400, detail=f"Unknown language '{lang}'")
    await write_json_file(
        config.google_application_credentials_json,
        config.google_drive_i18n_folder_id,
        f"{lang}.json",
        payload,
    )
    i18n[lang] = payload
    logger.info("Updated i18n file for lang %s by %s", lang, user.get("sub"))
    return {"ok": True, "lang": lang}


def _decode_value(raw: str) -> Any:
    """Best-effort decode of a stored value into human-readable data.

    Many values are written via ``compress()`` (base64 + zlib of a JSON string), so we
    try to decompress and JSON-parse them. Plain values (e.g. the current-structure id
    or the ``read``/``read-write`` status) aren't compressed, so we fall back to the raw
    string, and to the decompressed-but-not-JSON text where applicable.
    """
    if not isinstance(raw, str):
        return raw
    text = raw
    try:
        text = decompress(raw)
    except Exception:  # noqa: BLE001 - not compressed; keep the raw string
        text = raw
    try:
        return json.loads(text)
    except (ValueError, TypeError):
        return text


async def _dump_key(redis: aioredis.Redis, key: str) -> dict[str, Any]:
    """Return a ``{"type", "value"}`` dump of one key, decoding compressed values."""
    key_type = await redis.type(key)
    if key_type == "string":
        value: Any = _decode_value(await redis.get(key))
    elif key_type == "hash":
        value = {f: _decode_value(v) for f, v in (await redis.hgetall(key)).items()}
    elif key_type == "list":
        value = [_decode_value(v) for v in await redis.lrange(key, 0, -1)]
    elif key_type == "set":
        value = sorted((_decode_value(v) for v in await redis.smembers(key)), key=str)
    elif key_type == "zset":
        value = [
            [_decode_value(m), score]
            for m, score in await redis.zrange(key, 0, -1, withscores=True)
        ]
    else:
        value = None
    return {"type": key_type, "value": value}


@router.get("/redis-dump")
async def redis_dump(
    user: Annotated[dict, Depends(get_current_user)],
    redis: Annotated[aioredis.Redis, Depends(get_redis)],
) -> dict[str, dict[str, Any]]:
    """Dump every key currently stored in Redis, keyed by key name."""
    _require_dump_role(user)
    dump: dict[str, dict[str, Any]] = {}
    async for key in redis.scan_iter(count=100):
        dump[key] = await _dump_key(redis, key)
    logger.info("Redis dump requested by %s (%d keys)", user.get("sub"), len(dump))
    return dump
