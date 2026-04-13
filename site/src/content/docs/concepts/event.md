---
title: EVENT
description: Immutable facts, event metadata, and $Events queries in DeQL.
---

An Event in DeQL represents an immutable fact — something that has already happened.
Events are the fundamental unit of truth in a DeQL system.
They are immutable values.

## Purpose

Events serve as:

- The source of truth — all state is derived exclusively from events `(SELECT * from <<AggregateName>>$Events)`
- The output of decisions — decisions emit events as outcomes `(EMIT AS SELECT EVENT)`
- The input to aggregates — aggregate state is derived by replaying events `(<Aggregate>$Agg)`
- The input to projections — read models derive their views by querying events `(<Aggregate>$Events)`

## Syntax

```deql
CREATE EVENT <Name> (
    <field> <TYPE>,
    ...
);
```

Use `CREATE OR REPLACE` to overwrite an existing definition:

```deql
CREATE OR REPLACE EVENT <Name> (
    <field> <TYPE>,
    ...
);
```

## Example: Employee Events

```deql
CREATE EVENT EmployeeHired (name STRING, grade STRING);
CREATE EVENT EmployeePromoted (new_grade STRING);
```

## Example: Banking Events

```deql
CREATE EVENT AccountOpened (initial_balance DECIMAL(12,2));
CREATE EVENT Deposited (amount DECIMAL(12,2));
```

## Example: E-Commerce Events

```deql
CREATE EVENT ItemAdded (
    sku      STRING,
    quantity INT,
    price    DECIMAL(10,2)
);

CREATE EVENT CartCheckedOut (
    total_amount DECIMAL(12,2)
);

CREATE EVENT ItemRemoved (
    sku STRING
);
```

## How Events Are Emitted

Events are produced inside decisions using the `EMIT AS SELECT EVENT` clause. Field assignment uses the `:=` operator:

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

The `:amount` comes from the command, and `balance` comes from the `STATE AS` query.

## How Events Are Queried

Events are queried using the `$Events` suffix under the `DeReg` schema with quoted identifiers. The `stream_id` column identifies which aggregate instance the event belongs to:

```deql
-- Query raw events
SELECT stream_id, event_type, seq, data
FROM DeReg."BankAccount$Events"
ORDER BY stream_id, seq;

-- Use in projections (stream_id for grouping)
CREATE PROJECTION AccountBalance AS
SELECT
    stream_id AS aggregate_id,
    LAST(data.initial_balance) AS balance
FROM DeReg."BankAccount$Events"
GROUP BY stream_id;
```

The `data.` prefix accesses the event's payload fields.

## Event Metadata

Every event automatically carries metadata beyond its declared fields:

| Field | Description |
|---|---|
| `stream_id` | The aggregate instance this event belongs to |
| `event_type` | The name of the event (e.g., `'Deposited'`) |
| `data.*` | The declared payload fields |
| `seq` | Position in the aggregate's event stream |
| `timestamp` | When the event was recorded |

## Key Properties

| Property | Description |
|---|---|
| Immutable | Once emitted, an event never changes |
| Ordered | Events within a stream have a defined sequence |
| Self-describing | Each event carries its type and payload |
| Replayable | Any state can be rebuilt by replaying events |
| Queryable | Accessed via `DeReg."<Name>$Events"` in projections |
