---
title: Admin Login App REST API Example
sidebar_label: Admin Login REST API
sidebar_position: 2
---

This document demonstrates sample data based on the deql  deql-lang/examples/admin-login-app/admin-login-demo.deql

## Health Check API
```bash
/api/health
```
```json
{"status":"ok"}
```
## Info
```
/api/info
```
```json
{"concept_counts":{"aggregates":1,"commands":3,"decisions":3,"events":4,"eventstores":0,"projections":2,"templates":0},"readonly":false,"version":"0.1.0"}
```
## Metadata queries
### Group commands
#### Aggregates
```
/api/dereg/aggregates
```
| row | name         |
|-----|--------------|
| 0   | AdminAccount |
#### Commands
```
/api/dereg/commands
```
| row | name             | field_count | aggregate      |
|-----|------------------|-------------|----------------|
| 0   | BootstrapAdmin   | 3           | AdminAccount  |
| 1   | ChangePassword   | 3           | AdminAccount  |
| 2   | LoginAdmin       | 2           | AdminAccount  |

 
#### events
```
/api/dereg/events
```
 
| row | name                | field_count  | aggregate     |
|-----|---------------------|-------------|---------------|
| 0   | AdminBootstrapped   | 2           | AdminAccount |
| 1   | AdminLoginFailed    | 2           | AdminAccount |
| 2   | AdminLoginSucceeded | 2           | AdminAccount |
| 3   | PasswordChanged     | 1           | AdminAccount |
 
#### Decisions

```
/api/dereg/decisions
```
| row | name                     | aggregate     | command          | has_guard | emitted_events                               | guard_sql                                                                                                   | state_as_sql                                                                                                                                                                                                 |
|-----|--------------------------|---------------|------------------|-----------|-----------------------------------------------|--------------------------------------------------------------------------------------------------------------|--------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| 0   | BootstrapAdminDecision   | AdminAccount  | BootstrapAdmin  | true      | AdminBootstrapped                             | existing_flag IS NULL                                                                                        | ```sql SELECT 1 AS existing_flag FROM DeReg."AdminAccount$Events" WHERE stream_id = :user_id AND event_type = 'AdminBootstrapped' LIMIT 1 ``` |
| 1   | ChangePasswordDecision   | AdminAccount  | ChangePassword  | true      | PasswordChanged                               | encode(digest(:old_password,'sha256'),'hex') = current_hash AND encode(digest(:new_password,'sha256'),'hex') <> current_hash | ```sql SELECT COALESCE(LAST(CASE WHEN event_type = 'PasswordChanged' THEN data.new_password_hash END), LAST(CASE WHEN event_type = 'AdminBootstrapped' THEN data.password_hash END)) AS current_hash FROM DeReg."AdminAccount$Events" WHERE stream_id = :user_id ``` |
| 2   | LoginAdminDecision       | AdminAccount  | LoginAdmin      | true      | AdminLoginSucceeded, AdminLoginFailed         | None                                                                                                         | ```sql SELECT COALESCE(LAST(CASE WHEN event_type = 'PasswordChanged' THEN data.new_password_hash END), LAST(CASE WHEN event_type = 'AdminBootstrapped' THEN data.password_hash END)) AS current_hash FROM DeReg."AdminAccount$Events" WHERE stream_id = :user_id ```|


#### Projections
```
/api/dereg/projections
```

| row | name               | query_sql |
|-----|--------------------|-----------|
| 0   | FailedLoginReport  | ```sql SELECT stream_id AS user_id, seq, data.attempted_at AS attempted_at, data.reason AS reason FROM DeReg."AdminAccount$Events" WHERE event_type = 'AdminLoginFailed' ORDER BY stream_id, seq ``` |
| 1   | LoginMetrics       | ```sql SELECT stream_id AS user_id, COUNT(*) FILTER (WHERE event_type = 'AdminLoginSucceeded') AS success_count, COUNT(*) FILTER (WHERE event_type = 'AdminLoginFailed') AS failure_count, LAST(CASE WHEN event_type = 'AdminLoginSucceeded' THEN data.login_at END) AS last_login_at, LAST(CASE WHEN event_type = 'AdminLoginFailed' THEN data.attempted_at END) AS last_failure_at FROM DeReg."AdminAccount$Events" GROUP BY stream_id ``` |

#### Templates
```
/api/dereg/templates
```
```
Empty DataFrame
Columns: [name, param_count]
Index: []
```

