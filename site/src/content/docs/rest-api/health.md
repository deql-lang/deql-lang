---
title: Info REST API
description: Runtime metadata endpoint for monitoring deployment status.
---

## Runtime Information

| Method | Route |
|---|---|
| `GET` | `/api/{{org_id}}/deql/info` |

### Response

```json
{
  "version": "...",
  "readonly": false,
  "counts": {
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

## Usage

- Deployment health checks
- Smoke verification that the runtime has started
- Quick visibility into concept registration counts