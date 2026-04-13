---
title: "Inventory System"
description: "A multi-warehouse inventory system built with templates — define the stock lifecycle once, apply it per category."
---

A multi-warehouse system that tracks different categories of stock items. Each category (fasteners, tools, raw materials) follows the same lifecycle: register → receive → ship → discontinue. Instead of hand-writing the same commands, events, and decisions for each category, we define a template once and apply it per category.

## The Template — Stock Item Lifecycle

Every stock category needs the same structure: 1 aggregate, 4 commands, 4 events, 4 decisions. The template captures this once:

```deql
CREATE TEMPLATE StockItem (Category) AS (

    CREATE AGGREGATE {{Category}};

    CREATE COMMAND Register{{Category}} (
        sku        STRING,
        name       STRING,
        unit_price DECIMAL(10,2),
        warehouse  STRING
    );

    CREATE COMMAND Receive{{Category}} (
        sku         STRING,
        quantity    INT,
        received_by STRING,
        batch_id    STRING
    );

    CREATE COMMAND Ship{{Category}} (
        sku         STRING,
        quantity    INT,
        order_id    STRING,
        destination STRING
    );

    CREATE COMMAND Discontinue{{Category}} (
        sku    STRING,
        reason STRING
    );

    CREATE EVENT {{Category}}Registered (
        name       STRING,
        unit_price DECIMAL(10,2),
        warehouse  STRING
    );

    CREATE EVENT {{Category}}Received (
        quantity    INT,
        received_by STRING,
        batch_id    STRING
    );

    CREATE EVENT {{Category}}Shipped (
        quantity    INT,
        order_id    STRING,
        destination STRING
    );

    CREATE EVENT {{Category}}Discontinued (
        reason STRING
    );

    CREATE DECISION Register{{Category}}Item
    FOR {{Category}}
    ON COMMAND Register{{Category}}
    EMIT AS
        SELECT EVENT {{Category}}Registered (
            name       := :name,
            unit_price := :unit_price,
            warehouse  := :warehouse
        );

    CREATE DECISION Receive{{Category}}Stock
    FOR {{Category}}
    ON COMMAND Receive{{Category}}
    EMIT AS
        SELECT EVENT {{Category}}Received (
            quantity    := :quantity,
            received_by := :received_by,
            batch_id    := :batch_id
        )
        WHERE :quantity > 0;

    CREATE DECISION Ship{{Category}}Stock
    FOR {{Category}}
    ON COMMAND Ship{{Category}}
    EMIT AS
        SELECT EVENT {{Category}}Shipped (
            quantity    := :quantity,
            order_id    := :order_id,
            destination := :destination
        )
        WHERE :quantity > 0;

    CREATE DECISION Discontinue{{Category}}Item
    FOR {{Category}}
    ON COMMAND Discontinue{{Category}}
    EMIT AS
        SELECT EVENT {{Category}}Discontinued (
            reason := :reason
        );
);
```

## Apply — One Line Per Category

Each `APPLY` generates 13 definitions (1 aggregate + 4 commands + 4 events + 4 decisions):

```deql
APPLY TEMPLATE StockItem WITH (Category = 'Fastener');
APPLY TEMPLATE StockItem WITH (Category = 'Tool');
APPLY TEMPLATE StockItem WITH (Category = 'Material');
```

```
Template 'StockItem' expanded: 13 definitions generated
  (AGGREGATE Fastener, COMMAND RegisterFastener, COMMAND ReceiveFastener,
   COMMAND ShipFastener, COMMAND DiscontinueFastener, ...)

Template 'StockItem' expanded: 13 definitions generated
  (AGGREGATE Tool, COMMAND RegisterTool, ...)

Template 'StockItem' expanded: 13 definitions generated
  (AGGREGATE Material, COMMAND RegisterMaterial, ...)
```

Three lines. 39 definitions. Zero boilerplate.

## Run the Warehouse Story

Register fasteners, tools, and raw materials across warehouses:

```deql
EXECUTE RegisterFastener(sku := 'BOLT-M8-50', name := 'M8x50 Hex Bolt', unit_price := 0.45, warehouse := 'WH-EAST');

  ✓ FastenerRegistered
    stream_id:     BOLT-M8-50
    seq:           1
    name:  M8x50 Hex Bolt
    unit_price:  0.45
    warehouse:  WH-EAST

EXECUTE RegisterFastener(sku := 'NUT-M8', name := 'M8 Hex Nut', unit_price := 0.12, warehouse := 'WH-EAST');
EXECUTE RegisterTool(sku := 'WRENCH-13', name := '13mm Combo Wrench', unit_price := 12.50, warehouse := 'WH-WEST');
EXECUTE RegisterTool(sku := 'DRILL-M6', name := 'M6 HSS Drill Bit', unit_price := 3.75, warehouse := 'WH-WEST');
EXECUTE RegisterMaterial(sku := 'STEEL-ROD-6M', name := '6m Steel Rod 12mm', unit_price := 18.00, warehouse := 'WH-NORTH');
```

