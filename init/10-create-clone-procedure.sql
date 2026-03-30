-- 10-create-clone-procedure.sql
-- PL/SQL procedures to clone the workshop schema for each developer
-- and to tear down a developer workspace.

ALTER SESSION SET CONTAINER = FREEPDB1;
ALTER SESSION SET CURRENT_SCHEMA = WORKSHOP_ADMIN;

CREATE OR REPLACE PROCEDURE clone_schema(
  p_username IN VARCHAR2,
  p_password IN VARCHAR2
) AUTHID CURRENT_USER AS
  v_username VARCHAR2(128) := UPPER(p_username);
BEGIN
  -- Create user
  EXECUTE IMMEDIATE 'CREATE USER ' || DBMS_ASSERT.SIMPLE_SQL_NAME(v_username) ||
    ' IDENTIFIED BY "' || p_password || '" QUOTA UNLIMITED ON USERS';

  -- Grant privileges
  EXECUTE IMMEDIATE 'GRANT CREATE SESSION TO ' || v_username;
  EXECUTE IMMEDIATE 'GRANT DB_DEVELOPER_ROLE TO ' || v_username;
  EXECUTE IMMEDIATE 'GRANT SODA_APP TO ' || v_username;
  EXECUTE IMMEDIATE 'GRANT UNLIMITED TABLESPACE TO ' || v_username;

  -- Create tables in the new schema (CTAS from workshop_admin)
  EXECUTE IMMEDIATE 'CREATE TABLE ' || v_username || '.advisors AS SELECT * FROM workshop_admin.advisors';
  EXECUTE IMMEDIATE 'CREATE TABLE ' || v_username || '.clients AS SELECT * FROM workshop_admin.clients';
  EXECUTE IMMEDIATE 'CREATE TABLE ' || v_username || '.accounts AS SELECT * FROM workshop_admin.accounts';
  EXECUTE IMMEDIATE 'CREATE TABLE ' || v_username || '.holdings AS SELECT * FROM workshop_admin.holdings';
  EXECUTE IMMEDIATE 'CREATE TABLE ' || v_username || '.advisor_client_map AS SELECT * FROM workshop_admin.advisor_client_map';
  EXECUTE IMMEDIATE 'CREATE TABLE ' || v_username || '.transactions AS SELECT * FROM workshop_admin.transactions';

  -- Add constraints (CTAS doesn't copy constraints)
  EXECUTE IMMEDIATE 'ALTER TABLE ' || v_username || '.advisors ADD PRIMARY KEY (advisor_id)';
  EXECUTE IMMEDIATE 'ALTER TABLE ' || v_username || '.advisors ADD UNIQUE (email)';
  EXECUTE IMMEDIATE 'ALTER TABLE ' || v_username || '.clients ADD PRIMARY KEY (client_id)';
  EXECUTE IMMEDIATE 'ALTER TABLE ' || v_username || '.clients ADD CHECK (risk_profile IN (''conservative'',''moderate'',''aggressive''))';
  EXECUTE IMMEDIATE 'ALTER TABLE ' || v_username || '.accounts ADD PRIMARY KEY (account_id)';
  EXECUTE IMMEDIATE 'ALTER TABLE ' || v_username || '.accounts ADD FOREIGN KEY (client_id) REFERENCES ' || v_username || '.clients(client_id)';
  EXECUTE IMMEDIATE 'ALTER TABLE ' || v_username || '.holdings ADD PRIMARY KEY (holding_id)';
  EXECUTE IMMEDIATE 'ALTER TABLE ' || v_username || '.holdings ADD FOREIGN KEY (account_id) REFERENCES ' || v_username || '.accounts(account_id)';
  EXECUTE IMMEDIATE 'ALTER TABLE ' || v_username || '.advisor_client_map ADD PRIMARY KEY (advisor_id, client_id)';
  EXECUTE IMMEDIATE 'ALTER TABLE ' || v_username || '.advisor_client_map ADD FOREIGN KEY (advisor_id) REFERENCES ' || v_username || '.advisors(advisor_id)';
  EXECUTE IMMEDIATE 'ALTER TABLE ' || v_username || '.advisor_client_map ADD FOREIGN KEY (client_id) REFERENCES ' || v_username || '.clients(client_id)';
  EXECUTE IMMEDIATE 'ALTER TABLE ' || v_username || '.transactions ADD PRIMARY KEY (txn_id)';
  EXECUTE IMMEDIATE 'ALTER TABLE ' || v_username || '.transactions ADD FOREIGN KEY (account_id) REFERENCES ' || v_username || '.accounts(account_id)';

  -- Create JSON collection tables and copy data
  EXECUTE IMMEDIATE 'CREATE JSON COLLECTION TABLE ' || v_username || '.client_interactions';
  EXECUTE IMMEDIATE 'INSERT INTO ' || v_username || '.client_interactions SELECT * FROM workshop_admin.client_interactions';
  EXECUTE IMMEDIATE 'CREATE JSON COLLECTION TABLE ' || v_username || '.advisory_entities';
  EXECUTE IMMEDIATE 'INSERT INTO ' || v_username || '.advisory_entities SELECT * FROM workshop_admin.advisory_entities';

  -- Create duality views in the new schema
  EXECUTE IMMEDIATE '
    CREATE JSON RELATIONAL DUALITY VIEW ' || v_username || '.client_portfolio_dv AS
    SELECT JSON {
      ''_id''         : c.client_id,
      ''firstName''   : c.first_name,
      ''lastName''    : c.last_name,
      ''email''       : c.email,
      ''riskProfile'' : c.risk_profile,
      ''status''      : c.status,
      ''accounts''    : [
        SELECT JSON {
          ''accountId''   : a.account_id,
          ''accountType'' : a.account_type,
          ''accountName'' : a.account_name,
          ''status''      : a.status,
          ''holdings''    : [
            SELECT JSON {
              ''holdingId''   : h.holding_id,
              ''symbol''      : h.symbol,
              ''quantity''    : h.quantity,
              ''costBasis''   : h.cost_basis,
              ''marketValue'' : h.market_value
            }
            FROM ' || v_username || '.holdings h WITH UPDATE
            WHERE h.account_id = a.account_id
          ]
        }
        FROM ' || v_username || '.accounts a WITH INSERT UPDATE DELETE
        WHERE a.client_id = c.client_id
      ]
    }
    FROM ' || v_username || '.clients c WITH INSERT UPDATE DELETE';

  EXECUTE IMMEDIATE '
    CREATE JSON RELATIONAL DUALITY VIEW ' || v_username || '.advisor_book_dv AS
    SELECT JSON {
      ''_id''          : adv.advisor_id,
      ''firstName''    : adv.first_name,
      ''lastName''     : adv.last_name,
      ''email''        : adv.email,
      ''licenseType''  : adv.license_type,
      ''region''       : adv.region,
      ''clients''      : [
        SELECT JSON {
          ''clientId''     : m.client_id,
          ''relationship'' : m.relationship,
          UNNEST(
            SELECT JSON {
              ''firstName''   : c.first_name,
              ''lastName''    : c.last_name,
              ''riskProfile'' : c.risk_profile,
              ''status''      : c.status
            }
            FROM ' || v_username || '.clients c WITH NOCHECK
            WHERE c.client_id = m.client_id
          )
        }
        FROM ' || v_username || '.advisor_client_map m WITH INSERT UPDATE DELETE
        WHERE m.advisor_id = adv.advisor_id
      ]
    }
    FROM ' || v_username || '.advisors adv WITH INSERT UPDATE DELETE';

  EXECUTE IMMEDIATE '
    CREATE JSON RELATIONAL DUALITY VIEW ' || v_username || '.transaction_feed_dv AS
    SELECT JSON {
      ''_id''         : t.txn_id,
      ''txnType''     : t.txn_type,
      ''symbol''      : t.symbol,
      ''quantity''    : t.quantity,
      ''price''       : t.price,
      ''totalAmount'' : t.total_amount,
      ''txnDate''     : t.txn_date,
      ''notes''       : t.notes,
      UNNEST(
        SELECT JSON {
          ''accountId''   : a.account_id,
          ''accountType'' : a.account_type,
          ''accountName'' : a.account_name
        }
        FROM ' || v_username || '.accounts a WITH NOCHECK
        WHERE a.account_id = t.account_id
      )
    }
    FROM ' || v_username || '.transactions t WITH INSERT UPDATE DELETE';

  -- Create indexes on the single-table collection
  EXECUTE IMMEDIATE 'CREATE INDEX ' || v_username || '.idx_pk_sk ON ' || v_username ||
    '.advisory_entities (data.pk.string(), data.sk.string())';
  EXECUTE IMMEDIATE 'CREATE INDEX ' || v_username || '.idx_gsi1 ON ' || v_username ||
    '.advisory_entities (data.gsi1pk.string(), data.gsi1sk.string())';
  EXECUTE IMMEDIATE 'CREATE MULTIVALUE INDEX ' || v_username || '.idx_tags ON ' || v_username ||
    '.advisory_entities ae (ae.data.data.tags.string())';
  EXECUTE IMMEDIATE 'CREATE MULTIVALUE INDEX ' || v_username || '.idx_sectors ON ' || v_username ||
    '.advisory_entities ae (ae.data.data.sectors.string())';

  -- Record in workshop_users
  INSERT INTO workshop_admin.workshop_users (schema_name, status, created_at, last_active)
  VALUES (v_username, 'active', SYSTIMESTAMP, SYSTIMESTAMP);

  COMMIT;
END;
/

CREATE OR REPLACE PROCEDURE drop_workspace(
  p_username IN VARCHAR2
) AUTHID CURRENT_USER AS
  v_username VARCHAR2(128) := UPPER(p_username);
BEGIN
  -- Drop the user and all their objects
  BEGIN
    EXECUTE IMMEDIATE 'DROP USER ' || DBMS_ASSERT.SIMPLE_SQL_NAME(v_username) || ' CASCADE';
  EXCEPTION
    WHEN OTHERS THEN
      IF SQLCODE != -1918 THEN RAISE; END IF; -- ORA-01918: user does not exist
  END;

  -- Remove from tracking table
  DELETE FROM workshop_admin.workshop_users WHERE schema_name = v_username;
  COMMIT;
END;
/

COMMIT;
