---
title: TEMPLATE
description: "Reusable patterns: EntityLifecycle, ApprovalWorkflow, RegistryEntity, and wallet_aggregate in DeQL."
---

A Template in DeQL is an encapsulation technique for reusable business patterns.
Templates capture common decision‑centric structures—such as aggregate shapes,
command–event flows, and lifecycle rules—and express them as parameterized,
compile‑time blueprints.

Templates allow these patterns to be defined once and instantiated explicitly
across different domain contexts, generating standard DeQL definitions that
remain fully inspectable, evolvable, and deterministic.


## Purpose

As systems mature, recurring business patterns emerge—approval rules,
state‑transition shapes, audit behaviors, and controlled lifecycles.
Templates encapsulate these patterns in a single place and allow them
to be reused without duplicating logic or introducing hidden behavior.

Templates preserve explicitness: each instantiation results in ordinary
DeQL constructs (aggregates, commands, events, and decisions) that can be
inspected, replayed, and evolved independently.

Templates are:

- **Encapsulating** — capture reusable business patterns without hiding semantics
- **Compile‑time only** — expanded at definition time; no runtime behavior
- **Parameterized** — accept identifiers, fields, and structural variations
- **Composable** — templates may reference other templates
- **Transparent** — expanded definitions are plain DeQL registered in DeReg


## Syntax

```deql
CREATE TEMPLATE <Name> (<Parameter>, ...) AS (
    <DeQL declarations using {{Parameter}} placeholders>
);
```

### Instantiation

```deql
USE TEMPLATE <Name> WITH (
    <Parameter> = <Value>,
    ...
);
```

## Example: Entity Lifecycle Template

A common pattern — entities that can be created and archived:

```deql
CREATE TEMPLATE EntityLifecycle (EntityName, Fields) AS (

    CREATE AGGREGATE {{EntityName}};

    CREATE COMMAND Create{{EntityName}} (
        id UUID,
        {{Fields}}
    );

    CREATE COMMAND Archive{{EntityName}} (
        id     UUID,
        reason STRING
    );

    CREATE EVENT {{EntityName}}Created (
        {{Fields}}
    );

    CREATE EVENT {{EntityName}}Archived (
        reason STRING
    );

    CREATE DECISION Create{{EntityName}}Record
    FOR {{EntityName}}
    ON COMMAND Create{{EntityName}}
    EMIT AS
        SELECT EVENT {{EntityName}}Created (
            {{FieldAssignments}}
        );

    CREATE DECISION Archive{{EntityName}}Record
    FOR {{EntityName}}
    ON COMMAND Archive{{EntityName}}
    STATE AS
        SELECT is_archived FROM DeReg.{{EntityName}}$Agg
        WHERE aggregate_id = :id
    EMIT AS
        SELECT EVENT {{EntityName}}Archived (
            reason := :reason
        )
        WHERE is_archived = FALSE;
);
```

### Using the Template

```deql
USE TEMPLATE EntityLifecycle WITH (
    EntityName = 'Product',
    Fields     = (
        name        STRING,
        description STRING,
        price       DECIMAL(10,2),
        category    STRING
    )
);

USE TEMPLATE EntityLifecycle WITH (
    EntityName = 'Customer',
    Fields     = (
        email     STRING,
        full_name STRING,
        tier      STRING
    )
);
```

After expansion, this produces fully standard `CREATE AGGREGATE`, `CREATE COMMAND`, `CREATE EVENT`, and `CREATE DECISION` declarations for both `Product` and `Customer`.

## Example: Approval Workflow Template

