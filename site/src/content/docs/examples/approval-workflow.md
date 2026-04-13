---
title: "Approval Workflow"
description: "State machine with guarded transitions — Submit, Approve, Reject, Cancel with lifecycle enforcement."
---

A workflow where expense requests move through a lifecycle: Submit → Approve or Reject, with guards preventing invalid transitions (can't approve an already-rejected request, can't cancel after approval).

## Domain

An expense approval system with four commands and strict state transition rules.

## Define the System

```deql
CREATE AGGREGATE ExpenseRequest;

CREATE COMMAND SubmitExpense (
  request_id  STRING,
  employee_id STRING,
  amount      DECIMAL,
  description STRING
);

CREATE COMMAND ApproveExpense (
  request_id  STRING,
  approver_id STRING
);

CREATE COMMAND RejectExpense (
  request_id  STRING,
  approver_id STRING,
  reason      STRING
);

CREATE COMMAND CancelExpense (
  request_id STRING
);

CREATE EVENT ExpenseSubmitted (
  employee_id STRING,
  amount      DECIMAL,
  description STRING
);

CREATE EVENT ExpenseApproved (
  approver_id STRING
);

CREATE EVENT ExpenseRejected (
  approver_id STRING,
  reason      STRING
);

CREATE EVENT ExpenseCancelled ();
```

## Decisions with Lifecycle Guards

Submitting is unconditional:

```deql
CREATE DECISION SubmitExpense
FOR ExpenseRequest
ON COMMAND SubmitExpense
EMIT AS
  SELECT EVENT ExpenseSubmitted (
    employee_id := :employee_id,
    amount      := :amount,
    description := :description
  );
```

Approval, rejection, and cancellation all require the request to be in `ExpenseSubmitted` state:

```deql
CREATE DECISION ApproveExpense
FOR ExpenseRequest
ON COMMAND ApproveExpense
STATE AS
  SELECT
    LAST(event_type) AS current_status
  FROM DeReg."ExpenseRequest$Events"
  WHERE stream_id = :request_id
EMIT AS
  SELECT EVENT ExpenseApproved (
    approver_id := :approver_id
  )
  WHERE current_status = 'ExpenseSubmitted';

CREATE DECISION RejectExpense
FOR ExpenseRequest
ON COMMAND RejectExpense
STATE AS
  SELECT
    LAST(event_type) AS current_status
  FROM DeReg."ExpenseRequest$Events"
  WHERE stream_id = :request_id
EMIT AS
  SELECT EVENT ExpenseRejected (
    approver_id := :approver_id,
    reason      := :reason
  )
  WHERE current_status = 'ExpenseSubmitted';

CREATE DECISION CancelExpense
FOR ExpenseRequest
ON COMMAND CancelExpense
STATE AS
  SELECT
    LAST(event_type) AS current_status
  FROM DeReg."ExpenseRequest$Events"
  WHERE stream_id = :request_id
EMIT AS
  SELECT EVENT ExpenseCancelled ()
  WHERE current_status = 'ExpenseSubmitted';
```

## Projections

```deql
CREATE PROJECTION PendingApprovals AS
SELECT
  stream_id AS request_id,
  LAST(data.employee_id) AS employee_id,
  LAST(data.amount) AS amount,
  LAST(data.description) AS description
FROM DeReg."ExpenseRequest$Events"
WHERE event_type = 'ExpenseSubmitted'
  AND stream_id NOT IN (
    SELECT stream_id FROM DeReg."ExpenseRequest$Events"
    WHERE event_type IN ('ExpenseApproved', 'ExpenseRejected', 'ExpenseCancelled')
  )
GROUP BY stream_id;

CREATE PROJECTION ExpenseHistory AS
SELECT
  stream_id AS request_id,
  seq,
  event_type,
  occurred_at
FROM DeReg."ExpenseRequest$Events"
ORDER BY request_id, seq;
```

## Execute and Observe

Submit two expense requests:

```deql
EXECUTE SubmitExpense(request_id := 'EXP-001', employee_id := 'EMP-042', amount := 350.00, description := 'Conference travel');

  ✓ ExpenseSubmitted
    stream_id:     EXP-001
    seq:           1
    employee_id:  EMP-042
    amount:  350
    description:  Conference travel

EXECUTE SubmitExpense(request_id := 'EXP-002', employee_id := 'EMP-007', amount := 75.00, description := 'Team lunch');

  ✓ ExpenseSubmitted
    stream_id:     EXP-002
    seq:           1
    employee_id:  EMP-007
    amount:  75
    description:  Team lunch
```

Approve one:

```deql
EXECUTE ApproveExpense(request_id := 'EXP-001', approver_id := 'MGR-001');

  ✓ ExpenseApproved
    stream_id:     EXP-001
    seq:           2
    approver_id:  MGR-001
```

Try to approve again — already approved, guard rejects:

```deql
EXECUTE ApproveExpense(request_id := 'EXP-001', approver_id := 'MGR-002');

  ✗ REJECTED
    decision:  ApproveExpense
    guard:     current_status = 'ExpenseSubmitted'
    state:     current_status = 'ExpenseApproved'
    command:   approver_id = 'MGR-002'
    command:   request_id = 'EXP-001'
```

Reject the other:

```deql
EXECUTE RejectExpense(request_id := 'EXP-002', approver_id := 'MGR-001', reason := 'Budget exceeded');

  ✓ ExpenseRejected
    stream_id:     EXP-002
    seq:           2
    approver_id:  MGR-001
    reason:  Budget exceeded
```

Try to cancel a rejected request — guard prevents it:

```deql
EXECUTE CancelExpense(request_id := 'EXP-002');

  ✗ REJECTED
    decision:  CancelExpense
    guard:     current_status = 'ExpenseSubmitted'
    state:     current_status = 'ExpenseRejected'
    command:   request_id = 'EXP-002'
```

## Query Projections

```deql
SELECT * FROM DeReg."PendingApprovals";

+------------+-------------+--------+-------------+
| request_id | employee_id | amount | description |
+------------+-------------+--------+-------------+
+------------+-------------+--------+-------------+
-- No pending approvals — both have been resolved.
```

```deql
SELECT * FROM DeReg."ExpenseHistory";

+------------+-----+------------------+-----------------------------+
| request_id | seq | event_type       | occurred_at                 |
+------------+-----+------------------+-----------------------------+
| EXP-001    | 1   | ExpenseSubmitted | 2026-04-13T12:31:55.916457Z |
| EXP-001    | 2   | ExpenseApproved  | 2026-04-13T12:31:55.984192Z |
| EXP-002    | 1   | ExpenseSubmitted | 2026-04-13T12:31:55.922217Z |
| EXP-002    | 2   | ExpenseRejected  | 2026-04-13T12:31:56.022070Z |
+------------+-----+------------------+-----------------------------+
```

## What This Demonstrates

- **State machine enforcement** via guarded decisions
- **Multiple valid transitions** from a single state (Submitted → Approved, Rejected, or Cancelled)
- **Invalid transition rejection** with full diagnostic output
- **Projection filtering** to show only pending items
