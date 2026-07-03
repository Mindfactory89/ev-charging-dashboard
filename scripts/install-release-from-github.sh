#!/usr/bin/env bash

set -euo pipefail

TARGET_VERSION="${MOBILITY_TARGET_VERSION:-${1:-}}"
RELEASE_REPO="${MOBILITY_RELEASE_REPO:-Mindfactory89/ev-charging-dashboard}"
REMOTE_PATH="${REMOTE_PATH:-$(pwd)}"
BACKUP_ROOT="${BACKUP_ROOT:-/srv/mobility-dashboard-backups}"
RETENTION="${RETENTION:-4}"
SERVICES="${SERVICES:-api ui}"
DEPLOY_HEALTH_TIMEOUT="${DEPLOY_HEALTH_TIMEOUT:-120}"
DEPLOY_HEALTH_INTERVAL="${DEPLOY_HEALTH_INTERVAL:-3}"

if [[ -z "${TARGET_VERSION}" ]]; then
  echo "MOBILITY_TARGET_VERSION oder erstes Argument fehlt." >&2
  exit 1
fi

if ! [[ "${TARGET_VERSION}" =~ ^v?[0-9]+\.[0-9]+\.[0-9]+([-.+][A-Za-z0-9._-]+)?$ ]]; then
  echo "Ungueltige Release-Version: ${TARGET_VERSION}" >&2
  exit 1
fi

if ! [[ "${RELEASE_REPO}" =~ ^[A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+$ ]]; then
  echo "Ungueltiges GitHub-Repo: ${RELEASE_REPO}" >&2
  exit 1
fi

for binary in curl tar docker; do
  if ! command -v "${binary}" >/dev/null 2>&1; then
    echo "${binary} ist nicht installiert." >&2
    exit 1
  fi
done

if ! docker compose version >/dev/null 2>&1; then
  echo "docker compose ist nicht verfuegbar." >&2
  exit 1
fi

if [[ ! -f "${REMOTE_PATH%/}/scripts/backup-local.sh" ]]; then
  echo "Backup-Skript fehlt: ${REMOTE_PATH%/}/scripts/backup-local.sh" >&2
  exit 1
fi

tmp_dir="$(mktemp -d)"
cleanup() {
  rm -rf "${tmp_dir}"
}
trap cleanup EXIT

archive_path="${tmp_dir}/release.tgz"
extract_dir="${tmp_dir}/extract"
mkdir -p "${extract_dir}"

echo "Creating backup before installing ${TARGET_VERSION}"
(
  cd "${REMOTE_PATH}"
  REMOTE_PATH="${REMOTE_PATH}" BACKUP_ROOT="${BACKUP_ROOT}" RETENTION="${RETENTION}" ./scripts/backup-local.sh
)

echo "Downloading ${RELEASE_REPO}@${TARGET_VERSION}"
curl -fL "https://github.com/${RELEASE_REPO}/archive/refs/tags/${TARGET_VERSION}.tar.gz" -o "${archive_path}"
tar -xzf "${archive_path}" -C "${extract_dir}"

release_root="$(find "${extract_dir}" -mindepth 1 -maxdepth 1 -type d | head -n 1)"
if [[ -z "${release_root}" ]]; then
  echo "Release-Archiv konnte nicht entpackt werden." >&2
  exit 1
fi

if ! command -v rsync >/dev/null 2>&1; then
  echo "rsync ist nicht installiert." >&2
  exit 1
fi

rsync -a --delete \
  --exclude '.env' \
  --exclude '.env.*' \
  --exclude '.deploy-meta' \
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
  "${release_root}/" \
  "${REMOTE_PATH%/}/"

cat > "${REMOTE_PATH%/}/.deploy-meta" <<EOF
project=mobility
deployed_at=$(date '+%Y-%m-%dT%H:%M:%S%z')
deployed_at_epoch=$(date +%s)
branch=release
commit=
dirty=0
version=${TARGET_VERSION}
source=github-release-installer
EOF

echo "Rebuilding services: ${SERVICES}"
(
  cd "${REMOTE_PATH}"
  MOBILITY_CURRENT_VERSION="${TARGET_VERSION}" docker compose up -d --build ${SERVICES}
)

for service in ${SERVICES}; do
  container_id="$(cd "${REMOTE_PATH}" && docker compose ps -q "${service}")"
  if [[ -z "${container_id}" ]]; then
    echo "Kein Container fuer Service ${service} gefunden." >&2
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
        cd "${REMOTE_PATH}" && docker compose logs --tail 50 "${service}" >&2 || true
        exit 1
        ;;
      *)
        if (( SECONDS >= deadline )); then
          echo "Timeout beim Warten auf Service ${service}." >&2
          exit 1
        fi
        sleep "${DEPLOY_HEALTH_INTERVAL}"
        ;;
    esac
  done
done

echo "Release ${TARGET_VERSION} installiert."
