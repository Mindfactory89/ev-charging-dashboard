# Contributing

Danke fuer dein Interesse an diesem Projekt.

## Ziel des Projekts

Das Dashboard soll fuer private Nutzer einfach startbar bleiben:

- lokal mit eigener Datenbank
- ohne fremde Cloud-Abhaengigkeit
- ohne Zugriff auf Daten anderer Nutzer

Bitte halte Aenderungen deshalb moeglichst:

- nachvollziehbar
- klein und fokussiert
- einsteigerfreundlich
- rueckwaertskompatibel fuer bestehende Docker-Setups

## Schnellstart fuer Mitwirkende

Einfachster lokaler Start:

```bash
docker compose -f docker-compose.beginner.yml up -d --build
```

Alternativ manuell:

```bash
cd ui
npm install
npm run dev
```

```bash
cd api
npm install
npx prisma generate
npm start
```

## Erwartungen an Pull Requests

Bitte achte darauf:

- keine echten Zugangsdaten committen
- keine `.env`-Dateien committen
- keine persoenlichen Server-/SSH-Defaults einbauen
- Demo- und Produktivpfad nicht vermischen
- UI-Aenderungen auf Desktop und Mobile mitdenken
- bestehende Designsprache respektieren

## Bevor du einen Pull Request oeffnest

Pruefe bitte nach Moeglichkeit:

- startet die App mit Docker noch sauber
- ist die Aenderung in README oder `.env.example` dokumentiert, wenn noetig
- wirkt die UI nicht ueberladen oder inkonsistent
- sind Leerzustaende und Demo-Modus weiter korrekt

## Pull-Request-Umfang

Bevorzugt:

- ein Problem pro PR
- ein Feature pro PR
- klare Commit-Nachricht
- kurze Beschreibung von Aenderung, Motivation und Auswirkungen

## Was nicht in Pull Requests gehoert

- echte Nutzerdaten
- Dumps aus produktiven Datenbanken
- SSH-Keys, Tokens oder Zugangsdaten
- aenderungslos eingecheckte Build-Artefakte

## Fragen oder Ideen

Wenn du bei groesseren Aenderungen unsicher bist, oeffne zuerst ein Issue mit:

- Problem
- vorgeschlagener Loesung
- betroffenen Dateien oder Bereichen
