# Oracle JSON Technologies Developer Workshop

A self-contained, containerized developer workshop that teaches Oracle's full JSON technology stack through hands-on labs. Runs entirely on locally hosted containers — no cloud accounts, no external dependencies. An instructor starts the environment, developers connect via browser, create a workspace, and start writing queries immediately.

**Duration:** 90 minutes | **Delivery:** Instructor-led, browser-based | **Audience:** Developers, data engineers, architects

> _"You don't need five databases. You need one database that speaks five languages."_

## What Developers Will Learn

- **JSON Collection Tables** — Use Oracle as a pure document database
- **JSON Duality Views** — Bidirectional document-relational mapping with full ACID
- **Single-Table Design** — The NoSQL pattern (invented for DynamoDB) made more powerful with SQL joins and multi-value indexes
- **Multi-Value Indexes** — Index into JSON arrays at B-tree speed (no MongoDB parallel-arrays limitation)
- **Hybrid JSON-Relational Queries** — Combine SQL joins with document flexibility in a single statement
- **MongoDB API** — Connect via `mongosh` to Oracle through the MongoDB wire protocol
- **JavaScript (node-oracledb)** — Full programmatic access in thin mode (no Oracle Client needed)
- **JSON_TRANSFORM, JSON_TABLE, dot notation** — Surgical document manipulation

## Architecture

Two Docker containers, fully self-contained:

```
┌──────────────────┐  ┌──────────────────────────────────────┐
│  Workshop App    │  │  Oracle 26ai Free + ORDS             │
│  (Node/Express)  │  │  (Custom image from gvenzl base)     │
│                  │  │                                      │
│  - Landing page  │  │  Oracle Database 26ai                │
│  - Registration  │  │  + ORDS (REST, MongoDB API,          │
│  - Lab modules   │  │    Database Actions)                 │
│  - Query editor  │  │                                      │
│  - Admin panel   │  │  Ports: 1521, 8181, 27017            │
│                  │  │                                      │
│  Port: 3000      │  │  PDB: FREEPDB1                       │
└────────┬─────────┘  └──────────────────────────────────────┘
         │  oracledb (thin mode)       ▲
         └─────────────────────────────┘
```

**Why this architecture:**

- `docker compose build` produces everything — zero runtime downloads
- No `--cap-add SYS_ADMIN` or `/dev/fuse` required (unlike ADB-Free)
- 2 CPU / 4GB RAM minimum (instructor laptop friendly)
- Fully offline deployment via `scripts/bundle.sh` image tarball

## Quick Start

### Prerequisites

- Docker Desktop (4.0+) with Docker Compose
- 4GB+ RAM available for containers
- Node.js 22 LTS (for development only — not needed to run the workshop)

### Run the Workshop

```bash
git clone https://github.com/rhoulihan/oracle-json-workshop.git
cd oracle-json-workshop
docker compose build    # ~3 min first time (downloads Oracle 26ai + ORDS)
docker compose up       # Starts Oracle + ORDS + Workshop App
```

Then open `http://localhost:3000` in a browser.

### Offline / Air-Gapped Deployment

```bash
# On a machine with internet:
docker compose build
./scripts/bundle.sh     # Creates workshop-images.tar.gz (~4-5GB)

# On the air-gapped instructor laptop:
docker load < workshop-images.tar.gz
docker compose up
```

## Workshop Modules (90 Minutes)

| Time      | Module                  | Focus                                                  |
| --------- | ----------------------- | ------------------------------------------------------ |
| 0:00-0:05 | Setup                   | Connect, create workspace                              |
| 0:05-0:10 | M0: The Big Picture     | Architecture overview, data model                      |
| 0:10-0:25 | M1: JSON Collections    | Insert, query, JSON_TRANSFORM, search indexes          |
| 0:25-0:45 | M2: Duality Views       | Read/write through documents, verify relational tables |
| 0:45-1:05 | M3: Single-Table Design | pk/sk patterns, multi-value indexes, cross-entity SQL  |
| 1:05-1:20 | M4: Hybrid Queries      | The 90/10 problem, JSON_TABLE, cross-model joins       |
| 1:20-1:27 | M5: Multi-Protocol      | mongosh to Oracle, node-oracledb, SODA                 |
| 1:27-1:30 | Wrap-up                 | Summary, next steps                                    |

