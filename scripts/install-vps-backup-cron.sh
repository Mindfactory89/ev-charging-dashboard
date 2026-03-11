#!/usr/bin/env bash

set -euo pipefail

HOST="${HOST:-${SSH_DEPLOY_HOST:-}}"
USER_NAME="${USER_NAME:-${SSH_DEPLOY_USER:-${1:-}}}"
REMOTE_PATH="${REMOTE_PATH:-${SSH_DEPLOY_PATH:-/srv/mobility-dashboard}}"
BACKUP_ROOT="${BACKUP_ROOT:-/srv/mobility-dashboard-backups}"
RETENTION="${RETENTION:-5}"
CRON_SCHEDULE="${CRON_SCHEDULE:-20 3 * * *}"
LOG_PATH="${LOG_PATH:-${BACKUP_ROOT%/}/cron.log}"
CRON_MATCH="${CRON_MATCH:-scripts/backup-local.sh}"

if [[ -z "${USER_NAME}" || -z "${HOST}" ]]; then
  cat >&2 <<'EOF'
Usage:
  HOST=<server-host> USER_NAME=<ssh-user> ./scripts/install-vps-backup-cron.sh

Optional env vars:
  REMOTE_PATH=/srv/mobility-dashboard
  BACKUP_ROOT=/srv/mobility-dashboard-backups
  RETENTION=5
  CRON_SCHEDULE="20 3 * * *"
  LOG_PATH=/srv/mobility-dashboard-backups/cron.log

Example:
  HOST=your.server.ip USER_NAME=deploy ./scripts/install-vps-backup-cron.sh
EOF
  exit 1
fi

if ! [[ "${RETENTION}" =~ ^[0-9]+$ ]]; then
  echo "RETENTION muss eine nicht-negative ganze Zahl sein." >&2
  exit 1
fi

CRON_COMMAND="cd ${REMOTE_PATH} && REMOTE_PATH=${REMOTE_PATH} BACKUP_ROOT=${BACKUP_ROOT} RETENTION=${RETENTION} ./scripts/backup-local.sh >> ${LOG_PATH} 2>&1"

echo "Installing VPS backup cron on ${USER_NAME}@${HOST}"

ssh "${USER_NAME}@${HOST}" \
  "CRON_SCHEDULE='${CRON_SCHEDULE}' CRON_COMMAND='${CRON_COMMAND}' CRON_MATCH='${CRON_MATCH}' bash -s" <<'EOF'
set -euo pipefail

tmp="$(mktemp)"
next="${tmp}.next"

crontab -l > "${tmp}" 2>/dev/null || true
grep -v "${CRON_MATCH}" "${tmp}" > "${next}" || true
printf '%s %s\n' "${CRON_SCHEDULE}" "${CRON_COMMAND}" >> "${next}"
crontab "${next}"
rm -f "${tmp}" "${next}"

crontab -l
EOF
