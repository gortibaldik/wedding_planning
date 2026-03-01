from contextlib import asynccontextmanager
from fastapi import FastAPI, Request, HTTPException, Depends
from fastapi.responses import RedirectResponse
from fastapi.staticfiles import StaticFiles
from jose import jwt
import httpx
import os
from urllib.parse import urlencode

from .config import Config
from .dependencies import init_config, get_config


@asynccontextmanager
async def lifespan(app: FastAPI):
    init_config()
    yield


app = FastAPI(lifespan=lifespan)


@app.get("/auth/google")
async def google_auth(request: Request, config: Config = Depends(get_config)):
    if not config.google_client_id:
        raise HTTPException(status_code=500, detail="GOOGLE_CLIENT_ID not configured")
    redirect_uri = config.redirect_url_during_auth_base.rstrip("/") + "/auth/google/callback"
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


@app.get("/auth/google/callback")
async def google_auth_callback(request: Request, code: str, config: Config = Depends(get_config)):
    redirect_uri = config.redirect_url_during_auth_base.rstrip("/") + "/auth/google/callback"
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

    jwt_token = jwt.encode(
        {"sub": user_info.get("email", ""), "name": user_info.get("name", "")},
        config.secret_key,
        algorithm=config.algorithm,
    )
    return RedirectResponse(url=f"{config.redirect_url_after_auth_base}/?token={jwt_token}")


# API routes (define BEFORE static file mount)
@app.get("/api/health")
async def health():
    return {"status": "ok"}

# Serve Vue SPA - html=True enables SPA fallback (serves index.html for unknown routes)
frontend_dist = os.path.join(os.path.dirname(__file__), "..", "frontend", "dist")
app.mount("/", StaticFiles(directory=frontend_dist, html=True), name="static")
