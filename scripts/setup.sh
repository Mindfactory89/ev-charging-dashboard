#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ENV_FILE="${ROOT_DIR}/.env"
BACKUP_SUFFIX="$(date +%Y%m%d-%H%M%S)"
COMPOSE_CMD=()
SETUP_MODE=""
GUIDE_MODE=""
STEP_TOTAL=0
STEP_CURRENT=0
PREVIEW_MODE=0
USE_TAILSCALE=""
PRIVATE_COMPOSE_FILE=""
USE_COLOR=0
COLOR_RESET=""
COLOR_BOLD=""
COLOR_CYAN=""
COLOR_GREEN=""
COLOR_YELLOW=""
COLOR_BLUE=""
COLOR_MAGENTA=""
PROMPT_RESPONSE=""
CHOICE_RESPONSE=""

print_line() {
  printf '%s\n' "$1"
}

print_blank() {
  printf '\n'
}

show_usage() {
  cat <<'EOF'
Usage:
  bash ./scripts/setup.sh [--preview] [--help]

Options:
  --preview   Zeigt den kompletten Installer, schreibt aber keine .env und startet kein Docker.
  --help      Zeigt diese Hilfe.
EOF
}

init_colors() {
  if [[ -t 1 && "${TERM:-}" != "dumb" ]]; then
    USE_COLOR=1
    COLOR_RESET=$'\033[0m'
    COLOR_BOLD=$'\033[1m'
    COLOR_CYAN=$'\033[36m'
    COLOR_GREEN=$'\033[32m'
    COLOR_YELLOW=$'\033[33m'
    COLOR_BLUE=$'\033[34m'
    COLOR_MAGENTA=$'\033[35m'
  fi
}

paint() {
  local color="$1"
  local text="$2"

  if [[ "${USE_COLOR}" -eq 1 ]]; then
    printf '%b%s%b\n' "${color}" "${text}" "${COLOR_RESET}"
  else
    printf '%s\n' "${text}"
  fi
}

print_title() {
  paint "${COLOR_BOLD}${COLOR_MAGENTA}" "$1"
}

print_info() {
  paint "${COLOR_CYAN}" "[INFO] $1"
}

print_success() {
  paint "${COLOR_GREEN}" "[OK] $1"
}

print_warn() {
  paint "${COLOR_YELLOW}" "[HINWEIS] $1"
}

prompt_prefix() {
  local text="$1"
  if [[ "${USE_COLOR}" -eq 1 ]]; then
    printf '%b%s%b' "${COLOR_BLUE}" "${text}" "${COLOR_RESET}"
  else
    printf '%s' "${text}"
  fi
}

read_with_prompt() {
  local prompt_text="$1"
  PROMPT_RESPONSE=""
  printf '%s' "$(prompt_prefix "${prompt_text}")" >&2
  read -r PROMPT_RESPONSE || true
}

read_secret_with_prompt() {
  local prompt_text="$1"
  PROMPT_RESPONSE=""
  printf '%s' "$(prompt_prefix "${prompt_text}")" >&2
  read -r -s PROMPT_RESPONSE || true
  printf '\n' >&2
}

set_progress_plan() {
  case "${SETUP_MODE}" in
    beginner|private)
      STEP_TOTAL=5
      ;;
    env-only)
      STEP_TOTAL=4
      ;;
    *)
      STEP_TOTAL=0
      ;;
  esac

  STEP_CURRENT=0
}

render_progress() {
  local current="$1"
  local total="$2"
  local label="$3"
  local width=28
  local filled=0
  local empty=0
  local percent=0
  local bar=""
  local rest=""

  if [[ "${total}" -le 0 ]]; then
    return
  fi

  filled=$(( current * width / total ))
  empty=$(( width - filled ))
  percent=$(( current * 100 / total ))

  bar="$(printf '%*s' "${filled}" '' | tr ' ' '#')"
  rest="$(printf '%*s' "${empty}" '' | tr ' ' '-')"
  paint "${COLOR_BLUE}" "[${bar}${rest}] ${percent}% ${label}"
}

