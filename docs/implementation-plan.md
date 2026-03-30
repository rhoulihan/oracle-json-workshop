# Oracle JSON Workshop — Implementation Plan

## Container Image Decision

**Constraint:** Training environments may have limited or no internet connectivity. All containers must be pre-pulled and hosted locally on the instructor's laptop. No runtime image pulls allowed.

### Architecture: Two Containers (Fully Self-Contained)

**1. Oracle 26ai + ORDS (Custom Image)**
- **Base:** `gvenzl/oracle-free:latest-faststart` (23.26.1 = 26ai)
- **Built via:** `Dockerfile.oracle` — extends gvenzl base with ORDS installed in-container
- `-faststart` variant has pre-expanded database baked into the image — near-instant startup
- ORDS runs inside the same container as Oracle (localhost connection, zero network latency)
- Multi-platform (AMD64 + ARM64) — works on Intel and Apple Silicon instructor laptops
- No special kernel capabilities required (unlike ADB-Free which needs `--cap-add SYS_ADMIN`)
- Resource footprint: 2 CPUs, 4GB RAM minimum
- Exposes ports 1521 (SQL*Net), 8181 (ORDS/REST/Database Actions), 27017 (MongoDB API)

**2. Workshop Web App (Custom Image)**
- **Built via:** `Dockerfile` — Node.js/Express application
- Connects to Oracle container for SQL (oracledb thin mode) and MongoDB API

**Why ORDS inside the Oracle container (not separate):**
- Fully self-contained — `docker compose build` produces everything, no runtime image pulls
- One container to manage for the database stack, fewer failure modes
- ORDS connects to Oracle via localhost — no inter-container networking complexity
- Simpler offline deployment: two images in one tarball

### Offline Deployment Strategy

For fully disconnected environments, the instructor builds once (with internet) and deploys anywhere:

```bash
# Build both images (requires internet for base image + ORDS download):
docker compose build

# Save to portable tarball (~4-5GB):
docker save workshop-oracle workshop-app | gzip > workshop-images.tar.gz

# On the air-gapped instructor laptop:
docker load < workshop-images.tar.gz
docker compose up
```

**Decision:** Custom Oracle image with ORDS baked in, built from gvenzl/oracle-free base. This produces a fully self-contained workshop that runs with `docker compose up` after a single build step — no runtime internet, no separate ORDS container, no ADB-Free kernel dependencies.

---

## Development Environment & Tooling

### Runtime
- **Node.js 22 LTS** (current LTS as of March 2026)
- **npm** for package management
- **Docker / Docker Compose** for containerized Oracle + app

### Testing
- **Vitest** — test runner (fast, ESM-native, compatible with Node 22)
- **Supertest** — HTTP endpoint testing (Express integration tests)
- **Testcontainers** — spin up real Oracle containers for integration tests
- **c8** — native V8 code coverage (built into Vitest)

### Code Quality
- **ESLint** (flat config, `eslint.config.js`) with `@eslint/js` + `eslint-plugin-n`
- **Prettier** — formatting
- **lint-staged** + **husky** — pre-commit hooks

### CI/CD
- **GitHub Actions** — lint, unit test, integration test, build Docker image
- **Docker Hub / GHCR** — publish workshop image on tagged releases

---

## Pre-Commit Hooks

```
husky pre-commit → lint-staged
  ├── *.js         → eslint --fix && prettier --write
  ├── *.json       → prettier --write
  ├── *.sql        → prettier-plugin-sql (format SQL files)
  └── *.md         → prettier --write

husky pre-push → npm test (full unit + integration suite)
```

### Hook Configuration

**`.husky/pre-commit`:**
```sh
npx lint-staged
```

**`.husky/pre-push`:**
```sh
npm test
```

**`lint-staged` config in `package.json`:**
```json
{
  "lint-staged": {
    "*.{js,mjs}": ["eslint --fix", "prettier --write"],
    "*.{json,md,yml,yaml}": ["prettier --write"],
    "*.sql": ["prettier --write --plugin=prettier-plugin-sql"]
  }
}
```

---

## CI/CD Pipeline (GitHub Actions)

### `.github/workflows/ci.yml`

**Triggers:** push to `master`, pull requests

**Jobs:**