#### Event stores

```
/api/dereg/eventstores
```
```
Empty DataFrame
Columns: [name]
Index: []
```

## Single-Definition Lookups

### Aggregate by name
```
/api/dereg/aggregates/AdminAccount
```
| row | name          |
|-----|---------------|
| 0   | AdminAccount  |

### Commands by name
```
/api/dereg/commands/LoginAdmin
```
| row | name       | field_count | aggregate     |
|-----|------------|------------|---------------|
| 0   | LoginAdmin | 2          | AdminAccount  |

### Decisions by name
```
/api/dereg/decisions/LoginAdminDecision
```
| row | name               | aggregate     | command    | has_guard | emitted_events                         | guard_sql | state_as_sql |
|-----|--------------------|---------------|------------|-----------|----------------------------------------|-----------|--------------|
| 0   | LoginAdminDecision | AdminAccount  | LoginAdmin | True      | AdminLoginSucceeded, AdminLoginFailed  | None      | SELECT COALESCE(LAST(CASE WHEN event_type = 'PasswordChanged' THEN data.new_password_hash END), LAST(CASE WHEN event_type = 'AdminBootstrapped' THEN data.password_hash END)) AS current_hash FROM DeReg."AdminAccount$Events" WHERE stream_id = :user_id |

### Projections by name
```
/api/dereg/projections/LoginMetrics
```
| row | name          | query_sql |
|-----|---------------|-----------|
| 0   | LoginMetrics  | ```sql SELECT stream_id AS user_id, COUNT(*) FILTER (WHERE event_type = 'AdminLoginSucceeded') AS success_count, COUNT(*) FILTER (WHERE event_type = 'AdminLoginFailed') AS failure_count, LAST(CASE WHEN event_type = 'AdminLoginSucceeded' THEN data.login_at END) AS last_login_at, LAST(CASE WHEN event_type = 'AdminLoginFailed' THEN data.attempted_at END) AS last_failure_at FROM DeReg."AdminAccount$Events" GROUP BY stream_id ``` |

## Detail Endpoints

### Aggregate fields by aggregte name
```
/api/dereg/aggregates/AdminAccount/fields
```
```
Empty DataFrame
Columns: []
Index: []
```
### Command fields by command name
```
/api/dereg/commands/LoginAdmin/fields
```
| row | command_name | field_name | field_type | is_key | ordinal |
|-----|--------------|------------|------------|--------|---------|
| 0   | LoginAdmin   | user_id    | STRING     | False  | 0       |
| 1   | LoginAdmin   | password   | STRING     | False  | 1       |

```
/api/dereg/commands/BootstrapAdmin/fields
```
| row | command_name    | field_name     | field_type | is_key | ordinal |
|-----|-----------------|----------------|------------|--------|---------|
| 0   | BootstrapAdmin  | user_id        | STRING     | False  | 0       |
| 1   | BootstrapAdmin  | username       | STRING     | False  | 1       |
| 2   | BootstrapAdmin  | password_hash  | STRING     | False  | 2       |

```
/api/dereg/commands/ChangePassword/fields
```

| row | command_name   | field_name    | field_type | is_key | ordinal |
|-----|----------------|---------------|------------|--------|---------|
| 0   | ChangePassword | user_id       | STRING     | False  | 0       |
| 1   | ChangePassword | old_password  | STRING     | False  | 1       |
| 2   | ChangePassword | new_password  | STRING     | False  | 2       |

### Events by decison name
```
/api/dereg/decisions/BootstrapAdminDecision/emits
```
| row | decision_name             | event_name         |
|-----|---------------------------|--------------------|
| 0   | BootstrapAdminDecision    | AdminBootstrapped |

```
/api/dereg/decisions/LoginAdminDecision/emits
```
| row | decision_name        | event_name            |
|-----|----------------------|-----------------------|
| 0   | LoginAdminDecision   | AdminLoginSucceeded  |
| 1   | LoginAdminDecision   | AdminLoginFailed     |

```
/api/dereg/decisions/ChangePasswordDecision/emits
```
| row | decision_name            | event_name       |
|-----|--------------------------|------------------|
| 0   | ChangePasswordDecision   | PasswordChanged |

## Data APIS

