# Maintainer Guide

This document is the operational guide for maintaining this repository and the current VPS deployment.

It intentionally contains no secrets. Keep credentials, `.env` files, tokens, SSH keys, and private infrastructure details outside the repository.

## Current Baseline

- Repository: `Mindfactory89/ev-charging-dashboard`
- Default branch: `main`
- Public demo: `https://edashboard.bjornlabs.app/`
- Website: `https://bjornlabs.app/`
- Main deploy target path: `/srv/mobility-dashboard`

## Important Files And Ownership

These files matter the most for ongoing maintenance:

- `README.md`
  - English public landing page
- `README.de.md`
  - German public landing page
- `MAINTAINER.md`
  - internal operational maintainer guide
- `.github/workflows/ci.yml`
  - minimal GitHub CI
- `.github/dependabot.yml`
  - dependency update policy
- `.github/ISSUE_TEMPLATE/config.yml`
  - issue/discussions routing
- `SECURITY.md`
  - security disclosure flow
- `scripts/setup.sh`
  - interactive local/self-hosted onboarding
- `scripts/deploy-to-vps.sh`
  - VPS deployment entry point
- `scripts/sync-from-vps.sh`
  - pull deployed tree back for comparison
- `docker-compose.yml`
  - private self-hosted compose with Tailscale-focused path
- `docker-compose.no-tailscale.yml`
  - private self-hosted compose without Tailscale binding
- `docker-compose.beginner.yml`
  - simplest local Docker entry path
- `.env.example`
  - configuration reference

If one of these files changes, slow down and review the operational impact.

## Current Repo Policy

The repository is intentionally protected, but not locked down against the maintainer.

Current setup:

- `main` requires pull requests for normal changes
- required GitHub checks on `main`:
  - `API`
  - `UI`
- force pushes are blocked
- branch deletion is blocked
- squash merge is enabled
- merge commits are disabled
- rebase merge is disabled
- merged branches are deleted automatically

Important:

- Admin bypass is intentionally still possible
- direct pushes to `main` are allowed for the maintainer
- this is acceptable here because production-like checks are often done manually on the VPS first

If direct pushes are used:

1. test locally or on the VPS
2. push to `main`
3. verify that `API` and `UI` are green on GitHub

## Current GitHub Baseline

Repository settings currently expected:

- description:
  - `Self-hosted EV charging dashboard with analytics, forecasts and charging insights for electric vehicles.`
- homepage:
  - `https://edashboard.bjornlabs.app/`
- discussions:
  - enabled
- issues:
  - enabled
- wiki:
  - disabled
- merge strategy:
  - squash only
- delete merged branches:
  - enabled
- private vulnerability reporting:
  - enabled
- Dependabot alerts:
  - enabled
- Dependabot security updates:
  - enabled
- secret scanning:
  - enabled

If these settings change unintentionally, fix them before spending time on lower-priority cleanup.

## Current CI

GitHub Actions workflow:

- file: `.github/workflows/ci.yml`
- workflow name: `CI`

Checks currently run:

- `API`
  - `npm ci`
  - `npm run prisma:generate`
  - `npx prisma validate`
  - `node --check server.js`
- `UI`
  - `npm ci`
  - `npm run build`

CI is intentionally minimal.

It is meant to catch:

- broken installs
- broken Prisma generation
- invalid Prisma schema
- syntax problems in the API
- broken frontend builds

It does not currently cover:

- runtime integration tests
- Docker build validation in CI
- end-to-end tests
- VPS deployment checks

Current CI expectation:

- if `API` or `UI` are red, do not treat `main` as healthy
- documentation-only changes usually do not need local heavy verification, but CI should still stay green
- if CI fails after a direct maintainer push, fix the branch quickly instead of leaving `main` broken

## Daily Workflow

Recommended maintainer workflow:

1. make the change locally
2. run the smallest relevant local verification
3. commit clearly
4. push to GitHub
5. check `API` and `UI`
6. deploy to VPS if needed

For documentation-only changes:

- usually no heavy verification is needed

For frontend changes:

- run `npm run build` in `ui`

For backend changes:

- run `npm ci` in `api` if dependencies changed
- run `npm run prisma:generate`
- run `DATABASE_URL='postgresql://user:password@127.0.0.1:5432/mobility?schema=public' npx prisma validate`
- run `node --check server.js`

Recommended practical review before any push:

- check `git status`
- check whether only the intended files changed
- check whether documentation, setup instructions, or deploy logic also need adjustment
- decide whether the change is safe for direct `main` push or should go through a PR anyway

## Deployment to VPS

Primary deploy script:

- `scripts/deploy-to-vps.sh`