advance_progress() {
  local label="$1"
  if [[ "${STEP_TOTAL}" -le 0 ]]; then
    return
  fi

  STEP_CURRENT=$(( STEP_CURRENT + 1 ))
  if [[ "${STEP_CURRENT}" -gt "${STEP_TOTAL}" ]]; then
    STEP_CURRENT="${STEP_TOTAL}"
  fi
  print_blank
  print_title "Schritt ${STEP_CURRENT} von ${STEP_TOTAL}: ${label}"
  render_progress "${STEP_CURRENT}" "${STEP_TOTAL}" "${label}"
}

print_logo() {
  if [[ "${USE_COLOR}" -eq 1 ]]; then
    printf '%b' "${COLOR_CYAN}"
  fi
  cat <<'EOF'
 ____  _  ___  ____  _   _ _     _     _    ____  ____     _    ____  ____ 
| __ )| |/ _ \|  _ \| \ | | |   | |   / \  | __ )/ ___|   / \  |  _ \|  _ \
|  _ \| | | | | |_) |  \| | |   | |  / _ \ |  _ \\___ \  / _ \ | |_) | |_) |
| |_) | | |_| |  _ <| |\  | |___| | / ___ \| |_) |___) |/ ___ \|  __/|  __/
|____/|_|\___/|_| \_\_| \_|_____|_|/_/   \_\____/|____//_/   \_\_|   |_|   

+-----------------------------+
|       BJORNLABS APP        |
+-----------------------------+
EOF
  if [[ "${USE_COLOR}" -eq 1 ]]; then
    printf '%b' "${COLOR_RESET}"
  fi
}

show_welcome() {
  print_logo
  print_blank
  print_title "Willkommen zum Mobility Dashboard Setup."
  print_success "Danke, dass du das Dashboard nutzt."
  print_info "Fragen oder Feedback jederzeit: https://bjornlabs.app/"
  print_info "Schnellster Einstieg fuer Beginner: einfach bei den empfohlenen Standardwerten Enter druecken."
  print_info "Nur ansehen? Starte mit: bash ./scripts/setup.sh --preview"
  if [[ "${PREVIEW_MODE}" -eq 1 ]]; then
    print_warn "Vorschau-Modus aktiv: keine Dateien, kein Docker, keine Installation."
  fi
}

show_farewell() {
  print_blank
  if [[ "${PREVIEW_MODE}" -eq 1 ]]; then
    print_success "Vorschau abgeschlossen."
    print_info "Es wurden keine Dateien geschrieben und keine Container gestartet."
  else
    print_success "Setup abgeschlossen."
  fi
  print_success "Danke, dass du das Mobility Dashboard nutzt."
  print_info "Bei Fragen oder Feedback: https://bjornlabs.app/"
}

explain() {
  if [[ "${GUIDE_MODE}" == "beginner" ]]; then
    print_blank
    print_line "$1"
  fi
}

expert_note() {
  if [[ "${GUIDE_MODE}" == "expert" ]]; then
    print_line "$1"
  fi
}

show_vehicle_profile_help() {
  if [[ "${GUIDE_MODE}" == "beginner" ]]; then
    explain "Das Fahrzeugprofil aendert nur die Darstellung im Hero-Bereich: Name, Bild und die kleinen Fahrzeug-Spezifikationen. Deine Sessions, Kosten, Forecasts und Berechnungen bleiben unveraendert."
    explain "Aktuell sind im Projekt vier Profil-IDs vorkonfiguriert: cupra-born, cupra-tavascan, cupra-raval und generic-ev."
    explain "Cupra Born, Tavascan und Raval sind als visuelle Profile mit eigenen Hero-Bildern und modellbezogenen Specs verfuegbar."
    explain "Als reale CUPRA-Elektromodelle kannst du hier also direkt zwischen CUPRA Born, CUPRA Tavascan und CUPRA Raval waehlen oder auf generic-ev fuer ein neutrales EV-Profil gehen."
  else
    print_info "Fahrzeugprofil aendert nur Hero/Bild/Specs, nicht die Daten. Verfuegbar: Born, Tavascan, Raval, Generic EV. Standard behalten: einfach Enter druecken."
  fi
}

resolve_vehicle_profile_label() {
  case "$1" in
    cupra-born) printf '%s' "Cupra Born" ;;
    cupra-tavascan) printf '%s' "Cupra Tavascan" ;;
    cupra-raval) printf '%s' "Cupra Raval" ;;
    generic-ev) printf '%s' "Generic EV" ;;
    *) printf '%s' "$1" ;;
  esac
}