| Job | Runs On | Steps |
|-----|---------|-------|
| **lint** | ubuntu-latest | Checkout → Node 22 → npm ci → eslint → prettier --check |
| **unit-test** | ubuntu-latest | Checkout → Node 22 → npm ci → vitest run --coverage (no DB needed) |
| **integration-test** | ubuntu-latest | Checkout → Node 22 → npm ci → `docker compose -f docker-compose.test.yml up -d` (Oracle+ORDS) → Wait for health → vitest run --project integration → docker compose down |
| **build** | ubuntu-latest | Checkout → Build Docker image → Smoke test (compose up, curl health endpoint, compose down) |
| **publish** | ubuntu-latest | (on tag only) Build + push to GHCR |

**Integration test considerations:**
- The custom Oracle+ORDS image starts quickly (gvenzl faststart), but ORDS installation on first run adds ~60s. The CI job polls the composite health check (Oracle + ORDS) before running tests.
- Integration tests use a dedicated `vitest.integration.config.js` that expects `DB_CONNECT_STRING` env var.
- GitHub Actions runners have 7GB RAM — more than enough for the custom image (4GB needed).

### `.github/workflows/release.yml`

**Triggers:** tag push (`v*`)

**Jobs:**
- Build Docker image with version tag
- Push to GHCR (`ghcr.io/<owner>/oracle-json-workshop:<version>`)
- Create GitHub Release with changelog

---

## Project Structure (Final)

```
oracle-json-workshop/
├── .github/
│   └── workflows/
│       ├── ci.yml                        # Lint, test, build on every push/PR
│       └── release.yml                   # Publish on tag
├── .husky/
│   ├── pre-commit                        # lint-staged
│   └── pre-push                          # npm test
├── docker-compose.yml                    # Full stack: Oracle+ORDS + App
├── docker-compose.test.yml               # Oracle+ORDS only for integration tests
├── Dockerfile                            # Workshop web app (Node.js)
├── Dockerfile.oracle                     # Custom Oracle 26ai + ORDS image
├── .dockerignore
├── .env.example                          # Template for required env vars
├── package.json
├── eslint.config.js                      # ESLint flat config
├── .prettierrc                           # Prettier config
├── vitest.config.js                      # Unit test config
├── vitest.integration.config.js          # Integration test config (needs DB)
├── docs/
│   ├── workshop-specification.md
│   └── implementation-plan.md            # This document
├── scripts/
│   ├── entrypoint.sh                     # Oracle container: starts DB + ORDS
│   ├── install-ords.sh                   # ORDS install (runs during image build)
│   └── bundle.sh                         # Save images to tarball for offline deploy
├── init/                                 # Oracle init scripts
│   ├── 01-create-workshop-admin.sql      # Admin schema + workshop_users table
│   ├── 02-create-schema.sql              # Template schema (tables)
│   ├── 03-create-collections.sql         # JSON collections + single-table data
│   ├── 04-create-duality-views.sql       # All duality view definitions
│   ├── 05-create-indexes.sql             # Functional, multi-value, search indexes
│   ├── 06-load-sample-data.sql           # Relational seed data
│   ├── 07-load-collection-data.sql       # JSON collection seed data
│   ├── 08-load-single-table-data.sql     # Single-table design seed data
│   ├── 09-enable-ords.sql                # ORDS + MongoDB API config
│   └── 10-create-clone-procedure.sql     # PL/SQL proc to clone schema per user
├── src/
│   ├── server.js                         # Express app entry point
│   ├── config.js                         # Environment config + validation
│   ├── routes/
│   │   ├── auth.js                       # POST /api/register, POST /api/login
│   │   ├── workspace.js                  # Schema lifecycle management
│   │   ├── query.js                      # POST /api/query/sql, /js, /mongo
│   │   ├── labs.js                       # GET /api/labs/:id, POST check answers
│   │   └── admin.js                      # Instructor dashboard + bulk ops
│   ├── services/
│   │   ├── database.js                   # Connection pool manager
│   │   ├── workspace.js                  # Schema create/clone/teardown
│   │   ├── queryExecutor.js              # SQL execution with timeout + sanitization
│   │   ├── jsExecutor.js                 # Sandboxed JS execution (node-oracledb)
│   │   ├── mongoExecutor.js              # MongoDB API command proxy
│   │   └── validator.js                  # Exercise answer verification
│   ├── middleware/
│   │   ├── auth.js                       # Session-based auth
│   │   ├── rateLimit.js                  # Per-user query throttle
│   │   └── security.js                   # SQL injection guard, blocked DDL
│   └── labs/                             # Lab content definitions
│       ├── module-0-big-picture.json
│       ├── module-1-json-collections.json
│       ├── module-2-duality-views.json
│       ├── module-3-single-table-multivalue.json
│       ├── module-4-hybrid-queries.json
│       └── module-5-multi-protocol.json
├── public/
│   ├── index.html                        # Landing page
│   ├── dashboard.html                    # User dashboard
│   ├── lab.html                          # Lab module viewer
│   ├── editor.html                       # Query editor (SQL/JS/mongosh tabs)
│   ├── admin.html                        # Instructor dashboard
│   ├── css/
│   │   └── workshop.css                  # Styles (Oracle branding)
│   ├── js/
│   │   ├── app.js                        # Navigation, session, state
│   │   ├── editor.js                     # CodeMirror 6 setup
│   │   ├── results.js                    # JSON tree, table, plan renderers
│   │   ├── labs.js                       # Lab progression, copy-to-editor
│   │   └── terminal.js                   # mongosh terminal UI
│   └── img/
│       ├── oracle-logo.svg
│       └── erd.svg                       # Entity relationship diagram
├── test/
│   ├── unit/                             # No DB required
│   │   ├── config.test.js
│   │   ├── security.test.js              # SQL injection, DDL blocking
│   │   ├── validator.test.js             # Answer verification logic
│   │   ├── rateLimit.test.js
│   │   ├── labs.test.js                  # Lab content structure validation
│   │   └── queryExecutor.test.js         # Sanitization, timeout logic
│   ├── integration/                      # Requires running Oracle
│   │   ├── setup.js                      # DB connection, schema setup/teardown
│   │   ├── workspace.test.js             # Create/clone/teardown schemas
│   │   ├── query-sql.test.js             # SQL execution against real DB
│   │   ├── query-js.test.js              # JS execution against real DB
│   │   ├── duality-views.test.js         # CRUD through duality views
│   │   ├── collections.test.js           # JSON collection operations
│   │   ├── single-table.test.js          # Single-table + multi-value index
│   │   ├── hybrid-queries.test.js        # Cross-model joins
│   │   └── mongo-api.test.js             # MongoDB wire protocol operations
│   └── e2e/                              # Full stack (compose up + browser)
│       ├── registration.test.js          # User creation flow
│       ├── lab-progression.test.js       # Complete a lab module
│       └── admin.test.js                 # Instructor dashboard operations
└── CLAUDE.md                             # Project-specific Claude instructions
```