### Re-Hydrated events in an aggregate
```
/api/aggregates/AdminAccount
```
| row | aggregate_id | attempted_at               | login_at                  | new_password_hash                                                    | password_hash                                                     | reason               | session_token | username |
|-----|--------------|----------------------------|---------------------------|-----------------------------------------------------------------------|-------------------------------------------------------------------|----------------------|---------------|----------|
| 0   | ADMIN-999    | 2026-04-23T04:34:13.932324 | None                      | None                                                                  | None                                                              | account_not_found    | None          | None     |
| 1   | ADMIN-001    | 2026-04-23T04:34:14.006832 | 2026-04-23T04:34:13.980024 | d4e276b8043bc4592cf7ec3b4120e2801f14fd0bc42c704a79d4e48acf3f5e4d        | 1ec1c26b50d5d3c58d9583181af8076655fe00756bf7285940ba3670f99fcba0    | invalid_password     | None          | alice    |

### Re-Hydrated events in an aggregate by aggregate id
```
/api/aggregates/AdminAccount/ADMIN-001
```
| row | aggregate_id | attempted_at               | login_at                  | new_password_hash                                                    | password_hash                                                     | reason            | session_token | username |
|-----|--------------|----------------------------|---------------------------|-----------------------------------------------------------------------|-------------------------------------------------------------------|-------------------|---------------|----------|
| 0   | ADMIN-001    | 2026-04-23T04:34:14.006832 | 2026-04-23T04:34:13.980024 | d4e276b8043bc4592cf7ec3b4120e2801f14fd0bc42c704a79d4e48acf3f5e4d        | 1ec1c26b50d5d3c58d9583181af8076655fe00756bf7285940ba3670f99fcba0    | invalid_password  | None          | alice    |

### List all events in the Aggregate
```
/api/aggregates/AdminAccount/events
```
| row | event_id | stream_type  | stream_id | seq | event_type            | occurred_at                     | data |
|-----|----------|--------------|-----------|-----|-----------------------|----------------------------------|------|
| 0   | 1        | AdminAccount | ADMIN-001 | 1   | AdminBootstrapped     | 2026-04-23 04:34:13.863002+00:00 | {"attempted_at": null, "login_at": null, "new_password_hash": null, "password_hash": "1ec1c26b50d5d3c58d9583181af8076655fe00756bf7285940ba3670f99fcba0", "reason": null, "session_token": null, "username": "alice"} |
| 1   | 2        | AdminAccount | ADMIN-001 | 2   | AdminLoginFailed      | 2026-04-23 04:34:13.908317+00:00 | {"attempted_at": "2026-04-23T04:34:13.906731", "login_at": null, "new_password_hash": null, "password_hash": null, "reason": "invalid_password", "session_token": null, "username": null} |
| 2   | 3        | AdminAccount | ADMIN-999 | 1   | AdminLoginFailed      | 2026-04-23 04:34:13.933797+00:00 | {"attempted_at": "2026-04-23T04:34:13.932324", "login_at": null, "new_password_hash": null, "password_hash": null, "reason": "account_not_found", "session_token": null, "username": null} |
| 3   | 4        | AdminAccount | ADMIN-001 | 3   | PasswordChanged       | 2026-04-23 04:34:13.957300+00:00 | {"attempted_at": null, "login_at": null, "new_password_hash": "d4e276b8043bc4592cf7ec3b4120e2801f14fd0bc42c704a79d4e48acf3f5e4d", "password_hash": null, "reason": null, "session_token": null, "username": null} |
| 4   | 5        | AdminAccount | ADMIN-001 | 4   | AdminLoginSucceeded  | 2026-04-23 04:34:13.983364+00:00 | {"attempted_at": null, "login_at": "2026-04-23T04:34:13.980024", "new_password_hash": null, "password_hash": null, "reason": null, "session_token": null, "username": null} |
| 5   | 6        | AdminAccount | ADMIN-001 | 5   | AdminLoginFailed      | 2026-04-23 04:34:14.008298+00:00 | {"attempted_at": "2026-04-23T04:34:14.006832", "login_at": null, "new_password_hash": null, "password_hash": null, "reason": "invalid_password", "session_token": null, "username": null} |