choose_vehicle_profile() {
  local choice=""
  CHOICE_RESPONSE=""

  print_blank
  print_title "Fahrzeugprofil-Auswahl"
  print_line "Welches visuelle Fahrzeugprofil soll das Dashboard zeigen?"
  print_line "  1) Cupra Born      - mitgeliefertes CUPRA-Bild und Born-Spezifikationen"
  print_line "  2) Cupra Tavascan - 250 kW, 340 HP, 553 km"
  print_line "  3) Cupra Raval    - 155 kW, 210 HP, 450 km"
  print_line "  4) Generic EV     - neutrales EV-Profil ohne Markenbild"
  print_blank

  while true; do
    read_with_prompt "Auswahl [1]: "
    choice="${PROMPT_RESPONSE}"
    choice="${choice:-1}"

    case "${choice}" in
      1|cupra-born)
        CHOICE_RESPONSE="cupra-born"
        return 0
        ;;
      2|cupra-tavascan)
        CHOICE_RESPONSE="cupra-tavascan"
        return 0
        ;;
      3|cupra-raval)
        CHOICE_RESPONSE="cupra-raval"
        return 0
        ;;
      4|generic-ev)
        CHOICE_RESPONSE="generic-ev"
        return 0
        ;;
      *)
        print_warn "Bitte 1, 2, 3 oder 4 eingeben."
        ;;
    esac
  done
}

abort_or_continue_preview() {
  local message="$1"

  if [[ "${PREVIEW_MODE}" -eq 1 ]]; then
    print_warn "${message} Ich zeige die Vorschau trotzdem weiter."
    return 0
  fi

  print_warn "${message}"
  return 1
}

confirm_docker_readiness() {
  if [[ "${GUIDE_MODE}" == "beginner" ]]; then
    print_info "Wir brauchen Docker fuer drei Bausteine: PostgreSQL speichert deine Daten, die API verarbeitet sie und die UI zeigt das Dashboard im Browser."
    print_info "Der Installer installiert Docker nicht selbst. Er nutzt Docker nur, wenn es bereits installiert ist oder spaeter von dir installiert werden darf."
  else
    print_info "Benoetigt Docker fuer PostgreSQL, API und UI."
    print_info "Wenn du die vorgeschlagenen Werte behalten willst, einfach Enter druecken."
  fi

  if confirm "Ist Docker bereits installiert oder darf es fuer dieses Setup verwendet werden?" "y"; then
    return 0
  fi

  abort_or_continue_preview "Ohne Docker kann ich keinen vollstaendigen Start vorbereiten."
}

choose_tailscale_usage() {
  if [[ "${GUIDE_MODE}" == "beginner" ]]; then
    explain "Tailscale ist optional. Es gibt dir einen privaten Zugang zu deinem Dashboard, ohne oeffentliche Ports am Router oder VPS freizugeben."
    explain "Vorteile: einfacher Zugriff von deinen eigenen Geraeten, private API/UI-Erreichbarkeit und weniger Angriffsflaeche nach aussen."
    explain "Wenn du Tailscale nicht nutzen willst, richte ich die Self-Hosted Variante nur lokal fuer Reverse Proxy oder lokalen Zugriff ein."
  else
    print_info "Tailscale ist optional. Vorteil: privater Zugriff ohne offene Ports. Standard ist Ja."
  fi

  if confirm "Moechtest du Tailscale nutzen?" "y"; then
    USE_TAILSCALE="yes"
    PRIVATE_COMPOSE_FILE="${ROOT_DIR}/docker-compose.yml"
    print_success "Tailscale aktiviert."
  else
    USE_TAILSCALE="no"
    PRIVATE_COMPOSE_FILE="${ROOT_DIR}/docker-compose.no-tailscale.yml"
    TAILSCALE_IP=""
    print_info "Tailscale deaktiviert. API und UI werden nur lokal gebunden."
  fi
}

prompt_value() {
  local label="$1"
  local default_value="${2:-}"
  local reply=""

  if [[ -n "${default_value}" ]]; then
    read_with_prompt "${label} [${default_value}]: "
    reply="${PROMPT_RESPONSE}"
    printf '%s' "${reply:-$default_value}"
    return
  fi

  read_with_prompt "${label}: "
  reply="${PROMPT_RESPONSE}"
  printf '%s' "${reply}"
}

