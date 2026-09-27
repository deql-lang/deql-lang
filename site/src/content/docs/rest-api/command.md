---
title: Command Execution REST API
description: Execute commands against aggregate instances.
---

Commands are executed through organization-scoped endpoints. Each command corresponds to a decision that may emit events or reject the command. All routes are scoped within an organization via the `{{org_id}}` path parameter.

## Execute a Command

| Method | Route |
|---|---|
| `POST` | `/api/{{org_id}}/deql/{aggregate}/{command}` |

### Request Body

A flat JSON object with command parameters as properties. Supported types include:

- Strings (automatically quoted)
- Numbers (emitted as-is)
- Booleans (`true`/`false`)
- `null`

Example:

```json
{
  "employee_id": "EMP-001",
  "name": "Alice",
  "grade": "L4"
}
```

### Query Parameters

- `mode=async` returns `501 Not Implemented` (async mode not yet supported)

### Behavior

- Validates the aggregate exists
- Validates the command exists and belongs to the aggregate
- Validates command parameters match the command definition
- Executes the command through the associated decision
- Persists emitted events

### Success Response

Returns `200 OK` with:

```json
{
  "events": [...],
  "meta": {
    "aggregate": "...",
    "command": "...",
    "count": 1
  }
}
```

Each event includes:
- `_event_type`: type of event emitted
- `_aggregate_id`: instance identifier
- `_event_id`: unique identifier
- `_offset`: sequential offset
- `fields`: event payload (excluding SENSITIVE fields)

### Error Cases

| Status | Meaning |
|---|---|
| `400` | Invalid identifier, parameter validation failed, or unsupported value type |
| `403` | Command belongs to a different aggregate or server is read-only |
| `404` | Aggregate, command, or decision binding not found |
| `409` | Optimistic concurrency conflict (`expected_version` mismatch) |
| `422` | Command rejected by decision guard (business logic condition) |
| `501` | Async mode requested but not implemented |

### Concurrency

If the request body includes an `expected_version` field, the system compares it with the next expected version. If they don't match, returns `409 Conflict`.

### Field Visibility

- SENSITIVE fields are excluded from the HTTP response but included in persisted events
- VOLATILE fields are included in the HTTP response but excluded from persisted events