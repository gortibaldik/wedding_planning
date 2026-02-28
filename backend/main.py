from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles
import os

app = FastAPI()

# API routes (define BEFORE static file mount)
@app.get("/api/health")
async def health():
    return {"status": "ok"}

# Serve Vue SPA - html=True enables SPA fallback (serves index.html for unknown routes)
frontend_dist = os.path.join(os.path.dirname(__file__), "..", "frontend", "dist")
app.mount("/", StaticFiles(directory=frontend_dist, html=True), name="static")
