# Docker Dev Setup

This stack runs the API, PostgreSQL, and Redis for local development.

## Start

```bash
docker compose -f docker-compose.dev.yml up --build
```

If you changed image dependencies (for example OpenSSL), force a clean API rebuild:

```bash
docker compose -f docker-compose.dev.yml build --no-cache api
docker compose -f docker-compose.dev.yml up
```

## Stop

```bash
docker compose -f docker-compose.dev.yml down
```

## Notes

- API: http://localhost:3000
- Postgres: localhost:5432 (user: rubbi, password: rubbi, db: rubbi)
- Redis: localhost:6379
- The API container runs `prisma db push` on startup for development.
