#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
LOCAL_BACKUP_SCRIPT="${SCRIPT_DIR}/backup-local.sh"

HOST="${HOST:-${SSH_DEPLOY_HOST:-}}"
USER_NAME="${USER_NAME:-${SSH_DEPLOY_USER:-${1:-}}}"
REMOTE_PATH="${REMOTE_PATH:-${SSH_DEPLOY_PATH:-/srv/mobility-dashboard}}"
BACKUP_ROOT="${BACKUP_ROOT:-/srv/mobility-dashboard-backups}"
RETENTION="${RETENTION:-5}"
SKIP_DB="${SKIP_DB:-0}"

if [[ -z "${USER_NAME}" || -z "${HOST}" ]]; then
  cat >&2 <<'EOF'
Usage:
  HOST=<server-host> USER_NAME=<ssh-user> ./scripts/backup-vps.sh

Optional env vars:
  REMOTE_PATH=/srv/mobility-dashboard
  BACKUP_ROOT=/srv/mobility-dashboard-backups
  RETENTION=5
  SKIP_DB=0

Example:
  HOST=your.server.ip USER_NAME=deploy ./scripts/backup-vps.sh
EOF
  exit 1
fi

if ! [[ "${RETENTION}" =~ ^[0-9]+$ ]]; then
  echo "RETENTION muss eine nicht-negative ganze Zahl sein." >&2
  exit 1
fi

if [[ ! -f "${LOCAL_BACKUP_SCRIPT}" ]]; then
  echo "Lokales Hilfsskript fehlt: ${LOCAL_BACKUP_SCRIPT}" >&2
  exit 1
fi

echo "Creating VPS backup for ${USER_NAME}@${HOST}:${REMOTE_PATH}"

ssh "${USER_NAME}@${HOST}" "mkdir -p '${REMOTE_PATH}/scripts'"
scp "${LOCAL_BACKUP_SCRIPT}" "${USER_NAME}@${HOST}:${REMOTE_PATH}/scripts/backup-local.sh"
ssh "${USER_NAME}@${HOST}" "chmod +x '${REMOTE_PATH}/scripts/backup-local.sh'"

BACKUP_OUTPUT="$(
ssh "${USER_NAME}@${HOST}" \
  "cd '${REMOTE_PATH}' && REMOTE_PATH='${REMOTE_PATH}' BACKUP_ROOT='${BACKUP_ROOT}' RETENTION='${RETENTION}' SKIP_DB='${SKIP_DB}' ./scripts/backup-local.sh"
)"

printf '%s\n' "${BACKUP_OUTPUT}"