Current standard command:

```bash
HOST=87.106.31.45 USER_NAME=bjoern ./scripts/deploy-to-vps.sh
```

What it does:

1. syncs the repository to the VPS via `rsync`
2. excludes local-only artifacts such as:
   - `.git/`
   - `.env`
   - `node_modules/`
   - `ui/dist/`
   - logs
3. runs remote:

```bash
docker compose up -d --build api ui
```

Useful deploy variants:

Only redeploy UI:

```bash
HOST=87.106.31.45 USER_NAME=bjoern SERVICES=ui ./scripts/deploy-to-vps.sh
```

Only redeploy API:

```bash
HOST=87.106.31.45 USER_NAME=bjoern SERVICES=api ./scripts/deploy-to-vps.sh
```

Sync from VPS for comparison:

```bash
HOST=87.106.31.45 USER_NAME=bjoern ./scripts/sync-from-vps.sh
```

Use that when:

- the server state looks suspicious
- you want to compare generated or live files
- you want to double-check the deployed tree against local state

## Deploy Checklist

Before deploy:

1. confirm local branch is the intended state
2. confirm no accidental local-only files are included
3. confirm GitHub `API` and `UI` checks are green if code changed
4. confirm the target VPS and path are correct

Standard deploy:

```bash
HOST=87.106.31.45 USER_NAME=bjoern ./scripts/deploy-to-vps.sh
```

After deploy:

1. verify `docker compose ps` remotely if something looks off
2. open the live app
3. check that API-backed screens still load
4. spot-check one or two charts/cards, not only the landing view
5. if the change affected setup/docs/demo presentation, verify those separately

Low-risk deploy examples:

- README changes
- screenshots
- maintainership docs
- GitHub-only metadata

Higher-risk deploy examples:

- Prisma schema changes
- Docker base image changes
- compose changes
- API environment changes
- frontend runtime/config changes

## Rollback Strategy

There is no zero-risk one-click rollback flow in this repository right now, but the repo now supports versioned VPS backups.

Current practical rollback options:

1. revert the bad commit locally
2. push the revert to GitHub
3. redeploy to the VPS

or, for urgent cases:

1. create or identify a versioned backup under `/srv/mobility-dashboard-backups/<timestamp>`
2. restore that backup tree and, if needed, the matching database dump
3. then clean up Git history properly afterward

Important:

- do not panic-edit directly on the server unless absolutely necessary
- prefer keeping GitHub as the source of truth
- if the VPS state becomes confusing, use `scripts/sync-from-vps.sh` and compare it locally
- `scripts/backup-vps.sh` creates a timestamped file tree backup and a Postgres dump by default
- `scripts/backup-local.sh` is the VPS-local backup entry point for cron/system automation
- `scripts/deploy-to-vps.sh` creates that VPS backup automatically before sync unless `CREATE_REMOTE_BACKUP=0`
- `scripts/restore-vps-backup.sh` can restore a selected timestamped backup and optionally the DB dump
- `scripts/install-vps-backup-cron.sh` installs a daily cron-based backup job on the VPS
- `scripts/install-vps-backup-login-info.sh` adds an SSH login summary for the latest backup and download commands

## Documentation Structure

Public docs are intentionally split:

- `README.md`
  - English main public page
- `README.de.md`
  - German public page

Current documentation rule:

- keep public statements consistent across both files
- if you add a new public-facing section in one README, mirror it in the other unless there is a strong reason not to
- `MAINTAINER.md` is allowed to be more direct, operational, and incomplete from a public-marketing perspective

Current public positioning to preserve:

- first project in this form
- still learning
- self-hosted and app-light philosophy
- mobile support exists but is not production-ready
- Home Assistant integration is planned, not shipped
- feedback via messages or GitHub Discussions is welcome

## Environment and Compose Notes

Main environment reference:

- `.env.example`

There are three main compose paths:

- `docker-compose.beginner.yml`
  - easiest local setup
- `docker-compose.no-tailscale.yml`
  - private self-hosted without Tailscale binding
- `docker-compose.yml`
  - private self-hosted with explicit Tailscale binding

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

Practical rule for env handling:

- `.env.example` is documentation
- real `.env` files stay local or on the server
- never normalize secrets into tracked files for convenience

Compose rule of thumb:

- use `docker-compose.beginner.yml` for the easiest local Docker path
- use `docker-compose.no-tailscale.yml` for private hosting without Tailscale network binding
- use `docker-compose.yml` only when the Tailscale-oriented setup is truly intended

## Dependabot Policy

Dependabot is enabled, but intentionally tuned to reduce noise.

Current behavior:

