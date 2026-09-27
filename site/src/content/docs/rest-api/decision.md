---
title: Decision REST API
description: Decision metadata and indirect execution through commands.
---

Decisions are executed indirectly through command execution or via inspection workflows. They do not have standalone execution endpoints.

## Command Execution

When a command is posted to:

```
POST /api/{org_id}/deql/{aggregate}/{command}
```

The system:

1. Resolves the command to its associated decision
2. Validates the decision belongs to the aggregate
3. Executes the decision with the command parameters
4. Persists any emitted events

## Creating Decisions

| Method | Route |
|---|---|
| `POST` | `/api/{{org_id}}/dereg/definitions` |

Request body contains a DeQL `CREATE DECISION` statement.

## Notes

- Decisions are not directly executable via HTTP
- Decision execution is always tied to a command
- Inspection workflows access decision behavior indirectly through their output tables