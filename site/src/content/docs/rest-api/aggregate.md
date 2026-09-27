---
title: Aggregate REST API
description: Aggregate state and event access endpoints.
---

Aggregate endpoints expose both current derived state and event history for registered aggregates. All routes are scoped within an organization via the `{{org_id}}` path parameter.

## State Queries

### List Aggregate State

| Method | Route |
|---|---|
| `GET` | `/api/{{org_id}}/deql/aggregates/{agg}/agg` |

Query parameters:

- `aggregate_id` optional, filter to a single aggregate instance
- `from` optional, pagination offset (default 0)
- `size` optional, page size (default 100, maximum 10000)

Returns the folded current state of aggregate instances.

### Fetch Single Instance

| Method | Route |
|---|---|
| `GET` | `/api/{{org_id}}/deql/aggregates/{agg}/{id}` |

Returns state for a specific aggregate instance by ID.

