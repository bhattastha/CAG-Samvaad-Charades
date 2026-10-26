#!/usr/bin/env bash
# Preview-pod launcher: local PostgreSQL (data under /app/.data/postgres) + the Fastify API serving web + /api on :3000.
set -euo pipefail
ROOT=/app
PGDATA=$ROOT/.data/postgres
PGBIN=/usr/lib/postgresql/15/bin

if [ ! -x "$PGBIN/postgres" ]; then
  # the pod image does not keep apt packages across restarts: reinstall (data under /app/.data survives)
  (apt-get -o DPkg::Lock::Timeout=180 update -q && DEBIAN_FRONTEND=noninteractive apt-get -o DPkg::Lock::Timeout=180 install -y -q postgresql) >/tmp/pg-install.log 2>&1
fi
mkdir -p "$PGDATA" /var/run/postgresql && chown -R postgres:postgres "$ROOT/.data/postgres" /var/run/postgresql
if [ ! -f "$PGDATA/PG_VERSION" ]; then
  su postgres -c "$PGBIN/initdb -D $PGDATA --auth-local=peer --auth-host=scram-sha-256" >/dev/null
fi
if ! su postgres -c "$PGBIN/pg_ctl -D $PGDATA status" >/dev/null 2>&1; then
  rm -f "$PGDATA/postmaster.pid"  # stale after a pod restart
  su postgres -c "$PGBIN/pg_ctl -D $PGDATA -l /var/run/postgresql/server.log -o '-c listen_addresses=127.0.0.1' start -w" >/dev/null
fi
PGPASS=$(grep '^PGPASS=' $ROOT/backend/.env | cut -d= -f2-)
su postgres -c "psql -q" <<SQL
DO \$\$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='hc') THEN CREATE ROLE hc LOGIN PASSWORD '$PGPASS'; END IF;
END \$\$;
SQL
su postgres -c "psql -tAc \"SELECT 1 FROM pg_database WHERE datname='hindi_charades'\"" | grep -q 1 || su postgres -c "createdb -O hc hindi_charades"

cd "$ROOT"
[ -d node_modules ] || CI=true corepack pnpm install --frozen-lockfile
[ -f apps/web/dist/index.html ] || corepack pnpm --filter @hc/web build
cd apps/api
exec ./node_modules/.bin/tsx --env-file=$ROOT/backend/.env src/server.ts
