-- 06-load-sample-data.sql
-- Generates deterministic relational seed data using PL/SQL.

ALTER SESSION SET CONTAINER = FREEPDB1;
ALTER SESSION SET CURRENT_SCHEMA = WORKSHOP_ADMIN;

DECLARE
  TYPE str_arr IS TABLE OF VARCHAR2(100);
  v_first_names str_arr := str_arr(
    'James','Mary','Robert','Patricia','John','Jennifer','Michael','Linda',
    'David','Elizabeth','William','Barbara','Richard','Susan','Joseph','Jessica',
    'Thomas','Sarah','Christopher','Karen','Charles','Lisa','Daniel','Nancy',
    'Matthew','Betty','Anthony','Margaret','Mark','Sandra','Donald','Ashley',
    'Steven','Kimberly','Andrew','Emily','Paul','Donna','Joshua','Michelle',
    'Kenneth','Carol','Kevin','Amanda','Brian','Dorothy','George','Melissa',
    'Timothy','Deborah'
  );
  v_last_names str_arr := str_arr(
    'Smith','Johnson','Williams','Brown','Jones','Garcia','Miller','Davis',
    'Rodriguez','Martinez','Hernandez','Lopez','Gonzalez','Wilson','Anderson',
    'Thomas','Taylor','Moore','Jackson','Martin','Lee','Perez','Thompson',
    'White','Harris','Sanchez','Clark','Ramirez','Lewis','Robinson','Walker',
    'Young','Allen','King','Wright','Scott','Torres','Nguyen','Hill',
    'Flores','Green','Adams','Nelson','Baker','Hall','Rivera','Campbell',
    'Mitchell','Carter'
  );
  v_regions str_arr := str_arr('northeast','southeast','midwest','west');
  v_licenses str_arr := str_arr('Series 7','Series 63','Series 65','Series 66','CFP');
  v_risk str_arr := str_arr('conservative','moderate','aggressive');
  v_acct_types str_arr := str_arr('brokerage','ira','401k','trust');
  v_symbols str_arr := str_arr(
    'AAPL','MSFT','GOOGL','AMZN','NVDA','META','TSLA','BRK.B',
    'JPM','V','JNJ','WMT','PG','MA','HD','DIS',
    'BAC','XOM','PFE','CSCO','INTC','VZ','KO','PEP',
    'MRK','ABT','TMO','AVGO','COST','NKE'
  );
  v_txn_types str_arr := str_arr('buy','sell','dividend','transfer');
  v_relationships str_arr := str_arr('primary','secondary','referral');

  v_advisor_id NUMBER;
  v_client_id  NUMBER;
  v_account_id NUMBER;
  v_fn_idx     NUMBER;
  v_ln_idx     NUMBER;
  v_seed       NUMBER := 42;

  FUNCTION det_rand(p_seed IN OUT NUMBER, p_max NUMBER) RETURN NUMBER IS
  BEGIN
    p_seed := MOD(p_seed * 1103515245 + 12345, 2147483648);
    RETURN MOD(ABS(p_seed), p_max) + 1;
  END;

