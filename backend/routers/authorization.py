import logging
from typing import Annotated
from urllib.parse import urlencode

import httpx
from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import RedirectResponse
from jose import jwt

from backend.config import Config
from backend.dependencies import get_config

router = APIRouter(prefix="/auth")
logger = logging.getLogger(__name__)


@router.get("/google", tags=["authorization"])
async def google_auth(request: Request, config: Annotated[Config, Depends(get_config)]):
    if not config.google_client_id:
        raise HTTPException(status_code=500, detail="GOOGLE_CLIENT_ID not configured")
    redirect_uri = (
        config.redirect_url_during_auth_base.rstrip("/") + "/auth/google/callback"
    )
    params = {
        "client_id": config.google_client_id,
        "redirect_uri": redirect_uri,
        "response_type": "code",
        "scope": "openid email profile",
        "access_type": "online",
    }
    return RedirectResponse(
        url=f"https://accounts.google.com/o/oauth2/v2/auth?{urlencode(params)}"
    )


@router.get("/google/callback", tags=["authorization"])
async def google_auth_callback(
    request: Request, code: str, config: Annotated[Config, Depends(get_config)]
):
    redirect_uri = (
        config.redirect_url_during_auth_base.rstrip("/") + "/auth/google/callback"
    )
    async with httpx.AsyncClient() as client:
        token_resp = await client.post(
            "https://oauth2.googleapis.com/token",
            data={
                "code": code,
                "client_id": config.google_client_id,
                "client_secret": config.google_client_secret,
                "redirect_uri": redirect_uri,
                "grant_type": "authorization_code",
            },
        )
        token_data = token_resp.json()
        if "access_token" not in token_data:
            raise HTTPException(status_code=401, detail="Google OAuth failed")

        user_resp = await client.get(
            "https://www.googleapis.com/oauth2/v2/userinfo",
            headers={"Authorization": f"Bearer {token_data['access_token']}"},
        )
        user_info = user_resp.json()

    email = user_info.get("email", "")
    roles = []
    logger.info(f"User with email '{email}' logged in.")
    if email == "ferotre@gmail.com":
        roles.append("change-genealogy-tree-rw-status")

    jwt_token = jwt.encode(
        {"sub": email, "name": user_info.get("name", ""), "roles": roles},
        config.secret_key,
        algorithm=config.algorithm,
    )
    return RedirectResponse(
        url=f"{config.redirect_url_after_auth_base}/?token={jwt_token}"
    )
