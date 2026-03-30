#!/bin/bash
# Custom entrypoint: starts Oracle Database and ORDS.
# Oracle is started via the gvenzl base image entrypoint.
# ORDS is started after Oracle is healthy.

set -euo pipefail

ORDS_CONFIG="/etc/ords/config"
ORDS_LOG="/tmp/ords.log"
ORACLE_PDB="FREEPDB1"
FIRST_RUN_MARKER="/opt/oracle/oradata/.ords_installed"

# Start Oracle using the base image entrypoint (runs in background)
# The gvenzl entrypoint starts the listener + runs init scripts
/container-entrypoint.sh &
ORACLE_PID=$!

# Wait for Oracle to be ready
echo "=== Waiting for Oracle to be ready ==="
until healthcheck.sh > /dev/null 2>&1; do
  sleep 2
done
echo "=== Oracle is ready ==="

# Install ORDS into database on first run
if [ ! -f "$FIRST_RUN_MARKER" ]; then
  echo "=== First run: installing ORDS into database ==="

  # Create ORDS database user
  sqlplus -s / as sysdba <<EOF
ALTER SESSION SET CONTAINER = ${ORACLE_PDB};

-- Create ORDS runtime user
CREATE USER ORDS_PUBLIC_USER IDENTIFIED BY "${ORDS_PASSWORD:-OrdsPwd2026}" ACCOUNT UNLOCK;
GRANT CONNECT TO ORDS_PUBLIC_USER;

-- Grant ORDS admin privileges
BEGIN
  ORDS_ADMIN.PROVISION_RUNTIME_ROLE(
    p_user => 'ORDS_PUBLIC_USER',
    p_proxy_enabled => TRUE
  );
EXCEPTION
  WHEN OTHERS THEN
    -- ORDS admin package may not exist yet, install will handle it
    NULL;
END;
/
EXIT;
EOF

  # Install ORDS
  ords --config "$ORDS_CONFIG" install \
    --db-hostname localhost \
    --db-port 1521 \
    --db-servicename "$ORACLE_PDB" \
    --admin-user SYS \
    --proxy-user \
    --password-stdin <<< "${ORACLE_PASSWORD:-WorkshopAdmin2026}" \
    --feature-sdw true \
    --feature-db-api true \
    --log-folder /tmp

  # Enable MongoDB API
  ords --config "$ORDS_CONFIG" config set mongo.enabled true
  ords --config "$ORDS_CONFIG" config set mongo.port 27017

  touch "$FIRST_RUN_MARKER"
  echo "=== ORDS installed into database ==="
fi

# Start ORDS
echo "=== Starting ORDS ==="
ords --config "$ORDS_CONFIG" serve \
  --port 8181 \
  --secure false \
  > "$ORDS_LOG" 2>&1 &
ORDS_PID=$!

echo "=== ORDS started (PID: $ORDS_PID) ==="

# Wait for ORDS to be ready
echo "=== Waiting for ORDS health ==="
for i in $(seq 1 60); do
  if curl -sf http://localhost:8181/ords/_/health > /dev/null 2>&1; then
    echo "=== ORDS is healthy ==="
    break
  fi
  if [ "$i" -eq 60 ]; then
    echo "=== ORDS failed to start. Log: ==="
    cat "$ORDS_LOG"
    exit 1
  fi
  sleep 2
done

# Monitor both processes — exit if either dies
echo "=== Oracle + ORDS running. Monitoring... ==="
while true; do
  if ! kill -0 "$ORACLE_PID" 2>/dev/null; then
    echo "=== Oracle process died ==="
    kill "$ORDS_PID" 2>/dev/null || true
    exit 1
  fi
  if ! kill -0 "$ORDS_PID" 2>/dev/null; then
    echo "=== ORDS process died ==="
    kill "$ORACLE_PID" 2>/dev/null || true
    exit 1
  fi
  sleep 5
done
