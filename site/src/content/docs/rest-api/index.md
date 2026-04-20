---
title: REST API Overview
description: HTTP API structure for a DeQL runtime, including route groups, response formats, and optional route classes.
---

This section describes the HTTP contract exposed by a DeQL runtime. Deployment and startup mechanics are intentionally out of scope for the language documentation.

## Response Formats

- Most tabular endpoints return `application/vnd.apache.arrow.stream`.
- Status-style responses return JSON.
- Errors return JSON in the shape:

```json
{ "error": "...message..." }
```

- `GET /api/deql/export` returns `text/plain`.

## Route Groups

| Group | Purpose |
|---|---|
| `/health`, `/info` | Liveness and runtime metadata |
| `/api/dereg/...` | Metadata and schema introspection for registered DeQL concepts |
| `/api/aggregates/...` | Aggregate state, event streams, inspect tables, and command execution |
| `/api/projections/{name}/query` | Execute a registered projection query |
| `/api/deql/export` | Export the registered schema as DeQL text |
| `/api/deql/create` | Optional schema creation endpoint |
| `/api/query` | Optional read-only SQL console |

## Security and Validation Defaults

- Aggregate, command, projection, and concept names are validated as identifiers.
- `/api/query` accepts only read-only `SELECT` or `WITH` SQL.
- `/api/deql/create` accepts only DeQL `CREATE` statements.
- Command execution is aggregate-scoped and checks that the command resolves to a decision for that aggregate.
- Read-only mode blocks mutating operations.

## Concept Mapping

- Aggregates: state and event access under `/api/aggregates/...`
- Commands: executed through `/api/aggregates/{agg}/execute/{command}`
- Events, decisions, templates, and event stores: primarily exposed through `/api/dereg/...`
- Projections: queried through `/api/projections/{name}/query`
- Schema definitions: created through `/api/deql/create` when available

## CLI vs REST API Access

The same DeQL operations are available via the interactive CLI and via the HTTP API. The table below shows the equivalent surface for common operations.

| Operation | CLI (DeQL) | REST API |
|---|---|---|
| Execute a command | `EXECUTE HireEmployee(employee_id := ...)` | `POST /api/aggregates/{agg}/execute/{command}` with JSON payload |
| Query aggregate state | `SELECT * FROM DeReg."BankAccount$Agg"` | `GET /api/aggregates/{agg}/state` |
| Query event stream | `SELECT * FROM DeReg."BankAccount$Events"` | `GET /api/aggregates/{agg}/events` |
| Query a projection | `SELECT * FROM DeReg."AccountBalance"` | `GET /api/projections/{name}/query` |
| Run arbitrary SQL | `SELECT ...` (interactive session) | `POST /api/query` with `{ "sql": "..." }` |
| Export schema | `EXPORT DEREG;` | `GET /api/deql/export` |
| Define new concepts | `CREATE AGGREGATE ...` etc. | `POST /api/deql/create` with DeQL text |
| Inspect a concept | `DESCRIBE DECISION DepositFunds;` | `GET /api/dereg/decisions/{name}` |
| List all aggregates | `DESCRIBE AGGREGATES;` | `GET /api/dereg/aggregates` |
| Validate registry | `VALIDATE DEREG;` | — (CLI only) |
| Inspect inspect tables | `INSPECT DECISION Hire FROM ...` | `GET /api/aggregates/{agg}/inspect/{table}` |

The CLI is suited for interactive exploration, schema authoring, and debugging. The REST API is suited for application integration, automation, and single-environment operation.

### Hybrid Environment Inspection (CLI)

One area where the CLI has no REST equivalent is **hybrid environment inspection** — running side-effect-free simulations that span environment boundaries. For example:


Because `INSPECT` is side-effect-free and the CLI connects directly to named event stores, it can mix data sources across environments naturally. 