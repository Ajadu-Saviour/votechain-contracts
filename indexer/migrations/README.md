# Indexer Database Migrations

VoteChain indexer uses [sqlx built-in migrations](https://docs.rs/sqlx/latest/sqlx/macro.migrate.html)
to manage the PostgreSQL schema incrementally.

## How it works

- Migration files live in this directory (`indexer/migrations/`).
- At startup the indexer calls `sqlx::migrate!("./migrations").run(&pool)` which:
  1. Creates a `_sqlx_migrations` tracking table if it does not exist.
  2. Reads all `*.sql` files in this directory, sorted by version number.
  3. Applies only the migrations that have not yet been run.
  4. Records each applied migration with a checksum in `_sqlx_migrations`.

This replaces the previous `sqlx::raw_sql(include_str!(...))` approach which
re-executed the full schema script on every startup. The old approach was safe
only because all statements used `CREATE TABLE IF NOT EXISTS`, but it could not
handle `ALTER TABLE`, column additions, data backfills, or any change that is
not idempotent via `IF NOT EXISTS`.

## File naming convention

```
{version}_{description}.sql
```

- `version`: zero-padded integer, e.g. `001`, `002`, `003`
- `description`: snake_case description of the change

Examples:
- `001_init.sql` — initial schema
- `002_add_voter_index.sql` — voter address index

## Adding a new migration

1. Create a new file: `indexer/migrations/003_your_description.sql`
2. Write forward-only SQL (no rollback — sqlx does not support down migrations by default)
3. Test locally: `sqlx migrate run --database-url $DATABASE_URL`
4. Commit the file; it will be applied automatically on the next indexer startup

## Running migrations manually

```bash
# Apply all pending migrations
sqlx migrate run --database-url "$DATABASE_URL" --source indexer/migrations

# Check migration status
sqlx migrate info --database-url "$DATABASE_URL" --source indexer/migrations
```

Install the sqlx CLI: `cargo install sqlx-cli --no-default-features --features postgres`

## Existing migrations

| Version | File                        | Description                                       |
|---------|-----------------------------|---------------------------------------------------|
| 001     | `001_init.sql`              | Initial schema: `indexer_cursor`, `contract_events`, indexes |
| 002     | `002_add_voter_index.sql`   | Add `voter_address` column and index for voter vote history |
| 003     | `003_dedupe_events.sql`     | Remove duplicate events and add a unique index so `ON CONFLICT DO NOTHING` de-duplicates |
