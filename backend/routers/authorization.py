import logging
from datetime import UTC, datetime, timedelta
from typing import Annotated
from urllib.parse import urlencode

import httpx
from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import RedirectResponse
from jose import jwt

from backend.config import Config
from backend.dependencies import get_config

from .family_structure import CHANGE_STATUS_ROLE
from .invitation_lists import UNIVERSAL_INVITATION_LIST_SETTER_ROLE

router = APIRouter(prefix="/auth")
logger = logging.getLogger(__name__)


def _create_token_and_redirect(
    email: str, name: str, config: Config
) -> RedirectResponse:
    roles = []
    if email in config.super_users:
        roles.extend([CHANGE_STATUS_ROLE, UNIVERSAL_INVITATION_LIST_SETTER_ROLE])

    jwt_token = jwt.encode(
        {
            "sub": email,
            "name": name,
            "roles": roles,
            "exp": datetime.now(UTC) + timedelta(hours=config.token_expiration_hours),
        },
        config.secret_key,
        algorithm=config.algorithm,
    )
    return RedirectResponse(
        url=f"{config.redirect_url_after_auth_base}/app?token={jwt_token}"
    )


@router.get("/local", tags=["authorization"])
async def local_auth(username: str, config: Annotated[Config, Depends(get_config)]):
    """Dev-only endpoint: create a JWT from just a username."""
    if not config.enable_local_auth:
        raise HTTPException(status_code=404, detail="Not found")

    return _create_token_and_redirect(
        email=username + "@gmail.com", name=username, config=config
    )


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
    """Endpoint that is called after the google authenticates the client and creates app specific token.

    The app specific token contains roles assigned by the app.
    """
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
    logger.info(f"User with email '{email}' logged in.")
    return _create_token_and_redirect(
        email=email, name=user_info.get("name", ""), config=config
    )
