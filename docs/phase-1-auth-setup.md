# Phase 1 Auth Setup — manual steps

After PR #2 merges, you need to do these **one-time** steps to get login working in production. Local dev works the same way — just use `http://localhost:3000` instead of your Vercel URL.

## 1. Generate an `AUTH_SECRET`

```bash
openssl rand -base64 32
```

Copy the output. You'll paste it into both local `.env` and Vercel env vars.

## 2. Register a GitHub OAuth App

1. Go to https://github.com/settings/developers → **OAuth Apps** → **New OAuth App**
2. Fill in:
   - **Application name:** `TMOS (production)` (or `TMOS (dev)` for a separate local one)
   - **Homepage URL:** `https://your-vercel-url.vercel.app`
   - **Authorization callback URL:** `https://your-vercel-url.vercel.app/api/auth/callback/github`
3. Click **Register application**
4. Copy the **Client ID** → this is `AUTH_GITHUB_ID`
5. Click **Generate a new client secret** → copy → this is `AUTH_GITHUB_SECRET`

For local dev, register a second app with `http://localhost:3000` URLs.

## 3. Register a Google OAuth App

1. Go to https://console.cloud.google.com/apis/credentials
2. Create a project (if you don't have one) — name it whatever
3. **Configure OAuth consent screen** (if prompted):
   - User type: External
   - App name: `TMOS`
   - User support email: your email
   - Scopes: leave defaults (email + profile)
4. **Create Credentials → OAuth client ID**:
   - Application type: **Web application**
   - Name: `TMOS (production)`
   - Authorized redirect URIs: `https://your-vercel-url.vercel.app/api/auth/callback/google`
5. Copy **Client ID** → `AUTH_GOOGLE_ID`
6. Copy **Client secret** → `AUTH_GOOGLE_SECRET`

For local dev, add `http://localhost:3000/api/auth/callback/google` as a second redirect URI on the same credential.

## 4. Add env vars to Vercel

Vercel dashboard → your project → **Settings → Environment Variables**. Add:

| Key | Value |
| --- | ----- |
| `AUTH_SECRET` | from step 1 |
| `AUTH_URL` | `https://your-vercel-url.vercel.app` |
| `AUTH_GITHUB_ID` | from step 2 |
| `AUTH_GITHUB_SECRET` | from step 2 |
| `AUTH_GOOGLE_ID` | from step 3 |
| `AUTH_GOOGLE_SECRET` | from step 3 |
| `DATABASE_URL` | from Railway → Postgres → Variables |

Set all of them for **Production, Preview, and Development**.

## 5. Apply the database schema to Railway Postgres

The schema from PR #1 exists in code but the tables don't exist in the DB yet. From your local terminal:

```bash
# Pull Railway's DATABASE_URL into your local shell temporarily
export DATABASE_URL="<paste-from-railway>"

# Create a migration and push it to the DB
pnpm --filter @tmmt/db exec prisma migrate dev --name phase-1-initial
```

This creates `packages/db/prisma/migrations/<timestamp>_phase-1-initial/` and applies the SQL to Railway's Postgres. **Commit the migration file** — Railway will auto-apply future migrations via `prisma migrate deploy`.

## 6. Verify login works

1. Redeploy Vercel (happens automatically when you push the migration)
2. Open your Vercel URL → you should see the landing page
3. Click **Get started** → redirected to `/login`
4. Click **Continue with GitHub** → authorize → redirected to `/app`
5. You should see "Hi, {your name}!"
6. Check Railway Postgres via Prisma Studio to confirm:
   ```bash
   pnpm --filter @tmmt/db exec prisma studio
   ```
   You should see a row in `User` and `Account`.
