#!/usr/bin/env bash
# Builds the production image from the checkout this script lives in (works from
# any git worktree) and releases it to Heroku.
set -euo pipefail

cd "$(dirname "$0")"

IMAGE=registry.heroku.com/wedding-planning/web

sudo docker build -f Dockerfile -t "$IMAGE" .
sudo docker push "$IMAGE"
sudo heroku container:release web
