# Digital Registry System — DeQL Demo

A government digital registry platform inspired by the [Daksha-RC](https://daksha-rc.github.io/daksha-rc-core/daksha-rc-registry.html) pattern. Registries manage entities (citizens, schools, facilities, vehicles, land parcels) through a standard lifecycle.

## The Registry Concept

Every registry entity — regardless of its domain — follows the same lifecycle:

```
Create → Active → Modify → Modified → Deactivate → Deactivated
```

A citizen has name/address/id_number fields. A school has name/district/capacity fields. A vehicle has plate_number/make/model fields. But they all go through the same state transitions with the same commands, events, and decisions.

This makes registries a natural fit for templates.

## The Template Story

The `RegistryEntity` template captures the lifecycle once:
- 1 aggregate, 3 commands, 3 events, 3 decisions = 10 definitions per entity type

Adding a new entity type to the system is a single `APPLY TEMPLATE` call:

```deql
APPLY TEMPLATE RegistryEntity WITH (
    EntityName = 'Citizen',
    Fields = (full_name STRING, date_of_birth STRING, address STRING, id_number STRING)
);
```

The demo starts with 3 registries (Citizen, School, HealthFacility), then shows how the system grows over time:
- 6 months later: Vehicle registry added (1 line)
- Later still: LandParcel registry added (1 line)

Final state: 5 registries, 50 definitions, all from 1 template.


## Concepts Covered

| Concept | What it does in this demo |
|---|---|
| TEMPLATE | `RegistryEntity` — lifecycle pattern with `{{Fields}}` and `{{FieldsAssignments}}` |
| APPLY TEMPLATE | 5 instantiations showing incremental system growth |
| {{Fields}} | Dynamic field declarations per entity type |
| {{FieldsAssignments}} | Auto-generated `:= :field` bindings in emit clauses |
| EXECUTE | Full lifecycle stories for citizens, schools, facilities, vehicles, land parcels |
| DESCRIBE TEMPLATE | Shows all 5 instances with their parameters |
| INSPECT | Simulated batch citizen creation |
| VALIDATE / EXPORT | Consistency check and reproducible output |
