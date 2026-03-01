import logging
import sys
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles

from .dependencies import close_redis, get_config, init_config, init_redis
from .routers import authorization, invitation_lists

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s %(name)s: %(message)s",
    stream=sys.stdout,
)


@asynccontextmanager
async def lifespan(app: FastAPI):
    init_config()
    init_redis(get_config().rediscloud_url)
    yield
    await close_redis()


app = FastAPI(lifespan=lifespan)

app.include_router(authorization.router)
app.include_router(invitation_lists.router)


# Serve Vue SPA - html=True enables SPA fallback (serves index.html for unknown routes)
frontend_dist = str(Path(__file__).parent.parent / "frontend" / "dist")
app.mount("/", StaticFiles(directory=frontend_dist, html=True), name="static")
