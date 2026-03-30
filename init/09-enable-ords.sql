-- 09-enable-ords.sql
-- Enable ORDS for the WORKSHOP_ADMIN schema and configure MongoDB API access.
-- Note: ORDS must be installed and running before this script takes effect.

ALTER SESSION SET CONTAINER = FREEPDB1;

-- Enable ORDS for the workshop admin schema
BEGIN
  ORDS.ENABLE_SCHEMA(
    p_enabled             => TRUE,
    p_schema              => 'WORKSHOP_ADMIN',
    p_url_mapping_type    => 'BASE_PATH',
    p_url_mapping_pattern => 'workshop',
    p_auto_rest_auth      => FALSE
  );
  COMMIT;
EXCEPTION
  WHEN OTHERS THEN
    -- ORDS may not be installed yet on first init; will be configured later by entrypoint
    DBMS_OUTPUT.PUT_LINE('ORDS enable deferred: ' || SQLERRM);
END;
/

-- AutoREST-enable duality views
BEGIN
  ORDS.ENABLE_OBJECT(
    p_enabled      => TRUE,
    p_schema       => 'WORKSHOP_ADMIN',
    p_object       => 'CLIENT_PORTFOLIO_DV',
    p_object_type  => 'VIEW',
    p_object_alias => 'client-portfolios'
  );
  ORDS.ENABLE_OBJECT(
    p_enabled      => TRUE,
    p_schema       => 'WORKSHOP_ADMIN',
    p_object       => 'ADVISOR_BOOK_DV',
    p_object_type  => 'VIEW',
    p_object_alias => 'advisor-books'
  );
  ORDS.ENABLE_OBJECT(
    p_enabled      => TRUE,
    p_schema       => 'WORKSHOP_ADMIN',
    p_object       => 'TRANSACTION_FEED_DV',
    p_object_type  => 'VIEW',
    p_object_alias => 'transaction-feed'
  );
  COMMIT;
EXCEPTION
  WHEN OTHERS THEN
    DBMS_OUTPUT.PUT_LINE('ORDS object enable deferred: ' || SQLERRM);
END;
/
