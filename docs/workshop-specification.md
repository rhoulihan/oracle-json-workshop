# Oracle JSON Technologies Developer Workshop

## Application Specification

---

## 1. Overview

A self-contained, containerized developer workshop that teaches Oracle's full JSON technology stack through hands-on labs. The workshop runs entirely on locally hosted containers — no cloud accounts, no external dependencies. An instructor starts the environment, developers connect via browser, create a workspace, and begin writing queries immediately.

**Duration:** 90 minutes, aggressive tempo
**Audience:** Application developers, data engineers, architects — any skill level with SQL/JSON familiarity
**Delivery:** Instructor-led, hands-on, browser-based

### What Developers Will Learn

1. How Oracle stores and indexes JSON documents natively (OSON binary format, O(1) field access)
2. How to create and use JSON Collection Tables as a document database
3. How to connect via MongoDB API (mongosh) and work with collections through a familiar interface
4. How JSON Relational Duality Views provide bidirectional document↔relational mapping with full ACID
5. How to write hybrid JSON-Relational queries that combine the best of both models in a single statement
6. How to use JSON_TRANSFORM, JSON_TABLE, and dot notation for surgical document manipulation
7. How to access all of the above from JavaScript (node-oracledb)

### Core Thesis

> "You don't need five databases. You need one database that speaks five languages."

The workshop proves this by having developers use the same data through SQL, document APIs, MongoDB wire protocol, REST, and JavaScript — all hitting the same tables, same transactions, same ACID guarantees.

---

## 2. Architecture

### 2.1 Container Stack (Docker Compose)

**Design Constraint:** Training environments may have limited or no internet connectivity. The entire workshop is fully self-contained in two containers — one custom Oracle image with ORDS baked in, one app container. The instructor builds the project once (with internet), and the resulting images run anywhere with no runtime dependencies.

```
┌──────────────────────────────────────────────────────────────────┐
│                    Instructor Laptop (Host)                       │
│                                                                  │
│  ┌──────────────────┐  ┌──────────────────────────────────────┐ │
│  │  Workshop App    │  │  Oracle 26ai Free + ORDS             │ │
│  │  (Node/Express)  │  │  (Custom image built from gvenzl)    │ │
│  │                  │  │                                      │ │
│  │  - Landing page  │  │  ┌──────────────────────────────┐   │ │
│  │  - Registration  │  │  │  Oracle Database 26ai        │   │ │
│  │  - Lab modules   │  │  │  JSON, Duality, Vector, Graph│   │ │
│  │  - Query editor  │  │  │  OSON binary, Full SQL       │   │ │
│  │  - Results       │  │  │  Port 1521 (SQL*Net)         │   │ │
│  │  - Admin panel   │  │  ├──────────────────────────────┤   │ │
│  │                  │  │  │  ORDS (installed in-container)│   │ │
│  │                  │  │  │  REST APIs + AutoREST         │   │ │
│  │                  │  │  │  MongoDB API (Port 27017)     │   │ │
│  │                  │  │  │  Database Actions (Port 8181) │   │ │
│  │  Port: 3000      │  │  └──────────────────────────────┘   │ │
│  └────────┬─────────┘  └──────────────────────────────────────┘ │
│           │  oracledb (thin mode)       ▲                        │
│           └─────────────────────────────┘                        │
│                                                                  │
│  Developers connect via browser: http://<instructor-ip>:3000     │
│  MongoDB API (mongosh): mongodb://<instructor-ip>:27017          │
│  Database Actions: http://<instructor-ip>:8181/ords/sql-developer│
└──────────────────────────────────────────────────────────────────┘
```

### 2.2 Container: Oracle 26ai + ORDS (Custom Image)

**Base Image:** `gvenzl/oracle-free:latest-faststart` (currently 23.26.1 = 26ai)
**Built via:** `Dockerfile.oracle` in this repo — extends gvenzl base with ORDS installation

The custom image bakes in:
- Oracle Database 26ai Free with pre-expanded database (faststart)
- ORDS installed and configured (REST endpoints, MongoDB API, Database Actions)
- Startup script that launches both the Oracle listener and ORDS
- All workshop init scripts (schema, data, duality views, indexes)

After `docker compose build`, the resulting image is fully self-contained — no runtime downloads.

**Why a custom image instead of separate ORDS container:**
- Single container = simpler deployment, fewer moving parts, fewer failure modes
- No inter-container networking for ORDS↔Oracle (localhost connection, zero latency)
- Instructor builds once, deploys anywhere — including air-gapped environments
- One `docker save` produces a portable tarball containing everything

**Ports:**
| Port | Service | Purpose |
|------|---------|---------|
| 1521 | SQL*Net | Direct database connections (node-oracledb, JDBC, SQLcl) |
| 8181 | ORDS / Database Actions | REST APIs, AutoREST, SQL Developer Web |
| 27017 | MongoDB Wire Protocol | mongosh and MongoDB driver connections |

**Connection:** SID=`FREE`, PDB=`FREEPDB1`

**Resource Requirements:** 2 CPUs, 4GB RAM minimum (instructor machine)

**Dockerfile.oracle Overview:**
```dockerfile
FROM gvenzl/oracle-free:latest-faststart

# Install ORDS
# (Download ORDS zip during build, install to /opt/oracle/ords)
# Configure connection pool pointing to localhost:1521/FREEPDB1
# Enable MongoDB API (mongo.enabled=true)
# Configure ORDS_PUBLIC_USER and schema-level REST access

# Copy init scripts
COPY init/ /container-entrypoint-initdb.d/

# Copy custom entrypoint that starts Oracle + ORDS
COPY scripts/entrypoint.sh /opt/oracle/scripts/

# Expose all three ports
EXPOSE 1521 8181 27017

# Custom entrypoint: start Oracle (via base image entrypoint), then start ORDS
ENTRYPOINT ["/opt/oracle/scripts/entrypoint.sh"]
```

**`scripts/entrypoint.sh` Logic:**
1. Invoke the gvenzl base image's original entrypoint (starts Oracle listener + runs init scripts)
2. Wait for Oracle to be healthy (`healthcheck.sh`)
3. Install ORDS into the database (`ords install`) if first run
4. Start ORDS in the background (`ords serve &`)
5. Monitor both processes — if either dies, the container exits

### 2.3 Container: Workshop Web Application

**Image:** Custom, built from Dockerfile in repo

**Stack:**
- **Runtime:** Node.js 22 LTS
- **Framework:** Express.js
- **Database Driver:** node-oracledb 6.x (thin mode — no Oracle Client needed)
- **Frontend:** Vanilla HTML/CSS/JS (no framework — fast load, zero build step)
- **Code Editor:** CodeMirror 6 (embedded, SQL + JavaScript syntax highlighting)
- **Template Engine:** EJS (server-rendered pages for simplicity)

**Port:** 3000

---

## 3. User Experience Flow

### 3.1 Instructor Setup

1. Instructor clones repo, runs `docker compose up`
2. Oracle container initializes (near-instant with gvenzl faststart image)
3. Init scripts create the workshop schema, sample data, and Duality Views
4. Workshop app detects database readiness via health check
5. Instructor shares the URL: `http://<host-ip>:3000`

### 3.2 Developer Flow

```
Landing Page → Register/Login → Dashboard → Lab Modules → Query Editor → Results
```

**Step 1: Landing Page**
- Workshop title, objectives, 90-minute timeline
- "Create Workspace" button

**Step 2: Registration**
- Developer enters: display name, email (optional, for progress tracking)
- System creates a dedicated Oracle schema (user) for this developer
- Schema is pre-populated with sample tables, collections, and Duality Views via init script cloning
- Developer receives credentials (auto-generated, displayed once)

**Step 3: Dashboard**
- Progress bar showing lab completion (0-100%)
- Lab module cards with estimated time, status (locked/active/complete)
- Quick-access buttons: "Open Query Editor", "Open mongosh Terminal", "View My Schema"

**Step 4: Lab Modules**
- Sequential lab pages with:
  - Concept explanation (brief — 2-3 paragraphs max)
  - Code snippets with "Copy to Editor" buttons
  - Interactive exercises with validation ("Run this query and verify the output matches...")
  - "Check Answer" validation that runs a verification query against the developer's schema

