# CrimeSpot

Community safety for South African neighbourhoods: report crime on a map, see hotspots, share your live location with people you trust, and raise an SOS alert with one button.

**Stack:** Angular 20 (PWA) · Spring Boot 3.3 (Java 21) · PostgreSQL 16 · Keycloak 26

## Features

- **Sign-in with Keycloak:** email/password or Google, brute-force protection, long sessions. Password changes on Keycloak's account page.
- **Incident reports:** pin on a map, type, description, time. Reporters stay anonymous to other users.
- **Hotspots:** reports grouped into ~500 m cells; violent, recent and verified incidents weigh more. Recalculated hourly.
- **Moderation:** moderators verify or reject reports; admins manage roles.
- **Friends:** add people by 8-character friend code (no searching by email). Phone numbers are visible only to accepted friends.
- **Live location:** share with chosen friends for 1 hour, 8 hours, or until you stop. Only the latest position is stored, and it is deleted when sharing ends.
- **SOS:** hold for 3 s. Friends get an urgent push notification, a red banner in the app, your live location, and a call button. Tap-to-call 10111 / 112 / 10177. "I'm safe" ends it and notifies friends.
- **Push notifications** (Web Push / VAPID) for SOS, friend requests and location sharing.
- **Real-time sync** over WebSocket (`/ws`): pages update instantly when reports, hotspots, friends, live locations or alerts change. Events carry no data; apps re-fetch through the access-checked API. Polling remains as a slow fallback.
- **Check-in timer:** when sharing, "alert my friends if I don't check in within 30 min / 1 h / 2 h". Missed check-ins raise an SOS automatically.
- **Alerts near home:** push notification for verified incidents within 1, 2 or 5 km of your home area (rounded to ~100 m, encrypted).
- **SMS fallback:** if an SOS can't reach the server, one tap texts your friends your location.

### Security
- TLS everywhere; Neon encrypts storage at rest.
- **Field-level encryption (AES-256-GCM)** in the API for names, phone numbers, live locations, home areas, SOS alerts and push keys. The key (`DATA_ENCRYPTION_KEY`) lives only in the API environment. **Back it up: without it, those fields can't be read.**
- Rate limits per user (reads 300/min, writes 60/min, friend requests 20/hour); SOS is never limited.
- Strict Content-Security-Policy on the web app; HSTS, no-referrer and deny-framing on the API.

### Limits of a web app
- Location is sent only while CrimeSpot is open on screen. Background tracking needs a native wrapper (e.g. Capacitor).
- iPhone: push notifications work only after "Add to Home Screen" (iOS 16.4+).

## Run locally

Prerequisites: Java 21, Maven 3.9+, Node 20+, Docker.

```bash
docker compose up -d                       # Postgres :5432 + Keycloak :8180 (admin / admin)

cd backend
KEYCLOAK_ISSUER=http://localhost:8180/realms/crimespot \
ADMIN_EMAIL=you@example.com \
mvn spring-boot:run                        # API :8080

cd frontend && npm install && npm start    # Web :4200
```

The account that signs in with `ADMIN_EMAIL` (verified email, e.g. via Google) becomes an admin.
Push notifications only work in production builds (`npx ng build` and serve `dist/`), because the service worker is disabled in dev.

## Configuration

**API**

| Variable | Notes |
|---|---|
| `DATABASE_URL` | JDBC URL, e.g. `jdbc:postgresql://<host>/crimespot?sslmode=require` |
| `DATABASE_USERNAME` / `DATABASE_PASSWORD` | |
| `KEYCLOAK_ISSUER` | `https://<keycloak-host>/realms/crimespot` |
| `KEYCLOAK_AUDIENCE` | Default `crimespot-api` (added to tokens by the realm config) |
| `CORS_ALLOWED_ORIGINS` | Comma-separated web origins |
| `ADMIN_EMAIL` | Becomes admin on first verified sign-in |
| `VAPID_PUBLIC_KEY` / `VAPID_PRIVATE_KEY` / `VAPID_SUBJECT` | `npx web-push generate-vapid-keys`; subject like `mailto:you@example.com` |
| `DATA_ENCRYPTION_KEY` | **Required.** `openssl rand -base64 32`. Keep a safe copy |

**Keycloak** (`keycloak/`)

| Variable | Notes |
|---|---|
| `KC_DB_URL` / `KC_DB_USERNAME` / `KC_DB_PASSWORD` | Separate `keycloak` database |
| `KC_HOSTNAME` | Public URL, e.g. `https://crimespot-auth.onrender.com` |
| `KC_PROXY_HEADERS=xforwarded`, `KC_HTTP_ENABLED=true` | Behind Render's proxy |
| `KC_BOOTSTRAP_ADMIN_USERNAME` / `..._PASSWORD` | First admin-console login |
| `CRIMESPOT_WEB_URL` | Allowed redirect for the web client |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | Google login |

