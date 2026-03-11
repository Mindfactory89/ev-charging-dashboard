#!/usr/bin/env bash

set -euo pipefail

REMOTE_PATH="${REMOTE_PATH:-$(pwd)}"
BACKUP_ROOT="${BACKUP_ROOT:-/srv/mobility-dashboard-backups}"
RETENTION="${RETENTION:-5}"
SKIP_DB="${SKIP_DB:-0}"

if ! [[ "${RETENTION}" =~ ^[0-9]+$ ]]; then
  echo "RETENTION muss eine nicht-negative ganze Zahl sein." >&2
  exit 1
fi

STAMP="$(date +%Y%m%d-%H%M%S)"
BACKUP_DIR="${BACKUP_ROOT%/}/${STAMP}"
MANIFEST_PATH="${BACKUP_DIR}/manifest.txt"

mkdir -p "${BACKUP_DIR}"

tar -czf "${BACKUP_DIR}/files.tgz" -C "${REMOTE_PATH}" .

if [[ "${SKIP_DB}" != "1" ]]; then
  (
    cd "${REMOTE_PATH}"
    docker compose exec -T db sh -lc 'pg_dump --clean --if-exists -U "$POSTGRES_USER" -d "$POSTGRES_DB"' </dev/null
  ) | gzip > "${BACKUP_DIR}/db.sql.gz"
fi

: > "${MANIFEST_PATH}"
printf 'created_at=%s\n' "$(date '+%Y-%m-%dT%H:%M:%S%z')" >> "${MANIFEST_PATH}"
printf 'remote_path=%s\n' "${REMOTE_PATH}" >> "${MANIFEST_PATH}"
printf 'backup_dir=%s\n' "${BACKUP_DIR}" >> "${MANIFEST_PATH}"
printf 'skip_db=%s\n' "${SKIP_DB}" >> "${MANIFEST_PATH}"
printf 'retention=%s\n' "${RETENTION}" >> "${MANIFEST_PATH}"
printf '\n[docker_compose_ps]\n' >> "${MANIFEST_PATH}"
(
  cd "${REMOTE_PATH}"
  docker compose ps
) >> "${MANIFEST_PATH}" 2>&1 || true

if [[ "${RETENTION}" -gt 0 ]]; then
  mapfile -t backup_dirs < <(find "${BACKUP_ROOT}" -mindepth 1 -maxdepth 1 -type d | sort)
  if [[ "${#backup_dirs[@]}" -gt "${RETENTION}" ]]; then
    remove_count=$(( ${#backup_dirs[@]} - RETENTION ))
    rm -rf -- "${backup_dirs[@]:0:${remove_count}}"
  fi
fi

printf '%s\n' "${BACKUP_DIR}"
ls -lh "${BACKUP_DIR}"
