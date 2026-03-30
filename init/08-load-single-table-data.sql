-- 08-load-single-table-data.sql
-- Generates 3000 advisory_entities documents in single-table design format.
-- Entity types: advisor (~20), client (~200), holding (~2000), transaction (~780)

ALTER SESSION SET CONTAINER = FREEPDB1;
ALTER SESSION SET CURRENT_SCHEMA = WORKSHOP_ADMIN;

DECLARE
  TYPE str_arr IS TABLE OF VARCHAR2(100);
  v_symbols str_arr := str_arr(
    'AAPL','MSFT','GOOGL','AMZN','NVDA','META','TSLA','BRK.B',
    'JPM','V','JNJ','WMT','PG','MA','HD','DIS',
    'BAC','XOM','PFE','CSCO','INTC','VZ','KO','PEP',
    'MRK','ABT','TMO','AVGO','COST','NKE'
  );
  v_sectors str_arr := str_arr(
    'technology','healthcare','financial','consumer_staples','consumer_discretionary',
    'energy','industrials','utilities','real_estate','materials','services',
    'consumer_electronics','communications','biotech','semiconductors'
  );
  v_tags str_arr := str_arr(
    'large_cap','mid_cap','small_cap','dividend','growth','value',
    'sp500','nasdaq100','dow30','international','emerging_markets',
    'esg','blue_chip','defensive','cyclical'
  );
  v_txn_types str_arr := str_arr('buy','sell','dividend','transfer');
  v_txn_tags str_arr := str_arr(
    'rebalance','q1_allocation','q2_allocation','tax_loss','dividend_reinvest',
    'new_position','partial_exit','full_exit'
  );
  v_regions str_arr := str_arr('northeast','southeast','midwest','west');
  v_risk str_arr := str_arr('conservative','moderate','aggressive');
  v_seed NUMBER := 101;
  v_total NUMBER := 0;

  FUNCTION det_rand(p_seed IN OUT NUMBER, p_max NUMBER) RETURN NUMBER IS
  BEGIN
    p_seed := MOD(p_seed * 1103515245 + 12345, 2147483648);
    RETURN MOD(ABS(p_seed), p_max) + 1;
  END;

  -- Build a JSON array of random picks from an array
  FUNCTION rand_arr(p_seed IN OUT NUMBER, p_arr str_arr, p_count NUMBER) RETURN VARCHAR2 IS
    v_json VARCHAR2(1000) := '[';
    v_idx NUMBER;
  BEGIN
    FOR i IN 1..p_count LOOP
      v_idx := det_rand(p_seed, p_arr.COUNT);
      v_json := v_json || '"' || p_arr(v_idx) || '"';
      IF i < p_count THEN v_json := v_json || ','; END IF;
    END LOOP;
    RETURN v_json || ']';
  END;

