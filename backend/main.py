import logging
import sys
from contextlib import asynccontextmanager

from fastapi import FastAPI
from pythonjsonlogger.json import JsonFormatter

from .dependencies import (
    close_redis,
    get_config,
    init_config,
    init_drive_service,
    init_i18n,
    init_redis,
)
from .routers import (
    authorization,
    family_structure,
    index,
    invitation_lists,
    managed_files,
    seating,
)

_handler = logging.StreamHandler(sys.stdout)
_handler.setFormatter(JsonFormatter("%(asctime)s %(levelname)s %(name)s %(message)s"))
logging.basicConfig(level=logging.INFO, handlers=[_handler])
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("APP starts initializing")
    init_config()
    init_redis(get_config().rediscloud_url)
    init_drive_service()
    await init_i18n(
        langs=list(index.COUNTRY_TO_LANG.values()) + [index.DEFAULT_LANG],
        default_lang=index.DEFAULT_LANG,
    )
    logger.info("APP initialized")
    yield
    await close_redis()


app = FastAPI(lifespan=lifespan)

app.include_router(authorization.router)
app.include_router(invitation_lists.router)
app.include_router(family_structure.router)
app.include_router(seating.router)
app.include_router(managed_files.router)
app.include_router(index.router)
