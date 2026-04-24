---
title: Decision Branching Example
slug: examples/decision-branching
---

This example demonstrates how to use UNION ALL branching in DeQL decisions to handle multiple mutually exclusive outcomes from a single command. The scenario models a warehouse order fulfillment process, where the outcome depends on available stock.

## Scenario Overview

- **Aggregate:** `Warehouse`
- **Commands:**
  - `FulfillOrder(warehouse_id, order_id, requested_qty)`
  - `ReceiveStock(warehouse_id, product_id, quantity)`
- **Events:**
  - `OrderFullyFilled(order_id, quantity)`
  - `OrderPartiallySplit(order_id, filled, remaining)`
  - `OrderBackordered(order_id, quantity)`
  - `StockReceived(product_id, quantity)`

## Decision Logic: FulfillOrderDecision

The `FulfillOrderDecision` uses three branches:

- **FullFill:**
  - Fires when `available_qty >= requested_qty`.
  - Emits `OrderFullyFilled`.
- **PartialFill:**
  - Fires when `0 < available_qty < requested_qty`.
  - Emits `OrderPartiallySplit`.
- **Backorder:**
  - Fires when `available_qty <= 0`.
  - Emits `OrderBackordered`.

Exactly one branch fires for each command, and the command is only rejected if none match (which cannot happen with these guards).

## Example Script Walkthrough

```sql
-- Seed warehouse with stock
EXECUTE ReceiveStock(warehouse_id := 'WH-1', product_id := 'SKU-A', quantity := 10);

-- Full fill (10 >= 5)
EXECUTE FulfillOrder(warehouse_id := 'WH-1', order_id := 'ORD-1', requested_qty := 5);
-- ✓ OrderFullyFilled
--   order_id: ORD-1
--   quantity: 5

-- Partial fill (5 remaining, requesting 8)
EXECUTE FulfillOrder(warehouse_id := 'WH-1', order_id := 'ORD-2', requested_qty := 8);
-- ✓ OrderPartiallySplit
--   order_id: ORD-2
--   filled: 5
--   remaining: 3

-- Backorder (0 remaining)
EXECUTE FulfillOrder(warehouse_id := 'WH-1', order_id := 'ORD-3', requested_qty := 3);
-- ✓ OrderBackordered
--   order_id: ORD-3
--   quantity: 3
```

## How It Works

- The decision queries the current available stock from the projection `WarehouseStock`.
- Each branch has a guard condition and emits a different event.
- The outcome is always explicit—no silent rejections.

## Inspecting Branch Outcomes

You can use INSPECT to simulate a batch of orders and see which branch fires for each input.

```sql
CREATE TABLE test_orders AS VALUES
  ('WH-1', 'ORD-4', 2),
  ('WH-1', 'ORD-5', 10),
  ('WH-1', 'ORD-6', 1);

INSPECT DECISION FulfillOrderDecision
FROM test_orders
INTO simulated_order_events;

SELECT * FROM simulated_order_events;
SELECT * FROM simulated_order_events__branches;
```

## Summary

This pattern is useful for any scenario where a command can have multiple mutually exclusive outcomes, and you want to record each as a first-class event.