```deql
CREATE TEMPLATE ApprovalWorkflow (EntityName) AS (

    CREATE COMMAND Request{{EntityName}}Approval (
        entity_id    UUID,
        requested_by STRING
    );

    CREATE COMMAND Approve{{EntityName}} (
        entity_id   UUID,
        approved_by STRING,
        notes       STRING
    );

    CREATE COMMAND Reject{{EntityName}} (
        entity_id   UUID,
        rejected_by STRING,
        reason      STRING
    );

    CREATE EVENT {{EntityName}}ApprovalRequested (
        requested_by STRING
    );

    CREATE EVENT {{EntityName}}Approved (
        approved_by STRING,
        notes       STRING
    );

    CREATE EVENT {{EntityName}}Rejected (
        rejected_by STRING,
        reason      STRING
    );

    CREATE DECISION Handle{{EntityName}}Approval
    FOR {{EntityName}}
    ON COMMAND Approve{{EntityName}}
    STATE AS
        SELECT status FROM DeReg.{{EntityName}}$Agg
        WHERE aggregate_id = :entity_id
    EMIT AS
        SELECT EVENT {{EntityName}}Approved (
            approved_by := :approved_by,
            notes       := :notes
        )
        WHERE status = 'pending';
);
```

### Using It

```deql
USE TEMPLATE ApprovalWorkflow WITH (
    EntityName = 'Expense'
);

USE TEMPLATE ApprovalWorkflow WITH (
    EntityName = 'PurchaseOrder'
);
```

## Example: Registry Entity Template (Daksha-RC Pattern)

