---
title: Template REST API
description: Template metadata and schema creation endpoints.
---

Template endpoints provide metadata about registered templates and allow registration through the schema API.

## Template Metadata

| Method | Route |
|---|---|
| `GET` | `/api/dereg/templates` |
| `GET` | `/api/dereg/templates/{name}` |
| `GET` | `/api/dereg/templates/{name}/params` |
| `GET` | `/api/dereg/templates/{name}/instances` |

These endpoints return template definitions, parameters, and instantiation records.

## Creating Templates

| Method | Route |
|---|---|
| `POST` | `/api/dereg/definitions` |

Request body contains a DeQL `CREATE TEMPLATE` statement.

## Notes

- Template application is a DeQL runtime operation, not exposed as a separate HTTP endpoint.