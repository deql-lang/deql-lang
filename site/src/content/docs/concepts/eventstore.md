---
title: EVENTSTORE
description: Durable storage, partitioning, WAL, compaction, and encryption in DeQL.
---

An EventStore in DeQL declares the append‑only storage and operational characteristics for events. It is the only infrastructure‑level concept in the language — everything else expresses pure domain logic.

:::note
EventStore defines only the required storage semantics for DeQL events.
Specific implementations are free to introduce additional capabilities, optimizations, and operational features, as long as append-only immutability and replay guarantees are preserved.
:::


## Syntax

```deql
CREATE EVENTSTORE <Name>
WITH (
    <key> = <value>,
    ...
);
```

The `WITH` block is a flat key-value configuration organized into logical sections. All sections are optional except `durable.*` — you need at least one durable store.

## Minimal Example

The smoke test uses a minimal local-dev store with just the essentials:

```deql
CREATE EVENTSTORE local_dev WITH (
    envelope.event_id_key = 'event_id',
    durable.type = 'parquet',
    durable.path = '/tmp/deql/',
    strict.immutable_events = true
);
```

This is the simplest valid eventstore — an event ID key, a durable Parquet store, and immutability enforcement.

## Local Development Example

A slightly more complete local-dev store:

```deql
CREATE EVENTSTORE local_dev
WITH (
    envelope.event_id_key      = 'event_id',
    envelope.stream_type_key   = 'stream_type',
    envelope.stream_id_key     = 'stream_id',
    envelope.seq_key           = 'seq',
    envelope.event_type_key    = 'event_type',
    envelope.occurred_at_key   = 'occurred_at',
    envelope.payload_key       = 'data',

    id.event_id.format         = 'uuidv7',

    ordering.per_stream        = 'seq',

    durable.type               = 'parquet',
    durable.path               = 'file:///tmp/deql/events/',
    durable.compression        = 'snappy',

    partition.by               = ('dt','stream_type'),
    partition.dt.expr          = 'DATE(occurred_at)',

    strict.immutable_events    = true
);
```

## Full Reference Example

```deql
CREATE EVENTSTORE telecom_default
WITH (
    -- ============================================================
    -- 1) EVENT ENVELOPE / IDENTITY DEFAULTS
    -- ============================================================
    envelope.event_id_key        = 'event_id',
    envelope.stream_type_key     = 'stream_type',
    envelope.stream_id_key       = 'stream_id',
    envelope.seq_key             = 'seq',
    envelope.event_type_key      = 'event_type',
    envelope.event_version_key   = 'event_version',
    envelope.occurred_at_key     = 'occurred_at',
    envelope.ingested_at_key     = 'ingested_at',
    envelope.payload_key         = 'data',
    envelope.metadata_key        = 'metadata',
    envelope.command_id_key      = 'command_id',
    envelope.correlation_id_key  = 'correlation_id',
    envelope.causation_id_key    = 'causation_id',
    envelope.tenant_id_key       = 'tenant_id',

    -- Event ID strategy (recommend uuidv7 for time locality)
    id.event_id.format           = 'uuidv7',
    id.command_id.required       = true,
    id.command_id.unique_scope   = 'stream',
    id.correlation_id.optional   = true,

    -- Ordering rules (correctness)
    ordering.per_stream          = 'seq',
    ordering.global              = ('ingested_at','event_id'),

    -- ============================================================
    -- 2) DURABLE EVENT STORE (MANDATORY): PARQUET
    -- ============================================================
    durable.type                 = 'parquet',
    durable.path                 = 's3://deql/events/',
    durable.file_pattern         = 'dt={dt}/stream_type={stream_type}/part-{writer}-{file_seq}.parquet',
    durable.commit.protocol      = 'atomic_rename',
    durable.commit.manifest_path = 's3://deql/events/_manifests/',
    durable.compression          = 'zstd',
    durable.compression.level    = 3,
    durable.dictionary.enabled   = true,

    -- ============================================================
    -- 3) PARTITIONING (HIGHLY RECOMMENDED)
    -- ============================================================
    partition.by                 = ('dt','stream_type'),
    partition.dt.expr            = 'DATE(occurred_at)',
    partition.stream_type.expr   = 'stream_type',
    partition.tenant_id.expr     = 'tenant_id',
    partition.dt.granularity     = 'day',
    partition.enforce            = true,

    -- ============================================================
    -- 4) ROW GROUPS, SORTING, AND STATISTICS (PERFORMANCE)
    -- ============================================================
    row_group.target_mb          = 128,
    row_group.max_rows           = 1_000_000,
    row_group.sort_by            = ('stream_id','seq'),
    row_group.sort_order         = 'asc',
    stats.enabled                = true,
    stats.columns                = ('stream_id','seq','event_type','occurred_at'),
    bloom.enabled                = true,
    bloom.columns                = ('stream_id','event_id'),
    bloom.fpp                    = 0.01,

    -- ============================================================
    -- 5) HOT TIERS (OPTIONAL): IN-MEM + WAL
    -- ============================================================
    inmemory.enabled             = true,
    inmemory.max_mb              = 512,
    inmemory.ttl_seconds         = 60,
    inmemory.index_by            = ('stream_type','stream_id'),

    wal.enabled                  = true,
    wal.path                     = 'file:///var/lib/deql/wal/',
    wal.segment_pattern          = 'events-{yyyy}{MM}{dd}-{HH}-{segment}.wal',
    wal.rollover                 = 'size',
    wal.rollover_mb              = 256,
    wal.fsync                    = true,
    wal.checksum                 = 'crc32c',
    wal.retention_hours          = 24,

    -- ============================================================
    -- 6) COMPACTION / INGESTION PIPELINE (WAL → DURABLE)
    -- ============================================================
    compaction.enabled           = true,
    compaction.trigger           = ('size_mb','time'),
    compaction.min_segment_mb    = 64,
    compaction.max_file_mb       = 512,
    compaction.target_file_mb    = 256,
    compaction.max_open_files    = 32,
    compaction.schedule          = '*/5 * * * *',

    -- ============================================================
    -- 7) READ MERGE SEMANTICS (MULTI-TIER UNION)
    -- ============================================================
    read.tiers                   = ('inmemory','wal','durable'),
    read.merge.strategy          = 'union_dedupe_sort',
    read.dedupe.key              = ('stream_type','stream_id','seq'),
    read.require_monotonic_seq   = true,
    read.missing_seq.policy      = 'error',
    read.default_order           = ('stream_id','seq'),

    -- ============================================================
    -- 8) RETENTION / LIFECYCLE (OPTIONAL)
    -- ============================================================
    retention.enabled            = true,
    retention.durable_days       = 3650,
    retention.wal_hours          = 24,
    retention.inmemory_seconds   = 60,
    retention.delete_mode        = 'tombstone',

    -- ============================================================
    -- 9) SECURITY / ENCRYPTION (OPTIONAL HOOKS)
    -- ============================================================
    security.encrypt.at_rest     = true,
    security.kms.provider        = 'aws_kms',
    security.kms.key_id          = 'alias/deql-events',
    security.encrypt.in_transit  = true,

    -- ============================================================
    -- 10) PROJECTION HOOKS (RUNTIME POLICY)
    -- ============================================================
    projection.notify_on_commit  = true,
    projection.notify_on_inspect = false,
    projection.mode              = 'async',

    -- ============================================================
    -- 11) VALIDATION / STRICTNESS
    -- ============================================================
    strict.immutable_events      = true,
    strict.stream_type_enforced  = true,
    strict.event_version_required= true,
    strict.tenant_required       = false
);
```

