#!/usr/bin/env bash

set -euo pipefail

BACKUP_ROOT="${BACKUP_ROOT:-/srv/mobility-dashboard-backups}"
RETENTION="${RETENTION:-5}"
DOWNLOAD_USER="${DOWNLOAD_USER:-${USER:-bjoern}}"
DOWNLOAD_HOST="${DOWNLOAD_HOST:-}"
LOGIN_INFO_MATCH="${LOGIN_INFO_MATCH:-scripts/backup-local.sh}"

format_duration() {
  local total_seconds="${1:-0}"
  local days hours minutes

  if (( total_seconds < 0 )); then
    total_seconds=0
  fi

  days=$(( total_seconds / 86400 ))
  hours=$(( (total_seconds % 86400) / 3600 ))
  minutes=$(( (total_seconds % 3600) / 60 ))

  if (( days > 0 )); then
    printf '%dt %02dh %02dm' "${days}" "${hours}" "${minutes}"
    return
  fi

  printf '%dh %02dm' "${hours}" "${minutes}"
}

resolve_download_host() {
  if [[ -n "${DOWNLOAD_HOST}" ]]; then
    printf '%s\n' "${DOWNLOAD_HOST}"
    return
  fi

  hostname -f 2>/dev/null || hostname
}

latest_backup_dir() {
  find "${BACKUP_ROOT}" -mindepth 1 -maxdepth 1 -type d 2>/dev/null | sort | tail -n 1
}

current_backup_count() {
  find "${BACKUP_ROOT}" -mindepth 1 -maxdepth 1 -type d 2>/dev/null | wc -l | tr -d ' '
}

read_backup_schedule() {
  crontab -l 2>/dev/null | awk -v pattern="${LOGIN_INFO_MATCH}" '$0 ~ pattern { print $1, $2, $3, $4, $5; exit }'
}

next_backup_epoch() {
  local schedule minute hour dom month dow candidate now

  schedule="$(read_backup_schedule)"
  if [[ -z "${schedule}" ]]; then
    return 1
  fi

  read -r minute hour dom month dow <<< "${schedule}"
  if ! [[ "${minute}" =~ ^[0-9]+$ && "${hour}" =~ ^[0-9]+$ ]]; then
    return 1
  fi

  if [[ "${dom}" != "*" || "${month}" != "*" || "${dow}" != "*" ]]; then
    return 1
  fi

  now="$(date +%s)"
  candidate="$(date -d "$(date +%F) ${hour}:${minute}:00" +%s 2>/dev/null || true)"
  if [[ -z "${candidate}" ]]; then
    return 1
  fi

  if (( candidate <= now )); then
    candidate="$(date -d "tomorrow ${hour}:${minute}:00" +%s)"
  fi

  printf '%s\n' "${candidate}"
}

print_download_hint() {
  local latest_dir download_host backup_name

  latest_dir="$(latest_backup_dir)"
  if [[ -z "${latest_dir}" ]]; then
    return
  fi

  download_host="$(resolve_download_host)"
  backup_name="$(basename "${latest_dir}")"

  printf 'Download: scp %s@%s:%s/{files.tgz,db.sql.gz,manifest.txt} .\n' "${DOWNLOAD_USER}" "${download_host}" "${latest_dir}"
  printf 'Backup-Name: %s\n' "${backup_name}"
}

main() {
  local latest_dir backup_name backup_epoch now age_seconds next_epoch next_in count

  latest_dir="$(latest_backup_dir)"
  count="$(current_backup_count)"

  printf '\n[Mobility Backup]\n'
  printf 'Backup-Root: %s\n' "${BACKUP_ROOT}"
  printf 'Rotation: %s Backups\n' "${RETENTION}"

  if [[ -z "${latest_dir}" ]]; then
    printf 'Letztes Backup: keines gefunden\n'
  else
    backup_name="$(basename "${latest_dir}")"
    backup_epoch="$(stat -c %Y "${latest_dir}")"
    now="$(date +%s)"
    age_seconds=$(( now - backup_epoch ))
    printf 'Letztes Backup: %s (%s alt)\n' "${backup_name}" "$(format_duration "${age_seconds}")"
    printf 'Vorhanden: %s/%s\n' "${count}" "${RETENTION}"
  fi

  if next_epoch="$(next_backup_epoch 2>/dev/null)"; then
    next_in=$(( next_epoch - $(date +%s) ))
    printf 'Naechstes Backup: in %s (%s)\n' "$(format_duration "${next_in}")" "$(date -d "@${next_epoch}" '+%Y-%m-%d %H:%M')"
  else
    printf 'Naechstes Backup: nicht aus Cron ableitbar\n'
  fi

  if [[ -z "${latest_dir}" ]]; then
    printf '\n'
    return
  fi

  print_download_hint
  printf '\n'
}

main "$@"