---

## Implementation Phases

### Phase 1: Project Scaffolding & Infrastructure (Foundation)

**Goal:** Bootable project with CI/CD, linting, testing framework, Docker Compose, and Oracle connectivity confirmed.

| Step | Task | Test Coverage |
|------|------|---------------|
| 1.1 | Initialize npm project, install dependencies | — |
| 1.2 | Configure ESLint (flat config), Prettier, lint-staged, husky | Pre-commit hook runs successfully |
| 1.3 | Configure Vitest (unit + integration configs) | `npm test` runs and passes (empty suite) |
| 1.4 | Create `Dockerfile.oracle` — extends `gvenzl/oracle-free:latest-faststart`, installs ORDS, copies init scripts, custom entrypoint that starts both Oracle and ORDS | Image builds successfully |
| 1.4a | Create `scripts/install-ords.sh` — downloads ORDS zip during build, installs to `/opt/oracle/ords`, configures connection pool + `mongo.enabled=true` | ORDS binary present in built image |
| 1.4b | Create `scripts/entrypoint.sh` — invokes gvenzl base entrypoint (starts Oracle + runs init scripts), waits for DB health, runs `ords install` on first startup, starts ORDS, monitors both processes | Oracle + ORDS both running, health check passes |
| 1.4c | Create `docker-compose.yml` with two services: `oracle` (built from Dockerfile.oracle, ports 1521/8181/27017) and `app` (built from Dockerfile) | Both containers start, all health checks pass |
| 1.5 | Create `docker-compose.test.yml` (Oracle+ORDS only, for CI integration tests) | — |
| 1.6 | Create `.env.example` with all required environment variables | — |
| 1.7 | Create `Dockerfile` for workshop app (Node 22 alpine, multi-stage build) | Image builds successfully |
| 1.8 | Create `.github/workflows/ci.yml` (lint + unit test jobs only initially) | CI passes on push |
| 1.9 | Write `src/config.js` — environment variable loading + validation | **Unit tests:** missing vars throw, defaults work, validation catches bad values |
| 1.10 | Write `src/server.js` — Express app skeleton with health endpoint | **Unit test:** GET /health returns 200 |
| 1.11 | Write `src/services/database.js` — connection pool initialization (oracledb thin mode) | **Integration test:** pool connects to ADB-Free, executes `SELECT 1 FROM DUAL` |

