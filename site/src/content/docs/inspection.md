---
title: Inspection
description: "INSPECT DECISION, INSPECT PROJECTION, production replay, and CI/CD testing in DeQL."
---

DeQL supports inspection as a first-class capability. `INSPECT` statements evaluate decisions and projections in a side-effect-free mode — using the same logic as production but without writing to the event store, updating projections, or triggering any side effects.

## Why Inspection Matters

In traditional CQRS/ES systems, the only way to know what a command will do is to execute it. This makes testing, debugging, and validation expensive and risky.

DeQL's inspection enables:

- Simulation — "What would happen if these commands were processed?"
- Validation — "Would these commands be accepted or rejected?"
- Projection verification — "Does the read model produce the expected output from these events?"
- Debugging — "Why was this command rejected?"
- Automated verification — CI/CD pipelines that test decisions and projections without side effects

## Decision Inspection Syntax

```deql
INSPECT DECISION <DecisionName>
FROM <source_table>
INTO <output_table>;
```

The `FROM` clause specifies a table (or view) containing the commands to simulate. The `INTO` clause specifies where the simulated events are written — as data, not as persisted events.

## Example: Inspecting Hires

Given a table of test hire commands (positional columns auto-mapped to command fields):

```deql
CREATE TABLE test_hires AS VALUES
  ('EMP-100', 'Charlie', 'L3'),
  ('EMP-101', 'Diana', 'L5');

INSPECT DECISION Hire
FROM test_hires
INTO simulated_hire_events;

SELECT stream_id, event_type, data
FROM simulated_hire_events;
```

The `simulated_hire_events` table contains the events that would have been emitted for each row in `test_hires`, without actually modifying the event store.

## Example: Inspecting Account Opens

```deql
CREATE TABLE test_opens AS VALUES
  ('ACC-100', 500.00),
  ('ACC-101', 0.00),
  ('ACC-102', 1500.00);

INSPECT DECISION Open
FROM test_opens
INTO simulated_open_events;

SELECT stream_id, event_type, data
FROM simulated_open_events;
```

## Example: Overwrite Semantics

Re-running `INSPECT ... INTO` overwrites the target table:

```deql
INSPECT DECISION Open
FROM test_opens
INTO simulated_open_events;

SELECT COUNT(*) AS event_count FROM simulated_open_events;
```

## Inspection in CI/CD

Inspection can be integrated into build pipelines by preparing known input tables and asserting on the output:

```deql
-- test_banking_decisions.deql

-- Setup: known test commands
CREATE TABLE test_deposits AS VALUES
    ('ACC-001', 500.00),
    ('ACC-002', 0.00),
    ('ACC-003', 100.00);

-- Run inspection
INSPECT DECISION DepositFunds
FROM test_deposits
INTO test_deposit_results;

-- Assert: check results
SELECT stream_id, event_type, data
FROM test_deposit_results;
```

## Projection Inspection

Decisions are only half the story. Projections transform events into read models, and those transformations need validation too. `INSPECT PROJECTION` feeds a set of events through a projection's logic and writes the resulting read model into an output table — without updating the real projection.

### Projection Inspection Syntax

```deql
INSPECT PROJECTION <ProjectionName>
FROM <event_source_table>
INTO <output_table>
[OFFSET <position>]
[WHERE <guard_condition>]
[LIMIT <max_events>];
```

The `FROM` clause provides the events to process — either the output of a prior `INSPECT DECISION` (for testing) or the real event store (for production replay). The `INTO` clause receives the projected read model rows.

Optional clauses:

| Clause | Purpose |
|---|---|
| `OFFSET` | Resume replay from a specific event sequence position |
| `WHERE` | Guard condition — filter which events are processed |
| `LIMIT` | Cap the number of events processed in a single pass |

### Example: Chaining Decision → Projection Inspection

Chain a decision inspection into a projection inspection to verify the full pipeline — command → events → read model:

```deql
-- Step 1: Simulate account opens to get events
CREATE TABLE test_opens AS VALUES
  ('ACC-100', 500.00),
  ('ACC-101', 0.00),
  ('ACC-102', 1500.00);

INSPECT DECISION Open
FROM test_opens
INTO simulated_open_events;

-- Step 2: Feed those events through the AccountBalance projection
INSPECT PROJECTION AccountBalance
FROM simulated_open_events
INTO simulated_balances;

-- Step 3: Verify the projected balances
SELECT * FROM simulated_balances;
```

The `simulated_balances` table contains the read model rows that `AccountBalance` would produce if those events were real — without touching the actual projection.

### Example: Verifying Employee Roster

```deql
-- Simulate hiring employees
CREATE TABLE test_hires AS VALUES
  ('EMP-100', 'Charlie', 'L3'),
  ('EMP-101', 'Diana', 'L5');

INSPECT DECISION Hire
FROM test_hires
INTO simulated_hire_events;

-- Verify the employee roster projection
INSPECT PROJECTION EmployeeRoster
FROM simulated_hire_events
INTO simulated_roster;

SELECT * FROM simulated_roster;
```

### Example: End-to-End Pipeline Test

Projection inspection shines in end-to-end tests where you validate the entire flow from command to read model:

```deql
-- test_full_pipeline.deql

-- 1. Simulate account opening
CREATE TABLE test_opens AS VALUES
  ('ACC-200', 500.00),
  ('ACC-201', 1000.00);

INSPECT DECISION Open
FROM test_opens
INTO opened_events;

SELECT stream_id, event_type, data
FROM opened_events;

-- 2. Project balances from simulated events
INSPECT PROJECTION AccountBalance
FROM opened_events
INTO projected_balances;

-- 3. Assert: balances should match initial_balance
SELECT * FROM projected_balances;
```