## Data Model

Financial services advisory platform — advisors, clients, accounts, holdings, transactions. The same domain used in real-world benchmarks demonstrating Oracle's converged architecture.

**Relational tables:** advisors, clients, accounts, holdings, advisor_client_map, transactions
**JSON collections:** client_interactions (interaction log), advisory_entities (single-table design)
**Duality views:** client_portfolio_dv, advisor_book_dv, transaction_feed_dv

### Sample Data

| Table/Collection    | Rows  | Notes                                                                              |
| ------------------- | ----- | ---------------------------------------------------------------------------------- |
| advisors            | 20    | 4 regions                                                                          |
| clients             | 200   | 3 risk profiles                                                                    |
| accounts            | 500   | 2-3 per client                                                                     |
| holdings            | 2,000 | 4 per account                                                                      |
| advisor_client_map  | 300   | primary/secondary/referral                                                         |
| transactions        | 5,000 | 60-day window                                                                      |
| client_interactions | 500   | meetings, calls, emails with action items                                          |
| advisory_entities   | 3,000 | Single-table: advisors, clients, holdings (with tags/sectors arrays), transactions |

## Oracle JSON Technologies Covered

| Technology             | Module | Description                               |
| ---------------------- | ------ | ----------------------------------------- |
| JSON Collection Tables | M1     | Oracle as a document database             |
| OSON binary format     | M0     | O(1) field access (vs BSON O(n))          |
| Dot notation           | M1-M3  | `ci.data.client_id.number()`              |
| JSON_TRANSFORM         | M1, M4 | SET, APPEND, REMOVE, NESTED PATH, KEEP    |
| JSON_TABLE             | M3, M4 | Shred arrays into relational rows         |
| JSON Duality Views     | M2     | Bidirectional document-relational mapping |
| UNNEST / NOCHECK       | M2     | Flatten nested objects, skip etag checks  |
| Multi-Value Indexes    | M3     | `CREATE MULTIVALUE INDEX` on JSON arrays  |
| Single-Table Design    | M3     | pk/sk/gsi patterns with SQL superpowers   |
| MongoDB API (ORDS)     | M5     | `mongosh` to Oracle via wire protocol     |
| node-oracledb          | M5     | JavaScript thin driver, JSON type binding |
| JSON Search Index      | M1     | Full-text search over JSON documents      |
| Hybrid Queries         | M4     | SQL joins + JSON in single statement      |

## Development

### Setup

```bash
npm install
cp .env.example .env    # Edit as needed
```

### Testing (Strict TDD)

```bash
# Unit tests (no database required)
npm run test:unit

# Integration tests (requires running Oracle container)
docker compose -f docker-compose.test.yml build
docker compose -f docker-compose.test.yml up -d
# Wait ~60s for Oracle + ORDS to start
DB_USER=WORKSHOP_ADMIN DB_PASSWORD=TestApp2026 DB_CONNECT_STRING=localhost:1521/FREEPDB1 npm run test:integration
docker compose -f docker-compose.test.yml down

# All tests
npm test
```

### Code Quality

```bash
npm run lint          # ESLint
npm run format        # Prettier
npm run format:check  # Verify formatting
```

### Pre-Commit Hooks

- **pre-commit:** lint-staged (ESLint + Prettier on staged files)
- **pre-push:** full unit test suite

### Project Structure

