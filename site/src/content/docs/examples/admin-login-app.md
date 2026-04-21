---
title: "Admin Login — Decision Branching Demo"
description: "Admin bootstrapping and login with branching and inspection"
---

This example demonstrates advanced decision branching in DeQL, using the `admin-login-demo.deql` script. It shows how a single command can produce different events based on state, with no silent rejections and clear field annotation semantics.

## Scenario Overview

- **Goal:** Model a secure admin login system with password hashing, session tokens, and explicit event recording for both success and failure.
- **Key Features:**
  - **UNION ALL branching:** One command, two possible event outcomes (success/failure), always emits an event.
  - **Field annotations:**
    - `SENSITIVE`: Field is stored but never returned to the caller (e.g., `password_hash`).
    - `VOLATILE`: Field is returned to the caller but never persisted (e.g., `session_token`).
  - **No silent rejections:** Every login attempt is recorded as a domain event.

## Domain Model

- **Aggregate:** `AdminAccount`
- **Commands:**
  - `BootstrapAdmin(user_id, username, password_hash)`
  - `LoginAdmin(user_id, password)`
  - `ChangePassword(user_id, old_password, new_password)`
- **Events:**
  - `AdminBootstrapped(username, password_hash SENSITIVE)`
  - `AdminLoginSucceeded(session_token VOLATILE, login_at)`
  - `AdminLoginFailed(attempted_at, reason)`
  - `PasswordChanged(new_password_hash SENSITIVE)`

## Decision Logic

### BootstrapAdminDecision
- **Purpose:** Idempotently create the initial admin account.
- **Guard:** Only emits if no prior `AdminBootstrapped` event exists for the user.

### LoginAdminDecision (Branched)
- **Purpose:** Handles login attempts, always emits an event.
- **Branches:**
  - **PasswordMatch:**
    - Fires if the provided password (SHA-256 hash) matches the stored hash.
    - Emits `AdminLoginSucceeded` (with a volatile session token).
  - **PasswordMismatch:**
    - Fires if the password is wrong or the account does not exist.
    - Emits `AdminLoginFailed` (with a reason: `invalid_password` or `account_not_found`).
- **No rejections:** One branch always fires; every attempt is recorded.

### ChangePasswordDecision
- **Purpose:** Allows password change if the old password matches and the new one is different.

## Projections
- `LoginMetrics`: Per-user login success/failure counts and timestamps.
- `FailedLoginReport`: All failed login attempts with reasons.

## Example Script Walkthrough

```sql
-- Bootstrap admin account
EXECUTE BootstrapAdmin(
  user_id       := 'ADMIN-001',
  username      := 'alice',
  password_hash := '1ec1c26b50d5d3c58d9583181af8076655fe00756bf7285940ba3670f99fcba0'
);
 ✓ AdminBootstrapped
   stream_id:  ADMIN-001
   seq:        1
   username:   alice
   password_hash:  ****

 Attempt to bootstrap the same user again → REJECTED by guard.
EXECUTE BootstrapAdmin(
  user_id       := 'ADMIN-001',
  username      := 'alice',
  password_hash := '1ec1c26b50d5d3c58d9583181af8076655fe00756bf7285940ba3670f99fcba0'
);

 ✗ REJECTED
    decision:  BootstrapAdminDecision
    guard:     existing_flag IS NULL
    state:     existing_flag = 1
    command:   password_hash = '1ec1c26b50d5d3c58d9583181af8076655fe00756bf7285940ba3670f99fcba0'
    command:   username = 'alice'
    command:   user_id = 'ADMIN-001'

-- Successful login (correct password → PasswordMatch branch).
EXECUTE LoginAdmin(user_id := 'ADMIN-001', password := 's3cret');
 ✓ AdminLoginSucceeded
   stream_id:  ADMIN-001
   seq:        2
   session_token:  <opaque-token>
   login_at:   2026-04-21T11:34:45.123456

-- Wrong password → PasswordMismatch branch fires (NOT a rejection).
EXECUTE LoginAdmin(user_id := 'ADMIN-001', password := 'wrong');
 ✓ AdminLoginFailed
   stream_id:  ADMIN-001
   seq:        3
   attempted_at:  2026-04-21T11:34:48.260307
   reason:    invalid_password

-- Unknown user → PasswordMismatch branch fires.
EXECUTE LoginAdmin(user_id := 'ADMIN-999', password := 'any');
 ✓ AdminLoginFailed
   stream_id:  ADMIN-999
   seq:        4
   attempted_at:  2026-04-21T11:34:50.000000
   reason:    account_not_found

-- Change password (old must match, new must differ).
EXECUTE ChangePassword(
  user_id      := 'ADMIN-001',
  old_password := 's3cret',
  new_password := 'N3wP@ss!'
);
 ✓ PasswordChanged
   stream_id:  ADMIN-001
   seq:        5
   new_password_hash:  ****

-- Login with the new password.
EXECUTE LoginAdmin(user_id := 'ADMIN-001', password := 'N3wP@ss!');
 ✓ AdminLoginSucceeded
   stream_id:  ADMIN-001
   seq:        6
   session_token:  <opaque-token>
   login_at:   2026-04-21T11:34:55.000000

-- Login with the OLD password → now a failure.
EXECUTE LoginAdmin(user_id := 'ADMIN-001', password := 's3cret');
 ✓ AdminLoginFailed
   stream_id:  ADMIN-001
   seq:        7
   attempted_at:  2026-04-21T11:34:57.000000
   reason:    invalid_password
```