The realm in `keycloak/realm/` is imported **only the first time** Keycloak starts. Later changes (e.g. Google credentials) are made in the admin console: Realm `crimespot` → Identity providers → google.

**Google login:** in Google Cloud Console create an OAuth client (Web application) with authorised redirect URI
`https://<keycloak-host>/realms/crimespot/broker/google/endpoint`.

**Web:** API and Keycloak URLs in `frontend/src/environments/environment.prod.ts`.

## API

| Method | Path | Who |
|---|---|---|
| GET / PATCH | `/api/me` | Signed in |
| GET | `/api/reports?minLat&maxLat&minLng&maxLng&days&verifiedOnly`, `/api/reports/recent`, `/api/reports/mine` | Signed in |
| POST / DELETE | `/api/reports`, `/api/reports/{id}` | Signed in (delete: own pending, or moderator) |
| GET / PATCH | `/api/reports/pending`, `/api/reports/{id}/status` | Moderator |
| GET | `/api/hotspots`, `/api/stats` | Signed in |
| POST | `/api/hotspots/regenerate` | Moderator |
| GET / PATCH | `/api/admin/users`, `/api/admin/users/{id}/role` | Admin |
| GET | `/api/friends` | Signed in |
| POST | `/api/friends/requests` `{code}`, `/api/friends/requests/{id}/accept` | Signed in |
| DELETE | `/api/friends/{id}` | Signed in |
| POST / DELETE | `/api/location/share` `{minutes: 60\|480\|null, friendIds}` | Signed in |
| POST | `/api/location` `{latitude, longitude, accuracyM}` | While sharing |
| GET | `/api/live` (sharing state, friends' positions, friends' alerts) | Signed in |
| POST | `/api/panic`, `/api/panic/{id}/resolve` | Signed in |
| GET | `/api/panic/{id}` | Owner or their friends |
| GET | `/api/push/public-key` | Public |
| POST | `/api/push/subscribe`, `/api/push/unsubscribe` | Signed in |

## Capacity and resource use

Designed to serve **1,000+ concurrent users on one Render Starter API instance** (512 MB):

- **Java 21 virtual threads** for requests and WebSockets, instead of a fixed thread pool. No `synchronized` around blocking I/O, so virtual threads are never pinned.
- **Lean JVM:** serial GC, capped metaspace, code cache and thread stacks, and exit on out-of-memory (Render restarts it).
- **Shared read cache** for stats, recent reports and hotspots, cleared by the same commits that emit real-time events. A change costs one query, not one per user.
- **Event jitter:** broadcast events reach apps with 0–1.5 s of random delay, spreading re-fetches out.
- **Small per-socket buffers** and **HikariCP pool of 10**; JSON responses are gzip-compressed.
- **No nginx:** Render's edge already terminates TLS, compresses, serves HTTP/2 and hosts the static web app on a CDN. An extra proxy would add memory and latency without adding capacity.

Verify on your deployment with `docs/loadtest/crimespot-1000.js` (k6). Scaling past one instance needs a shared event bus (e.g. Redis pub/sub) for WebSockets; see `docs/FLUTTER_PLAN.md`, section 8.

## Hotspots (machine learning)

Hotspots are found with **DBSCAN** (density-based clustering; ε = 250 m, minimum 3 reports) over the last 30 days of non-rejected reports, recalculated hourly. Unlike a grid, clusters follow streets and areas of any shape. Each hotspot gets:

- **Intensity:** sum of report weights (severity × recency with a ~14-day decay × 0.6 if unverified), scaled 0–1.
- **Peak hours:** the 4-hour window (SAST) with most incidents, if it holds at least half.
- **Trend:** incidents per day in the last 7 days vs the 23 before (rising above 1.5×, falling below 0.5×).

## Local news

`GET /api/news?lat=&lng=` returns crime headlines for the user's town:

1. **Town:** OpenStreetMap Nominatim reverse geocoding, from a position rounded to ~5 km (cached 7 days, ≤1 request/s).
2. **Headlines:** GDELT DOC 2.0 API (free, no key, ≤1 request per 5 s), falling back to Google News RSS. Cached 30 minutes per town, so 1,000 users in one city cost ~1 upstream call per half hour.

Only headline, source, date and link are kept. Twitter/X isn't used: its free tier can't read posts.

## Mobile app

See [docs/FLUTTER_PLAN.md](docs/FLUTTER_PLAN.md) for the Flutter build and store launch plan.

## Deploy

`render.yaml` describes all three services. Every push to `main` redeploys.
