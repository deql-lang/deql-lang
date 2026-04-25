# Field Annotations

This demo uses DeQL field annotations:

- `SENSITIVE`: Field is stored but never shown in response (e.g., password_hash)
- `VOLATILE`: Field is returned to the caller but never persisted (e.g., session_token)

See the event definitions in the .deql for examples.

# Admin Login — Decision Branching Demo

Demonstrates **UNION ALL branching** in a single decision so that both login success and login failure are recorded as first-class domain events — no silent rejections, no second command.

## What Changed From the Original

| Before (two commands) | After (branched decision) |
|---|---|
| `LoginAdmin` guarded → rejects on wrong password | `LoginAdminDecision` with two `UNION ALL` branches — always emits |
| App layer must send `RecordLoginFailure` on rejection | Not needed — the failure branch emits `AdminLoginFailed` directly |
| `UPPER(:password)` for comparison | `digest(:password, 'sha256')` — SHA-256 hash comparison |
| `RecordLoginFailure` command + decision | Removed entirely |

## Key Design

```
LoginAdminDecision
├── BRANCH PasswordMatch    → AdminLoginSucceeded   (digest matches)
│   branch_id: b_dbaf4b5f67aaa174
└── BRANCH PasswordMismatch → AdminLoginFailed      (digest mismatch or account missing)
    branch_id: b_b510cb20ff718432
```

The guards are logical complements, so exactly **one branch always fires**. The command is never rejected.

Branch IDs are deterministic XXH3-64 hashes of the canonical branch text (`b_` + 16 hex chars). They stay stable across runs.

## What to Expect

### 1. Schema Registration

All aggregates, commands, events, decisions, and projections register without errors:

```
AGGREGATE AdminAccount registered
COMMAND BootstrapAdmin registered
COMMAND LoginAdmin registered
COMMAND ChangePassword registered
EVENT AdminBootstrapped registered
EVENT AdminLoginSucceeded registered
EVENT AdminLoginFailed registered
EVENT PasswordChanged registered
DECISION BootstrapAdminDecision registered
DECISION LoginAdminDecision registered
DECISION ChangePasswordDecision registered
PROJECTION LoginMetrics registered
PROJECTION FailedLoginReport registered
```

### 2. EXECUTE Results

Each EXECUTE produces pretty-printed output with ✓ for success and ✗ for rejection.


**Bootstrap admin:**

```
  ✓ AdminBootstrapped
    stream_id:  ADMIN-001
    seq:        1
    username:  alice
    password_hash:  ****
1 event(s) emitted.
```


**Login with correct password (PasswordMatch branch fires):**

```
  ✓ AdminLoginSucceeded
    stream_id:  ADMIN-001
    seq:        2
    session_token:  <opaque-token>
    login_at:  2026-04-20T18:31:00.507356
1 event(s) emitted.
```

**Login with wrong password (PasswordMismatch branch fires — not a rejection):**

```
  ✓ AdminLoginFailed
    stream_id:  ADMIN-001
    seq:        3
    attempted_at:  2026-04-20T18:31:00.534961
    reason:  invalid_password
1 event(s) emitted.
```

**Login with unknown user (PasswordMismatch branch fires):**

```
  ✓ AdminLoginFailed
    stream_id:  ADMIN-999
    seq:        1
    attempted_at:  2026-04-20T18:31:00.559879
    reason:  account_not_found
1 event(s) emitted.
```


**Change password:**

```
  ✓ PasswordChanged
    stream_id:  ADMIN-001
    seq:        4
    new_password_hash:  ****
1 event(s) emitted.
```

**Login with new password (succeeds):**

```
  ✓ AdminLoginSucceeded
    stream_id:  ADMIN-001
    seq:        5
    login_at:  2026-04-20T18:31:00.609571
1 event(s) emitted.
```

**Login with old password (now fails):**

```
  ✓ AdminLoginFailed
    stream_id:  ADMIN-001
    seq:        6
    attempted_at:  2026-04-20T18:31:00.634814
    reason:  invalid_password
1 event(s) emitted.
```

**Key observation:** Wrong-password and unknown-user logins emit `AdminLoginFailed` events (not rejections). Every EXECUTE shows `✓` because one branch always fires.

### 3. Event Store Verification