**Dependencies:** `express`, `oracledb`, `ejs`, `express-session`, `vitest`, `supertest`, `eslint`, `prettier`, `husky`, `lint-staged`, `c8`

**Exit Criteria:** `docker compose up` starts Oracle + app, app connects to DB, health endpoint returns 200, CI pipeline runs lint + unit tests.

---

### Phase 2: Database Init Scripts & Schema Management

**Goal:** Oracle starts with the complete workshop schema, sample data, and a procedure to clone it per user.

| Step | Task | Test Coverage |
|------|------|---------------|
| 2.1 | Write `init/01-create-workshop-admin.sql` — admin user, `workshop_users` table, grants | **Integration test:** admin user exists, table exists |
| 2.2 | Write `init/02-create-schema.sql` — all relational tables (advisors, clients, accounts, holdings, advisor_client_map, transactions) | **Integration test:** all tables exist with correct columns/constraints |
| 2.3 | Write `init/03-create-collections.sql` — `client_interactions` collection table + `advisory_entities` single-table collection | **Integration test:** collections exist, accept JSON inserts |
| 2.4 | Write `init/04-create-duality-views.sql` — `client_portfolio_dv`, `advisor_book_dv`, `transaction_feed_dv` | **Integration test:** views exist, return JSON documents |
| 2.5 | Write `init/05-create-indexes.sql` — functional indexes on pk/sk/gsi1, multi-value indexes on tags/sectors, search index on interactions | **Integration test:** indexes exist in `user_indexes`, multi-value index used in explain plan |
| 2.6 | Write `init/06-load-sample-data.sql` — relational seed data (20 advisors, 200 clients, 500 accounts, 2000 holdings, 300 mappings, 5000 transactions) | **Integration test:** row counts match spec |
| 2.7 | Write `init/07-load-collection-data.sql` — 500 interaction documents | **Integration test:** collection count = 500 |
| 2.8 | Write `init/08-load-single-table-data.sql` — 3000 advisory_entities documents (advisors, clients, holdings, transactions with tags/sectors arrays) | **Integration test:** count = 3000, entity type distribution matches spec |
| 2.9 | Write `init/09-enable-ords.sql` — enable ORDS for admin schema, enable MongoDB API | **Integration test:** ORDS metadata shows schema enabled |
| 2.10 | Write `init/10-create-clone-procedure.sql` — `WORKSHOP_ADMIN.clone_schema(p_username, p_password)` PL/SQL procedure that creates a user and populates their schema with tables, views, data, indexes | **Integration test:** call procedure, verify new schema has all objects + data |
| 2.11 | Write `src/services/workspace.js` — JS wrapper around clone_schema: create user, clone data, enable ORDS, return credentials | **Integration test:** create workspace, connect as new user, query duality view, teardown |

**Exit Criteria:** `docker compose up` produces a fully populated Oracle instance. Workspace creation/teardown works end-to-end. All init scripts are idempotent (can re-run).

---

### Phase 3: Query Execution Engine

**Goal:** The core query execution pipeline — SQL, JavaScript, and MongoDB command execution with security, timeout, and result formatting.

