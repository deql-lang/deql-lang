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

## The DeQL Approach: Query Both Aggregates in One Decision

In DeQL, the `ApplyCoupon` decision queries two independent aggregate event streams in a single STATE AS clause — one from Cart, one from Coupon. No saga. No compensation. No changes to existing code.

## Step 1: The Existing Cart

```deql
CREATE AGGREGATE Cart;

CREATE COMMAND AddItem (
  cart_id    STRING,
  product_id STRING,
  quantity   INT,
  price      DECIMAL
);

CREATE EVENT ItemAdded (
  product_id STRING,
  quantity   INT,
  price      DECIMAL
);

CREATE EVENT CouponAppliedToCart (
  coupon_id STRING
);

CREATE DECISION AddItem
FOR Cart
ON COMMAND AddItem
EMIT AS
  SELECT EVENT ItemAdded (
    product_id := :product_id,
    quantity   := :quantity,
    price      := :price
  );
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
  coupon_id STRING,
  cart_id   STRING
);

CREATE EVENT CouponEmitted (
  quantity INT
);

CREATE EVENT CouponRedeemed (
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

This is the key. `ApplyCoupon` queries TWO aggregate event streams in a single STATE AS:

- `Cart$Events` — has this cart already applied a coupon?
- `Coupon$Events` — does this coupon have remaining quantity?

This mirrors the [Disintegrate](https://disintegrate-es.github.io/disintegrate/developer_journey/add_new_feature) pattern where a decision loads two state queries `(Cart, Coupon)` and checks both before emitting:

```deql
CREATE DECISION ApplyCoupon
FOR Coupon
ON COMMAND ApplyCoupon
STATE AS
  SELECT
    -- Check 1: has this cart already applied ANY coupon? (from Cart$Events)
    (
      SELECT COUNT(*)
      FROM DeReg."Cart$Events"
      WHERE stream_id = :cart_id
        AND event_type = 'CouponAppliedToCart'
    ) AS cart_has_coupon,
    -- Check 2: how many coupons remain? (from Coupon$Events)
    COALESCE(SUM(
      CASE
        WHEN event_type = 'CouponEmitted'  THEN data.quantity
        WHEN event_type = 'CouponRedeemed' THEN -1
        ELSE 0
      END
    ), 0) AS remaining_quantity
  FROM DeReg."Coupon$Events"
  WHERE stream_id = :coupon_id
EMIT AS
  SELECT EVENT CouponRedeemed (
    cart_id := :cart_id
  )
  WHERE cart_has_coupon = 0 AND remaining_quantity > 0;
```

Both guards are evaluated atomically. No saga. No compensation.

## Step 4: Mark Coupon on Cart

After a coupon is redeemed on the Coupon stream, we also record it on the Cart stream so future `ApplyCoupon` calls see `cart_has_coupon = 1`:

```deql
CREATE COMMAND MarkCouponOnCart (
  cart_id   STRING,
  coupon_id STRING
);

CREATE DECISION MarkCouponOnCart
FOR Cart
ON COMMAND MarkCouponOnCart
STATE AS
  SELECT
    COUNT(*) FILTER (WHERE event_type = 'CouponAppliedToCart') AS already_applied
  FROM DeReg."Cart$Events"
  WHERE stream_id = :cart_id
EMIT AS
  SELECT EVENT CouponAppliedToCart (
    coupon_id := :coupon_id
  )
  WHERE already_applied = 0;
```

## Step 5: Projections

```deql
CREATE PROJECTION CouponAvailability AS
SELECT
  stream_id AS coupon_id,
  COALESCE(SUM(
    CASE
      WHEN event_type = 'CouponEmitted'  THEN data.quantity
      WHEN event_type = 'CouponRedeemed' THEN -1
      ELSE 0
    END
  ), 0) AS remaining
FROM DeReg."Coupon$Events"
GROUP BY stream_id;

CREATE PROJECTION CartSummary AS
SELECT
  stream_id AS cart_id,
  COUNT(*) FILTER (WHERE event_type = 'ItemAdded') AS item_count,
  LAST(data.coupon_id) AS applied_coupon
FROM DeReg."Cart$Events"
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

