# Inventory Management System — DeQL Example

A complete end-to-end example demonstrating all DeQL concepts through an inventory management domain.

## Domain

A warehouse system that tracks products, handles stock movements, and supports order fulfillment.

## Files

| File | Concept | Description |
|---|---|---|
| `aggregates.deql` | AGGREGATE | Named state boundary (`Inventory`) |
| `events.deql` | EVENT | All domain events (7 event types) |
| `commands.deql` | COMMAND | All inbound intents (7 command types) |
| `decisions.deql` | DECISION | Business rules with STATE AS / EMIT AS |
| `projections.deql` | PROJECTION | Read models (StockLevels, MovementLog, PendingReorders) |
| `templates.deql` | TEMPLATE | Reusable SoftDeletable pattern |
| `eventstore.deql` | EVENTSTORE | Storage config (local dev + production) |
| `inspect.deql` | INSPECT | Tests and simulations |

## Running
