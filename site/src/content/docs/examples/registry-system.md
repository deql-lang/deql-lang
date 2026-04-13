---
title: "Registry System"
description: "A government digital registry platform — one template, unlimited entity types, each with its own schema but the same lifecycle."
---

A government digital registry platform where every entity type (citizens, schools, hospitals, vehicles, land parcels) follows the same lifecycle: Create → Modify → Deactivate. Each entity has different domain-specific fields, but the lifecycle pattern is identical. The `RegistryEntity` template captures this once — adding a new entity type is a single `APPLY TEMPLATE` call.

## The Template — RegistryEntity

The template takes two parameters: `EntityName` (the entity type) and `Fields` (domain-specific schema). Each `APPLY` generates 10 definitions:

```deql
CREATE TEMPLATE RegistryEntity (EntityName, Fields) AS (

    CREATE AGGREGATE {{EntityName}};

    CREATE COMMAND Create{{EntityName}} (
        entity_id  STRING,
        created_by STRING,
        {{Fields}}
    );

    CREATE COMMAND Modify{{EntityName}} (
        entity_id   STRING,
        modified_by STRING,
        {{Fields}}
    );

    CREATE COMMAND Deactivate{{EntityName}} (
        entity_id      STRING,
        deactivated_by STRING
    );

    CREATE EVENT {{EntityName}}Created (
        created_by STRING,
        {{Fields}}
    );

    CREATE EVENT {{EntityName}}Updated (
        modified_by STRING,
        {{Fields}}
    );

    CREATE EVENT {{EntityName}}Deactivated (
        deactivated_by STRING
    );

    CREATE DECISION Create{{EntityName}}Entity
    FOR {{EntityName}}
    ON COMMAND Create{{EntityName}}
    EMIT AS
        SELECT EVENT {{EntityName}}Created (
            created_by := :created_by,
            {{FieldsAssignments}}
        );

    CREATE DECISION Modify{{EntityName}}Entity
    FOR {{EntityName}}
    ON COMMAND Modify{{EntityName}}
    EMIT AS
        SELECT EVENT {{EntityName}}Updated (
            modified_by := :modified_by,
            {{FieldsAssignments}}
        );

    CREATE DECISION Deactivate{{EntityName}}Entity
    FOR {{EntityName}}
    ON COMMAND Deactivate{{EntityName}}
    EMIT AS
        SELECT EVENT {{EntityName}}Deactivated (
            deactivated_by := :deactivated_by
        );
);
```

Notice `{{Fields}}` and `{{FieldsAssignments}}` — the template expands domain-specific fields into both the command/event schemas and the `:=` bindings in decisions automatically.

## Apply — Three Registries from One Template

Each entity type has different fields but the same lifecycle:

```deql
APPLY TEMPLATE RegistryEntity WITH (
    EntityName = 'Citizen',
    Fields = (
        full_name     STRING,
        date_of_birth STRING,
        address       STRING,
        id_number     STRING
    )
);

APPLY TEMPLATE RegistryEntity WITH (
    EntityName = 'School',
    Fields = (
        school_name STRING,
        district    STRING,
        principal   STRING,
        capacity    INT
    )
);

APPLY TEMPLATE RegistryEntity WITH (
    EntityName = 'HealthFacility',
    Fields = (
        facility_name  STRING,
        facility_type  STRING,
        license_number STRING,
        district       STRING,
        bed_count      INT
    )
);
```

Three `APPLY` calls. 30 definitions. Each entity type gets its own aggregate, commands, events, and decisions — with its own schema.

## Run the Citizen Registry

```deql
EXECUTE CreateCitizen(entity_id := 'CIT-001', created_by := 'admin', full_name := 'Alice Smith',
    date_of_birth := '1990-05-15', address := '123 Main St', id_number := 'ID-001');

  ✓ CitizenCreated
    stream_id:     CIT-001
    seq:           1
    created_by:  admin
    full_name:  Alice Smith
    date_of_birth:  1990-05-15
    address:  123 Main St
    id_number:  ID-001

EXECUTE CreateCitizen(entity_id := 'CIT-002', created_by := 'admin', full_name := 'Bob Jones',
    date_of_birth := '1985-11-20', address := '456 Oak Ave', id_number := 'ID-002');

EXECUTE CreateCitizen(entity_id := 'CIT-003', created_by := 'registrar', full_name := 'Carol White',
    date_of_birth := '1978-03-10', address := '789 Pine Rd', id_number := 'ID-003');
```

