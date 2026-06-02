---
title: Projection REST API
description: Query projection results and inspect projection metadata.
banner:
  content: '<span>You are viewing docs for v0.1.0. <a href="/deql-lang/">Switch to latest</a></span>'
---

Projections have a dedicated query endpoint plus metadata endpoints under `/api/dereg`.

## Query a Projection

| Method | Route |
|---|---|
| `GET` | `/api/projections/{name}/query` |

Query parameters:

- `limit` optional, default `1000`
- `offset` optional, default `0`

Behavior:

- Validates projection name as an identifier
- Confirms the projection exists in DeReg
- Reads `query_sql` from `DESCRIBE PROJECTION {name}`
- Executes that SQL with appended pagination
- Returns Arrow IPC

## Projection Metadata

| Method | Route |
|---|---|
| `GET` | `/api/dereg/projections` |
| `GET` | `/api/dereg/projections/{name}` |

## Creating Projections

Use the optional schema API:

| Method | Route |
|---|---|
| `POST` | `/api/deql/create` |

with a `CREATE PROJECTION ...` statement.

## Errors

| Status | Meaning |
|---|---|
| `400` | Invalid identifier |
| `404` | Projection not found |
| `500` | Missing `query_sql` or execution failure |