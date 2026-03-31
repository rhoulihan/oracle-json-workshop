-- 07-load-collection-data.sql
-- Generates 500 client_interactions documents.

ALTER SESSION SET CONTAINER = FREEPDB1;
ALTER SESSION SET CURRENT_SCHEMA = WORKSHOP_ADMIN;

DECLARE
  TYPE str_arr IS TABLE OF VARCHAR2(200);
  v_types str_arr := str_arr('meeting','call','email','video','in-person');
  v_channels str_arr := str_arr('in-person','phone','email','zoom','teams');
  v_sentiments str_arr := str_arr('positive','neutral','cautious','concerned','optimistic');
  v_summaries str_arr := str_arr(
    'Quarterly portfolio review. Client satisfied with returns.',
    'Discussed rebalancing strategy due to market volatility.',
    'Client requested information about tax-loss harvesting.',
    'Reviewed retirement planning timeline and milestones.',
    'Addressed concerns about sector concentration in tech.',
    'Follow-up on risk assessment questionnaire results.',
    'Discussed adding international exposure to portfolio.',
    'Client interested in ESG investment options.',
    'Reviewed beneficiary designations and estate planning.',
    'Discussed impact of interest rate changes on bond holdings.'
  );
  v_tasks str_arr := str_arr(
    'Rebalance tech allocation to under 30 pct',
    'Send updated risk assessment',
    'Schedule Q2 review meeting',
    'Prepare tax-loss harvesting report',
    'Research ESG fund options',
    'Update beneficiary forms',
    'Review international ETF options',
    'Generate performance report',
    'Follow up on document signatures',
    'Prepare retirement projection'
  );
  v_seed NUMBER := 77;

  v_client_id NUMBER;
  v_advisor_id NUMBER;
  v_type VARCHAR2(20);
  v_channel VARCHAR2(20);
  v_sentiment VARCHAR2(20);
  v_summary VARCHAR2(200);
  v_num_items NUMBER;
  v_items_json VARCHAR2(4000);
  v_task VARCHAR2(200);
  v_status VARCHAR2(20);
  v_mon NUMBER;
  v_day NUMBER;
  v_hour NUMBER;
  v_minute NUMBER;
  v_doc VARCHAR2(4000);
  v_follow_up VARCHAR2(5);

  PROCEDURE advance IS
  BEGIN
    v_seed := MOD(v_seed * 1103515245 + 12345, 2147483648);
  END;

  FUNCTION rr(p_max NUMBER) RETURN NUMBER IS
  BEGIN
    advance;
    RETURN MOD(ABS(v_seed), p_max) + 1;
  END;

BEGIN
  FOR i IN 1..500 LOOP
    v_client_id := rr(200);
    v_advisor_id := rr(20);
    v_type := v_types(rr(v_types.COUNT));
    v_channel := v_channels(rr(v_channels.COUNT));
    v_sentiment := v_sentiments(rr(v_sentiments.COUNT));
    v_summary := v_summaries(rr(v_summaries.COUNT));
    v_num_items := rr(3);
    v_mon := rr(3);
    v_day := rr(28);
    v_hour := rr(12) + 8;
    v_minute := rr(59);

    -- Build action_items array
    v_items_json := '[';
    FOR j IN 1..v_num_items LOOP
      IF MOD(j, 2) = 0 THEN v_status := 'complete'; ELSE v_status := 'pending'; END IF;
      v_task := v_tasks(rr(v_tasks.COUNT));
      v_items_json := v_items_json ||
        '{"task":"' || v_task ||
        '","due":"2026-' || LPAD(rr(12), 2, '0') || '-' || LPAD(rr(28), 2, '0') ||
        '","status":"' || v_status || '"}';
      IF j < v_num_items THEN v_items_json := v_items_json || ','; END IF;
    END LOOP;
    v_items_json := v_items_json || ']';

    IF MOD(i, 3) = 0 THEN v_follow_up := 'true'; ELSE v_follow_up := 'false'; END IF;

    v_doc := '{' ||
      '"client_id":' || v_client_id || ',' ||
      '"advisor_id":' || v_advisor_id || ',' ||
      '"type":"' || v_type || '",' ||
      '"date":"2026-' || LPAD(v_mon, 2, '0') || '-' || LPAD(v_day, 2, '0') ||
        'T' || LPAD(v_hour, 2, '0') || ':' || LPAD(v_minute, 2, '0') || ':00Z",' ||
      '"channel":"' || v_channel || '",' ||
      '"summary":"' || v_summary || '",' ||
      '"action_items":' || v_items_json || ',' ||
      '"sentiment":"' || v_sentiment || '",' ||
      '"follow_up_required":' || v_follow_up ||
    '}';

    INSERT INTO client_interactions (data) VALUES (JSON(v_doc));
  END LOOP;

  COMMIT;
END;
/