prompt_port() {
  local label="$1"
  local default_value="$2"
  local reply=""

  while true; do
    reply="$(prompt_value "${label}" "${default_value}")"
    if [[ "${reply}" =~ ^[0-9]+$ ]] && [[ "${reply}" -ge 1 ]] && [[ "${reply}" -le 65535 ]]; then
      printf '%s' "${reply}"
      return 0
    fi
    print_warn "Bitte einen gueltigen Port zwischen 1 und 65535 eingeben."
  done
}

prompt_secret() {
  local label="$1"
  local default_value="${2:-}"
  local reply=""

  if [[ -n "${default_value}" ]]; then
    read_secret_with_prompt "${label} [${default_value}]: "
    reply="${PROMPT_RESPONSE}"
    printf '%s' "${reply:-$default_value}"
    return
  fi

  read_secret_with_prompt "${label}: "
  reply="${PROMPT_RESPONSE}"
  printf '%s' "${reply}"
}

confirm() {
  local label="$1"
  local default_answer="${2:-y}"
  local reply=""
  local normalized_default=""
  local normalized_reply=""

  normalized_default="$(printf '%s' "${default_answer}" | tr '[:upper:]' '[:lower:]')"

  if [[ "${normalized_default}" == "y" ]]; then
    read_with_prompt "${label} [Y/n]: "
    reply="${PROMPT_RESPONSE}"
    reply="${reply:-Y}"
  else
    read_with_prompt "${label} [y/N]: "
    reply="${PROMPT_RESPONSE}"
    reply="${reply:-N}"
  fi

  normalized_reply="$(printf '%s' "${reply}" | tr '[:upper:]' '[:lower:]')"

  case "${normalized_reply}" in
    y|yes|j|ja) return 0 ;;
    *) return 1 ;;
  esac
}

require_command() {
  local cmd="$1"
  if ! command -v "${cmd}" >/dev/null 2>&1; then
    print_warn "Fehlt: ${cmd}"
    exit 1
  fi
}

parse_args() {
  while [[ "$#" -gt 0 ]]; do
    case "$1" in
      --preview)
        PREVIEW_MODE=1
        ;;
      --help|-h)
        show_usage
        exit 0
        ;;
      *)
        print_warn "Unbekannte Option: $1"
        show_usage
        exit 1
        ;;
    esac
    shift
  done
}

detect_compose() {
  if docker compose version >/dev/null 2>&1; then
    COMPOSE_CMD=(docker compose)
    return 0
  fi

  if command -v docker-compose >/dev/null 2>&1; then
    COMPOSE_CMD=(docker-compose)
    return 0
  fi

  return 1
}

backup_env_if_needed() {
  if [[ -f "${ENV_FILE}" ]]; then
    cp "${ENV_FILE}" "${ENV_FILE}.${BACKUP_SUFFIX}.bak"
    print_info "Vorhandene .env gesichert als .env.${BACKUP_SUFFIX}.bak"
  fi
}

mask_secret() {
  local secret_value="$1"
  local length=0

  if [[ -z "${secret_value}" ]]; then
    printf '%s' "leer"
    return
  fi

  length=${#secret_value}
  printf 'gesetzt (%s Zeichen)' "${length}"
}

write_env_file() {
  cat > "${ENV_FILE}" <<EOF
# Docker / database
POSTGRES_DB=${POSTGRES_DB}
POSTGRES_USER=${POSTGRES_USER}
POSTGRES_PASSWORD=${POSTGRES_PASSWORD}

# Advanced / private network
# Only needed for docker-compose.yml with explicit Tailscale binding.
TAILSCALE_IP=${TAILSCALE_IP}
API_PORT=${API_PORT}
UI_PORT=${UI_PORT}
UI_PORT_LOCAL=${UI_PORT_LOCAL}

# Optional: fixed API URL for UI build.
# Leave empty when the UI should resolve hostname:18800 automatically.
VITE_API_BASE=${VITE_API_BASE}

# Optional: dedicated API URL for native Android/iOS builds.
VITE_MOBILE_API_BASE=${VITE_MOBILE_API_BASE}

# Optional: active vehicle profile in the UI build.
# Current IDs: cupra-born, generic-ev
VITE_VEHICLE_PROFILE=${VITE_VEHICLE_PROFILE}

# Optional: enable demo hosts by prefix, for example demo.
VITE_DEMO_HOST_PREFIX=${VITE_DEMO_HOST_PREFIX}

# Optional: deploy script defaults
SSH_DEPLOY_HOST=${SSH_DEPLOY_HOST}
SSH_DEPLOY_USER=${SSH_DEPLOY_USER}
SSH_DEPLOY_PATH=${SSH_DEPLOY_PATH}
EOF
}

choose_guide_mode() {
  local choice=""

  print_blank
  print_title "Installationsstil"
  print_line "Wie soll ich dich durch die Installation fuehren?"
  print_line "  1) Beginner - Schritt fuer Schritt mit Erklaerungen"
  print_line "  2) Expert - nur das Wesentliche"
  print_blank

  while true; do
    read_with_prompt "Auswahl [1]: "
    choice="${PROMPT_RESPONSE}"
    choice="${choice:-1}"

    case "${choice}" in
      1) GUIDE_MODE="beginner"; return 0 ;;
      2) GUIDE_MODE="expert"; return 0 ;;
      *) print_line "Bitte 1 oder 2 eingeben." ;;
    esac
  done
}

