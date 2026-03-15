# EV Charging Dashboard

![EV Charging Dashboard Banner](docs/images/banner.png)

Self-hosted EV-Ladedashboard mit Analysen, Forecasts, Lade-Insights und lokalem PostgreSQL-Backend ⚡

[🇬🇧 English README](README.md) | [🌐 Website](https://bjornlabs.app/) | [🚀 Live-Demo](https://edashboard.bjornlabs.app/) | [💬 Discussions](https://github.com/Mindfactory89/ev-charging-dashboard/discussions)

Willkommen zu meinem EV Charging Dashboard ⚡🚗

Das ist mein erstes Projekt in dieser Form, und ich lerne aktuell noch vieles Schritt fuer Schritt 🙂 Ich sitze jetzt seit etwa 1-2 Monaten daran und freue mich sehr, dass ich es endlich veroeffentlichen kann.

Dieses Projekt ist genau so entstanden, wie ich es mir selbst gewuenscht habe: ein Dashboard nach meinen eigenen Vorstellungen, ohne unnoetige Apps installieren zu muessen, mit Fokus auf Uebersicht, Analysen und einfache Nutzung.

Fuer die Zukunft plane ich noch einiges 🚀

- [Experimentelle Mobile App] Eine experimentelle Mobile App fuer iOS und Android, damit das Dashboard auch unterwegs easy zu bedienen ist
- Eine Home Assistant Integration
- Weitere Ideen fuer Struktur, Features und den gesamten Produktaufbau

### Feedback 💬

- Schreib mir gern eine Nachricht, wenn du Ideen oder Feedback hast
- Eroeffne gern einen Thread unter GitHub Discussions fuer Vorschlaege oder Verbesserungen

Die App-Oberflaeche unterstuetzt jetzt bereits Deutsch und Englisch, und die Uebersetzungsstruktur kann Schritt fuer Schritt weiter ausgebaut werden 🌍

### Demo ansehen

Wenn du dir das Projekt erst einmal nur anschauen willst, ohne etwas zu installieren, findest du die Demo hier 🙂

- [edashboard.bjornlabs.app](https://edashboard.bjornlabs.app/)
- Die Demo laeuft komplett clientseitig und speichert keine Aenderungen dauerhaft
- Pro Demo-Jahr wird ein realistisch wirkender Datensatz mit etwa `30` bis `50` Ladesessions erzeugt
- Preise, Energie und Verbrauch sind absichtlich naeher an echten AC/DC-Mustern, Saisoneffekten und einem `79 kWh`-Referenzakku modelliert

### Funktionen

- Jahresuebersicht, Monatsfokus, Forecasts und Vergleiche
- Smart Insights, SoC-Analyse und Ausreisser-Erkennung
- Zweisprachige UI in Deutsch und Englisch fuer Uebersicht, Analyse, Verlauf, Import und Session-Details
- Session-Verwaltung mit Inline-Edit, Detail-Drawer, Undo und CSV-Export
- Demo-Modus zum Testen ohne laufende API oder Datenbank
- Realistischere Demo-Daten mit mehr Sessions, variierenden AC/DC-Preisen und EV-typischen Ladefenstern
- Visuelle Fahrzeugprofile fuer CUPRA Born, CUPRA Tavascan, CUPRA Raval und Generic EV
- Versionierter VPS-Backup-Workflow mit automatischen Pre-Deploy-Snapshots, taeglichen Backups und Restore-Helfern

### Screenshots 📸

#### Hero Card
![Dashboard Hero Card](docs/images/hero-card.png)

#### Uebersicht
![Dashboard Overview](docs/images/overview.png)

#### Analyse
![Dashboard Analysis](docs/images/analysis.png)

#### Verlauf
![Dashboard History](docs/images/history.png)

### Gefuehrtes Setup

Fuer die meisten Nutzer ist das Setup-Script der einfachste Einstieg 🙂

Klonen mit Git:

```bash
git clone https://github.com/Mindfactory89/ev-charging-dashboard.git
cd ev-charging-dashboard
```

Oder mit GitHub CLI:

```bash
gh repo clone Mindfactory89/ev-charging-dashboard
cd ev-charging-dashboard
```

Das gefuehrte Setup starten:

```bash
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
- `TELEGRAM_BOT_TOKEN`
- `TELEGRAM_ALLOWED_CHAT_IDS`
- `SSH_DEPLOY_HOST`
- `SSH_DEPLOY_USER`
- `SSH_DEPLOY_PATH`

Hinweise:

- `VITE_API_BASE` kann leer bleiben, dann leitet die UI automatisch `hostname:18800` ab.
- `VITE_MOBILE_API_BASE` ist fuer native Android/iOS-Builds gedacht.
- `VITE_VEHICLE_PROFILE` aendert nur die visuelle Hero-/Profil-Darstellung. Eingebaute IDs sind `cupra-born`, `cupra-tavascan`, `cupra-raval` und `generic-ev`.
- `docker-compose.yml` erwartet eine explizite `TAILSCALE_IP`.
- Der Demo-Modus kann mit `?demo=1` oder ueber `VITE_DEMO_HOST_PREFIX` aktiviert werden.

### Telegram Bot fuer private Session-Erfassung

Wenn du unterwegs Sessions erfassen willst, kannst du optional einen privaten Telegram-Bot aktivieren.

- Der Bot nutzt Long Polling und braucht nur ausgehende Verbindungen zu Telegram
- Dein Dashboard muss dafuer nicht oeffentlich erreichbar sein
- Schreibzugriff bekommen nur Chats aus `TELEGRAM_ALLOWED_CHAT_IDS`
- Der Bot fuehrt dich per Chat durch ein Eingabeformular, zeigt Inline-Buttons fuer Auswahlfelder und schreibt den Eintrag anschliessend in die Datenbank

Beispiel fuer `.env`:

```bash
TELEGRAM_BOT_TOKEN=123456:replace-with-botfather-token
TELEGRAM_ALLOWED_CHAT_IDS=123456789
```

Typischer Ablauf:

- Bot bei `@BotFather` anlegen und Token in `TELEGRAM_BOT_TOKEN` eintragen
- eigene private Chat-ID in `TELEGRAM_ALLOWED_CHAT_IDS` hinterlegen
- API neu starten oder `docker compose up -d --build --no-deps api` ausfuehren
- im Telegram-Chat `/start` oder `Neue Session` senden

Praktische Hinweise:

- mehrere Chat-IDs koennen komma-separiert eingetragen werden
- unbekannte Chat-IDs werden im API-Log protokolliert, damit du neue Geraete spaeter freischalten kannst
- verfuegbare Bot-Befehle aktuell: `/start`, `/new`, `/cancel`, `/whoami`
- bei optionalen Feldern kannst du ueber Inline-Buttons direkt "Ohne Angabe" auswaehlen oder alternativ einfach die passende Zahl senden

### Deploy-Helfer

Fuer einen einfachen VPS-Workflow bringt das Repo einen kleinen Sync-und-Deploy-Helfer mit.

```bash
HOST=your.server.ip USER_NAME=deploy ./scripts/deploy-to-vps.sh
```

Ein versioniertes VPS-Backup kannst du auch manuell anlegen:

```bash
HOST=your.server.ip USER_NAME=deploy ./scripts/backup-vps.sh
```

`deploy-to-vps.sh` legt dieses Backup jetzt standardmaessig vor dem Sync an, solange du nicht explizit `CREATE_REMOTE_BACKUP=0` setzt.

Einen taeglichen VPS-Backup-Job per Cron kannst du so installieren:

```bash
HOST=your.server.ip USER_NAME=deploy ./scripts/install-vps-backup-cron.sh
```

Standard: taeglich um `03:20` Serverzeit, mit `RETENTION=5`.

Ein ausgewaehltes VPS-Backup kannst du so wiederherstellen:

```bash
HOST=your.server.ip USER_NAME=deploy ./scripts/restore-vps-backup.sh 20260311-201308
```

Der Restore-Helfer kann den Dateistand und auf Wunsch auch den passenden PostgreSQL-Dump zurueckspielen.

Einen SSH-Login-Hinweis, der das letzte Backup, dessen Alter, das naechste Backup-Fenster und optionale Download-Befehle anzeigt, installierst du so:

```bash
HOST=your.server.ip USER_NAME=deploy ./scripts/install-vps-backup-login-info.sh
```

Der Backup-Workflow deckt jetzt ab:

- automatische Pre-Deploy-Snapshots vor jedem VPS-Sync
- taegliche VPS-lokale Backups mit Retention-Bereinigung
- einen Restore-Helfer fuer einen ausgewaehlten Zeitstempel
- eine SSH-Login-Uebersicht mit letztem Backup-Namen, Alter, naechstem Lauf und Download-Befehl

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

---

![Danke fuer die Nutzung des EV Charging Dashboard](docs/images/danke.png)
