---
title: AGGREGATE
description: Event-sourced identity boundaries in DeQL. Aggregates expose derived state via $Agg for deterministic decision evaluation.
---

In DeQL, an Aggregate defines an event‑sourced state boundary. 
It represents a logical boundary around a group of events and the state derived from them.

Aggregates are declared as named entities. Their current derived state is queried at decision time via the `$Agg` relation.

## Purpose

Aggregates serve as the state input to decisions. When a decision evaluates whether a command is valid, it derives the current aggregate state using a `STATE AS SELECT ... FROM DeReg."<Aggregate>$Agg"`.

Unlike traditional DDD aggregates that encapsulate both state and behavior, a DeQL aggregate is:

 - Derived — built entirely from events  
 - Deterministic — the same event stream always produces the same state  
 - Disposable — can be rebuilt from scratch at any time  
 - Passive — contains no business logic  

An aggregate defines an identity and consistency boundary, not a data structure.

:::note
DeREG – DeQL Registry

DeReg is the logical registry that holds all DeQL language definitions, including 
aggregates, decisions, events, projections, and templates.

It provides a clear segregation between DeQL language objects and other elements 
that may exist in the host system. DeReg is a semantic namespace, not a runtime 
component or storage mechanism.

When DeQL queries reference constructs such as <Aggregate>$Agg, name resolution 
occurs within DeReg to determine the corresponding derived state relation.
:::

## Syntax

```deql
CREATE AGGREGATE <Name>;
```

Use `CREATE OR REPLACE` to overwrite an existing definition:

```deql
CREATE OR REPLACE AGGREGATE <Name>;
```

The aggregate is a named container. Its state shape is implicitly defined by the events it receives and the projections/decisions that query it.

## Example: Core Aggregates

```deql
CREATE AGGREGATE Employee;
CREATE AGGREGATE BankAccount;
```

Additional examples:

```deql
CREATE AGGREGATE ShoppingCart;
CREATE AGGREGATE Inventory;
CREATE AGGREGATE Subscription;
```

## How State Is Accessed

Aggregate state is accessed inside decisions using the `$Agg` suffix with quoted identifiers and SQL-like SELECT:

```deql
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

The `DeReg."BankAccount$Agg"` reference gives you the current derived state of the aggregate, filtered by `aggregate_id`.

## How Events Build State

Events emitted against an aggregate automatically contribute to its derived state. The aggregate's `$Agg` view is the result of folding all events for a given `aggregate_id` in order.

```deql
-- These events shape BankAccount's state
CREATE EVENT AccountOpened (
    initial_balance DECIMAL(12,2)
);

CREATE EVENT Deposited (
    amount DECIMAL(12,2)
);

-- These events shape Employee's state
CREATE EVENT EmployeeHired (
    name  STRING,
    grade STRING
);

CREATE EVENT EmployeePromoted (
    new_grade STRING
);
```

When a decision queries `DeReg."BankAccount$Agg"`, it sees the latest state derived from all `AccountOpened` and `Deposited` events for that aggregate instance.

## Querying Aggregate State

You can query aggregate state directly:

```deql
-- All BankAccount aggregate state
SELECT * FROM DeReg."BankAccount$Agg";

-- Filter by aggregate_id
SELECT * FROM DeReg."BankAccount$Agg" WHERE aggregate_id = 'ACC-001';

-- Select specific columns
SELECT aggregate_id, initial_balance FROM DeReg."BankAccount$Agg";

-- All Employee aggregate state
SELECT * FROM DeReg."Employee$Agg";
```

## Querying Event History

You can also query the raw event stream using the `$Events` suffix:

```deql
-- Query the event stream directly
SELECT stream_id, event_type, seq, data
FROM DeReg."BankAccount$Events"
ORDER BY stream_id, seq;

-- Build a projection from the event stream
CREATE PROJECTION AccountBalance AS
SELECT
    stream_id AS aggregate_id,
    LAST(data.initial_balance) AS balance
FROM DeReg."BankAccount$Events"
GROUP BY stream_id;
```

## Key Suffixes

| Suffix | Purpose | Example |
|---|---|---|
| `$Agg` | Current derived state of the aggregate | `DeReg."BankAccount$Agg"` |
| `$Events` | Raw event stream for the aggregate | `DeReg."BankAccount$Events"` |

## Aggregates vs Projections

Both are derived from events, but they serve different roles:

| Aspect | Aggregate | Projection |
|---|---|---|
| Purpose | Decision input (write side) | Query output (read side) |
| Scope | Single entity by `aggregate_id` | Cross-entity, denormalized |
| Access | `$Agg` in STATE AS clause | Standalone query |
| Lifecycle | Rebuilt per decision evaluation | Maintained continuously |
| Disposability | Rebuilt on every decision | Rebuilt on demand |

## Cross-Aggregate Decisions

Aggregates are independent state boundaries, but decisions are not limited to a single aggregate. A decision's `STATE AS` clause can join multiple `$Agg` providers to read state from several aggregates in one query:

```deql
STATE AS
    SELECT
        c.applied_coupon,
        q.quantity AS coupon_quantity
    FROM DeReg."ShoppingCart$Agg" c
    JOIN DeReg."Coupon$Agg" q ON q.aggregate_id = :coupon_id
    WHERE c.aggregate_id = :user_id
```

This avoids the need for sagas or process managers when a business rule spans multiple aggregates. See the [Decision docs](/concepts/decision/#multi-state-queries-across-aggregates) for full examples.
