import logging
from pathlib import Path
from typing import Annotated

from fastapi import APIRouter, Depends, Request
from fastapi.responses import FileResponse
from fastapi.templating import Jinja2Templates
from markdown_it import MarkdownIt
from markupsafe import Markup

from backend.config import Config
from backend.dependencies import get_config, get_i18n

from .geo_utils import country_code

COUNTRY_TO_LANG = {"SK": "sk", "CZ": "cs", "RU": "ru"}
DEFAULT_LANG = "cs"

logger = logging.getLogger(__name__)
router = APIRouter()
templates = Jinja2Templates(directory=Path(__file__).parent / "templates")

_md = MarkdownIt("commonmark", {"breaks": True, "html": False, "linkify": True})
templates.env.filters["markdown"] = lambda s: Markup(_md.render(s or ""))


def pick_lang(request: Request) -> str:
    cc = country_code(request) or ""
    return COUNTRY_TO_LANG.get(cc, DEFAULT_LANG)


@router.get("/")
async def landing_page(
    request: Request,
    config: Annotated[Config, Depends(get_config)],
    i18n: Annotated[dict[str, dict], Depends(get_i18n)],
):
    lang = pick_lang(request)
    logger.info("landing page request", extra={"page": "landing", "lang": lang})
    text = i18n.get(lang) or i18n[DEFAULT_LANG]
    return templates.TemplateResponse(
        request,
        "landing.html",
        {"enable_local_auth": config.enable_local_auth, **text},
    )


root_path = Path(__file__).parent.parent.parent.parent
frontend_public = root_path / "frontend" / "public"
frontend_dist = root_path / "frontend" / "dist"


@router.get("/{path:path}")
async def serve_frontend(path: str):
    for base in [frontend_public, frontend_dist]:
        file = base / path
        if file.is_file():
            return FileResponse(file)
    return FileResponse(frontend_dist / "index.html")