```
oracle-json-workshop/
├── docker-compose.yml          # Full stack: Oracle+ORDS + App
├── Dockerfile                  # Workshop web app (Node 22)
├── Dockerfile.oracle           # Custom Oracle 26ai + ORDS image
├── scripts/
│   ├── entrypoint.sh           # Starts Oracle + ORDS in one container
│   ├── install-ords.sh         # ORDS installation (runs during build)
│   └── bundle.sh               # Save images for offline deployment
├── init/                       # Oracle init scripts (run on first startup)
│   ├── 01-create-workshop-admin.sql
│   ├── 02-create-schema.sql
│   ├── 03-create-collections.sql
│   ├── 04-create-duality-views.sql
│   ├── 05-create-indexes.sql
│   ├── 06-load-sample-data.sql
│   ├── 07-load-collection-data.sql
│   ├── 08-load-single-table-data.sql
│   ├── 09-enable-ords.sql
│   └── 10-create-clone-procedure.sql
├── src/
│   ├── index.js                 # Server entrypoint (wires services, starts HTTP)
│   ├── server.js                # Express app factory
│   ├── config.js                # Environment config + validation
│   ├── middleware/
│   │   ├── auth.js              # requireAuth + requireAdmin middleware
│   │   ├── security.js          # SQL classifier + sqlGuard middleware
│   │   └── rateLimit.js         # Token-bucket rate limiter (per-session)
│   ├── routes/
│   │   ├── auth.js              # POST /api/auth/{register,login,logout}, GET /me
│   │   ├── admin.js             # POST /api/admin/login, GET/DELETE workspaces
│   │   ├── labs.js              # GET /api/labs, POST check, GET progress
│   │   └── query.js             # POST /api/query/{sql,js,mongo}
│   ├── labs/                    # Lab module JSON content (M0-M5)
│   └── services/
│       ├── database.js          # Connection pool manager
│       ├── workspace.js         # Schema clone/teardown + findByEmail
│       ├── queryExecutor.js     # SQL execution with timeout + row limits
│       ├── jsExecutor.js        # Sandboxed JS execution (vm.createContext)
│       ├── mongoExecutor.js     # mongosh → SQL translator
│       ├── labLoader.js         # Lab module JSON loader + cache
│       ├── validator.js         # Exercise answer validation
│       └── progressService.js   # Per-user progress tracking
├── public/
│   ├── index.html               # Landing page (register/login)
│   ├── dashboard.html           # Module grid + progress
│   ├── lab.html                 # Lab exercise viewer
│   ├── editor.html              # SQL/JS/mongosh query editor
│   ├── admin.html               # Instructor dashboard
│   ├── css/workshop.css         # Oracle-branded design system
│   ├── img/oracle-logo.svg      # Oracle wordmark
│   └── js/
│       ├── api.js               # Fetch wrapper for all API endpoints
│       ├── components.js        # Shared UI components (header, cards, etc.)
│       ├── progress.js          # Progress calculation (pure functions)
│       ├── results.js           # Query result renderers (table, JSON, error)
│       ├── history.js           # Query history (localStorage, max 50)
│       ├── editor-setup.js      # Tab manager for editor
│       └── pages/               # Page controllers (index, dashboard, lab, editor, admin)
├── test/
│   ├── unit/                    # Backend unit tests (~213)
│   ├── unit/frontend/           # Frontend unit tests (~74, jsdom)
│   └── integration/             # Real Oracle required (~48)
├── docs/
│   ├── workshop-specification.md
│   └── implementation-plan.md
└── CLAUDE.md
```

## Implementation Status

All 9 phases complete. **287 unit tests (213 backend + 74 frontend) + 48 integration tests, all passing.**

