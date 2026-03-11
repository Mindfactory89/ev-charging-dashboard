# Mobility Dashboard

Self-hosted EV charging dashboard with yearly analytics, monthly reports, forecasts, session editing, and a local PostgreSQL backend.

## What it includes

- yearly overview with focus month and comparison views
- monthly reports, forecasts, and smart charging insights
- SoC analysis, outlier detection, and efficiency scoring
- session management with inline editing, detail drawer, undo, and CSV export
- demo mode for testing the UI without a running API or database

## Screenshots

### Overview
![Dashboard Overview](docs/images/overview.png)

### Analysis
![Dashboard Analysis](docs/images/analysis.png)

### History
![Dashboard History](docs/images/history.png)

## Guided Setup

For most users, the setup script is the cleanest entry point:

```bash
git clone <your-repo-url>
cd mobility-dashboard
bash ./scripts/setup.sh
```

Preview the full installer without writing `.env` or starting Docker:

```bash
bash ./scripts/setup.sh --preview
```

The script can:

- switch between a guided beginner flow and a compact expert flow
- show colored status messages and progress bars during installation
- preview the full flow safely without changing files or starting containers
- choose between local beginner mode and private self-hosted mode
- choose private self-hosting with or without Tailscale
- create or replace `.env`
- ask for the few required values instead of exposing the full config surface
- optionally start the matching Docker Compose stack directly

## Manual Setup

### Local Docker start

This is the recommended mode for trying the project locally with your own PostgreSQL database.

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

### Private self-hosted Docker setup

`docker-compose.yml` is meant for a private deployment with explicit network bindings.

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

### Local development without Docker

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

## Configuration

Use `.env.example` as the starting point when you want to configure ports, deploy defaults, or fixed API targets:

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

## Deploy Helper

For a simple VPS workflow, the repo ships with a small sync-and-deploy helper:

```bash
HOST=your.server.ip USER_NAME=deploy ./scripts/deploy-to-vps.sh
```

## Mobile Builds

The UI can also run in a Capacitor container for Android and iOS.

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

## Project Layout

- `ui/` React + Vite frontend
- `api/` Fastify + Prisma backend
- `scripts/` deployment and setup helpers
- `docs/images/` screenshots used in the README

## Contributing and Security

- Contribution guide: [CONTRIBUTING.md](CONTRIBUTING.md)
- Security policy: [SECURITY.md](SECURITY.md)
