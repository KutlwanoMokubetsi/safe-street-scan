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

## Deploy

`render.yaml` describes all three services. Every push to `main` redeploys.