## Querying and Inspecting

- **Event history:**
  ```sql
  SELECT stream_id, seq, event_type, data FROM DeReg."AdminAccount$Events" ORDER BY seq;
  ```
- **Login metrics:**
  ```sql
  SELECT * FROM DeReg."LoginMetrics";
  ```
- **Failed login report:**
  ```sql
  SELECT * FROM DeReg."FailedLoginReport";
  ```
- **INSPECT Decision:**
  ```sql
  CREATE TABLE test_logins AS VALUES
    ('ADMIN-001', 'N3wP@ss!'),
    ('ADMIN-001', 'wrong'),
    ('ADMIN-999', 'anything');

  INSPECT DECISION LoginAdminDecision
  FROM test_logins
  INTO simulated_login_events;

  SELECT stream_id, event_type, data FROM simulated_login_events;
  -- Each input row produces an event (no rejections)
  -- Expected output:
   +----------+---------------------+---------------------------------------------+
   | stream_id| event_type          | data                                        |
   +----------+---------------------+---------------------------------------------+
   | ADMIN-001| AdminLoginSucceeded | {"login_at":"..."}                          |
   | ADMIN-001| AdminLoginFailed    | {"attempted_at":"...","reason":"invalid_..."}|
   | ADMIN-999| AdminLoginFailed    | {"attempted_at":"...","reason":"account_..."}|
   +----------+---------------------+---------------------------------------------+
  ```
- **INSPECT Branch Matrix:**
  ```sql
  SELECT inspect_row_index, branch_rule_name, branch_status, event_type
  FROM simulated_login_events__branches
  ORDER BY inspect_row_index, branch_rule_name;
  -- Shows which branch fired for each input
  --
  -- Expected output (6 rows — 2 branches × 3 input rows):
  +-------------------+--------------+------------------+---------------+---------------------+-----------+
   | inspect_row_index | branch_index | branch_rule_name | branch_status | event_type          | stream_id |
   +-------------------+--------------+------------------+---------------+---------------------+-----------+
   | 0                 | 1            | PasswordMatch    | emitted       | AdminLoginSucceeded | ADMIN-001 |
   | 0                 | 2            | PasswordMismatch | guard_failed  | NULL                | ADMIN-001 |
   | 1                 | 1            | PasswordMatch    | guard_failed  | NULL                | ADMIN-001 |
   | 1                 | 2            | PasswordMismatch | emitted       | AdminLoginFailed    | ADMIN-001 |
   | 2                 | 1            | PasswordMatch    | guard_failed  | NULL                | ADMIN-999 |
   | 2                 | 2            | PasswordMismatch | emitted       | AdminLoginFailed    | ADMIN-999 |
   +-------------------+--------------+------------------+---------------+---------------------+-----------+
  --
  -- Row 0: correct password  → PasswordMatch emitted, PasswordMismatch guard_failed
  -- Row 1: wrong password    → PasswordMatch guard_failed, PasswordMismatch emitted
  -- Row 2: unknown user      → PasswordMatch guard_failed, PasswordMismatch emitted
  ```

## Field Annotation Semantics

- `SENSITIVE` fields are never shown in CLI/INSPECT output (e.g., password hashes are always redacted).
- `VOLATILE` fields are shown in output but never persisted (e.g., session tokens are returned to the caller but not stored).


## Bonus: Blocking Reuse of Past 5 Passwords

To enhance security, you can prevent users from reusing any of their last 5 passwords. This is done by checking the new password hash against the hashes of the most recent 5 password changes (including the original bootstrap password).

### Example: ChangePasswordDecision with Password History Check

Replace the `ChangePasswordDecision` logic with the following:

```sql
CREATE DECISION ChangePasswordDecision
FOR AdminAccount
ON COMMAND ChangePassword
STATE AS
  SELECT
    ARRAY_AGG(password_hash ORDER BY seq DESC LIMIT 5) AS recent_hashes
  FROM (
    SELECT seq, 
      CASE 
        WHEN event_type = 'PasswordChanged' THEN data.new_password_hash
        WHEN event_type = 'AdminBootstrapped' THEN data.password_hash
        ELSE NULL
      END AS password_hash
    FROM DeReg."AdminAccount$Events"
    WHERE stream_id = :user_id
      AND (event_type = 'PasswordChanged' OR event_type = 'AdminBootstrapped')
  )
  WHERE password_hash IS NOT NULL
EMIT AS
  SELECT EVENT PasswordChanged (
    new_password_hash := encode(digest(:new_password, 'sha256'), 'hex')
  )
  WHERE encode(digest(:old_password, 'sha256'), 'hex') = recent_hashes[1]
    AND encode(digest(:new_password, 'sha256'), 'hex') <> ALL(recent_hashes);
```

**Explanation:**
- `recent_hashes` is an array of the last 5 password hashes (most recent first).
- The guard checks:
  - The old password matches the most recent hash (`recent_hashes[1]`).
  - The new password hash does not match any of the last 5 hashes (`<> ALL(recent_hashes)`).
- This blocks the user from reusing any of their last 5 passwords.

**Tip:** Adjust the `LIMIT 5` to enforce a different password history length.

---

This example demonstrates how DeQL enables explicit, auditable, and secure handling of authentication flows, with clear semantics for field privacy and event recording. Every login attempt is a first-class event, and the system is safe by default.
