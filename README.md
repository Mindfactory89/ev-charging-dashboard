# Mobility Dashboard

Privates E-Mobility-Dashboard fuer Ladeverlaeufe, Kostenanalyse und Jahresauswertungen eines Cupra Born.

Das Projekt ist jetzt so vorbereitet, dass es als oeffentliches GitHub-Repo genutzt werden kann:

- keine privaten `.env`-Dateien im Repo
- keine festen SSH- oder Server-Zugaenge im Code
- generische Beispiel-Konfigurationen
- einfache `docker-compose`-Variante fuer Einsteiger

## Fuer wen ist was gedacht?

Es gibt zwei Wege:

### 1. Einsteiger

Nutze `docker-compose.beginner.yml`.

Das ist der einfachste Start:

- keine Tailscale-Kenntnisse noetig
- keine VPS-Kenntnisse noetig
- alles lokal mit eigener Datenbank
- eigene Sessions, eigene Daten

### 2. Fortgeschrittene / privater VPS

Nutze `docker-compose.yml` mit `.env`.

Das ist fuer:

- Tailscale
- Reverse Proxy / Caddy / private Infrastruktur
- eigenes Deploy ueber SSH + `rsync`

## Produktbild

Das Dashboard ist in drei Bereiche gegliedert:

- `Uebersicht`: Hero, KPI-Rail, Monatsverlauf, Monatsbericht, Spotlight, Forecast
- `Analyse`: Jahresvergleich, Ladeleistungskurve nach SoC-Bereich, Smart Insights, Median-/Effizienzsicht, Ausreisser
- `Verlauf`: Sessions pflegen, inline bearbeiten, loeschen, undoen und neue Sessions erfassen

## Screenshots

Lege deine Screenshots in `docs/images/` mit diesen Dateinamen ab:

- `overview.png`
- `analysis.png`
- `history.png`
- optional `comparison.png`
- optional `forecast.png`

Sobald die Dateien im Repo liegen, rendert GitHub diese Bilder automatisch:

### Uebersicht
![Dashboard Overview](docs/images/overview.png)

### Analyse
![Dashboard Analysis](docs/images/analysis.png)

### Verlauf
![Dashboard History](docs/images/history.png)

## Kernfunktionen

- Jahresauswertung pro Jahr
- sauberer Leerzustand fuer Jahre ohne Daten
- Monatsanalyse mit Kosten, Energie, Sessions und Preisniveau
- Jahresvergleich zwischen zwei Jahren mit Monatsreihen
- Forecast / Jahreshochrechnung
- persoenlicher Monatsbericht mit Vergleich zum vorherigen aktiven Monat
- Smart Insights
- SoC-Band-Analyse und Ladeleistungskurve
- Medianwerte zusaetzlich zu Durchschnittswerten
- Cost Efficiency Score
- Ausreisseranalyse
- Session-Tabelle mit Inline-Edit
- Undo nach Loeschen
- CSV-Exporte fuer Sessions, Monate und Saisons
- Demo-Modus im Frontend

## Demo-Modus

Der Demo-Modus ist aktiv, wenn:

- die URL `?demo=1` enthaelt
- oder optional ein Host-Praefix ueber `VITE_DEMO_HOST_PREFIX` gesetzt wurde

Verhalten im Demo-Modus:

- Demo-Daten werden nur im Frontend gehalten
- es gibt keine Speicherung in API oder DB
- beim Reload entstehen neue Demo-Daten
- pro Reload werden `10-15` realistische Sessions erzeugt
- insgesamt sind maximal `20` Demo-Sessions erlaubt
- standardmaessig wird nur `2026` mit Demo-Daten befuellt
- `2027` und `2028` bleiben leer, bis dort manuell Sessions erfasst werden

## Stack

- `ui/`: React + Vite + Recharts
- `api/`: Fastify + Prisma
- `db`: PostgreSQL via Docker Compose

## Projektstruktur

- `api/server.js`: produktiver Backend-Einstieg
- `api/prisma/schema.prisma`: Datenmodell
- `ui/src/App.jsx`: Hauptansicht und Informationsarchitektur
- `ui/src/ui/api.js`: API-Client und Demo-Datenlogik
- `ui/src/ui/SessionsCard.jsx`: Verlauf, Inline-Edit, Undo
- `ui/src/ui/MonthlyChart.jsx`: Monatsverlauf
- `ui/src/ui/YearComparisonPanel.jsx`: Jahresvergleich
- `ui/src/ui/PowerCurveCard.jsx`: Ladeleistungskurve nach SoC-Bereich
- `ui/src/ui/MonthlyReportCard.jsx`: persoenlicher Monatsbericht
- `ui/src/ui/ForecastCard.jsx`: Jahreshochrechnung
- `ui/src/ui/SmartInsightsCard.jsx`: Smart Insights
- `ui/src/ui/VehicleHero.jsx`: Fahrzeug-Hero
- `docker-compose.beginner.yml`: einfacher lokaler Start
- `docker-compose.yml`: fortgeschrittener privater/Tailscale-Betrieb
- `.env.example`: Beispiel fuer Konfiguration
- `scripts/deploy-to-vps.sh`: Upload + Remote-Rebuild
- `scripts/sync-from-vps.sh`: Snapshot vom VPS ziehen
- `LICENSE`: MIT Lizenz
- `CONTRIBUTING.md`: Hinweise fuer Mitwirkende
- `SECURITY.md`: Security-Hinweise
- `GITHUB_PUBLIC_RELEASE.md`: Vorschlaege fuer Repo-Name, Topics und ersten Release

## Schnellstart fuer Einsteiger

Voraussetzungen:

- Docker
- Docker Compose

Start:

```bash
git clone <dein-repo-url>
cd mobility-dashboard
docker compose -f docker-compose.beginner.yml up -d --build
```

Danach:

- UI: `http://localhost:8080`
- API: `http://localhost:18800`

Stoppen:

```bash
docker compose -f docker-compose.beginner.yml down
```

Mit persistenter Datenbank loeschen:

```bash
docker compose -f docker-compose.beginner.yml down -v
```

## Lokale Entwicklung ohne Docker

UI:

```bash
cd ui
npm install
npm run dev
```

API:

```bash
cd api
npm install
npx prisma generate
npm start
```

UI Build lokal:

```bash
cd ui
npm run build
```

## Mobile / Android / iOS

Das UI ist so vorbereitet, dass es in einem nativen Container ueber Capacitor laufen kann.

Wichtig fuer Mobile:

- native Builds koennen die API nicht ueber `window.location` erkennen
- setze deshalb fuer Android/iOS `VITE_MOBILE_API_BASE` oder mindestens `VITE_API_BASE`
- nutze dafuer einen festen HTTPS-Endpunkt deiner API

Einmalig im UI-Projekt:

```bash
cd ui
npm install
npm run mobile:add:android
npm run mobile:add:ios
```

Web-Build in die nativen Projekte synchronisieren:

```bash
cd ui
VITE_MOBILE_API_BASE=https://api.example.com npm run mobile:sync
```

Native Projekte oeffnen:

```bash
cd ui
npm run mobile:open:android
npm run mobile:open:ios
```

Hinweise:

- `ui/capacitor.config.ts` ist bereits vorhanden
- Android und iOS Projekte liegen nach dem Setup in `ui/android` und `ui/ios`
- CSV-Exporte werden auf mobilen Geraeten ueber Share/Download-Fallback behandelt
- fuer iOS brauchst du die volle Xcode-App und nicht nur Command Line Tools
- das erzeugte iOS-Projekt ist auf Deployment Target `15.0` gesetzt
- fuer einen echten Store-Release solltest du die API vor oeffentlichem Zugriff absichern

Hinweis:

- In diesem Repo sind aktuell keine `lint`- oder `test`-Scripts hinterlegt.

## Fortgeschrittene Konfiguration ueber `.env`

Nutze dafuer `.env.example` als Vorlage:

```bash
cp .env.example .env
```

Wichtige Variablen:

- `POSTGRES_DB`
- `POSTGRES_USER`
- `POSTGRES_PASSWORD`
- `TAILSCALE_IP`
- `API_PORT`
- `UI_PORT`
- `UI_PORT_LOCAL`
- `VITE_API_BASE`
- `VITE_MOBILE_API_BASE`
- `VITE_VEHICLE_PROFILE`
- `VITE_DEMO_HOST_PREFIX`
- `SSH_DEPLOY_HOST`
- `SSH_DEPLOY_USER`
- `SSH_DEPLOY_PATH`

Hinweise:

- `VITE_API_BASE` kann leer bleiben. Dann nutzt die UI automatisch `protocol://hostname:18800`.
- `VITE_MOBILE_API_BASE` ist fuer native Android/iOS-Builds gedacht und sollte auf deine feste HTTPS-API zeigen.
- `VITE_DEMO_HOST_PREFIX` ist optional, z. B. `demo.`
- `docker-compose.yml` erwartet fuer die privaten Tailscale-Bindings eine explizit gesetzte `TAILSCALE_IP`

## Betrieb mit `docker-compose.yml`

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

Healthchecks:

- API: `GET /health`
- DB: `pg_isready`
- UI: lokaler HTTP-Check im Container

## Deploy auf einen eigenen VPS

Das Deploy-Script ist jetzt generisch. Es enthaelt keine persoenlichen Host- oder User-Defaults mehr.

Standardbeispiel:

```bash
HOST=your.server.ip USER_NAME=deploy ./scripts/deploy-to-vps.sh
```

Nur UI deployen:

```bash
HOST=your.server.ip USER_NAME=deploy SERVICES=ui ./scripts/deploy-to-vps.sh
```

Nur API deployen:

```bash
HOST=your.server.ip USER_NAME=deploy SERVICES=api ./scripts/deploy-to-vps.sh
```

Nur Upload ohne Remote-Rebuild:

```bash
HOST=your.server.ip USER_NAME=deploy RUN_REMOTE_DEPLOY=0 ./scripts/deploy-to-vps.sh
```

Das Script:

- synchronisiert den lokalen Repo-Stand per `rsync`
- laesst `.env`, `node_modules`, Logs und Build-Artefakte unberuehrt
- fuehrt danach auf dem VPS `docker compose up -d --build ${SERVICES}` aus

## Snapshot vom VPS ziehen

```bash
HOST=your.server.ip USER_NAME=deploy ./scripts/sync-from-vps.sh
```

## Hinweise fuer ein oeffentliches GitHub-Repo

Wenn du dieses Repo oeffentlich machst:

- committe niemals `.env`
- committe niemals DB-Dumps oder Exportdateien mit echten Daten
- committe niemals SSH-Keys
- nutze nur `.env.example` als Vorlage
- wenn frueher echte Secrets in einem privaten Repo lagen, solltest du sie rotieren, bevor du oeffentlich gehst

## Daten und Sicherheit

Andere Nutzer bekommen durch das Repo:

- deinen Code
- deine generischen Compose-Dateien
- deine Beispiel-Konfiguration

Andere Nutzer bekommen nicht:

- deine echten Sessions
- deine PostgreSQL-Daten
- deine `.env`
- deinen SSH-Zugriff
- deinen Server

Jeder betreibt das Dashboard mit seiner eigenen Datenbank und seinen eigenen Sessions.
