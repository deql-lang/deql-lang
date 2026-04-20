---
title: Template REST API
description: Template metadata and schema creation behavior.
---

Templates are exposed through metadata endpoints and can be registered through the schema API. There is no dedicated HTTP endpoint for `APPLY TEMPLATE` at this time.

## Template Metadata

| Method | Route |
|---|---|
| `GET` | `/api/dereg/templates` |
| `GET` | `/api/dereg/templates/{name}` |
| `GET` | `/api/dereg/templates/{name}/params` |
| `GET` | `/api/dereg/templates/{name}/instances` |

These routes return Arrow IPC backed by:

- template definitions
- template parameters
- recorded template instantiations

## Creating Templates

Use the optional schema API:

| Method | Route |
|---|---|
| `POST` | `/api/deql/create` |

with a DeQL `CREATE TEMPLATE ...` statement.

## Notes

- The current schema API validates only `CREATE ...` statements.
- Template application remains a DeQL/runtime operation rather than a standalone REST route.