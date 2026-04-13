---
title: "Beyond Aggregates"
description: "How DeQL eliminates the rigidity of traditional aggregates — extend your system with new features without sagas, compensation, or rewiring."
---

Aggregates are the backbone of event-sourced systems. But they come with a cost: rigidity. Adding a new feature that spans multiple aggregates forces you into sagas, process managers, compensation mechanisms, and recovery logic. The aggregate boundary that protects consistency becomes the wall that blocks extensibility.

DeQL removes this wall. A decision can query state from any aggregate — not just its own. New features are added by registering new aggregates and writing new decisions, without touching existing code.

## The Problem: Aggregate Rigidity

Imagine you have a working shopping cart. Now the business wants coupons — limited-quantity codes customers can apply at checkout.

In a traditional system, this means:

| Concern | What you have to build |
|---|---|
| New aggregate | A `Coupon` aggregate to track availability |
| Workflow coordination | A saga to orchestrate Cart ↔ Coupon interactions |
| Consistency | Two-phase commit or accept eventual consistency |
| Compensation | Rollback logic if coupon is applied but checkout fails |
| Recovery | Crash recovery to restore consistent state across aggregates |
| Existing code changes | Modify the Cart aggregate or its handlers to know about coupons |

The existing Cart aggregate was never designed for coupons. Extending it means either bloating the aggregate or building coordination infrastructure around it.

## The DeQL Approach: Just Add a Decision

In DeQL, the Cart aggregate stays untouched. You register a new Coupon aggregate and write a new decision that queries both. No saga. No compensation. No changes to existing code.

## Step 1: The Existing Cart

```deql
CREATE AGGREGATE Cart;

CREATE COMMAND AddItem (
  cart_id    STRING,
  product_id STRING,
  quantity   INT,
  price      DECIMAL
);

CREATE COMMAND Checkout (
  cart_id STRING
);

CREATE EVENT ItemAdded (
  product_id STRING,
  quantity   INT,
  price      DECIMAL
);

CREATE EVENT CheckedOut ();

CREATE DECISION AddItem
FOR Cart
ON COMMAND AddItem
EMIT AS
  SELECT EVENT ItemAdded (
    product_id := :product_id,
    quantity   := :quantity,
    price      := :price
  );

CREATE DECISION Checkout
FOR Cart
ON COMMAND Checkout
STATE AS
  SELECT
    COUNT(*) FILTER (WHERE event_type = 'ItemAdded') AS item_count,
    COUNT(*) FILTER (WHERE event_type = 'CheckedOut') AS checkout_count
  FROM DeReg."Cart$Events"
  WHERE stream_id = :cart_id
EMIT AS
  SELECT EVENT CheckedOut ()
  WHERE item_count > 0 AND checkout_count = 0;
```

This is the existing system. Nothing above changes when we add coupons.

## Step 2: Register the Coupon Aggregate

A new aggregate, new commands, new events — completely independent of Cart:

```deql
CREATE AGGREGATE Coupon;

CREATE COMMAND EmitCoupon (
  coupon_id STRING,
  quantity  INT
);

CREATE COMMAND ApplyCoupon (
  cart_id   STRING,
  coupon_id STRING
);

CREATE EVENT CouponEmitted (
  quantity INT
);

CREATE EVENT CouponApplied (
  cart_id STRING
);

CREATE DECISION EmitCoupon
FOR Coupon
ON COMMAND EmitCoupon
EMIT AS
  SELECT EVENT CouponEmitted (
    quantity := :quantity
  );
```

## Step 3: The Cross-Aggregate Decision

This is the key. `ApplyCoupon` queries the Coupon aggregate's event stream to compute:

- `remaining_quantity` — coupons emitted minus coupons applied
- `already_applied_to_cart` — whether this specific cart already used this coupon

Both guards must pass. The decision is atomic — no saga, no compensation:

```deql
CREATE DECISION ApplyCoupon
FOR Coupon
ON COMMAND ApplyCoupon
STATE AS
  SELECT
    COALESCE(SUM(
      CASE
        WHEN event_type = 'CouponEmitted' THEN data.quantity
        WHEN event_type = 'CouponApplied' THEN -1
        ELSE 0
      END
    ), 0) AS remaining_quantity,
    (
      SELECT COUNT(*)
      FROM DeReg."Coupon$Events"
      WHERE stream_id = :coupon_id
        AND event_type = 'CouponApplied'
        AND data.cart_id = :cart_id
    ) AS already_applied_to_cart
  FROM DeReg."Coupon$Events"
  WHERE stream_id = :coupon_id
EMIT AS
  SELECT EVENT CouponApplied (
    cart_id := :cart_id
  )
  WHERE remaining_quantity > 0 AND already_applied_to_cart = 0;
```

