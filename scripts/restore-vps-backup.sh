#!/usr/bin/env bash

set -euo pipefail

HOST="${HOST:-${SSH_DEPLOY_HOST:-}}"
USER_NAME="${USER_NAME:-${SSH_DEPLOY_USER:-}}"
REMOTE_PATH="${REMOTE_PATH:-${SSH_DEPLOY_PATH:-/srv/mobility-dashboard}}"
BACKUP_ROOT="${BACKUP_ROOT:-/srv/mobility-dashboard-backups}"
BACKUP_NAME="${BACKUP_NAME:-${1:-}}"
RESTORE_DB="${RESTORE_DB:-1}"
PRE_RESTORE_BACKUP="${PRE_RESTORE_BACKUP:-1}"
SERVICES="${SERVICES:-api ui}"

if [[ -z "${USER_NAME}" || -z "${HOST}" || -z "${BACKUP_NAME}" ]]; then
  cat >&2 <<'EOF'
Usage:
  HOST=<server-host> USER_NAME=<ssh-user> ./scripts/restore-vps-backup.sh <backup-name>

Optional env vars:
  REMOTE_PATH=/srv/mobility-dashboard
  BACKUP_ROOT=/srv/mobility-dashboard-backups
  RESTORE_DB=1
  PRE_RESTORE_BACKUP=1
  SERVICES="api ui"

Example:
  HOST=your.server.ip USER_NAME=deploy ./scripts/restore-vps-backup.sh 20260311-183416
EOF
  exit 1
fi

if [[ "${PRE_RESTORE_BACKUP}" == "1" ]]; then
  HOST="${HOST}" \
  USER_NAME="${USER_NAME}" \
  REMOTE_PATH="${REMOTE_PATH}" \
  BACKUP_ROOT="${BACKUP_ROOT}" \
  ./scripts/backup-vps.sh
fi

echo "Restoring VPS backup ${BACKUP_NAME} on ${USER_NAME}@${HOST}:${REMOTE_PATH}"

RESTORE_OUTPUT="$(
ssh "${USER_NAME}@${HOST}" \
  "REMOTE_PATH='${REMOTE_PATH}' BACKUP_ROOT='${BACKUP_ROOT}' BACKUP_NAME='${BACKUP_NAME}' RESTORE_DB='${RESTORE_DB}' SERVICES='${SERVICES}' bash -s" <<'EOF'
set -euo pipefail

BACKUP_DIR="${BACKUP_ROOT%/}/${BACKUP_NAME}"
FILES_ARCHIVE="${BACKUP_DIR}/files.tgz"
DB_ARCHIVE="${BACKUP_DIR}/db.sql.gz"

if [[ ! -f "${FILES_ARCHIVE}" ]]; then
  echo "Backup archive not found: ${FILES_ARCHIVE}" >&2
  exit 1
fi

TMP_DIR="$(mktemp -d "${BACKUP_ROOT%/}/restore.XXXXXX")"
trap 'rm -rf "${TMP_DIR}"' EXIT

mkdir -p "${REMOTE_PATH}"
tar -xzf "${FILES_ARCHIVE}" -C "${TMP_DIR}"
rsync -a --delete "${TMP_DIR}/" "${REMOTE_PATH}/"

if [[ "${RESTORE_DB}" == "1" ]]; then
  if [[ ! -f "${DB_ARCHIVE}" ]]; then
    echo "DB archive not found: ${DB_ARCHIVE}" >&2
    exit 1
  fi

  (
    cd "${REMOTE_PATH}"
    gunzip -c "${DB_ARCHIVE}" | docker compose exec -T db sh -lc 'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB"'
  )
fi

(
  cd "${REMOTE_PATH}"
  docker compose up -d --build ${SERVICES} </dev/null
)

echo "Restore abgeschlossen: ${BACKUP_DIR}"
EOF
)"

printf '%s\n' "${RESTORE_OUTPUT}"