choose_setup_mode() {
  local choice=""

  print_blank
  print_title "Setup-Auswahl"
  print_line "Welches Setup moechtest du ausfuehren?"
  print_line "  1) Lokaler Schnellstart mit Docker"
  print_line "  2) Private Self-Hosted Installation"
  print_line "  3) Nur .env schreiben und spaeter manuell starten"
  print_blank

  while true; do
    read_with_prompt "Auswahl [1]: "
    choice="${PROMPT_RESPONSE}"
    choice="${choice:-1}"

    case "${choice}" in
      1) SETUP_MODE="beginner"; return 0 ;;
      2) SETUP_MODE="private"; return 0 ;;
      3) SETUP_MODE="env-only"; return 0 ;;
      *) print_line "Bitte 1, 2 oder 3 eingeben." ;;
    esac
  done
}

collect_beginner_values() {
  explain "In diesem Schritt legst du fest, wie deine lokale Datenbank intern heisst, mit welchem Benutzer sie startet und welches Passwort sie bekommt."
  explain "Danach bestimmst du die lokalen Ports: die API laeuft im Hintergrund, die UI ist das Dashboard im Browser."
  POSTGRES_DB="$(prompt_value "Datenbankname" "mobility")"
  POSTGRES_USER="$(prompt_value "Datenbank-Benutzername" "mobility")"

  explain "Das Passwort landet nur in deiner lokalen .env und wird vom lokalen Docker-Setup fuer die Datenbank verwendet."
  POSTGRES_PASSWORD="$(prompt_secret "Datenbank-Passwort" "change_me_local_password")"

  explain "Wenn du keine anderen Ports brauchst, kannst du die vorgeschlagenen Werte einfach mit Enter uebernehmen."
  API_PORT="$(prompt_port "API-Port fuer das Backend" "18800")"
  UI_PORT="$(prompt_port "UI-Port fuer das Dashboard im Browser" "8080")"
  UI_PORT_LOCAL="${UI_PORT}"
  TAILSCALE_IP="100.64.0.10"
  VITE_API_BASE=""
  VITE_MOBILE_API_BASE=""

  show_vehicle_profile_help
  choose_vehicle_profile
  VITE_VEHICLE_PROFILE="${CHOICE_RESPONSE}"
  VITE_DEMO_HOST_PREFIX="$(prompt_value "Demo Host Prefix (optional)" "")"
  SSH_DEPLOY_HOST="your.server.ip"
  SSH_DEPLOY_USER="your-ssh-user"
  SSH_DEPLOY_PATH="/srv/mobility-dashboard"
}

