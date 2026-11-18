#!/usr/bin/env bash
set -euo pipefail

: "${IMAGE_REPOSITORY:?IMAGE_REPOSITORY is required}"
: "${IMAGE_TAG:?IMAGE_TAG is required}"
compose=(docker compose -f compose.prod.yml)
previous=''
if [[ -f .release-tag ]]; then previous=$(cat .release-tag); fi

restore_previous() {
  if [[ -n "$previous" ]]; then
    echo "Restoring previous image tag: $previous" >&2
    IMAGE_TAG="$previous" "${compose[@]}" pull
    IMAGE_TAG="$previous" "${compose[@]}" up -d --remove-orphans
  fi
}

"${compose[@]}" pull
if ! "${compose[@]}" up -d --remove-orphans; then
  echo "Deployment failed to start: $IMAGE_TAG" >&2
  restore_previous
  exit 1
fi

for attempt in {1..30}; do
  if "${compose[@]}" exec -T api node -e "fetch('http://127.0.0.1:3000/api/health').then(r => process.exit(r.ok ? 0 : 1)).catch(() => process.exit(1))" >/dev/null 2>&1 \
    && "${compose[@]}" exec -T web wget -qO- http://127.0.0.1/ >/dev/null 2>&1; then
    printf '%s\n' "$IMAGE_TAG" > .release-tag
    echo "Deployment healthy: $IMAGE_TAG"
    exit 0
  fi
  sleep 2
done

echo "Deployment health check failed: $IMAGE_TAG" >&2
restore_previous
exit 1
