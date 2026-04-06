-- 08-load-single-table-data.sql
-- Generates 3000 advisory_entities documents with natural domain attributes.
-- Four entity types co-located in one collection, grouped by shared attributes.

ALTER SESSION SET CONTAINER = FREEPDB1;
ALTER SESSION SET CURRENT_SCHEMA = WORKSHOP_ADMIN;

DECLARE
  TYPE str_arr IS TABLE OF VARCHAR2(100);
  v_symbols str_arr := str_arr(
    'AAPL','MSFT','GOOGL','AMZN','NVDA','META','TSLA','BRKB',
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
  v_doc VARCHAR2(4000);
  v_arr VARCHAR2(1000);
  v_sym VARCHAR2(20);
  v_region VARCHAR2(20);
  v_risk_val VARCHAR2(20);
  v_adv_id NUMBER;
  v_acct_id NUMBER;
  v_day NUMBER;
  v_hour NUMBER;
  v_min NUMBER;
  v_num NUMBER;
  v_idx NUMBER;

  PROCEDURE advance IS
  BEGIN
    v_seed := MOD(v_seed * 1103515245 + 12345, 2147483648);
  END;

  FUNCTION rr(p_max NUMBER) RETURN NUMBER IS
  BEGIN
    advance;
    RETURN MOD(ABS(v_seed), p_max) + 1;
  END;

  FUNCTION rand_arr(p_arr str_arr, p_count NUMBER) RETURN VARCHAR2 IS
    v_json VARCHAR2(1000) := '[';
  BEGIN
    FOR i IN 1..p_count LOOP
      v_json := v_json || '"' || p_arr(rr(p_arr.COUNT)) || '"';
      IF i < p_count THEN v_json := v_json || ','; END IF;
    END LOOP;
    RETURN v_json || ']';
  END;

BEGIN
  -- 20 Advisor entities (grouped by advisorId)
  FOR i IN 1..20 LOOP
    v_region := v_regions(MOD(i-1, 4)+1);
    v_doc := '{' ||
      '"entityType":"advisor",' ||
      '"advisorId":' || i || ',' ||
      '"region":"' || v_region || '",' ||
      '"firstName":"Advisor' || i || '",' ||
      '"lastName":"Name' || i || '",' ||
      '"email":"advisor' || i || '@firm.com",' ||
      '"licenseType":"Series 7",' ||
      '"hireDate":"20' || (15 + rr(10)) || '-' || LPAD(rr(12), 2, '0') || '-15"' ||
    '}';
    INSERT INTO advisory_entities (data) VALUES (JSON(v_doc));
    v_total := v_total + 1;
  END LOOP;

  -- 200 Client entities (grouped by advisorId — same attribute as advisor)
  FOR i IN 1..200 LOOP
    v_adv_id := MOD(i-1, 20) + 1;
    v_risk_val := v_risk(rr(v_risk.COUNT));
    v_doc := '{' ||
      '"entityType":"client",' ||
      '"advisorId":' || v_adv_id || ',' ||
      '"clientId":' || (1000 + i) || ',' ||
      '"firstName":"Client' || i || '",' ||
      '"lastName":"Person' || i || '",' ||
      '"email":"client' || i || '@email.com",' ||
      '"riskProfile":"' || v_risk_val || '",' ||
      '"totalValue":' || (rr(900000) + 100000) || ',' ||
      '"accountCount":' || rr(4) ||
    '}';
    INSERT INTO advisory_entities (data) VALUES (JSON(v_doc));
    v_total := v_total + 1;
  END LOOP;

  -- 2000 Holding entities (grouped by accountId, queryable by symbol)
  FOR i IN 1..2000 LOOP
    v_acct_id := rr(500);
    v_sym := v_symbols(rr(v_symbols.COUNT));
    v_arr := rand_arr(v_sectors, rr(4));
    v_doc := '{' ||
      '"entityType":"holding",' ||
      '"accountId":' || v_acct_id || ',' ||
      '"symbol":"' || v_sym || '",' ||
      '"quantity":' || rr(500) || ',' ||
      '"costBasis":' || (rr(50000) + 1000) || ',' ||
      '"marketValue":' || (rr(60000) + 1000) || ',' ||
      '"sectors":' || v_arr || ',' ||
      '"tags":' || rand_arr(v_tags, rr(5)) || ',' ||
      '"lastUpdated":"2026-03-' || LPAD(rr(28), 2, '0') || 'T16:00:00Z"' ||
    '}';
    INSERT INTO advisory_entities (data) VALUES (JSON(v_doc));
    v_total := v_total + 1;
  END LOOP;

  -- Fill remaining to 3000 with transaction entities (grouped by accountId)
  WHILE v_total < 3000 LOOP
    v_acct_id := rr(500);
    v_sym := v_symbols(rr(v_symbols.COUNT));
    v_day := rr(28);
    v_hour := rr(12) + 8;
    v_min := rr(59);
    v_doc := '{' ||
      '"entityType":"transaction",' ||
      '"accountId":' || v_acct_id || ',' ||
      '"symbol":"' || v_sym || '",' ||
      '"txnType":"' || v_txn_types(rr(v_txn_types.COUNT)) || '",' ||
      '"quantity":' || rr(200) || ',' ||
      '"price":' || (rr(500) + 10) || ',' ||
      '"totalAmount":' || (rr(100000) + 500) || ',' ||
      '"txnDate":"2026-03-' || LPAD(v_day, 2, '0') || 'T' || LPAD(v_hour, 2, '0') || ':' || LPAD(v_min, 2, '0') || ':00Z",' ||
      '"tags":' || rand_arr(v_txn_tags, rr(3)) ||
    '}';
    INSERT INTO advisory_entities (data) VALUES (JSON(v_doc));
    v_total := v_total + 1;
  END LOOP;

  COMMIT;
END;
/
