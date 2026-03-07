# Mobility Dashboard

Privates E-Mobility-Dashboard fuer Ladeverlaeufe, Kostenanalyse und Jahresauswertungen eines Cupra Born.

## Stack

- `ui/`: React + Vite + Recharts
- `api/`: Fastify + Prisma
- `db`: PostgreSQL via Docker Compose

## Kernfunktionen

- Sessions anlegen und loeschen
- KPI-Auswertung pro Jahr
- Monatsanalyse mit Trends
- Saisonanalyse
- Cost Efficiency Score
- CSV-Exporte fuer Sessions, Monate und Saisons
- Demo-Modus im Frontend

## Wichtige Dateien

- `api/server.js`: produktiver Backend-Einstieg
- `api/prisma/schema.prisma`: Datenmodell
- `ui/src/App.jsx`: Hauptansicht
- `ui/src/ui/api.js`: API-Client und Demo-Datenlogik
- `docker-compose.yml`: VPS-Stack
- `.env.example`: Beispiel fuer Compose-/Deploy-Variablen
- `scripts/deploy-to-vps.sh`: Upload + Remote-Rebuild
- `scripts/sync-from-vps.sh`: Snapshot vom VPS ziehen

## Konfiguration

Empfohlen:

1. `.env.example` nach `.env` kopieren
2. Werte fuer Datenbank, Ports und Tailscale-IP anpassen

Wichtige Variablen:

- `POSTGRES_DB`
- `POSTGRES_USER`
- `POSTGRES_PASSWORD`
- `TAILSCALE_IP`
- `API_PORT`
- `UI_PORT`
- `UI_PORT_LOCAL`
- `VITE_API_BASE`

`VITE_API_BASE` kann leer bleiben. Dann verwendet die UI automatisch `protocol://hostname:18800`.

## Betrieb auf dem VPS

Build und Start:

```bash
docker compose up -d --build api ui
```

Gezielt nur UI neu bauen:

```bash
docker compose up -d --build --no-deps ui
```

Gezielt nur API neu bauen:

```bash
docker compose up -d --build --no-deps api
```

Logs:

```bash
docker logs -f mobility_api
docker logs -f mobility_ui
```

Hinweis:

- `docker compose up -d --build ui` kann je nach Compose-Aufloesung zusaetzlich andere Images mitbauen.
- Fuer gezielte Einzel-Rebuilds ist `--no-deps` die bessere Wahl.

Healthchecks:

- API: `GET /health`
- DB wird ueber `pg_isready` geprueft
- UI wird ueber lokalen HTTP-Check geprueft

## Deploy vom Mac

Im Projektordner:

```bash
USER_NAME=bjoern ./scripts/deploy-to-vps.sh
```

Das Script:

- synchronisiert den lokalen Repo-Stand per `rsync`
- laesst `.env`, `node_modules`, Logs und Build-Artefakte unberuehrt
- fuehrt danach auf dem VPS `docker compose up -d --build api ui` aus

Nur Upload ohne Remote-Rebuild:

```bash
USER_NAME=bjoern RUN_REMOTE_DEPLOY=0 ./scripts/deploy-to-vps.sh
```

## Hinweise

- Die produktive Backend-Logik lebt ausschliesslich in `api/server.js`.
- Alte Backup- und Parallel-Dateien wurden bewusst entfernt, um den produktiven Pfad klar zu halten.