| Step | Task | Test Coverage |
|------|------|---------------|
| 3.1 | Write `src/middleware/security.js` — SQL statement classifier: block DDL that escapes schema (DROP USER, ALTER SYSTEM, CREATE DIRECTORY, GRANT to other users), block raw PL/SQL except whitelisted SODA patterns | **Unit tests:** blocked statements rejected, allowed statements pass, edge cases (comments, case variations, embedded strings) |
| 3.2 | Write `src/services/queryExecutor.js` — execute SQL with: per-user connection from pool, 30s timeout, result type detection (JSON vs tabular), row limit (1000), execution timing | **Unit tests:** timeout logic, result classification. **Integration tests:** SELECT, INSERT, UPDATE, DELETE, EXPLAIN PLAN against real DB |
| 3.3 | Write `src/routes/query.js` — `POST /api/query/sql` endpoint: auth check, rate limit, sanitize, execute, format response | **Integration test:** execute query via HTTP, verify JSON response structure |
| 3.4 | Write `src/services/jsExecutor.js` — sandboxed JavaScript execution: inject `connection` and `oracledb` into a VM context, capture console.log output, 30s timeout, return results | **Unit tests:** sandbox prevents require(), fs access, process access. **Integration tests:** node-oracledb operations work through executor |
| 3.5 | Write `src/routes/query.js` — `POST /api/query/js` endpoint | **Integration test:** execute JS via HTTP, verify output captured |
| 3.6 | Write `src/services/mongoExecutor.js` — proxy MongoDB commands to Oracle's MongoDB API: parse mongosh-style commands, translate to MongoDB driver calls via Oracle's port 27017, return results | **Integration test:** find, insertOne, aggregate via executor |
| 3.7 | Write `src/routes/query.js` — `POST /api/query/mongo` endpoint | **Integration test:** execute mongo command via HTTP |
| 3.8 | Write `src/middleware/rateLimit.js` — per-user token bucket: 10 queries/sec burst, 5/sec sustained | **Unit tests:** allows burst, throttles sustained, per-user isolation |

**Exit Criteria:** All three query types (SQL, JS, MongoDB) execute correctly via HTTP endpoints with security guards, timeouts, and rate limiting. Security tests confirm blocked operations are rejected.

---

### Phase 4: Authentication & Workspace Management

**Goal:** Users can register, get a workspace, login again later, and the instructor can manage all workspaces.

| Step | Task | Test Coverage |
|------|------|---------------|
| 4.1 | Write `src/routes/auth.js` — `POST /api/register` (create workspace, return session + credentials), `POST /api/login` (resume workspace), `POST /api/logout` | **Integration test:** full registration flow, login with existing workspace, logout clears session |
| 4.2 | Write `src/middleware/auth.js` — session-based auth middleware, extracts user's schema credentials from session | **Unit tests:** missing session returns 401, valid session passes, expired session rejected |
| 4.3 | Write `src/routes/admin.js` — `GET /admin` (dashboard data), `DELETE /admin/workspaces/:id`, `DELETE /admin/workspaces` (bulk teardown), `POST /admin/workspaces/lock` (read-only mode) | **Integration test:** create 3 workspaces, verify admin sees all 3, teardown one, verify count, bulk teardown |
| 4.4 | Add admin password authentication (simple shared password from env var) | **Unit test:** wrong password returns 403 |

**Exit Criteria:** Full user lifecycle works: register → get workspace → execute queries → logout → login again → workspace intact. Instructor can see all users and tear down workspaces.

---

### Phase 5: Lab Content & Progression

**Goal:** Lab modules are served as structured content, exercises have copy-to-editor capability, and answer validation works.

| Step | Task | Test Coverage |
|------|------|---------------|
| 5.1 | Define lab content JSON schema — modules contain: id, title, description, estimated_time, exercises[{id, title, description, sql/js/mongo code, validation_query, expected_result_pattern}] | **Unit test:** all 6 module JSON files validate against schema |
| 5.2 | Write `src/labs/module-0-big-picture.json` through `module-5-multi-protocol.json` — all lab content from the spec, structured as JSON with exercise definitions | **Unit test:** every exercise has required fields, code snippets are syntactically valid |
| 5.3 | Write `src/services/validator.js` — run validation query against user's schema, compare result to expected pattern (row count, specific values, column existence) | **Unit tests:** pattern matching logic (exact match, contains, row count >=). **Integration test:** run validation after executing exercise SQL |
| 5.4 | Write `src/routes/labs.js` — `GET /api/labs/:moduleId` (serve content), `POST /api/labs/:moduleId/check/:exerciseId` (validate), `GET /api/progress` (completion state) | **Integration test:** get lab content, execute exercise, check answer, verify progress updated |
| 5.5 | Add progress persistence — store completion state in `workshop_users` table (JSON column with module/exercise completion timestamps) | **Integration test:** complete exercise, restart session, progress retained |

**Exit Criteria:** All 6 modules serve correctly, exercises validate, progress persists across sessions.

---

### Phase 6: Frontend — Landing, Dashboard, Lab Viewer

**Goal:** Browser-based UI for the workshop experience.