After all EXECUTEs, the raw event stream contains all 7 events:

```sql
SELECT stream_id, seq, event_type, data
FROM DeReg."AdminAccount$Events"
ORDER BY seq;
```

```
+-----------+-----+---------------------+--------------------------------------------------+
| stream_id | seq | event_type          | data                                             |
+-----------+-----+---------------------+--------------------------------------------------+
| ADMIN-001 | 1   | AdminBootstrapped   | {password_hash: 1ec1c2..., username: alice, ...} |
| ADMIN-001 | 2   | AdminLoginSucceeded | {login_at: 2026-04-20T18:31:00.507356, ...}      |
| ADMIN-001 | 3   | AdminLoginFailed    | {reason: invalid_password, ...}                  |
| ADMIN-001 | 4   | PasswordChanged     | {new_password_hash: d4e276..., ...}              |
| ADMIN-001 | 5   | AdminLoginSucceeded | {login_at: 2026-04-20T18:31:00.609571, ...}      |
| ADMIN-001 | 6   | AdminLoginFailed    | {reason: invalid_password, ...}                  |
| ADMIN-999 | 1   | AdminLoginFailed    | {reason: account_not_found, ...}                 |
+-----------+-----+---------------------+--------------------------------------------------+
```

### 4. Projections

**LoginMetrics** — per-user success/failure counts:

```sql
SELECT * FROM DeReg."LoginMetrics";
```

```
+-----------+---------------+---------------+----------------------------+----------------------------+
| user_id   | success_count | failure_count | last_login_at              | last_failure_at            |
+-----------+---------------+---------------+----------------------------+----------------------------+
| ADMIN-001 | 2             | 2             | 2026-04-20T18:31:00.609571 | 2026-04-20T18:31:00.634814 |
| ADMIN-999 | 0             | 1             | NULL                       | 2026-04-20T18:31:00.559879 |
+-----------+---------------+---------------+----------------------------+----------------------------+
```

**FailedLoginReport** — every failed attempt with reason:

```sql
SELECT * FROM DeReg."FailedLoginReport";
```

```
+-----------+-----+----------------------------+-------------------+
| user_id   | seq | attempted_at               | reason            |
+-----------+-----+----------------------------+-------------------+
| ADMIN-001 | 3   | 2026-04-20T18:31:00.534961 | invalid_password  |
| ADMIN-001 | 6   | 2026-04-20T18:31:00.634814 | invalid_password  |
| ADMIN-999 | 1   | 2026-04-20T18:31:00.559879 | account_not_found |
+-----------+-----+----------------------------+-------------------+
```

### 5. INSPECT DECISION & Branch Matrix

Simulate three logins without persisting events:

```sql
CREATE TABLE test_logins AS VALUES
  ('ADMIN-001', 'N3wP@ss!'),
  ('ADMIN-001', 'wrong'),
  ('ADMIN-999', 'anything');

INSPECT DECISION LoginAdminDecision
FROM test_logins
INTO simulated_login_events;
```


**Emitted events** (no `__REJECTED__` rows — one branch always fires):

```sql
SELECT stream_id, event_type, data FROM simulated_login_events;
```

```
+-----------+---------------------+---------------------------------------------+
| stream_id | event_type          | data                                        |
+-----------+---------------------+---------------------------------------------+
| ADMIN-001 | AdminLoginSucceeded | {"login_at":"..."}                          |
| ADMIN-001 | AdminLoginFailed    | {"attempted_at":"...","reason":"invalid_..."}|
| ADMIN-999 | AdminLoginFailed    | {"attempted_at":"...","reason":"account_..."}|
+-----------+---------------------+---------------------------------------------+
```

### 6. INSPECT `__branches` — Per-Branch Outcome Matrix & Guards

INSPECT automatically creates a companion `__branches` table showing which branches fired and which didn't for every input row. Each branch has a deterministic `branch_id` (XXH3-64 hash).

```sql
SELECT inspect_row_index, branch_id, branch_index, branch_rule_name,
       branch_status, event_type, stream_id
FROM simulated_login_events__branches
ORDER BY inspect_row_index, branch_index;
```

