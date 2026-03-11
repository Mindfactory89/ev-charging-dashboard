# Security Policy

## Report a Vulnerability

Please do not post security issues publicly in GitHub Issues or Discussions.

Use GitHub Private Vulnerability Reporting instead:

- [Report a vulnerability](https://github.com/Mindfactory89/ev-charging-dashboard/security/advisories/new)

Please include:

- the affected file, endpoint, or component
- the possible impact
- clear reproduction steps
- optional ideas for mitigation or a fix

If you cannot use the private reporting flow, open a minimal public issue without technical details and ask for a private contact channel.

## Sicherheitsluecke melden

Bitte poste sicherheitsrelevante Probleme nicht oeffentlich in GitHub Issues oder Discussions.

Nutze stattdessen den privaten GitHub-Meldeweg:

- [Sicherheitsluecke vertraulich melden](https://github.com/Mindfactory89/ev-charging-dashboard/security/advisories/new)

Bitte nenne dabei:

- die betroffene Datei, Komponente oder den Endpunkt
- die moeglichen Auswirkungen
- klare Schritte zur Reproduktion
- optional eine Idee fuer Mitigation oder Fix

Falls du den privaten Meldeweg nicht nutzen kannst, erstelle bitte hoechstens ein minimales oeffentliches Issue ohne technische Details und bitte um einen privaten Kontaktweg.

## Typical Sensitive Areas

- API endpoints in `api/server.js`
- demo and production routing in `ui/src/ui/api.js`
- deployment scripts in `scripts/`
- Docker and `.env` configuration

## Typische sensible Bereiche

- API-Endpunkte in `api/server.js`
- Demo- und Produktivpfad in `ui/src/ui/api.js`
- Deploy-Skripte unter `scripts/`
- Docker- und `.env`-Konfiguration

## Basic Safety Rules

- never publish real `.env` files, tokens, SSH keys, or passwords
- rotate credentials immediately if something was exposed by mistake
- run the project only with your own database and your own infrastructure

## Grundregeln

- niemals echte `.env`-Dateien, Tokens, SSH-Keys oder Passwoerter veroeffentlichen
- Zugangsdaten sofort rotieren, wenn versehentlich etwas geleakt wurde
- das Projekt nur mit eigener Datenbank und eigener Infrastruktur betreiben

## Scope

This policy mainly covers:

- unintended access to sessions or usage data
- insecure default configuration
- deployment or SSH-related leaks
- issues caused by publicly reachable API endpoints

## Geltungsbereich

Diese Policy deckt vor allem ab:

- unbeabsichtigten Zugriff auf Sessions oder Nutzungsdaten
- unsichere Standardkonfigurationen
- Deploy- oder SSH-bezogene Leaks
- Probleme durch oeffentlich erreichbare API-Endpunkte
