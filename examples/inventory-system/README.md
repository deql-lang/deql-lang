# Inventory Management System — DeQL Demo

A multi-warehouse system that tracks different categories of stock items. Each category (fasteners, tools, raw materials) follows the same lifecycle pattern. Instead of hand-writing the same commands, events, and decisions for each category, we define a `StockItem` template once and apply it per category.

## The Template Story

The `StockItem` template captures the full stock item lifecycle:
- Register → Receive → Ship → Discontinue
- 1 aggregate, 4 commands, 4 events, 4 decisions = 13 definitions

Three `APPLY TEMPLATE` calls generate 39 definitions total:
```deql
APPLY TEMPLATE StockItem WITH (Category = 'Fastener');
APPLY TEMPLATE StockItem WITH (Category = 'Tool');
APPLY TEMPLATE StockItem WITH (Category = 'Material');
```

## Blocks Covered

| Block | What it does in this demo |
|---|---|
| TEMPLATE | `StockItem` — reusable lifecycle pattern for any stock category |
| APPLY TEMPLATE | Instantiate for Fastener, Tool, Material (39 definitions from 3 lines) |
| AGGREGATE | One per category: Fastener, Tool, Material |
| COMMAND | 4 per category: Register, Receive, Ship, Discontinue |
| EVENT | 4 per category: Registered, Received, Shipped, Discontinued |
| DECISION | 4 per category with WHERE guards |
| PROJECTION | Stock levels per category using COUNT FILTER |
| EVENTSTORE | Local dev config with Parquet storage |
| EXECUTE | Full warehouse scenario across all categories |
| INSPECT | Simulated registrations |
| DESCRIBE | Introspect the domain model + template instances |
| VALIDATE | Cross-reference consistency check |
| EXPORT | Dump the registry as reproducible DeQL |
