---
title: Command REST API
description: Execute registered commands through aggregate-scoped endpoints.
---

Commands are executed through an aggregate-scoped endpoint rather than a global `/api/commands/...` route.

## Execute a Command

| Method | Route |
|---|---|
| `POST` | `/api/aggregates/{agg}/execute/{command}` |

Request body:

```json
{
  "params": {
    "employee_id": "EMP-001",
    "name": "Alice",
    "grade": "L4"
  }
}
```

Behavior:

- Validates `{agg}` and `{command}` as identifiers
- Confirms the aggregate exists
- Confirms the command exists
- Confirms the command resolves to a decision for the same aggregate
- Translates the JSON body into a DeQL `EXECUTE ...` statement

Success response:

- Usually Arrow IPC representing emitted events or rejection details
- Status JSON only if execution returns a non-tabular status

## Error Cases

| Status | Meaning |
|---|---|
| `400` | Invalid identifier or invalid parameter key |
| `403` | Command belongs to a different aggregate, or server is read-only |
| `404` | Aggregate, command, or decision binding not found |

## Notes

- Boolean and numeric-looking values are emitted unquoted into the generated DeQL command.
- Other values are single-quoted and escaped.
- There is no standalone command metadata endpoint; use the [DeReg API](./dereg/) for command definitions.