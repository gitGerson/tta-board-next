# Deployment

This application runs as a **single long-lived Node process**. It is not a
standard `next start` deployment: `server.ts` wraps Next.js in its own HTTP
server so it can also terminate WebSocket connections for realtime board
updates.

Two consequences follow from that, and they drive everything below:

- The host must keep one process alive and let it hold open connections.
  Serverless platforms (Vercel, Netlify Functions, Cloud Run in request mode)
  cannot run it — see [Why not serverless](#why-not-serverless).
- Exactly **one** process must serve the app. See
  [Process model](#process-model-important).

The app also authenticates against LDAP and talks to PostgreSQL, so it belongs
on a host inside the network that can reach both.

## Requirements

| Requirement | Notes |
| --- | --- |
| Node.js | `>= 20.9.0` (Next.js 16 requirement) |
| PostgreSQL | Reachable from the app host |
| LDAP directory | Reachable from the app host; `ldaps://` is strongly recommended |
| Reverse proxy | Must forward WebSocket upgrades — see [nginx](#reverse-proxy-nginx) |

## Deploying on aaPanel

aaPanel's **Node project** manager is a good fit: it keeps the process running
and generates the nginx site for you.

### 1. Get the code onto the server

Use **Pull Git project** in the Add Node project dialog, or clone manually into
something like `/www/wwwroot/tta-board`.

### 2. Create `.env.local`

`.env*` is gitignored, so pulling from git will **not** bring it. Copy
`.env.example` to `.env.local` and fill it in:

```bash
cp .env.example .env.local
openssl rand -base64 32   # paste into SESSION_SECRET
```

Everything the server reads can live in this file, including `PORT` and `HOST`
— `server.ts` loads it before it reads either.

```bash
PORT=3000
HOST=127.0.0.1        # accept only reverse-proxied traffic
```

Leave `HOST` unset to bind `0.0.0.0`, which is useful while testing by IP but
should not be how you leave it.

Plain LDAP is disabled by default because it sends the service bind and user
credentials without transport encryption. If an isolated legacy directory only
supports port 389, enable it explicitly:

```bash
LDAP_URL=ldap://19.38.40.5:389
LDAP_ALLOW_INSECURE=true
```

Restrict port 389 so it is reachable only from the application host.

If `SESSION_SECRET` is missing the server **refuses to start**. That is
deliberate: it is the key that authenticates WebSocket handshakes, and starting
without it would accept unauthenticated sockets.

### 3. Prepare the build

aaPanel only runs the start script — it does not install, generate, migrate, or
build. Do that once by hand:

```bash
npm ci
npm run db:generate      # app/generated/prisma is gitignored
npm run db:deploy        # applies migrations; never use `prisma db push` here
npm run build            # .next is gitignored
```

Skipping `db:generate` fails the build on the missing Prisma client. Skipping
`npm run build` fails at startup when Next cannot find `.next`.

### 4. Fill in the Add Node project dialog

| Field | Value |
| --- | --- |
| **Path** | e.g. `/www/wwwroot/tta-board` |
| **Name** | anything |
| **Run opt** | **`start`** |
| **Port** | `3000` — must match `PORT` |
| **User** | `www` |
| **Node** | any `v20.9+` build |
| **Domain name** | your intranet hostname |

**Run opt is the field to get right.** `start` runs `tsx server.ts` in
production mode. `dev` would run the Turbopack dev server in production.

### 5. Configure the reverse proxy

See [nginx](#reverse-proxy-nginx) below. aaPanel's generated config usually does
not pass WebSocket upgrades, and the failure is silent.

### 6. Verify

See [Verifying the deployment](#verifying-the-deployment).

## Process model (important)

Realtime fan-out is an in-memory registry pinned to `globalThis`
(`app/lib/realtime/hub.ts`). It only reaches clients connected to the **same
process**.

- **Use PM2 fork mode with a single instance, or aaPanel's Default Project.**
- **Do not use PM2 cluster mode**, `instances > 1`, or multiple app servers
  behind a load balancer.

Running more than one process does not crash anything — it makes realtime work
for some users and not others, changing on every reconnect. That is a far worse
failure than an outage, so it is worth checking deliberately.

If you later need multiple processes, `hub.ts` is the only file that has to
change: replace the in-memory registry with PostgreSQL `LISTEN/NOTIFY` (the `pg`
driver is already a dependency) or Redis. Everything else is written against its
`subscribe` / `publish` interface.

## Reverse proxy (nginx)

The app serves WebSockets at **`/realtime`**. The proxy must forward upgrade
requests:

```nginx
location / {
    proxy_pass http://127.0.0.1:3000;
    proxy_http_version 1.1;

    # Without these two, /realtime never completes its handshake.
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "upgrade";

    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;

    # nginx defaults to 60s, uncomfortably close to the 30s heartbeat.
    proxy_read_timeout 3600s;
}
```

Missing `Upgrade`/`Connection` is the most common realtime failure: pages load
and mutations save normally, but every open tab sits in a reconnect loop and
nobody ever sees anyone else's changes.

On IIS, install the **WebSocket Protocol** feature and enable WebSockets in
ARR — the same rules apply.

## Verifying the deployment

1. Sign in.
2. Open DevTools → **Network** → **WS** filter.
3. Look for `/realtime`:
   - status **101** and a `{"type":"ready"}` frame → working.
   - **404** → the wrong start script is running (`Run opt` is not `start`).
   - connects then drops on a fixed cycle → raise `proxy_read_timeout`.
4. Open the same board in two browsers signed in as **different users**. Move a
   card in one; the other should update within about a second.

Step 4 is the only check that exercises the whole path. Do it before relying on
realtime.

## Updating a deployment

```bash
git pull
npm ci
npm run db:generate      # only needed if the Prisma schema changed
npm run db:deploy        # only needed if there are new migrations
npm run build            # always
```

Then restart the project in aaPanel. `npm run build` is not optional — the
running process serves the previous `.next` output until it restarts.

## Why not serverless

The app builds fine on Vercel and the pages work, which makes this failure easy
to miss: `server.ts` is never executed there, so `/realtime` returns 404 and
every tab reconnects forever with no error surfaced.

Beyond that, three things rule it out:

- Vercel functions do not accept inbound WebSocket connections.
- The `globalThis` hub cannot be shared across serverless invocations.
- LDAP and PostgreSQL would have to be exposed to the public internet for
  Vercel's cloud to reach them. Publishing a corporate directory server so a
  kanban board can authenticate is not a reasonable trade.

For access from outside the office, put the app behind a VPN or an
authenticated reverse proxy and keep it on-premises.

## Local development

`npm run dev` runs the same custom server with Turbopack and hot reload:

```bash
npm run dev        # tsx server.ts --dev
```

Realtime works locally. Changes to `server.ts` itself require a manual restart —
it runs outside the Next compiler and is not hot-reloaded.
