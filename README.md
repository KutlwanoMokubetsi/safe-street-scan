# CrimeSpot

Community crime reporting for South African neighbourhoods. People report incidents on a map, moderators verify them, and the system detects hotspots where incidents cluster.

**Stack:** Angular 20 · Spring Boot 3.3 (Java 21) · PostgreSQL 16

## Features

- Sign up / sign in (JWT, BCrypt passwords)
- Report an incident: drop a pin on the map (or use GPS), choose a type, describe it, set the time
- Live map of reports in the visible area, filterable by period, type and verified status
- Hotspot detection: reports are grouped into ~500 m cells; 3+ reports in 30 days becomes a hotspot. Score weights violent crime higher, recent incidents higher, and unverified reports lower. Recalculated hourly and on demand
- Overview with weekly stats, latest reports and ranked hotspots
- My reports: track review status, delete pending reports
- Moderation queue (moderators/admins): verify or reject
- Admin: change user roles
- Privacy (POPIA): reporters are never shown to other users; the API only returns whether a report is yours
- Abuse limits: 10 reports per user per hour; incidents must be within the past year

## Run locally

Prerequisites: Java 21, Maven 3.9+, Node 20+, Docker (for Postgres).

```bash
# 1. Database
docker compose up -d

# 2. API (http://localhost:8080)
cd backend
ADMIN_EMAIL=you@example.com ADMIN_PASSWORD=change-me-now mvn spring-boot:run

# 3. Web app (http://localhost:4200), proxies /api to the API
cd frontend
npm install
npm start
```

Flyway creates the tables on first start. Sign in with the admin account to reach the **Review** page.

Run tests: `cd backend && mvn test`

## Configuration (API environment variables)

| Variable | Default | Notes |
|---|---|---|
| `DATABASE_URL` | `jdbc:postgresql://localhost:5432/crimespot` | Must be a **JDBC** URL. For Neon: `jdbc:postgresql://<host>/<db>?sslmode=require` |
| `DATABASE_USERNAME` / `DATABASE_PASSWORD` | `crimespot` | |
| `JWT_SECRET` | dev value | **Set a random 32+ character value in production** |
| `JWT_EXPIRY_MINUTES` | `1440` | |
| `CORS_ALLOWED_ORIGINS` | `http://localhost:4200` | Comma-separated |
| `ADMIN_EMAIL` / `ADMIN_PASSWORD` | – | First admin, created on startup if missing |

Frontend production API URL: `frontend/src/environments/environment.prod.ts`.

## API

| Method | Path | Who |
|---|---|---|
| POST | `/api/auth/register`, `/api/auth/login` | Public |
| GET | `/api/auth/me` | Signed in |
| GET | `/api/reports?minLat&maxLat&minLng&maxLng&days&verifiedOnly` | Signed in |
| GET | `/api/reports/recent`, `/api/reports/mine` | Signed in |
| POST | `/api/reports` | Signed in |
| DELETE | `/api/reports/{id}` | Owner (pending only) or moderator |
| GET | `/api/reports/pending` | Moderator |
| PATCH | `/api/reports/{id}/status` | Moderator |
| GET | `/api/hotspots`, `/api/stats` | Signed in |
| POST | `/api/hotspots/regenerate` | Moderator |
| GET / PATCH | `/api/admin/users`, `/api/admin/users/{id}/role` | Admin |

## Deploy

`render.yaml` defines the API (Docker) and the static Angular site. Use Neon or Render Postgres for the database and set the env vars above.
