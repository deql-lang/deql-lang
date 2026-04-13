# Registry System — DeQL Example

A complete example demonstrating how the DeQL `RegistryEntity` template implements the [Daksha-RC](https://daksha-rc.github.io/daksha-rc-core/daksha-rc-registry.html) registry pattern — managing entities through a finite lifecycle of create, invite, modify, deactivate, and delete.

## Domain

A government digital registry platform managing citizens, schools, and healthcare facilities. Each entity type shares the same lifecycle state machine but carries different domain-specific fields.

## Entity Lifecycle

```
None ──────► Active              (CreateEntity)
None ──────► Invited             (InviteEntity)
Invited ───► Active              (CreateEntity)
Active ────► Modified            (ModifyEntity)
Modified ──► Modified            (ModifyEntity)
Active ────► Deactivated         (DeactivateEntity)
Modified ──► Deactivated         (DeactivateEntity)
Active ────► MarkedForDeletion   (DeleteEntity)
Modified ──► MarkedForDeletion   (DeleteEntity)
```

## Files

| File | Description |
|---|---|
| `template.deql` | The reusable `RegistryEntity` template |
| `registries.deql` | Instantiations for Citizen, School, HealthFacility |
| `eventstore.deql` | Storage configuration |
| `inspect.deql` | Tests covering the full entity lifecycle |

## Running
