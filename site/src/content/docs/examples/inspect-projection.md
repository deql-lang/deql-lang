---
title: "Inspect Projection"
description: "INSPECT PROJECTION in action — verify read models from real or simulated events without updating the actual projection."
---

A small e-commerce shop wants to validate that its reporting projections produce correct output before going live. The team uses `INSPECT PROJECTION` to verify the read models — without updating the real projections.

## Domain

An online shop with orders and cancellations. Two projections: revenue by product and orders per customer.

## Define the System

```deql
CREATE AGGREGATE Shop;

CREATE COMMAND PlaceOrder (
  order_id    STRING,
  customer_id STRING,
  product     STRING,
  quantity    INT,
  unit_price  DECIMAL
);

CREATE COMMAND CancelOrder (
  order_id STRING,
  reason   STRING
);

CREATE EVENT OrderPlaced (
  customer_id STRING,
  product     STRING,
  quantity    INT,
  unit_price  DECIMAL
);

CREATE EVENT OrderCancelled (
  reason STRING
);

CREATE DECISION PlaceOrder
FOR Shop
ON COMMAND PlaceOrder
EMIT AS
  SELECT EVENT OrderPlaced (
    customer_id := :customer_id,
    product     := :product,
    quantity    := :quantity,
    unit_price  := :unit_price
  );

CREATE DECISION CancelOrder
FOR Shop
ON COMMAND CancelOrder
STATE AS
  SELECT
    LAST(event_type) AS current_status
  FROM DeReg."Shop$Events"
  WHERE stream_id = :order_id
EMIT AS
  SELECT EVENT OrderCancelled (
    reason := :reason
  )
  WHERE current_status = 'OrderPlaced';
```

## Define Projections

Revenue by product:

```deql
CREATE PROJECTION RevenueByProduct AS
SELECT
  data.product AS product,
  SUM(data.quantity) AS total_units,
  SUM(data.quantity * data.unit_price) AS total_revenue
FROM DeReg."Shop$Events"
WHERE event_type = 'OrderPlaced'
GROUP BY data.product;
```

Orders per customer:

```deql
CREATE PROJECTION CustomerOrders AS
SELECT
  data.customer_id AS customer_id,
  COUNT(*) AS order_count,
  SUM(data.quantity * data.unit_price) AS total_spent
FROM DeReg."Shop$Events"
WHERE event_type = 'OrderPlaced'
GROUP BY data.customer_id;
```

## Place Real Orders

Build up some state in the event store:

```deql
EXECUTE PlaceOrder(order_id := 'ORD-001', customer_id := 'CUST-A', product := 'Widget', quantity := 3, unit_price := 25.00);

  ✓ OrderPlaced
    stream_id:     ORD-001
    seq:           1
    customer_id:  CUST-A
    product:  Widget
    quantity:  3
    unit_price:  25

EXECUTE PlaceOrder(order_id := 'ORD-002', customer_id := 'CUST-B', product := 'Gadget', quantity := 1, unit_price := 150.00);

  ✓ OrderPlaced
    stream_id:     ORD-002
    seq:           1
    customer_id:  CUST-B
    product:  Gadget
    quantity:  1
    unit_price:  150

EXECUTE PlaceOrder(order_id := 'ORD-003', customer_id := 'CUST-A', product := 'Widget', quantity := 2, unit_price := 25.00);

  ✓ OrderPlaced
    stream_id:     ORD-003
    seq:           1
    customer_id:  CUST-A
    product:  Widget
    quantity:  2
    unit_price:  25

EXECUTE PlaceOrder(order_id := 'ORD-004', customer_id := 'CUST-C', product := 'Gadget', quantity := 5, unit_price := 150.00);

  ✓ OrderPlaced
    stream_id:     ORD-004
    seq:           1
    customer_id:  CUST-C
    product:  Gadget
    quantity:  5
    unit_price:  150
```

Query the real projections:

```deql
SELECT * FROM DeReg."RevenueByProduct";

+---------+-------------+---------------+
| product | total_units | total_revenue |
+---------+-------------+---------------+
| Widget  | 5           | 125.00        |
| Gadget  | 6           | 900.00        |
+---------+-------------+---------------+
```

```deql
SELECT * FROM DeReg."CustomerOrders";

+-------------+-------------+-------------+
| customer_id | order_count | total_spent |
+-------------+-------------+-------------+
| CUST-C      | 1           | 750.00      |
| CUST-A      | 2           | 125.00      |
| CUST-B      | 1           | 150.00      |
+-------------+-------------+-------------+
```

## INSPECT PROJECTION — Simulate the Read Model

Now run the same projection logic against the event store, but write the output to a separate table instead of updating the real projection:

```deql
INSPECT PROJECTION RevenueByProduct
FROM DeReg."Shop$Events"
INTO simulated_revenue;

  INSPECT PROJECTION → 2 row(s) projected → simulated_revenue

SELECT * FROM simulated_revenue;

+---------+-------------+---------------+
| product | total_units | total_revenue |
+---------+-------------+---------------+
| Widget  | 5           | 125.00        |
| Gadget  | 6           | 900.00        |
+---------+-------------+---------------+
```

```deql
INSPECT PROJECTION CustomerOrders
FROM DeReg."Shop$Events"
INTO simulated_customers;

  INSPECT PROJECTION → 3 row(s) projected → simulated_customers

SELECT * FROM simulated_customers;

+-------------+-------------+-------------+
| customer_id | order_count | total_spent |
+-------------+-------------+-------------+
| CUST-C      | 1           | 750.00      |
| CUST-B      | 1           | 150.00      |
| CUST-A      | 2           | 125.00      |
+-------------+-------------+-------------+
```

The simulated tables match the real projections. The real projections were not touched.

## When to Use INSPECT PROJECTION

| Scenario | Why |
|---|---|
| Validating projection logic changes | Test a modified projection query against real events before deploying |
| Shadow builds | Build a v2 projection alongside v1 — compare outputs, swap when ready |
| Regression testing | Verify projection output hasn't changed after event schema evolution |
| Read model design | Prototype a new projection and verify its shape before registering it |
| Full rebuild | Replay all events through a projection into a fresh target table |

## What This Demonstrates

- **INSPECT PROJECTION** runs projection logic against any event source without updating the real projection
- **FROM DeReg."Aggregate$Events"** reads from the real event store
- **INTO simulated_table** writes to a separate output table
- **Summary output** — `N row(s) projected` gives instant feedback
- **Same logic, no side effects** — the projection query is identical to production, but nothing is mutated
