This is a Next.js 16 internal Kanban application with LDAP authentication and PostgreSQL persistence through Prisma ORM 7.

## Local setup

1. Make sure PostgreSQL is running locally, create or choose a database, and copy the matching values from `.env.example` into `.env.local`:

```bash
DB_HOST=127.0.0.1
DB_PORT=5432
DB_NAME=tta_board
DB_USER=postgres
DB_PASSWORD=
DB_SCHEMA=public
```

Prisma requires a PostgreSQL connection string internally. The application builds it server-side from these local settings; you do not configure `DATABASE_URL`.

Leave `DB_PASSWORD` empty only when the local PostgreSQL authentication rules explicitly allow trusted local connections. Production must use authenticated access.

2. Apply migrations, generate the client, and seed development data:

```bash
npm run db:deploy
npm run db:generate
npm run db:seed
```

3. Configure the existing LDAP and session variables, then run:

```bash
npm run dev
```

Use `npm run db:migrate -- --name <change>` while developing schema changes. Production releases must run `npm run db:deploy`; do not use `prisma db push` in production.

## Database boundaries

- `app/lib/db`: server-only Prisma infrastructure.
- `app/lib/dal`: authenticated reads that return minimal DTOs.
- `app/lib/services`: validation, business rules, and transactions.
- Server Actions are thin entry points and never query Prisma directly.
- LDAP authenticates credentials. PostgreSQL stores the local user UUID, board ownership, assignments, and Kanban data.