collect_private_values() {
  explain "In diesem Schritt legst du Datenbankname, Benutzername, Passwort und die Ports fuer API und UI fest."
  explain "Wenn du Tailscale aktiviert hast, kommt zusaetzlich die Tailscale-IP fuer private Bindings dazu."
  explain "Wenn du die Vorschlaege behalten willst, druecke einfach Enter."
  POSTGRES_DB="$(prompt_value "Datenbankname" "mobility")"
  POSTGRES_USER="$(prompt_value "Datenbank-Benutzername" "mobility")"

  explain "Hier solltest du ein starkes Passwort fuer deine Datenbank setzen."
  POSTGRES_PASSWORD="$(prompt_secret "Datenbank-Passwort" "change_me_strong_password")"

  explain "Jetzt folgen die Netzwerk-Werte fuer API, UI und optionalen Reverse-Proxy-Betrieb."
  if [[ "${USE_TAILSCALE}" == "yes" ]]; then
    TAILSCALE_IP="$(prompt_value "Tailscale-IP" "100.64.0.10")"
    UI_PORT="$(prompt_port "UI-Port ueber Tailscale" "18801")"
  else
    TAILSCALE_IP=""
    UI_PORT=""
  fi
  API_PORT="$(prompt_port "API-Port" "18800")"
  UI_PORT_LOCAL="$(prompt_port "UI-Port lokal fuer Reverse Proxy" "18801")"
  if [[ "${USE_TAILSCALE}" != "yes" ]]; then
    UI_PORT="${UI_PORT_LOCAL}"
  fi
  VITE_API_BASE="$(prompt_value "Feste API URL fuer UI Build (optional)" "")"
  VITE_MOBILE_API_BASE="$(prompt_value "Feste API URL fuer Mobile Builds (optional)" "")"
  show_vehicle_profile_help
  choose_vehicle_profile
  VITE_VEHICLE_PROFILE="${CHOICE_RESPONSE}"
  VITE_DEMO_HOST_PREFIX="$(prompt_value "Demo Host Prefix (optional)" "")"
  SSH_DEPLOY_HOST="$(prompt_value "Deploy Host (optional)" "your.server.ip")"
  SSH_DEPLOY_USER="$(prompt_value "Deploy User (optional)" "your-ssh-user")"
  SSH_DEPLOY_PATH="$(prompt_value "Deploy Path" "/srv/mobility-dashboard")"
}

show_configuration_summary() {
  local guide_label=""
  local setup_label=""
  local preview_label=""

  case "${GUIDE_MODE}" in
    beginner) guide_label="Beginner" ;;
    expert) guide_label="Expert" ;;
    *) guide_label="Unbekannt" ;;
  esac

  case "${SETUP_MODE}" in
    beginner) setup_label="Lokaler Schnellstart mit Docker" ;;
    private) setup_label="Private Self-Hosted Installation" ;;
    env-only) setup_label="Nur .env schreiben" ;;
    *) setup_label="Unbekannt" ;;
  esac

  if [[ "${PREVIEW_MODE}" -eq 1 ]]; then
    preview_label="Ja"
  else
    preview_label="Nein"
  fi

  print_blank
  print_title "Zusammenfassung"
  print_line "  Fuehrungsstil: ${guide_label}"
  print_line "  Setup-Modus:   ${setup_label}"
  print_line "  Vorschau:      ${preview_label}"
  print_line "  Datenbank:     ${POSTGRES_DB}"
  print_line "  Benutzer:      ${POSTGRES_USER}"
  print_line "  Passwort:      $(mask_secret "${POSTGRES_PASSWORD}")"
  print_line "  API Port:      ${API_PORT}"
  print_line "  UI Port:       ${UI_PORT}"

  case "${SETUP_MODE}" in
    private)
      if [[ "${USE_TAILSCALE}" == "yes" ]]; then
        print_line "  Tailscale:     Ja"
        print_line "  Tailscale IP:  ${TAILSCALE_IP}"
      else
        print_line "  Tailscale:     Nein"
      fi
      print_line "  UI Local:      ${UI_PORT_LOCAL}"
      print_line "  Fahrzeug:      $(resolve_vehicle_profile_label "${VITE_VEHICLE_PROFILE}") (${VITE_VEHICLE_PROFILE})"
      print_line "  Deploy Host:   ${SSH_DEPLOY_HOST}"
      print_line "  Deploy User:   ${SSH_DEPLOY_USER}"
      print_line "  Deploy Path:   ${SSH_DEPLOY_PATH}"
      ;;
    beginner)
      print_line "  Fahrzeug:      $(resolve_vehicle_profile_label "${VITE_VEHICLE_PROFILE}") (${VITE_VEHICLE_PROFILE})"
      print_line "  Demo Prefix:   ${VITE_DEMO_HOST_PREFIX:-leer}"
      ;;
    env-only)
      print_line "  Fahrzeug:      $(resolve_vehicle_profile_label "${VITE_VEHICLE_PROFILE}") (${VITE_VEHICLE_PROFILE})"
      ;;
  esac

  if [[ "${PREVIEW_MODE}" -eq 1 ]]; then
    print_warn "Dies ist nur eine Vorschau. Die folgenden Schritte werden nur simuliert."
  fi
}