**Step 5: Query Editor**
- Split-pane: editor (left) + results (right)
- Tabs for: SQL, JavaScript (node-oracledb), mongosh commands
- Results rendered as: formatted JSON (pretty-printed), tabular (for relational results), raw
- Query history with re-run capability
- Execution timer (shows query duration)

**Step 6: Results Viewer**
- JSON results: syntax-highlighted, collapsible tree view
- Tabular results: sortable columns
- Execution plan viewer (EXPLAIN PLAN output, formatted)
- Side-by-side comparison mode (for "run the same query two ways" exercises)

---

## 4. Data Model: Financial Services Advisory Platform

The workshop uses a **financial services advisory platform** as its domain — the same domain used in Rick Houlihan's benchmark frameworks (Helix, BSON-JSON-bakeoff) and the real-world case study from LinkedIn Post #38 (60-second page loads reduced to 500ms via hybrid modeling).

This domain is ideal because it naturally requires:
- Document-shaped data (client profiles, account details)
- Relational integrity (advisor-client mappings, regulatory compliance)
- Complex queries (portfolio aggregation, advisor book ranking)
- Many-to-many relationships (advisors ↔ clients ↔ accounts)
- The "90/10 problem" where 90% of access patterns work great as documents but 10% desperately need relational joins

### 4.1 Relational Schema (Canonical Form)

```sql
-- Core entities
CREATE TABLE advisors (
    advisor_id    NUMBER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    first_name    VARCHAR2(100) NOT NULL,
    last_name     VARCHAR2(100) NOT NULL,
    email         VARCHAR2(255) UNIQUE NOT NULL,
    license_type  VARCHAR2(50),
    region        VARCHAR2(100),
    hire_date     DATE
);

CREATE TABLE clients (
    client_id     NUMBER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    first_name    VARCHAR2(100) NOT NULL,
    last_name     VARCHAR2(100) NOT NULL,
    email         VARCHAR2(255),
    risk_profile  VARCHAR2(20) CHECK (risk_profile IN ('conservative','moderate','aggressive')),
    onboard_date  DATE,
    status        VARCHAR2(20) DEFAULT 'active'
);

CREATE TABLE accounts (
    account_id    NUMBER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    client_id     NUMBER NOT NULL REFERENCES clients(client_id),
    account_type  VARCHAR2(50) NOT NULL,  -- 'brokerage', 'ira', '401k', 'trust'
    account_name  VARCHAR2(200),
    opened_date   DATE,
    status        VARCHAR2(20) DEFAULT 'active'
);

CREATE TABLE holdings (
    holding_id    NUMBER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    account_id    NUMBER NOT NULL REFERENCES accounts(account_id),
    symbol        VARCHAR2(20) NOT NULL,
    quantity      NUMBER(15,4) NOT NULL,
    cost_basis    NUMBER(15,2),
    market_value  NUMBER(15,2),
    last_updated  TIMESTAMP DEFAULT SYSTIMESTAMP
);

-- Many-to-many: advisors ↔ clients
CREATE TABLE advisor_client_map (
    advisor_id    NUMBER NOT NULL REFERENCES advisors(advisor_id),
    client_id     NUMBER NOT NULL REFERENCES clients(client_id),
    relationship  VARCHAR2(50),  -- 'primary', 'secondary', 'referral'
    assigned_date DATE,
    PRIMARY KEY (advisor_id, client_id)
);

-- Transactions / activity log (time-series characteristics)
CREATE TABLE transactions (
    txn_id        NUMBER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    account_id    NUMBER NOT NULL REFERENCES accounts(account_id),
    txn_type      VARCHAR2(20) NOT NULL,  -- 'buy', 'sell', 'dividend', 'transfer'
    symbol        VARCHAR2(20),
    quantity      NUMBER(15,4),
    price         NUMBER(15,2),
    total_amount  NUMBER(15,2),
    txn_date      TIMESTAMP DEFAULT SYSTIMESTAMP,
    notes         JSON  -- flexible metadata as JSON
);
```

### 4.2 Single-Table Design Collection

The workshop includes a single-table design pattern — the NoSQL modeling technique Rick Houlihan invented at AWS for DynamoDB. This demonstrates both the pattern itself and how Oracle's multi-value indexes make it dramatically more powerful than it ever was on DynamoDB.

In single-table design, heterogeneous entity types are stored in one collection, differentiated by a type discriminator and generic key attributes. Access patterns are served by indexes on those generic keys.

```sql
-- Single-table collection for the advisory platform
CREATE JSON COLLECTION TABLE advisory_entities;

-- Sample documents (multiple entity types in one collection):

-- Type: advisor
-- {
--   "pk": "ADVISOR#5",
--   "sk": "PROFILE",
--   "entityType": "advisor",
--   "gsi1pk": "REGION#northeast",
--   "gsi1sk": "ADVISOR#5",
--   "data": {
--     "firstName": "Maria",
--     "lastName": "Santos",
--     "email": "maria.santos@firm.com",
--     "licenseType": "Series 7",
--     "region": "northeast",
--     "hireDate": "2019-03-15"
--   }
-- }

-- Type: client (under advisor partition)
-- {
--   "pk": "ADVISOR#5",
--   "sk": "CLIENT#1001",
--   "entityType": "client",
--   "gsi1pk": "CLIENT#1001",
--   "gsi1sk": "ACCOUNT_SUMMARY",
--   "data": {
--     "firstName": "John",
--     "lastName": "Smith",
--     "email": "john.smith@email.com",
--     "riskProfile": "aggressive",
--     "totalValue": 485000,
--     "accountCount": 3
--   }
-- }

-- Type: holding (with tags array for multi-value index demo)
-- {
--   "pk": "ACCOUNT#2001",
--   "sk": "HOLDING#AAPL",
--   "entityType": "holding",
--   "gsi1pk": "SYMBOL#AAPL",
--   "gsi1sk": "ACCOUNT#2001",
--   "data": {
--     "symbol": "AAPL",
--     "quantity": 150,
--     "costBasis": 22500,
--     "marketValue": 31500,
--     "sectors": ["technology", "consumer_electronics", "services"],
--     "tags": ["large_cap", "dividend", "sp500", "nasdaq100"],
--     "lastUpdated": "2026-03-28T16:00:00Z"
--   }
-- }

-- Type: transaction
-- {
--   "pk": "ACCOUNT#2001",
--   "sk": "TXN#2026-03-28T14:30:00Z",
--   "entityType": "transaction",
--   "gsi1pk": "SYMBOL#AAPL",
--   "gsi1sk": "TXN#2026-03-28T14:30:00Z",
--   "data": {
--     "txnType": "buy",
--     "symbol": "AAPL",
--     "quantity": 50,
--     "price": 210.00,
--     "totalAmount": 10500,
--     "tags": ["rebalance", "q1_allocation"]
--   }
-- }
```

### 4.3 JSON Collection Table (Interactions Log)

```sql
-- Client interaction log as a pure document collection
CREATE JSON COLLECTION TABLE client_interactions;

-- Sample document:
-- {
--   "client_id": 1001,
--   "advisor_id": 5,
--   "type": "meeting",
--   "date": "2026-03-15T10:30:00Z",
--   "channel": "in-person",
--   "summary": "Quarterly portfolio review. Client concerned about tech exposure.",
--   "action_items": [
--     {"task": "Rebalance tech allocation to < 30%", "due": "2026-03-22", "status": "pending"},
--     {"task": "Send updated risk assessment", "due": "2026-03-18", "status": "complete"}
--   ],
--   "sentiment": "cautious",
--   "follow_up_required": true
-- }
```

### 4.4 JSON Duality Views (Projected Shapes)

**Client Portfolio View** — document-shaped access to client + accounts + holdings:

```sql
CREATE OR REPLACE JSON RELATIONAL DUALITY VIEW client_portfolio_dv AS
SELECT JSON {
    '_id'         : c.client_id,
    'firstName'   : c.first_name,
    'lastName'    : c.last_name,
    'email'       : c.email,
    'riskProfile' : c.risk_profile,
    'status'      : c.status,
    'accounts'    : [
        SELECT JSON {
            'accountId'   : a.account_id,
            'accountType' : a.account_type,
            'accountName' : a.account_name,
            'status'      : a.status,
            'holdings'    : [
                SELECT JSON {
                    'holdingId'   : h.holding_id,
                    'symbol'      : h.symbol,
                    'quantity'    : h.quantity,
                    'costBasis'   : h.cost_basis,
                    'marketValue' : h.market_value
                }
                FROM holdings h WITH UPDATE
                WHERE h.account_id = a.account_id
            ]
        }
        FROM accounts a WITH INSERT UPDATE DELETE
        WHERE a.client_id = c.client_id
    ]
}
FROM clients c WITH INSERT UPDATE DELETE;
```

**Advisor Book View** — advisor-centric view with their client book:

```sql
CREATE OR REPLACE JSON RELATIONAL DUALITY VIEW advisor_book_dv AS
SELECT JSON {
    '_id'          : adv.advisor_id,
    'firstName'    : adv.first_name,
    'lastName'     : adv.last_name,
    'email'        : adv.email,
    'licenseType'  : adv.license_type,
    'region'       : adv.region,
    'clients'      : [
        SELECT JSON {
            'clientId'     : m.client_id,
            'relationship' : m.relationship,
            UNNEST(
                SELECT JSON {
                    'firstName'   : c.first_name,
                    'lastName'    : c.last_name,
                    'riskProfile' : c.risk_profile,
                    'status'      : c.status
                }
                FROM clients c WITH NOCHECK
                WHERE c.client_id = m.client_id
            )
        }
        FROM advisor_client_map m WITH INSERT UPDATE DELETE
        WHERE m.advisor_id = adv.advisor_id
    ]
}
FROM advisors adv WITH INSERT UPDATE DELETE;
```

**Transaction Feed View** — document-shaped transaction access with account context:

```sql
CREATE OR REPLACE JSON RELATIONAL DUALITY VIEW transaction_feed_dv AS
SELECT JSON {
    '_id'         : t.txn_id,
    'txnType'     : t.txn_type,
    'symbol'      : t.symbol,
    'quantity'    : t.quantity,
    'price'       : t.price,
    'totalAmount' : t.total_amount,
    'txnDate'     : t.txn_date,
    'notes'       : t.notes,
    UNNEST(
        SELECT JSON {
            'accountId'   : a.account_id,
            'accountType' : a.account_type,
            'accountName' : a.account_name
        }
        FROM accounts a WITH NOCHECK
        WHERE a.account_id = t.account_id
    )
}
FROM transactions t WITH INSERT UPDATE DELETE;
```

### 4.5 Sample Data Scale

| Table/Collection | Row Count | Notes |
|-----------------|-----------|-------|
| advisors | 20 | Across 4 regions |
| clients | 200 | Mixed risk profiles |
| accounts | 500 | 2-3 per client |
| holdings | 2,000 | 3-5 per account |
| advisor_client_map | 300 | Some clients have 2 advisors |
| transactions | 5,000 | 60 days of activity |
| client_interactions | 500 | JSON collection documents |
| advisory_entities | 3,000 | Single-table: ~20 advisors, ~200 clients, ~2000 holdings, ~800 transactions |

Small enough to load in seconds, large enough to demonstrate real query patterns.

---

## 5. Lab Modules (90-Minute Schedule)

### Timeline

```
 0:00 - 0:05  Welcome, connect, create workspace              [5 min]
 0:05 - 0:10  Module 0: The Big Picture                        [5 min]
 0:10 - 0:25  Module 1: JSON Collections & Document API        [15 min]
 0:25 - 0:45  Module 2: JSON Duality Views                     [20 min]
 0:45 - 1:05  Module 3: Single-Table Design & Multi-Value Idx  [20 min]
 1:05 - 1:20  Module 4: Hybrid Queries & JSON_TRANSFORM        [15 min]
 1:20 - 1:27  Module 5: Multi-Protocol Access                  [7 min]
 1:27 - 1:30  Wrap-up & Next Steps                             [3 min]
```

---

### Module 0: The Big Picture (5 min)

**Format:** Read-only, no exercises. Sets context.

**Content:**
- One data model. Five access paths: SQL, document API, REST, MongoDB wire protocol, JavaScript.
- The schema they'll work with: financial advisory platform
- Entity relationship diagram (visual)
- "By the end of this workshop, you'll have accessed the same data through all five paths — in the same transaction, with the same ACID guarantees."

---

### Module 1: JSON Collections & Document API (15 min)

**Objective:** Work with Oracle as a pure document database.

**Exercise 1.1: Explore the Collection (3 min)**
```sql
-- View documents in the interactions collection
SELECT json_serialize(data PRETTY) FROM client_interactions
FETCH FIRST 3 ROWS ONLY;

-- Count documents
SELECT COUNT(*) FROM client_interactions;
```

**Exercise 1.2: Query by Example (3 min)**
```sql
-- Find all meetings with follow-up required
SELECT json_serialize(data PRETTY)
FROM client_interactions ci
WHERE ci.data.type.string() = 'meeting'
  AND ci.data.follow_up_required.boolean() = TRUE;

-- Find interactions for a specific client
SELECT json_serialize(data PRETTY)
FROM client_interactions ci
WHERE ci.data.client_id.number() = 1001;
```

**Exercise 1.3: Insert a Document (3 min)**
```sql
-- Insert a new interaction
INSERT INTO client_interactions (data) VALUES (JSON('{
    "client_id": 1001,
    "advisor_id": 5,
    "type": "email",
    "date": "2026-03-30T14:00:00Z",
    "channel": "email",
    "summary": "Follow-up on rebalancing discussion.",
    "action_items": [],
    "sentiment": "positive",
    "follow_up_required": false
}'));
COMMIT;

-- Verify it's there
SELECT json_serialize(data PRETTY)
FROM client_interactions ci
WHERE ci.data.type.string() = 'email'
  AND ci.data.client_id.number() = 1001;
```

**Exercise 1.4: Update with JSON_TRANSFORM (4 min)**
```sql
-- Add an action item to an existing interaction
UPDATE client_interactions ci
SET ci.data = json_transform(ci.data,
    APPEND '$.action_items' = JSON('{"task":"Schedule Q2 review","due":"2026-04-15","status":"pending"}')
)
WHERE ci.data.client_id.number() = 1001
  AND ci.data.type.string() = 'meeting';
COMMIT;

-- Change sentiment
UPDATE client_interactions ci
SET ci.data = json_transform(ci.data,
    SET '$.sentiment' = 'optimistic'
)
WHERE ci.data.client_id.number() = 1001
  AND ci.data.type.string() = 'meeting';
COMMIT;
```

**Exercise 1.5: Create a Search Index and Full-Text Query (4 min)**
```sql
-- Create a JSON search index
CREATE SEARCH INDEX idx_interactions_search
ON client_interactions (data) FOR JSON;

-- Full-text search across all document fields
SELECT json_serialize(data PRETTY)
FROM client_interactions ci
WHERE JSON_TEXTCONTAINS(ci.data, '$.summary', 'rebalance');
```

**Exercise 1.6: Aggregate Documents with SQL (3 min)**
```sql
-- Count interactions by type
SELECT ci.data.type.string() AS interaction_type,
       COUNT(*) AS total
FROM client_interactions ci
GROUP BY ci.data.type.string()
ORDER BY total DESC;

-- Average action items per interaction
SELECT ci.data.type.string() AS interaction_type,
       AVG(json_value(ci.data, '$.action_items.size()' RETURNING NUMBER)) AS avg_actions
FROM client_interactions ci
GROUP BY ci.data.type.string();
```

**Checkpoint:** "You just used Oracle as a document database — no tables, no schema, no DDL for the documents themselves. But you also ran SQL aggregations over those documents. That's convergence."

---

### Module 2: JSON Duality Views (20 min)

**Objective:** Understand bidirectional document↔relational mapping. Write through documents, read through SQL, and vice versa.