### List events in an aggregate by stream id
```
/api/aggregates/AdminAccount/events/ADMIN-001
```
| row | event_id | stream_type  | stream_id | seq | event_type            | occurred_at                     | data |
|-----|----------|--------------|-----------|-----|-----------------------|----------------------------------|------|
| 0   | 1        | AdminAccount | ADMIN-001 | 1   | AdminBootstrapped     | 2026-04-23 04:34:13.863002+00:00 | {"attempted_at": null, "login_at": null, "new_password_hash": null, "password_hash": "1ec1c26b50d5d3c58d9583181af8076655fe00756bf7285940ba3670f99fcba0", "reason": null, "session_token": null, "username": "alice"} |
| 1   | 2        | AdminAccount | ADMIN-001 | 2   | AdminLoginFailed      | 2026-04-23 04:34:13.908317+00:00 | {"attempted_at": "2026-04-23T04:34:13.906731", "login_at": null, "new_password_hash": null, "password_hash": null, "reason": "invalid_password", "session_token": null, "username": null} |
| 2   | 4        | AdminAccount | ADMIN-001 | 3   | PasswordChanged       | 2026-04-23 04:34:13.957300+00:00 | {"attempted_at": null, "login_at": null, "new_password_hash": "d4e276b8043bc4592cf7ec3b4120e2801f14fd0bc42c704a79d4e48acf3f5e4d", "password_hash": null, "reason": null, "session_token": null, "username": null} |
| 3   | 5        | AdminAccount | ADMIN-001 | 4   | AdminLoginSucceeded  | 2026-04-23 04:34:13.983364+00:00 | {"attempted_at": null, "login_at": "2026-04-23T04:34:13.980024", "new_password_hash": null, "password_hash": null, "reason": null, "session_token": null, "username": null} |
| 4   | 6        | AdminAccount | ADMIN-001 | 5   | AdminLoginFailed      | 2026-04-23 04:34:14.008298+00:00 | {"attempted_at": "2026-04-23T04:34:14.006832", "login_at": null, "new_password_hash": null, "password_hash": null, "reason": "invalid_password", "session_token": null, "username": null} |

## Inspections
### Inspect decision input table by name
```
/api/aggregates/AdminAccount/inspect/input/test_logins
```
| row | column1   | column2  |
|-----|-----------|----------|
| 0   | ADMIN-001 | N3wP@ss! |
| 1   | ADMIN-001 | wrong    |
| 2   | ADMIN-999 | anything |

### Inspect decision output table by name
```
/api/aggregates/AdminAccount/inspect/output/simulated_login_events
```
| row | event_id                                   | stream_type  | stream_id | seq | event_type           | occurred_at                     | data |
|-----|--------------------------------------------|--------------|-----------|-----|----------------------|----------------------------------|------|
| 0   | 019db89d-f9b9-7512-8297-e3f9d3a6b233         | AdminAccount | ADMIN-001 | 1   | AdminLoginSucceeded  | 2026-04-23 04:34:14.073096+00:00 | {"attempted_at": null, "login_at": "2026-04-23T04:34:14.071490", "reason": null, "session_token": "6cccf00982d094b7761381c021788822b22d4cea2c5378bbdf8d60f224005c6b"} |
| 1   | 019db89d-f9d4-7762-a8d0-cb7b1be08ee7         | AdminAccount | ADMIN-001 | 2   | AdminLoginFailed     | 2026-04-23 04:34:14.100901+00:00 | {"attempted_at": "2026-04-23T04:34:14.099677", "login_at": null, "reason": "invalid_password", "session_token": null} |
| 2   | 019db89d-f9ee-7ee2-b67c-e9aada3c907e         | AdminAccount | ADMIN-999 | 1   | AdminLoginFailed     | 2026-04-23 04:34:14.126643+00:00 | {"attempted_at": "2026-04-23T04:34:14.124955", "login_at": null, "reason": "account_not_found", "session_token": null} |

