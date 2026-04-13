---
title: "Idempotent Payments"
description: "Duplicate detection at the decision level — ensuring the same payment is never processed twice."
---

Demonstrates using STATE AS to enforce idempotency. The decision checks whether a payment with the same reference already exists before emitting, and refunds are guarded to prevent double-refunding.

## Domain

A payment ledger where each payment reference can only be processed once. Refunds are allowed only for processed, non-refunded payments.

## Define the System

```deql
CREATE AGGREGATE PaymentLedger;

CREATE COMMAND ProcessPayment (
  payment_ref STRING,
  payer_id    STRING,
  amount      DECIMAL,
  currency    STRING
);

CREATE COMMAND RefundPayment (
  payment_ref STRING,
  reason      STRING
);

CREATE EVENT PaymentProcessed (
  payer_id STRING,
  amount   DECIMAL,
  currency STRING
);

CREATE EVENT PaymentRefunded (
  reason STRING
);
```

## Idempotent Decisions

Process a payment only if no event exists for this reference yet:

```deql
CREATE DECISION ProcessPayment
FOR PaymentLedger
ON COMMAND ProcessPayment
STATE AS
  SELECT
    COUNT(*) AS event_count
  FROM DeReg."PaymentLedger$Events"
  WHERE stream_id = :payment_ref
    AND event_type = 'PaymentProcessed'
EMIT AS
  SELECT EVENT PaymentProcessed (
    payer_id := :payer_id,
    amount   := :amount,
    currency := :currency
  )
  WHERE event_count = 0;
```

Refund only if processed and not already refunded:

```deql
CREATE DECISION RefundPayment
FOR PaymentLedger
ON COMMAND RefundPayment
STATE AS
  SELECT
    COUNT(*) FILTER (WHERE event_type = 'PaymentProcessed') AS processed_count,
    COUNT(*) FILTER (WHERE event_type = 'PaymentRefunded')  AS refunded_count
  FROM DeReg."PaymentLedger$Events"
  WHERE stream_id = :payment_ref
EMIT AS
  SELECT EVENT PaymentRefunded (
    reason := :reason
  )
  WHERE processed_count > 0 AND refunded_count = 0;
```

## Projection

```deql
CREATE PROJECTION PaymentStatus AS
SELECT
  stream_id AS payment_ref,
  LAST(event_type) AS status,
  LAST(data.payer_id) AS payer_id,
  LAST(data.amount) AS amount,
  LAST(data.currency) AS currency
FROM DeReg."PaymentLedger$Events"
GROUP BY stream_id;
```

## Execute and Observe

Process a payment:

```deql
EXECUTE ProcessPayment(payment_ref := 'PAY-001', payer_id := 'CUST-10', amount := 99.99, currency := 'USD');

  ✓ PaymentProcessed
    stream_id:     PAY-001
    seq:           1
    payer_id:  CUST-10
    amount:  99.99
    currency:  USD
```

Send the exact same command again — idempotency guard rejects it:

```deql
EXECUTE ProcessPayment(payment_ref := 'PAY-001', payer_id := 'CUST-10', amount := 99.99, currency := 'USD');

  ✗ REJECTED
    decision:  ProcessPayment
    guard:     event_count = 0
    state:     event_count = 1
    command:   currency = 'USD'
    command:   payment_ref = 'PAY-001'
    command:   payer_id = 'CUST-10'
    command:   amount = 99.99
```

Refund it:

```deql
EXECUTE RefundPayment(payment_ref := 'PAY-001', reason := 'Customer request');

  ✓ PaymentRefunded
    stream_id:     PAY-001
    seq:           2
    reason:  Customer request
```

Try to refund again — already refunded:

```deql
EXECUTE RefundPayment(payment_ref := 'PAY-001', reason := 'Duplicate refund attempt');

  ✗ REJECTED
    decision:  RefundPayment
    guard:     processed_count > 0 AND refunded_count = 0
    state:     refunded_count = 1
    state:     processed_count = 1
    command:   reason = 'Duplicate refund attempt'
    command:   payment_ref = 'PAY-001'
```

## Query Projection

```deql
SELECT * FROM DeReg."PaymentStatus";

+-------------+-----------------+----------+--------+----------+
| payment_ref | status          | payer_id | amount | currency |
+-------------+-----------------+----------+--------+----------+
| PAY-001     | PaymentRefunded | CUST-10  | 99.99  | USD      |
+-------------+-----------------+----------+--------+----------+
```

## What This Demonstrates

- **Idempotency via STATE AS** — `COUNT(*) ... WHERE event_count = 0` prevents duplicate processing
- **Compound guards** — `processed_count > 0 AND refunded_count = 0` enforces multiple conditions
- **FILTER clause** in aggregations for per-event-type counting
