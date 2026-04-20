---
title: Health and Info REST API
description: Always-on operational endpoints for liveness and runtime metadata.
---

These endpoints are always available when the HTTP server is running.

## Health

| Method | Route |
|---|---|
| `GET` | `/health` |

Response:

```json
{ "status": "ok" }
```

## Info

| Method | Route |
|---|---|
| `GET` | `/info` |

Response shape:

```json
{
  "version": "...",
  "readonly": false,
  "concept_counts": {
    "aggregates": 0,
    "commands": 0,
    "events": 0,
    "decisions": 0,
    "projections": 0,
    "templates": 0,
    "eventstores": 0
  }
}
```

## Uses

- Deployment health checks
- Smoke verification that the correct runtime has started
- Quick visibility into read-only mode and concept registration counts