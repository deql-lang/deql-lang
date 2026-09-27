---
title: Event REST API
description: Event stream access patterns and event metadata.
---

Events are accessible through two approaches: runtime event streams and event metadata. All routes are scoped within an organization via the `{{org_id}}` path parameter.

## Event Metadata

| Method | Route |
|---|---|
| `GET` | `/api/{{org_id}}/deql/aggregates/{agg}/events` |


These endpoints return deql used to create the event

### Typical Event Fields

- `_stream_id`: stream identity
- `_sequence_number`: event sequence number
- `_event_type`: event type
- `_payload`: event data

These endpoints return event definition metadata.

## Creating Events

| Method | Route |
|---|---|
| `POST` | `/api/{{org_id}}/dereg/definitions` |

Request body contains a DeQL `CREATE EVENT` statement.

## Notes

- There is no direct event creation endpoint.
- Event emission occurs as a side effect of command execution.