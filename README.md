<p align="left">
  <img src="https://raw.githubusercontent.com/deql-lang/deql-lang/main/site/src/assets/deql-logo.svg" alt="DeQL Logo" width="200" />
</p>

# deql-lang

DeQL (Decision Query Language) is a declarative language for defining, executing, and inspecting business decisions over event‑sourced state, enabling progressively evolving and scalable CQRS‑ES systems.

DeQL (pronounced "deck‑el") is a declarative and dynamic language for building high‑performance CQRS and Event‑Sourced systems that can evolve gracefully with changing business needs.

DeQL focuses on enabling teams to express business decisions directly, with minimal boilerplate and infrastructure overhead. It provides a high‑level, composable model designed for rapid adoption, incremental refinement, and scalable execution.

***

## Quick Start

One template. One line. A fully operational event‑sourced system.

```sql
APPLY TEMPLATE wallet_aggregate
WITH (wallet_name = 'Main', currency = 'USD');
```

That single line expands into a fully functional system:

*   **Aggregate** — `MainWallet` with typed state (`wallet_id`, `currency`, `balance`)
*   **Commands** — `TopUpMain` and `DebitMain` expressing caller intent
*   **Events** — `MainWalletToppedUp` and `MainWalletDebited` as immutable facts
*   **Decisions** — `TopUpMain` (unconditional credit) and `DebitMain` (guarded: `WHERE balance >= :amount`)
*   **Default Projection** — `MainWalletBalance` read model auto‑generated with the same fields as the aggregate. Queryable immediately.

Send a command:

```sql
EXECUTE TopUpMain(wallet_id := 'wal-001', amount := 100.00);

  ✓ MainWalletToppedUp
    stream_id:     wal-001
    seq:           1
    amount:        100.00
    balance_after: 100.00
```

Query the projection:

```sql
SELECT * FROM DeReg."MainWalletBalance";
```

Inspect before you ship:

```sql
CREATE TABLE test_topups AS VALUES ('wal-001', 100.00);

INSPECT DECISION TopUpMain
FROM test_topups
INTO simulated_events;

SELECT stream_id, event_type, data FROM simulated_events;
```

Inspection runs in production or any environment without altering domain facts.

***

## Core Idea

A DeQL system is defined as a set of decisions.

Each decision:

*   observes state derived from events
*   evaluates intent expressed as commands
*   produces new events as factual outcomes

```
Commands represent intent.
Events represent facts.
Aggregates represent derived state.
Decisions define how reality changes.
```

***

## Concept Model

DeQL separates domain definitions from execution.

Declarative Concepts (non‑executable, reusable):

*   **AGGREGATE** — Defines a consistency boundary for event‑sourced state.
*   **COMMAND** — Describes external intent entering the system. Sent via `EXECUTE`.
*   **EVENT** — Represents immutable facts produced by decisions.
*   **PROJECTION** — Defines derived read models built from events.
*   **TEMPLATE** — Enables reusable, compile‑time domain patterns.
*   **EVENTSTORE** — Declares the physical storage for events.

Executable Concept:

*   **DECISION** — The central executable unit that binds commands, state, and business rules into a deterministic outcome.

All concepts are registered in the **DeReg** (Decision Registry). Use `DESCRIBE` to inspect any concept, `VALIDATE DEREG` for consistency checks, and `EXPORT DEREG` to dump the full system definition.

***

## Documentation

Full language specification hosted at: **[deql-lang.github.io/deql-lang/](https://deql-lang.github.io/deql-lang/)**

**Getting Started**

*   [Overview](https://deql-lang.github.io/deql-lang/overview/) — What DeQL is, core philosophy, how it works
*   [Two-Phase Model](https://deql-lang.github.io/deql-lang/two-phase-model/) — Definitions → Decision Assembly → EXECUTE
*   [Progressive Design](https://deql-lang.github.io/deql-lang/progressive-design/) — Start small, grow safely

**Language Reference**

*   [AGGREGATE](https://deql-lang.github.io/deql-lang/concepts/aggregate/) — State models, `$Agg` queries, cross-aggregate decisions
*   [COMMAND](https://deql-lang.github.io/deql-lang/concepts/command/) — External intent, field types, `EXECUTE` syntax
*   [EVENT](https://deql-lang.github.io/deql-lang/concepts/event/) — Immutable facts, event metadata, `$Events` queries
*   [DECISION](https://deql-lang.github.io/deql-lang/concepts/decision/) — STATE AS, EMIT AS, guards, multi-state queries
*   [PROJECTION](https://deql-lang.github.io/deql-lang/concepts/projection/) — Read models, aggregation, replay with offset and guards
*   [TEMPLATE](https://deql-lang.github.io/deql-lang/concepts/template/) — Reusable patterns: RegistryEntity, wallet_aggregate
*   [EVENTSTORE](https://deql-lang.github.io/deql-lang/concepts/eventstore/) — Durable storage, partitioning, WAL, compaction
*   [DESCRIBE](https://deql-lang.github.io/deql-lang/concepts/describe/) — Inspect definitions, VALIDATE DEREG, EXPORT DEREG
*   [Inspection](https://deql-lang.github.io/deql-lang/inspection/) — INSPECT DECISION, INSPECT PROJECTION, production replay

**Examples**

*   [Inventory System](https://deql-lang.github.io/deql-lang/examples/inventory-system/) — Warehouse management with stock movements
*   [Registry System](https://deql-lang.github.io/deql-lang/examples/registry-system/) — Daksha-RC entity lifecycle
*   [Telecom Wallet](https://deql-lang.github.io/deql-lang/examples/telecom-wallet/) — Multi-wallet system with balance guards

***

## Status

This project is currently focused on language design and documentation.

Primary areas of exploration include:

*   decision semantics
*   inspection and simulation
*   execution guarantees
*   progressive system evolution

Tooling and runtime implementations will follow.
