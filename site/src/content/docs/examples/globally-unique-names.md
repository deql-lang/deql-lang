---
title: Enforcing Globally Unique Usernames with DeQL Decisions and Branching
description: Globally Unique Usernames with DeQL Decisions and Branching
---

Enforcing *globally unique usernames* in an **event-driven, eventually consistent** system is challenging. Traditional approaches to global uniqueness often involve complex workarounds: maintaining *read-models and retroactive fixes*, using *dedicated unique-index storage*, or implementing *reservation/saga patterns*. These strategies can introduce significant complexity, potential race conditions, or additional infrastructure. [\[dcb.events\]](https://dcb.events/examples/unique-username/#__tabbed_1_2)

**Dynamic Consistency Boundary (DCB)** offers an elegant solution by treating each username as its own *consistency boundary*. In the DCB approach, **every event that affects username availability is “tagged” with that username value (or a hash)**. The event store can then *atomically query and append events with a given tag*, ensuring at most one successful registration for each username. This eliminates separate unique-index stores or multi-phase locks, as the event store itself guards global uniqueness at write time. 

**DeQL (Decision Query Language)** enables us to implement this DCB pattern in a purely declarative way by modeling *business decisions* with integrated **state queries** and **event emissions**. With DeQL, we can explicitly capture *global uniqueness rules as decision logic with branching outcomes* — success vs. conflict — rather than burying these checks in imperative code. Business constraints like “username must be unique” become **guard conditions** in a decision, making the logic transparent and automatically enforced by the runtime.

In this article, we’ll explore how to use **DeQL decisions and decision branching** to address the **globally-unique username** requirement from DCB.events. We will walk through each scenario discussed in the DCB example (unique username claims, conflicts under concurrent requests, releasing names on account closure, changing usernames, idempotent retries, and rejection handling) and show how each is modeled in DeQL. We assume basic familiarity with event-sourced systems and focus on the DeQL solution rather than general event sourcing theory.

<style>
        :root {
        --accent: #464feb;
        --timeline-ln: linear-gradient(to bottom, transparent 0%, #b0beff 15%, #b0beff 85%, transparent 100%);
        --timeline-border: #ffffff;
        --bg-card: #f5f7fa;
        --bg-hover: #ebefff;
        --text-title: #424242;
        --text-accent: var(--accent);
        --text-sub: #424242;
        --radius: 12px;
        --border: #e0e0e0;
        --shadow: 0 2px 10px rgba(0, 0, 0, 0.06);
        --hover-shadow: 0 4px 14px rgba(39, 16, 16, 0.1);
        --font: "Segoe Sans", "Segoe UI", "Segoe UI Web (West European)", -apple-system, "system-ui", Roboto, "Helvetica Neue", sans-serif;
        --overflow-wrap: break-word;
    }

    @media (prefers-color-scheme: dark) {
        :root {
            --accent: #7385ff;
            --timeline-ln: linear-gradient(to bottom, transparent 0%, transparent 3%, #6264a7 30%, #6264a7 50%, transparent 97%, transparent 100%);
            --timeline-border: #424242;
            --bg-card: #1a1a1a;
            --bg-hover: #2a2a2a;
            --text-title: #ffffff;
            --text-sub: #ffffff;
            --shadow: 0 2px 10px rgba(0, 0, 0, 0.3);
            --hover-shadow: 0 4px 14px rgba(0, 0, 0, 0.5);
            --border: #3d3d3d;
        }
    }

    @media (prefers-contrast: more),
    (forced-colors: active) {
        :root {
            --accent: ActiveText;
            --timeline-ln: ActiveText;
            --timeline-border: Canvas;
            --bg-card: Canvas;
            --bg-hover: Canvas;
            --text-title: CanvasText;
            --text-sub: CanvasText;
            --shadow: 0 2px 10px Canvas;
            --hover-shadow: 0 4px 14px Canvas;
            --border: ButtonBorder;
        }
    }

    .insights-container {
        display: grid;
        grid-template-columns: repeat(2,minmax(240px,1fr));
        padding: 0px 16px 0px 16px;
        gap: 16px;
        margin: 0 0;
        font-family: var(--font);
    }

    .insight-card:last-child:nth-child(odd){
        grid-column: 1 / -1;
    }

    .insight-card {
        background-color: var(--bg-card);
        border-radius: var(--radius);
        border: 1px solid var(--border);
        box-shadow: var(--shadow);
        min-width: 220px;
        padding: 16px 20px 16px 20px;
    }

    .insight-card:hover {
        background-color: var(--bg-hover);
    }

    .insight-card h4 {
        margin: 0px 0px 8px 0px;
        font-size: 1.1rem;
        color: var(--text-accent);
        font-weight: 600;
        display: flex;
        align-items: center;
        gap: 8px;
    }

    .insight-card .icon {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        width: 20px;
        height: 20px;
        font-size: 1.1rem;
        color: var(--text-accent);
    }

    .insight-card p {
        font-size: 0.92rem;
        color: var(--text-sub);
        line-height: 1.5;
        margin: 0px;
        overflow-wrap: var(--overflow-wrap);
    }

    .insight-card p b, .insight-card p strong {
        font-weight: 600;
    }

    .metrics-container {
        display:grid;
        grid-template-columns:repeat(2,minmax(210px,1fr));
        font-family: var(--font);
        padding: 0px 16px 0px 16px;
        gap: 16px;
    }

    .metric-card:last-child:nth-child(odd){
        grid-column:1 / -1; 
    }

    .metric-card {
        flex: 1 1 210px;
        padding: 16px;
        background-color: var(--bg-card);
        border-radius: var(--radius);
        border: 1px solid var(--border);
        text-align: center;
        display: flex;
        flex-direction: column;
        gap: 8px;
    }

    .metric-card:hover {
        background-color: var(--bg-hover);
    }

    .metric-card h4 {
        margin: 0px;
        font-size: 1rem;
        color: var(--text-title);
        font-weight: 600;
    }

    .metric-card .metric-card-value {
        margin: 0px;
        font-size: 1.4rem;
        font-weight: 600;
        color: var(--text-accent);
    }

    .metric-card p {
        font-size: 0.85rem;
        color: var(--text-sub);
        line-height: 1.45;
        margin: 0;
        overflow-wrap: var(--overflow-wrap);
    }

    .timeline-container {
        position: relative;
        margin: 0 0 0 0;
        padding: 0px 16px 0px 56px;
        list-style: none;
        font-family: var(--font);
        font-size: 0.9rem;
        color: var(--text-sub);
        line-height: 1.4;
    }

    .timeline-container::before {
        content: "";
        position: absolute;
        top: 0;
        left: calc(-40px + 56px);
        width: 2px;
        height: 100%;
        background: var(--timeline-ln);
    }

    .timeline-container > li {
        position: relative;
        margin-bottom: 16px;
        padding: 16px 20px 16px 20px;
        border-radius: var(--radius);
        background: var(--bg-card);
        border: 1px solid var(--border);
    }

    .timeline-container > li:last-child {
        margin-bottom: 0px;
    }

    .timeline-container > li:hover {
        background-color: var(--bg-hover);
    }

    .timeline-container > li::before {
        content: "";
        position: absolute;
        top: 18px;
        left: -40px;
        width: 14px;
        height: 14px;
        background: var(--accent);
        border: var(--timeline-border) 2px solid;
        border-radius: 50%;
        transform: translateX(-50%);
        box-shadow: 0px 0px 2px 0px #00000012, 0px 4px 8px 0px #00000014;
    }

    .timeline-container > li h4 {
        margin: 0 0 5px;
        font-size: 1rem;
        font-weight: 600;
        color: var(--accent);
    }

    .timeline-container > li h4 em {
        margin: 0 0 5px;
        font-size: 1rem;
        font-weight: 600;
        color: var(--accent);
        font-style: normal;
    }

    .timeline-container > li * {
        margin: 0;
        font-size: 0.9rem;
        color: var(--text-sub);
        line-height: 1.4;
    }

    .timeline-container > li * b, .timeline-container > li * strong {
        font-weight: 600;
    }
        @media (max-width:600px){
        .metrics-container,
        .insights-container{
            grid-template-columns:1fr;
      }
    }
</style>
<div class="insights-container">
  <div class="insight-card">
    <h4>DCB + DeQL Solution at a Glance</h4>
    <p>Leverage <b>event tags</b> (like <code>username:alice</code>) to create a dynamic consistency boundary per username. In DeQL, define a <b>decision</b> that <i>queries past events</i> with that tag to check availability, then <b>conditionally emits</b> a <code>UserRegistered</code> event only if the username is free. If a conflict is detected (username already taken), the decision <b>rejects the command</b> with an error. Subsequent features (account closure, username changes, etc.) are handled by extending the decision’s query and guard conditions to account for new event types that free or reserve usernames.</p>
  </div>
</div>

## 1. Base Decision: Registering a Unique Username (Success vs. Conflict)

**Problem Statement:** We need to allow users to register a new account with a chosen username that must be *globally unique* across all accounts. Once a username is claimed by any active account, no new account can use the *same username*. In a **successful scenario**, an account registration with an unused username should produce an `AccountRegistered` event for that username. In a **conflict scenario**, such as when the username is already taken (even if by a concurrently arriving request), the registration must be rejected and **no duplicate event** should be recorded. 

**DCB Approach Recap:** The DCB example accomplishes this by tagging each `AccountRegistered` event with `username:<username>` and querying those tags to determine if a username is already claimed. A simple in-memory projection `IsUsernameClaimed(username)` tracks if any event with the tag exists. The account registration command handler uses this projection’s state to decide whether to allow the new registration or throw an error. The event append is done *conditionally* (with an `appendCondition`) to ensure that if another event with the same tag sneaks in between the check and write (i.e. a concurrent registration of the same username), the append will fail and the command is safely aborted. 

**DeQL Solution:** In DeQL, this logic is expressed as a **single declarative decision**. We create a decision that *encapsulates both the read-side check and the write-side effect*. Specifically, the decision will query the event store for any prior events tagged with the candidate username and use a **guard condition** to allow or prevent the new `AccountRegistered` event.

First, we define our domain types (aggregate, command, and event) and then the `RegisterAccount` decision:

```sql
-- Define aggregate and commands for user account registration
CREATE AGGREGATE UserAccount;

CREATE COMMAND RegisterAccount (
    user_id   UUID,          -- unique Account ID (for the new user account aggregate)
    username  STRING         -- desired username
);

CREATE EVENT AccountRegistered (
    username  STRING
    -- (In a real system, might include user_id, timestamp, etc. Here we focus on username)
);
```

Now, we declare the **decision** that enforces the global uniqueness rule:

```sql
-- Decision: Register a new account with a globally unique username
CREATE DECISION RegisterAccountUniqueUsername
FOR  UserAccount
ON   COMMAND RegisterAccount
STATE AS
    -- Check if any prior event is tagged with this username (exists check)
    SELECT 1 AS username_taken_flag
    FROM DeReg."UserAccount$Events"
    WHERE 'username:' || LOWER(:username) = ANY(tags)
    LIMIT 1
EMIT AS
    -- Only emit AccountRegistered if no existing event was found (flag is NULL)
    SELECT EVENT AccountRegistered (username := :username)
    WHERE username_taken_flag IS NULL;

```

**How it works:** The `STATE AS` clause performs a **tag query** over all past `UserAccount` events to count how many events carry the tag for this username (we use a lowercase normalized username for case-insensitivity). If `username_taken_flag is NULL`, it means *no account has ever been registered (or changed) with this username*, so the guard condition passes and the `AccountRegistered` event is emitted. If there is **at least one collision** (meaning the username tag already exists), the guard condition fails and **no event is emitted**, causing the decision to reject the command. In DeQL’s execution model, a failed guard results in a **rejected command** with an error, preventing any duplicate event from being stored. This covers both the normal **successful registration path** and the conflict/rejection path in one decision declaration.

**Conflict & Concurrency:** With this decision in place, attempts to register a taken username will be blocked. For example, if user *Alice* successfully registers username **`"alice123"`**, any subsequent `RegisterAccount("alice123")` command **will not emit a new event** and will be marked as rejected with an error like *“Username 'alice123' is claimed”*. This holds true even if two registration commands for the same username arrive at nearly the same time: DeQL’s underlying event store applies the decision logic atomically. The first command to append an `AccountRegistered` event for that username will succeed; any concurrent transaction will detect the fresh tag and be aborted by the consistency check. In effect, the *DCB tag acts as a natural lock* for the username. The losing transaction’s decision is rejected, and the application can report a graceful “username already taken” error to the user.

> **Why use tag-based queries?** In a traditional CQRS/ES design, enforcing a rule across *all* aggregates (here, “no two UserAccount aggregates share the same username”) is difficult without a centralized locking or a global read model. DCB’s tag mechanism and DeQL’s decision queries solve this by treating the username itself as a *distributed consistency key*. The decision’s query effectively says: *“if any event with tag `username:XYZ` exists, then XYZ is already used.”* This way, the uniqueness constraint is checked *within the decision* and becomes part of the atomic event insertion logic.

**DeQL Decision Branching:** In our `RegisterAccountUniqueUsername` decision, we have implicitly defined two **branches** of execution:

*   **Success branch:** Guard condition `username_taken_flag is NULL` is true, so the `AccountRegistered` event is emitted. The new account is created with the requested username.
*   **Rejection branch:** If `username_taken_flag is not NULL` (meaning the username tag was found), the guard condition fails. DeQL will not emit any event and will flag the command as *rejected* due to the unmet `WHERE` clause. This is equivalent to throwing a domain error in an imperative implementation. The DeQL runtime makes rejections explicit – for instance, a failed guard produces a log entry like *“✗ REJECTED – guard `username_taken_flag is SET` failed”*, indicating the username was already in use.

#### Example Outcomes:

*   **New username (Success):** No prior events for `"alice123"` exist. `username_taken_flag is NULL` and the decision emits `AccountRegistered(username="alice123")`. The new event is tagged with `username:alice123` (the DeQL runtime would tag it similarly to how DCB tags events), so that future checks will treat "alice123" as taken.
*   **Already-taken username (Conflict/Reject):** Suppose *Bob* is registering `"alice123"` after Alice. The decision finds an existing event tagged `username:alice123`, so `username_taken_flag is NOT NULL`. The `WHERE username_taken_flag is NOT NULL` guard fails, **no event is emitted**, and the `RegisterAccount` command is rejected. The system can return an error like *“Username 'alice123' is claimed”*.
*   **Concurrent requests:** If Alice and Bob **submit `RegisterAccount(username="eve99")` simultaneously**, the outcome is nondeterministic but *safe*: one will succeed, the other will hit the guard. For example, if Alice’s decision executes slightly before Bob’s, Alice’s `AccountRegistered("eve99")` is appended, and Bob’s decision then sees a collision and is rejected. If Bob’s ran first, vice versa. In both cases, only one event is recorded, preserving global uniqueness, and neither results in an inconsistent duplicate.

**Note on Normalization:** In practice, usernames should be normalized (e.g. lowercased) and possibly hashed before tagging, to avoid case or privacy issues. For example, `"JamesBond"` vs `"jamesbond"` should be considered the *same username*. Our decision used `LOWER(:username)` in the tag query to handle this. In a real system, you might also store a hash like `username:hash` instead of the raw name in the tag for security.

***

## 2. Releasing Usernames on Account Closure

**Scenario:** We want to allow a username to be **re-claimed** if the original account is closed (user account deleted). The DCB example’s *Feature 2* demonstrates this: once an account with username *“u1”* is closed (recording an `AccountClosed` event with tag `username:u1`), a new account should be allowed to register *“u1”* again. In other words, an `AccountClosed` event should mark the username as free.

**Extending the Decision:** To model this in DeQL, we introduce a new event and update our decision’s state logic. First, define the `AccountClosed` event type and ensure it carries the username tag:

```sql
-- New event type for account closure (frees a username)
CREATE EVENT AccountClosed (
    username STRING
);
```

We assume there is a corresponding `CloseAccount` command and decision (not shown here) that emits `AccountClosed` when a user’s account is deleted. The critical part is that **this event is tagged with `username:<username>`**, just like registrations, so it participates in the uniqueness check.

Now we modify the `RegisterAccountUniqueUsername` decision. We need the decision’s state query to recognize that an `AccountClosed` event for a username means that name is no longer taken. In the DCB example, the in-memory projection simply flipped the flag to *false* on `AccountClosed`. In DeQL, we can achieve the same by refining our query:

```sql
ALTER DECISION RegisterAccountUniqueUsername
STATE AS
    -- Determine if the username is currently claimed by looking at the latest relevant event for that username tag
    SELECT 
      -- Fetch the type of the most recent event (if any) tagged with this username
      (SELECT event_type 
         FROM DeReg."UserAccount$Events"
         WHERE 'username:' || LOWER(:username) = ANY(tags)
         ORDER BY global_position DESC   -- highest position = latest event
         LIMIT 1
      ) AS last_event_type
EMIT AS
    SELECT EVENT AccountRegistered (username := :username)
    WHERE COALESCE(last_event_type IS NULL OR last_event_type = 'AccountClosed', FALSE);
```

**How it works:** Here we replace the simple collision count with a check on the **type of the latest event** carrying the username tag:

*   If **no prior event** with that username exists (`last_event_type IS NULL`), the username is clearly free.
*   If the latest event is an `AccountClosed`, that means the most recent action on this username was closing an account – effectively freeing the name. So the guard condition allows reuse in this case.
*   If the latest event is an `AccountRegistered` (or anything other than `AccountClosed`), the name is currently taken, so the guard condition fails and the registration is rejected.

With this update, the decision now reflects the rule: *“A username is available if it has never been registered **or** if it was previously registered but the account was closed.”* The **DeQL decision’s branches explicitly cover**:

*   **Username free** (no last event, or last event was a closure) → Take the success branch, emit `AccountRegistered`.
*   **Username still taken** (last event is a registration) → Take the rejection branch, emit nothing (command fails).

For example, if user *Charlie* had account **“charlie77”** but then deletes their account (producing `AccountClosed("charlie77")`), another user can now register **“charlie77”**. The decision’s query would find the last event for tag `username:charlie77` to be the `AccountClosed` and thus permit a new `AccountRegistered("charlie77")` event

> **DCB in action:** In the DCB example, adding `AccountClosed` to the tag-filtered projection changed its outcome to `false` (not claimed) when a closure event is encountered. Our DeQL query does something similar by treating a closing event as an indicator that the username is free. Both approaches ensure the *re-claim* scenario is handled correctly without any additional manual coordination — once an `AccountClosed` event is recorded, the username’s tag no longer blocks future registrations.

**Rejection Path:** If a user tries to register a username that *appears free* (e.g., because the original owner closed their account) but in reality someone else *just re-claimed it*, a conflict will occur. Thanks to the decision logic, the new `AccountRegistered` for that username will only succeed for the *first* appender. Any second registrar will see that the latest event is **not** a closure and will be prevented from writing a duplicate. The second command is rejected and no event is produced – again preserving global uniqueness without any custom “saga” logic.

***

## 3. Changing Usernames and Username Transfers

**Scenario:** Next, consider allowing users to **change their username** (DCB example *Feature 3*). Changing a username has two effects on global uniqueness:

1.  The user’s *old username* becomes free for others to use.
2.  The *new username* (the one they are changing *to*) must be free at the time of change, and once changed, it becomes taken.

DCB’s solution is to emit a `UsernameChanged(oldUsername, newUsername)` event carrying **two tags**: the old and the new username. By tagging the event with both `username:old` and `username:new`, this single event simultaneously frees the old name and claims the new one within the consistency boundary. The `IsUsernameClaimed` projection updates its boolean state to `false` when it sees an event whose *oldUsername* matches the name in question, and to `true` when it sees one with *newUsername* matching the name . This way, the projection correctly reflects that *the old name is now available, and the new name is now taken*.

**DeQL Solution:** We incorporate similar logic by extending our decision’s state query to account for `UsernameChanged` events. We also must ensure that users cannot change to a username that’s already claimed.

First, define the new event and command for username changes:

```sql
CREATE EVENT UsernameChanged (
    oldUsername  STRING,
    newUsername  STRING
);

CREATE COMMAND ChangeUsername (
    user_id      UUID,           -- ID of the account changing its username
    new_username STRING
);
```

We assume a separate `ChangeUsername` decision (not fully shown here) that would use similar checks to enforce uniqueness on `:new_username` and then emit `UsernameChanged(oldUsername := current_username, newUsername := :new_username)` with appropriate tags. For our registration logic, what matters is how `UsernameChanged` events affect the availability of a username. We modify the **state query** once again:

```sql
ALTER DECISION RegisterAccountUniqueUsername
STATE AS
    -- Determine if username is free or taken by inspecting last relevant event for that username
    SELECT 
      event_type    AS last_event_type,
      data->>'newUsername' AS last_new_name
    FROM DeReg."UserAccount$Events"
    WHERE 'username:' || LOWER(:username) = ANY(tags)
    ORDER BY global_position DESC
    LIMIT 1
EMIT AS
    SELECT EVENT AccountRegistered (username := :username)
    WHERE 
      -- Guard allows success if no prior events for this username,
      -- OR if last event indicates the name was freed (AccountClosed or a UsernameChanged where this name was the old name).
      last_event_type IS NULL
      OR last_event_type = 'AccountClosed'
      OR (last_event_type = 'UsernameChanged' AND last_new_name <> LOWER(:username));
```

**How it works:** We now retrieve both the `last_event_type` *and* the `last_new_name` (applicable if the last event was a `UsernameChanged`) for the given username’s tag. The guard condition then explicitly encodes all possible branches:

*   **Username is free** if **no events exist** (`last_event_type IS NULL`). Allows registration.
*   **Username was previously taken but then freed** if the last event is `AccountClosed` *or* a `UsernameChanged` where this username was the **old name** (`last_event_type='UsernameChanged'` with `last_new_name != :username`, meaning the user having this name changed to a different name). In both cases, the name is currently unclaimed, so the guard passes and a new `AccountRegistered` for the name is emitted.
*   **Username is currently taken** if the last event with this tag is an `AccountRegistered` (someone registered it and hasn’t released it) **or** it’s a `UsernameChanged` where the username is the **new name** (`last_event_type='UsernameChanged'` *and* `last_new_name = :username`). In these situations, the guard condition evaluates to false, so the decision emits nothing and the registration is **rejected** with a “username is claimed” error. This covers both direct conflicts and attempting to claim a name that was just adopted by someone else’s username change.

With this extended decision, all name-change scenarios are handled:

*   **Change frees old name:** When user *X* changes username from "oldName" to "newName", a `UsernameChanged(oldName, newName)` event is recorded (tagged with both `username:oldName` and `username:newName` ). For any future `RegisterAccount` trying to claim "oldName", our decision’s query will see the last event tagged `username:oldName` is this `UsernameChanged` with `newUsername != "oldName"`, thus allowing "oldName" to be registered by someone new. Meanwhile, the last event for tag `username:newName` is that same `UsernameChanged` (where `newUsername` *equals* "newName"), so "newName" is now considered taken.
*   **Changing to an in-use name (rejection):** If user Y tries to change their username to one that’s currently taken by user X, the `ChangeUsername` decision (not shown) can reuse the **same query/guard as our registration decision** to detect the conflict. It would reject the username change command, similar to a registration attempt conflict. No events are emitted in this case.
*   **Changing to the same name (no-op):** As a minor guard, the change decision can also ensure the new username is not the same as the current username (to avoid meaningless `UsernameChanged` events). For example, in DeQL we could add `AND :new_username <> current_username` as part of the `ChangeUsername` decision’s `WHERE` clause (as shown in the DeQL docs’ promotion example). If a user accidentally attempts to change to the identical name, the decision would simply reject it (no state change), as shown in the DeQL output: *“✗ REJECTED … guard: :new\_grade <> current\_grade”* (analogy: new username must differ from old) .

**Username Transfer Example:** Suppose user *Dave* has username `"dave01"`. Another user *Eve* wants that name:

1.  Dave changes username from `"dave01"` to `"dave02"` – a `UsernameChanged(oldUsername="dave01", newUsername="dave02")` event is emitted, tagged with `username:dave01` and `username:dave02`. Dave’s old handle **“dave01”** is now free.
2.  Almost immediately, Eve registers a new account with username `"dave01"`. Eve’s `RegisterAccount("dave01")` decision will see Dave’s change event as the latest event for **dave01**. Because in that event `newUsername` was `"dave02"` (not `"dave01"`), the guard interprets it as a *freeing* of `"dave01"`, allowing Eve’s registration to succeed. An `AccountRegistered("dave01")` event for Eve is recorded. If, however, Eve had tried to grab `"dave02"` (Dave’s new name) instead, the last event for tag **dave02** would indicate that it was just claimed by Dave (as a `UsernameChanged` where `newUsername = "dave02"`), and Eve’s registration would be rejected.

***

## 4. Safe Retries and Idempotency

**Scenario:** *What if the same user (or client) accidentally issues the same registration command twice?* For example, a user might click a “Register” button twice, or a network retry may cause a duplicate request to hit the service. Without precautions, this could either create two accounts with the same username (if not properly guarded) or, in our current design, trigger a conflict against the user’s own first attempt. Neither outcome is desirable. This is essentially an **idempotency** problem — ensuring that repeated *identical* requests don’t produce duplicate side effects.

**DCB Approach:** DCB suggests using an **idempotency token** in the command. For instance, the client generates a random *idempotency ID* and includes it with the registration request. The `AccountRegistered` event then carries this token (e.g. via an `idempotency:<token>` tag) so that any duplicate request with the same token can be recognized and rejected as a *re-submission*. This way, even if the username is the same, the system can distinguish a true *duplicate request* from a legitimate new attempt by another client.

**DeQL Solution:** To incorporate idempotency in DeQL, we can extend our model with minimal changes. We add an `idempotency_token` field to the command and event, then include a guard that no prior event with that token exists:

```sql
-- Extend the command and event to include an idempotency token
ALTER COMMAND RegisterAccount ADD idempotency_token STRING;
ALTER EVENT AccountRegistered ADD idempotency_token STRING;

ALTER DECISION RegisterAccountUniqueUsername
STATE AS
    SELECT 
      -- prior logic for username uniqueness (as above)
      (SELECT event_type FROM DeReg."UserAccount$Events"
       WHERE 'username:' || LOWER(:username) = ANY(tags)
       ORDER BY global_position DESC LIMIT 1)           AS last_event_type,
      (SELECT data->>'newUsername' FROM DeReg."UserAccount$Events"
       WHERE 'username:' || LOWER(:username) = ANY(tags)
       ORDER BY global_position DESC LIMIT 1)           AS last_new_name,
      -- new subquery: check if this token was seen before
      (SELECT 1 FROM DeReg."UserAccount$Events"
       WHERE 'idempotency:' || :idempotency_token = ANY(tags)
       LIMIT 1)                                         AS token_used
EMIT AS
    SELECT EVENT AccountRegistered (
        username          := :username,
        idempotency_token := :idempotency_token
    )
    WHERE 
      -- Username must be free (no current usage) and token must be unused
      (
        last_event_type IS NULL 
        OR last_event_type = 'AccountClosed' 
        OR (last_event_type = 'UsernameChanged' AND last_new_name <> LOWER(:username))
      )
      AND token_used IS NULL;
```

**How it works:** We tag each `AccountRegistered` event with an `idempotency:<token>` tag (in addition to the username tag). The decision’s state now also queries for any event with the same idempotency token. The guard `token_used IS NULL` ensures that if a second `RegisterAccount` command comes in with the *same* token, the decision will find an existing event and reject the duplicate request. Meanwhile, the original uniqueness logic remains in place to handle different users vying for the same username.

This approach guarantees that **genuine duplicate submissions are treated idempotently** (the first one creates the account, subsequent ones are ignored as no-ops with a “re-submission” error), while still preventing two *distinct* users from ever getting the same username. In effect, we’ve layered a second dynamic boundary on the idempotency token, which could be per client or per user-session. This is a powerful demonstration of how DeQL decisions can combine multiple conditions—each backed by event queries—to enforce complex business rules.

> **Note:** In practice, if an account registration is truly idempotent from the client perspective, a second identical request might semantically mean “the account already exists” (a success, not an error). Modeling *that* behavior might involve a different approach (for example, returning the existing account info if the token was used). For simplicity, our decision just rejects repeats with an error, similar to the DCB example. The key is that *no second account is created*, preserving idempotence.

***

## 5. Summary: DeQL vs Traditional Approaches

By using **DeQL’s decisions and branching**, we translated the *globally-unique username* requirement into a clear, single source of truth. This approach handles all the scenarios from the DCB example:

| **Scenario**                                           | **DeQL Decision Logic**                                                                                                                         | **Outcome**                                                                 |
| ------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------- |
| **Fresh username registration** (no prior use)         | `WHERE ... last_event_type IS NULL` (no event with that username tag exists).                                                       | Emit `AccountRegistered` event (username now taken).                        |
| **Username already taken**                             | `WHERE ... AND ...` fails (an event with that tag was found).                                                                       | **Rejected** – no event emitted; command errors out.                        |
| **Concurrent requests** for same username              | Handled by the same guard condition on tags (evaluated at commit time).                                                             | One succeeds (first commit wins), other is rejected.                        |
| **Account closed (name released)**                     | Last event for username tag is `AccountClosed`. Guard allows reuse.                                                                 | New `AccountRegistered` event for that username.                            |
| **Username changed (old name freed)**                  | Last event for old name’s tag is `UsernameChanged` with a different newName (meaning our name was the old one). Guard allows reuse. | New `AccountRegistered` event for the formerly-used name.                   |
| **Username changed (new name taken)**                  | Last event for new name’s tag is `UsernameChanged` where `newUsername` == that name. Guard treats as taken (guard fails).           | **Rejected** – no event (name is still in use by someone).                  |
| **Immediate retry of same request** (idempotent retry) | Second command has same `idempotency_token`. Query finds an existing event with that token. Guard fails.                            | **Rejected** – no duplicate event; treated as no-op.                        |
| **Rejection handling** (error path)                    | Any guard failure (e.g., username taken, token used, etc.) triggers a *REJECTED* outcome.                                         | The decision aborts; caller receives an error (e.g. "Username is claimed"). |

As shown above, each branch of the business logic is **explicitly modeled** in the decision. This is a stark contrast to a typical imperative implementation where one might scatter checks across command handlers and services. With DeQL, the complex interplay of events (registration, closure, change) is captured in one place. The decision’s *state query* looks at relevant historical facts (using conditions over event streams), and the *emit clauses* declare exactly which events to produce for each scenario (or none, in which case the command is rejected). This clarity also makes it easy to **evolve** the logic: e.g., adding the username retention policy (a time delay before a closed username is actually freed) would simply mean adding a time-based condition to the guard, as shown in the DCB example’s Feature 4.

In summary, **DeQL’s decision and branching features empower us to enforce a global uniqueness constraint on usernames in an event-sourced system with minimal fuss**. We achieved strong consistency on a cross-aggregate rule *without* separate locking services or eventual reconciliation. All scenarios — successful registration, conflicts due to prior use or concurrent requests, releasing names on account deletion, name changes, and even duplicate submissions — are handled through *declarative logic in one or two decisions*. The result is a robust, self-documenting implementation of globally unique usernames that can be inspected and tested easily, aligning with DeQL’s mission to remove accidental complexity from CQRS/ES design.
