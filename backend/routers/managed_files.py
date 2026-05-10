import logging
from typing import Annotated

from fastapi import APIRouter, Body, Depends, HTTPException

from backend.config import Config
from backend.dependencies import get_config, get_current_user, get_i18n
from backend.drive import write_json_file

from .index import COUNTRY_TO_LANG, DEFAULT_LANG

MANAGED_FILES_EDITOR_ROLE = "managed-files-editor"

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