Notice: the Cart aggregate was never modified. The coupon feature was added entirely by registering new concepts.

## Step 4: Projections

```deql
CREATE PROJECTION CouponAvailability AS
SELECT
  stream_id AS coupon_id,
  COALESCE(SUM(
    CASE
      WHEN event_type = 'CouponEmitted' THEN data.quantity
      WHEN event_type = 'CouponApplied' THEN -1
      ELSE 0
    END
  ), 0) AS remaining
FROM DeReg."Coupon$Events"
GROUP BY stream_id;
```

## Run the Story

Admin emits 3 coupons for a summer sale:

```deql
EXECUTE EmitCoupon(coupon_id := 'SUMMER-2026', quantity := 3);

  ✓ CouponEmitted
    stream_id:     SUMMER-2026
    seq:           1
    quantity:  3
```

Alice builds her cart and applies the coupon:

```deql
EXECUTE AddItem(cart_id := 'CART-ALICE', product_id := 'WIDGET-A', quantity := 2, price := 25.00);
EXECUTE AddItem(cart_id := 'CART-ALICE', product_id := 'GADGET-B', quantity := 1, price := 75.00);

EXECUTE ApplyCoupon(cart_id := 'CART-ALICE', coupon_id := 'SUMMER-2026');

  ✓ CouponApplied
    stream_id:     SUMMER-2026
    seq:           2
    cart_id:  CART-ALICE
```

Alice tries to apply the same coupon again — rejected:

```deql
EXECUTE ApplyCoupon(cart_id := 'CART-ALICE', coupon_id := 'SUMMER-2026');

  ✗ REJECTED
    decision:  ApplyCoupon
    guard:     remaining_quantity > 0 AND already_applied_to_cart = 0
    state:     already_applied_to_cart = 1
    state:     remaining_quantity = 2
    command:   cart_id = 'CART-ALICE'
    command:   coupon_id = 'SUMMER-2026'
```

Bob and Carol each apply it successfully:

```deql
EXECUTE ApplyCoupon(cart_id := 'CART-BOB', coupon_id := 'SUMMER-2026');

  ✓ CouponApplied
    stream_id:     SUMMER-2026
    seq:           3
    cart_id:  CART-BOB

EXECUTE ApplyCoupon(cart_id := 'CART-CAROL', coupon_id := 'SUMMER-2026');

  ✓ CouponApplied
    stream_id:     SUMMER-2026
    seq:           4
    cart_id:  CART-CAROL
```

Dave tries — all 3 coupons are used up:

```deql
EXECUTE ApplyCoupon(cart_id := 'CART-DAVE', coupon_id := 'SUMMER-2026');

  ✗ REJECTED
    decision:  ApplyCoupon
    guard:     remaining_quantity > 0 AND already_applied_to_cart = 0
    state:     already_applied_to_cart = 0
    state:     remaining_quantity = 0
    command:   coupon_id = 'SUMMER-2026'
    command:   cart_id = 'CART-DAVE'
```

```deql
SELECT * FROM DeReg."CouponAvailability";

+-------------+-----------+
| coupon_id   | remaining |
+-------------+-----------+
| SUMMER-2026 | 0         |
+-------------+-----------+
```

## Why This Matters

The Cart aggregate was never touched. The coupon feature was added by:

1. Registering a new `Coupon` aggregate
2. Registering new commands and events
3. Writing one new decision with a cross-aggregate STATE AS

No existing code was modified. No saga was introduced. No compensation logic was needed.

This is what "beyond aggregates" means — aggregate boundaries protect consistency, but they don't have to block extensibility. In DeQL, new features are additive.

| Traditional Approach | DeQL Approach |
|---|---|
| Modify existing aggregate or add saga | Register new aggregate + decision |
| Coordination infrastructure | Cross-aggregate STATE AS query |
| Compensation mechanisms | Atomic guard — all-or-nothing |
| Recovery logic for crashes | Event store replay handles it |
| Existing code changes required | Zero changes to existing code |