| Phase       | Description                                                                     | Tests                   |
| ----------- | ------------------------------------------------------------------------------- | ----------------------- |
| **Phase 1** | Project scaffolding — npm, Express, Vitest, ESLint, Prettier, Husky, Docker, CI | 20 unit                 |
| **Phase 2** | Database init scripts, seed data, duality views, indexes, workspace cloning     | 7 unit + 48 integration |
| **Phase 3** | Query execution engine (SQL, JS, MongoDB) with security + rate limiting         | 75 unit                 |
| **Phase 4** | Authentication + workspace management API                                       | 30 unit                 |
| **Phase 5** | Lab content — 6 modules (24 exercises), answer validation, progress tracking    | 81 unit                 |
| **Phase 6** | Frontend — landing page, dashboard, lab viewer (Oracle branded)                 | 38 frontend             |
| **Phase 7** | Frontend — query editor with SQL/JS/mongosh tabs, history                       | 22 frontend             |
| **Phase 8** | Instructor dashboard — login, workspace management, progress heatmap            | 14 frontend             |
| **Phase 9** | Docker polish, README finalization, CI/CD release pipeline                      | —                       |

### Instructor Guide

- **Workshop URL:** `http://localhost:3000` — developers register and start labs
- **Admin URL:** `http://localhost:3000/admin.html` — instructor workspace management
- **Default admin password:** Set via `ADMIN_PASSWORD` env var (default: `instructor2026`)
- **Query Editor:** `http://localhost:3000/editor.html` — SQL, JavaScript, mongosh tabs

### Troubleshooting

| Issue                                        | Solution                                                                                                                    |
| -------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| Oracle container stuck on "health: starting" | Wait up to 3 minutes on first run. Oracle + ORDS + init scripts take time.                                                  |
| App container exits immediately              | Check Oracle is healthy first: `docker compose ps`. App waits for Oracle.                                                   |
| "Workspace creation failed" on register      | Verify init script 10 ran: `docker exec workshop-oracle sqlplus -s / as sysdba` → check `SYS.WORKSHOP_CLONE_SCHEMA` exists. |
| Duplicate email error on register            | Use "Reconnect" form with your existing schema name and password.                                                           |
| Stale workspaces from testing                | Use admin dashboard (`/admin.html`) → "Tear Down All" button.                                                               |
| ORDS crashing in loop                        | Rebuild Oracle image: `docker compose down -v && docker compose build oracle && docker compose up -d`                       |

## Configuration

| Variable            | Default                         | Description                   |
| ------------------- | ------------------------------- | ----------------------------- |
| `ORACLE_PASSWORD`   | `WorkshopAdmin2026`             | SYS/SYSTEM password           |
| `APP_USER_PASSWORD` | `WorkshopApp2026`               | WORKSHOP_ADMIN password       |
| `DB_USER`           | `WORKSHOP_ADMIN`                | App database user             |
| `DB_PASSWORD`       | `WorkshopApp2026`               | App database password         |
| `DB_CONNECT_STRING` | `workshop-oracle:1521/FREEPDB1` | Oracle connection             |
| `SESSION_SECRET`    | (required)                      | Express session secret        |
| `ADMIN_PASSWORD`    | `instructor2026`                | Instructor dashboard password |
| `PORT`              | `3000`                          | Workshop app port             |

## Key Technical Decisions

| Decision                           | Rationale                                                                           |
| ---------------------------------- | ----------------------------------------------------------------------------------- |
| gvenzl/oracle-free + ORDS baked in | Fully self-contained after build. No runtime internet. No `--cap-add SYS_ADMIN`.    |
| Per-user Oracle schemas            | True isolation — each developer gets their own tables, views, indexes, collections. |
| SYS-owned clone procedure          | `CREATE USER` requires elevated privileges not available through roles in PL/SQL.   |
| Vanilla frontend (no React/Vue)    | Zero build step, instant load. CodeMirror 6 is the only non-trivial dependency.     |
| Vitest over Jest                   | ESM-native, faster, built-in V8 coverage.                                           |
| CTX_DDL.SYNC_INDEX                 | JSON Search Index requires explicit sync for immediate consistency on new inserts.  |

## License

MIT

## Author

Rick Houlihan — Field CTO, Oracle
