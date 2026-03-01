from typing import Annotated
from urllib.parse import urlparse

import redis.asyncio as aioredis
from fastapi import Depends, HTTPException
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jose import JWTError, jwt

from .config import Config

config: Config | None = None
redis_client: aioredis.Redis | None = None


def init_config():
    global config
    config = Config()


def get_config() -> Config:
    return config


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
