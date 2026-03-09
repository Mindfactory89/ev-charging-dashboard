# Mobility Dashboard

Premium EV charging dashboard for charging history, cost analytics, forecasts, year comparison and mobility intelligence.

Ich habe dieses Dashboard in Eigenregie entwickelt, weil mich die Daten rund um Laden, Kosten, Verbrauch und Fahrprofil meines E-Autos interessiert haben. Gleichzeitig ist es mein persoenliches Lernprojekt und mein Einstieg in die praktische Softwareentwicklung.

Das Ergebnis ist ein ruhiges, datenfokussiertes Dashboard mit Premium-Anspruch: klare Analysen, lokale Datenhaltung und ein Interface, das sich eher wie ein Produkt als wie ein Roh-Tool anfuehlen soll.

## Betriebsmodi

- `docker-compose.beginner.yml`: lokaler Schnellstart mit eigener PostgreSQL-Datenbank
- `docker-compose.yml`: privater Betrieb auf eigenem VPS oder in eigener Infrastruktur

## Produktbild

Das Dashboard ist in drei Bereiche gegliedert:

- `Uebersicht`: Hero, KPI-Rail, Monatsverlauf, Monatsbericht, Spotlight, Forecast
- `Analyse`: Jahresvergleich, Monatsfokus, Ladeleistungskurve nach SoC-Bereich, Smart Insights, Median-/Effizienzsicht, Mobilitaetsanalyse, Ausreisser
- `Verlauf`: Sessions pflegen, Detail-Drawer oeffnen, inline bearbeiten, loeschen, undoen und neue Sessions erfassen

## Screenshots

### Uebersicht
![Dashboard Overview](docs/images/overview.png)

### Analyse
![Dashboard Analysis](docs/images/analysis.png)

### Verlauf
![Dashboard History](docs/images/history.png)

## Highlights

- Jahresauswertung pro Jahr
- sauberer Leerzustand fuer Jahre ohne Daten
- Monatsanalyse mit Kosten, Energie, Sessions und Preisniveau
- Jahresvergleich zwischen zwei Jahren mit Monatsreihen
- Monatsvergleich mit selektierbarem `Monatsfokus` im Diagramm
- Forecast / Jahreshochrechnung
- persoenlicher Monatsbericht mit Vergleich zum vorherigen aktiven Monat
- Smart Insights inkl. `Top-Ladetag` fuer Jahr und Fokusmonat
- SoC-Band-Analyse und Ladeleistungskurve
- Medianwerte zusaetzlich zu Durchschnittswerten
- Cost Efficiency Score
- Ausreisseranalyse
- Fahrprofil & Effizienz auf Basis eines einzelnen Kilometerstands pro Ladevorgang
- Effizienzlabels `Green Energy`, `Sparsam` und `Nicht so sparsam`
- Fahrtipps auf Basis von Verbrauch, Kurzstrecke, Winterbetrieb, DC-Anteil und SoC-Verhalten
- Home vs. Public Intelligence, Wochentag-Heatmap und What-if-Rechner
- Session-Tabelle mit Inline-Edit und Session-Detail-Drawer
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
- fuer `2026` und `2027` werden pro Jahr jeweils `15-20` realistische Sessions erzeugt
- Wallbox, Public AC und Public DC werden mit plausiblen Preisen, kWh-Werten und Fahrdistanzen gemischt
- insgesamt gilt weiterhin ein hartes Demo-Limit fuer manuell hinzugefuegte Eintraege
- `2028` bleibt leer, bis dort manuell Sessions erfasst werden

## Stack

- `ui/`: React + Vite + Recharts
- `api/`: Fastify + Prisma
- `db`: PostgreSQL via Docker Compose

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
- Kilometer-Logik: Pro Session wird nur der aktuelle Kilometerstand nach der Ladung erfasst; die Distanz ergibt sich automatisch aus der Differenz zum vorherigen Eintrag.

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
(Hier experimentiere ich grade etwas - es könnte also fehlerhaft sein!)
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

Kurz dazu:

- Android und iOS Projekte liegen nach dem Setup in `ui/android` und `ui/ios`
- CSV-Exporte werden auf mobilen Geraeten ueber Share/Download-Fallback behandelt
- fuer iOS brauchst du die volle Xcode-App und nicht nur Command Line Tools

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

## Privater Betrieb mit `docker-compose.yml`

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

## Daten und Sicherheit

Das Projekt ist `self-hosted` und fuer den Betrieb mit eigener Datenbank gedacht.

- Produktivdaten bleiben in deiner eigenen PostgreSQL-Instanz
- Zugangsdaten und private Umgebungsdateien gehoeren nicht ins Repository
- fuer oeffentliche Releases sollte nur `.env.example` verwendet werden

## Wichtiger Hinweis zu Kilometerstaenden

Das Dashboard ist auf folgende Logik ausgelegt:

- pro Ladevorgang wird nur der aktuelle Kilometerstand nach dem Laden gespeichert
- die Fahrdistanz ergibt sich aus der Differenz zum vorherigen bekannten Kilometerstand
- der erste eingetragene Kilometerstand dient nur als Referenz und erzeugt noch keine Fahrdistanz
- `kWh / 100 km`, `EUR / 100 km`, Fahrprofil und Fahrtipps bauen auf diesen Differenzen auf
