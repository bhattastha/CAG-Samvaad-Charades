#!/usr/bin/env bash
# Preview QA helper: plants a one-time sign-in code for EMAIL (valid 10 min) directly in the DB. Usage: test-otp.sh email code
set -euo pipefail
EMAIL=$(echo "$1" | tr 'A-Z' 'a-z'); CODE=$2
SECRET=$(grep '^JWT_SECRET=' /app/backend/.env | cut -d= -f2-)
HASH=$(printf '%s' "$EMAIL:$CODE:$SECRET" | sha256sum | cut -d' ' -f1)
DBURL=$(grep '^DATABASE_URL=' /app/backend/.env | cut -d= -f2- | tr -d '"')
psql -q "$DBURL" <<SQL
INSERT INTO otp_challenges (email, code_hash, expires_at, tries, sent_count, window_start)
VALUES ('$EMAIL', '$HASH', now() + interval '10 minutes', 0, 1, now())
ON CONFLICT (email) DO UPDATE SET code_hash=EXCLUDED.code_hash, expires_at=EXCLUDED.expires_at, tries=0;
SQL
echo "planted code for $EMAIL"
