from fastapi import FastAPI, Request, HTTPException
from fastapi.responses import RedirectResponse
from fastapi.staticfiles import StaticFiles
from jose import jwt
import httpx
import os
from urllib.parse import urlencode

app = FastAPI()

GOOGLE_CLIENT_ID = os.environ.get("GOOGLE_CLIENT_ID", "")
GOOGLE_CLIENT_SECRET = os.environ.get("GOOGLE_CLIENT_SECRET", "")
SECRET_KEY = os.environ.get("SECRET_KEY", "dev-secret-key-change-in-production")
REDIRECT_URL_AFTER_AUTH_BASE = os.environ.get("REDIRECT_URL_AFTER_AUTH_BASE", "")
REDIRECT_URL_DURING_AUTH_BASE = os.environ.get("REDIRECT_URL_DURING_AUTH_BASE", "")
ALGORITHM = "HS256"


@app.get("/auth/google")
async def google_auth(request: Request):
    if not GOOGLE_CLIENT_ID:
        raise HTTPException(status_code=500, detail="GOOGLE_CLIENT_ID not configured")
    redirect_uri = REDIRECT_URL_DURING_AUTH_BASE.rstrip("/") + "/auth/google/callback"
    params = {
        "client_id": GOOGLE_CLIENT_ID,
        "redirect_uri": redirect_uri,
        "response_type": "code",
        "scope": "openid email profile",
        "access_type": "online",
    }
    return RedirectResponse(
        url=f"https://accounts.google.com/o/oauth2/v2/auth?{urlencode(params)}"
    )


@app.get("/auth/google/callback")
async def google_auth_callback(request: Request, code: str):
    redirect_uri = REDIRECT_URL_DURING_AUTH_BASE.rstrip("/") + "/auth/google/callback"
    async with httpx.AsyncClient() as client:
        token_resp = await client.post(
            "https://oauth2.googleapis.com/token",
            data={
                "code": code,
                "client_id": GOOGLE_CLIENT_ID,
                "client_secret": GOOGLE_CLIENT_SECRET,
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
        SECRET_KEY,
        algorithm=ALGORITHM,
    )
    return RedirectResponse(url=f"{REDIRECT_URL_AFTER_AUTH_BASE}/?token={jwt_token}")


# API routes (define BEFORE static file mount)
@app.get("/api/health")
async def health():
    return {"status": "ok"}

# Serve Vue SPA - html=True enables SPA fallback (serves index.html for unknown routes)
frontend_dist = os.path.join(os.path.dirname(__file__), "..", "frontend", "dist")
app.mount("/", StaticFiles(directory=frontend_dist, html=True), name="static")
