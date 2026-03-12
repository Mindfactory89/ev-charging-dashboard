#!/usr/bin/env bash

set -euo pipefail

HOST="${HOST:-${SSH_DEPLOY_HOST:-}}"
USER_NAME="${USER_NAME:-${SSH_DEPLOY_USER:-${1:-}}}"
REMOTE_PATH="${REMOTE_PATH:-${SSH_DEPLOY_PATH:-/srv/mobility-dashboard}}"
LOCAL_PATH="${LOCAL_PATH:-$(pwd)}"
SERVICES="${SERVICES:-api ui}"
RUN_REMOTE_DEPLOY="${RUN_REMOTE_DEPLOY:-1}"
CREATE_REMOTE_BACKUP="${CREATE_REMOTE_BACKUP:-1}"
REMOTE_BACKUP_ROOT="${REMOTE_BACKUP_ROOT:-/srv/mobility-dashboard-backups}"
BACKUP_RETENTION="${BACKUP_RETENTION:-5}"
DEPLOY_HEALTH_TIMEOUT="${DEPLOY_HEALTH_TIMEOUT:-120}"
DEPLOY_HEALTH_INTERVAL="${DEPLOY_HEALTH_INTERVAL:-3}"

if [[ -z "${USER_NAME}" || -z "${HOST}" ]]; then
  cat >&2 <<'EOF'
Usage:
  HOST=<server-host> USER_NAME=<ssh-user> ./scripts/deploy-to-vps.sh

Optional env vars:
  HOST=your.server.ip
  REMOTE_PATH=/srv/mobility-dashboard
  LOCAL_PATH=/Users/.../mobility-dashboard
  SERVICES="api ui"
  RUN_REMOTE_DEPLOY=1
  CREATE_REMOTE_BACKUP=1
  REMOTE_BACKUP_ROOT=/srv/mobility-dashboard-backups
  BACKUP_RETENTION=5
  DEPLOY_HEALTH_TIMEOUT=120
  DEPLOY_HEALTH_INTERVAL=3

Example:
  HOST=your.server.ip USER_NAME=deploy ./scripts/deploy-to-vps.sh
EOF
  exit 1
fi

if ! command -v rsync >/dev/null 2>&1; then
  echo "rsync ist nicht installiert. Bitte zuerst installieren." >&2
  exit 1
fi

echo "Deploying ${LOCAL_PATH} -> ${USER_NAME}@${HOST}:${REMOTE_PATH}"

if [[ "${CREATE_REMOTE_BACKUP}" == "1" ]]; then
  echo "Creating remote backup before sync"
  HOST="${HOST}" \
  USER_NAME="${USER_NAME}" \
  REMOTE_PATH="${REMOTE_PATH}" \
  BACKUP_ROOT="${REMOTE_BACKUP_ROOT}" \
  RETENTION="${BACKUP_RETENTION}" \
  ./scripts/backup-vps.sh
fi

rsync -avz --delete \
  --exclude '.DS_Store' \
  --exclude '.git/' \
  --exclude '.env' \
  --exclude '.env.*' \
  --exclude 'node_modules/' \
  --exclude 'api/node_modules/' \
  --exclude 'ui/node_modules/' \
  --exclude 'ui/dist/' \
  --exclude 'ui/android/.gradle/' \
  --exclude 'ui/android/app/build/' \
  --exclude 'ui/android/local.properties' \
  --exclude 'ui/android/capacitor-cordova-android-plugins/' \
  --exclude 'ui/ios/App/App/public/' \
  --exclude 'ui/ios/App/Pods/' \
  --exclude 'ui/ios/App/output/' \
  --exclude 'ui/ios/DerivedData/' \
  --exclude 'ui/ios/xcuserdata/' \
  --exclude 'ui/ios/App.xcworkspace/xcuserdata/' \
  --exclude 'ui/ios/capacitor-cordova-ios-plugins/' \
  --exclude 'vps-snapshots/' \
  --exclude '*.log' \
  "${LOCAL_PATH}/" \
  "${USER_NAME}@${HOST}:${REMOTE_PATH}/"

if [[ "${RUN_REMOTE_DEPLOY}" == "1" ]]; then
  echo "Running remote docker compose deploy for services: ${SERVICES}"
  ssh "${USER_NAME}@${HOST}" \
    "REMOTE_PATH='${REMOTE_PATH}' SERVICES='${SERVICES}' DEPLOY_HEALTH_TIMEOUT='${DEPLOY_HEALTH_TIMEOUT}' DEPLOY_HEALTH_INTERVAL='${DEPLOY_HEALTH_INTERVAL}' bash -s" <<'EOF'
set -euo pipefail

cd "${REMOTE_PATH}"
docker compose up -d --build ${SERVICES}

for service in ${SERVICES}; do
  container_id="$(docker compose ps -q "${service}")"

  if [[ -z "${container_id}" ]]; then
    echo "Kein Container fuer Service ${service} gefunden." >&2
    docker compose ps >&2 || true
    exit 1
  fi

  deadline=$((SECONDS + DEPLOY_HEALTH_TIMEOUT))

  while true; do
    status="$(docker inspect --format '{{if .State.Health}}{{.State.Health.Status}}{{else}}{{.State.Status}}{{end}}' "${container_id}")"

    case "${status}" in
      healthy|running)
        echo "Service ${service} ist ${status}."
        break
        ;;
      unhealthy|exited|dead)
        echo "Service ${service} ist mit Status ${status} fehlgeschlagen." >&2
        docker compose ps "${service}" >&2 || true
        docker compose logs --tail 50 "${service}" >&2 || true
        exit 1
        ;;
      *)
        if (( SECONDS >= deadline )); then
          echo "Timeout beim Warten auf Service ${service}." >&2
          docker compose ps "${service}" >&2 || true
          docker compose logs --tail 50 "${service}" >&2 || true
          exit 1
        fi

        sleep "${DEPLOY_HEALTH_INTERVAL}"
        ;;
    esac
  done
done
EOF
fi

echo "Deploy abgeschlossen."
