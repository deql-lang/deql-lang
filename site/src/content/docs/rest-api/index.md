---
title: REST API Overview
description: HTTP API structure for a DeQL runtime including route groups, response formats, and endpoint categories.
---

This section describes the HTTP contract exposed by a DeQL runtime.

## Organization Scoping

All endpoints are scoped within an organization via the `org_id` path parameter. This ensures clear segregation of data between different organizations.

## Route Groups

| Group | Purpose |
|---|---|
| `/api/{org_id}/deql/info` | DeQL server info and concept counts |
| `/api/{org_id}/deql/registry/...` | Registry introspection for DeQL concepts |
| `/api/{org_id}/deql/aggregates/...` | Aggregate state queries and event access |
| `/api/{org_id}/deql/{aggregate}/{command}` | Command execution |
| `/api/{org_id}/dereg/...` | Registry management, metrics, and admin operations |

## Implemented Endpoints

### Info & Inspection

| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/{org_id}/deql/info` | Get DeQL server info, concept counts, and rehydration state |

### Registry Routes

| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/{org_id}/deql/registry/routes` | List REST routes exported by DeQL-managed concepts |
| GET | `/api/{org_id}/deql/registry/{concept_type}` | List registered concepts (aggregates, commands, events, decisions, projections, templates) |
| GET | `/api/{org_id}/deql/registry/{concept_type}/{name}` | Get detailed information about a registered concept |
| GET | `/api/{org_id}/deql/registry/{concept_type}/{name}/schema` | Get schema for a registered concept |

### Aggregate Queries

| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/{org_id}/deql/aggregates/{agg}/agg` | Query folded aggregate state (current state from events) |
| GET | `/api/{org_id}/deql/aggregates/{agg}/events` | Query the `deql_events` stream |

### Command Execution

| Method | Endpoint | Description |
|---|---|---|
| POST | `/api/{org_id}/deql/{aggregate}/{commandname}` | Execute a DeQL command against an aggregate |

### DeReg Management

| Method | Endpoint | Description |
|---|---|---|
| POST | `/api/{org_id}/dereg/definitions` | Register DeQL definitions (text/plain) |
| GET | `/api/{org_id}/dereg/metrics` | Get DeQL metrics; `scope=all` for all orgs |
| POST | `/api/{org_id}/dereg/admin/validate` | Validate DeQL definitions (report only) |

## Security

- All endpoints require a valid organization ID (`org_id`)
- Aggregate, command, and concept names are validated as identifiers
- Command execution requires the command to resolve to a decision for the specified aggregate
- Direct writes to `deql_events` stream are blocked; use the command execution endpoint instead

## Implementation Notes

- **Event Stream**: Events are persisted to a single per-org `deql_events` stream via the `POST /api/{org_id}/deql/{aggregate}/{command}` endpoint
- **Aggregate State**: The `GET /api/{org_id}/deql/aggregates/{agg}/agg` endpoint queries the `deql_events` stream using SQL folding to compute current state
- **Registry**: The DeReg registry is lazily rehydrated from the audit log on first access per organization

## Additional Resources

- [Registry](./registry.md) - Registry introspection endpoints
- [Command Execution](./command.md) - Command execution endpoints
- [Aggregate Access](./aggregate.md) - Aggregate state and event endpoints