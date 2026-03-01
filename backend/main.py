from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles

from .dependencies import init_config
from .routers import authorization


@asynccontextmanager
async def lifespan(app: FastAPI):
    init_config()
    yield


app = FastAPI(lifespan=lifespan)

app.include_router(authorization.router)


# Serve Vue SPA - html=True enables SPA fallback (serves index.html for unknown routes)
frontend_dist = str(Path(__file__).parent.parent / "frontend" / "dist")
app.mount("/", StaticFiles(directory=frontend_dist, html=True), name="static")
