#!/bin/sh
# Installed on the server as /usr/local/bin/math-deploy and bound to the CI deploy key
# via a forced command in /root/.ssh/authorized_keys. This repo copy is reference only:
# the installed copy is deliberately not updated by deploys.
set -eu

APP_DIR=/opt/math
BRANCH=main

cd "$APP_DIR"
git fetch --quiet origin "$BRANCH"
git reset --hard --quiet "origin/$BRANCH"
echo "Deploying $(git log -1 --format='%h %s')"

docker compose up -d --build --remove-orphans
docker image prune -f >/dev/null
docker compose ps
