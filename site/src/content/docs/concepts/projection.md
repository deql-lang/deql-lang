---
title: PROJECTION
description: Read models, aggregation functions, replay with offset and guards in DeQL.
---

A Projection in DeQL defines a derived read model built from events. Projections serve the query side of CQRS — they transform event streams into shapes optimized for reading, reporting, and display.

## Purpose

Projections exist to answer questions about the system without replaying decisions. They are:

- **Derived** — built entirely from events `(FROM DeReg."<Aggregate>$Events")`
- **Disposable** — can be dropped and rebuilt at any time `(CREATE PROJECTION <Name> AS)`
- **Read‑focused** — shaped for specific query patterns `(SELECT)`
- **Independent** — evolve separately from aggregates and decisions
- **Composable** — may combine events from multiple aggregates and streams `(FROM <Aggregate>$Events, JOIN)`
- **Temporal** — derive current or initial values from event history `(LAST(), FIRST())`

## Syntax

```deql
CREATE PROJECTION <Name> AS
SELECT
    <fields, aggregations, expressions>
FROM DeReg."<Aggregate>$Events"
[WHERE <conditions>]
GROUP BY stream_id;
```

Projections use standard SQL-like syntax — `SELECT`, `FROM`, `WHERE`, `GROUP BY` — applied over the event stream. Note that projections use `stream_id` for grouping, which can be aliased to a meaningful name.

## Example: Account Balance

```deql
CREATE PROJECTION AccountBalance AS
SELECT
    stream_id AS aggregate_id,
    LAST(data.initial_balance) AS balance
FROM DeReg."BankAccount$Events"
GROUP BY stream_id;
```

This projection reads the `BankAccount` event stream and extracts the last `initial_balance` value per account, grouped by `stream_id`.

```deql
SELECT * FROM DeReg."AccountBalance";
```

## Example: Employee Roster

```deql
CREATE PROJECTION EmployeeRoster AS
SELECT
    stream_id AS employee_id,
    LAST(data.name) AS name,
    LAST(data.grade) AS current_grade,
    LAST(data.new_grade) AS promoted_grade
FROM DeReg."Employee$Events"
GROUP BY stream_id;
```

```deql
SELECT * FROM DeReg."EmployeeRoster";
```

## Example: Cart Summary

```deql
CREATE PROJECTION CartSummary AS
SELECT
    stream_id AS cart_id,
    COUNT(*) AS item_count,
    SUM(data.price * data.quantity) AS total_value
FROM DeReg."ShoppingCart$Events"
WHERE event_type = 'ItemAdded'
GROUP BY stream_id;
```

## Example: Transaction History

```deql
CREATE PROJECTION TransactionHistory AS
SELECT
    stream_id AS account_id,
    event_type AS transaction_type,
    data.amount AS amount,
    data.initial_balance AS initial_balance
FROM DeReg."BankAccount$Events"
ORDER BY seq DESC;
```

## Example: Cross-Aggregate Dashboard

```deql
CREATE PROJECTION InventoryDashboard AS
/* 
  Cross-aggregate read model (2 aggregates):
  - Product$Events      → provides descriptive attributes (e.g., product_name)
  - Inventory$Events    → provides stock movement facts (received/shipped)
  
  This projection joins both event-derived views by SKU (stream_id).
  It is read-side only: it does not emit events and can be rebuilt at any time.
*/
WITH product_dim AS (
  /*
    Dimension slice derived from Product events.
    LAST(data.name) is a DeQL UDAF that returns the most recent non-null value
    (ordered by the event sequence/timeline) per GROUP BY key.
  */
  SELECT
    stream_id AS sku,                 -- SKU is the aggregate identifier for Product
    LAST(data.name) AS product_name   -- Latest known product name for the SKU
  FROM DeReg."Product$Events"
  WHERE event_type IN (
    'ProductRegistered',             -- initial registration
    'ProductRenamed',                -- rename events
    'ProductUpdated'                 -- general updates that may include name
  )
  GROUP BY stream_id                 -- one row per SKU
),
stock_fact AS (
  /*
    Fact slice derived from Inventory movement events.
    The SUM(CASE ...) pattern reconstructs current stock as:
      +quantity for StockReceived
      -quantity for StockShipped
    COALESCE guards against missing quantities.
  */
  SELECT
    stream_id AS sku,  -- SKU is the aggregate identifier for Inventory

    SUM(
      CASE
        WHEN event_type = 'StockReceived' THEN COALESCE(data.quantity, 0)
        WHEN event_type = 'StockShipped'  THEN -COALESCE(data.quantity, 0)
        ELSE 0
      END
    ) AS current_stock,  -- derived stock position for the SKU

    SUM(
      CASE
        WHEN event_type = 'StockShipped' THEN 1
        ELSE 0
      END
    ) AS total_shipments  -- number of shipment events (portable alternative to FILTER)
  FROM DeReg."Inventory$Events"
  WHERE event_type IN (
    'StockReceived',
    'StockShipped'
  )
  GROUP BY stream_id  -- one row per SKU
)
/*
  Final dashboard:
  - start from stock_fact (SKUs that have inventory activity)
  - left join product_dim to attach the latest name (if available)
*/
SELECT
  s.sku,                              -- SKU key (from Inventory events)
  p.product_name,                     -- latest product name (from Product events)
  COALESCE(s.current_stock, 0)   AS current_stock,
  COALESCE(s.total_shipments, 0) AS total_shipments
FROM stock_fact s
LEFT JOIN product_dim p
  ON p.sku = s.sku;                   -- correlate across aggregates by SKU

```

