---
title: DESCRIBE
description: Inspect any concept's definition and metadata in the DeQL Decision Registry.
---

DESCRIBE lists any concept registered in the DeReg and returns its definition —
including DDL, field types, relationships, and metadata.

DeReg stands for **Decision Registry**. It is the registry that holds the compiled DeQL definitions for a system, making the complete model inspectable, exportable, and portable across environments.

DESCRIBE is a structural introspection command: it shows how a concept is
defined, not how it behaves at runtime.

## Purpose

In an interactive DeQL session, you often need quick answers to questions like:

- What fields does this command expect?
- What aggregate does this decision target?
- What is the `STATE AS` query inside a decision?
- What events does this projection consume?

DESCRIBE provides these answers directly in the SQL console, without evaluating
decisions, replaying events, or executing projections.


## Syntax

```deql
DESCRIBE <ConceptType> <Name>;
```

Where `<ConceptType>` is one of: `AGGREGATE`, `COMMAND`, `EVENT`, `DECISION`, `PROJECTION`, `EVENTSTORE`, `TEMPLATE`.

## Examples

### Describe an Aggregate

```
deql> DESCRIBE AGGREGATE BankAccount;

  Aggregate:  BankAccount
  Events:     AccountOpened, Deposited
  Decisions:  Open, DepositFunds
  Projection: AccountBalance
```

### Describe a Command

```
deql> DESCRIBE COMMAND OpenAccount;

  Command:   OpenAccount
  Fields:
    account_id       UUID
    initial_balance  DECIMAL(12,2)
  Decision:  Open
  Aggregate: BankAccount
```

### Describe an Event

```
deql> DESCRIBE EVENT AccountOpened;

  Event:      AccountOpened
  Fields:
    initial_balance  DECIMAL(12,2)
  Emitted by: Open (decision)
  Aggregate:  BankAccount
```

### Describe a Decision

```
deql> DESCRIBE DECISION DepositFunds;

  Decision:   DepositFunds
  Aggregate:  BankAccount
  Command:    Deposit
  State:
    SELECT initial_balance AS balance
    FROM DeReg."BankAccount$Agg"
    WHERE aggregate_id = :account_id
  Emit:
    SELECT EVENT Deposited (
        amount := :amount
    )
    WHERE balance >= :amount
  Guard:      balance >= :amount
```

### Describe a Projection

```
deql> DESCRIBE PROJECTION AccountBalance;

  Projection:  AccountBalance
  Source:      DeReg."BankAccount$Events"
  Fields:
    aggregate_id  UUID
    balance       DECIMAL(12,2)
  Query:
    SELECT
        stream_id AS aggregate_id,
        LAST(data.initial_balance) AS balance
    FROM DeReg."BankAccount$Events"
    GROUP BY stream_id
```

### Describe an EventStore

```
deql> DESCRIBE EVENTSTORE local_dev;

  EventStore:    local_dev
  Durable:       parquet (/tmp/deql/)
  Immutable:     true
```

### Describe a Template

```
deql> DESCRIBE TEMPLATE wallet_aggregate;

  Template:    wallet_aggregate
  Parameters:
    wallet_name  STRING
    currency     STRING
  Produces:
    AGGREGATE    {{wallet_name}}Wallet
    COMMANDS     TopUp{{wallet_name}}, Debit{{wallet_name}}
    EVENTS       {{wallet_name}}WalletToppedUp, {{wallet_name}}WalletDebited
    DECISIONS    TopUp{{wallet_name}}, Debit{{wallet_name}}
    PROJECTION   {{wallet_name}}WalletBalance
  Instances:
    Main          (wallet_name = 'Main', currency = 'USD')
    Promo         (wallet_name = 'Promo', currency = 'USD')
```

## List All Concepts

Use `DESCRIBE` without a name to list all registered concepts of a type:

```
deql> DESCRIBE AGGREGATES;

  Aggregate       | Decisions | Events | Projection
  ----------------|-----------|--------|-------------------
  Employee        | 2         | 2      | EmployeeRoster
  BankAccount     | 2         | 2      | AccountBalance

deql> DESCRIBE COMMANDS;

  Command              | Aggregate       | Decision
  ---------------------|-----------------|------------------
  HireEmployee         | Employee        | Hire
  PromoteEmployee      | Employee        | Promote
  OpenAccount          | BankAccount     | Open
  Deposit              | BankAccount     | DepositFunds

deql> DESCRIBE DECISIONS;

  Decision             | Aggregate       | Command          | Guard
  ---------------------|-----------------|------------------|------------------
  Hire                 | Employee        | HireEmployee     | (none)
  Promote              | Employee        | PromoteEmployee  | (none)
  Open                 | BankAccount     | OpenAccount      | (none)
  DepositFunds         | BankAccount     | Deposit          | balance >= :amount
```

## VALIDATE DEREG

Cross-reference all registered concepts for consistency. This checks that every command has a matching decision, every event is emitted by at least one decision, and all aggregate references resolve:

```deql
VALIDATE DEREG;
```

## EXPORT DEREG

Dump the entire Decision Registry as reproducible DeQL statements. This exported DeQL can then be loaded into another environment, making DeReg the mechanism for moving a full system definition across development, test, staging, and production.

```deql
EXPORT DEREG;
```

## Meta Tables (Optional)

For programmatic access, the DeReg metadata can optionally be exposed as queryable tables:

```deql
SELECT * FROM DeReg.meta_aggregates;
SELECT * FROM DeReg.meta_commands;
SELECT * FROM DeReg.meta_events;
SELECT * FROM DeReg.meta_decisions;
SELECT * FROM DeReg.meta_projections;
SELECT * FROM DeReg.meta_eventstores;
SELECT * FROM DeReg.meta_templates;
```

These are read-only tables populated from the DeReg on startup. They support standard SQL — filtering, joining, exporting:

```deql
-- Find all decisions that read from more than one aggregate
SELECT name, aggregate, state_query
FROM DeReg.meta_decisions
WHERE state_query LIKE '%JOIN%';

-- Find all events not consumed by any projection
SELECT e.name
FROM DeReg.meta_events e
LEFT JOIN DeReg.meta_projections p ON p.event_types LIKE '%' || e.name || '%'
WHERE p.name IS NULL;
```

## DeQL Keyword Summary

With `DESCRIBE`, `VALIDATE DEREG`, and `EXPORT DEREG`, the complete set of DeQL keywords is:

| Keyword | Purpose |
|---|---|
| `CREATE` | Define aggregates, commands, events, decisions, projections, eventstores, templates |
| `CREATE OR REPLACE` | Overwrite existing definitions for aggregates, commands, events |
| `APPLY` / `USE` | Instantiate a template |
| `EXECUTE` | Send a command, trigger a decision, get events back |
| `INSPECT` | Simulate decisions or projections side-effect-free |
| `DESCRIBE` | Inspect any concept's definition and metadata |
| `VALIDATE DEREG` | Cross-reference consistency check across all registered concepts |
| `EXPORT DEREG` | Dump the Decision Registry as reproducible DeQL |
| `SELECT` | Query projections, event streams, aggregate state, meta tables |