```
+-------------------+--------------------+--------------+------------------+---------------+---------------------+-----------+
| inspect_row_index | branch_id          | branch_index | branch_rule_name | branch_status | event_type          | stream_id |
+-------------------+--------------------+--------------+------------------+---------------+---------------------+-----------+
| 0                 | b_dbaf4b5f67aaa174 | 1            | PasswordMatch    | emitted       | AdminLoginSucceeded | ADMIN-001 |
| 0                 | b_b510cb20ff718432 | 2            | PasswordMismatch | guard_failed  | NULL                | ADMIN-001 |
| 1                 | b_dbaf4b5f67aaa174 | 1            | PasswordMatch    | guard_failed  | NULL                | ADMIN-001 |
| 1                 | b_b510cb20ff718432 | 2            | PasswordMismatch | emitted       | AdminLoginFailed    | ADMIN-001 |
| 2                 | b_dbaf4b5f67aaa174 | 1            | PasswordMatch    | guard_failed  | NULL                | ADMIN-999 |
| 2                 | b_b510cb20ff718432 | 2            | PasswordMismatch | emitted       | AdminLoginFailed    | ADMIN-999 |
+-------------------+--------------------+--------------+------------------+---------------+---------------------+-----------+
```

**Reading the matrix:**

- **Row 0** (correct password): PasswordMatch → `emitted`, PasswordMismatch → `guard_failed`
- **Row 1** (wrong password): PasswordMatch → `guard_failed`, PasswordMismatch → `emitted`
- **Row 2** (unknown user): PasswordMatch → `guard_failed`, PasswordMismatch → `emitted`


**Branch guard predicates:**

```sql
SELECT DISTINCT branch_rule_name, branch_guard
FROM simulated_login_events__branches;
```

```
+------------------+------------------------------------------------------------------------------------------------+
| branch_rule_name | branch_guard                                                                                   |
+------------------+------------------------------------------------------------------------------------------------+
| PasswordMatch    | current_hash IS NOT NULL AND encode ( digest ( :password , 'sha256' ) , 'hex' ) = current_hash |
| PasswordMismatch | current_hash IS NULL OR encode ( digest ( :password , 'sha256' ) , 'hex' ) <> current_hash     |
+------------------+------------------------------------------------------------------------------------------------+
```

**Branch status counts:**

```sql
SELECT branch_status, COUNT(*) AS cnt
FROM simulated_login_events__branches
GROUP BY branch_status;
```

```
+---------------+-----+
| branch_status | cnt |
+---------------+-----+
| guard_failed  | 3   |
| emitted       | 3   |
+---------------+-----+
```

3 emitted + 3 guard_failed = 6 total (3 input rows × 2 branches).

### 7. Branch ID Semantics

Each branch gets a deterministic `branch_id` derived from XXH3-64 hashing of canonical branch text:

```
branch_id = "b_" + hex(xxh3_64(canonical_text))
```

Canonical text format: `{decision}:{index}:{rule_name}:{guard_sql}:{EventType(field1,field2,...)}`

| Branch | branch_id | Canonical text (abbreviated) |
|---|---|---|
| PasswordMatch | `b_dbaf4b5f67aaa174` | `LoginAdminDecision:1:PasswordMatch:current_hash IS NOT NULL AND ...:AdminLoginSucceeded(login_at)` |
| PasswordMismatch | `b_b510cb20ff718432` | `LoginAdminDecision:2:PasswordMismatch:current_hash IS NULL OR ...:AdminLoginFailed(attempted_at,reason)` |

Branch IDs are stable across runs and independent of input data — they depend only on the decision definition.

## Blocks Covered

| Block | What it does in this demo |
|---|---|
| `UNION ALL` branching | Single decision, two branches — success and failure |
| `BRANCH` labels | `PasswordMatch` / `PasswordMismatch` — descriptive only |
| `branch_id` | Deterministic XXH3-64 hash for each branch (18 chars: `b_` + 16 hex) |
| `digest(, 'sha256')` | SHA-256 password hashing via `encode(digest(:password, 'sha256'), 'hex')` |
| `INSPECT DECISION` | Simulate login batch without side effects |
| `__branches` table | Per-branch outcome matrix showing emitted vs guard_failed |
| `STATE AS` | Read latest password hash from event history |
| Projection | `LoginMetrics`, `FailedLoginReport` — reporting over stored events |