Digital registries like [Daksha-RC](https://daksha-rc.github.io/daksha-rc-core/daksha-rc-registry.html) manage entities (people, organizations, assets) through a finite set of lifecycle operations: create, modify, invite, deactivate, and delete. Every registry entity follows the same state machine regardless of its schema. This makes it a natural fit for a DeQL template.

The entity lifecycle states are:

```
None → Active       (via Create)
None → Invited      (via Invite)
Invited → Active    (via Create)
Active → Modified   (via Modify)
Modified → Modified (via Modify)
Active → Deactivated / Modified → Deactivated (via Deactivate)
Active → MarkedForDeletion / Modified → MarkedForDeletion (via Delete)
```

```deql
CREATE TEMPLATE RegistryEntity (EntityName, Fields) AS (

    -- =====================================================================
    -- Aggregate
    -- =====================================================================
    CREATE AGGREGATE {{EntityName}};

    -- =====================================================================
    -- Commands
    -- =====================================================================
    CREATE COMMAND Create{{EntityName}} (
        entity_id       UUID,
        definition_id   UUID,
        definition_ver  INT,
        entity_type     STRING,
        created_by      STRING,
        {{Fields}}
    );

    CREATE COMMAND Modify{{EntityName}} (
        entity_id       UUID,
        definition_ver  INT,
        modified_by     STRING,
        {{Fields}}
    );

    CREATE COMMAND Invite{{EntityName}} (
        entity_id       UUID,
        definition_id   UUID,
        definition_ver  INT,
        entity_type     STRING,
        invited_by      STRING,
        {{Fields}}
    );

    CREATE COMMAND Deactivate{{EntityName}} (
        entity_id       UUID,
        deactivated_by  STRING
    );

    CREATE COMMAND Delete{{EntityName}} (
        entity_id  UUID,
        deleted_by STRING
    );

    -- =====================================================================
    -- Events
    -- =====================================================================
    CREATE EVENT {{EntityName}}Created (
        definition_id   UUID,
        definition_ver  INT,
        entity_type     STRING,
        created_by      STRING,
        {{Fields}}
    );

    CREATE EVENT {{EntityName}}Invited (
        definition_id   UUID,
        definition_ver  INT,
        entity_type     STRING,
        invited_by      STRING,
        {{Fields}}
    );

    CREATE EVENT {{EntityName}}Updated (
        definition_ver  INT,
        modified_by     STRING,
        version         INT,
        {{Fields}}
    );

    CREATE EVENT {{EntityName}}Deactivated (
        deactivated_by STRING
    );

    CREATE EVENT {{EntityName}}Deleted (
        deleted_by STRING
    );

    -- =====================================================================
    -- Decisions
    -- =====================================================================

    -- Create: only when entity does not yet exist (status = 'None')
    CREATE DECISION Create{{EntityName}}Entity
    FOR {{EntityName}}
    ON COMMAND Create{{EntityName}}
    STATE AS
        SELECT status FROM DeReg.{{EntityName}}$Agg
        WHERE aggregate_id = :entity_id
    EMIT AS
        SELECT EVENT {{EntityName}}Created (
            definition_id  := :definition_id,
            definition_ver := :definition_ver,
            entity_type    := :entity_type,
            created_by     := :created_by,
            {{FieldAssignments}}
        )
        WHERE status IS NULL OR status = 'None' OR status = 'Invited';

    -- Invite: pre-activation workflow, only when entity does not exist
    CREATE DECISION Invite{{EntityName}}Entity
    FOR {{EntityName}}
    ON COMMAND Invite{{EntityName}}
    STATE AS
        SELECT status FROM DeReg.{{EntityName}}$Agg
        WHERE aggregate_id = :entity_id
    EMIT AS
        SELECT EVENT {{EntityName}}Invited (
            definition_id  := :definition_id,
            definition_ver := :definition_ver,
            entity_type    := :entity_type,
            invited_by     := :invited_by,
            {{FieldAssignments}}
        )
        WHERE status IS NULL OR status = 'None';

    -- Modify: only when Active or already Modified
    CREATE DECISION Modify{{EntityName}}Entity
    FOR {{EntityName}}
    ON COMMAND Modify{{EntityName}}
    STATE AS
        SELECT status, version FROM DeReg.{{EntityName}}$Agg
        WHERE aggregate_id = :entity_id
    EMIT AS
        SELECT EVENT {{EntityName}}Updated (
            definition_ver := :definition_ver,
            modified_by    := :modified_by,
            version        := version + 1,
            {{FieldAssignments}}
        )
        WHERE status IN ('Active', 'Modified');

    -- Deactivate: only when Active or Modified
    CREATE DECISION Deactivate{{EntityName}}Entity
    FOR {{EntityName}}
    ON COMMAND Deactivate{{EntityName}}
    STATE AS
        SELECT status FROM DeReg.{{EntityName}}$Agg
        WHERE aggregate_id = :entity_id
    EMIT AS
        SELECT EVENT {{EntityName}}Deactivated (
            deactivated_by := :deactivated_by
        )
        WHERE status IN ('Active', 'Modified');

    -- Delete (soft): only when Active or Modified
    CREATE DECISION Delete{{EntityName}}Entity
    FOR {{EntityName}}
    ON COMMAND Delete{{EntityName}}
    STATE AS
        SELECT status FROM DeReg.{{EntityName}}$Agg
        WHERE aggregate_id = :entity_id
    EMIT AS
        SELECT EVENT {{EntityName}}Deleted (
            deleted_by := :deleted_by
        )
        WHERE status IN ('Active', 'Modified');

    -- =====================================================================
    -- Default Projection: Entity Registry (auto-generated, mirrors aggregate lifecycle)
    -- =====================================================================
    CREATE PROJECTION {{EntityName}}Registry AS
    SELECT
        aggregate_id AS entity_id,
        LAST(data.entity_type) AS entity_type,
        LAST(data.definition_id) AS definition_id,
        LAST(CASE
            WHEN event_type = '{{EntityName}}Created'     THEN 'Active'
            WHEN event_type = '{{EntityName}}Invited'      THEN 'Invited'
            WHEN event_type = '{{EntityName}}Updated'      THEN 'Modified'
            WHEN event_type = '{{EntityName}}Deactivated'  THEN 'Deactivated'
            WHEN event_type = '{{EntityName}}Deleted'      THEN 'MarkedForDeletion'
        END) AS status,
        MAX(CASE WHEN event_type = '{{EntityName}}Updated' THEN data.version ELSE 1 END) AS version,
        MIN(timestamp) AS created_at,
        MAX(timestamp) AS last_modified_at
    FROM DeReg.{{EntityName}}$Events
    GROUP BY aggregate_id;
);
```

### Using the Registry Entity Template

Instantiate it for any domain — each call produces a complete aggregate, commands, events, decisions, and a read-model projection:

```deql
-- Citizen registry
USE TEMPLATE RegistryEntity WITH (
    EntityName = 'Citizen',
    Fields     = (
        full_name    STRING,
        date_of_birth STRING,
        address      STRING,
        id_number    STRING
    )
);

-- School registry
USE TEMPLATE RegistryEntity WITH (
    EntityName = 'School',
    Fields     = (
        name         STRING,
        district     STRING,
        principal    STRING,
        capacity     INT
    )
);

-- Healthcare facility registry
USE TEMPLATE RegistryEntity WITH (
    EntityName = 'HealthFacility',
    Fields     = (
        name           STRING,
        facility_type  STRING,
        license_number STRING,
        district       STRING,
        bed_count      INT
    )
);
```

After expansion, `USE TEMPLATE RegistryEntity WITH (EntityName = 'Citizen', ...)` produces:

- `CREATE AGGREGATE Citizen`
- Commands: `CreateCitizen`, `ModifyCitizen`, `InviteCitizen`, `DeactivateCitizen`, `DeleteCitizen`
- Events: `CitizenCreated`, `CitizenInvited`, `CitizenUpdated`, `CitizenDeactivated`, `CitizenDeleted`
- Decisions with state-machine guards enforcing the lifecycle
- `CREATE PROJECTION CitizenRegistry` as the read model

### Inspecting a Registry Entity

```deql
-- Test the citizen creation flow
CREATE TABLE test_create_citizens AS
VALUES
    (gen_random_uuid(), gen_random_uuid(), 1, 'citizen', 'admin',
     'Alice Smith', '1990-05-15', '123 Main St', 'ID-001'),
    (gen_random_uuid(), gen_random_uuid(), 1, 'citizen', 'admin',
     'Bob Jones', '1985-11-20', '456 Oak Ave', 'ID-002');

INSPECT DECISION CreateCitizenEntity
FROM test_create_citizens
INTO simulated_citizen_events;

-- Verify the registry projection
INSPECT PROJECTION CitizenRegistry
FROM simulated_citizen_events
INTO simulated_citizen_registry;

SELECT entity_id, entity_type, status, version
FROM simulated_citizen_registry;
```

## Example: Telecom Wallet Template

Telecom systems manage multiple wallet types per subscriber — main balance, promotional credits, roaming allowances, corporate pools. Each wallet follows the same top-up/debit pattern but carries different business context. The `wallet_aggregate` template captures this pattern once.

This example also demonstrates additional syntax features:

- `CREATE TEMPLATE ... WITH (params)` for declaring template parameters
- `CREATE AGGREGATE` with inline state fields and `KEY` constraints
- `APPLY TEMPLATE` as an alternative to `USE TEMPLATE` for instantiation
- Shorthand `AS` in place of `EMIT AS` within decisions

```deql
CREATE TEMPLATE wallet_aggregate
WITH (
    wallet_name STRING,
    currency    STRING
)
AS

    CREATE AGGREGATE {{wallet_name}}Wallet (
        wallet_id UUID         KEY,
        currency  STRING,
        balance   DECIMAL(12,2)
    );

    CREATE COMMAND TopUp{{wallet_name}} (
        wallet_id UUID,
        amount    DECIMAL(12,2)
    );

    CREATE COMMAND Debit{{wallet_name}} (
        wallet_id UUID,
        amount    DECIMAL(12,2),
        reason    STRING
    );

    CREATE EVENT {{wallet_name}}WalletToppedUp (
        amount        DECIMAL(12,2),
        balance_after DECIMAL(12,2)
    );

    CREATE EVENT {{wallet_name}}WalletDebited (
        amount        DECIMAL(12,2),
        balance_after DECIMAL(12,2),
        reason        STRING
    );

    CREATE DECISION TopUp{{wallet_name}}
    FOR {{wallet_name}}Wallet
    ON COMMAND TopUp{{wallet_name}}
    STATE AS
        SELECT balance FROM DeReg.{{wallet_name}}Wallet$Agg
        WHERE aggregate_id = :wallet_id
    AS
        SELECT EVENT {{wallet_name}}WalletToppedUp (
            amount        := :amount,
            balance_after := balance + :amount
        );

    CREATE DECISION Debit{{wallet_name}}
    FOR {{wallet_name}}Wallet
    ON COMMAND Debit{{wallet_name}}
    STATE AS
        SELECT balance FROM DeReg.{{wallet_name}}Wallet$Agg
        WHERE aggregate_id = :wallet_id
    AS
        SELECT EVENT {{wallet_name}}WalletDebited (
            amount        := :amount,
            balance_after := balance - :amount,
            reason        := :reason
        )
        WHERE balance >= :amount;

    -- =====================================================================
    -- Default Projection (auto-generated, mirrors aggregate state)
    -- =====================================================================
    CREATE PROJECTION {{wallet_name}}WalletBalance AS
    SELECT
        aggregate_id AS wallet_id,
        '{{currency}}' AS currency,
        LAST(data.balance_after) AS balance
    FROM DeReg.{{wallet_name}}Wallet$Events
    WHERE event_type IN ('{{wallet_name}}WalletToppedUp', '{{wallet_name}}WalletDebited')
    GROUP BY aggregate_id;
```

Templates auto-generate a default projection whose fields mirror the aggregate's state. No separate `CREATE PROJECTION` is needed — applying the template gives you a queryable read model out of the box.

### Instantiating Wallets

A single telecom subscriber might have four wallets. Each `APPLY TEMPLATE` call produces a complete aggregate, commands, events, and guarded decisions:

```deql
-- Primary balance wallet
APPLY TEMPLATE wallet_aggregate
WITH (wallet_name = 'Main', currency = 'USD');

-- Promotional credits (bonus top-ups, campaigns)
APPLY TEMPLATE wallet_aggregate
WITH (wallet_name = 'Promo', currency = 'USD');

-- Roaming allowance
APPLY TEMPLATE wallet_aggregate
WITH (wallet_name = 'Roaming', currency = 'USD');

-- Shared corporate pool
APPLY TEMPLATE wallet_aggregate
WITH (wallet_name = 'CorporatePool', currency = 'USD');
```

After expansion, `APPLY TEMPLATE wallet_aggregate WITH (wallet_name = 'Main', ...)` produces:

- `CREATE AGGREGATE MainWallet (wallet_id UUID KEY, currency STRING, balance DECIMAL(12,2))`
- Commands: `TopUpMain`, `DebitMain`
- Events: `MainWalletToppedUp`, `MainWalletDebited`
- Decisions: `TopUpMain` (unconditional), `DebitMain` (guarded by `balance >= :amount`)
- Projection: `MainWalletBalance` — default read model mirroring the aggregate state (`wallet_id`, `currency`, `balance`), queryable immediately with no extra setup

### Inspecting Wallets

```deql
-- Test top-up
CREATE TABLE test_topups AS
VALUES
    ('wal-001'::UUID, 50.00),
    ('wal-002'::UUID, 100.00);

INSPECT DECISION TopUpMain
FROM test_topups
INTO simulated_topup_events;

SELECT * FROM simulated_topup_events;

-- Test debit with insufficient balance guard
CREATE TABLE test_debits AS
VALUES
    ('wal-001'::UUID, 30.00, 'data_pack'),
    ('wal-001'::UUID, 999.00, 'overdraft_attempt');  -- should be rejected

INSPECT DECISION DebitMain
FROM test_debits
INTO simulated_debit_events;

-- First should succeed, second should be empty (balance < amount)
SELECT * FROM simulated_debit_events;
```

### Syntax Notes

| Syntax | Meaning |
|---|---|
| `CREATE TEMPLATE ... WITH (params)` | Declares template with typed parameters |
| `CREATE AGGREGATE Name (fields)` | Aggregate with inline state schema and `KEY` |
| `AS SELECT EVENT ...` | Shorthand for `EMIT AS SELECT EVENT ...` |
| `APPLY TEMPLATE ... WITH (...)` | Instantiate a template (equivalent to `USE TEMPLATE`) |

## Key Properties

| Property | Description |
|---|---|
| Compile-time expansion | No runtime cost or indirection |
| Parameterized | Accept types, fields, and constraints |
| Transparent | Expanded result is plain DeQL |
| Composable | Templates can use other templates |
