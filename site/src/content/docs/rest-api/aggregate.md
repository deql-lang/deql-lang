---
title: Aggregate REST API
description: Aggregate state, event stream, and inspect endpoints.
---

Aggregate APIs expose both derived state and raw event history for a registered aggregate.

## State Endpoints

### List aggregate state

| Method | Route |
|---|---|
| `GET` | `/api/aggregates/{agg}` |

Query parameters:

- `limit` optional, default `1000`
- `offset` optional, default `0`

Behavior:

- Validates `{agg}` as an identifier
- Returns `404` if the aggregate is not registered
- Returns Arrow IPC rows from `DeReg."{agg}$Agg"`

Example:

```bash
GET /api/aggregates/Employee
```

### Fetch one aggregate instance

| Method | Route |
|---|---|
| `GET` | `/api/aggregates/{agg}/{id}` |

Behavior:

- Filters by `aggregate_id = '{id}'`
- Returns Arrow IPC

## Event Endpoints

### List all events for an aggregate type

| Method | Route |
|---|---|
| `GET` | `/api/aggregates/{agg}/events` |

Query parameters:

- `limit` optional, default `1000`
- `offset` optional, default `0`

Behavior:

- Returns Arrow IPC rows from `DeReg."{agg}$Events"`

### List events for one stream

| Method | Route |
|---|---|
| `GET` | `/api/aggregates/{agg}/events/{stream_id}` |

Behavior:

- Filters by `stream_id = '{stream_id}'`
- Returns Arrow IPC

## Inspect Table Endpoints

Inspect endpoints expose temporary tables produced by `INSPECT` flows.

| Method | Route |
|---|---|
| `GET` | `/api/aggregates/{agg}/inspect/input/{tablename}` |
| `GET` | `/api/aggregates/{agg}/inspect/output/{tablename}` |

Query parameters:

- `limit` optional, default `1000`
- `offset` optional, default `0`

Behavior:

- Validates aggregate existence
- Rejects table names containing `$`
- Returns `404` if the named table is not present in the current session context
- Returns Arrow IPC for the table contents

## Common Errors

| Status | Meaning |
|---|---|
| `400` | Invalid identifier |
| `404` | Aggregate or inspect table not found |
| `403` | Forbidden inspect access to schema-like tables |
| `500` | IPC serialization or execution error |