Alice builds her cart and applies the coupon (two steps — redeem then mark):

```deql
EXECUTE AddItem(cart_id := 'CART-ALICE', product_id := 'WIDGET-A', quantity := 2, price := 25.00);
EXECUTE AddItem(cart_id := 'CART-ALICE', product_id := 'GADGET-B', quantity := 1, price := 75.00);

EXECUTE ApplyCoupon(coupon_id := 'SUMMER-2026', cart_id := 'CART-ALICE');

  ✓ CouponRedeemed
    stream_id:     SUMMER-2026
    seq:           2
    cart_id:  CART-ALICE

EXECUTE MarkCouponOnCart(cart_id := 'CART-ALICE', coupon_id := 'SUMMER-2026');

  ✓ CouponAppliedToCart
    stream_id:     CART-ALICE
    seq:           3
    coupon_id:  SUMMER-2026
```

Alice tries to apply the same coupon again — rejected (cart already has a coupon):

```deql
EXECUTE ApplyCoupon(coupon_id := 'SUMMER-2026', cart_id := 'CART-ALICE');

  ✗ REJECTED
    decision:  ApplyCoupon
    guard:     cart_has_coupon = 0 AND remaining_quantity > 0
    state:     remaining_quantity = 2
    state:     cart_has_coupon = 1
    command:   coupon_id = 'SUMMER-2026'
    command:   cart_id = 'CART-ALICE'
```

Bob and Carol each apply it successfully:

```deql
EXECUTE ApplyCoupon(coupon_id := 'SUMMER-2026', cart_id := 'CART-BOB');

  ✓ CouponRedeemed
    stream_id:     SUMMER-2026
    seq:           3
    cart_id:  CART-BOB

EXECUTE MarkCouponOnCart(cart_id := 'CART-BOB', coupon_id := 'SUMMER-2026');

EXECUTE ApplyCoupon(coupon_id := 'SUMMER-2026', cart_id := 'CART-CAROL');

  ✓ CouponRedeemed
    stream_id:     SUMMER-2026
    seq:           4
    cart_id:  CART-CAROL

EXECUTE MarkCouponOnCart(cart_id := 'CART-CAROL', coupon_id := 'SUMMER-2026');
```

Dave tries — all 3 coupons are used up:

```deql
EXECUTE ApplyCoupon(coupon_id := 'SUMMER-2026', cart_id := 'CART-DAVE');

  ✗ REJECTED
    decision:  ApplyCoupon
    guard:     cart_has_coupon = 0 AND remaining_quantity > 0
    state:     remaining_quantity = 0
    state:     cart_has_coupon = 0
    command:   cart_id = 'CART-DAVE'
    command:   coupon_id = 'SUMMER-2026'
```

## Query Projections

```deql
SELECT * FROM DeReg."CouponAvailability";

+-------------+-----------+
| coupon_id   | remaining |
+-------------+-----------+
| SUMMER-2026 | 0         |
+-------------+-----------+
```

```deql
SELECT * FROM DeReg."CartSummary";

+------------+------------+----------------+
| cart_id    | item_count | applied_coupon |
+------------+------------+----------------+
| CART-ALICE | 2          | SUMMER-2026    |
| CART-BOB   | 0          | SUMMER-2026    |
| CART-CAROL | 0          | SUMMER-2026    |
+------------+------------+----------------+
```

## Why This Matters

The Cart aggregate was never modified. The coupon feature was added by:

1. Registering a new `Coupon` aggregate with its own events
2. Writing one cross-aggregate decision that queries both `Cart$Events` and `Coupon$Events`
3. Adding a `MarkCouponOnCart` decision to record the coupon on the Cart stream

No existing code was changed. No saga was introduced. No compensation logic was needed.

| Traditional Approach | DeQL Approach |
|---|---|
| Modify existing aggregate or add saga | Register new aggregate + cross-aggregate decision |
| Coordination infrastructure | Single STATE AS query across two event streams |
| Compensation mechanisms | Atomic guard — all-or-nothing |
| Recovery logic for crashes | Event store replay handles it |
| Existing code changes required | Zero changes to existing Cart code |
