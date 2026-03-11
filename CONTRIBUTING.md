# Contributing

Thanks for contributing.

## Local Setup

Recommended:

```bash
bash ./scripts/setup.sh
```

Manual local Docker start:

```bash
docker compose -f docker-compose.beginner.yml up -d --build
```

Manual development mode:

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

## Pull Request Expectations

Please keep changes:

- small and focused
- understandable for non-experts
- compatible with the current Docker-based setup
- aligned with the existing UI language and interaction patterns

Before opening a PR, check when possible:

- the app still starts with Docker
- README or `.env.example` were updated when behavior changed
- empty states still make sense
- demo mode still behaves correctly
- mobile-sensitive UI changes were considered

## What Must Not Land In The Repo

- real credentials, tokens, SSH keys, or private `.env` files
- production database dumps or user data
- unrelated generated artifacts
- internal release notes, planning scratchpads, or maintainer-only meta documents

## PR Scope

Preferred:

- one problem per PR
- one feature per PR
- a clear commit message
- a short description of change, motivation, and impact

## Larger Changes

For larger changes, open an issue first with:

- the problem
- the proposed approach
- the affected files or areas
