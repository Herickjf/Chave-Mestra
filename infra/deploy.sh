#!/usr/bin/env bash
set -euo pipefail

: "${IMAGE_REPOSITORY:?IMAGE_REPOSITORY is required}"
: "${IMAGE_TAG:?IMAGE_TAG is required}"

# Executar no diretório de deploy, ao lado de compose.prod.yml e .env.
compose=(docker compose -f compose.prod.yml)
release_file='.release-tag'
max_attempts=30
retry_interval=2
previous_tag=''

if [[ -f "$release_file" ]]; then
  previous_tag=$(cat "$release_file")
fi

restore_previous() {
  if [[ -n "$previous_tag" ]]; then
    echo "Restoring previous image tag: $previous_tag" >&2
    IMAGE_TAG="$previous_tag" "${compose[@]}" pull
    IMAGE_TAG="$previous_tag" "${compose[@]}" up -d --remove-orphans
  fi
}

check_api() {
  "${compose[@]}" exec -T api node -e '
    fetch("http://127.0.0.1:3000/api/health")
      .then(response => process.exit(response.ok ? 0 : 1))
      .catch(() => process.exit(1));
  ' >/dev/null 2>&1
}

check_web() {
  "${compose[@]}" exec -T web wget -qO- http://127.0.0.1/ >/dev/null 2>&1
}

# A publicação da tag só acontece depois de ambos os serviços responderem.
"${compose[@]}" pull

if ! "${compose[@]}" up -d --remove-orphans; then
  echo "Deployment failed to start: $IMAGE_TAG" >&2
  restore_previous
  exit 1
fi

for ((attempt = 1; attempt <= max_attempts; attempt++)); do
  if check_api && check_web; then
    printf '%s\n' "$IMAGE_TAG" > "$release_file"
    echo "Deployment healthy: $IMAGE_TAG"
    exit 0
  fi

  sleep "$retry_interval"
done

echo "Deployment health check failed: $IMAGE_TAG" >&2
restore_previous
exit 1
