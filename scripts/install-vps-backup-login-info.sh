#!/usr/bin/env bash

set -euo pipefail

HOST="${HOST:-${SSH_DEPLOY_HOST:-}}"
USER_NAME="${USER_NAME:-${SSH_DEPLOY_USER:-${1:-}}}"
REMOTE_PATH="${REMOTE_PATH:-${SSH_DEPLOY_PATH:-/srv/mobility-dashboard}}"
BACKUP_ROOT="${BACKUP_ROOT:-/srv/mobility-dashboard-backups}"
RETENTION="${RETENTION:-5}"
DOWNLOAD_HOST="${DOWNLOAD_HOST:-${HOST}}"
DOWNLOAD_USER="${DOWNLOAD_USER:-${USER_NAME}}"
REMOTE_SCRIPT_PATH="${REMOTE_PATH%/}/scripts/backup-login-info.sh"

if [[ -z "${USER_NAME}" || -z "${HOST}" ]]; then
  cat >&2 <<'EOF'
Usage:
  HOST=<server-host> USER_NAME=<ssh-user> ./scripts/install-vps-backup-login-info.sh

Optional env vars:
  REMOTE_PATH=/srv/mobility-dashboard
  BACKUP_ROOT=/srv/mobility-dashboard-backups
  RETENTION=5
  DOWNLOAD_HOST=your.server.ip
  DOWNLOAD_USER=deploy

Example:
  HOST=your.server.ip USER_NAME=deploy ./scripts/install-vps-backup-login-info.sh
EOF
  exit 1
fi

if ! [[ "${RETENTION}" =~ ^[0-9]+$ ]]; then
  echo "RETENTION muss eine nicht-negative ganze Zahl sein." >&2
  exit 1
fi

echo "Installing VPS backup login info on ${USER_NAME}@${HOST}"

ssh "${USER_NAME}@${HOST}" \
  "REMOTE_SCRIPT_PATH='${REMOTE_SCRIPT_PATH}' BACKUP_ROOT='${BACKUP_ROOT}' RETENTION='${RETENTION}' DOWNLOAD_HOST='${DOWNLOAD_HOST}' DOWNLOAD_USER='${DOWNLOAD_USER}' bash -s" <<'EOF'
set -euo pipefail

bashrc="${HOME}/.bashrc"
tmp="$(mktemp)"
backup_copy="${bashrc}.bak.$(date +%Y%m%d-%H%M%S)"

cp "${bashrc}" "${backup_copy}"
awk '
  /# >>> mobility-dashboard backup login info >>>/ { skip=1; next }
  /# <<< mobility-dashboard backup login info <<</ { skip=0; next }
  !skip { print }
' "${bashrc}" > "${tmp}"

cat >> "${tmp}" <<BLOCK
# >>> mobility-dashboard backup login info >>>
if [[ \$- == *i* && -n "\${SSH_CONNECTION:-}" && -z "\${MOBILITY_BACKUP_INFO_SHOWN:-}" && -x '${REMOTE_SCRIPT_PATH}' ]]; then
  export MOBILITY_BACKUP_INFO_SHOWN=1
  BACKUP_ROOT='${BACKUP_ROOT}' RETENTION='${RETENTION}' DOWNLOAD_HOST='${DOWNLOAD_HOST}' DOWNLOAD_USER='${DOWNLOAD_USER}' bash '${REMOTE_SCRIPT_PATH}'
fi
# <<< mobility-dashboard backup login info <<<
BLOCK

mv "${tmp}" "${bashrc}"
printf 'Updated %s (backup: %s)\n' "${bashrc}" "${backup_copy}"
EOF
