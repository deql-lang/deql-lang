---
title: DeReg REST API
description: Metadata and schema introspection endpoints for registered DeQL concepts.
---

The DeReg API exposes registered schema metadata using read-only Arrow IPC endpoints.

DeReg stands for **Decision Registry**. It is the registry of compiled DeQL definitions for a system: aggregates, commands, events, decisions, projections, templates, and event stores. Because DeReg can be exported and then loaded into another environment, it is also the portability layer for moving a DeQL system definition across environments.

## Concept Collections

| Method | Route |
|---|---|
| `GET` | `/api/dereg/aggregates` |
| `GET` | `/api/dereg/commands` |
| `GET` | `/api/dereg/events` |
| `GET` | `/api/dereg/decisions` |
| `GET` | `/api/dereg/projections` |
| `GET` | `/api/dereg/templates` |
| `GET` | `/api/dereg/eventstores` |

## Single-Definition Lookups

| Method | Route |
|---|---|
| `GET` | `/api/dereg/aggregates/{name}` |
| `GET` | `/api/dereg/commands/{name}` |
| `GET` | `/api/dereg/events/{name}` |
| `GET` | `/api/dereg/decisions/{name}` |
| `GET` | `/api/dereg/projections/{name}` |
| `GET` | `/api/dereg/templates/{name}` |
| `GET` | `/api/dereg/eventstores/{name}` |

## Detail Endpoints

| Method | Route |
|---|---|
| `GET` | `/api/dereg/aggregates/{name}/fields` |
| `GET` | `/api/dereg/commands/{name}/fields` |
| `GET` | `/api/dereg/events/{name}/fields` |
| `GET` | `/api/dereg/decisions/{name}/emits` |
| `GET` | `/api/dereg/templates/{name}/params` |
| `GET` | `/api/dereg/templates/{name}/instances` |

## Behavior

- All responses are Arrow IPC unless an execution layer error is returned as JSON.
- Unknown concept groups or sub-resources return `404`.
- Invalid names return `400`.
- Single-row lookups return `404` if no rows are found.

## Internal Mapping

These routes are backed by DeReg meta tables such as:

- aggregate definitions and fields
- command definitions and fields
- event definitions and fields
- decision definitions and emitted-event metadata
- projection definitions
- template definitions, parameters, and instances
- event store definitions