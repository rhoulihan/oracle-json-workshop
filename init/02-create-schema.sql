-- 02-create-schema.sql
-- Creates the relational tables for the financial advisory platform.
-- Runs as SYS, creates objects in WORKSHOP_ADMIN schema.

ALTER SESSION SET CONTAINER = FREEPDB1;
ALTER SESSION SET CURRENT_SCHEMA = WORKSHOP_ADMIN;

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
    risk_profile  VARCHAR2(20) CHECK (risk_profile IN ('conservative', 'moderate', 'aggressive')),
    onboard_date  DATE,
    status        VARCHAR2(20) DEFAULT 'active'
);

CREATE TABLE accounts (
    account_id    NUMBER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    client_id     NUMBER NOT NULL REFERENCES clients(client_id),
    account_type  VARCHAR2(50) NOT NULL,
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

CREATE TABLE advisor_client_map (
    advisor_id    NUMBER NOT NULL REFERENCES advisors(advisor_id),
    client_id     NUMBER NOT NULL REFERENCES clients(client_id),
    relationship  VARCHAR2(50),
    assigned_date DATE,
    PRIMARY KEY (advisor_id, client_id)
);

CREATE TABLE transactions (
    txn_id        NUMBER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    account_id    NUMBER NOT NULL REFERENCES accounts(account_id),
    txn_type      VARCHAR2(20) NOT NULL,
    symbol        VARCHAR2(20),
    quantity      NUMBER(15,4),
    price         NUMBER(15,2),
    total_amount  NUMBER(15,2),
    txn_date      TIMESTAMP DEFAULT SYSTIMESTAMP,
    notes         JSON
);

COMMIT;
