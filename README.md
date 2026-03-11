# EV Charging Dashboard

![EV Charging Dashboard Banner](docs/images/banner.png)

Self-hosted EV charging dashboard with analytics, forecasts, charging insights, and a local PostgreSQL backend.  
Self-hosted EV-Ladedashboard mit Analysen, Forecasts, Lade-Insights und lokalem PostgreSQL-Backend.

## Intro

### Deutsch 🙂  
Willkommen zu meinem EV Charging Dashboard ⚡🚗

Das ist mein erstes Projekt in dieser Form, und ich lerne aktuell noch vieles Schritt fuer Schritt. Ich sitze jetzt seit etwa 1-2 Monaten daran und freue mich sehr, dass ich es endlich veroeffentlichen kann.

Dieses Projekt ist genau so entstanden, wie ich es mir selbst gewuenscht habe: ein Dashboard nach meinen eigenen Vorstellungen, ohne unnoetige Apps installieren zu muessen, mit Fokus auf Uebersicht, Analysen und einfache Nutzung.

Fuer die Zukunft plane ich noch einiges 🚀 Eine Mobile App fuer iOS und Android steht auf meiner Liste, damit das Dashboard auch unterwegs easy zu bedienen ist. Ausserdem moechte ich eine Home Assistant Integration ergaenzen. Auch an der Struktur, den Features und dem gesamten Aufbau habe ich noch viele weitere Ideen.

Wenn du Ideen, Feedback oder Verbesserungsvorschlaege hast, schreib mir gern eine Nachricht oder eroeffne eine Diskussion unter GitHub Discussions 💬

Eine vollstaendige englische Uebersetzung der App-Oberflaeche ist weiterhin in Arbeit 🌍

### English 🙂  
Welcome to my EV Charging Dashboard ⚡🚗

This is my first project of this kind, and I am still learning a lot step by step. I have been working on it for around 1-2 months now, and I am really happy to finally share it publicly.

This project is built the way I personally wanted it to be: a dashboard based on my own ideas, without needing to install unnecessary apps, with a strong focus on clarity, analytics, and simple usability.

There is still a lot planned for the future 🚀 A mobile app for iOS and Android is one of the next bigger goals, so the dashboard will also be easy to use on the go. I also plan to add a Home Assistant integration. Beyond that, I still have many ideas for the structure, features, and overall product direction.

If you have ideas, feedback, or suggestions, feel free to send me a message or open a discussion on GitHub Discussions 💬

A full English translation of the app experience is still in progress 🌍

## Features / Funktionen

- Yearly overview, focus month, forecasts, and comparisons / Jahresuebersicht, Monatsfokus, Forecasts und Vergleiche
- Smart charging insights, SoC analysis, and outlier detection / Smart Insights, SoC-Analyse und Ausreisser-Erkennung
- Session management with inline editing, detail drawer, undo, and CSV export / Session-Verwaltung mit Inline-Edit, Detail-Drawer, Undo und CSV-Export
- Demo mode for testing without a running API or database / Demo-Modus zum Testen ohne laufende API oder Datenbank
- Visual vehicle profiles for CUPRA Born, CUPRA Tavascan, CUPRA Raval, and Generic EV / Visuelle Fahrzeugprofile fuer CUPRA Born, CUPRA Tavascan, CUPRA Raval und Generic EV

## Screenshots / Screenshots

### Overview / Uebersicht
![Dashboard Overview](docs/images/overview.png)

### Analysis / Analyse
![Dashboard Analysis](docs/images/analysis.png)

### History / Verlauf
![Dashboard History](docs/images/history.png)

## Guided Setup / Gefuehrtes Setup

For most users, the setup script is the easiest way to get started 🙂
Fuer die meisten Nutzer ist das Setup-Script der einfachste Einstieg 🙂

```bash
git clone <your-repo-url>
cd mobility-dashboard
bash ./scripts/setup.sh
```

Preview the full installer safely without writing `.env` or starting Docker:
Den kompletten Installer kannst du sicher testen, ohne `.env` zu schreiben oder Docker zu starten:

```bash
bash ./scripts/setup.sh --preview
```

The script can / Das Script kann:

- guide beginners step by step and keep an expert mode compact / Einsteiger Schritt fuer Schritt fuehren und den Expert-Modus kompakt halten
- show colored status messages and progress steps / farbige Statusmeldungen und Fortschrittsschritte anzeigen
- preview the full flow safely / den kompletten Ablauf sicher als Vorschau zeigen
- choose between local beginner mode and private self-hosted mode / zwischen lokalem Einsteiger-Modus und privatem Self-Hosted-Modus waehlen
- choose private self-hosting with or without Tailscale / privaten Betrieb mit oder ohne Tailscale konfigurieren
- create or replace `.env` / `.env` neu anlegen oder ersetzen
- validate ports and guide the vehicle-profile selection / Ports validieren und die Fahrzeugprofil-Auswahl fuehren

## Manual Setup / Manuelles Setup

### Local Docker Start / Lokaler Docker-Start

Recommended for trying the project locally with your own PostgreSQL database.
Empfohlen, wenn du das Projekt lokal mit einer eigenen PostgreSQL-Datenbank ausprobieren willst.

