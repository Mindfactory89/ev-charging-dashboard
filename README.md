# EV Charging Dashboard

![EV Charging Dashboard Banner](docs/images/banner.png)

Self-hosted EV charging dashboard with analytics, forecasts, charging insights, and a local PostgreSQL backend ⚡

## 🌍 Sprache / Language

Waehle direkt deinen Bereich aus 🙂  
Choose your section below 🙂

[🇩🇪 Zur deutschen Version](#-deutsch) | [🇬🇧 Go to the English version](#-english)

---

## 🇩🇪 Deutsch

Willkommen zu meinem EV Charging Dashboard ⚡🚗

Das ist mein erstes Projekt in dieser Form, und ich lerne aktuell noch vieles Schritt fuer Schritt 🙂 Ich sitze jetzt seit etwa 1-2 Monaten daran und freue mich sehr, dass ich es endlich veroeffentlichen kann.

Dieses Projekt ist genau so entstanden, wie ich es mir selbst gewuenscht habe: ein Dashboard nach meinen eigenen Vorstellungen, ohne unnoetige Apps installieren zu muessen, mit Fokus auf Uebersicht, Analysen und einfache Nutzung.

Fuer die Zukunft plane ich noch einiges 🚀

- Eine Mobile App fuer iOS und Android, damit das Dashboard auch unterwegs easy zu bedienen ist
- Eine Home Assistant Integration
- Weitere Ideen fuer Struktur, Features und den gesamten Produktaufbau

### Feedback 💬

- Schreib mir gern eine Nachricht, wenn du Ideen oder Feedback hast
- Eroeffne gern einen Thread unter GitHub Discussions fuer Vorschlaege oder Verbesserungen

Eine vollstaendige englische Uebersetzung der App-Oberflaeche ist weiterhin in Arbeit 🌍

### Funktionen

- Jahresuebersicht, Monatsfokus, Forecasts und Vergleiche
- Smart Insights, SoC-Analyse und Ausreisser-Erkennung
- Session-Verwaltung mit Inline-Edit, Detail-Drawer, Undo und CSV-Export
- Demo-Modus zum Testen ohne laufende API oder Datenbank
- Visuelle Fahrzeugprofile fuer CUPRA Born, CUPRA Tavascan, CUPRA Raval und Generic EV

### Screenshots 📸

#### Uebersicht
![Dashboard Overview](docs/images/overview.png)

#### Analyse
![Dashboard Analysis](docs/images/analysis.png)

#### Verlauf
![Dashboard History](docs/images/history.png)

### Gefuehrtes Setup

Fuer die meisten Nutzer ist das Setup-Script der einfachste Einstieg 🙂

```bash
git clone <your-repo-url>
cd mobility-dashboard
bash ./scripts/setup.sh
```

Den kompletten Installer kannst du sicher testen, ohne `.env` zu schreiben oder Docker zu starten:

```bash
bash ./scripts/setup.sh --preview
```

Das Script kann:

- Einsteiger Schritt fuer Schritt fuehren und den Expert-Modus kompakt halten
- farbige Statusmeldungen und Fortschrittsschritte anzeigen
- den kompletten Ablauf sicher als Vorschau zeigen
- zwischen lokalem Einsteiger-Modus und privatem Self-Hosted-Modus waehlen
- privaten Betrieb mit oder ohne Tailscale konfigurieren
- `.env` neu anlegen oder ersetzen
- Ports validieren und die Fahrzeugprofil-Auswahl fuehren

### Manuelles Setup

#### Lokaler Docker-Start

Empfohlen, wenn du das Projekt lokal mit einer eigenen PostgreSQL-Datenbank ausprobieren willst.

```bash
docker compose -f docker-compose.beginner.yml up -d --build
```

Nach dem Start:

- UI: `http://localhost:8080`
- API: `http://localhost:18800`

Stoppen:

```bash
docker compose -f docker-compose.beginner.yml down
```

Lokales Datenbank-Volume ebenfalls entfernen:

```bash
docker compose -f docker-compose.beginner.yml down -v
```

#### Privates Self-Hosted Docker-Setup

Nutze `docker-compose.yml` fuer den privaten Betrieb mit Tailscale-Bindings.

Nutze `docker-compose.no-tailscale.yml`, wenn du den privaten Betrieb ohne Tailscale moechtest.

```bash
cp .env.example .env
docker compose up -d --build api ui
```

Sinnvolle Folgekommandos:

```bash
docker compose up -d --build --no-deps ui
docker compose up -d --build --no-deps api
docker logs -f mobility_api
docker logs -f mobility_ui
```

#### Lokale Entwicklung ohne Docker

Fuer die Backend-Entwicklung brauchst du eine erreichbare PostgreSQL-Instanz und eine passende `DATABASE_URL`.

Wenn du nur das Frontend ansehen willst, kannst du die UI alleine starten und den Demo-Modus nutzen.

UI:

```bash
cd ui
npm install
npm run dev
```

API:

```bash
export DATABASE_URL="postgresql://user:password@127.0.0.1:5432/mobility?schema=public"
cd api
npm install
npx prisma generate
npm start
```

### Konfiguration

Nutze `.env.example` als Ausgangspunkt, wenn du Ports, Deploy-Defaults oder feste API-Ziele konfigurieren moechtest.

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

- `VITE_API_BASE` kann leer bleiben, dann leitet die UI automatisch `hostname:18800` ab.
- `VITE_MOBILE_API_BASE` ist fuer native Android/iOS-Builds gedacht.
- `VITE_VEHICLE_PROFILE` aendert nur die visuelle Hero-/Profil-Darstellung. Eingebaute IDs sind `cupra-born`, `cupra-tavascan`, `cupra-raval` und `generic-ev`.
- `docker-compose.yml` erwartet eine explizite `TAILSCALE_IP`.
- Der Demo-Modus kann mit `?demo=1` oder ueber `VITE_DEMO_HOST_PREFIX` aktiviert werden.

### Deploy-Helfer

Fuer einen einfachen VPS-Workflow bringt das Repo einen kleinen Sync-und-Deploy-Helfer mit.

```bash
HOST=your.server.ip USER_NAME=deploy ./scripts/deploy-to-vps.sh
```

### Mobile Builds 📱

Die UI kann auch in einem Capacitor-Container fuer Android und iOS laufen.

Wichtiger Hinweis:

- Die Mobile-Version funktioniert aktuell noch nicht zuverlaessig und wurde noch nicht sauber getestet
- Nutze diesen Bereich daher bitte nur, wenn du weisst, was du tust
- Die Arbeit daran pausiert im Moment aus zeitlichen Gruenden
- Ich muss mich in das Thema selbst noch weiter einlesen und es Schritt fuer Schritt lernen

Ersteinrichtung:

```bash
cd ui
npm install
npm run mobile:add:android
npm run mobile:add:ios
```

Den aktuellen Web-Build in die nativen Projekte synchronisieren:

```bash
cd ui
VITE_MOBILE_API_BASE=https://api.example.com npm run mobile:sync
```

Die nativen Projekte oeffnen:

```bash
cd ui
npm run mobile:open:android
npm run mobile:open:ios
```

Fuer Mobile-Builds solltest du einen festen HTTPS-API-Endpunkt setzen. Native Container koennen sich nicht sicher auf `window.location` verlassen.

### Projektstruktur

- `ui/` React + Vite Frontend
- `api/` Fastify + Prisma Backend
- `scripts/` Setup- und Deploy-Helfer
- `docs/images/` Screenshots und README-Medien

### Mitwirken und Sicherheit

- Leitfaden fuers Mitwirken: [CONTRIBUTING.md](CONTRIBUTING.md)
- Sicherheitsrichtlinie: [SECURITY.md](SECURITY.md)

## 🇬🇧 English

Welcome to my EV Charging Dashboard ⚡🚗

This is my first project of this kind, and I am still learning a lot step by step 🙂 I have been working on it for around 1-2 months now, and I am really happy to finally share it publicly.

This project is built the way I personally wanted it to be: a dashboard based on my own ideas, without needing to install unnecessary apps, with a strong focus on clarity, analytics, and simple usability.

There is still a lot planned for the future 🚀

- A mobile app for iOS and Android, so the dashboard will also be easy to use on the go
- A Home Assistant integration
- More ideas for the structure, features, and overall product direction

### Feedback 💬

- Feel free to send me a message if you have ideas or feedback
- Open a thread in GitHub Discussions for suggestions or improvements

A full English translation of the app experience is still in progress 🌍

### Features

- Yearly overview, focus month, forecasts, and comparisons
- Smart charging insights, SoC analysis, and outlier detection
- Session management with inline editing, detail drawer, undo, and CSV export
- Demo mode for testing without a running API or database
- Visual vehicle profiles for CUPRA Born, CUPRA Tavascan, CUPRA Raval, and Generic EV

### Screenshots 📸

#### Overview
![Dashboard Overview](docs/images/overview.png)

#### Analysis
![Dashboard Analysis](docs/images/analysis.png)

#### History
![Dashboard History](docs/images/history.png)

### Guided Setup

For most users, the setup script is the easiest way to get started 🙂

```bash
git clone <your-repo-url>
cd mobility-dashboard
bash ./scripts/setup.sh
```

Preview the full installer safely without writing `.env` or starting Docker:

```bash
bash ./scripts/setup.sh --preview
```

The script can:

- guide beginners step by step and keep an expert mode compact
- show colored status messages and progress steps
- preview the full flow safely
- choose between local beginner mode and private self-hosted mode
- choose private self-hosting with or without Tailscale
- create or replace `.env`
- validate ports and guide the vehicle-profile selection

### Manual Setup

#### Local Docker Start

Recommended for trying the project locally with your own PostgreSQL database.

```bash
docker compose -f docker-compose.beginner.yml up -d --build
```

After startup:

- UI: `http://localhost:8080`
- API: `http://localhost:18800`

Stop:

```bash
docker compose -f docker-compose.beginner.yml down
```

Remove the local database volume as well:

```bash
docker compose -f docker-compose.beginner.yml down -v
```

#### Private Self-Hosted Docker Setup

Use `docker-compose.yml` for the private setup with Tailscale bindings.

Use `docker-compose.no-tailscale.yml` if you want the private setup without Tailscale.

```bash
cp .env.example .env
docker compose up -d --build api ui
```

Useful follow-up commands:

```bash
docker compose up -d --build --no-deps ui
docker compose up -d --build --no-deps api
docker logs -f mobility_api
docker logs -f mobility_ui
```

#### Local Development Without Docker

For backend development, you need a reachable PostgreSQL instance and a matching `DATABASE_URL`.

If you only want to inspect the frontend, you can run the UI alone and use demo mode.

UI:

```bash
cd ui
npm install
npm run dev
```

API:

```bash
export DATABASE_URL="postgresql://user:password@127.0.0.1:5432/mobility?schema=public"
cd api
npm install
npx prisma generate
npm start
```

### Configuration

Use `.env.example` as the starting point when you want to configure ports, deploy defaults, or fixed API targets.

```bash
cp .env.example .env
```

Important variables:

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

Notes:

- Leave `VITE_API_BASE` empty when the UI should derive `hostname:18800` automatically.
- `VITE_MOBILE_API_BASE` is intended for native Android/iOS builds.
- `VITE_VEHICLE_PROFILE` only changes the visual hero/profile presentation. Built-in IDs are `cupra-born`, `cupra-tavascan`, `cupra-raval`, and `generic-ev`.
- `docker-compose.yml` requires an explicit `TAILSCALE_IP`.
- Demo mode can be activated with `?demo=1` or via `VITE_DEMO_HOST_PREFIX`.

### Deploy Helper

For a simple VPS workflow, the repo ships with a small sync-and-deploy helper.

```bash
HOST=your.server.ip USER_NAME=deploy ./scripts/deploy-to-vps.sh
```

### Mobile Builds 📱

The UI can also run in a Capacitor container for Android and iOS.

Important note:

- The mobile version is not working reliably yet and has not been tested properly
- Please only use this part if you know what you are doing
- Work on it is currently paused due to time constraints
- I still need to read into this topic more deeply and learn it step by step

Initial setup:

```bash
cd ui
npm install
npm run mobile:add:android
npm run mobile:add:ios
```

Sync the current web build into the native projects:

```bash
cd ui
VITE_MOBILE_API_BASE=https://api.example.com npm run mobile:sync
```

Open the native projects:

```bash
cd ui
npm run mobile:open:android
npm run mobile:open:ios
```

For mobile builds, set a fixed HTTPS API endpoint. Native containers cannot safely rely on `window.location`.

### Project Layout

- `ui/` React + Vite frontend
- `api/` Fastify + Prisma backend
- `scripts/` setup and deployment helpers
- `docs/images/` screenshots and README media

### Contributing and Security

- Contribution guide: [CONTRIBUTING.md](CONTRIBUTING.md)
- Security policy: [SECURITY.md](SECURITY.md)
