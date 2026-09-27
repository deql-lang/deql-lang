---
title: Inspections REST API
description: Runtime inspection endpoints for simulating decision/projection execution and inspecting results.
---

The inspections API exposes endpoints for running and managing inspection operations. Inspections simulate the execution of decisions or projections against provided data without modifying the system state. All routes are scoped within an organization via the `{{org_id}}` path parameter.

## Overview

| Method | Route |
|---|---|
| `GET` | `/api/{{org_id}}/deql/inspect/status` |
| `POST` | `/api/{{org_id}}/deql/inspect/{name}/validate` |
| `GET` | `/api/{{org_id}}/deql/inspect/decision` |
| `GET` | `/api/{{org_id}}/deql/inspect/{name}` |
| `POST` | `/api/{{org_id}}/deql/inspect/{name}/start` |
| `POST` | `/api/{{org_id}}/deql/inspect/{name}/stop` |
| `DELETE` | `/api/{{org_id}}/deql/inspect/{name}/outputs` |
| `DELETE` | `/api/{{org_id}}/deql/inspect/outputs` |
| `GET` | `/api/{{org_id}}/deql/inspect/{name}/outputs` |
| `GET` | `/api/{{org_id}}/deql/inspect/outputs` |
| `POST` | `/api/{{org_id}}/deql/inspect/run` |

## Inspection Operations

### Start Inspection

POST to `/api/{{org_id}}/deql/inspect/{name}/start` to begin execution of a previously defined inspection. The inspection runs in the background and creates in-memory output tables.

### Stop Inspection

POST to `/api/{{org_id}}/deql/inspect/{name}/stop` to halt a running inspection. Output tables remain available for querying.

### Drop Outputs

DELETE to `/api/{{org_id}}/deql/inspect/{name}/outputs` to remove output tables. Use `/api/{{org_id}}/deql/inspect/outputs?table=<name>` for global table cleanup.

### Status

GET to `/api/{{org_id}}/deql/inspect/status` to check the current running inspection and its metrics.

## Validation

POST to `/api/{{org_id}}/deql/inspect/{name}/validate` to verify preconditions before running an inspection.

## List Inspections

- `/api/{{org_id}}/deql/inspect/decision` returns all registered inspection definitions
- `/api/{{org_id}}/deql/inspect/outputs` returns all output tables
- `/api/{{org_id}}/deql/inspect/{name}/outputs` returns output tables for a specific inspection

## Ephemeral Execution

POST to `/api/{{org_id}}/deql/inspect/run` with DeQL `INSPECT` text to execute an inline inspection without persisting the definition. Output tables exist only during the current session.

## Response Format

- All responses return JSON
- Status and error responses return JSON
- Pagination is available via `limit` and `offset` query parameters

## Concurrency

Only one inspection can run per organization at a time. Attempting to start a new inspection while another is running returns `409 Conflict`.