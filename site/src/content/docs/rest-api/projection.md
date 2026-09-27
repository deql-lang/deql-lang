---
title: Projection REST API
description: Query registered projections and inspect projection metadata.
---

Projection endpoints provide access to pre-computed query results and metadata about registered projections. All routes are scoped within an organization via the `{{org_id}}` path parameter.

## Query a Projection

| Method | Route |
|---|---|
| `GET` | `/api/{{org_id}}/deql/projections/{name}/query` |

Query parameters:

- `limit` optional, default 1000
- `offset` optional, default 0

Returns results of the registered projection query.

## Projection Metadata

| Method | Route |
|---|---|
| `GET` | `/api/dereg/projections` |
| `GET` | `/api/dereg/projections/{name}` |

## Creating Projections

Use the schema API:

| Method | Route |
|---|---|
| `POST` | `/api/dereg/definitions` |

Request body contains a DeQL `CREATE PROJECTION` statement.

## Error Responses

| Status | Meaning |
|---|---|
| `400` | Invalid identifier |
| `404` | Projection not found |
| `500` | Query execution failure |