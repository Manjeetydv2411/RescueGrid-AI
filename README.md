# RescueGrid AI

An emergency and disaster response coordination platform. The web app is a
role-aware operations dashboard for dispatching responders, tracking incidents
on a live map, and managing resource inventory.

The repository contains three services:

| Directory | Stack | Default port | Purpose |
|-----------|-------|--------------|---------|
| `web/` | React 18 + TypeScript + Vite | 5173 | Operations dashboard (the app) |
| `backend/` | Express 4 + TypeScript + MongoDB | 4000 | REST API, Socket.IO gateway, JWT auth |
| `backend/ai-service/` | Python + FastAPI | 8001 | AI-assisted incident intelligence |

---

## Quick start

Three terminals, or one shell with `&`.

### 1. Prerequisites

- **Node.js 20+** and npm
- **MongoDB 6+** running locally (or a reachable `MONGODB_URI`)
- **Python 3.10+** — only needed for the AI service, which is optional

### 2. Install dependencies

```bash
# API + realtime server
cd backend && npm install

# Dashboard
cd ../web && npm install
```

### 3. Configure the environment

```bash
cd backend
cp .env.example .env
```

Edit `backend/.env` if your setup differs from the defaults:

```env
NODE_ENV=development
PORT=4000
MONGODB_URI=mongodb://localhost:27017/rescuegrid
JWT_SECRET=your-super-secret-jwt-key-change-in-production
JWT_EXPIRES_IN=15m
AI_SERVICE_URL=http://localhost:8001
```

The dashboard reads its configuration from `web/.env` (optional — the
defaults already point at a local backend). Copy `web/.env.example` to
`web/.env` to create it:

```env
VITE_API_URL=http://localhost:4000
VITE_SOCKET_URL=http://localhost:4000
```

| Variable | Where | Default | Purpose |
|----------|-------|---------|---------|
| `PORT` | `backend/.env` | `4000` | API and Socket.IO port |
| `MONGODB_URI` | `backend/.env` | `mongodb://localhost:27017/rescuegrid` | Database connection string |
| `JWT_SECRET` | `backend/.env` | dev placeholder | Token signing key — **change this** |
| `JWT_EXPIRES_IN` | `backend/.env` | `15m` | Access token lifetime |
| `AI_SERVICE_URL` | `backend/.env` | `http://localhost:8001` | AI service base URL |
| `VITE_API_URL` | `web/.env` | `http://localhost:4000` | REST base URL used by the browser |
| `VITE_SOCKET_URL` | `web/.env` | falls back to `VITE_API_URL` | Socket.IO origin |

> `VITE_*` variables are inlined at build time. Restart `npm run dev` in
> `web/` after changing them.

### 4. Start the services

```bash
# Terminal 1 — API + Socket.IO on :4000
cd backend && npm run dev

# Terminal 2 — dashboard on :5173
cd web && npm run dev

# Terminal 3 (optional) — AI service on :8001
cd backend/ai-service
python3 -m venv venv && source venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8001
```

Open **http://localhost:5173**.

The dashboard works without the AI service — the AI panels report that the
service is unavailable (HTTP 503) rather than showing a placeholder result.
Everything else is independent of it.

### 5. Load demo data (optional)

```bash
cd backend && npm run seed:demo
```

This creates a small, entirely **fictional** dataset: six users, six incidents,
six resources, two dispatches, three notifications, and one audit entry. Every
record is prefixed `[DEMO]` or tagged `fictional-demo-data`, and the account
names carry a `(fictional)` suffix. The seed is destructive by default (it
clears incidents, resources, assignments, notifications, and audit logs first);
pass `--keep` to leave existing records alone.

The `.invalid` domain on the seeded email addresses is reserved by RFC 2606 and
can never resolve, so demo accounts cannot accidentally receive mail.

Sign in with any of:

| Role | Email | Password |
|------|-------|----------|
| ADMIN | `admin@demo.rescuegrid.invalid` | `RescueGrid2026` |
| COORDINATOR | `coordinator@demo.rescuegrid.invalid` | `RescueGrid2026` |
| RESPONDER | `responder1@demo.rescuegrid.invalid` | `RescueGrid2026` |
| VIEWER | `viewer@demo.rescuegrid.invalid` | `RescueGrid2026` |

To create a real account instead, use **Register** in the app. Public
registration always produces a `VIEWER` account — privileged roles are granted
by an administrator through the User Management screen. For a non-demo
installation, create the first administrator securely from `backend/` with:

```bash
npm run bootstrap:admin
```

The command prompts for the administrator's name, email, and password, refuses
to run if an administrator already exists, and never stores a plaintext
password. See `backend/README.md` for complete provisioning and sign-in steps.

---

## Running the two apps together

The dashboard talks to the backend over plain HTTP and WebSocket on port 4000.
Two things must line up:

1. **CORS.** The backend allows the dashboard's origin. In development the
   backend's CORS configuration permits `http://localhost:5173`; if you serve
   the built app from a different origin, set `CORS_ORIGIN` in `backend/.env`
   to that origin.
2. **Socket.IO origin.** The socket client connects to `VITE_SOCKET_URL`
   (default `http://localhost:4000`). If the API sits behind a proxy, point
   this at the proxy's public URL.

`web/vite.config.ts` also defines a dev proxy for `/api` and `/socket.io` → `:4000`,
so a relative `VITE_API_URL` (`/api/v1`) works if you prefer to proxy rather
than call the backend cross-origin.

### Production build

```bash
cd backend && npm run build && npm start   # serves the API on :4000
cd web && npm run build                    # static assets in web/dist
```

