#!/usr/bin/env bash

set -euo pipefail

HOST="${HOST:-100.123.167.33}"
USER_NAME="${USER_NAME:-${1:-}}"
REMOTE_PATH="${REMOTE_PATH:-/srv/mobility-dashboard}"
DEST_ROOT="${DEST_ROOT:-$(pwd)/vps-snapshots}"
STAMP="$(date +%Y%m%d-%H%M%S)"
DEST_DIR="${DEST_DIR:-$DEST_ROOT/$STAMP}"

if [[ -z "${USER_NAME}" ]]; then
  cat >&2 <<'EOF'
Usage:
  USER_NAME=<ssh-user> ./scripts/sync-from-vps.sh

Optional env vars:
  HOST=100.123.167.33
  REMOTE_PATH=/srv/mobility-dashboard
  DEST_ROOT=/local/target/root
  DEST_DIR=/local/target/root/custom-name

Example:
  USER_NAME=bjorn ./scripts/sync-from-vps.sh
EOF
  exit 1
fi

if ! command -v rsync >/dev/null 2>&1; then
  echo "rsync ist nicht installiert. Bitte auf dem Mac installieren und erneut starten." >&2
  exit 1
fi

mkdir -p "${DEST_DIR}"

echo "Quelle: ${USER_NAME}@${HOST}:${REMOTE_PATH}"
echo "Ziel:   ${DEST_DIR}"

rsync -avz \
  --progress \
  --delete \
  --exclude '.git/' \
  --exclude 'node_modules/' \
  --exclude '.DS_Store' \
  --exclude 'api/node_modules/' \
  --exclude 'ui/node_modules/' \
  --exclude 'db_data/' \
  --exclude '*.log' \
  "${USER_NAME}@${HOST}:${REMOTE_PATH}/" \
  "${DEST_DIR}/"

echo
echo "Sync abgeschlossen."
echo "Lokaler Snapshot: ${DEST_DIR}"
echo
echo "Nächste sinnvolle Checks:"
echo "  diff -ruN ./api \"${DEST_DIR}/api\" | less"
echo "  diff -ruN ./ui \"${DEST_DIR}/ui\" | less"