### Inspect decision output branches table by name 
```
/api/aggregates/AdminAccount/inspect/output/simulated_login_events__branches
```
| row | inspect_row_index | decision_name       | branch_id           | branch_index | branch_rule_name   | branch_guard                                                                                                  | branch_status | event_type           | stream_id |
|-----|-------------------|---------------------|---------------------|--------------|--------------------|---------------------------------------------------------------------------------------------------------------|--------------|----------------------|----------|
| 0   | 0                 | LoginAdminDecision  | b_e05bcdb22827fa2e  | 1            | PasswordMatch      | current_hash IS NOT NULL AND encode(digest(:password,'sha256'),'hex') = current_hash                          | emitted      | AdminLoginSucceeded  | ADMIN-001 |
| 1   | 0                 | LoginAdminDecision  | b_b510cb20ff718432  | 2            | PasswordMismatch   | current_hash IS NULL OR encode(digest(:password,'sha256'),'hex') <> current_hash                              | guard_failed | None                 | ADMIN-001 |
| 2   | 1                 | LoginAdminDecision  | b_e05bcdb22827fa2e  | 1            | PasswordMatch      | current_hash IS NOT NULL AND encode(digest(:password,'sha256'),'hex') = current_hash                          | guard_failed | None                 | ADMIN-001 |
| 3   | 1                 | LoginAdminDecision  | b_b510cb20ff718432  | 2            | PasswordMismatch   | current_hash IS NULL OR encode(digest(:password,'sha256'),'hex') <> current_hash                              | emitted      | AdminLoginFailed     | ADMIN-001 |
| 4   | 2                 | LoginAdminDecision  | b_e05bcdb22827fa2e  | 1            | PasswordMatch      | current_hash IS NOT NULL AND encode(digest(:password,'sha256'),'hex') = current_hash                          | guard_failed | None                 | ADMIN-999 |
| 5   | 2                 | LoginAdminDecision  | b_b510cb20ff718432  | 2            | PasswordMismatch   | current_hash IS NULL OR encode(digest(:password,'sha256'),'hex') <> current_hash                              | emitted      | AdminLoginFailed     | ADMIN-999 |

## Command execution

### Execute command using http post json LoginAdmin
```
/api/aggregates/AdminAccount/execute/LoginAdmin '{"params": {"user_id": "ADMIN-001", "password": "s3cret"}}'
```
```bash
curl -X POST 'http://localhost:8080/api/aggregates/AdminAccount/execute/LoginAdmin' \
  -H 'Content-Type: application/json' \
  -d '{
    "params": {
      "user_id": "ADMIN-001",
      "password": "s3cret"
    }
  }'
```
| row | event_type          | stream_id | seq | status  | fields |
|-----|---------------------|-----------|-----|---------|--------|
| 0   | AdminLoginFailed    | ADMIN-001 | 8   | success | {"attempted_at":"2026-04-23T08:28:39.351318","reason":"invalid_password"} |

### Execute command using http post json LoginAdmin success
```
/api/aggregates/AdminAccount/execute/LoginAdmin '{"params": {"user_id": "ADMIN-001", "password": "N3wP@ss!"}}'
```
```bash
curl -X POST 'http://localhost:8080/api/aggregates/AdminAccount/execute/LoginAdmin' \
  -H 'Content-Type: application/json' \
  -d '{
    "params": {
      "user_id": "ADMIN-001",
      "password": "N3wP@ss!"
    }
  }'
```
| row | event_type            | stream_id | seq | status  | fields |
|-----|-----------------------|-----------|-----|---------|--------|
| 0   | AdminLoginSucceeded   | ADMIN-001 | 9   | success | {"login_at":"2026-04-23T08:34:47.169076","session_token":"57952c631c6a5c303d0dd530244f8759b3200bbd809eb6b40acd11e002beab48"} |

### Query projections by name LoginMetrics
```
/api/projections/LoginMetrics/query
```
| row | user_id   | success_count | failure_count | last_login_at               | last_failure_at              |
|-----|-----------|---------------|---------------|-----------------------------|------------------------------|
| 0   | ADMIN-999 | 0             | 1             | None                        | 2026-04-23T04:34:13.932324   |
| 1   | ADMIN-001 | 2             | 5             | 2026-04-23T08:34:47.169076  | 2026-04-23T08:28:39.351318  |

### Query projections by name FailedLoginReport
```
/api/projections/FailedLoginReport/query
```
| row | user_id   | seq | attempted_at               | reason              |
|-----|-----------|-----|----------------------------|---------------------|
| 0   | ADMIN-001 | 2   | 2026-04-23T04:34:13.906731 | invalid_password    |
| 1   | ADMIN-001 | 5   | 2026-04-23T04:34:14.006832 | invalid_password    |
| 2   | ADMIN-001 | 6   | 2026-04-23T08:21:06.826926 | invalid_password    |
| 3   | ADMIN-001 | 7   | 2026-04-23T08:27:01.967859 | invalid_password    |
| 4   | ADMIN-001 | 8   | 2026-04-23T08:28:39.351318 | invalid_password    |
| 5   | ADMIN-999 | 1   | 2026-04-23T04:34:13.932324 | account_not_found   |