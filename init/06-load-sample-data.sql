-- 06-load-sample-data.sql
-- Generates deterministic relational seed data using PL/SQL.
-- All random values computed into variables before INSERT (Oracle PL/SQL restriction).

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

  v_seed NUMBER := 42;
  -- Temp variables for computed values
  v_fn VARCHAR2(100);
  v_ln VARCHAR2(100);
  v_email VARCHAR2(255);
  v_lic VARCHAR2(50);
  v_reg VARCHAR2(100);
  v_hdate DATE;
  v_rp VARCHAR2(20);
  v_odate DATE;
  v_at VARCHAR2(50);
  v_aname VARCHAR2(200);
  v_aodate DATE;
  v_sym VARCHAR2(20);
  v_qty NUMBER;
  v_cb NUMBER;
  v_mv NUMBER;
  v_lu TIMESTAMP;
  v_rel VARCHAR2(50);
  v_adate DATE;
  v_tt VARCHAR2(20);
  v_tp NUMBER;
  v_ta NUMBER;
  v_tdate TIMESTAMP;
  v_idx NUMBER;
  v_acnt NUMBER;
  v_cnt NUMBER;

  PROCEDURE advance_seed IS
  BEGIN
    v_seed := MOD(v_seed * 1103515245 + 12345, 2147483648);
  END;

  FUNCTION rand_range(p_max NUMBER) RETURN NUMBER IS
  BEGIN
    advance_seed;
    RETURN MOD(ABS(v_seed), p_max) + 1;
  END;

BEGIN
  -- 20 Advisors
  FOR i IN 1..20 LOOP
    v_fn := v_first_names(rand_range(v_first_names.COUNT));
    v_ln := v_last_names(rand_range(v_last_names.COUNT));
    v_email := LOWER(v_fn || '.' || v_ln || i || '@firm.com');
    v_lic := v_licenses(rand_range(v_licenses.COUNT));
    v_reg := v_regions(rand_range(v_regions.COUNT));
    v_hdate := DATE '2015-01-01' + rand_range(3650);
    INSERT INTO advisors (first_name, last_name, email, license_type, region, hire_date)
    VALUES (v_fn, v_ln, v_email, v_lic, v_reg, v_hdate);
  END LOOP;

  -- 200 Clients
  FOR i IN 1..200 LOOP
    v_fn := v_first_names(rand_range(v_first_names.COUNT));
    v_ln := v_last_names(rand_range(v_last_names.COUNT));
    v_email := LOWER(v_fn || '.' || v_ln || i || '@email.com');
    v_rp := v_risk(rand_range(v_risk.COUNT));
    v_odate := DATE '2018-01-01' + rand_range(2920);
    INSERT INTO clients (first_name, last_name, email, risk_profile, onboard_date, status)
    VALUES (v_fn, v_ln, v_email, v_rp, v_odate, 'active');
  END LOOP;

  -- Accounts: target exactly 500
  v_cnt := 0;
  FOR c_id IN 1..200 LOOP
    v_acnt := rand_range(3); -- 1-3 accounts per client
    FOR j IN 1..v_acnt LOOP
      EXIT WHEN v_cnt >= 500;
      v_at := v_acct_types(rand_range(v_acct_types.COUNT));
      v_aname := 'Account ' || c_id || '-' || j;
      v_aodate := DATE '2019-01-01' + rand_range(2190);
      INSERT INTO accounts (client_id, account_type, account_name, opened_date, status)
      VALUES (c_id, v_at, v_aname, v_aodate, 'active');
      v_cnt := v_cnt + 1;
    END LOOP;
  END LOOP;
  -- Pad to 500 if under
  WHILE v_cnt < 500 LOOP
    v_idx := rand_range(200);
    v_at := v_acct_types(rand_range(v_acct_types.COUNT));
    v_aodate := DATE '2020-01-01' + rand_range(1825);
    INSERT INTO accounts (client_id, account_type, account_name, opened_date, status)
    VALUES (v_idx, v_at, 'Extra ' || v_cnt, v_aodate, 'active');
    v_cnt := v_cnt + 1;
  END LOOP;

  -- 2000 Holdings (4 per account)
  FOR a_id IN 1..500 LOOP
    FOR j IN 1..4 LOOP
      v_sym := v_symbols(rand_range(v_symbols.COUNT));
      v_qty := rand_range(500);
      v_cb := rand_range(50000) + 1000;
      v_mv := rand_range(60000) + 1000;
      v_lu := SYSTIMESTAMP - NUMTODSINTERVAL(rand_range(60), 'DAY');
      INSERT INTO holdings (account_id, symbol, quantity, cost_basis, market_value, last_updated)
      VALUES (a_id, v_sym, v_qty, v_cb, v_mv, v_lu);
    END LOOP;
  END LOOP;

  -- 300 Advisor-Client Mappings
  v_cnt := 0;
  FOR a_id IN 1..20 LOOP
    FOR c_off IN 1..15 LOOP
      EXIT WHEN v_cnt >= 300;
      v_idx := MOD((a_id - 1) * 15 + c_off - 1, 200) + 1;
      v_rel := v_relationships(rand_range(v_relationships.COUNT));
      v_adate := DATE '2020-01-01' + rand_range(1825);
      BEGIN
        INSERT INTO advisor_client_map (advisor_id, client_id, relationship, assigned_date)
        VALUES (a_id, v_idx, v_rel, v_adate);
        v_cnt := v_cnt + 1;
      EXCEPTION WHEN DUP_VAL_ON_INDEX THEN NULL;
      END;
    END LOOP;
  END LOOP;

  -- 5000 Transactions
  FOR i IN 1..5000 LOOP
    v_idx := rand_range(500);
    v_tt := v_txn_types(rand_range(v_txn_types.COUNT));
    v_sym := v_symbols(rand_range(v_symbols.COUNT));
    v_qty := rand_range(200);
    v_tp := rand_range(500) + 10;
    v_ta := rand_range(100000) + 500;
    v_tdate := SYSTIMESTAMP - NUMTODSINTERVAL(rand_range(60), 'DAY');
    IF MOD(i, 5) = 0 THEN
      INSERT INTO transactions (account_id, txn_type, symbol, quantity, price, total_amount, txn_date, notes)
      VALUES (v_idx, v_tt, v_sym, v_qty, v_tp, v_ta, v_tdate, JSON('{"category":"rebalance","automated":true}'));
    ELSE
      INSERT INTO transactions (account_id, txn_type, symbol, quantity, price, total_amount, txn_date, notes)
      VALUES (v_idx, v_tt, v_sym, v_qty, v_tp, v_ta, v_tdate, NULL);
    END IF;
  END LOOP;

  COMMIT;
END;
/
