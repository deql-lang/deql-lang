---
title: Decision REST API
description: How decisions are surfaced in the HTTP API.
---

Decisions do not currently have a standalone execution endpoint. They are surfaced indirectly through command execution and directly through metadata endpoints.

## Decision Metadata

| Method | Route |
|---|---|
| `GET` | `/api/dereg/decisions` |
| `GET` | `/api/dereg/decisions/{name}` |
| `GET` | `/api/dereg/decisions/{name}/emits` |

These endpoints return Arrow IPC from:

- `meta_decisions`
- `meta_decision_emits`

## Decision Execution Model

Decisions are executed indirectly when a command is posted to:

```text
POST /api/aggregates/{agg}/execute/{command}
```

The server:

1. Resolves the command to a registered decision
2. Confirms that decision belongs to `{agg}`
3. Executes the resulting `EXECUTE` statement

## Creating Decisions

Decisions can be registered through the optional schema API:

| Method | Route |
|---|---|
| `POST` | `/api/deql/create` |

Payload example:

```json
{
  "deql": "CREATE DECISION Promote FOR Employee ON COMMAND PromoteEmployee EMIT AS SELECT EVENT EmployeePromoted (new_grade := :new_grade);"
}
```

## Notes

- There is no standalone `POST /api/decisions/{name}/execute` route.
- Inspect workflows are exposed through aggregate inspect table endpoints, not direct decision HTTP endpoints.