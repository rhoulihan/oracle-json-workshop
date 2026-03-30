# Oracle JSON Workshop — CLAUDE.md

## Project Summary

Interactive, containerized developer workshop teaching Oracle's full JSON technology stack in 90 minutes. Financial services advisory platform domain. Two containers: custom Oracle 26ai+ORDS image + Node.js/Express web app. Fully offline-capable.

**Spec:** `docs/workshop-specification.md` — complete lab content, data model, SQL examples, architecture
**Plan:** `docs/implementation-plan.md` — 9-phase TDD implementation, test strategy, CI/CD

## Architecture (Do Not Deviate)

- **Oracle container:** `Dockerfile.oracle` extends `gvenzl/oracle-free:latest-faststart` (23.26.1 = 26ai) with ORDS installed in-container. Ports 1521/8181/27017. `scripts/entrypoint.sh` starts both Oracle and ORDS.
- **App container:** `Dockerfile` — Node 22, Express, oracledb 6.x thin mode, vanilla HTML/CSS/JS frontend, CodeMirror 6 editor. Port 3000.
- **No ADB-Free** — requires `--cap-add SYS_ADMIN` + `/dev/fuse`, too heavy, not offline-friendly.
- **No separate ORDS container** — ORDS is baked into the Oracle image for self-containment.
- **Offline deployment:** `docker compose build` produces everything. `scripts/bundle.sh` saves images to tarball.

## Key Technical Decisions

- **DB image:** gvenzl faststart (not Oracle Container Registry, not ADB-Free)
- **ORDS:** Installed inside Oracle container via `scripts/install-ords.sh` during image build
- **Frontend:** Vanilla HTML/JS, no React/Vue — zero build step, CodeMirror 6 via CDN/esm.sh
- **Testing:** Vitest (unit + integration), Supertest (HTTP), real Oracle for integration tests
- **Sessions:** express-session + connect-loki (file store, no Redis)
- **Isolation:** Per-user Oracle schemas via `WORKSHOP_ADMIN.clone_schema()` PL/SQL procedure
- **Security:** Application-layer SQL classifier blocks dangerous DDL; vm sandbox for JS execution
- **Pre-commit:** husky + lint-staged (ESLint + Prettier on JS/JSON/SQL/MD)
- **CI:** GitHub Actions — lint → unit test → integration test (with Oracle container) → Docker build

## Oracle JSON Technologies Covered

JSON Collection Tables, JSON Duality Views (SQL syntax with UNNEST/NOCHECK/@generated), JSON_TRANSFORM (SET/APPEND/REMOVE/NESTED PATH/KEEP), JSON_TABLE, JSON_MERGEPATCH, JSON_VALUE/JSON_QUERY, dot notation, JSON_OBJECT/JSON_ARRAYAGG, OSON binary format, multi-value indexes (MULTIVALUE INDEX), functional indexes, JSON Search Index, single-table design pattern, SODA API, MongoDB API via ORDS (port 27017), ORDS REST/AutoREST, node-oracledb thin mode.

## Data Model

Financial services advisory platform. Relational tables: advisors, clients, accounts, holdings, advisor_client_map, transactions. JSON collections: client_interactions (interaction log), advisory_entities (single-table design with pk/sk/gsi1pk/gsi1sk, tags/sectors arrays). Three duality views: client_portfolio_dv, advisor_book_dv, transaction_feed_dv.

## Init Scripts (run order matters)

01-create-workshop-admin → 02-create-schema → 03-create-collections → 04-create-duality-views → 05-create-indexes → 06-load-sample-data → 07-load-collection-data → 08-load-single-table-data → 09-enable-ords → 10-create-clone-procedure

---

## Workflow Orchestration

### 1. Plan Node Default

- Enter plan mode for ANY non-trivial task (3+ steps or architectural decisions)
- If something goes sideways, STOP and re-plan immediately - don't keep pushing
- Use plan mode for verification steps, not just building
- Write detailed specs upfront to reduce ambiguity

### 2. Subagent Strategy

- Use subagents liberally to keep main context window clean
- Offload research, exploration, and parallel analysis to subagents
- For complex problems, throw more compute at it via subagents
- One task per subagent for focused execution

### 3. Self-Improvement Loop

- After ANY correction from the user: update `tasks/lessons.md` with the pattern
- Write rules for yourself that prevent the same mistake
- Ruthlessly iterate on these lessons until mistake rate drops
- Review lessons at session start for relevant project

### 4. Verification Before Done

- Never mark a task complete without proving it works
- Diff behavior between main and your changes when relevant
- Ask yourself: "Would a staff engineer approve this?"
- Run tests, check logs, demonstrate correctness