| Step | Task | Test Coverage |
|------|------|---------------|
| 6.1 | Write `public/index.html` — landing page with workshop overview, timeline, "Create Workspace" button | **E2E test:** page loads, register button visible |
| 6.2 | Write `public/css/workshop.css` — Oracle-branded styles, responsive layout, dark/light code blocks | — |
| 6.3 | Write `public/dashboard.html` + `public/js/app.js` — progress bar, module cards, quick-access buttons | **E2E test:** after registration, dashboard shows 0% progress, all modules listed |
| 6.4 | Write `public/lab.html` + `public/js/labs.js` — lab content renderer with concept text, code snippets, "Copy to Editor" buttons, "Check Answer" button, completion indicators | **E2E test:** navigate to module 1, copy code, check answer |
| 6.5 | Write `public/js/results.js` — JSON tree viewer (collapsible, syntax highlighted), tabular renderer (sortable columns), execution plan formatter, raw text mode | **Unit test:** JSON tree builds correctly from sample data, table renders columns |

**Exit Criteria:** Developer can navigate landing → register → dashboard → lab module → see content → copy code. Visual design is clean and functional.

---

### Phase 7: Frontend — Query Editor

**Goal:** The core interactive editor with SQL, JavaScript, and mongosh tabs, result rendering, and query history.

| Step | Task | Test Coverage |
|------|------|---------------|
| 7.1 | Write `public/editor.html` — split-pane layout (editor left, results right), tab bar (SQL/JS/mongosh) | — |
| 7.2 | Write `public/js/editor.js` — CodeMirror 6 integration: SQL mode (Oracle dialect), JavaScript mode, mongosh mode, Ctrl+Enter to execute, tab switching preserves content | **Unit test:** CodeMirror initializes, mode switching works |
| 7.3 | Connect editor to `/api/query/*` endpoints — execute on Ctrl+Enter, show loading state, render results in appropriate viewer (JSON/table/plan), show execution time | **E2E test:** type SQL, execute, see results |
| 7.4 | Add query history — last 50 queries stored in localStorage, displayed in collapsible panel, click to re-run | **Unit test:** history stores/retrieves correctly, max 50 enforced |
| 7.5 | Add execution plan toggle — button to prepend `EXPLAIN PLAN FOR` and display formatted plan output | **E2E test:** run query with plan, see formatted output |
| 7.6 | Write `public/js/terminal.js` — mongosh-style terminal emulation: command input, output display, history (up/down arrows), connection status | **E2E test:** type mongosh command, see result |

**Exit Criteria:** Developer can write and execute SQL, JavaScript, and mongosh commands from the browser, see formatted results, review query history, and view execution plans.

---

### Phase 8: Instructor Dashboard & Admin Features

**Goal:** Instructor has visibility into all active users and can manage the workshop environment.

| Step | Task | Test Coverage |
|------|------|---------------|
| 8.1 | Write `public/admin.html` — login gate (password), user list, progress heatmap, action buttons | **E2E test:** login as admin, see user list |
| 8.2 | Add progress heatmap — grid showing modules (columns) x users (rows), colored by completion | — |
| 8.3 | Add bulk actions — "Reset All Data" (re-run seed scripts per workspace), "Lock All" (read-only), "Tear Down All" | **E2E test:** create 2 users, tear down all, verify both removed |
| 8.4 | Add environment status panel — Oracle health, ORDS status, MongoDB API status, active connections count | **Integration test:** status endpoint returns correct DB state |

**Exit Criteria:** Instructor can monitor workshop progress and manage all workspaces from a single dashboard.

---

### Phase 9: Docker & Deployment Polish

**Goal:** One-command startup, production-ready Docker image, documentation.

| Step | Task | Test Coverage |
|------|------|---------------|
| 9.1 | Finalize `Dockerfile` — multi-stage build (npm ci --production, copy dist), health check, non-root user | **CI:** image builds, smoke test passes |
| 9.2 | Finalize `docker-compose.yml` — health checks, depends_on with condition, resource limits, proper networking | **CI:** compose up → health → curl app → compose down |
| 9.3 | Write `.env.example` with comments explaining each variable | — |
| 9.4 | Write `CLAUDE.md` for this project | — |
| 9.5 | Write `README.md` — quick start (3 steps), prerequisites, configuration, troubleshooting | — |
| 9.6 | Add `release.yml` GitHub Action — build + push image on tag | **CI:** tag triggers build + publish |
| 9.7 | End-to-end smoke test in CI — compose up, register user, execute one query per type (SQL/JS/mongo), verify results, compose down | **CI/E2E:** full integration test in pipeline |

