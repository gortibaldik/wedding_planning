import json
import logging
from pathlib import Path
from typing import Annotated

from fastapi import APIRouter, Depends, Request
from fastapi.responses import FileResponse
from fastapi.templating import Jinja2Templates

from backend.config import Config
from backend.dependencies import get_config

from .geo_utils import country_code

I18N_DIR = Path(__file__).parent / "i18n"

COUNTRY_TO_LANG = {"SK": "sk", "CZ": "cs", "RU": "ru"}
DEFAULT_LANG = "cs"

logger = logging.getLogger(__name__)
router = APIRouter()
templates = Jinja2Templates(directory=Path(__file__).parent / "templates")


def load_i18n(lang: str) -> dict:
    path = I18N_DIR / f"{lang}.json"
    if not path.exists():
        path = I18N_DIR / f"{DEFAULT_LANG}.json"
    with path.open(encoding="utf-8") as f:
        return json.load(f)


def pick_lang(request: Request) -> str:
    cc = country_code(request) or ""
    return COUNTRY_TO_LANG.get(cc, DEFAULT_LANG)


@router.get("/")
async def landing_page(
    request: Request, config: Annotated[Config, Depends(get_config)]
):
    lang = pick_lang(request)
    logger.info("Arrived request, serving landing.html (lang=%s)", lang)
    text = load_i18n(lang)
    return templates.TemplateResponse(
        request,
        "landing.html",
        {"enable_local_auth": config.enable_local_auth, **text},
    )


root_path = Path(__file__).parent.parent.parent
frontend_public = root_path / "frontend" / "public"
frontend_dist = root_path / "frontend" / "dist"


@router.get("/{path:path}")
async def serve_frontend(path: str):
    for base in [frontend_public, frontend_dist]:
        file = base / path
        if file.is_file():
            return FileResponse(file)
    return FileResponse(frontend_dist / "index.html")