write_env_with_context() {
  explain "Falls schon eine .env vorhanden ist, sichere ich sie zuerst. Danach schreibe ich die neuen Werte in eine frische .env, damit Docker und die Skripte dieselbe Konfiguration nutzen."
  expert_note "Schreibe .env."
  if [[ "${PREVIEW_MODE}" -eq 1 ]]; then
    print_warn "Vorschau-Modus: .env wird nicht geschrieben."
    print_info "Wuerde schreiben: ${ENV_FILE}"
    return
  fi
  backup_env_if_needed
  write_env_file
  print_success ".env wurde geschrieben."
}

run_compose_stack() {
  local compose_file="$1"
  local description="$2"
  local endpoint_one="$3"
  local endpoint_two="$4"

  if [[ "${PREVIEW_MODE}" -eq 1 ]]; then
    print_warn "Vorschau-Modus: Docker Compose wird nicht ausgefuehrt."
    print_info "Wuerde ausfuehren: docker compose -f ${compose_file} up -d --build"
    print_info "${endpoint_one}"
    print_info "${endpoint_two}"
    return
  fi

  if ! detect_compose; then
    print_warn "Docker Compose wurde nicht gefunden. Bitte Docker Compose installieren."
    exit 1
  fi

  explain "Wenn du jetzt startest, baut Docker die benoetigten Images und startet die Container im Hintergrund. Danach ist das Dashboard direkt lokal erreichbar."
  expert_note "Optionaler Start des Compose-Stacks."

  if confirm "Stack jetzt starten (${description})?" "y"; then
    print_info "Starte Docker Compose. Das kann beim ersten Mal etwas dauern."
    (
      cd "${ROOT_DIR}"
      "${COMPOSE_CMD[@]}" -f "${compose_file}" up -d --build
    )
    print_blank
    print_success "Stack gestartet."
    print_info "${endpoint_one}"
    print_info "${endpoint_two}"
  else
    print_warn "Stack uebersprungen. Du kannst ihn spaeter manuell starten."
  fi
}

setup_local_mode() {
  print_blank
  print_title "Modus: Lokaler Schnellstart mit Docker"
  if [[ "${GUIDE_MODE}" == "beginner" ]]; then
    print_info "Ich fuehre dich Schritt fuer Schritt durch die lokale Installation mit eigener PostgreSQL-Datenbank."
  else
    print_info "Lokaler Docker-Setup. Wenn du Datenbankname, Passwort oder Ports nicht aendern willst: einfach Enter druecken."
  fi

  advance_progress "Voraussetzungen und Ziel verstehen"
  explain "Im naechsten Schritt legst du Datenbankname, Benutzername, Passwort und die lokalen Ports fuer API und UI fest."
  if ! confirm_docker_readiness; then
    return 1
  fi

  advance_progress "Datenbank, Zugang und Ports festlegen"
  collect_beginner_values
  advance_progress "Zusammenfassung pruefen"
  show_configuration_summary
  advance_progress ".env vorbereiten"
  write_env_with_context
  advance_progress "Docker-Start vorbereiten"
  run_compose_stack \
    "${ROOT_DIR}/docker-compose.beginner.yml" \
    "docker-compose.beginner.yml" \
    "UI:  http://localhost:${UI_PORT}" \
    "API: http://localhost:${API_PORT}"

  print_blank
  print_title "Naechste Schritte"
  print_line "  UI:  http://localhost:${UI_PORT}"
  print_line "  API: http://localhost:${API_PORT}"
  print_line "  Stoppen: docker compose -f docker-compose.beginner.yml down"
}

