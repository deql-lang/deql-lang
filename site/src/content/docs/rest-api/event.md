---
title: Event REST API
description: Event access patterns in the REST API.
---

Events are exposed in two ways:

1. Runtime event streams under aggregate-scoped endpoints
2. Event metadata through `/api/dereg/events...`

## Runtime Event Stream

| Method | Route |
|---|---|
| `GET` | `/api/aggregates/{agg}/events` |
| `GET` | `/api/aggregates/{agg}/events/{stream_id}` |

These endpoints return Arrow IPC rows from `DeReg."{agg}$Events"`.

Typical event columns include:

- stream identity
- sequence number
- event type
- event payload data

## Event Metadata

| Method | Route |
|---|---|
| `GET` | `/api/dereg/events` |
| `GET` | `/api/dereg/events/{name}` |
| `GET` | `/api/dereg/events/{name}/fields` |

These endpoints return event-definition metadata.

## Creating Events

Event definitions can be registered through the optional schema API:

| Method | Route |
|---|---|
| `POST` | `/api/deql/create` |

Requirements:

- Request contains a DeQL `CREATE EVENT ...` statement

## Notes

- There is no direct `POST /api/events` endpoint.
- Event emission happens as a side effect of command execution through decisions.