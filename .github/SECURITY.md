# Security Policy

## Supported versions

Security fixes are applied to the current release line. Older releases may no longer receive patches.

| Version | Supported |
| --- | --- |
| 1.6.x | Yes |
| Older versions | No |

## Report a vulnerability

Please do not post security issues publicly in GitHub Issues or Discussions. Use [GitHub Private Vulnerability Reporting](https://github.com/Mindfactory89/ev-charging-dashboard/security/advisories/new) instead.

Please include:

- the affected file, endpoint, or component
- the possible impact
- clear reproduction steps
- optional ideas for mitigation or a fix

If the private reporting flow is unavailable, open a minimal public issue without technical details and ask for a private contact channel.

## Sicherheitslücke melden

Bitte veröffentliche sicherheitsrelevante Probleme nicht in GitHub Issues oder Discussions. Nutze stattdessen den [privaten GitHub-Meldeweg](https://github.com/Mindfactory89/ev-charging-dashboard/security/advisories/new).

Bitte nenne dabei:

- die betroffene Datei, Komponente oder den Endpunkt
- die möglichen Auswirkungen
- klare Schritte zur Reproduktion
- optional eine Idee für eine mögliche Lösung

Falls der private Meldeweg nicht verfügbar ist, erstelle höchstens ein minimales öffentliches Issue ohne technische Details und bitte um einen privaten Kontaktweg.

## Sensitive areas

- API routes and request validation in `api/routes/` and `api/lib/`
- demo and production routing in `ui/src/ui/api*.js`
- deployment and backup scripts in `scripts/`
- Docker, database, Telegram, and `.env` configuration

## Basic safety rules

- never publish real `.env` files, tokens, SSH keys, passwords, or database exports
- rotate credentials immediately if something was exposed by mistake
- run the project only with infrastructure and credentials you control