## Querying Event Streams

Projections access events through the `$Events` suffix with quoted identifiers:

| Reference | Meaning |
|---|---|
| `DeReg."<Aggregate>$Events"` | The raw event stream for that aggregate |
| `event_type` | The name of the event (e.g., `'Deposited'`) |
| `data.<field>` | A field from the event's payload |
| `stream_id` | The aggregate instance the event belongs to |
| `seq` | Position in the aggregate's event stream |

## Aggregation Functions

Projections support standard SQL aggregation:

| Function | Description |
|---|---|
| `LAST(expr)` | Most recent value in the stream |
| `FIRST(expr)` | Earliest value in the stream |
| `SUM(expr)` | Sum of values |
| `COUNT(*)` | Number of events |
| `AVG(expr)` | Average value |
| `MIN(expr)` / `MAX(expr)` | Minimum / maximum |
| `COUNT(*) FILTER (WHERE ...)` | Conditional count |

## Disposability

A key property of projections is that they are fully disposable. Since they are derived entirely from events, any projection can be:

- Dropped and rebuilt from the event store
- Replaced with a new version that has a different shape
- Run in parallel (old and new versions side by side)

## Inspecting Projections

Projections can be inspected using `INSPECT PROJECTION`. This works in two modes:

### Testing: Simulated Events

Feed simulated events through a projection to validate its logic without side effects:

```deql
INSPECT PROJECTION AccountBalance
FROM simulated_open_events
INTO simulated_balances;

SELECT * FROM simulated_balances;
```

Chain with `INSPECT DECISION` for full pipeline verification:

```deql
CREATE TABLE test_opens AS VALUES
  ('ACC-100', 500.00),
  ('ACC-101', 0.00),
  ('ACC-102', 1500.00);

INSPECT DECISION Open
FROM test_opens
INTO simulated_open_events;

INSPECT PROJECTION AccountBalance
FROM simulated_open_events
INTO simulated_balances;

SELECT * FROM simulated_balances;
```

### Production: Replay With Offset and Guards

In production, `INSPECT PROJECTION` replays real events from the event store. Use `OFFSET` to resume from a position, `WHERE` to guard which events are processed, and `LIMIT` to control batch size:

```deql
-- Full rebuild from scratch
INSPECT PROJECTION AccountBalance
FROM DeReg."BankAccount$Events"
INTO DeReg."AccountBalance";

-- Resume from sequence 500000
INSPECT PROJECTION AccountBalance
FROM DeReg."BankAccount$Events"
INTO DeReg."AccountBalance"
OFFSET 500000;

-- Rebuild only for a specific account
INSPECT PROJECTION AccountBalance
FROM DeReg."BankAccount$Events"
INTO DeReg."AccountBalance"
WHERE stream_id = 'ACC-001';

-- Batched replay: 10,000 events at a time
INSPECT PROJECTION AccountBalance
FROM DeReg."BankAccount$Events"
INTO DeReg."AccountBalance"
OFFSET 0
LIMIT 10000;
```

See the [Inspection docs](/inspection/) for full details on guards, offsets, shadow projections, and production replay patterns.

## Projections vs Aggregates

| Aspect | Projection | Aggregate |
|---|---|---|
| Side | Read (query) | Write (decision) |
| Access | `CREATE PROJECTION ... AS SELECT` | `STATE AS SELECT ... FROM DeReg."<Aggregate>$Agg"` |
| Scope | Cross-entity, denormalized | Single entity by `aggregate_id` |
| Lifecycle | Continuously maintained | Rebuilt per decision |
| Purpose | Serve queries | Provide state for decisions |
