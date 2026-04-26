import logging
import sys
from contextlib import asynccontextmanager
from pathlib import Path
from typing import Annotated

from fastapi import Depends, FastAPI, Request
from fastapi.responses import FileResponse
from fastapi.templating import Jinja2Templates

from .config import Config
from .dependencies import close_redis, get_config, init_config, init_redis
from .routers import authorization, family_structure, invitation_lists, seating

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s %(name)s: %(message)s",
    stream=sys.stdout,
)
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    init_config()
    init_redis(get_config().rediscloud_url)
    yield
    await close_redis()


app = FastAPI(lifespan=lifespan)

templates = Jinja2Templates(directory=Path(__file__).parent / "templates")

app.include_router(authorization.router)
app.include_router(invitation_lists.router)
app.include_router(family_structure.router)
app.include_router(seating.router)


@app.get("/")
async def landing_page(
    request: Request, config: Annotated[Config, Depends(get_config)]
):
    logger.info("Arrived request and returning landing.html!")
    return templates.TemplateResponse(
        request, "landing.html", {"enable_local_auth": config.enable_local_auth}
    )


frontend_public = Path(__file__).parent.parent / "frontend" / "public"
frontend_dist = Path(__file__).parent.parent / "frontend" / "dist"


@app.get("/{path:path}")
async def serve_frontend(path: str):
    for base in [frontend_public, frontend_dist]:
        file = base / path
        if file.is_file():
            return FileResponse(file)
    return FileResponse(frontend_dist / "index.html")
