---
title: Query Console REST API
description: Optional read-only SQL console for debugging and exploration.
---

The query console is an optional endpoint for executing read-only SQL queries.

## Availability

This route may be deployment-dependent and can be disabled in conservative runtime configurations.

## Query Execution

| Method | Route |
|---|---|
| `POST` | `/api/query` |

### Request Body

```json
{
  "sql": "SELECT * FROM event_stream;"
}
```

### Validation Rules

- SQL must begin with `SELECT` or `WITH`
- Mutation keywords are rejected

### Response Format

- Tabular results return as JSON arrays
- Errors return JSON with an `error` field

## Error Responses

| Status | Meaning |
|---|---|
| `403` | Non-read-only SQL was provided |
| `404` | Route not available in current deployment |
| `500` | Query execution or serialization failure |

## Notes

- This endpoint is intended for debugging and exploration
- Not the primary path for schema mutation or command execution