BEGIN
  -- 20 Advisors
  FOR i IN 1..20 LOOP
    v_fn_idx := det_rand(v_seed, v_first_names.COUNT);
    v_ln_idx := det_rand(v_seed, v_last_names.COUNT);
    INSERT INTO advisors (first_name, last_name, email, license_type, region, hire_date)
    VALUES (
      v_first_names(v_fn_idx),
      v_last_names(v_ln_idx),
      LOWER(v_first_names(v_fn_idx) || '.' || v_last_names(v_ln_idx) || i || '@firm.com'),
      v_licenses(det_rand(v_seed, v_licenses.COUNT)),
      v_regions(det_rand(v_seed, v_regions.COUNT)),
      DATE '2015-01-01' + det_rand(v_seed, 3650)
    );
  END LOOP;

  -- 200 Clients
  FOR i IN 1..200 LOOP
    v_fn_idx := det_rand(v_seed, v_first_names.COUNT);
    v_ln_idx := det_rand(v_seed, v_last_names.COUNT);
    INSERT INTO clients (first_name, last_name, email, risk_profile, onboard_date, status)
    VALUES (
      v_first_names(v_fn_idx),
      v_last_names(v_ln_idx),
      LOWER(v_first_names(v_fn_idx) || '.' || v_last_names(v_ln_idx) || i || '@email.com'),
      v_risk(det_rand(v_seed, v_risk.COUNT)),
      DATE '2018-01-01' + det_rand(v_seed, 2920),
      'active'
    );
  END LOOP;

  -- 500 Accounts (2-3 per client)
  FOR c_id IN 1..200 LOOP
    FOR j IN 1..det_rand(v_seed, 3) LOOP
      IF j <= 3 THEN
        INSERT INTO accounts (client_id, account_type, account_name, opened_date, status)
        VALUES (
          c_id,
          v_acct_types(det_rand(v_seed, v_acct_types.COUNT)),
          'Account ' || c_id || '-' || j,
          DATE '2019-01-01' + det_rand(v_seed, 2190),
          'active'
        );
      END IF;
    END LOOP;
  END LOOP;

  -- Adjust to exactly 500 accounts
  -- The loop above generates variable counts; we'll pad or trim
  DECLARE
    v_cnt NUMBER;
  BEGIN
    SELECT COUNT(*) INTO v_cnt FROM accounts;
    -- If under 500, add more to last clients
    WHILE v_cnt < 500 LOOP
      INSERT INTO accounts (client_id, account_type, account_name, opened_date, status)
      VALUES (
        det_rand(v_seed, 200),
        v_acct_types(det_rand(v_seed, v_acct_types.COUNT)),
        'Extra Account ' || v_cnt,
        DATE '2020-01-01' + det_rand(v_seed, 1825),
        'active'
      );
      v_cnt := v_cnt + 1;
    END LOOP;
    -- If over 500, remove extras
    IF v_cnt > 500 THEN
      DELETE FROM accounts WHERE account_id IN (
        SELECT account_id FROM accounts ORDER BY account_id DESC
        FETCH FIRST (v_cnt - 500) ROWS ONLY
      );
    END IF;
  END;

  -- 2000 Holdings (4 per account on average)
  FOR a_id IN 1..500 LOOP
    FOR j IN 1..4 LOOP
      INSERT INTO holdings (account_id, symbol, quantity, cost_basis, market_value, last_updated)
      VALUES (
        a_id,
        v_symbols(det_rand(v_seed, v_symbols.COUNT)),
        det_rand(v_seed, 500),
        det_rand(v_seed, 50000) + 1000,
        det_rand(v_seed, 60000) + 1000,
        SYSTIMESTAMP - NUMTODSINTERVAL(det_rand(v_seed, 60), 'DAY')
      );
    END LOOP;
  END LOOP;

  -- 300 Advisor-Client Mappings
  DECLARE
    v_cnt NUMBER := 0;
  BEGIN
    FOR a_id IN 1..20 LOOP
      FOR c_id_offset IN 1..15 LOOP
        EXIT WHEN v_cnt >= 300;
        BEGIN
          INSERT INTO advisor_client_map (advisor_id, client_id, relationship, assigned_date)
          VALUES (
            a_id,
            MOD((a_id - 1) * 15 + c_id_offset - 1, 200) + 1,
            v_relationships(det_rand(v_seed, v_relationships.COUNT)),
            DATE '2020-01-01' + det_rand(v_seed, 1825)
          );
          v_cnt := v_cnt + 1;
        EXCEPTION WHEN DUP_VAL_ON_INDEX THEN NULL;
        END;
      END LOOP;
    END LOOP;
  END;

  -- 5000 Transactions
  FOR i IN 1..5000 LOOP
    INSERT INTO transactions (account_id, txn_type, symbol, quantity, price, total_amount, txn_date, notes)
    VALUES (
      det_rand(v_seed, 500),
      v_txn_types(det_rand(v_seed, v_txn_types.COUNT)),
      v_symbols(det_rand(v_seed, v_symbols.COUNT)),
      det_rand(v_seed, 200),
      det_rand(v_seed, 500) + 10,
      det_rand(v_seed, 100000) + 500,
      SYSTIMESTAMP - NUMTODSINTERVAL(det_rand(v_seed, 60), 'DAY'),
      CASE WHEN MOD(i, 5) = 0
        THEN JSON('{"category":"rebalance","automated":true}')
        ELSE NULL
      END
    );
  END LOOP;

  COMMIT;
END;
/