**Exercise 2.1: Read Through the Document Lens (4 min)**
```sql
-- View a client as a rich document (with nested accounts and holdings)
SELECT json_serialize(data PRETTY)
FROM client_portfolio_dv
WHERE data."_id" = 1001;

-- View an advisor's book
SELECT json_serialize(data PRETTY)
FROM advisor_book_dv
WHERE data."_id" = 5;

-- View a transaction with account context (unnested)
SELECT json_serialize(data PRETTY)
FROM transaction_feed_dv
WHERE data."_id" = 1;
```

**Exercise 2.2: Read Through the Relational Lens (3 min)**
```sql
-- The SAME data, accessed relationally
SELECT c.first_name, c.last_name, c.risk_profile,
       a.account_type, a.account_name,
       h.symbol, h.quantity, h.market_value
FROM clients c
JOIN accounts a ON a.client_id = c.client_id
JOIN holdings h ON h.account_id = a.account_id
WHERE c.client_id = 1001
ORDER BY a.account_type, h.market_value DESC;
```

**Checkpoint:** "Same data. Two access patterns. One source of truth. No sync. No ETL. No eventual consistency."

**Exercise 2.3: Write Through the Document API (5 min)**
```sql
-- Insert a new client WITH accounts and holdings — through the document API
INSERT INTO client_portfolio_dv (data) VALUES (JSON('{
    "firstName": "Sarah",
    "lastName": "Chen",
    "email": "sarah.chen@example.com",
    "riskProfile": "aggressive",
    "status": "active",
    "accounts": [
        {
            "accountType": "brokerage",
            "accountName": "Sarah Growth Portfolio",
            "status": "active",
            "holdings": [
                {"symbol": "NVDA", "quantity": 100, "costBasis": 85000, "marketValue": 120000},
                {"symbol": "MSFT", "quantity": 50, "costBasis": 20000, "marketValue": 22500}
            ]
        }
    ]
}'));
COMMIT;

-- Verify: the relational tables were populated automatically
SELECT * FROM clients WHERE email = 'sarah.chen@example.com';
SELECT a.* FROM accounts a JOIN clients c ON a.client_id = c.client_id
WHERE c.email = 'sarah.chen@example.com';
SELECT h.* FROM holdings h JOIN accounts a ON h.account_id = a.account_id
JOIN clients c ON a.client_id = c.client_id
WHERE c.email = 'sarah.chen@example.com';
```

**Checkpoint:** "One document insert. Three relational tables populated. Full referential integrity. One transaction."

**Exercise 2.4: Update Through the Document API (4 min)**
```sql
-- Update a holding's market value through the document shape
-- First, get the current document with its etag
SELECT json_serialize(data PRETTY)
FROM client_portfolio_dv
WHERE data.email.string() = 'sarah.chen@example.com';

-- Update using JSON_TRANSFORM through the duality view
UPDATE client_portfolio_dv dv
SET dv.data = json_transform(dv.data,
    SET '$.accounts[0].holdings[0].marketValue' = 135000
)
WHERE dv.data.email.string() = 'sarah.chen@example.com';
COMMIT;

-- Verify the relational table reflects the change
SELECT h.symbol, h.market_value
FROM holdings h
JOIN accounts a ON h.account_id = a.account_id
JOIN clients c ON a.client_id = c.client_id
WHERE c.email = 'sarah.chen@example.com';
```

**Exercise 2.5: Delete Through the Document API (3 min)**
```sql
-- Delete a client — cascades through the duality view directives
DELETE FROM client_portfolio_dv
WHERE data.email.string() = 'sarah.chen@example.com';
COMMIT;

-- Verify: relational tables cleaned up
SELECT COUNT(*) FROM clients WHERE email = 'sarah.chen@example.com';
SELECT COUNT(*) FROM accounts a WHERE NOT EXISTS (
    SELECT 1 FROM clients c WHERE c.client_id = a.client_id
);
```

**Exercise 2.6: Examine the Duality View Definition (3 min)**
```sql
-- See what tables back the duality view
SELECT * FROM user_json_duality_view_tabs
WHERE view_name = 'CLIENT_PORTFOLIO_DV';

-- See column mappings
SELECT * FROM user_json_duality_view_tab_cols
WHERE view_name = 'CLIENT_PORTFOLIO_DV';

-- See relationships
SELECT * FROM user_json_duality_view_links
WHERE view_name = 'CLIENT_PORTFOLIO_DV';
```

**Exercise 2.7: Create Your Own Duality View (3 min)**

Challenge exercise — developers write their own:

```sql
-- Create a "holdings summary" duality view that shows
-- each holding with its account and client context (unnested)
-- Hint: Use UNNEST to flatten account and client into the holding document

CREATE OR REPLACE JSON RELATIONAL DUALITY VIEW my_holdings_dv AS
-- YOUR CODE HERE
-- Expected shape:
-- {
--   "_id": <holding_id>,
--   "symbol": "AAPL",
--   "quantity": 100,
--   "marketValue": 22500,
--   "accountName": "Main Brokerage",
--   "clientName": "John Smith"
-- }
```

Provide the solution after 2 minutes:

```sql
CREATE OR REPLACE JSON RELATIONAL DUALITY VIEW my_holdings_dv AS
SELECT JSON {
    '_id'         : h.holding_id,
    'symbol'      : h.symbol,
    'quantity'    : h.quantity,
    'costBasis'   : h.cost_basis,
    'marketValue' : h.market_value,
    UNNEST(
        SELECT JSON {
            'accountName' : a.account_name,
            'accountType' : a.account_type,
            UNNEST(
                SELECT JSON {
                    'clientName' : c.first_name || ' ' || c.last_name,
                    'riskProfile': c.risk_profile
                }
                FROM clients c WITH NOCHECK
                WHERE c.client_id = a.client_id
            )
        }
        FROM accounts a WITH NOCHECK
        WHERE a.account_id = h.account_id
    )
}
FROM holdings h WITH UPDATE;
```

---

### Module 3: Single-Table Design & Multi-Value Indexes (20 min)

**Objective:** Demonstrate the single-table design pattern that Rick Houlihan invented at AWS for DynamoDB — and show how Oracle's multi-value indexes and SQL make it dramatically more powerful. Developers learn to model heterogeneous entities in a single JSON collection, index them for multiple access patterns, and query across entity types with SQL joins that DynamoDB could never support.

**Instructor Context (displayed in sidebar):**

