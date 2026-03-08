# Security Policy

## Bitte keine Sicherheitsluecken oeffentlich posten

Wenn du eine sicherheitsrelevante Luecke findest, erstelle bitte kein oeffentliches GitHub-Issue mit Exploit-Details.

Stattdessen:

- beschreibe die Luecke vertraulich
- nenne betroffene Datei oder Komponente
- erklaere kurz die moeglichen Auswirkungen
- beschreibe, wie sich das Problem reproduzieren laesst

## Typische sensible Bereiche in diesem Projekt

- API-Endpunkte in `api/server.js`
- Demo- und Produktivpfad in `ui/src/ui/api.js`
- Deploy-Skripte unter `scripts/`
- Docker- und `.env`-Konfiguration

## Grundregeln fuer Nutzer

- niemals echte `.env`-Dateien veroeffentlichen
- Passwoerter und Tokens immer sofort rotieren, wenn sie versehentlich geleakt wurden
- das Projekt nur mit eigener Datenbank und eigenem Server betreiben

## Scope

Diese Policy deckt vor allem ab:

- unbeabsichtigten Zugriff auf Sessions oder Daten
- unsichere Standardkonfigurationen
- Deploy-/SSH-bezogene Leaks
- Luecken durch oeffentlich erreichbare API-Endpunkte
