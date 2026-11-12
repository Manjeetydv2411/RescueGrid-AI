# RescueGrid AI - Backend

AI-powered Emergency and Disaster Response Coordination Platform

## Features

- Secure user authentication and authorization
- Role-based access control (ADMIN, COORDINATOR, RESPONDER, VIEWER)
- Incident management with geospatial support
- Resource inventory and tracking
- Real-time updates via Socket.IO
- **AI-assisted incident intelligence** (category suggestion, priority scoring, missing info detection)

## Technology Stack

### Node.js Backend
- Node.js 20+ with TypeScript
- Express.js
- MongoDB with Mongoose
- JWT authentication
- bcrypt for password hashing
- Zod for input validation
- Socket.IO for real-time updates

### AI Service (Python)
- FastAPI
- Pydantic for validation
- Rule-based baseline (no external dependencies)
- Pluggable provider interface (ready for OpenAI/Anthropic)

See [`ai-service/README.md`](./ai-service/README.md) for AI service documentation.

## Getting Started

### Prerequisites

- Node.js 20+
- MongoDB 6+
- npm or yarn

### Installation

1. Clone the repository:

```bash
cd RescueGrid-AI/backend
```

2. Install dependencies:

```bash
npm install
```

3. Set up environment variables:

```bash
cp .env.example .env
```

Edit `.env` with your configuration:

```env
NODE_ENV=development
PORT=4000
MONGODB_URI=mongodb://localhost:27017/rescuegrid
JWT_SECRET=your-super-secret-jwt-key-change-in-production
JWT_EXPIRES_IN=15m
```

### Local MongoDB Setup

**macOS (Homebrew):**
```bash
brew install mongodb-community
brew services start mongodb-community
```

**Ubuntu/Debian:**
```bash
sudo apt-get install -y mongodb-org
sudo systemctl start mongod
```

**Docker:**
```bash
docker run -d -p 27017:27017 --name mongodb mongodb:latest
```

4. Start the development server:

```bash
npm run dev
```

The API will be available at `http://localhost:4000`

## Available Scripts

| Script | Description |
|--------|-------------|
| `dev` | Start development server with hot reload |
| `build` | Compile TypeScript to JavaScript |
| `start` | Run production server |
| `test` | Run tests |
| `test:watch` | Run tests in watch mode |
| `test:coverage` | Run tests with coverage report |

## API Endpoints

### Health Check

```
GET /api/v1/health
```

Response:
```json
{
  "success": true,
  "message": "Success",
  "data": {
    "status": "healthy",
    "timestamp": "2024-01-01T00:00:00.000Z",
    "environment": "development"
  }
}
```

### Readiness Check

```
GET /api/v1/ready
```

Response (when connected):
```json
{
  "success": true,
  "message": "Success",
  "data": {
    "status": "ready",
    "message": "Database is connected and ready",
    "database": { "connected": true, "timestamp": "..." },
    "timestamp": "..."
  }
}
```

### Authentication

All roles use the same login endpoint and form. The server identifies the
account from the email and password; clients must not send or trust a
caller-selected role.

```
POST /api/v1/auth/register       # public; always creates VIEWER
POST /api/v1/auth/login          # ADMIN, COORDINATOR, RESPONDER, VIEWER
GET  /api/v1/auth/me
POST /api/v1/auth/logout
POST /api/v1/auth/refresh
```

Public registration never accepts a privileged role. Only an authenticated
administrator may provision an account or assign a role:

```
GET   /api/v1/admin/users
POST  /api/v1/admin/users         # name, email, password, role, optional phone
PATCH /api/v1/admin/users/:id/role
```

The account-creation endpoint requires a password of at least 12 characters,
hashes it with bcrypt, returns no password material, and records an audit entry.
Every admin route is protected by backend `authenticate` and `authorize("ADMIN")`
middleware; the frontend route guard is only a user-interface convenience.

## Incident Management API

All incident, resource, and assignment routes require a session:

```
Authorization: Bearer <access_token>
```

An incident record carries the reporter's name and email, a resource record
carries the owning unit's contact details, and an assignment carries the
responder's phone number — so none of these are readable anonymously.