## Configuration Sections

| Section | Required | Purpose |
|---|---|---|
| `envelope.*` | Yes | Names of the standard event envelope fields used by the runtime |
| `id.*` | Yes | Event ID format, command ID uniqueness, correlation/causation |
| `ordering.*` | Yes | Per-stream and global ordering rules for replay correctness |
| `durable.*` | Yes | Durable storage path, file pattern, commit protocol, compression |
| `partition.*` | Recommended | Partition columns, expressions, granularity, enforcement |
| `row_group.*` | Recommended | Row group sizing, sort order, statistics, bloom filters |
| `inmemory.*` | Optional | In-memory hot tier for instant read-after-write |
| `wal.*` | Optional | Write-ahead log for burst absorption before durable commit |
| `compaction.*` | Optional | WAL → durable ingestion pipeline scheduling |
| `read.*` | Optional | Multi-tier read merge strategy and deduplication |
| `retention.*` | Optional | Lifecycle rules for durable, WAL, and in-memory tiers |
| `security.*` | Optional | At-rest and in-transit encryption via KMS |
| `projection.*` | Optional | Projection notification policy on commit and inspect |
| `strict.*` | Optional | Immutability enforcement, stream type isolation, versioning |

## Storage Tiers 


```
┌──────────────┐     ┌──────────────┐     ┌──────────────────────┐
│  In-Memory   │────▶│     WAL      │────▶│   Durable Store      │
│  (hot, ~60s) │     │ (burst, ~24h)│     │  (permanent, years)  │
└──────────────┘     └──────────────┘     └──────────────────────┘
       ▲                    ▲                        ▲
       │                    │                        │
   instant R/W         fsync'd append         columnar, compressed
   index by stream     segment rollover       partitioned + sorted
```

Reads merge across all tiers using `read.merge.strategy = 'union_dedupe_sort'`, deduplicating by `(stream_type, stream_id, seq)` so the same event is never seen twice regardless of which tier it currently lives in.

## Durable Event Store

Events are stored as append-only files in the configured durable format (e.g., `parquet`, or any columnar format an implementation supports):

- Immutable — no UPDATE, no DELETE, no mutation
- Columnar — efficient compression and predicate pushdown
- Partitioned — by date and stream type for fast scans
- Sorted within row groups — by `(stream_id, seq)` for optimal aggregate rehydration
- Bloom-filtered — for point lookups on `stream_id` and `event_id`
- Analytics-ready — the same files can be queried by any compatible analytics engine
