---
title: EventStore REST API
description: Event store metadata and registration through the schema API.
---

Event stores are surfaced through metadata endpoints and can be registered through the optional schema creation API.

## EventStore Metadata

| Method | Route |
|---|---|
| `GET` | `/api/dereg/eventstores` |
| `GET` | `/api/dereg/eventstores/{name}` |

These return event store definition metadata.

## Creating or Replacing EventStores

Use the optional schema API:

| Method | Route |
|---|---|
| `POST` | `/api/deql/create` |

Example body:

```json
{
  "deql": "CREATE EVENTSTORE MainStore WITH (durable.type = 'parquet', durable.path = 'data/events');"
}
```

## Notes

- Event store behavior is implemented in runtime/event-store crates, not in the HTTP layer.
- The HTTP API does not expose low-level append or compaction endpoints.