BEGIN
  -- 20 Advisor entities
  FOR i IN 1..20 LOOP
    INSERT INTO advisory_entities (data) VALUES (JSON(
      '{' ||
        '"pk":"ADVISOR#' || i || '",' ||
        '"sk":"PROFILE",' ||
        '"entityType":"advisor",' ||
        '"gsi1pk":"REGION#' || v_regions(det_rand(v_seed, v_regions.COUNT)) || '",' ||
        '"gsi1sk":"ADVISOR#' || i || '",' ||
        '"data":{' ||
          '"firstName":"Advisor' || i || '",' ||
          '"lastName":"Name' || i || '",' ||
          '"email":"advisor' || i || '@firm.com",' ||
          '"licenseType":"Series 7",' ||
          '"region":"' || v_regions(MOD(i-1, 4)+1) || '",' ||
          '"hireDate":"20' || (15 + det_rand(v_seed, 10)) || '-' || LPAD(det_rand(v_seed, 12), 2, '0') || '-15"' ||
        '}' ||
      '}'
    ));
    v_total := v_total + 1;
  END LOOP;

  -- 200 Client entities (distributed across advisors)
  FOR i IN 1..200 LOOP
    DECLARE
      v_adv_id NUMBER := MOD(i-1, 20) + 1;
      v_risk_val VARCHAR2(20) := v_risk(det_rand(v_seed, v_risk.COUNT));
    BEGIN
      INSERT INTO advisory_entities (data) VALUES (JSON(
        '{' ||
          '"pk":"ADVISOR#' || v_adv_id || '",' ||
          '"sk":"CLIENT#' || (1000 + i) || '",' ||
          '"entityType":"client",' ||
          '"gsi1pk":"CLIENT#' || (1000 + i) || '",' ||
          '"gsi1sk":"ACCOUNT_SUMMARY",' ||
          '"data":{' ||
            '"firstName":"Client' || i || '",' ||
            '"lastName":"Person' || i || '",' ||
            '"email":"client' || i || '@email.com",' ||
            '"riskProfile":"' || v_risk_val || '",' ||
            '"totalValue":' || (det_rand(v_seed, 900000) + 100000) || ',' ||
            '"accountCount":' || det_rand(v_seed, 4) ||
          '}' ||
        '}'
      ));
      v_total := v_total + 1;
    END;
  END LOOP;

  -- ~2000 Holding entities (10 per advisor's clients, with tags and sectors)
  FOR i IN 1..2000 LOOP
    DECLARE
      v_acct_id NUMBER := det_rand(v_seed, 500) + 2000;
      v_sym_idx NUMBER := det_rand(v_seed, v_symbols.COUNT);
      v_sym VARCHAR2(10) := v_symbols(v_sym_idx);
      v_num_sectors NUMBER := det_rand(v_seed, 4);
      v_num_tags NUMBER := det_rand(v_seed, 5);
    BEGIN
      INSERT INTO advisory_entities (data) VALUES (JSON(
        '{' ||
          '"pk":"ACCOUNT#' || v_acct_id || '",' ||
          '"sk":"HOLDING#' || v_sym || '#' || i || '",' ||
          '"entityType":"holding",' ||
          '"gsi1pk":"SYMBOL#' || v_sym || '",' ||
          '"gsi1sk":"ACCOUNT#' || v_acct_id || '",' ||
          '"data":{' ||
            '"symbol":"' || v_sym || '",' ||
            '"quantity":' || det_rand(v_seed, 500) || ',' ||
            '"costBasis":' || (det_rand(v_seed, 50000) + 1000) || ',' ||
            '"marketValue":' || (det_rand(v_seed, 60000) + 1000) || ',' ||
            '"sectors":' || rand_arr(v_seed, v_sectors, v_num_sectors) || ',' ||
            '"tags":' || rand_arr(v_seed, v_tags, v_num_tags) || ',' ||
            '"lastUpdated":"2026-03-' || LPAD(det_rand(v_seed, 28), 2, '0') || 'T16:00:00Z"' ||
          '}' ||
        '}'
      ));
      v_total := v_total + 1;
    END;
  END LOOP;

  -- Fill remaining to reach exactly 3000 with transaction entities
  WHILE v_total < 3000 LOOP
    DECLARE
      v_acct_id NUMBER := det_rand(v_seed, 500) + 2000;
      v_sym VARCHAR2(10) := v_symbols(det_rand(v_seed, v_symbols.COUNT));
      v_day NUMBER := det_rand(v_seed, 28);
      v_hour NUMBER := det_rand(v_seed, 12) + 8;
      v_min NUMBER := det_rand(v_seed, 60) - 1;
      v_num_tags NUMBER := det_rand(v_seed, 3);
    BEGIN
      INSERT INTO advisory_entities (data) VALUES (JSON(
        '{' ||
          '"pk":"ACCOUNT#' || v_acct_id || '",' ||
          '"sk":"TXN#2026-03-' || LPAD(v_day, 2, '0') || 'T' || LPAD(v_hour, 2, '0') || ':' || LPAD(v_min, 2, '0') || ':00Z#' || v_total || '",' ||
          '"entityType":"transaction",' ||
          '"gsi1pk":"SYMBOL#' || v_sym || '",' ||
          '"gsi1sk":"TXN#2026-03-' || LPAD(v_day, 2, '0') || 'T' || LPAD(v_hour, 2, '0') || ':' || LPAD(v_min, 2, '0') || ':00Z",' ||
          '"data":{' ||
            '"txnType":"' || v_txn_types(det_rand(v_seed, v_txn_types.COUNT)) || '",' ||
            '"symbol":"' || v_sym || '",' ||
            '"quantity":' || det_rand(v_seed, 200) || ',' ||
            '"price":' || (det_rand(v_seed, 500) + 10) || ',' ||
            '"totalAmount":' || (det_rand(v_seed, 100000) + 500) || ',' ||
            '"tags":' || rand_arr(v_seed, v_txn_tags, v_num_tags) ||
          '}' ||
        '}'
      ));
      v_total := v_total + 1;
    END;
  END LOOP;

  COMMIT;
END;
/
