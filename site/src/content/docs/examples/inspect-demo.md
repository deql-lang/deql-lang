---
title: "Inspect Demo"
description: "INSPECT DECISION in action — simulate decisions, verify guards, and validate behavior without writing real events."
---

Demonstrates `INSPECT DECISION` to simulate and verify decision behavior without persisting any events. Test your business logic before it touches a stream.

## Domain

A simple banking system with account opening, deposits, and guarded withdrawals.

## Define the System

```deql
CREATE AGGREGATE BankAccount;

CREATE COMMAND OpenAccount (
  account_id      STRING,
  owner           STRING,
  initial_balance DECIMAL
);

CREATE COMMAND DepositFunds (
  account_id STRING,
  amount     DECIMAL
);

CREATE COMMAND WithdrawFunds (
  account_id STRING,
  amount     DECIMAL
);

CREATE EVENT AccountOpened (
  owner           STRING,
  initial_balance DECIMAL
);

CREATE EVENT FundsDeposited (
  amount DECIMAL
);

CREATE EVENT FundsWithdrawn (
  amount DECIMAL
);

CREATE DECISION OpenAccount
FOR BankAccount
ON COMMAND OpenAccount
EMIT AS
  SELECT EVENT AccountOpened (
    owner           := :owner,
    initial_balance := :initial_balance
  );

CREATE DECISION DepositFunds
FOR BankAccount
ON COMMAND DepositFunds
EMIT AS
  SELECT EVENT FundsDeposited (
    amount := :amount
  );

CREATE DECISION WithdrawFunds
FOR BankAccount
ON COMMAND WithdrawFunds
STATE AS
  SELECT
    COALESCE(SUM(
      CASE
        WHEN event_type = 'AccountOpened'  THEN data.initial_balance
        WHEN event_type = 'FundsDeposited' THEN data.amount
        WHEN event_type = 'FundsWithdrawn' THEN -data.amount
        ELSE 0
      END
    ), 0) AS balance
  FROM DeReg."BankAccount$Events"
  WHERE stream_id = :account_id
EMIT AS
  SELECT EVENT FundsWithdrawn (
    amount := :amount
  )
  WHERE balance >= :amount;
```

## INSPECT DECISION — Simulate Account Opens

Prepare test commands as a table, then simulate the decision. No events are persisted:

```deql
CREATE TABLE test_opens AS VALUES
  ('ACC-001', 'Alice', 500.00),
  ('ACC-002', 'Bob',   200.00),
  ('ACC-003', 'Carol', 1000.00);

INSPECT DECISION OpenAccount
FROM test_opens
INTO simulated_open_events;

  INSPECT DECISION → 3 event(s) emitted, 0 rejected → simulated_open_events
```

Review what would have happened:

```deql
SELECT stream_id, event_type, data FROM simulated_open_events;

+-----------+---------------+----------------------------------------------------------+
| stream_id | event_type    | data                                                     |
+-----------+---------------+----------------------------------------------------------+
| ACC-001   | AccountOpened | {initial_balance: 500.000000000000000000, owner: Alice}  |
| ACC-002   | AccountOpened | {initial_balance: 200.000000000000000000, owner: Bob}    |
| ACC-003   | AccountOpened | {initial_balance: 1000.000000000000000000, owner: Carol} |
+-----------+---------------+----------------------------------------------------------+
```

Three accounts would be opened — but nothing was written to the event store.

## INSPECT DECISION — Simulate Deposits

```deql
CREATE TABLE test_deposits AS VALUES
  ('ACC-001', 150.00),
  ('ACC-002', 50.00);

INSPECT DECISION DepositFunds
FROM test_deposits
INTO simulated_deposit_events;

  INSPECT DECISION → 2 event(s) emitted, 0 rejected → simulated_deposit_events

SELECT stream_id, event_type, data FROM simulated_deposit_events;

+-----------+----------------+----------------------------------+
| stream_id | event_type     | data                             |
+-----------+----------------+----------------------------------+
| ACC-001   | FundsDeposited | {amount: 150.000000000000000000} |
| ACC-002   | FundsDeposited | {amount: 50.000000000000000000}  |
+-----------+----------------+----------------------------------+
```

## INSPECT DECISION — Simulate Guarded Withdrawals

INSPECT runs against the real event store for STATE AS queries. First, create a real account with a known balance:

```deql
EXECUTE OpenAccount(account_id := 'ACC-100', owner := 'Dave', initial_balance := 300.00);

  ✓ AccountOpened
    stream_id:     ACC-100
    seq:           1
    owner:  Dave
    initial_balance:  300

EXECUTE DepositFunds(account_id := 'ACC-100', amount := 200.00);

  ✓ FundsDeposited
    stream_id:     ACC-100
    seq:           2
    amount:  200
```

Now simulate two withdrawals — one within balance, one exceeding it:

```deql
CREATE TABLE test_withdrawals AS VALUES
  ('ACC-100', 100.00),
  ('ACC-100', 600.00);

INSPECT DECISION WithdrawFunds
FROM test_withdrawals
INTO simulated_withdrawals;

  INSPECT DECISION → 1 event(s) emitted, 1 rejected → simulated_withdrawals
```

The summary line tells you immediately: 1 accepted, 1 rejected. Query the details:

```deql
SELECT stream_id, event_type, data FROM simulated_withdrawals;

+-----------+----------------+----------------------------------+
| stream_id | event_type     | data                             |
+-----------+----------------+----------------------------------+
| ACC-100   | FundsWithdrawn | {amount: 100.000000000000000000} |
| ACC-100   | __REJECTED__   | {amount: 600.000000000000000000} |
+-----------+----------------+----------------------------------+
```

- Row 1: `FundsWithdrawn` — balance (500) >= amount (100) ✓
- Row 2: `__REJECTED__` — balance (500) < amount (600) ✗

The real balance is unchanged — INSPECT didn't write anything:

```deql
SELECT * FROM DeReg."AccountBalances";

+------------+-------+
| account_id | owner |
+------------+-------+
| ACC-100    | Dave  |
+------------+-------+
```

## What This Demonstrates

- **INSPECT DECISION** simulates decisions without side effects
- **Table-driven testing** — prepare inputs as tables, inspect outputs
- **Rejection tracking** — `__REJECTED__` rows show which commands would fail and why
- **Summary output** — `N event(s) emitted, M rejected` gives instant feedback
- **Real state, simulated commands** — STATE AS queries run against the real event store, but no new events are written
- **CI-friendly** — these scripts can run in pipelines to validate decision logic before deployment
