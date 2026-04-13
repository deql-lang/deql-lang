---
title: DECISION
description: "STATE AS, EMIT AS, guards, and multi-state queries across aggregates in DeQL."
---

A Decision is the central executable unit in DeQL. It is the only concept that runs at runtime. A decision binds a command, aggregate state, and business rules into a deterministic outcome — producing events or rejecting the command.

## Purpose

Decisions are where business logic lives. They answer the question: "Given the current state of the world and this intent, what facts should be recorded?"


A decision:

- Receives a command representing external intent (`ON COMMAND`)
- Targets an aggregate as its consistency boundary (`FOR`)
- Reads current derived state (`STATE AS SELECT`)
- Produces events as new facts (`EMIT AS SELECT EVENT`)


## Syntax

```deql
CREATE DECISION <Name>
FOR <Aggregate>
ON COMMAND <CommandType>
[STATE AS
    SELECT <fields>
    FROM DeReg."<Aggregate>$Agg"
    [JOIN DeReg."<OtherAggregate>$Agg" ON ...]
    WHERE aggregate_id = :<id_field>]
EMIT AS
    SELECT EVENT <EventType> (
        <field> := <expression>,
        ...
    );
```

The `STATE AS` clause is standard SQL. It can query a single aggregate, join multiple aggregates, use subqueries against `$Events` streams, or any combination — there are no restrictions on how many aggregates a decision can read.

## Example: Simple Decision (No Guard)

When a decision doesn't need to check existing state, the `STATE AS` clause is omitted:

```deql
CREATE DECISION Hire
FOR Employee
ON COMMAND HireEmployee
EMIT AS
    SELECT EVENT EmployeeHired (
        name  := :name,
        grade := :grade
    );
```

This decision simply transforms the `HireEmployee` command into an `EmployeeHired` event.

Another simple decision without state:

```deql
CREATE DECISION Open
FOR BankAccount
ON COMMAND OpenAccount
EMIT AS
    SELECT EVENT AccountOpened (
        initial_balance := :initial_balance
    );
```

## Example: Decision With STATE AS + WHERE Guard

When business logic depends on current state, use `STATE AS` to query the aggregate. The `WHERE` clause in `EMIT AS` acts as a guard — the event is only emitted if the condition holds:

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

Here `balance` is fetched from the aggregate's current state via `DeReg."BankAccount$Agg"`, and the guard ensures the deposit is only accepted when the balance is sufficient.

## Example: Promotion Decision

```deql
CREATE DECISION Promote
FOR Employee
ON COMMAND PromoteEmployee
EMIT AS
    SELECT EVENT EmployeePromoted (
        new_grade := :new_grade
    );
```

## Example: E-Commerce Decision

```deql
CREATE DECISION AddItemToCart
FOR ShoppingCart
ON COMMAND AddItem
EMIT AS
    SELECT EVENT ItemAdded (
        sku      := :sku,
        quantity := :quantity,
        price    := :price
    );

CREATE DECISION CheckoutCart
FOR ShoppingCart
ON COMMAND Checkout
STATE AS
    SELECT SUM(data.price * data.quantity) AS total
    FROM DeReg."ShoppingCart$Events"
    WHERE stream_id = :cart_id
      AND event_type = 'ItemAdded'
EMIT AS
    SELECT EVENT CartCheckedOut (
        total_amount := total
    )
    WHERE total > 0;
```

## Multi-State Queries Across Aggregates

A decision's `STATE AS` clause is standard SQL. It can query multiple aggregates in a single statement — joining, unioning, or subquerying across independent event streams. This is how DeQL avoids fixed aggregate boundaries: decisions read whatever state they need, from however many aggregates, without being locked to a single stream.

### Example: Apply Coupon (Cart + Coupon)

A checkout decision needs to verify both the cart contents and coupon availability — two independent aggregates:

```deql
CREATE AGGREGATE ShoppingCart;
CREATE AGGREGATE Coupon;

CREATE COMMAND ApplyCoupon (
    user_id   UUID,
    coupon_id UUID
);

CREATE EVENT CouponApplied (
    coupon_id UUID,
    user_id   UUID
);

CREATE DECISION ApplyCouponToCart
FOR ShoppingCart
ON COMMAND ApplyCoupon
STATE AS
    SELECT
        c.applied_coupon,
        q.quantity AS coupon_quantity
    FROM DeReg."ShoppingCart$Agg" c
    JOIN DeReg."Coupon$Agg" q ON q.aggregate_id = :coupon_id
    WHERE c.aggregate_id = :user_id
EMIT AS
    SELECT EVENT CouponApplied (
        coupon_id := :coupon_id,
        user_id   := :user_id
    )
    WHERE applied_coupon IS NULL
      AND coupon_quantity > 0;
```

The `STATE AS` joins two `$Agg` providers in one query. The guard checks both conditions: no coupon already applied (cart state) and coupon still available (coupon state). One decision, two aggregates, no saga.

### Example: Transfer Between Wallets

A transfer debits one wallet and credits another — the decision needs both balances:

```deql
CREATE COMMAND TransferBetweenWallets (
    from_wallet UUID,
    to_wallet   UUID,
    amount      DECIMAL(12,2)
);

CREATE EVENT WalletTransferDebited (
    amount        DECIMAL(12,2),
    balance_after DECIMAL(12,2),
    to_wallet     UUID
);

CREATE EVENT WalletTransferCredited (
    amount        DECIMAL(12,2),
    balance_after DECIMAL(12,2),
    from_wallet   UUID
);

CREATE DECISION TransferFunds
FOR MainWallet
ON COMMAND TransferBetweenWallets
STATE AS
    SELECT
        src.balance AS source_balance,
        dst.balance AS dest_balance
    FROM DeReg."MainWallet$Agg" src
    JOIN DeReg."MainWallet$Agg" dst ON dst.aggregate_id = :to_wallet
    WHERE src.aggregate_id = :from_wallet
EMIT AS
    SELECT EVENT WalletTransferDebited (
        amount        := :amount,
        balance_after := source_balance - :amount,
        to_wallet     := :to_wallet
    ),
    SELECT EVENT WalletTransferCredited (
        amount        := :amount,
        balance_after := dest_balance + :amount,
        from_wallet   := :from_wallet
    )
    WHERE source_balance >= :amount;
```

Both events are emitted atomically from a single decision. No two-phase commit, no saga, no eventual consistency between the debit and credit.

### Example: Cross-Aggregate Validation With Subquery

You can also use subqueries instead of joins:

```deql
CREATE DECISION EnrollStudent
FOR Course
ON COMMAND EnrollStudentInCourse
STATE AS
    SELECT
        available_seats,
        (SELECT COUNT(*) FROM DeReg."Student$Events"
         WHERE stream_id = :student_id
           AND event_type = 'StudentEnrolled') AS current_enrollments
    FROM DeReg."Course$Agg"
    WHERE aggregate_id = :course_id
EMIT AS
    SELECT EVENT StudentEnrolled (
        student_id := :student_id,
        course_id  := :course_id
    )
    WHERE available_seats > 0
      AND current_enrollments < 5;
```

The decision reads course state from one aggregate and counts the student's enrollments from another event stream, all in one `STATE AS` query.

### Why This Matters

Traditional CQRS/ES systems force you to pick aggregate boundaries upfront. When a new feature needs data from two aggregates, you're stuck with sagas, process managers, or eventual consistency hacks.

DeQL's `STATE AS` is just SQL. If you need data from two aggregates, join them. If you need data from three, join three. The decision reads whatever state it needs, the guard validates across all of it, and the events are emitted atomically. No fixed boundaries, no coordination protocols.

| Pattern | STATE AS Approach |
|---|---|
| Single aggregate | `SELECT ... FROM DeReg."X$Agg" WHERE aggregate_id = :id` |
| Two aggregates (join) | `SELECT ... FROM DeReg."X$Agg" JOIN DeReg."Y$Agg" ON ...` |
| Same aggregate, two instances | `SELECT ... FROM DeReg."X$Agg" a JOIN DeReg."X$Agg" b ON ...` |
| Aggregate + event stream | `SELECT ... FROM DeReg."X$Agg", (SELECT ... FROM DeReg."Y$Events")` |

## Anatomy of a Decision

```
CREATE DECISION DepositFunds              -- Name
FOR BankAccount                           -- Target aggregate
ON COMMAND Deposit                        -- Triggering command
STATE AS                                  -- State query (optional)
    SELECT initial_balance AS balance     --   Fields to read
    FROM DeReg."BankAccount$Agg"          --   From aggregate state
    WHERE aggregate_id = :account_id      --   Scoped to instance
EMIT AS                                   -- Event production
    SELECT EVENT Deposited (              --   Event type
        amount := :amount                 --   From command (:param)
    )
    WHERE balance >= :amount;             -- Guard condition
```

## Key Clauses

| Clause | Required | Purpose |
|---|---|---|
| `FOR` | Yes | Binds the decision to an aggregate |
| `ON COMMAND` | Yes | Specifies which command triggers this decision |
| `STATE AS` | No | Queries current aggregate state for use in EMIT |
| `EMIT AS` | Yes | Defines which event(s) to produce |
| `WHERE` (in EMIT) | No | Guard condition — event only emits if true |

## Determinism

Decisions are strictly deterministic:

- Same command + same event history = same outcome, always
- No randomness, no side effects
- No external I/O (database calls, HTTP requests, etc.)
- No hidden state beyond what `DeReg."<Name>$Agg"` and `DeReg."<Name>$Events"` provide (across any number of aggregates)

This determinism enables replay, inspection, and testing with full confidence.

## Bind Parameters

| Syntax | Source | Example |
|---|---|---|
| `:field` | Command field | `:amount`, `:account_id` |
| `column` | STATE AS query result | `balance`, `total` |
| `data.field` | Event payload (in projections) | `data.initial_balance` |

## Executing Decisions

Decisions are triggered at runtime via the `EXECUTE` keyword, which sends a command to the system:

```deql
EXECUTE HireEmployee(employee_id := 'EMP-001', name := 'Alice', grade := 'L5');
EXECUTE Deposit(account_id := 'ACC-001', amount := 500.00);
```

The runtime looks up the decision registered in the DeReg for the command (via the `ON COMMAND` clause), runs the `STATE AS` query, evaluates the `WHERE` guard, and either emits events or rejects:

```
deql> EXECUTE Deposit(account_id := 'ACC-001', amount := 500.00);

  ✓ Deposited
    stream_id:     ACC-001
    seq:           2
    amount:        500.00

deql> EXECUTE Deposit(account_id := 'ACC-002', amount := 999.00);

  ✗ REJECTED
    decision:  DepositFunds
    guard:     balance >= :amount
    state:     balance = 250.00
    command:   amount = 999.00
```