Modify a citizen (address change after marriage):

```deql
EXECUTE ModifyCitizen(entity_id := 'CIT-001', modified_by := 'admin', full_name := 'Alice Smith-Johnson',
    date_of_birth := '1990-05-15', address := '999 New Blvd', id_number := 'ID-001');

  ✓ CitizenUpdated
    stream_id:     CIT-001
    seq:           2
    modified_by:  admin
    full_name:  Alice Smith-Johnson
    address:  999 New Blvd
```

Deactivate a citizen:

```deql
EXECUTE DeactivateCitizen(entity_id := 'CIT-003', deactivated_by := 'admin');

  ✓ CitizenDeactivated
    stream_id:     CIT-003
    seq:           2
    deactivated_by:  admin
```

## Run the School and Health Facility Registries

```deql
EXECUTE CreateSchool(entity_id := 'SCH-001', created_by := 'edu_admin',
    school_name := 'Springfield Elementary', district := 'Springfield',
    principal := 'Seymour Skinner', capacity := 500);

  ✓ SchoolCreated
    stream_id:     SCH-001
    seq:           1
    school_name:  Springfield Elementary
    district:  Springfield
    principal:  Seymour Skinner
    capacity:  500

EXECUTE CreateHealthFacility(entity_id := 'HF-001', created_by := 'health_admin',
    facility_name := 'City General Hospital', facility_type := 'hospital',
    license_number := 'LIC-2024-001', district := 'Central', bed_count := 300);

  ✓ HealthFacilityCreated
    stream_id:     HF-001
    seq:           1
    facility_name:  City General Hospital
    facility_type:  hospital
    bed_count:  300
```

## The Extensibility Story

Six months later, the government needs a Vehicle registry. No new code, no new decisions. Just one `APPLY`:

```deql
APPLY TEMPLATE RegistryEntity WITH (
    EntityName = 'Vehicle',
    Fields = (
        plate_number  STRING,
        make          STRING,
        model         STRING,
        year          INT,
        owner_id      STRING
    )
);

  Template 'RegistryEntity' expanded: 10 definitions generated
    (AGGREGATE Vehicle, COMMAND CreateVehicle, COMMAND ModifyVehicle, ...)
```

Immediately usable:

```deql
EXECUTE CreateVehicle(entity_id := 'VEH-001', created_by := 'transport_admin',
    plate_number := 'ABC-1234', make := 'Toyota', model := 'Hilux', year := 2023, owner_id := 'CIT-001');

  ✓ VehicleCreated
    stream_id:     VEH-001
    seq:           1
    plate_number:  ABC-1234
    make:  Toyota
    model:  Hilux
    year:  2023
    owner_id:  CIT-001
```

Transfer ownership:

```deql
EXECUTE ModifyVehicle(entity_id := 'VEH-001', modified_by := 'transport_admin',
    plate_number := 'ABC-1234', make := 'Toyota', model := 'Hilux', year := 2023, owner_id := 'CIT-002');

  ✓ VehicleUpdated
    stream_id:     VEH-001
    seq:           2
    owner_id:  CIT-002
```

And another — Land Parcel registry for the land department:

```deql
APPLY TEMPLATE RegistryEntity WITH (
    EntityName = 'LandParcel',
    Fields = (
        parcel_id    STRING,
        area_sqm     DECIMAL(12,2),
        land_use     STRING,
        district     STRING,
        owner_id     STRING
    )
);

EXECUTE CreateLandParcel(entity_id := 'LP-001', created_by := 'land_admin',
    parcel_id := 'P-2024-0001', area_sqm := 5000.00, land_use := 'residential',
    district := 'Central', owner_id := 'CIT-001');

  ✓ LandParcelCreated
    stream_id:     LP-001
    seq:           1
    parcel_id:  P-2024-0001
    area_sqm:  5000
    land_use:  residential
```

Final state: 5 registries, 50 definitions, all from 1 template.

## What This Demonstrates

- **Parameterized templates** with `{{Fields}}` — each entity type carries its own schema
- **`{{FieldsAssignments}}`** — auto-generated `:=` bindings from the Fields parameter
- **Additive extensibility** — new entity types are added without touching existing code
- **Consistent lifecycle** — every entity type gets Create, Modify, Deactivate with the same pattern
- **Scale** — 5 registries × 10 definitions each = 50 definitions from 5 `APPLY` calls
