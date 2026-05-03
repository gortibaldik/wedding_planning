"""Country lookup from request IP using MaxMind GeoLite2."""

import logging
from pathlib import Path

import geoip2.database
import geoip2.errors
from fastapi import Request

logger = logging.getLogger(__name__)

GEOIP_DB_PATH = Path(__file__).parent / "country_data.mmdb"

_reader: geoip2.database.Reader | None = None


def _get_reader() -> geoip2.database.Reader | None:
    global _reader
    if _reader is None:
        if not GEOIP_DB_PATH.exists():
            logger.warning("GeoIP DB not found at %s", GEOIP_DB_PATH)
            return None
        _reader = geoip2.database.Reader(str(GEOIP_DB_PATH))
    return _reader


def _client_ip(request: Request) -> str | None:
    # Heroku puts the real client IP first in X-Forwarded-For.
    xff = request.headers.get("x-forwarded-for")
    if xff:
        return xff.split(",")[0].strip()
    return request.client.host if request.client else None


def country_code(request: Request) -> str | None:
    """Return ISO country code for the request's client IP, or None."""
    reader = _get_reader()
    if reader is None:
        return None
    ip = _client_ip(request)
    if not ip:
        return None
    try:
        return reader.country(ip).country.iso_code
    except (geoip2.errors.AddressNotFoundError, ValueError):
        return None
