---
title: COMMAND
description: External intent entering a DeQL system, expressed as data and evaluated by decisions.
---
A Command in DeQL represents external intent entering the system.
Commands describe what an external actor wants to happen — they carry no logic and guarantee no outcome.

## Purpose

Commands are the input triggers to decisions. They express a request from outside the system
(such as a user action, an API call, or a scheduled process) that the system must evaluate
against its current state and rules.

A command:

- Describes intent — “I want to deposit $200” `(ON COMMAND)`
- Carries data — the parameters required to evaluate that intent
- Guarantees nothing — the decision may accept or reject it
- Is not an event — it has not happened yet

## Syntax

```deql
CREATE COMMAND <Name> (
    <field> <TYPE>,
    ...
);
```

Use `CREATE OR REPLACE` to overwrite an existing definition:

```deql
CREATE OR REPLACE COMMAND <Name> (
    <field> <TYPE>,
    ...
);
```

## Example: Employee Commands

```deql
CREATE COMMAND HireEmployee (employee_id UUID, name STRING, grade STRING);
CREATE COMMAND PromoteEmployee (employee_id UUID, new_grade STRING);
```

## Example: Banking Commands

```deql
CREATE COMMAND OpenAccount (account_id UUID, initial_balance DECIMAL(12,2));
CREATE COMMAND Deposit (account_id UUID, amount DECIMAL(12,2));
```

## Example: E-Commerce Commands

```deql
CREATE COMMAND AddItem (
    cart_id  UUID,
    sku      STRING,
    quantity INT,
    price    DECIMAL(10,2)
);

CREATE COMMAND Checkout (
    cart_id UUID
);

CREATE COMMAND RemoveItem (
    cart_id  UUID,
    sku      STRING
);
```

## How Commands Are Referenced

Command fields are accessed inside decisions using the `:field` bind-parameter syntax:

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

Here `:name` and `:grade` refer to the fields from the `HireEmployee` command.

## Validation

Field types declared in the command definition provide structural validation. Business rule validation (e.g., "sufficient balance") is not the command's responsibility — that belongs to the decision's `STATE AS` and `EMIT AS` logic.

```
Command validation:  "Is this well-formed?"     → field types
Decision validation: "Is this allowed?"          → business rules, state checks
```

## Commands vs Events

| Aspect | Command | Event |
|---|---|---|
| Tense | Imperative ("do this") | Past tense ("this happened") |
| Certainty | Request (may be rejected) | Fact (already occurred) |
| Mutability | Can be retried/modified | Immutable once emitted |
| Storage | Transient | Persisted in event store |
| Syntax | `CREATE COMMAND` | `CREATE EVENT` |
| Access | `:field` bind params | `data.field` in projections |
| Example | `Deposit` | `Deposited` |

## Executing Commands

Commands are sent to the system at runtime using the `EXECUTE` keyword:

```deql
EXECUTE HireEmployee(employee_id := 'EMP-001', name := 'Alice', grade := 'L5');
EXECUTE OpenAccount(account_id := 'ACC-001', initial_balance := 1000.00);
EXECUTE Deposit(account_id := 'ACC-001', amount := 500.00);
```

The runtime looks up the matching decision in the DeReg (Decision Registry), evaluates the `STATE AS` query, checks the `WHERE` guard, and either emits events or rejects the command:

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

### Syntax

```deql
EXECUTE <CommandName>(
    <field> := <value>,
    ...
);
```

Field values use the `:=` assignment operator, matching the same syntax used in `SELECT EVENT` emission within decisions.
