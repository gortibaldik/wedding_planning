import logging
import sys
from contextlib import asynccontextmanager

from fastapi import FastAPI

from .dependencies import close_redis, get_config, init_config, init_redis
from .routers import authorization, family_structure, index, invitation_lists, seating

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

app.include_router(authorization.router)
app.include_router(invitation_lists.router)
app.include_router(family_structure.router)
app.include_router(seating.router)
app.include_router(index.router)
