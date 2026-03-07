#!/usr/bin/env bash

set -euo pipefail

HOST="${HOST:-${SSH_DEPLOY_HOST:-87.106.31.45}}"
USER_NAME="${USER_NAME:-${SSH_DEPLOY_USER:-${1:-}}}"
REMOTE_PATH="${REMOTE_PATH:-${SSH_DEPLOY_PATH:-/srv/mobility-dashboard}}"
LOCAL_PATH="${LOCAL_PATH:-$(pwd)}"
SERVICES="${SERVICES:-api ui}"
RUN_REMOTE_DEPLOY="${RUN_REMOTE_DEPLOY:-1}"

if [[ -z "${USER_NAME}" ]]; then
  cat >&2 <<'EOF'
Usage:
  USER_NAME=<ssh-user> ./scripts/deploy-to-vps.sh

Optional env vars:
  HOST=87.106.31.45
  REMOTE_PATH=/srv/mobility-dashboard
  LOCAL_PATH=/Users/.../mobility-dashboard
  SERVICES="api ui"
  RUN_REMOTE_DEPLOY=1

Example:
  USER_NAME=bjoern ./scripts/deploy-to-vps.sh
EOF
  exit 1
fi

if ! command -v rsync >/dev/null 2>&1; then
  echo "rsync ist nicht installiert. Bitte zuerst installieren." >&2
  exit 1
fi

echo "Deploying ${LOCAL_PATH} -> ${USER_NAME}@${HOST}:${REMOTE_PATH}"

rsync -avz --delete \
  --exclude '.DS_Store' \
  --exclude '.git/' \
  --exclude '.env' \
  --exclude '.env.*' \
  --exclude 'node_modules/' \
  --exclude 'api/node_modules/' \
  --exclude 'ui/node_modules/' \
  --exclude 'ui/dist/' \
  --exclude 'vps-snapshots/' \
  --exclude '*.log' \
  "${LOCAL_PATH}/" \
  "${USER_NAME}@${HOST}:${REMOTE_PATH}/"

if [[ "${RUN_REMOTE_DEPLOY}" == "1" ]]; then
  echo "Running remote docker compose deploy for services: ${SERVICES}"
  ssh "${USER_NAME}@${HOST}" \
    "cd '${REMOTE_PATH}' && docker compose up -d --build ${SERVICES}"
fi

echo "Deploy abgeschlossen."
