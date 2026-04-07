#!/bin/bash
# Detect container runtime (Podman or Docker) and run compose commands.
# Usage: ./scripts/run.sh [compose args...]
# Examples:
#   ./scripts/run.sh up -d          # Start in background
#   ./scripts/run.sh build          # Build images
#   ./scripts/run.sh down           # Stop containers
#   ./scripts/run.sh down -v        # Stop and remove volumes
#   ./scripts/run.sh ps             # List containers

set -euo pipefail

# Detect container runtime
if command -v podman &>/dev/null && ! command -v docker &>/dev/null; then
  RUNTIME="podman"
elif command -v docker &>/dev/null; then
  RUNTIME="docker"
else
  echo "Error: Neither Docker nor Podman found. Install one of them first."
  exit 1
fi

# Detect compose command
if [ "$RUNTIME" = "podman" ]; then
  if command -v podman-compose &>/dev/null; then
    COMPOSE="podman-compose"
  elif podman compose version &>/dev/null 2>&1; then
    COMPOSE="podman compose"
  else
    echo "Error: podman-compose not found. Install it with: pip install podman-compose"
    exit 1
  fi
else
  COMPOSE="docker compose"
fi

echo "Using: $COMPOSE"
$COMPOSE "$@"
