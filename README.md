# EV Charging Dashboard

![EV Charging Dashboard Banner](docs/images/banner.png)

Self-hosted EV charging dashboard with analytics, forecasts, charging insights, and a local PostgreSQL backend ⚡

[🇩🇪 German README](README.de.md) | [🌐 Website](https://bjornlabs.app/) | [🚀 Live Demo](https://edashboard.bjornlabs.app/) | [💬 Discussions](https://github.com/Mindfactory89/ev-charging-dashboard/discussions)

Welcome to my EV Charging Dashboard ⚡🚗

This is my first project of this kind, and I am still learning a lot step by step 🙂 I have been working on it for around 1-2 months now, and I am really happy to finally share it publicly.

This project is built the way I personally wanted it to be: a dashboard based on my own ideas, without needing to install unnecessary apps, with a strong focus on clarity, analytics, and simple usability.

There is still a lot planned for the future 🚀

- [Experimental Mobile App] An experimental mobile app for iOS and Android, so the dashboard will also be easy to use on the go
- A Home Assistant integration
- More ideas for the structure, features, and overall product direction

### Feedback 💬

- Feel free to send me a message if you have ideas or feedback
- Open a thread in GitHub Discussions for suggestions or improvements

The app now supports German and English in the UI, and the translation layer can continue to grow step by step 🌍

### Live Demo

If you just want to take a quick look before installing anything, you can open the demo here 🙂

- [edashboard.bjornlabs.app](https://edashboard.bjornlabs.app/)
- The demo runs fully client-side and does not persist any changes
- Demo years generate a realistic sample set with roughly `30` to `50` charging sessions
- Demo prices and energy amounts are intentionally more lifelike, with AC/DC variance, seasonal consumption, and a `79 kWh` reference battery profile

### Features

- Yearly overview, focus month, forecasts, and comparisons
- Smart charging insights, SoC analysis, and outlier detection
- Bilingual UI in German and English across overview, analysis, history, import, and session detail flows
- Session management with inline editing, detail drawer, undo, and CSV export
- Demo mode for testing without a running API or database
- More realistic demo data with higher session counts, variable AC/DC pricing, and EV-like charging windows
- Visual vehicle profiles for CUPRA Born, CUPRA Tavascan, CUPRA Raval, and Generic EV
- Versioned VPS backup workflow with automatic pre-deploy snapshots, daily retention-based backups, and restore helpers

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
- `TELEGRAM_BOT_TOKEN`
- `TELEGRAM_ALLOWED_CHAT_IDS`
- `SSH_DEPLOY_HOST`
- `SSH_DEPLOY_USER`
- `SSH_DEPLOY_PATH`

Notes:

- Leave `VITE_API_BASE` empty when the UI should derive `hostname:18800` automatically.
- `VITE_MOBILE_API_BASE` is intended for native Android/iOS builds.
- `VITE_VEHICLE_PROFILE` only changes the visual hero/profile presentation. Built-in IDs are `cupra-born`, `cupra-tavascan`, `cupra-raval`, and `generic-ev`.
- `docker-compose.yml` requires an explicit `TAILSCALE_IP`.
- Demo mode can be activated with `?demo=1` or via `VITE_DEMO_HOST_PREFIX`.

### Telegram Bot For Private Session Entry

If you want to add charging sessions while away from home, you can optionally enable a private Telegram bot.

- The bot uses long polling and only needs outbound access to Telegram
- Your dashboard does not need to become publicly reachable
- Write access is limited to chats listed in `TELEGRAM_ALLOWED_CHAT_IDS`
- The bot walks through a guided chat form, shows inline buttons for choice-based steps, and writes the entry into the database afterwards

Example `.env` values:

```bash
TELEGRAM_BOT_TOKEN=123456:replace-with-botfather-token
TELEGRAM_ALLOWED_CHAT_IDS=123456789
```

Typical setup flow:

- create a bot with `@BotFather` and paste the token into `TELEGRAM_BOT_TOKEN`
- add your private chat ID to `TELEGRAM_ALLOWED_CHAT_IDS`
- restart the API or run `docker compose up -d --build --no-deps api`
- send `/start` or `Neue Session` in Telegram

Helpful notes:

- you can add multiple chat IDs as a comma-separated list
- unknown chat IDs are logged by the API so you can allow new devices later
- current bot commands: `/start`, `/new`, `/cancel`, `/whoami`
- for optional fields you can use the inline "Without value" button or simply send the matching number

#### GitHub And Privacy

The Telegram bot implementation can be committed to GitHub and deployed normally as long as your private values stay inside `.env`.

- `.env`, `.env.local`, and other real env files are excluded from Git via `.gitignore`
- only code, tests, Docker files, and examples like `.env.example` should be committed
- your `TELEGRAM_BOT_TOKEN`, `TELEGRAM_ALLOWED_CHAT_IDS`, and real server values should live only in your local or VPS `.env`
- your charging session data lives in PostgreSQL and is not versioned by a Git commit
- the deploy workflow also skips syncing `.env` by default so secrets stay private on the target machine

Important:

- before committing, make sure no real tokens or chat IDs ended up in the README, code snippets, or screenshots
- if a token was ever visible in a chat, commit, or screenshot, rotate it with `@BotFather`

### Deploy Helper

For a simple VPS workflow, the repo ships with a small sync-and-deploy helper.

```bash
HOST=your.server.ip USER_NAME=deploy ./scripts/deploy-to-vps.sh
```

Create a versioned VPS backup manually:

```bash
HOST=your.server.ip USER_NAME=deploy ./scripts/backup-vps.sh
```

`deploy-to-vps.sh` now creates that backup automatically before syncing unless you explicitly set `CREATE_REMOTE_BACKUP=0`.

Install a daily VPS backup cron job:

```bash
HOST=your.server.ip USER_NAME=deploy ./scripts/install-vps-backup-cron.sh
```

Default schedule: every day at `03:20` server time, with `RETENTION=5`.

Restore a selected VPS backup:

```bash
HOST=your.server.ip USER_NAME=deploy ./scripts/restore-vps-backup.sh 20260311-201308
```

That restore helper can restore the file tree and, if desired, the matching PostgreSQL dump.

Install an SSH login hint that shows the latest backup, its age, the next backup window, and optional download commands:

```bash
HOST=your.server.ip USER_NAME=deploy ./scripts/install-vps-backup-login-info.sh
```

The backup workflow now covers:

- automatic pre-deploy snapshots before every VPS sync
- daily VPS-local backups with retention cleanup
- a restore helper for a selected timestamp
- an SSH login summary with last backup name, age, next run, and download command

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
