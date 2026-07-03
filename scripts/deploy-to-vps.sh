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
BACKUP_RETENTION="${BACKUP_RETENTION:-4}"
DEPLOY_HEALTH_TIMEOUT="${DEPLOY_HEALTH_TIMEOUT:-120}"
DEPLOY_HEALTH_INTERVAL="${DEPLOY_HEALTH_INTERVAL:-3}"
DEPLOY_META_FILENAME="${DEPLOY_META_FILENAME:-.deploy-meta}"

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
  BACKUP_RETENTION=4
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

deploy_meta_branch=""
deploy_meta_commit=""
deploy_meta_dirty="0"
deploy_meta_version=""
deploy_meta_timestamp="$(date '+%Y-%m-%dT%H:%M:%S%z')"
deploy_meta_epoch="$(date +%s)"

if [[ -d "${LOCAL_PATH}/.git" ]]; then
  deploy_meta_branch="$(git -C "${LOCAL_PATH}" branch --show-current 2>/dev/null || true)"
  deploy_meta_commit="$(git -C "${LOCAL_PATH}" rev-parse --short HEAD 2>/dev/null || true)"
  if [[ -n "$(git -C "${LOCAL_PATH}" status --porcelain --untracked-files=no 2>/dev/null || true)" ]]; then
    deploy_meta_dirty="1"
  fi
fi

if [[ -f "${LOCAL_PATH}/ui/package.json" ]]; then
  deploy_meta_version="$(sed -n 's/^[[:space:]]*"version":[[:space:]]*"\([^"]*\)".*/\1/p' "${LOCAL_PATH}/ui/package.json" | head -n 1)"
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

if [[ "${RUN_REMOTE_DEPLOY}" == "1" ]]; then
  ssh "${USER_NAME}@${HOST}" \
    "cat > '${REMOTE_PATH%/}/${DEPLOY_META_FILENAME}'" <<EOF
project=mobility
deployed_at=${deploy_meta_timestamp}
deployed_at_epoch=${deploy_meta_epoch}
branch=${deploy_meta_branch}
commit=${deploy_meta_commit}
dirty=${deploy_meta_dirty}
version=${deploy_meta_version}
source=deploy-to-vps
EOF
fi

echo "Deploy abgeschlossen."
