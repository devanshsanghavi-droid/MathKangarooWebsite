#!/usr/bin/env bash
# Upload the operator credentials from .dev.vars to Cloudflare as Worker secrets.
#
#   pnpm cf:secrets
#
# Secrets, not build variables. Anything Next's env loader can see at build time gets baked
# into the deployed worker script in plaintext — see scripts/check-build-secrets.ts. A Worker
# secret is injected at runtime instead, so it never touches the bundle.
#
# Values are piped from .dev.vars rather than typed, so they are not left in shell history.
set -euo pipefail

FILE=".dev.vars"
KEYS=(ADMIN_USERNAME ADMIN_PASSWORD_HASH AUTH_SECRET)

if [ ! -f "$FILE" ]; then
  echo "No $FILE found. Generate one first:" >&2
  echo "  node scripts/hash-password.ts <username> <password> > $FILE" >&2
  exit 1
fi

for key in "${KEYS[@]}"; do
  # Take everything after the first '=' so base64 padding and '=' inside values survive.
  value="$(grep "^${key}=" "$FILE" | head -1 | cut -d= -f2-)"
  if [ -z "$value" ]; then
    echo "$key is missing or empty in $FILE" >&2
    exit 1
  fi
  echo "→ uploading $key"
  printf '%s' "$value" | npx wrangler secret put "$key"
done

echo
echo "Done. Verify with: npx wrangler secret list"
