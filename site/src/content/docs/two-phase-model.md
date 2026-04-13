---
title: Two-Phase Model
description: "Definitions → Decision Assembly → EXECUTE: how DeQL separates domain vocabulary from executable behavior."
---

DeQL operates in two distinct but connected phases. This separation ensures that the DeReg (Decision Registry) — the complete execution topology — is fully known before any command is processed.

## Phase 1 — Definitions

In the first phase, you declare the domain vocabulary. These declarations are:

- Order-independent — declarations can appear in any sequence
- Non-executable — they describe structure, not behavior
- Composable — they reference each other by name

### What Gets Defined

```deql
-- 1. Aggregates: named state boundaries
CREATE AGGREGATE Employee;
CREATE AGGREGATE BankAccount;

-- 2. Commands: the intents your system accepts
CREATE COMMAND HireEmployee (employee_id UUID, name STRING, grade STRING);
CREATE COMMAND PromoteEmployee (employee_id UUID, new_grade STRING);
CREATE COMMAND OpenAccount (account_id UUID, initial_balance DECIMAL(12,2));
CREATE COMMAND Deposit (account_id UUID, amount DECIMAL(12,2));

-- 3. Events: the facts your system records
CREATE EVENT EmployeeHired (name STRING, grade STRING);
CREATE EVENT EmployeePromoted (new_grade STRING);
CREATE EVENT AccountOpened (initial_balance DECIMAL(12,2));
CREATE EVENT Deposited (amount DECIMAL(12,2));

-- 4. EventStore: where events are persisted
CREATE EVENTSTORE local_dev WITH (
    envelope.event_id_key = 'event_id',
    durable.type = 'parquet',
    durable.path = '/tmp/deql/',
    strict.immutable_events = true
);
```

At this point, nothing executes. The system has a vocabulary but no behavior.

## Phase 2 — Decision Assembly

In the second phase, decisions bind the declared vocabulary into executable units:

```deql
-- Simple decisions (no state needed)
CREATE DECISION Hire
FOR Employee
ON COMMAND HireEmployee
EMIT AS
    SELECT EVENT EmployeeHired (
        name  := :name,
        grade := :grade
    );

CREATE DECISION Promote
FOR Employee
ON COMMAND PromoteEmployee
EMIT AS
    SELECT EVENT EmployeePromoted (
        new_grade := :new_grade
    );

CREATE DECISION Open
FOR BankAccount
ON COMMAND OpenAccount
EMIT AS
    SELECT EVENT AccountOpened (
        initial_balance := :initial_balance
    );

-- Decision with STATE AS + WHERE guard
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

And projections provide the read side:

```deql
CREATE PROJECTION AccountBalance AS
SELECT
    stream_id AS aggregate_id,
    LAST(data.initial_balance) AS balance
FROM DeReg."BankAccount$Events"
GROUP BY stream_id;

CREATE PROJECTION EmployeeRoster AS
SELECT
    stream_id AS employee_id,
    LAST(data.name) AS name,
    LAST(data.grade) AS current_grade,
    LAST(data.new_grade) AS promoted_grade
FROM DeReg."Employee$Events"
GROUP BY stream_id;
```

## After Compilation

Once both phases complete, the DeReg holds:

- A complete, immutable execution topology
- Every command mapped to exactly one decision
- Every decision's dependencies (aggregates, events) fully resolved
- No runtime wiring, no dynamic dispatch, no hidden paths

The system is ready to receive commands via `EXECUTE`:

```deql
-- Hire employees
EXECUTE HireEmployee(employee_id := 'EMP-001', name := 'Alice', grade := 'L5');
EXECUTE HireEmployee(employee_id := 'EMP-002', name := 'Bob', grade := 'L4');

-- Promote an employee
EXECUTE PromoteEmployee(employee_id := 'EMP-001', new_grade := 'L6');

-- Open bank accounts
EXECUTE OpenAccount(account_id := 'ACC-001', initial_balance := 1000.00);
EXECUTE OpenAccount(account_id := 'ACC-002', initial_balance := 250.00);

-- Deposit into accounts (uses STATE AS + WHERE guard)
EXECUTE Deposit(account_id := 'ACC-001', amount := 500.00);
EXECUTE Deposit(account_id := 'ACC-002', amount := 100.00);

-- Query event streams
SELECT stream_id, event_type, seq, data
FROM DeReg."BankAccount$Events"
ORDER BY stream_id, seq;

-- Query aggregate state
SELECT * FROM DeReg."BankAccount$Agg";
SELECT * FROM DeReg."BankAccount$Agg" WHERE aggregate_id = 'ACC-001';

-- Query projections
SELECT * FROM DeReg."AccountBalance";
SELECT * FROM DeReg."EmployeeRoster";
```

```
┌──────────────┐     ┌──────────────────┐     ┌──────────────┐
│  EXECUTE     │────▶│    Decisions     │────▶│   Events     │
│              │     │                  │     │              │
│ HireEmployee │     │ Hire             │     │ EmployeeHired│
│ OpenAccount  │     │ Open             │     │ AccountOpened│
│ Deposit      │     │ DepositFunds     │     │ Deposited    │
└──────────────┘     └──────────────────┘     └──────────────┘
                            │                        │
                     reads  │                builds  │
                            ▼                        ▼
                     ┌──────────────┐        ┌───────────────┐
                     │ BankAccount  │        │AccountBalance │
                     │ Employee     │        │EmployeeRoster │
                     │              │        | (projections) │
                     └──────────────┘        └───────────────┘
```

## Why Two Phases?

| Benefit | Explanation |
|---|---|
| Static analysis | All dependencies are known before execution |
| No circular references | Decisions reference declarations, not other decisions |
| Safe refactoring | Rename an event and the compiler finds all usages |
| Clear boundaries | Definitions are reusable; decisions are specific |
| Parallel compilation | Declarations can be parsed independently |
