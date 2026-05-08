import asyncio
from typing import Annotated
from urllib.parse import urlparse

import redis.asyncio as aioredis
from fastapi import Depends, HTTPException
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jose import JWTError, jwt

from .config import Config
from .drive import build_drive_service, read_json_file

config: Config | None = None
redis_client: aioredis.Redis | None = None
drive_service = None
i18n_cache: dict[str, dict] = {}


def init_config():
    global config
    config = Config()


def get_config() -> Config:
    return config


def init_drive_service():
    global drive_service
    drive_service = build_drive_service(config.google_application_credentials_json)


def get_drive_service():
    return drive_service


async def init_i18n(langs: list[str], default_lang: str):
    global i18n_cache
    unique_langs = list(dict.fromkeys(langs))
    results = await asyncio.gather(
        *[
            read_json_file(
                config.google_application_credentials_json,
                config.google_drive_i18n_folder_id,
                f"{lang}.json",
            )
            for lang in unique_langs
        ]
    )
    i18n_cache = dict(zip(unique_langs, results, strict=False))
    if default_lang not in i18n_cache:
        raise RuntimeError(  # noqa: TRY003
            f"Default i18n lang '{default_lang}' not found in Drive folder"
        )


def get_i18n() -> dict[str, dict]:
    return i18n_cache


def init_redis(rediscloud_url: str):
    global redis_client
    url = urlparse(rediscloud_url)
    redis_client = aioredis.Redis(
        host=url.hostname,
        port=url.port,
        password=url.password,
        decode_responses=True,
    )


async def close_redis():
    global redis_client
    if redis_client:
        await redis_client.aclose()


def get_redis() -> aioredis.Redis:
    return redis_client


_bearer = HTTPBearer()


def get_current_user(
    credentials: Annotated[HTTPAuthorizationCredentials, Depends(_bearer)],
    config: Annotated[Config, Depends(get_config)],
) -> dict:
    try:
        return jwt.decode(
            credentials.credentials, config.secret_key, algorithms=[config.algorithm]
        )
    except JWTError as e:
        raise HTTPException(status_code=401, detail="Invalid token") from e
