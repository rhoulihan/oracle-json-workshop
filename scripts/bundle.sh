#!/bin/bash
# Save workshop container images to a portable tarball for offline deployment.
# Supports both Docker and Podman.
# Usage: ./scripts/bundle.sh [output_file]

set -euo pipefail

OUTPUT="${1:-workshop-images.tar.gz}"

# Detect container runtime
if command -v podman &>/dev/null && ! command -v docker &>/dev/null; then
  RUNTIME="podman"
  if command -v podman-compose &>/dev/null; then
    COMPOSE="podman-compose"
  elif podman compose version &>/dev/null 2>&1; then
    COMPOSE="podman compose"
  else
    echo "Error: podman-compose not found. Install it with: pip install podman-compose"
    exit 1
  fi
else
  RUNTIME="docker"
  COMPOSE="docker compose"
fi

echo "=== Building images ($RUNTIME) ==="
$COMPOSE build

echo "=== Saving images to $OUTPUT ==="
$RUNTIME save oracle-json-workshop-oracle oracle-json-workshop-app | gzip > "$OUTPUT"

SIZE=$(du -h "$OUTPUT" | cut -f1)
echo "=== Bundle created: $OUTPUT ($SIZE) ==="
echo ""
echo "To deploy on an air-gapped machine:"
echo "  $RUNTIME load < $OUTPUT"
echo "  $COMPOSE up"
