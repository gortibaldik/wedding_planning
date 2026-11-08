"""The SPA catch-all must only ever serve files from the two frontend folders.

`serve_frontend` gets its `path` after percent-decoding, so `..%2f` and a
leading `/` both arrive as real path separators. These tests point the route
at a temporary layout with a secret file beside the served folders and check
that no spelling of the URL can reach it.
"""

import asyncio
from pathlib import Path

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from backend.routers.index import index

SECRET = "top-secret-do-not-serve"
SPA_SHELL = "<!doctype html><title>spa</title>"


@pytest.fixture
def layout(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> Path:
    public = tmp_path / "public"
    dist = tmp_path / "dist"
    public.mkdir()
    dist.mkdir()
    (public / "landing.css").write_text("public-file")
    (public / "fonts").mkdir()
    (dist / "app.js").write_text("dist-file")
    (dist / "index.html").write_text(SPA_SHELL)
    # Outside both served folders: must never be reachable.
    (tmp_path / "secret.txt").write_text(SECRET)
    # A sibling whose name merely starts with "public" - a naive string-prefix
    # check would wrongly treat it as inside `public`.
    (tmp_path / "public-private").mkdir()
    (tmp_path / "public-private" / "secret.txt").write_text(SECRET)

    monkeypatch.setattr(index, "frontend_public", public)
    monkeypatch.setattr(index, "frontend_dist", dist)
    return tmp_path


@pytest.fixture
def client() -> TestClient:
    app = FastAPI()
    app.include_router(index.router)
    return TestClient(app)


@pytest.mark.usefixtures("layout")
def test_serves_file_from_public(client: TestClient):
    resp = client.get("/landing.css")
    assert resp.status_code == 200
    assert resp.text == "public-file"


@pytest.mark.usefixtures("layout")
def test_serves_file_from_dist(client: TestClient):
    resp = client.get("/app.js")
    assert resp.status_code == 200
    assert resp.text == "dist-file"


@pytest.mark.usefixtures("layout")
def test_unknown_path_falls_back_to_spa_shell(client: TestClient):
    resp = client.get("/app/some/route")
    assert resp.status_code == 200
    assert resp.text == SPA_SHELL


@pytest.mark.parametrize(
    "url",
    [
        "/..%2fsecret.txt",
        "/..%2Fsecret.txt",
        "/..%2fdist%2f..%2fsecret.txt",
        "/fonts%2f..%2f..%2fsecret.txt",
        "/..%2fpublic-private%2fsecret.txt",
    ],
)
@pytest.mark.usefixtures("layout")
def test_encoded_traversal_is_not_served(client: TestClient, url: str):
    resp = client.get(url)
    assert SECRET not in resp.text
    assert resp.text == SPA_SHELL


@pytest.mark.parametrize("prefix", ["/", "/%2f", "/%2F"])
def test_absolute_path_is_not_served(layout: Path, client: TestClient, prefix: str):
    secret = (layout / "secret.txt").as_posix().lstrip("/")
    resp = client.get(f"{prefix}{secret}")
    assert SECRET not in resp.text
    assert resp.text == SPA_SHELL


@pytest.mark.parametrize(
    "path",
    [
        "../secret.txt",
        "../../secret.txt",
        "../public-private/secret.txt",
        "fonts/../../secret.txt",
    ],
)
def test_handler_rejects_traversal_directly(layout: Path, path: str):
    # Independent of how any HTTP client or server normalises URLs: whatever
    # string reaches the handler, it must stay inside the served folders.
    resp = asyncio.run(index.serve_frontend(path))
    assert Path(resp.path).resolve() == (layout / "dist" / "index.html").resolve()


def test_handler_rejects_absolute_path(layout: Path):
    resp = asyncio.run(index.serve_frontend(str(layout / "secret.txt")))
    assert Path(resp.path).resolve() == (layout / "dist" / "index.html").resolve()
