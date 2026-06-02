---
title: Query Console REST API
description: Optional read-only SQL console exposed at /api/query.
banner:
  content: '<span>You are viewing docs for v0.1.0. <a href="/deql-lang/">Switch to latest</a></span>'
---

The query console is an optional development endpoint.

## Availability

This route may be deployment-dependent and can be omitted by conservative runtime configurations.

## Route

| Method | Route |
|---|---|
| `POST` | `/api/query` |

Request body:

```json
{
  "sql": "SELECT * FROM \"dereg\".\"Employee$Events\";"
}
```

## Validation Rules

- SQL must start with `SELECT` or `WITH`
- Mutation keywords are rejected even if they appear later in the text
- On success, result batches are returned as Arrow IPC

## Errors

| Status | Meaning |
|---|---|
| `403` | Non-read-only SQL was supplied |
| `404` | Route not registered or not available in the current deployment |
| `500` | Query execution or IPC serialization failure |

## Notes

- This endpoint is intended for debugging, exploration, and lightweight integrations.
- It is not the primary path for schema mutation or command execution.