### Chaining Decisions and Projections

The `INTO` output of `INSPECT DECISION` is a table of simulated events. That table can be fed directly as the `FROM` input to `INSPECT PROJECTION`. This creates a clean, composable test pipeline:

```
INSPECT DECISION → simulated_events → INSPECT PROJECTION → simulated_read_model
```

No real events are written. No real projections are updated. The entire chain is side-effect-free.

### Why Inspect Projections?

| Scenario | What It Catches |
|---|---|
| Projection logic errors | Wrong aggregation, missing event types, bad filters |
| Schema mismatches | Projection expects fields the event doesn't carry |
| Regression testing | Projection output changes after event schema evolution |
| Read model design | Validate the shape before deploying to production |
| Full pipeline verification | Command → event → read model correctness in one test |

## Production Replay

`INSPECT PROJECTION` is not limited to testing. In production, it serves as the mechanism for rebuilding projections from the real event store — replaying all (or a subset of) events through the projection logic.

### Full Rebuild

Drop and rebuild a projection from the beginning of the event stream:

```deql
INSPECT PROJECTION AccountBalance
FROM DeReg."BankAccount$Events"
INTO DeReg."AccountBalance";
```

When `FROM` points at a real event stream (`DeReg."<Aggregate>$Events"`) and `INTO` targets the projection itself, this performs a full rebuild.

### Offset: Resume From a Position

Large event stores make full replays expensive. The `OFFSET` clause lets you resume from where a previous replay left off, using the event sequence number:

```deql
-- Resume from event sequence 500000
INSPECT PROJECTION AccountBalance
FROM DeReg."BankAccount$Events"
INTO DeReg."AccountBalance"
OFFSET 500000;
```

The projection processes only events with `sequence > 500000`. This is essential for:

- Incremental catch-up after downtime
- Resuming a failed rebuild without starting over
- Keeping a secondary projection in sync

### Guards: Filter What Gets Replayed

The `WHERE` clause acts as a guard — only events matching the condition are fed through the projection. This enables targeted replays:

```deql
-- Rebuild only for a specific account
INSPECT PROJECTION AccountBalance
FROM DeReg."BankAccount$Events"
INTO DeReg."AccountBalance"
WHERE stream_id = 'ACC-001';

-- Rebuild only from recent events
INSPECT PROJECTION AccountBalance
FROM DeReg."BankAccount$Events"
INTO DeReg."AccountBalance"
WHERE timestamp >= '2026-01-01';

-- Rebuild only for specific event types
INSPECT PROJECTION AccountBalance
FROM DeReg."BankAccount$Events"
INTO DeReg."AccountBalance"
WHERE event_type IN ('AccountOpened', 'Deposited');
```

### Limit: Controlled Batch Replay

The `LIMIT` clause caps the number of events processed in a single pass. Combined with `OFFSET`, this enables batched replay for large event stores:

```deql
-- Process 10,000 events at a time
INSPECT PROJECTION EmployeeRoster
FROM DeReg."Employee$Events"
INTO DeReg."EmployeeRoster"
OFFSET 0
LIMIT 10000;

-- Next batch
INSPECT PROJECTION EmployeeRoster
FROM DeReg."Employee$Events"
INTO DeReg."EmployeeRoster"
OFFSET 10000
LIMIT 10000;
```

### Combining Offset, Guards, and Limit

All clauses compose naturally:

```deql
-- Resume from sequence 250000, only for a specific stream, 5000 events at a time
INSPECT PROJECTION EmployeeRoster
FROM DeReg."Employee$Events"
INTO DeReg."EmployeeRoster"
OFFSET 250000
WHERE stream_id = 'EMP-001'
LIMIT 5000;
```

### Shadow Projection (Side-by-Side Rebuild)

Use `INTO` with a different target to build a new version of a projection alongside the existing one — zero downtime:

```deql
-- Build v2 of the projection without touching v1
INSPECT PROJECTION AccountBalanceV2
FROM DeReg."BankAccount$Events"
INTO AccountBalanceV2_staging
OFFSET 0;

-- Once validated, swap
-- DROP PROJECTION AccountBalance;
-- ALTER PROJECTION AccountBalanceV2_staging RENAME TO AccountBalance;
```

### Production Replay Patterns

| Pattern | Syntax | Use Case |
|---|---|---|
| Full rebuild | `FROM DeReg."<Aggregate>$Events" INTO DeReg."Projection"` | New projection, schema change |
| Incremental catch-up | `OFFSET <n>` | Resume after downtime |
| Scoped rebuild | `WHERE stream_id = ...` | Fix a single entity's projection |
| Time-bounded | `WHERE timestamp >= ...` | Rebuild recent data only |
| Batched replay | `OFFSET <n> LIMIT <m>` | Large stores, controlled throughput |
| Shadow build | `INTO staging_table` | Zero-downtime projection migration |

## Key Properties

| Property | Description |
|---|---|
| Same logic | Uses identical evaluation as production decisions and projections |
| No side effects | Nothing is written to the event store (projection target is explicit) |
| Table-driven | Input from any table, query, or live event stream |
| Composable | Decision output chains directly into projection input |
| Resumable | `OFFSET` enables incremental and batched replay |
| Guarded | `WHERE` filters events before they reach the projection |
| Bounded | `LIMIT` caps throughput per pass |
| Deterministic | Same inputs always produce the same inspection result |
| CI-friendly | Can be executed as automated tests in pipelines |
