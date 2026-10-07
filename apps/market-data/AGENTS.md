# Market data instructions

- Schema changes belong in [db/migrations](../../db/migrations) at the repository root, never here. Do not edit an applied migration; add a new one.
- Keep database tooling separate from service code. Both Java services read this data and must run against the same schema version.
- Initialization requires an empty public schema and never drops data.
- Generated archives under `db/seeds` are local data and are not committed.
- Follow the [README](README.md) for the generate, validate, and import workflow.