> Single-table design was born from DynamoDB's constraints: no joins, no secondary indexes (initially), no aggregation. You stored all entity types in one table with generic key attributes (pk/sk) and designed every access pattern at modeling time. It worked — Amazon ran their entire retail operation on it. But it had real costs: query flexibility was frozen at design time, and any access pattern you didn't plan for required a table scan or a new GSI.
>
> MongoDB improved on DynamoDB by adding multikey indexes for arrays — but with painful constraints. You can't have two array fields in the same compound index (parallel arrays prohibition). Range queries on arrays don't use tight index bounds unless you wrap them in $elemMatch. Sorting on multikey fields forces a blocking sort. Array fields can't be shard keys. Most developers don't know about these gotchas until they hit them in production.
>
> Oracle changes the equation entirely. You get the locality benefits of single-table design — related entities co-located for efficient partition-key queries — plus SQL joins, multi-value indexes on arrays (with none of MongoDB's limitations), aggregation, window functions, and a cost-based optimizer. The constraints that created single-table design no longer apply. The benefits remain.

**Exercise 3.1: Explore the Single-Table Collection (3 min)**
```sql
-- See all entity types in one collection
SELECT data.entityType.string() AS entity_type,
       COUNT(*) AS count
FROM advisory_entities
GROUP BY data.entityType.string()
ORDER BY count DESC;

-- Query by partition key — get an advisor and all their clients
-- This is the core single-table access pattern: one query, multiple entity types
SELECT data.entityType.string() AS type,
       data.sk.string() AS sort_key,
       json_serialize(data.data PRETTY) AS payload
FROM advisory_entities
WHERE data.pk.string() = 'ADVISOR#5'
ORDER BY data.sk.string();

-- Query by sort key prefix — get just the clients for an advisor
SELECT data.data.firstName.string() || ' ' || data.data.lastName.string() AS client_name,
       data.data.riskProfile.string() AS risk_profile,
       data.data.totalValue.number() AS total_value
FROM advisory_entities
WHERE data.pk.string() = 'ADVISOR#5'
  AND data.sk.string() LIKE 'CLIENT#%'
ORDER BY data.data.totalValue.number() DESC;
```

**Checkpoint:** "One collection. Four entity types. Partition-key query returns an advisor with all their clients in a single round trip — the same access pattern that powered Amazon's retail operation."

**Exercise 3.2: Create Functional Indexes for Access Patterns (3 min)**
```sql
-- Primary access pattern: pk + sk (entity co-location)
CREATE INDEX idx_pk_sk ON advisory_entities (
    data.pk.string(),
    data.sk.string()
);

-- GSI equivalent: alternate access pattern (e.g., look up client across advisors)
CREATE INDEX idx_gsi1 ON advisory_entities (
    data.gsi1pk.string(),
    data.gsi1sk.string()
);

-- Use the GSI to find all holdings for a symbol across all accounts
SELECT data.pk.string() AS account,
       data.data.quantity.number() AS quantity,
       data.data.marketValue.number() AS market_value
FROM advisory_entities
WHERE data.gsi1pk.string() = 'SYMBOL#AAPL'
  AND data.entityType.string() = 'holding';

-- Verify index usage
EXPLAIN PLAN FOR
SELECT * FROM advisory_entities
WHERE data.pk.string() = 'ADVISOR#5'
  AND data.sk.string() LIKE 'CLIENT#%';
SELECT * FROM TABLE(DBMS_XPLAN.DISPLAY);
```

**Exercise 3.3: Multi-Value Indexes — Index Into Arrays (5 min)**

This is the game-changer. DynamoDB cannot index into arrays at all. MongoDB has multikey indexes but they come with significant architectural limitations that constrain real-world usage:

**MongoDB Multikey Index Limitations:**

| Limitation | Impact |
|-----------|--------|
| **Parallel arrays prohibition** | A compound index cannot have more than one array field per document. If you index `{tags: 1, sectors: 1}` and a document has both as arrays, the insert *fails*. This means you can't build composite indexes across multiple multi-valued attributes — a critical constraint for faceted search, multi-label classification, or any entity with multiple categorical arrays. |
| **No covered queries on arrays** | Queries that project array fields always require a document fetch (FETCH stage), even when the answer is fully contained in the index. This eliminates one of the primary performance benefits of indexing. |
| **Broken range bounds without $elemMatch** | `{scores: {$gte: 5, $lte: 10}}` does NOT create a tight `[5, 10]` range scan. MongoDB picks *one* bound and post-filters the other. Developers expect an index range scan and get a near-full scan instead. You must use `$elemMatch` to get correct bound intersection — and most developers don't know this. |
| **Blocking sort** | Sorting on a multikey-indexed field requires a blocking SORT stage — all results must be collected before any output, eliminating streaming. On large result sets, this kills latency. |
| **No shard key** | Array fields cannot be shard keys. In a sharded collection, your most queryable attributes (tags, categories) can't drive data distribution. |
| **Write amplification** | Every insert/update touching the array field must update N index entries (one per element). `$push`/`$pop` on indexed arrays show 2-3x latency increases. |
| **Unique semantics are counterintuitive** | Uniqueness is enforced across the *flattened* set of all array elements across all documents — not within a single document. Two documents with overlapping array elements violate uniqueness, even though they're distinct documents. |
| **100K key limit per document** | `indexMaxNumGeneratedKeysPerDocument` defaults to 100,000. Compound multikey indexes multiply: M elements x N elements = M*N keys. Large arrays or compound indexes can hit this ceiling. |
| **Hashed indexes cannot be multikey** | You cannot create a hashed index on an array field at all. Inserting an array into a hashed-indexed field fails. |
| **Index intersection avoided** | The query planner detects `isMultiKey: true` and frequently declines to use index intersection (combining two indexes for one query), regardless of whether the query actually touches the array field. |

**Oracle multi-value indexes have none of these limitations.** You can index multiple array fields independently, combine them in queries, get full B-tree semantics including range scans and sort optimization, and the cost-based optimizer handles the rest.

```sql
-- Create a multi-value index on the tags array
CREATE MULTIVALUE INDEX idx_tags ON advisory_entities ae
    (ae.data.data.tags.string());

-- Create a multi-value index on the sectors array
CREATE MULTIVALUE INDEX idx_sectors ON advisory_entities ae
    (ae.data.data.sectors.string());

-- Find all holdings tagged "dividend" — uses the multi-value index
SELECT data.data.symbol.string() AS symbol,
       data.data.quantity.number() AS quantity,
       data.data.marketValue.number() AS market_value,
       json_serialize(data.data.tags) AS tags
FROM advisory_entities ae
WHERE JSON_EXISTS(ae.data, '$.data.tags?(@ == "dividend")')
  AND ae.data.entityType.string() = 'holding';

-- Find holdings in the "technology" sector
SELECT data.data.symbol.string() AS symbol,
       data.data.marketValue.number() AS market_value,
       json_serialize(data.data.sectors) AS sectors
FROM advisory_entities ae
WHERE JSON_EXISTS(ae.data, '$.data.sectors?(@ == "technology")')
  AND ae.data.entityType.string() = 'holding';

-- Combine: find all S&P 500 holdings in the technology sector
SELECT data.data.symbol.string() AS symbol,
       data.data.marketValue.number() AS market_value
FROM advisory_entities ae
WHERE JSON_EXISTS(ae.data, '$.data.tags?(@ == "sp500")')
  AND JSON_EXISTS(ae.data, '$.data.sectors?(@ == "technology")')
  AND ae.data.entityType.string() = 'holding';

-- Verify multi-value index usage
EXPLAIN PLAN FOR
SELECT * FROM advisory_entities ae
WHERE JSON_EXISTS(ae.data, '$.data.tags?(@ == "dividend")');
SELECT * FROM TABLE(DBMS_XPLAN.DISPLAY);
```

**Checkpoint:** "You just indexed into two separate arrays and queried both in the same WHERE clause. On MongoDB, this insert would *fail* — the parallel arrays prohibition prevents compound indexing across multiple array fields in the same document. On DynamoDB, array indexing doesn't exist at all. On Oracle, it's a standard B-tree with full range scan, sort optimization, and covered query support. In a financial platform, this means you can tag holdings with sectors, risk categories, compliance labels, and any other multi-valued classification — index all of them independently — and query any combination at index speed."

**Exercise 3.4: SQL Superpowers on Single-Table Data (5 min)**

The queries that single-table design on DynamoDB could never support — but Oracle handles natively.

```sql
-- CROSS-ENTITY AGGREGATION: Total portfolio value by advisor
-- On DynamoDB this would require multiple queries + client-side aggregation
SELECT adv.data.data.firstName.string() || ' ' || adv.data.data.lastName.string() AS advisor,
       COUNT(DISTINCT h.data.pk.string()) AS accounts,
       SUM(h.data.data.marketValue.number()) AS total_aum
FROM advisory_entities adv
JOIN advisory_entities cl
    ON cl.data.pk.string() = adv.data.pk.string()
    AND cl.data.entityType.string() = 'client'
JOIN advisory_entities h
    ON h.data.pk.string() = 'ACCOUNT#' ||
       JSON_VALUE(cl.data, '$.gsi1pk' RETURNING VARCHAR2)
    AND h.data.entityType.string() = 'holding'
WHERE adv.data.entityType.string() = 'advisor'
GROUP BY adv.data.data.firstName.string(), adv.data.data.lastName.string()
ORDER BY total_aum DESC;

-- TAG ANALYTICS: Holdings count by tag (across entire book)
-- Impossible on DynamoDB without a full table scan
SELECT jt.tag,
       COUNT(*) AS holding_count,
       SUM(ae.data.data.marketValue.number()) AS total_value
FROM advisory_entities ae,
JSON_TABLE(ae.data, '$.data.tags[*]' COLUMNS (tag VARCHAR2(50) PATH '$')) jt
WHERE ae.data.entityType.string() = 'holding'
GROUP BY jt.tag
ORDER BY total_value DESC;

-- SECTOR EXPOSURE REPORT: Market value by sector with percentage
WITH sector_values AS (
    SELECT jt.sector,
           SUM(ae.data.data.marketValue.number()) AS sector_value
    FROM advisory_entities ae,
    JSON_TABLE(ae.data, '$.data.sectors[*]' COLUMNS (sector VARCHAR2(50) PATH '$')) jt
    WHERE ae.data.entityType.string() = 'holding'
    GROUP BY jt.sector
)
SELECT sector,
       sector_value,
       ROUND(sector_value / SUM(sector_value) OVER () * 100, 1) AS pct_of_portfolio
FROM sector_values
ORDER BY sector_value DESC;
```

**Exercise 3.5: Multi-Value Index + Duality View — Best of All Worlds (4 min)**

Show that single-table design and Duality Views are complementary, not competing patterns.

```sql
-- The single-table collection gives you NoSQL-style access patterns
-- The relational tables give you Duality Views with document projections
-- They can coexist and even reference the same data

-- Query: Find clients whose holdings include "dividend" tagged securities
-- using the multi-value index on the single-table collection,
-- then join to the relational model for the full client document
SELECT json_serialize(cp.data PRETTY) AS client_portfolio
FROM advisory_entities ae
JOIN clients c ON c.client_id = TO_NUMBER(
    REPLACE(ae.data.pk.string(), 'ACCOUNT#', '')
)
JOIN client_portfolio_dv cp ON cp.data."_id".number() = c.client_id
WHERE JSON_EXISTS(ae.data, '$.data.tags?(@ == "dividend")')
  AND ae.data.entityType.string() = 'holding';

-- This is the convergence thesis in action:
-- Multi-value index (NoSQL pattern) → identifies matching records
-- SQL JOIN (relational pattern) → navigates relationships
-- Duality View (document projection) → shapes the output
-- One query. One transaction. One optimizer.
```

**Checkpoint:** "Single-table design was invented to work around DynamoDB's constraints. On Oracle, those constraints don't exist — but the locality benefits remain. Add multi-value indexes, SQL joins, and aggregation, and you get a modeling pattern that's strictly more powerful than what it was designed for. The constraints that created it no longer apply. The benefits stay."

---

### Module 4: Hybrid Queries & JSON_TRANSFORM (15 min)

**Objective:** Combine relational SQL power with JSON document flexibility. Demonstrate why "90% document, 10% relational" is solved by convergence.

**Exercise 4.1: The 90/10 Problem — Top Advisor Books (5 min)**

This is the real-world case study: advisor landing page showing top 50 clients by book value.

```sql
-- The document approach: try to get advisor books sorted by total value
-- In MongoDB, this would require $lookup + $unwind + $group + $sort
-- which causes the 60-second page load at scale

-- The hybrid approach: relational index + JSON projection
-- Step 1: Create the relational index that makes this fast
CREATE INDEX idx_advisor_book_value ON advisor_client_map (advisor_id);

-- Step 2: Query using SQL joins for the heavy lifting,
-- project as JSON for the API consumer
SELECT JSON {
    'advisorId'    : adv.advisor_id,
    'advisorName'  : adv.first_name || ' ' || adv.last_name,
    'topClients'   : (
        SELECT JSON_ARRAYAGG(
            JSON {
                'clientName'  : c.first_name || ' ' || c.last_name,
                'totalValue'  : client_totals.total_value,
                'accountCount': client_totals.account_count
            }
            ORDER BY client_totals.total_value DESC
        )
        FROM advisor_client_map m
        JOIN clients c ON c.client_id = m.client_id
        JOIN (
            SELECT a.client_id,
                   SUM(h.market_value) AS total_value,
                   COUNT(DISTINCT a.account_id) AS account_count
            FROM accounts a
            JOIN holdings h ON h.account_id = a.account_id
            GROUP BY a.client_id
        ) client_totals ON client_totals.client_id = m.client_id
        WHERE m.advisor_id = adv.advisor_id
    )
} AS advisor_dashboard
FROM advisors adv
WHERE adv.advisor_id = 5;
```

**Checkpoint:** "This query returns a document. But under the hood, it used B-tree indexes, hash joins, and a cost-based optimizer with 40 years of battle scars. No aggregation pipeline. No 16MB output limit. No runtime sort. Index-driven, O(log N)."

**Exercise 4.2: JSON_TABLE — Shred Documents into Rows (5 min)**
```sql
-- Shred interaction action items into relational rows for reporting
SELECT ci.data.client_id.number() AS client_id,
       ci.data.type.string() AS interaction_type,
       ci.data.date.string() AS interaction_date,
       jt.task,
       jt.due_date,
       jt.status
FROM client_interactions ci,
JSON_TABLE(ci.data, '$.action_items[*]'
    COLUMNS (
        task     VARCHAR2(200) PATH '$.task',
        due_date VARCHAR2(20)  PATH '$.due',
        status   VARCHAR2(20)  PATH '$.status'
    )
) jt
WHERE jt.status = 'pending'
ORDER BY jt.due_date;
```

**Exercise 4.3: JSON_TRANSFORM — Surgical Document Updates (5 min)**
```sql
-- Batch update: mark all overdue action items as "overdue"
UPDATE client_interactions ci
SET ci.data = json_transform(ci.data,
    NESTED PATH '$.action_items[*]'
    (SET '@.status' = 'overdue'
     WHERE '@.status' = 'pending'
       AND '@.due' < '2026-03-30')
)
WHERE JSON_EXISTS(ci.data, '$.action_items[*]?(@.status == "pending")');
COMMIT;

-- Use KEEP for projection (return only specific fields)
SELECT json_serialize(
    json_transform(data, KEEP '$.client_id', '$.type', '$.sentiment')
    PRETTY
) AS summary
FROM client_interactions
FETCH FIRST 5 ROWS ONLY;

-- Use REMOVE to strip fields before sending to API
SELECT json_serialize(
    json_transform(data, REMOVE '$.action_items', REMOVE '$.follow_up_required')
    PRETTY
) AS public_summary
FROM client_interactions
WHERE data.client_id.number() = 1001;
```

**Exercise 4.4: Cross-Model Join — Collections + Relational (5 min)**
```sql
-- Join the JSON collection with relational tables
-- "Show me all interactions for clients with aggressive risk profiles"
SELECT c.first_name || ' ' || c.last_name AS client_name,
       c.risk_profile,
       ci.data.type.string() AS interaction_type,
       ci.data.date.string() AS interaction_date,
       ci.data.summary.string() AS summary
FROM client_interactions ci
JOIN clients c ON c.client_id = ci.data.client_id.number()
WHERE c.risk_profile = 'aggressive'
ORDER BY ci.data.date.string() DESC;

-- Combine duality view data with collection data in one query
SELECT JSON {
    'client'       : (SELECT json_serialize(data) FROM client_portfolio_dv
                      WHERE data."_id".number() = ci.data.client_id.number()),
    'interactions' : JSON_ARRAYAGG(
        json_transform(ci.data, KEEP '$.type', '$.date', '$.summary', '$.sentiment')
    )
} AS client_360
FROM client_interactions ci
WHERE ci.data.client_id.number() = 1001
GROUP BY ci.data.client_id.number();
```

---

### Module 5: Multi-Protocol Access (7 min)

**Objective:** Access the same data through MongoDB wire protocol and JavaScript. Prove protocol convergence.

**Exercise 5.1: MongoDB API via mongosh (4 min)**

The workshop app provides a built-in terminal panel, or developers can use the connection string directly.

```javascript
// Connect to Oracle through MongoDB wire protocol
// mongosh 'mongodb://user:pass@host:27017/user?authMechanism=PLAIN&authSource=$external&ssl=true&retryWrites=false&loadBalanced=true&tlsAllowInvalidCertificates=true'

// List collections (includes both JSON collections and Duality Views)
show collections

// Query a collection
db.CLIENT_INTERACTIONS.find({"client_id": 1001}).limit(3)

// Query a Duality View as if it were a MongoDB collection
db.CLIENT_PORTFOLIO_DV.find({"_id": 1001})

// Insert through MongoDB API — writes to relational tables via Duality View
db.CLIENT_PORTFOLIO_DV.insertOne({
    "firstName": "Workshop",
    "lastName": "Developer",
    "email": "dev@workshop.local",
    "riskProfile": "moderate",
    "status": "active",
    "accounts": []
})

// Verify via SQL (switch to SQL editor tab)
// SELECT * FROM clients WHERE email = 'dev@workshop.local';

// Aggregation pipeline
db.CLIENT_INTERACTIONS.aggregate([
    {$match: {"type": "meeting"}},
    {$group: {_id: "$advisor_id", count: {$sum: 1}}},
    {$sort: {count: -1}}
])

// Clean up
db.CLIENT_PORTFOLIO_DV.deleteOne({"email": "dev@workshop.local"})
```

**Checkpoint:** "You just wrote to relational tables using the MongoDB wire protocol. A MongoDB application can connect to Oracle without changing a single line of driver code."

**Exercise 5.2: JavaScript with node-oracledb (3 min)**

The query editor provides a JavaScript execution mode using the embedded node-oracledb connection.

```javascript
// The workshop app executes this server-side via node-oracledb

// 1. Query a Duality View — returns native JavaScript objects
const result = await connection.execute(
    `SELECT data FROM client_portfolio_dv WHERE data."_id" = :id`,
    { id: 1001 },
    { outFormat: oracledb.OUT_FORMAT_OBJECT }
);
const clientDoc = result.rows[0].DATA;
console.log('Client:', clientDoc.firstName, clientDoc.lastName);
console.log('Accounts:', clientDoc.accounts.length);
console.log('First holding:', clientDoc.accounts[0].holdings[0].symbol);

// 2. Insert via JSON type binding
const newInteraction = {
    client_id: 1001,
    advisor_id: 5,
    type: "workshop_test",
    date: new Date().toISOString(),
    channel: "api",
    summary: "Inserted from JavaScript via node-oracledb",
    action_items: [],
    sentiment: "excited",
    follow_up_required: false
};

await connection.execute(
    `INSERT INTO client_interactions (data) VALUES (:doc)`,
    { doc: { val: newInteraction, type: oracledb.DB_TYPE_JSON } }
);
await connection.commit();

// 3. SODA API — document-store interface
const soda = connection.getSodaDatabase();
const collection = await soda.openCollection('CLIENT_INTERACTIONS');

// Query by example
const docs = await collection.find()
    .filter({"client_id": 1001, "type": "workshop_test"})
    .getDocuments();

for (const doc of docs) {
    console.log(JSON.stringify(doc.getContent(), null, 2));
}

// Clean up
await collection.find()
    .filter({"type": "workshop_test"})
    .remove();
await connection.commit();
```

---

### Wrap-Up (3 min)

**On-screen summary:**

```
What you just did in 90 minutes:

  [x] Queried JSON documents with SQL
  [x] Inserted documents that populated relational tables
  [x] Updated relational data through document APIs
  [x] Ran SQL aggregations over document collections
  [x] Modeled heterogeneous entities with single-table design
  [x] Created multi-value indexes on JSON arrays
  [x] Ran cross-entity SQL joins on single-table data
  [x] Shredded JSON arrays into relational rows
  [x] Joined collections with relational tables
  [x] Accessed Duality Views through MongoDB wire protocol
  [x] Used JavaScript to read/write through all APIs
  [x] Created your own Duality View

All of this:
  - One database
  - One transaction
  - One source of truth
  - Zero sync lag
  - Zero ETL
  - Full ACID

"Model the domain. Project the access."
```

**Next steps panel:**
- Links to Oracle documentation
- Link to Rick Houlihan's LinkedIn content
- Link to "The Elements of Data" book
- QR code for follow-up

---

## 6. Workshop Web Application — Technical Specification

### 6.1 Project Structure

```
oracle-json-workshop/
├── docker-compose.yml
├── Dockerfile                    # Workshop web app (Node.js)
├── Dockerfile.oracle             # Custom Oracle 26ai + ORDS image
├── package.json
├── docs/
│   ├── workshop-specification.md # This document
│   └── implementation-plan.md    # Implementation plan + test strategy
├── scripts/
│   ├── entrypoint.sh             # Oracle container entrypoint (starts DB + ORDS)
│   ├── install-ords.sh           # ORDS installation script (runs during image build)
│   └── bundle.sh                 # Save images to tarball for offline deployment
├── init/                         # Oracle init scripts (run on first container startup)
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
│   ├── server.js                 # Express app entry point
│   ├── config.js                 # Database connection config
│   ├── routes/
│   │   ├── auth.js               # User registration, login, session
│   │   ├── workspace.js          # Schema creation, teardown
│   │   ├── query.js              # SQL/JS/mongosh execution endpoints
│   │   ├── labs.js               # Lab content serving, progress tracking
│   │   └── admin.js              # Instructor dashboard
│   ├── services/
│   │   ├── database.js           # Connection pool, query execution
│   │   ├── workspace.js          # Schema cloning, user provisioning
│   │   ├── validator.js          # Lab exercise answer validation
│   │   └── mongosh.js            # MongoDB API proxy/executor
│   ├── middleware/
│   │   ├── auth.js               # Session authentication
│   │   └── rateLimit.js          # Query execution rate limiting
│   └── labs/                     # Lab content as structured JSON/Markdown
│       ├── module-0-big-picture.json
│       ├── module-1-json-collections.json
│       ├── module-2-duality-views.json
│       ├── module-3-single-table-multivalue.json
│       ├── module-4-hybrid-queries.json
│       └── module-5-multi-protocol.json
├── public/
│   ├── index.html                # Landing page
│   ├── css/
│   │   └── workshop.css          # Workshop styles (Oracle branding)
│   ├── js/
│   │   ├── app.js                # Main app logic
│   │   ├── editor.js             # CodeMirror integration
│   │   ├── results.js            # Result rendering (JSON tree, table, plan)
│   │   ├── labs.js               # Lab navigation, progress tracking
│   │   └── terminal.js           # mongosh terminal emulation
│   └── img/
│       ├── oracle-logo.svg
│       └── erd.svg               # Entity relationship diagram
└── CLAUDE.md                     # Project-specific Claude instructions
```

### 6.2 Key Endpoints

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/` | Landing page |
| POST | `/api/register` | Create workspace (schema + clone data) |
| POST | `/api/login` | Resume existing workspace |
| GET | `/api/labs/:moduleId` | Get lab content |
| POST | `/api/query/sql` | Execute SQL, return results |
| POST | `/api/query/js` | Execute JavaScript (node-oracledb), return results |
| POST | `/api/query/mongo` | Execute MongoDB command via Oracle MongoDB API |
| POST | `/api/labs/:moduleId/check/:exerciseId` | Validate exercise answer |
| GET | `/api/progress` | Get user's lab completion status |
| GET | `/admin` | Instructor dashboard (user count, progress overview) |
| DELETE | `/admin/workspaces/:userId` | Tear down a workspace |
| DELETE | `/admin/workspaces` | Tear down all workspaces |

### 6.3 Workspace Provisioning

When a developer registers:

1. Generate a unique schema name: `WS_<short_uuid>` (e.g., `WS_A7F3`)
2. Create the Oracle user with appropriate grants:
   ```sql
   CREATE USER ws_a7f3 IDENTIFIED BY <generated_password>
       QUOTA UNLIMITED ON DATA;
   GRANT DB_DEVELOPER_ROLE TO ws_a7f3;
   GRANT SODA_APP TO ws_a7f3;
   ```
3. Connect as the new user and execute the schema creation scripts (tables, duality views, sample data)
4. Enable ORDS for the schema (enables REST and MongoDB API access)
5. Store workspace metadata in the admin schema's `workshop_users` table
6. Return credentials to the developer's browser (stored in session)

### 6.4 Query Execution Security

**Critical:** Developers execute arbitrary SQL. Security measures:

- **Schema isolation:** Each developer's queries run against their own schema only. Connection uses their dedicated credentials.
- **Connection pooling:** One pool per active workspace, capped at 2 connections per user.
- **Statement timeout:** 30-second maximum execution time per query.
- **Rate limiting:** Max 10 queries per second per user.
- **Read-only mode toggle:** Instructor can lock workspaces to read-only for demos.
- **Blocked operations:** `DROP USER`, `ALTER SYSTEM`, `CREATE DIRECTORY`, `GRANT`, and other DDL that escapes the user's schema are blocked at the application layer.
- **No PL/SQL execution:** Block `BEGIN/END`, `DECLARE`, `CREATE PROCEDURE/FUNCTION/PACKAGE` to prevent privilege escalation. Allow only SQL and the specific PL/SQL needed for SODA operations (whitelisted patterns).

### 6.5 Query Editor Features

- **Multi-tab:** SQL, JavaScript, and mongosh tabs
- **CodeMirror 6** with:
  - SQL syntax highlighting (Oracle dialect)
  - JavaScript syntax highlighting
  - Auto-completion for table/view names, JSON path expressions
  - Multiple cursors
  - Line numbers
- **Execute button** (Ctrl+Enter / Cmd+Enter for current statement)
- **Results panel:**
  - JSON mode: collapsible tree with syntax highlighting
  - Table mode: sortable columns, pagination
  - Plan mode: formatted EXPLAIN PLAN output
  - Text mode: raw output
  - Timing: execution duration in milliseconds
- **Query history:** Last 50 queries, searchable, re-runnable
- **"Copy to Editor" buttons** on all lab code snippets

### 6.6 Instructor Dashboard

Accessible at `/admin` (password-protected):

- **Active users:** Count, list with schema names
- **Progress heatmap:** Which modules/exercises each developer has completed
- **Query activity:** Recent queries across all workspaces (for troubleshooting)
- **Bulk actions:**
  - Reset all workspaces (re-clone data)
  - Lock all workspaces (read-only mode)
  - Tear down all workspaces (cleanup)
- **Environment status:** Database health, ORDS status, MongoDB API status

---

## 7. Docker Compose Configuration

```yaml
version: "3.8"

services:
  oracle:
    build:
      context: .
      dockerfile: Dockerfile.oracle
    container_name: workshop-oracle
    ports:
      - "1521:1521"
      - "8181:8181"
      - "27017:27017"
    environment:
      ORACLE_PASSWORD: "${ORACLE_PASSWORD:-WorkshopAdmin2026}"
      APP_USER: "WORKSHOP_ADMIN"
      APP_USER_PASSWORD: "${APP_USER_PASSWORD:-WorkshopApp2026}"
    volumes:
      - oracle-data:/opt/oracle/oradata
    healthcheck:
      test: ["CMD-SHELL", "healthcheck.sh && curl -sf http://localhost:8181/ords/_/health || exit 1"]
      interval: 15s
      timeout: 10s
      retries: 20
      start_period: 90s
    deploy:
      resources:
        limits:
          cpus: "2"
          memory: 4G

  app:
    build:
      context: .
      dockerfile: Dockerfile
    container_name: workshop-app
    ports:
      - "3000:3000"
    environment:
      DB_USER: "WORKSHOP_ADMIN"
      DB_PASSWORD: "${APP_USER_PASSWORD:-WorkshopApp2026}"
      DB_CONNECT_STRING: "workshop-oracle:1521/FREEPDB1"
      ORDS_BASE_URL: "http://workshop-oracle:8181/ords"
      MONGODB_URI: "mongodb://workshop-oracle:27017"
      SESSION_SECRET: "${SESSION_SECRET:-workshop-secret-change-me}"
      ADMIN_PASSWORD: "${INSTRUCTOR_PASSWORD:-instructor2026}"
      NODE_ENV: "production"
    depends_on:
      oracle:
        condition: service_healthy
    restart: unless-stopped

volumes:
  oracle-data:
```

### Build & Deploy

```bash
# First time (requires internet to pull base images + ORDS zip):
docker compose build          # Builds both images
docker compose up             # Starts Oracle+ORDS and App

# For air-gapped environments — build once, deploy anywhere:
docker compose build
docker save workshop-oracle workshop-app | gzip > workshop-images.tar.gz

# On the air-gapped instructor laptop:
docker load < workshop-images.tar.gz
docker compose up
```

---

## 8. Technologies Covered (Summary Matrix)

| Technology | Module | Exercise Type |
|-----------|--------|---------------|
| JSON Collection Tables | M1 | Create, query, insert, update, delete |
| OSON binary format | M0 | Conceptual (why O(1) matters) |
| Dot notation | M1, M2, M3 | Query filtering, field access |
| JSON_VALUE / JSON_QUERY | M1 | Scalar and object extraction |
| JSON_TRANSFORM | M1, M4 | SET, APPEND, REMOVE, NESTED PATH, KEEP |
| JSON_MERGEPATCH | M2 | Document-level updates |
| JSON_TABLE | M3, M4 | Array shredding to relational rows |
| JSON_OBJECT / JSON_ARRAYAGG | M4 | Relational-to-JSON projection |
| JSON Search Index | M1 | Full-text search over JSON |
| JSON Duality Views (SQL syntax) | M2 | Create, read, write, delete, UNNEST, NOCHECK |
| Duality View metadata | M2 | Diagnostic views |
| Optimistic locking (ETAG) | M2 | Concurrent update handling |
| Single-table design pattern | M3 | Heterogeneous entities, pk/sk, GSI patterns |
| Multi-value indexes (MULTIVALUE INDEX) | M3 | Index into JSON arrays, tag/sector queries |
| Functional indexes on JSON | M3 | Composite indexes on JSON paths |
| Cross-entity SQL joins on documents | M3 | Aggregation, analytics on single-table data |
| ORDS REST endpoints | M5 | AutoREST over Duality Views |
| MongoDB API (mongosh) | M5 | find, insertOne, aggregate, deleteOne |
| node-oracledb (thin mode) | M5 | Query, insert, SODA API |
| SODA API | M5 | Collection open, QBE filter, insert, remove |
| Hybrid JSON + Relational joins | M4 | Cross-model queries |
| Execution plans | M3, M4 | EXPLAIN PLAN on indexed and hybrid queries |

---

## 9. Stretch Goals (Post-MVP)

If time allows or for a future extended version:

1. **Vector search module** — Add embeddings to client interaction summaries, demonstrate semantic search + JSON + relational in one query using `SELECT JSON {}`
2. **Graph module** — Model advisor referral networks using SQL/PGQ, query with `GRAPH_TABLE()` alongside JSON
3. **Live benchmark panel** — Run BSON vs OSON field access benchmarks in-browser, display results in real-time chart
4. **Migration simulator** — Paste a MongoDB aggregation pipeline, see the Oracle SQL equivalent (using MongoPLSQL-Bridge logic)
5. **APEX integration** — Show how to build a low-code app on top of Duality Views in 10 minutes
6. **Multi-language support** — Add Python (python-oracledb) and Java (JDBC) execution tabs

---

## 10. Success Criteria

The workshop is successful when developers leave understanding:

1. **Oracle is a document database** — not just a relational database that supports JSON as an afterthought
2. **Duality Views eliminate the document-vs-relational tradeoff** — you get both, with full ACID, from the same tables
3. **Single-table design is more powerful on Oracle** — you get the locality benefits without the constraints that created the pattern, plus multi-value indexes, SQL joins, and aggregation that DynamoDB and MongoDB cannot match
4. **Multi-value indexes change what's queryable** — indexing into arrays enables tag-based, category-based, and multi-attribute queries at B-tree speed
5. **The MongoDB API means zero migration friction** — existing MongoDB applications can connect without code changes
6. **Hybrid queries are the superpower** — combining relational joins with document flexibility in a single statement solves problems that neither model handles alone
7. **One database, five access paths** — SQL, documents, REST, MongoDB wire protocol, and programmatic APIs all hit the same source of truth
