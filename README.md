# EV Charging Dashboard

![EV Charging Dashboard Banner](docs/images/banner.png)

Self-hosted EV charging dashboard with analytics, forecasts, charging insights, and a local PostgreSQL backend ⚡

[🇩🇪 German README](README.de.md) | [🌐 Website](https://bjornlabs.app/) | [🚀 Live Demo](https://edashboard.bjornlabs.app/) | [💬 Discussions](https://github.com/Mindfactory89/ev-charging-dashboard/discussions)

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

The app UI itself is still being translated step by step 🌍

### Live Demo

If you just want to take a quick look before installing anything, you can open the demo here 🙂

- [edashboard.bjornlabs.app](https://edashboard.bjornlabs.app/)

### Features

- Yearly overview, focus month, forecasts, and comparisons
- Smart charging insights, SoC analysis, and outlier detection
- Session management with inline editing, detail drawer, undo, and CSV export
- Demo mode for testing without a running API or database
- Visual vehicle profiles for CUPRA Born, CUPRA Tavascan, CUPRA Raval, and Generic EV

### Screenshots 📸

#### Hero Card
![Dashboard Hero Card](docs/images/hero-card.png)

#### Overview
![Dashboard Overview](docs/images/overview.png)

#### Analysis
![Dashboard Analysis](docs/images/analysis.png)

#### History
![Dashboard History](docs/images/history.png)

### Guided Setup

For most users, the setup script is the easiest way to get started 🙂

Clone with Git:

```bash
git clone https://github.com/Mindfactory89/ev-charging-dashboard.git
cd ev-charging-dashboard
```

Or clone with GitHub CLI:

```bash
gh repo clone Mindfactory89/ev-charging-dashboard
cd ev-charging-dashboard
```

Run the guided setup:

```bash
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

---

![Thank you for using EV Charging Dashboard](docs/images/danke.png)
