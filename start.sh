#!/usr/bin/env bash
set -e
RELOAD_FLAG=""
if [ -n "${HOT_RELOAD}" ]; then
    RELOAD_FLAG="--reload"
fi
exec uvicorn backend.main:app --host 0.0.0.0 --port ${PORT:-8000} ${RELOAD_FLAG}