setup_private_mode() {
  print_blank
  print_title "Modus: Private Self-Hosted Installation"
  if [[ "${GUIDE_MODE}" == "beginner" ]]; then
    print_info "Ich fuehre dich Schritt fuer Schritt durch die private Installation fuer VPS oder eigene Infrastruktur."
  else
    print_info "Private Self-Hosted Konfiguration. Standardwerte behalten? Einfach Enter druecken."
  fi

  advance_progress "Voraussetzungen und Netz-Optionen verstehen"
  explain "Im naechsten Schritt legst du Datenbankname, Benutzername, Passwort und Ports fest. Ausserdem entscheidest du, ob du Tailscale fuer privaten Fernzugriff nutzen willst."
  if ! confirm_docker_readiness; then
    return 1
  fi
  choose_tailscale_usage

  advance_progress "Datenbank, Netzwerk und Ports festlegen"
  collect_private_values
  advance_progress "Zusammenfassung pruefen"
  show_configuration_summary
  advance_progress ".env vorbereiten"
  write_env_with_context
  advance_progress "Docker-Start vorbereiten"
  run_compose_stack \
    "${PRIVATE_COMPOSE_FILE}" \
    "$(basename "${PRIVATE_COMPOSE_FILE}")" \
    "$(if [[ "${USE_TAILSCALE}" == "yes" ]]; then printf 'Private API: %s:%s' "${TAILSCALE_IP}" "${API_PORT}"; else printf 'Lokale API: 127.0.0.1:%s' "${API_PORT}"; fi)" \
    "$(if [[ "${USE_TAILSCALE}" == "yes" ]]; then printf 'Private UI:  %s:%s' "${TAILSCALE_IP}" "${UI_PORT}"; else printf 'Lokale UI:  127.0.0.1:%s' "${UI_PORT_LOCAL}"; fi)"

  print_blank
  print_title "Naechste Schritte"
  print_line "  Lokale UI Weitergabe: 127.0.0.1:${UI_PORT_LOCAL}"
  if [[ "${USE_TAILSCALE}" == "yes" ]]; then
    print_line "  Private API: ${TAILSCALE_IP}:${API_PORT}"
    print_line "  Private UI:  ${TAILSCALE_IP}:${UI_PORT}"
  else
    print_line "  Lokale API:  127.0.0.1:${API_PORT}"
    print_line "  Lokale UI:   127.0.0.1:${UI_PORT_LOCAL}"
  fi
}

setup_env_only_mode() {
  print_blank
  print_title "Modus: Nur .env schreiben"
  advance_progress "Env-only Modus ausgewaehlt"

  if confirm "Soll die .env fuer den lokalen Schnellstart vorbereitet werden?" "y"; then
    explain "Ich schreibe jetzt eine minimale lokale .env, damit du spaeter manuell mit docker-compose.beginner.yml starten kannst."
    POSTGRES_DB="mobility"
    POSTGRES_USER="mobility"
    POSTGRES_PASSWORD="change_me_local_password"
    TAILSCALE_IP="100.64.0.10"
    API_PORT="18800"
    UI_PORT="8080"
    UI_PORT_LOCAL="8080"
    VITE_API_BASE=""
    VITE_MOBILE_API_BASE=""
    VITE_VEHICLE_PROFILE="cupra-born"
    VITE_DEMO_HOST_PREFIX=""
    SSH_DEPLOY_HOST="your.server.ip"
    SSH_DEPLOY_USER="your-ssh-user"
    SSH_DEPLOY_PATH="/srv/mobility-dashboard"
    advance_progress "Standardwerte gesetzt"
    show_configuration_summary
    advance_progress "Zusammenfassung geprueft"
    write_env_with_context
    advance_progress ".env verarbeitet"
    print_title "Manueller Start"
    print_line "  docker compose -f docker-compose.beginner.yml up -d --build"
  else
    print_warn "Abgebrochen."
    advance_progress "Keine Aenderungen vorgenommen"
    advance_progress "Setup beendet"
    advance_progress "Abschluss"
  fi
}

main() {
  if [[ ! -t 0 ]]; then
    print_line "Dieses Script ist interaktiv gedacht. Bitte lokal in einem Terminal starten."
    exit 1
  fi

  init_colors
  parse_args "$@"
  require_command "bash"
  show_welcome
  choose_guide_mode
  choose_setup_mode
  set_progress_plan
  render_progress 0 "${STEP_TOTAL}" "Setup initialisiert"

  case "${SETUP_MODE}" in
    beginner)
      if [[ "${PREVIEW_MODE}" -ne 1 ]]; then
        require_command "docker"
      fi
      setup_local_mode
      ;;
    private)
      if [[ "${PREVIEW_MODE}" -ne 1 ]]; then
        require_command "docker"
      fi
      setup_private_mode
      ;;
    env-only)
      setup_env_only_mode
      ;;
    *)
      print_line "Unbekannter Modus."
      exit 1
      ;;
  esac

  show_farewell
}

main "$@"