**Exit Criteria:** `git clone && docker compose up` produces a working workshop in under 5 minutes. README documents everything.

---

## Test Strategy

### Test Pyramid

```
        /  E2E  \           ~10 tests    (full stack, compose up)
       / Integration \       ~40 tests   (real Oracle, HTTP endpoints)
      /    Unit Tests  \     ~60 tests   (no DB, pure logic)
     ──────────────────────
```

### Unit Tests (No DB Required)

Run with: `npx vitest run`

| Area | What's Tested |
|------|---------------|
| `config.js` | Env var validation, defaults, missing var errors |
| `security.js` | SQL injection patterns blocked, DDL blocking, PL/SQL whitelist, edge cases (comments, mixed case, embedded strings) |
| `rateLimit.js` | Token bucket algorithm, per-user isolation, burst allowance |
| `validator.js` | Pattern matching logic (exact, contains, row count, column existence) |
| `auth.js` middleware | Missing session → 401, valid session passes |
| `labs/*.json` | Schema validation (all required fields present, no broken references) |
| `results.js` (frontend) | JSON tree construction, table rendering |
| `editor.js` (frontend) | History management, mode switching |

### Integration Tests (Real Oracle)

Run with: `npx vitest run --project integration`

Requires: Oracle container running (via `docker compose -f docker-compose.test.yml up -d`)

| Area | What's Tested |
|------|---------------|
| Database connectivity | Pool creation, `SELECT 1 FROM DUAL` |
| Init scripts | All tables, collections, views, indexes exist with correct structure |
| Sample data | Row counts match spec |
| Workspace lifecycle | Create → query → teardown, schema isolation verified |
| Duality Views | INSERT document → verify relational tables → SELECT document → verify shape |
| JSON Collections | Insert, query (dot notation, JSON_EXISTS), update (JSON_TRANSFORM), delete |
| Single-table design | pk/sk queries, GSI queries, multi-value index queries with EXPLAIN PLAN |
| Hybrid queries | Cross-model joins, JSON_TABLE shredding, JSON_ARRAYAGG |
| MongoDB API | find, insertOne, updateOne, deleteOne, aggregate via Oracle's MongoDB wire protocol |
| SQL endpoint | HTTP → SQL → result, blocked DDL returns 403 |
| JS endpoint | HTTP → JS → captured output |
| Mongo endpoint | HTTP → mongo command → result |
| Answer validation | Execute exercise SQL → check answer → verify pass/fail |

### E2E Tests (Full Stack)

Run with: `npx vitest run --project e2e`

Requires: Full `docker compose up`

| Area | What's Tested |
|------|---------------|
| Registration flow | Load landing → register → redirected to dashboard |
| Lab progression | Navigate to module → copy code → execute → check answer → progress updated |
| Admin dashboard | Login → see users → tear down workspace |
| Query editor | Type SQL → Ctrl+Enter → results displayed |

### Coverage Target

- **Unit tests:** >90% branch coverage on `src/services/` and `src/middleware/`
- **Integration tests:** Every SQL statement from the spec's exercises runs and produces expected results
- **E2E tests:** Critical paths only (register, execute, validate)

---

## Dependency List

### Runtime Dependencies

```json
{
  "express": "^5.0.0",
  "oracledb": "^6.8.0",
  "ejs": "^3.1.10",
  "express-session": "^1.18.0",
  "connect-loki": "^1.2.0",
  "helmet": "^8.0.0",
  "compression": "^1.7.5"
}
```

### Dev Dependencies

```json
{
  "vitest": "^3.0.0",
  "supertest": "^7.0.0",
  "@vitest/coverage-v8": "^3.0.0",
  "eslint": "^9.0.0",
  "@eslint/js": "^9.0.0",
  "eslint-plugin-n": "^17.0.0",
  "prettier": "^3.4.0",
  "prettier-plugin-sql": "^0.18.0",
  "lint-staged": "^15.0.0",
  "husky": "^9.0.0"
}
```

### Frontend (CDN, no npm)

- **CodeMirror 6** — `@codemirror/view`, `@codemirror/lang-sql`, `@codemirror/lang-javascript` via esm.sh or cdnjs
- **Oracle branding** — custom CSS, no framework

---

## Key Technical Decisions

