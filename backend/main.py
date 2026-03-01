from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles
import os

from .dependencies import init_config
from .routers import authorization


@asynccontextmanager
async def lifespan(app: FastAPI):
    init_config()
    yield


app = FastAPI(lifespan=lifespan)

app.include_router(authorization.router)


# Serve Vue SPA - html=True enables SPA fallback (serves index.html for unknown routes)
frontend_dist = os.path.join(os.path.dirname(__file__), "..", "frontend", "dist")
app.mount("/", StaticFiles(directory=frontend_dist, html=True), name="static")