- weekly update schedule
- grouped updates for:
  - GitHub Actions
  - `api` npm dependencies
  - `ui` npm dependencies
  - Docker base image updates
- open PR count is limited
- semver-major updates are ignored by default

Why:

- patch and minor updates are often useful and low risk
- major updates create noise and usually need real migration work

Current maintainer rule:

- green patch/minor PRs can be reviewed quickly
- major updates should be handled as dedicated work, not merged blindly

Examples of updates that should not be merged blindly:

- React major jumps
- Prisma major jumps
- Docker image jumps to non-LTS Node versions

When reviewing Dependabot PRs:

- read the CI result first
- prefer grouped patch/minor updates over individual churn
- do not assume green CI means zero runtime risk
- if a PR touches infrastructure or runtime versions, review it like a real change, not housekeeping

## Dependency Strategy

Keep the project on stable lines unless there is a strong reason to move.

Current practical rules:

- prefer stable npm patch/minor updates
- prefer LTS-oriented Node runtime decisions
- avoid large framework upgrades unless there is time to test and adapt code

Important recent lesson:

- `@fastify/cors` was removed because it was not actually used
- avoid keeping dependencies that are not used in code

Additional dependency rule:

- do not add dependencies just to avoid writing a few lines of straightforward code
- every dependency should either save meaningful maintenance cost or provide capability that would be unreasonable to rebuild

## Mobile Status

Mobile support exists in the repo, but it is still experimental.

Current maintainer position:

- do not present mobile as production-ready
- do not merge mobile-related dependency jumps blindly
- treat Android/iOS work as a separate learning and testing stream

If mobile work resumes later, it should likely happen as a focused effort with:

- one branch
- one goal
- one testing path

Current messaging to preserve:

- mobile is not fully tested
- mobile should only be used by people who know what they are doing
- active work is paused for time reasons and because the implementation path still needs learning

## Troubleshooting Pointers

If the VPS deploy appears wrong:

- confirm the correct host and user were used
- confirm the target path is `/srv/mobility-dashboard`
- confirm the local tree actually contains the intended changes
- rerun deploy for only the affected service if appropriate
- inspect remote container state with Docker on the VPS

If GitHub CI fails unexpectedly:

- start with the failing job log
- separate install failure, build failure, Prisma failure, and syntax failure
- do not fix CI by weakening the workflow unless the workflow is genuinely wrong

If docs drift out of sync:

- treat `README.md` and `README.de.md` as a pair
- update both in the same change when possible
- keep screenshots and banner references valid

## Release and Tagging Notes

Tags exist in the repository and should stay meaningful.

Practical rule:

- tag only meaningful, stable checkpoints
- do not create a tag for every tiny documentation or maintenance change

Good tag candidates:

- public onboarding milestones
- deploy-safe functional milestones
- significant UI/profile releases
- infrastructure changes that are known stable

Poor tag candidates:

- typo fixes
- tiny README wording updates
- one-off cleanup commits

## Security Handling

Security policy:

- `SECURITY.md`

Current security flow:

- private vulnerability reporting is enabled on GitHub
- security issues should not be handled in public issues or discussions

If a report arrives:

1. confirm receipt
2. reproduce carefully
3. fix privately if needed
4. publish only the minimal public information after remediation

## Repo Hygiene Rules

General hygiene rules:

- do not commit real secrets
- do not commit local `.env` files
- do not commit Finder junk like `.DS_Store`
- do not commit editor junk
- do not commit generated local build output unless truly intentional

`.gitignore` already covers:

- editor artifacts
- native mobile build artifacts
- local npm/temp files
- `node_modules`
- `dist`
- `.DS_Store`

Additional hygiene rule:

- before commit, prefer one quick pass over `git diff --stat` or `git status --short` so accidental files never travel downstream

## When To Be Careful

Slow down and verify more carefully when changing:

- `scripts/deploy-to-vps.sh`
- `scripts/setup.sh`
- `.github/workflows/ci.yml`
- `docker-compose*.yml`
- `api/prisma/schema.prisma`
- mobile container config under `ui/android` and `ui/ios`

Also slow down when changing:

- `README.md` and `README.de.md` together if public messaging changes
- `.env.example`
- vehicle profile configuration and hero assets
- GitHub repo policy files under `.github/`

These areas have outsized operational impact.

## Current Maintainer Shortcut

If you want the shortest possible safe routine:

1. test locally or on the VPS
2. push to `main`
3. verify `API` and `UI`
4. deploy with:

```bash
HOST=87.106.31.45 USER_NAME=bjoern ./scripts/deploy-to-vps.sh
```

5. spot-check the live app and demo

That is the current pragmatic maintenance path for this project.
