---
title: "Audit Trail"
description: "Multiple projections from the same event stream — timeline, per-user activity, document summary, and edit counts."
---

A minimal domain with four different projections, showing how the same event stream can power very different read models.

## Domain

A document management system where documents are created, edited, and published. The focus is on the projections, not the decisions.

## Define the System

```deql
CREATE AGGREGATE Document;

CREATE COMMAND CreateDocument (
  doc_id    STRING,
  author_id STRING,
  title     STRING
);

CREATE COMMAND EditDocument (
  doc_id    STRING,
  editor_id STRING,
  summary   STRING
);

CREATE COMMAND PublishDocument (
  doc_id       STRING,
  publisher_id STRING
);

CREATE EVENT DocumentCreated (
  author_id STRING,
  title     STRING
);

CREATE EVENT DocumentEdited (
  editor_id STRING,
  summary   STRING
);

CREATE EVENT DocumentPublished (
  publisher_id STRING
);
```

## Decisions (Unconditional)

All three decisions are unconditional — the focus of this example is on projections:

```deql
CREATE DECISION CreateDocument
FOR Document
ON COMMAND CreateDocument
EMIT AS
  SELECT EVENT DocumentCreated (
    author_id := :author_id,
    title     := :title
  );

CREATE DECISION EditDocument
FOR Document
ON COMMAND EditDocument
EMIT AS
  SELECT EVENT DocumentEdited (
    editor_id := :editor_id,
    summary   := :summary
  );

CREATE DECISION PublishDocument
FOR Document
ON COMMAND PublishDocument
EMIT AS
  SELECT EVENT DocumentPublished (
    publisher_id := :publisher_id
  );
```

## Four Projections, Same Events

**1. Full timeline** — every action on every document:

```deql
CREATE PROJECTION AuditTimeline AS
SELECT
  stream_id AS doc_id,
  seq,
  event_type AS action,
  occurred_at
FROM DeReg."Document$Events"
ORDER BY occurred_at, seq;
```

**2. Per-user activity** — what did each person do?

```deql
CREATE PROJECTION UserActivity AS
SELECT
  COALESCE(data.author_id, data.editor_id, data.publisher_id) AS user_id,
  stream_id AS doc_id,
  event_type AS action,
  occurred_at
FROM DeReg."Document$Events"
ORDER BY user_id, occurred_at;
```

**3. Document summary** — latest state of each document:

```deql
CREATE PROJECTION DocumentSummary AS
SELECT
  stream_id AS doc_id,
  LAST(data.title) AS title,
  LAST(data.author_id) AS author,
  COUNT(*) AS total_events,
  LAST(event_type) AS last_action
FROM DeReg."Document$Events"
GROUP BY stream_id;
```

**4. Edit count** per document:

```deql
CREATE PROJECTION EditCounts AS
SELECT
  stream_id AS doc_id,
  COUNT(*) AS edit_count
FROM DeReg."Document$Events"
WHERE event_type = 'DocumentEdited'
GROUP BY stream_id;
```

## Execute and Observe

```deql
EXECUTE CreateDocument(doc_id := 'DOC-001', author_id := 'USR-A', title := 'Architecture Overview');
EXECUTE EditDocument(doc_id := 'DOC-001', editor_id := 'USR-B', summary := 'Added diagrams');
EXECUTE EditDocument(doc_id := 'DOC-001', editor_id := 'USR-A', summary := 'Fixed typos');
EXECUTE PublishDocument(doc_id := 'DOC-001', publisher_id := 'USR-A');
EXECUTE CreateDocument(doc_id := 'DOC-002', author_id := 'USR-C', title := 'API Reference');
EXECUTE EditDocument(doc_id := 'DOC-002', editor_id := 'USR-C', summary := 'Initial draft');
```

## Query Projections

```deql
SELECT * FROM DeReg."AuditTimeline";

+---------+-----+-------------------+-----------------------------+
| doc_id  | seq | action            | occurred_at                 |
+---------+-----+-------------------+-----------------------------+
| DOC-001 | 1   | DocumentCreated   | 2026-04-13T12:32:23.416637Z |
| DOC-001 | 2   | DocumentEdited    | 2026-04-13T12:32:23.419556Z |
| DOC-001 | 3   | DocumentEdited    | 2026-04-13T12:32:23.421006Z |
| DOC-001 | 4   | DocumentPublished | 2026-04-13T12:32:23.421919Z |
| DOC-002 | 1   | DocumentCreated   | 2026-04-13T12:32:23.422821Z |
| DOC-002 | 2   | DocumentEdited    | 2026-04-13T12:32:23.424275Z |
+---------+-----+-------------------+-----------------------------+
```

```deql
SELECT * FROM DeReg."UserActivity";

+---------+---------+-------------------+-----------------------------+
| user_id | doc_id  | action            | occurred_at                 |
+---------+---------+-------------------+-----------------------------+
| USR-A   | DOC-001 | DocumentCreated   | 2026-04-13T12:32:23.416637Z |
| USR-A   | DOC-001 | DocumentEdited    | 2026-04-13T12:32:23.421006Z |
| USR-A   | DOC-001 | DocumentPublished | 2026-04-13T12:32:23.421919Z |
| USR-B   | DOC-001 | DocumentEdited    | 2026-04-13T12:32:23.419556Z |
| USR-C   | DOC-002 | DocumentCreated   | 2026-04-13T12:32:23.422821Z |
| USR-C   | DOC-002 | DocumentEdited    | 2026-04-13T12:32:23.424275Z |
+---------+---------+-------------------+-----------------------------+
```

```deql
SELECT * FROM DeReg."DocumentSummary";

+---------+-----------------------+--------+--------------+-------------------+
| doc_id  | title                 | author | total_events | last_action       |
+---------+-----------------------+--------+--------------+-------------------+
| DOC-002 | API Reference         | USR-C  | 2            | DocumentEdited    |
| DOC-001 | Architecture Overview | USR-A  | 4            | DocumentPublished |
+---------+-----------------------+--------+--------------+-------------------+
```

```deql
SELECT * FROM DeReg."EditCounts";

+---------+------------+
| doc_id  | edit_count |
+---------+------------+
| DOC-001 | 2          |
| DOC-002 | 1          |
+---------+------------+
```

## What This Demonstrates

- **Multiple projections** from a single event stream
- **Different aggregation strategies** — timeline, per-user, summary, filtered count
- **COALESCE** to unify different event field names into a single column
- **LAST()** for latest-state projections
- **WHERE filtering** for event-type-specific projections