### List Incidents

```
GET /api/v1/incidents
```

Query Parameters:
- `page` (default: 1) - Page number
- `limit` (default: 20, max: 100) - Items per page
- `status` - Filter by status (REPORTED, VERIFIED, ACTIVE, RESOLVED, CLOSED)
- `severity` - Filter by severity (LOW, MEDIUM, HIGH, CRITICAL)
- `category` - Filter by category (FLOOD, FIRE, EARTHQUAKE, LANDSLIDE, MEDICAL, OTHER)
- `search` - Search in title, description, address
- `near` - Coordinates as "lng,lat" for nearby search

Response:
```json
{
  "success": true,
  "message": "Success",
  "data": {
    "data": [...],
    "pagination": {
      "page": 1,
      "limit": 20,
      "total": 100,
      "totalPages": 5,
      "hasMore": true
    }
  }
}
```

### Get Single Incident

```
GET /api/v1/incidents/:id
```

### Create Incident

```
POST /api/v1/incidents
Authorization: Bearer <token>
```

Request Body:
```json
{
  "title": "Flood in downtown",
  "description": "Severe flooding reported on Main Street",
  "severity": "HIGH",
  "category": "FLOOD",
  "status": "REPORTED",
  "location": {
    "type": "Point",
    "coordinates": [-122.4194, 37.7749]
  },
  "address": "123 Main Street, San Francisco, CA",
  "tags": ["flood", "rescue"]
}
```

Response:
```json
{
  "success": true,
  "message": "Created",
  "data": {
    "id": "670a...",
    "title": "Flood in downtown",
    "description": "Severe flooding reported on Main Street",
    "severity": "HIGH",
    "category": "FLOOD",
    "status": "REPORTED",
    "priority": 0,
    "location": {...},
    "address": "123 Main Street...",
    "reportedBy": {...},
    "assignedTo": null,
    "tags": ["flood", "rescue"],
    "version": 1,
    "auditLog": [...],
    "createdAt": "2024-01-01T00:00:00.000Z",
    "updatedAt": "2024-01-01T00:00:00.000Z"
  }
}
```

### Update Incident

```
PUT /api/v1/incidents/:id
Authorization: Bearer <token>
```

Requires the `ADMIN` or `COORDINATOR` role. Other roles receive `403`.

Request Body (all fields are optional):
```json
{
  "title": "Updated flood report",
  "description": "New information about the flood",
  "severity": "CRITICAL",
  "category": "FLOOD",
  "status": "ACTIVE",
  "assignedTo": "user_id_here",
  "address": "Updated address",
  "tags": ["flood", "urgent"]
}
```

### Delete Incident

```
DELETE /api/v1/incidents/:id
Authorization: Bearer <token>
```

Note: Only admins, coordinators, or the incident reporter can delete.

### Get Nearby Incidents

```
GET /api/v1/incidents/nearby?lng=-122.4194&lat=37.7749&maxDistance=50000&limit=10
```

Parameters:
- `lng` - Longitude (required)
- `lat` - Latitude (required)
- `maxDistance` - Max distance in meters (default: 50000 = 50km)
- `limit` - Max results (default: 10)

### Assign Incident

```
POST /api/v1/incidents/:id/assign
Authorization: Bearer <token>
```

Request Body:
```json
{
  "assignedTo": "coordinator_user_id"
}
```

### Unassign Incident

```
POST /api/v1/incidents/:id/unassign
Authorization: Bearer <token>
```

## Project Structure

```
src/
├── config/           # Configuration files (database, environment)
├── middleware/       # Express middleware
├── utils/            # Utility functions (logger, validation, errors)
├── types/            # TypeScript type definitions
├── models/           # MongoDB Mongoose models
├── services/         # Business logic
├── controllers/      # Request handlers
├── routes/           # API routes
└── tests/            # Test files
```

## Security Configuration

### Environment Variables

