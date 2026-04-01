# Oracle JSON Workshop — CLAUDE.md

## Project Summary

Interactive, containerized developer workshop teaching Oracle's full JSON technology stack in 90 minutes. Financial services advisory platform domain. Two containers: custom Oracle 26ai+ORDS image + Node.js/Express web app. Fully offline-capable. **All 9 implementation phases complete. 322 tests passing.**

**Spec:** `docs/workshop-specification.md` — complete lab content, data model, SQL examples, architecture
**Plan:** `docs/implementation-plan.md` — 9-phase TDD implementation, test strategy, CI/CD

## Architecture (Do Not Deviate)

- **Oracle container:** `Dockerfile.oracle` extends `gvenzl/oracle-free:latest-faststart` (26ai) with ORDS installed in-container. Ports 1521/8181/27017. `scripts/entrypoint.sh` starts both Oracle and ORDS. Init scripts in `/container-entrypoint-initdb.d/` run as SYSDBA on first startup.
- **App container:** `Dockerfile` — Node 22 Alpine, multi-stage build, non-root user, health check. Express server with `src/index.js` as entrypoint. Port 3000.
- **Frontend:** Vanilla HTML/CSS/JS — zero build step. 5 pages (landing, dashboard, lab, editor, admin). Oracle-branded CSS design system. ES modules in browser.
- **No ADB-Free** — requires `--cap-add SYS_ADMIN` + `/dev/fuse`, too heavy, not offline-friendly.
- **No separate ORDS container** — ORDS is baked into the Oracle image for self-containment.
- **Offline deployment:** `docker compose build` produces everything. `scripts/bundle.sh` saves images to tarball.

## Key Technical Decisions

- **DB image:** gvenzl faststart (not Oracle Container Registry, not ADB-Free)
- **ORDS:** Installed inside Oracle container via `scripts/install-ords.sh` during image build
- **Frontend:** Vanilla HTML/JS, no React/Vue — zero build step, CodeMirror 6 via CDN/esm.sh
- **Testing:** Vitest (unit + frontend + integration), Supertest (HTTP), jsdom for frontend, real Oracle for integration
- **Sessions:** express-session + connect-loki (file store, no Redis)
- **Isolation:** Per-user Oracle schemas via SYS-owned `workshop_clone_schema()` PL/SQL procedure
- **Security:** SQL classifier blocks dangerous DDL; vm sandbox for JS execution; Helmet CSP
- **Pre-commit:** husky + lint-staged (ESLint + Prettier on JS/JSON/SQL/MD)
- **CI:** GitHub Actions — lint → unit+frontend test → Docker build. Release workflow on `v*` tags pushes to GHCR.
- **oracledb outFormat:** Always use `oracledb.OUT_FORMAT_OBJECT` (not numeric `2` or `4002`) — import the constant

## Project Structure

```
src/
├── index.js                 # Server entrypoint (wires all services, starts HTTP)
├── server.js                # Express app factory (createApp)
├── config.js                # Environment config + validation
├── middleware/
│   ├── auth.js              # requireAuth + requireAdmin
│   ├── security.js          # SQL classifier (classifySQL + sqlGuard)
│   └── rateLimit.js         # Token-bucket rate limiter (per-session)
├── routes/
│   ├── auth.js              # register, login, logout, reset, me
│   ├── admin.js             # admin login, workspace list/teardown
│   ├── labs.js              # module list, content, check exercise, progress
│   └── query.js             # SQL/JS/mongo execution
├── services/
│   ├── database.js          # Connection pool manager (DatabaseService)
│   ├── workspace.js         # Schema clone/teardown/findByEmail/createWithName
│   ├── queryExecutor.js     # SQL execution with timeout + row limits
│   ├── jsExecutor.js        # Sandboxed JS execution (vm.createContext)
│   ├── mongoExecutor.js     # mongosh → SQL translator
│   ├── labLoader.js         # Lab module JSON loader + cache
│   ├── validator.js         # Exercise answer validation (rowCount/exact/contains/columnExists)
│   └── progressService.js   # Per-user progress tracking (workshop_users.progress JSON column)
└── labs/                    # 6 module JSON files (M0-M5, 24 exercises)

public/
├── index.html               # Landing page (register/reconnect)
├── dashboard.html           # Module grid + overall progress
├── lab.html                 # Lab viewer (exercise tabs, step-through, inline run)
├── editor.html              # SQL/JS/mongosh query editor (split-pane)
├── admin.html               # Instructor dashboard (login gate, workspace table, heatmap)
├── css/workshop.css         # Oracle-branded design system (CSS custom properties)
├── img/oracle-logo.svg      # Oracle wordmark
└── js/
    ├── api.js               # Fetch wrapper for all API endpoints
    ├── components.js         # Shared DOM builders (header, cards, exercises with tabs)
    ├── progress.js           # Progress calculation (pure functions)
    ├── results.js            # Query result renderers (table, JSON, error, DML)
    ├── history.js            # Query history (localStorage, max 50)
    ├── editor-setup.js       # Tab manager for editor
    ├── sql-splitter.js       # Multi-statement SQL splitter (respects strings/comments)
    ├── exercise-runner.js    # Exercise execution (splits SQL, dispatches by codeType)
    ├── step-runner.js        # Step-by-step exercise execution (StepRunner class)
    └── pages/               # Page controllers (index, dashboard, lab, editor, admin)

test/
├── unit/                    # Backend unit tests (213)
├── unit/frontend/           # Frontend unit tests (109, jsdom)
└── integration/             # Real Oracle required (48)
```