Receive stock in batches:

```deql
EXECUTE ReceiveFastener(sku := 'BOLT-M8-50', quantity := 500, received_by := 'dock-crew', batch_id := 'BATCH-F001');

  ✓ FastenerReceived
    stream_id:     BATCH-F001
    seq:           1
    quantity:  500
    received_by:  dock-crew
    batch_id:  BATCH-F001

EXECUTE ReceiveFastener(sku := 'NUT-M8', quantity := 1000, received_by := 'dock-crew', batch_id := 'BATCH-F001');
EXECUTE ReceiveTool(sku := 'WRENCH-13', quantity := 50, received_by := 'dock-crew', batch_id := 'BATCH-T001');
EXECUTE ReceiveMaterial(sku := 'STEEL-ROD-6M', quantity := 200, received_by := 'dock-crew', batch_id := 'BATCH-M001');
```

Ship to customers:

```deql
EXECUTE ShipFastener(sku := 'BOLT-M8-50', quantity := 100, order_id := 'ORD-1001', destination := 'Customer A');

  ✓ FastenerShipped
    stream_id:     ORD-1001
    seq:           1
    quantity:  100
    order_id:  ORD-1001
    destination:  Customer A

EXECUTE ShipFastener(sku := 'NUT-M8', quantity := 200, order_id := 'ORD-1001', destination := 'Customer A');
EXECUTE ShipTool(sku := 'WRENCH-13', quantity := 5, order_id := 'ORD-1002', destination := 'Customer B');
```

Discontinue a product:

```deql
EXECUTE DiscontinueTool(sku := 'DRILL-M6', reason := 'Replaced by carbide version');

  ✓ ToolDiscontinued
    stream_id:     DRILL-M6
    seq:           2
    reason:  Replaced by carbide version
```

## Query Events

```deql
SELECT stream_id, event_type, seq FROM DeReg."Fastener$Events" ORDER BY stream_id, seq;

+------------+--------------------+-----+
| stream_id  | event_type         | seq |
+------------+--------------------+-----+
| BATCH-F001 | FastenerReceived   | 1   |
| BATCH-F001 | FastenerReceived   | 2   |
| BOLT-M8-50 | FastenerRegistered | 1   |
| NUT-M8     | FastenerRegistered | 1   |
| ORD-1001   | FastenerShipped    | 1   |
| ORD-1001   | FastenerShipped    | 2   |
+------------+--------------------+-----+
```

```deql
SELECT stream_id, event_type, seq FROM DeReg."Tool$Events" ORDER BY stream_id, seq;

+------------+------------------+-----+
| stream_id  | event_type       | seq |
+------------+------------------+-----+
| BATCH-T001 | ToolReceived     | 1   |
| DRILL-M6   | ToolRegistered   | 1   |
| DRILL-M6   | ToolDiscontinued | 2   |
| ORD-1002   | ToolShipped      | 1   |
| WRENCH-13  | ToolRegistered   | 1   |
+------------+------------------+-----+
```

## Inspect — Simulate New Registrations

```deql
CREATE TABLE test_register_fasteners AS VALUES
    ('SCREW-M6-25', 'M6x25 Machine Screw', 0.08, 'WH-EAST'),
    ('ANCHOR-M10',  'M10 Wedge Anchor',    1.25, 'WH-EAST');

INSPECT DECISION RegisterFastenerItem
FROM test_register_fasteners
INTO simulated_registrations;

  INSPECT DECISION → 2 event(s) emitted, 0 rejected → simulated_registrations

SELECT stream_id, event_type, data FROM simulated_registrations;

+-------------+--------------------+------------------------------------------------------+
| stream_id   | event_type         | data                                                 |
+-------------+--------------------+------------------------------------------------------+
| SCREW-M6-25 | FastenerRegistered | {name: M6x25 Machine Screw, unit_price: 0.08, ...}  |
| ANCHOR-M10  | FastenerRegistered | {name: M10 Wedge Anchor, unit_price: 1.25, ...}     |
+-------------+--------------------+------------------------------------------------------+
```

## What This Demonstrates

- **Template reuse** — one `StockItem` template generates the full lifecycle for any stock category
- **One-line instantiation** — `APPLY TEMPLATE StockItem WITH (Category = 'Fastener')` creates 13 definitions
- **Consistent patterns** — every category gets the same commands, events, decisions, and guards
- **INSPECT** for side-effect-free simulation of new registrations
