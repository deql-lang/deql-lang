---
title: "Subscription Billing"
description: "Lifecycle guards for subscriptions — Subscribe, Renew, Suspend, Cancel with state transition enforcement."
---

A subscription lifecycle with four commands and strict state transition rules. Demonstrates computed state, lifecycle guards, and revenue projections.

## Domain

A SaaS billing system where subscriptions move through: Started → Renewed (repeatable), Suspended, or Cancelled. Guards enforce valid transitions at every step.

## Define the System

```deql
CREATE AGGREGATE Subscription;

CREATE COMMAND Subscribe (
  subscription_id STRING,
  customer_id     STRING,
  plan            STRING,
  monthly_rate    DECIMAL
);

CREATE COMMAND RenewSubscription (
  subscription_id STRING
);

CREATE COMMAND CancelSubscription (
  subscription_id STRING,
  reason          STRING
);

CREATE COMMAND SuspendSubscription (
  subscription_id STRING,
  reason          STRING
);

CREATE EVENT SubscriptionStarted (
  customer_id  STRING,
  plan         STRING,
  monthly_rate DECIMAL
);

CREATE EVENT SubscriptionRenewed ();

CREATE EVENT SubscriptionCancelled (
  reason STRING
);

CREATE EVENT SubscriptionSuspended (
  reason STRING
);
```

## Lifecycle Decisions

Starting is unconditional:

```deql
CREATE DECISION Subscribe
FOR Subscription
ON COMMAND Subscribe
EMIT AS
  SELECT EVENT SubscriptionStarted (
    customer_id  := :customer_id,
    plan         := :plan,
    monthly_rate := :monthly_rate
  );
```

Renewal only from active states:

```deql
CREATE DECISION RenewSubscription
FOR Subscription
ON COMMAND RenewSubscription
STATE AS
  SELECT
    LAST(event_type) AS current_status
  FROM DeReg."Subscription$Events"
  WHERE stream_id = :subscription_id
EMIT AS
  SELECT EVENT SubscriptionRenewed ()
  WHERE current_status IN ('SubscriptionStarted', 'SubscriptionRenewed');
```

Cancellation from active or suspended:

```deql
CREATE DECISION CancelSubscription
FOR Subscription
ON COMMAND CancelSubscription
STATE AS
  SELECT
    LAST(event_type) AS current_status
  FROM DeReg."Subscription$Events"
  WHERE stream_id = :subscription_id
EMIT AS
  SELECT EVENT SubscriptionCancelled (
    reason := :reason
  )
  WHERE current_status IN ('SubscriptionStarted', 'SubscriptionRenewed', 'SubscriptionSuspended');
```

Suspension only from active states:

```deql
CREATE DECISION SuspendSubscription
FOR Subscription
ON COMMAND SuspendSubscription
STATE AS
  SELECT
    LAST(event_type) AS current_status
  FROM DeReg."Subscription$Events"
  WHERE stream_id = :subscription_id
EMIT AS
  SELECT EVENT SubscriptionSuspended (
    reason := :reason
  )
  WHERE current_status IN ('SubscriptionStarted', 'SubscriptionRenewed');
```

## Projections

```deql
CREATE PROJECTION ActiveSubscriptions AS
SELECT
  stream_id AS subscription_id,
  LAST(data.customer_id) AS customer_id,
  LAST(data.plan) AS plan,
  LAST(data.monthly_rate) AS monthly_rate,
  LAST(event_type) AS status,
  COUNT(*) FILTER (WHERE event_type = 'SubscriptionRenewed') AS renewal_count
FROM DeReg."Subscription$Events"
GROUP BY stream_id;

CREATE PROJECTION RevenueReport AS
SELECT
  LAST(data.plan) AS plan,
  COUNT(DISTINCT stream_id) AS subscriber_count,
  SUM(data.monthly_rate) AS total_monthly_revenue
FROM DeReg."Subscription$Events"
WHERE event_type = 'SubscriptionStarted'
GROUP BY data.plan;
```

## Execute and Observe

```deql
EXECUTE Subscribe(subscription_id := 'SUB-001', customer_id := 'CUST-A', plan := 'Pro', monthly_rate := 29.99);

  ✓ SubscriptionStarted
    stream_id:     SUB-001
    seq:           1
    customer_id:  CUST-A
    plan:  Pro
    monthly_rate:  29.99

EXECUTE Subscribe(subscription_id := 'SUB-002', customer_id := 'CUST-B', plan := 'Basic', monthly_rate := 9.99);

  ✓ SubscriptionStarted
    stream_id:     SUB-002
    seq:           1
    customer_id:  CUST-B
    plan:  Basic
    monthly_rate:  9.99
```

Renew one:

```deql
EXECUTE RenewSubscription(subscription_id := 'SUB-001');

  ✓ SubscriptionRenewed
    stream_id:     SUB-001
    seq:           2
```

Suspend the other:

```deql
EXECUTE SuspendSubscription(subscription_id := 'SUB-002', reason := 'Payment failed');

  ✓ SubscriptionSuspended
    stream_id:     SUB-002
    seq:           2
    reason:  Payment failed
```

Try to renew a suspended subscription — guard rejects:

```deql
EXECUTE RenewSubscription(subscription_id := 'SUB-002');

  ✗ REJECTED
    decision:  RenewSubscription
    guard:     current_status IN ('SubscriptionStarted', 'SubscriptionRenewed')
    state:     current_status = 'SubscriptionSuspended'
    command:   subscription_id = 'SUB-002'
```

Cancel the suspended one:

```deql
EXECUTE CancelSubscription(subscription_id := 'SUB-002', reason := 'Customer churned');

  ✓ SubscriptionCancelled
    stream_id:     SUB-002
    seq:           3
    reason:  Customer churned
```

Try to cancel again — already cancelled:

```deql
EXECUTE CancelSubscription(subscription_id := 'SUB-002', reason := 'Duplicate');

  ✗ REJECTED
    decision:  CancelSubscription
    guard:     current_status IN ('SubscriptionStarted', 'SubscriptionRenewed', 'SubscriptionSuspended')
    state:     current_status = 'SubscriptionCancelled'
    command:   subscription_id = 'SUB-002'
    command:   reason = 'Duplicate'
```

## Query Projections

```deql
SELECT * FROM DeReg."ActiveSubscriptions";

+-----------------+-------------+-------+--------------+-----------------------+---------------+
| subscription_id | customer_id | plan  | monthly_rate | status                | renewal_count |
+-----------------+-------------+-------+--------------+-----------------------+---------------+
| SUB-001         | CUST-A      | Pro   | 29.99        | SubscriptionRenewed   | 1             |
| SUB-002         | CUST-B      | Basic | 9.99         | SubscriptionCancelled | 0             |
+-----------------+-------------+-------+--------------+-----------------------+---------------+
```

```deql
SELECT * FROM DeReg."RevenueReport";

+-------+------------------+-----------------------+
| plan  | subscriber_count | total_monthly_revenue |
+-------+------------------+-----------------------+
| Basic | 1                | 9.99                  |
| Pro   | 1                | 29.99                 |
+-------+------------------+-----------------------+
```

## What This Demonstrates

- **Multi-state IN guards** — allowing transitions from multiple valid states
- **Lifecycle enforcement** — suspended subscriptions can be cancelled but not renewed
- **FILTER clause** in projections for per-event-type aggregation
- **Revenue reporting** from event data