## Lab Exercise UX

- **Tabbed exercises:** exercises appear as horizontal tabs (1.1 | 1.2 | ...) — no vertical scrolling
- **Code / Learn tabs:** each exercise has Code (default) and Learn tabs. Learn shows educational explanation with "Try this" suggestions
- **Step-through:** multi-statement exercises execute one step at a time via "Run Step 1/N" button
- **Inline results:** query output renders below the code block (tables, JSON, DML, errors). Scrollable at 360px max-height
- **Auto-validate:** after execution, silently calls checkExercise to mark progress
- **Workspace reset:** lab page resets user's schema to fresh state on load (skip with `?preserveData`)
- **COMMIT handling:** COMMIT merged into preceding DML step code; StepRunner splits on semicolons internally
- **JSON pretty-print detection:** single-column results starting with `{` render as `<pre>` blocks instead of tables

## Oracle JSON Technologies Covered

JSON Collection Tables, JSON Duality Views (UNNEST/NOCHECK/WITH UPDATE), JSON_TRANSFORM (SET/APPEND/REMOVE/KEEP), JSON_TABLE, JSON_VALUE/JSON_QUERY, dot notation (.string()/.number()/.boolean()), JSON_OBJECT/JSON_ARRAYAGG, OSON binary format, multi-value indexes (MULTIVALUE INDEX), functional indexes on JSON paths, JSON Search Index (JSON_TEXTCONTAINS), single-table design pattern (pk/sk/gsi), SODA API, MongoDB wire protocol via ORDS, node-oracledb thin mode with DB_TYPE_JSON binding.

## Data Model

Financial services advisory platform. Relational tables: advisors, clients, accounts, holdings, advisor_client_map, transactions. JSON collections: client_interactions (interaction log), advisory_entities (single-table design with pk/sk/gsi1pk/gsi1sk, tags/sectors arrays). Three duality views: client_portfolio_dv, advisor_book_dv, transaction_feed_dv.

## Init Scripts (run order matters, all run as SYSDBA)

01-create-workshop-admin → 02-create-schema → 03-create-collections → 04-create-duality-views → 05-create-indexes → 06-load-sample-data → 07-load-collection-data → 08-load-single-table-data → 09-enable-ords → 10-create-clone-procedure

## URLs

| URL                                              | Purpose                                                   |
| ------------------------------------------------ | --------------------------------------------------------- |
| `http://localhost:3000`                          | Landing page — developers register here                   |
| `http://localhost:3000/dashboard.html`           | Developer dashboard — module progress                     |
| `http://localhost:3000/lab.html?module=module-1` | Lab viewer — exercises                                    |
| `http://localhost:3000/editor.html`              | Query editor — SQL/JS/mongosh                             |
| `http://localhost:3000/admin.html`               | Instructor dashboard (password: `ADMIN_PASSWORD` env var) |

---

# Workflow Orchestration

## #1 - Plan Mode Default

- Enter plan mode for ANY non-trivial task (3+ steps or architectural decisions)
- If something goes sideways, STOP and re-plan immediately - don't keep pushing
- Use plan mode for verification steps, not just building
- Write detailed specs upfront to reduce ambiguity

## #2 - Subagent Strategy

- Use subagents liberally to keep main context window clean
- Offload research, exploration, and parallel analysis to subagents
- For complex problems, throw more compute at it via subagents
- One task per subagent for focused execution

## #3 - Self-Improvement Loop

- After ANY correction from the user: update `tasks/lessons.md` with the pattern
- Write rules for yourself that prevent the same mistake
- Ruthlessly iterate on these lessons until mistake rate drops
- Review lessons at session start for relevant project

## #4 - Verification Before Done

- Never mark a task complete without proving it works
- Diff behavior between main and your changes when relevant
- Ask yourself "Would a staff engineer approve this?"
- Run tests, check logs, demonstrate correctness

## #5 - Sound Elegance (Balanced)

- Before writing code, ask "Is there a more elegant way?"
- If a fix feels hacky, "Knowing everything I know now, implement the elegant solution"
- Don't over-engineer for hypothetical futures
- Challenge your own work before presenting it

## #6 - When Things Break

- When given a bug report: just fix it. Don't ask for hand-holding
- Try the simplest fix first, escalate complexity only if needed
- Post context switching required info into the session
- Proactively surface issues you notice being told like errors

## #7 - Task Management

- 📋 **Plan First:** Write plan to `tasks/todo.md` with checkable items
- 📊 **Status Updates:** Mark items done as you go
- 🔍 **Don't Forget:** Check todo before saying "I'm done"
- 📝 **Document Decisions:** Add review section to `tasks/lessons.md`

## #8 - Core Principles

- ⚡ **Simplicity First:** Make every change as simple as possible. Inject minimal code.
- 💡 **Explain Reasoning:** When proposing architecture, explain WHY not just WHAT
- 🤔 **Admit Uncertainty:** Say "I'm not sure" when appropriate, suggest investigation
