#!/bin/bash
# Save workshop Docker images to a portable tarball for offline deployment.
# Usage: ./scripts/bundle.sh [output_file]

set -euo pipefail

OUTPUT="${1:-workshop-images.tar.gz}"

echo "=== Building images ==="
docker compose build

echo "=== Saving images to $OUTPUT ==="
docker save workshop-oracle workshop-app | gzip > "$OUTPUT"

SIZE=$(du -h "$OUTPUT" | cut -f1)
echo "=== Bundle created: $OUTPUT ($SIZE) ==="
echo ""
echo "To deploy on an air-gapped machine:"
echo "  docker load < $OUTPUT"
echo "  docker compose up"
