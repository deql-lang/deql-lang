---
title: Inspections REST API
description: Endpoints for listing and describing runtime-recorded inspections
---

# Inspections REST API

Summary
- The Inspections endpoints expose runtime-recorded inspection metadata created when an `INSPECT` statement runs (REPL/CLI). These endpoints do not trigger inspections — they only surface the records produced by prior `INSPECT` runs.

Endpoints
- `GET /api/dereg/inspections` — list all recorded inspections.
- `GET /api/dereg/inspections/{inspectionname}` — get one inspection by name.
- Compatibility: `/api/dereg/inspection/{inspectionname}` is also accepted for compatibility with singular-path clients.

Response formats
- Primary: `application/vnd.apache.arrow.stream` — the server serializes tabular results as Arrow IPC for efficient clients.
- Fallback/status: JSON for simple status responses or errors (e.g. 404 Not Found).

Schema (columns returned)
- `name` (STRING): the inspection output table name (the `INTO` table from the `INSPECT` statement).
- `kind` (STRING): either `Decision` or `Projection` — the kind of inspected block.
- `input_table` (STRING, nullable): the `FROM` table used as input to the inspection.
- `output_table` (STRING): same as `name` — the `INTO` table where results were registered.
- `full_sql` (STRING, nullable): the canonical SQL text recorded for the inspection. For decision/projection inspections this contains the original `INSPECT ...` statement that produced the record (for example: `INSPECT DECISION LoginAdminDecision FROM test_logins INTO simulated_login_events;`).

Examples
- List all inspections (prefer Arrow-capable client):

 
- Get a single inspection (JSON fallback):
 
Sample JSON row (for readability)

```json
{
  "name": "simulated_login_events",
  "kind": "Decision",
  "input_table": "test_logins",
  "output_table": "simulated_login_events",
  "full_sql": "INSPECT DECISION LoginAdminDecision FROM test_logins INTO simulated_login_events;"
}
```

Validation and authorization
- Path parameters are validated using the server's `validate_identifier` rules — callers should only use safe ASCII identifier names.
- Access to the `meta_inspections` resource is governed by the server's meta-table authorization rules; check your deployment's authorization matrix for who may read inspection metadata.

Notes and client guidance
- The REST API surfaces inspection records that were created by running `INSPECT` (CLI/REPL). To create a new inspection, run `INSPECT` in the CLI or via tooling that has permission to execute DeQL statements — the REST endpoints will then show the recorded inspection.
- The `full_sql` field now contains the original `INSPECT` statement text (not the generated `CREATE` text for the underlying decision/projection), making it easier to display the exact command a user executed.
- Clients that can consume Arrow IPC should prefer the Arrow content-type for performance and fidelity; otherwise request JSON for status/error bodies.

See also
- REST API overview: /docs/rest-api/index.md
- INSPECT reference (CLI): /docs/inspection
