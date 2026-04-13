---
title: Progressive System Design
description: Start small, grow safely — incremental aggregate refinement and safe event evolution in DeQL.
---

DeQL is designed for systems that grow and change. You don't need to get everything right upfront. Start with the simplest possible model, validate it through inspection, and refine incrementally as understanding improves. The DeReg (Decision Registry) accepts new definitions dynamically, without requiring full system rebuilds or coordinated restarts.

## The Problem with Big-Bang Design

Traditional event-sourced systems often require:

1. Define all aggregates and their invariants perfectly
2. Design the complete event schema
3. Wire up all command handlers
4. Build projections for every read model
5. Deploy the whole thing at once

This creates a high barrier to entry and makes iteration expensive.

## DeQL's Approach: Start Small, Grow Safely

### Stage 1 — Minimal Viable Decision

Start with a single aggregate, command, event, and decision:

```deql
CREATE AGGREGATE Employee;

CREATE COMMAND HireEmployee (employee_id UUID, name STRING, grade STRING);

CREATE EVENT EmployeeHired (name STRING, grade STRING);

CREATE DECISION Hire
FOR Employee
ON COMMAND HireEmployee
EMIT AS
    SELECT EVENT EmployeeHired (
        name  := :name,
        grade := :grade
    );
```

Inspect it immediately:

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

Or execute it live:

```deql
EXECUTE HireEmployee(employee_id := 'EMP-001', name := 'Alice', grade := 'L5');
```

### Stage 2 — Add More Behavior

As requirements become clearer, add new commands, events, and decisions:

```deql
CREATE COMMAND PromoteEmployee (employee_id UUID, new_grade STRING);

CREATE EVENT EmployeePromoted (new_grade STRING);

CREATE DECISION Promote
FOR Employee
ON COMMAND PromoteEmployee
EMIT AS
    SELECT EVENT EmployeePromoted (
        new_grade := :new_grade
    );
```

Add a second domain with state-dependent logic:

```deql
CREATE AGGREGATE BankAccount;

CREATE COMMAND OpenAccount (account_id UUID, initial_balance DECIMAL(12,2));
CREATE COMMAND Deposit (account_id UUID, amount DECIMAL(12,2));

CREATE EVENT AccountOpened (initial_balance DECIMAL(12,2));
CREATE EVENT Deposited (amount DECIMAL(12,2));

CREATE DECISION Open
FOR BankAccount
ON COMMAND OpenAccount
EMIT AS
    SELECT EVENT AccountOpened (
        initial_balance := :initial_balance
    );

CREATE DECISION DepositFunds
FOR BankAccount
ON COMMAND Deposit
STATE AS
    SELECT initial_balance AS balance
    FROM DeReg."BankAccount$Agg"
    WHERE aggregate_id = :account_id
EMIT AS
    SELECT EVENT Deposited (
        amount := :amount
    )
    WHERE balance >= :amount;
```

### Stage 3 — Add Read Models

Once the write side is stable, add projections for queries:

```deql
CREATE PROJECTION EmployeeRoster AS
SELECT
    stream_id AS employee_id,
    LAST(data.name) AS name,
    LAST(data.grade) AS current_grade,
    LAST(data.new_grade) AS promoted_grade
FROM DeReg."Employee$Events"
GROUP BY stream_id;

CREATE PROJECTION AccountBalance AS
SELECT
    stream_id AS aggregate_id,
    SUM(
        CASE
            WHEN event_type = 'AccountOpened' THEN data.initial_balance
            WHEN event_type = 'Deposited'     THEN data.amount
            ELSE 0
        END
    ) AS balance
FROM DeReg."BankAccount$Events"
GROUP BY stream_id;
```

### Stage 4 — Evolve Definitions Safely

Use `CREATE OR REPLACE` to overwrite existing definitions when schemas evolve:

```deql
CREATE OR REPLACE AGGREGATE BankAccount;
CREATE OR REPLACE COMMAND OpenAccount (account_id UUID, initial_balance DECIMAL(12,2));
CREATE OR REPLACE EVENT AccountOpened (initial_balance DECIMAL(12,2));
```

Old events remain valid. Projections can handle both old and new event versions by filtering on `event_type`.

## Evolution Patterns

### Adding a New Guard

```deql
-- Before: any deposit accepted
CREATE DECISION DepositFunds
FOR BankAccount
ON COMMAND Deposit
STATE AS
    SELECT initial_balance AS balance
    FROM DeReg."BankAccount$Agg"
    WHERE aggregate_id = :account_id
EMIT AS
    SELECT EVENT Deposited (
        amount := :amount
    );

-- After: reject when balance is insufficient
CREATE DECISION DepositFunds
FOR BankAccount
ON COMMAND Deposit
STATE AS
    SELECT initial_balance AS balance
    FROM DeReg."BankAccount$Agg"
    WHERE aggregate_id = :account_id
EMIT AS
    SELECT EVENT Deposited (
        amount := :amount
    )
    WHERE balance >= :amount;
```

Existing events are unaffected. The new guard only applies to future commands.

### Adding Cross-Cutting Projections

```deql
-- Add audit trail without changing existing decisions
CREATE PROJECTION AuditLog AS
SELECT
    stream_id,
    event_type,
    data,
    seq
FROM DeReg."BankAccount$Events"
ORDER BY seq DESC;
```

### Validating the Registry

After making changes, validate the entire registry for consistency:

```deql
VALIDATE DEREG;
```

And export the full system definition:

```deql
EXPORT DEREG;
```

## Key Principle

> Start with the simplest model that captures your core behavior. Inspect it. Ship it. Then evolve.

Every stage is a valid, working system. There is no "incomplete" intermediate state.