| Decision | Rationale |
|----------|-----------|
| **Custom Oracle+ORDS image over ADB-Free or separate ORDS** | Training environments may have no internet. Custom image from gvenzl base + ORDS baked in = fully self-contained after build. No kernel capabilities needed (`--cap-add SYS_ADMIN`), lower resource footprint (4GB vs 8GB), and only two containers to manage. ORDS connects via localhost inside the container = zero network latency. |
| **Vanilla frontend over React/Vue** | Zero build step, instant load, no bundler complexity. Workshop app is simple enough. CodeMirror 6 is the only non-trivial frontend dependency. |
| **Vitest over Jest** | ESM-native, faster, built-in coverage via c8, compatible with our Node 22 target. |
| **express-session + connect-loki over JWT** | Server-side sessions are simpler for this use case. LokiJS file store survives app restarts without a Redis dependency. |
| **Per-user Oracle schemas over row-level isolation** | True schema isolation prevents cross-user data leakage and lets each user have their own duality views, indexes, and collections. More expensive to create but far safer. |
| **Sandboxed JS execution over direct eval** | vm module with restricted context prevents user-submitted JavaScript from accessing filesystem, network, or process. |
| **SQL classifier over database-level grants** | Application-layer SQL filtering (blocking DROP USER, ALTER SYSTEM, etc.) provides defense-in-depth beyond what Oracle grants allow, with better error messages. |
| **`gvenzl/oracle-free:latest-faststart` as base** | 26ai (23.26.1) confirmed available. Faststart = pre-expanded DB baked into image for near-instant startup. Extended with ORDS via `Dockerfile.oracle`. |

---

## Risk Register

| Risk | Mitigation |
|------|------------|
| No internet at training site | `docker compose build` bakes everything into two images. `scripts/bundle.sh` saves them to tarball. `docker load` on air-gapped machine. Zero runtime downloads. |
| ORDS fails to start inside Oracle container | `entrypoint.sh` waits for Oracle health before starting ORDS. Health check verifies both Oracle (`healthcheck.sh`) and ORDS (`curl /ords/_/health`). If ORDS dies, container exits and restarts. |
| MongoDB API not enabled | `install-ords.sh` sets `mongo.enabled=true` during image build. Init script `09-enable-ords.sql` grants `SODA_APP` to workshop users. Integration test verifies port 27017 connectivity. |
| Per-user schema cloning is slow at scale (20+ users) | Clone procedure creates tables + inserts in batch. Benchmark during Phase 2. If >10s per user, pre-create schemas. |
| Node.js vm sandbox escapes | Use `vm.createContext()` with frozen global, no `require`, no `process`. Do NOT use `vm.runInThisContext()`. Add unit tests for known escape vectors. |
| Instructor laptop underpowered | Custom Oracle+ORDS image needs only 2 CPU / 4GB RAM (vs ADB-Free's 4 CPU / 8GB). ORDS adds ~512MB overhead inside the container. Total footprint: ~4.5GB RAM for both containers. Document minimum specs in README. |
| Workshop SQL in spec has syntax errors for 26ai | Every SQL statement from the spec is executed in integration tests. Fix-forward during Phase 2. |
| ORDS download fails during image build | ORDS zip is downloaded once during `docker compose build`. If the build succeeds, the image is fully self-contained — no ORDS download at runtime. `scripts/bundle.sh` creates a portable tarball from the built images. |

---

## Phase Execution Order

```
Phase 1: Scaffolding & Infrastructure     ████████░░░░░░░░░░░░  ~15%
Phase 2: DB Init Scripts & Schema Mgmt    ████████████░░░░░░░░  ~20%
Phase 3: Query Execution Engine            ████████████████░░░░  ~20%
Phase 4: Auth & Workspace Management       ████████████████░░░░  ~10%
Phase 5: Lab Content & Progression         ████████████████░░░░  ~10%
Phase 6: Frontend — Landing/Dashboard/Lab  ████████████████░░░░  ~10%
Phase 7: Frontend — Query Editor           ████████████████░░░░  ~10%
Phase 8: Instructor Dashboard              ████████████████████  ~3%
Phase 9: Docker & Deployment Polish        ████████████████████  ~2%
```

Phases 1-3 are the critical path. Phase 2 (init scripts) can begin in parallel with Phase 1 once docker-compose.yml is working. Phases 6-7 (frontend) can begin in parallel with Phases 4-5 once the API endpoints exist.
