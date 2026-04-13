---
title: "Order Fulfillment"
description: "Cross-aggregate decisions — checking Warehouse stock before placing an Order."
---

Demonstrates a decision that queries state from one aggregate (Warehouse) to guard a command on another (OrderBook). This is the cross-aggregate pattern in DeQL.

## Domain

A warehouse system where stock is received independently, and orders are placed only when sufficient stock is available.

## Define Two Aggregates

```deql
CREATE AGGREGATE OrderBook;
CREATE AGGREGATE Warehouse;

CREATE COMMAND PlaceOrder (
  order_id   STRING,
  product_id STRING,
  quantity   INTEGER
);

CREATE COMMAND ReceiveStock (
  product_id STRING,
  quantity   INTEGER
);

CREATE EVENT OrderPlaced (
  product_id STRING,
  quantity   INTEGER
);

CREATE EVENT OrderRejected (
  product_id STRING,
  quantity   INTEGER,
  reason     STRING
);

CREATE EVENT StockReceived (
  quantity INTEGER
);
```

## Cross-Aggregate Decision

Receiving stock is unconditional:

```deql
CREATE DECISION ReceiveStock
FOR Warehouse
ON COMMAND ReceiveStock
EMIT AS
  SELECT EVENT StockReceived (
    quantity := :quantity
  );
```

Placing an order checks the Warehouse aggregate's event stream for available stock:

```deql
CREATE DECISION PlaceOrder
FOR OrderBook
ON COMMAND PlaceOrder
STATE AS
  SELECT
    COALESCE(SUM(data.quantity), 0) AS available_stock
  FROM DeReg."Warehouse$Events"
  WHERE stream_id = :product_id
    AND event_type = 'StockReceived'
EMIT AS
  SELECT EVENT OrderPlaced (
    product_id := :product_id,
    quantity   := :quantity
  )
  WHERE available_stock >= :quantity;
```

## Projections

```deql
CREATE PROJECTION StockLevels AS
SELECT
  stream_id AS product_id,
  SUM(data.quantity) AS total_received
FROM DeReg."Warehouse$Events"
WHERE event_type = 'StockReceived'
GROUP BY stream_id;

CREATE PROJECTION OrderLog AS
SELECT
  stream_id AS order_id,
  seq,
  event_type,
  data.product_id AS product_id,
  data.quantity AS quantity
FROM DeReg."OrderBook$Events"
ORDER BY order_id, seq;
```

## Execute and Observe

Receive stock:

```deql
EXECUTE ReceiveStock(product_id := 'PROD-A', quantity := 50);

  ✓ StockReceived
    stream_id:     PROD-A
    seq:           1
    quantity:  50

EXECUTE ReceiveStock(product_id := 'PROD-A', quantity := 30);

  ✓ StockReceived
    stream_id:     PROD-A
    seq:           2
    quantity:  30
```

Place an order within stock limits:

```deql
EXECUTE PlaceOrder(order_id := 'ORD-001', product_id := 'PROD-A', quantity := 20);

  ✓ OrderPlaced
    stream_id:     PROD-A
    seq:           1
    product_id:  PROD-A
    quantity:  20
```

Place an order that exceeds available stock:

```deql
EXECUTE PlaceOrder(order_id := 'ORD-002', product_id := 'PROD-A', quantity := 200);

  ✗ REJECTED
    decision:  PlaceOrder
    guard:     available_stock >= :quantity
    state:     available_stock = 80
    command:   quantity = 200
    command:   product_id = 'PROD-A'
    command:   order_id = 'ORD-002'
```

## Query Projections

```deql
SELECT * FROM DeReg."StockLevels";

+------------+----------------+
| product_id | total_received |
+------------+----------------+
| PROD-A     | 80             |
+------------+----------------+
```

```deql
SELECT * FROM DeReg."OrderLog";

+----------+-----+-------------+------------+----------+
| order_id | seq | event_type  | product_id | quantity |
+----------+-----+-------------+------------+----------+
| PROD-A   | 1   | OrderPlaced | PROD-A     | 20       |
+----------+-----+-------------+------------+----------+
```

## What This Demonstrates

- **Cross-aggregate STATE AS** — querying one aggregate's events to guard another's decision
- **Computed state** — `COALESCE(SUM(...))` to derive available stock
- **Guard with computed values** — rejection shows the actual computed stock vs. requested quantity
