---
title: DeReg REST API
description: Registry endpoints for managing and querying DeQL concepts.
---

The DeReg API provides endpoints for managing and querying the DeQL concept registry. Use these endpoints to register new concepts, inspect registered definitions, and retrieve registry metadata.

## Overview

| Method | Route |
|---|---|
| `POST` | `/api/dereg/definitions` |
| `GET` | `/api/dereg/metrics` |
| `POST` | `/api/dereg/admin/replay` |
| `POST` | `/api/dereg/admin/replay-refresh` |
| `POST` | `/api/dereg/admin/validate` |

## Concept Metadata

| Method | Route |
|---|---|
| `GET` | `/api/dereg/aggregates` |
| `GET` | `/api/dereg/commands` |
| `GET` | `/api/dereg/events` |
| `GET` | `/api/dereg/decisions` |
| `GET` | `/api/dereg/projections` |
| `GET` | `/api/dereg/templates` |
| `GET` | `/api/dereg/eventstores` |

## Single Concept Lookup

| Method | Route |
|---|---|
| `GET` | `/api/dereg/aggregates/{name}` |
| `GET` | `/api/dereg/commands/{name}` |
| `GET` | `/api/dereg/events/{name}` |
| `GET` | `/api/dereg/decisions/{name}` |
| `GET` | `/api/dereg/projections/{name}` |
| `GET` | `/api/dereg/templates/{name}` |
| `GET` | `/api/dereg/eventstores/{name}` |

## Schema Endpoints

| Method | Route |
|---|---|
| `GET` | `/api/dereg/aggregates/{name}/fields` |
| `GET` | `/api/dereg/commands/{name}/fields` |
| `GET` | `/api/dereg/events/{name}/fields` |
| `GET` | `/api/dereg/decisions/{name}/emits` |
| `GET` | `/api/dereg/templates/{name}/params` |
| `GET` | `/api/dereg/templates/{name}/instances` |

## Behavior

- All responses return JSON
- Unknown concepts or sub-resources return `404 Not Found`
- Invalid identifiers return `400 Bad Request`
- Single-item lookups return `404 Not Found` when no matching item exists

## Registry Operations

### Register Concepts

POST to `/api/dereg/definitions` with DeQL `CREATE` statements in plain text. Each statement creates or replaces a concept in the registry.

### Validation

- `/api/dereg/admin/replay` performs read-only validation of definitions
- `/api/dereg/admin/validate` returns a structured validation report

### Refresh

- `/api/dereg/admin/replay-refresh` rebuilds projections and requires exclusive access during operation

## Response Format

- Success responses return JSON
- Error responses return JSON with a single `error` field containing a human-readable message