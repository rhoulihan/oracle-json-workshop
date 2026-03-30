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
    'Rebalance tech allocation to < 30%',
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

  FUNCTION det_rand(p_seed IN OUT NUMBER, p_max NUMBER) RETURN NUMBER IS
  BEGIN
    p_seed := MOD(p_seed * 1103515245 + 12345, 2147483648);
    RETURN MOD(ABS(p_seed), p_max) + 1;
  END;

BEGIN
  FOR i IN 1..500 LOOP
    DECLARE
      v_client_id NUMBER := det_rand(v_seed, 200);
      v_advisor_id NUMBER := det_rand(v_seed, 20);
      v_type VARCHAR2(20) := v_types(det_rand(v_seed, v_types.COUNT));
      v_num_items NUMBER := det_rand(v_seed, 3);
      v_items_json VARCHAR2(4000) := '[';
      v_day_offset NUMBER := det_rand(v_seed, 60);
      v_status VARCHAR2(20);
    BEGIN
      -- Build action_items array
      FOR j IN 1..v_num_items LOOP
        IF MOD(j, 2) = 0 THEN v_status := 'complete'; ELSE v_status := 'pending'; END IF;
        v_items_json := v_items_json ||
          '{"task":"' || v_tasks(det_rand(v_seed, v_tasks.COUNT)) ||
          '","due":"2026-' || LPAD(det_rand(v_seed, 12), 2, '0') || '-' || LPAD(det_rand(v_seed, 28), 2, '0') ||
          '","status":"' || v_status || '"}';
        IF j < v_num_items THEN v_items_json := v_items_json || ','; END IF;
      END LOOP;
      v_items_json := v_items_json || ']';

      INSERT INTO client_interactions (data) VALUES (JSON(
        '{' ||
          '"client_id":' || v_client_id || ',' ||
          '"advisor_id":' || v_advisor_id || ',' ||
          '"type":"' || v_type || '",' ||
          '"date":"2026-' || LPAD(det_rand(v_seed, 3), 2, '0') || '-' ||
            LPAD(det_rand(v_seed, 28), 2, '0') || 'T' ||
            LPAD(det_rand(v_seed, 12) + 8, 2, '0') || ':' ||
            LPAD(det_rand(v_seed, 60) - 1, 2, '0') || ':00Z",' ||
          '"channel":"' || v_channels(det_rand(v_seed, v_channels.COUNT)) || '",' ||
          '"summary":"' || v_summaries(det_rand(v_seed, v_summaries.COUNT)) || '",' ||
          '"action_items":' || v_items_json || ',' ||
          '"sentiment":"' || v_sentiments(det_rand(v_seed, v_sentiments.COUNT)) || '",' ||
          '"follow_up_required":' || CASE WHEN MOD(i, 3) = 0 THEN 'true' ELSE 'false' END ||
        '}'
      ));
    END;
  END LOOP;

  COMMIT;
END;
/
