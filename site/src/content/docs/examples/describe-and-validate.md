---
title: "Describe and Validate"
description: "DeReg introspection — DESCRIBE, VALIDATE DEREG, and EXPORT DEREG for inspecting system definitions."
---

Demonstrates DeQL's introspection capabilities: inspecting individual definitions with DESCRIBE, checking system consistency with VALIDATE DEREG, and exporting the full system with EXPORT DEREG.

## Define a Small System

```deql
CREATE AGGREGATE Ticket;

CREATE COMMAND OpenTicket (
  ticket_id   STRING,
  reporter_id STRING,
  summary     STRING,
  priority    STRING
);

CREATE COMMAND CloseTicket (
  ticket_id   STRING,
  resolver_id STRING,
  resolution  STRING
);

CREATE EVENT TicketOpened (
  reporter_id STRING,
  summary     STRING,
  priority    STRING
);

CREATE EVENT TicketClosed (
  resolver_id STRING,
  resolution  STRING
);

CREATE DECISION OpenTicket
FOR Ticket
ON COMMAND OpenTicket
EMIT AS
  SELECT EVENT TicketOpened (
    reporter_id := :reporter_id,
    summary     := :summary,
    priority    := :priority
  );

CREATE DECISION CloseTicket
FOR Ticket
ON COMMAND CloseTicket
STATE AS
  SELECT
    LAST(event_type) AS current_status
  FROM DeReg."Ticket$Events"
  WHERE stream_id = :ticket_id
EMIT AS
  SELECT EVENT TicketClosed (
    resolver_id := :resolver_id,
    resolution  := :resolution
  )
  WHERE current_status = 'TicketOpened';

CREATE PROJECTION OpenTickets AS
SELECT
  stream_id AS ticket_id,
  LAST(data.reporter_id) AS reporter,
  LAST(data.summary) AS summary,
  LAST(data.priority) AS priority
FROM DeReg."Ticket$Events"
WHERE event_type = 'TicketOpened'
  AND stream_id NOT IN (
    SELECT stream_id FROM DeReg."Ticket$Events"
    WHERE event_type = 'TicketClosed'
  )
GROUP BY stream_id;
```

## DESCRIBE — Inspect Definitions

Inspect the aggregate:

```deql
DESCRIBE AGGREGATE Ticket;

  Aggregate:  Ticket
  Events:     TicketClosed, TicketOpened
  Decisions:  CloseTicket, OpenTicket
```

Inspect a command:

```deql
DESCRIBE COMMAND OpenTicket;

  Command:   OpenTicket
  Fields:
    ticket_id    STRING
    reporter_id  STRING
    summary      STRING
    priority     STRING
```

Inspect a decision — shows the full STATE AS, EMIT AS, and guard:

```deql
DESCRIBE DECISION CloseTicket;

  Decision:   CloseTicket
  Aggregate:  Ticket
  Command:    CloseTicket
  State:
    SELECT LAST(event_type) AS current_status
    FROM DeReg."Ticket$Events"
    WHERE stream_id = :ticket_id
  Emit:
    SELECT EVENT TicketClosed (
        resolver_id := :resolver_id
        resolution := :resolution
    )
  Guard:      current_status = 'TicketOpened'
```

Inspect a projection:

```deql
DESCRIBE PROJECTION OpenTickets;

  Projection:  OpenTickets
  Query:
    SELECT stream_id AS ticket_id,
      LAST(data.reporter_id) AS reporter,
      LAST(data.summary) AS summary,
      LAST(data.priority) AS priority
    FROM DeReg."Ticket$Events"
    WHERE event_type = 'TicketOpened'
      AND stream_id NOT IN (
        SELECT stream_id FROM DeReg."Ticket$Events"
        WHERE event_type = 'TicketClosed'
      )
    GROUP BY stream_id
```

## VALIDATE DEREG — Check Consistency

Verifies that all cross-references are consistent — every command has a decision, every event is referenced, every aggregate is used:

```deql
VALIDATE DEREG;

  DeReg validation passed — all cross-references are consistent.
```

## EXPORT DEREG — Dump Full System

Produces a complete, portable snapshot of every registered block:

```deql
EXPORT DEREG;

-- Aggregates
CREATE AGGREGATE Ticket;

-- Commands
CREATE COMMAND CloseTicket (
    ticket_id STRING,
    resolver_id STRING,
    resolution STRING
);

CREATE COMMAND OpenTicket (
    ticket_id STRING,
    reporter_id STRING,
    summary STRING,
    priority STRING
);

-- Events
CREATE EVENT TicketClosed (
    resolver_id STRING,
    resolution STRING
);

CREATE EVENT TicketOpened (
    reporter_id STRING,
    summary STRING,
    priority STRING
);

-- Decisions
CREATE DECISION CloseTicket
FOR Ticket
ON COMMAND CloseTicket
STATE AS
    SELECT LAST(event_type) AS current_status
    FROM DeReg."Ticket$Events"
    WHERE stream_id = :ticket_id
EMIT AS
    SELECT EVENT TicketClosed (
        resolver_id := :resolver_id,
        resolution := :resolution
    )
    WHERE current_status = 'TicketOpened';

CREATE DECISION OpenTicket
FOR Ticket
ON COMMAND OpenTicket
EMIT AS
    SELECT EVENT TicketOpened (
        reporter_id := :reporter_id,
        summary := :summary,
        priority := :priority
    );

-- Projections
CREATE PROJECTION OpenTickets AS
SELECT stream_id AS ticket_id,
  LAST(data.reporter_id) AS reporter,
  LAST(data.summary) AS summary,
  LAST(data.priority) AS priority
FROM DeReg."Ticket$Events"
WHERE event_type = 'TicketOpened'
  AND stream_id NOT IN (
    SELECT stream_id FROM DeReg."Ticket$Events"
    WHERE event_type = 'TicketClosed'
  )
GROUP BY stream_id;
```

## What This Demonstrates

- **DESCRIBE** for inspecting any registered block — aggregates, commands, decisions, projections
- **VALIDATE DEREG** for consistency checking across the entire system
- **EXPORT DEREG** for producing a portable, complete system snapshot
- **Introspection without execution** — understand the system before running anything