```bash
docker compose -f docker-compose.beginner.yml up -d --build
```

After startup / Nach dem Start:

- UI: `http://localhost:8080`
- API: `http://localhost:18800`

Stop / Stoppen:

```bash
docker compose -f docker-compose.beginner.yml down
```

Remove the local database volume as well / Lokales Datenbank-Volume ebenfalls entfernen:

```bash
docker compose -f docker-compose.beginner.yml down -v
```

### Private Self-Hosted Docker Setup / Privates Self-Hosted Docker-Setup

Use `docker-compose.yml` for the private setup with Tailscale bindings.
Nutze `docker-compose.yml` fuer den privaten Betrieb mit Tailscale-Bindings.

Use `docker-compose.no-tailscale.yml` if you want the private setup without Tailscale.
Nutze `docker-compose.no-tailscale.yml`, wenn du den privaten Betrieb ohne Tailscale moechtest.

```bash
cp .env.example .env
docker compose up -d --build api ui
```

Useful follow-up commands / Sinnvolle Folgekommandos:

```bash
docker compose up -d --build --no-deps ui
docker compose up -d --build --no-deps api
docker logs -f mobility_api
docker logs -f mobility_ui
```

### Local Development Without Docker / Lokale Entwicklung ohne Docker

For backend development, you need a reachable PostgreSQL instance and a matching `DATABASE_URL`.
Fuer die Backend-Entwicklung brauchst du eine erreichbare PostgreSQL-Instanz und eine passende `DATABASE_URL`.

If you only want to inspect the frontend, you can run the UI alone and use demo mode.
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

## Configuration / Konfiguration

Use `.env.example` as the starting point when you want to configure ports, deploy defaults, or fixed API targets.
Nutze `.env.example` als Ausgangspunkt, wenn du Ports, Deploy-Defaults oder feste API-Ziele konfigurieren moechtest.

```bash
cp .env.example .env
```

Important variables / Wichtige Variablen:

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

Notes / Hinweise:

- Leave `VITE_API_BASE` empty when the UI should derive `hostname:18800` automatically. / `VITE_API_BASE` kann leer bleiben, dann leitet die UI automatisch `hostname:18800` ab.
- `VITE_MOBILE_API_BASE` is intended for native Android/iOS builds. / `VITE_MOBILE_API_BASE` ist fuer native Android/iOS-Builds gedacht.
- `VITE_VEHICLE_PROFILE` only changes the visual hero/profile presentation. Built-in IDs are `cupra-born`, `cupra-tavascan`, `cupra-raval`, and `generic-ev`. / `VITE_VEHICLE_PROFILE` aendert nur die visuelle Hero-/Profil-Darstellung. Eingebaute IDs sind `cupra-born`, `cupra-tavascan`, `cupra-raval` und `generic-ev`.
- `docker-compose.yml` requires an explicit `TAILSCALE_IP`. / `docker-compose.yml` erwartet eine explizite `TAILSCALE_IP`.
- Demo mode can be activated with `?demo=1` or via `VITE_DEMO_HOST_PREFIX`. / Der Demo-Modus kann mit `?demo=1` oder ueber `VITE_DEMO_HOST_PREFIX` aktiviert werden.

## Deploy Helper / Deploy-Helfer

For a simple VPS workflow, the repo ships with a small sync-and-deploy helper.
Fuer einen einfachen VPS-Workflow bringt das Repo einen kleinen Sync-und-Deploy-Helfer mit.

```bash
HOST=your.server.ip USER_NAME=deploy ./scripts/deploy-to-vps.sh
```

## Mobile Builds / Mobile Builds

The UI can also run in a Capacitor container for Android and iOS 📱
Die UI kann auch in einem Capacitor-Container fuer Android und iOS laufen 📱

Initial setup / Ersteinrichtung:

```bash
cd ui
npm install
npm run mobile:add:android
npm run mobile:add:ios
```

Sync the current web build into the native projects / Den aktuellen Web-Build in die nativen Projekte synchronisieren:

```bash
cd ui
VITE_MOBILE_API_BASE=https://api.example.com npm run mobile:sync
```

Open the native projects / Die nativen Projekte oeffnen:

```bash
cd ui
npm run mobile:open:android
npm run mobile:open:ios
```

For mobile builds, set a fixed HTTPS API endpoint. Native containers cannot safely rely on `window.location`.
Fuer Mobile-Builds solltest du einen festen HTTPS-API-Endpunkt setzen. Native Container koennen sich nicht sicher auf `window.location` verlassen.

## Project Layout / Projektstruktur

- `ui/` React + Vite frontend / React + Vite Frontend
- `api/` Fastify + Prisma backend / Fastify + Prisma Backend
- `scripts/` setup and deployment helpers / Setup- und Deploy-Helfer
- `docs/images/` screenshots and README media / Screenshots und README-Medien

## Contributing and Security / Mitwirken und Sicherheit

- Contribution guide / Leitfaden fuers Mitwirken: [CONTRIBUTING.md](CONTRIBUTING.md)
- Security policy / Sicherheitsrichtlinie: [SECURITY.md](SECURITY.md)