| Variable | Description | Example |
|----------|-------------|---------|
| `NODE_ENV` | Environment mode | `development`, `production` |
| `PORT` | Server port | `4000` |
| `MONGODB_URI` | MongoDB connection string | `mongodb://localhost:27017/rescuegrid` |
| `JWT_SECRET` | Secret key for JWT signing | Generate with `openssl rand -hex 64` |
| `JWT_EXPIRES_IN` | Access token expiration | `15m`, `1h` |
| `COOKIE_SAME_SITE` | Cookie security setting | `lax`, `strict`, `none` |
| `CORS_ORIGIN` | Allowed origins (production) | `https://your-app.com` |

### Security Features

- **Password Hashing**: bcrypt with 12 salt rounds
- **JWT Authentication**: Short-lived access tokens (default 15 min)
- **Role-Based Access Control**: ADMIN, COORDINATOR, RESPONDER, VIEWER
- **Input Validation**: Zod schemas for all user inputs
- **Security Headers**: Helmet.js for common security headers
- **CORS Protection**: Configurable allowed origins
- **Duplicate Prevention**: Email uniqueness enforced

### Error Status Codes

The status code tells the client what kind of failure it is, which matters
because the dashboard reacts differently to each:

| Status | Meaning | Typical cause |
|--------|---------|---------------|
| `400` | The request was malformed | Zod validation failed, invalid status transition |
| `401` | Not authenticated | Missing, invalid, or expired token; a refresh token used as an access token |
| `403` | Authenticated but not permitted | The role may not perform this action |
| `404` | No such record | Unknown incident, resource, assignment, or user id |
| `500` | Server fault | Anything unhandled |

`401` is reserved for "you are not signed in". A role failure is `403`, so a
client that refreshes its token on `401` does not needlessly log the user out
when they simply lack permission.

### Role Changes and Token Freshness

The access token carries a role claim for client convenience, but backend
`authenticate` now re-reads the account from MongoDB before attaching the
request user. Role changes and deleted accounts therefore take effect on the
next request, including admin-only endpoints. Refresh tokens also read the
current role from the database before issuing a new access token.

### OWASP Compliance

- [x] Passwords are never stored in plaintext
- [x] Password hashes are never exposed in responses
- [x] Generic error messages to prevent enumeration
- [x] Rate limiting (can be added with express-rate-limit)
- [x] JWT tokens with expiration
- [x] Input validation on all endpoints
- [x] Authentication required on every route that returns operational data
- [x] Role-based authorization on all protected routes
- [x] Socket subscriptions authorized on the same rules as the REST reads
- [x] Dispatch lists scoped to the caller's own role
- [x] The server refuses to start in production with the built-in JWT secret

### Creating the First Administrator

Use the one-shot bootstrap command from `backend/`. It refuses to run when
an administrator already exists, does not hardcode credentials, hashes the
password, and preserves all existing users and operational data.

1. Ensure MongoDB is running and `backend/.env` points to the intended database.
2. From the backend directory, run either the environment-variable form:

```bash
ADMIN_NAME="Operations Admin" \
ADMIN_EMAIL="admin@your-agency.example" \
ADMIN_PASSWORD="use-a-unique-password-of-at-least-12-chars" \
npm run bootstrap:admin
```

or the interactive form, which keeps the password out of shell history:

```bash
npm run bootstrap:admin
```

The command prompts for the administrator name, email, and password when the
corresponding variables are absent. Never commit the values or put them in
`.env` files that are checked into source control. After the first admin exists,
create all additional ADMIN, COORDINATOR, RESPONDER, and VIEWER accounts from
**Admin → Operator Roster → Create operator account**.

### Sign-in and role redirection

Open the dashboard's single `/login` form and enter the email/password for any
account. Do not select a role: the backend authenticates the credentials and
returns the stored role. After successful login the dashboard redirects to:

| Account role | Initial destination |
|---|---|
| ADMIN | `/admin/users` |
| COORDINATOR | `/dashboard` |
| RESPONDER | `/assignments` |
| VIEWER | `/dashboard` |

An existing intended destination is preserved when a protected route sent the
user to login. Role checks remain enforced by the API, including if someone
manually changes the browser URL or calls the API directly.

## Development

### Running Tests

```bash
npm test
```

### Build for Production

```bash
npm run build
npm start
```

## License

ISC