Serve `web/dist` from any static host or CDN, with `VITE_API_URL` and
`VITE_SOCKET_URL` set at build time to the public API URL.

---

## Testing

```bash
# Dashboard unit tests (Vitest + Testing Library)
cd web && npm test

# API tests (Vitest + supertest) — requires a reachable MongoDB
cd backend && npm test

# AI service tests
cd backend/ai-service && pytest tests/
```

The backend suite connects to `MONGODB_URI`; start MongoDB before running it.

---

## What the dashboard does

| Route | Page | Notes |
|-------|------|-------|
| `/login`, `/register` | Authentication | Register creates a `VIEWER` account. |
| `/dashboard` | Overview | Counts come from `GET /api/v1/stats`, which aggregates over the whole collection — no page-limited sampling. |
| `/map` | Live map | Leaflet + OpenStreetMap tiles; markers coloured by severity. A live event re-reads the record and only keeps it if it still matches the active filters. |
| `/incidents` | Incident list | Filter, search, sort, and paginate; all filter state lives in the URL. A page number that outlives its results is corrected back into range rather than reported as an empty result. |
| `/incidents/new`, `/incidents/:id/edit` | Create / edit | The status dropdown only offers transitions the server accepts. |
| `/incidents/:id` | Incident detail | Status timeline, dispatch, and AI assistance. |
| `/resources` | Resource inventory | Availability changes are restricted to `ADMIN`/`COORDINATOR`. |
| `/assignments` | Responder assignments | Responders may accept or decline their own pending dispatches. |
| `/notifications` | Notifications | Unread filter, mark read, mark all read. |
| `/admin/users` | User management | `ADMIN` only. |
| `/admin/audit` | Audit trail | `ADMIN` only. |

### Real-time updates

The dashboard subscribes to Socket.IO events (`incident:created`,
`incident:status-changed`, `resource:status-changed`, `assignment:*`,
`notification:*`). The event payload is a *summary*, so the client re-reads the
authoritative record from the API and merges it into the query cache rather
than trusting the event body. Records updated that way are marked "Live" in the
map's side list.

The socket connects with the session's bearer token, so it opens and closes
with the login state. The header shows a Live/Offline indicator.

Incident, resource, and assignment events go to every signed-in socket, not
only to coordinators: the incident list, the live map, and the resource
inventory are served to every role, so the events that change them have to
reach every role. The payload is a summary of the same record the list already
shows, so this widens the delivery, not what a client may read. A socket that
joins one incident's room additionally receives that incident's events only —
and a closed incident is refused to `VIEWER`, on both the room join and the
missed-updates request, so the two cannot drift apart.

Notification events are addressed to one user (`notification:new` when something
is raised for them, `notification:read` when it is read — in this tab or
another) so the header's unread badge and the notifications list stay current.


### Authorization

Role checks are enforced on the server; the client only mirrors them so the UI
does not offer actions that would be rejected.

- `VIEWER` — read-only. May report a new incident, but may not edit one.
- `RESPONDER` — may report incidents and accept or decline their own pending
  assignments. May not edit incidents or change a dispatch's status.
- `COORDINATOR` — may create and edit incidents, dispatch responders, and
  change resource availability.
- `ADMIN` — everything a coordinator can do, plus user management and the
  audit trail.

A hidden button is not an authorization boundary. The API is the authority.
`backend/tests/authorization.test.ts` exercises the role rules directly against
the API, so the guarantees are checked rather than assumed.

Every route that returns operational data requires a session, including the
incident, resource, and assignment *lists* — an assignment carries the
responder's phone number, so a dispatch list is scoped to the caller's role:
coordinators see every dispatch, and anyone else sees only their own.

---

## Accessibility and responsiveness

- Semantic landmarks, a skip link, and labelled form controls throughout.
- `aria-live` regions for loading and error states; `role="alert"` on errors.
- Focus trapping and `Escape`-to-close in modals.
- All interactive controls are reachable and operable by keyboard, with visible
  focus rings.
- Severity and status are always presented through one shared set of labels
  and colours (`web/src/utils/domain.ts`), so the map, the tables, and the
  badges never disagree.
- Layouts reflow for narrow viewports; the sidebar becomes a drawer.

---

## Project layout

```
RescueGrid-AI/
├── web/                        # React dashboard
│   ├── src/
│   │   ├── components/common/  # Button, Card, Input, Modal, QueryState, …
│   │   ├── components/layout/  # Header, Sidebar, Layout
│   │   ├── hooks/              # useAuth, useSocket, useClampPage
│   │   ├── pages/              # One directory per feature area
│   │   ├── services/api.ts     # Axios client + typed API surface
│   │   ├── types/api.ts        # API contract types
│   │   └── utils/domain.ts     # Severity/status labels, colours, transitions
│   └── tests/                  # Vitest + Testing Library suites
└── backend/
    ├── src/
    │   ├── config/             # Environment, database
    │   ├── controllers/        # Request handlers
    │   ├── middleware/         # Auth, error handling, response envelope
    │   ├── models/             # Mongoose schemas
    │   ├── routes/             # Express routers
    │   ├── scripts/            # Demo data seeder
    │   ├── services/           # Business logic
    │   └── socket/             # Socket.IO setup
    └── ai-service/             # Python FastAPI AI service
```

## Further reading

- `backend/README.md` — full API reference, security notes, and how to create
  the first administrator.
- `backend/ai-service/README.md` — AI service design, endpoints, and the
  baseline provider's stated limitations.

## License

ISC
