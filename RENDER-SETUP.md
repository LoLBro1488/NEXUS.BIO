# NEXUS.BIO — Render edition

Production-oriented NEXUS.BIO biolink app for Render + PostgreSQL.

## Deploy

1. Push this folder to a private GitHub repository.
2. Create a PostgreSQL database with a provider such as Neon/Supabase and copy its `DATABASE_URL`.
3. In Render, create a **Web Service** from the GitHub repository (or use the included `render.yaml` Blueprint).
4. Set these environment variables in Render:
   - `NODE_ENV=production`
   - `DATABASE_URL=<your PostgreSQL connection string>`
   - `SESSION_SECRET=<long random secret>`
   - `OWNER_INVITE_CODE=<owner invite code>`
5. Deploy. Render uses `npm ci`, then `npm start`, and checks `/api/health`.

## Owner account

The first person who registers with `OWNER_INVITE_CODE` becomes the `developer` owner. The owner can then create one-time user invites from the dashboard.

Do not commit `.env` or put the owner invite code in the repository. Keep it in Render environment variables.

## Local run

```bash
npm ci
cp .env.example .env
npm start
```

The database schema is created automatically on startup.

## Important Render note

The application stores data in PostgreSQL, not local SQLite files. This is intentional because Render free web-service filesystems are not suitable as persistent database storage.

## Health check

`GET /api/health` verifies that the application and PostgreSQL connection are available.
