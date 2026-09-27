---
title: EventStore REST API
description: EventStore metadata and registration endpoints.
---

EventStore endpoints provide metadata about registered event stores and allow registration through the schema API.

## EventStore Metadata

| Method | Route |
|---|---|
| `GET` | `/api/dereg/eventstores` |
| `GET` | `/api/dereg/eventstores/{name}` |

These endpoints return EventStore definition metadata.

## Creating or Replacing EventStores

| Method | Route |
|---|---|
| `POST` | `/api/dereg/definitions` |

Request body contains a DeQL `CREATE EVENTSTORE` statement.

## Notes

- The HTTP API does not expose low-level append or compaction operations.