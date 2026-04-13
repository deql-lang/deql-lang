---
title: "Telecom Wallet"
description: "A multi-wallet telecom billing system — one template, unlimited wallet types, each with top-up and debit mechanics."
---

A mobile operator manages subscriber balances across multiple wallet types: main balance, promotional credits, roaming allowance, corporate pool. Each wallet follows the same top-up/debit pattern. The `wallet_aggregate` template captures this once — adding a new wallet type is a single `APPLY TEMPLATE` call.

## The Template — wallet_aggregate

Every wallet type needs: 1 aggregate, 2 commands (TopUp, Debit), 2 events (ToppedUp, Debited), 2 decisions. Each `APPLY` generates 7 definitions:

```deql
CREATE TEMPLATE wallet_aggregate (WalletName, Currency) AS (

    CREATE AGGREGATE {{WalletName}}Wallet;

    CREATE COMMAND TopUp{{WalletName}} (
        wallet_id STRING,
        amount    DECIMAL(12,2)
    );

    CREATE COMMAND Debit{{WalletName}} (
        wallet_id STRING,
        amount    DECIMAL(12,2),
        reason    STRING
    );

    CREATE EVENT {{WalletName}}WalletToppedUp (
        amount DECIMAL(12,2)
    );

    CREATE EVENT {{WalletName}}WalletDebited (
        amount DECIMAL(12,2),
        reason STRING
    );

    CREATE DECISION TopUp{{WalletName}}Wallet
    FOR {{WalletName}}Wallet
    ON COMMAND TopUp{{WalletName}}
    EMIT AS
        SELECT EVENT {{WalletName}}WalletToppedUp (
            amount := :amount
        )
        WHERE :amount > 0;

    CREATE DECISION Debit{{WalletName}}Wallet
    FOR {{WalletName}}Wallet
    ON COMMAND Debit{{WalletName}}
    EMIT AS
        SELECT EVENT {{WalletName}}WalletDebited (
            amount := :amount,
            reason := :reason
        )
        WHERE :amount > 0;
);
```

## Apply — Four Wallet Types

```deql
APPLY TEMPLATE wallet_aggregate WITH (WalletName = 'Main', Currency = 'USD');
APPLY TEMPLATE wallet_aggregate WITH (WalletName = 'Promo', Currency = 'USD');
APPLY TEMPLATE wallet_aggregate WITH (WalletName = 'Roaming', Currency = 'USD');
APPLY TEMPLATE wallet_aggregate WITH (WalletName = 'CorporatePool', Currency = 'USD');
```

Four lines. 28 definitions. Four complete wallet systems.

## Subscriber Lifecycle Story

Alice (SUB-001) activates with a top-up and gets a promo credit:

```deql
EXECUTE TopUpMain(wallet_id := 'SUB-001', amount := 50.00);

  ✓ MainWalletToppedUp
    stream_id:     SUB-001
    seq:           1
    amount:  50

EXECUTE TopUpPromo(wallet_id := 'SUB-001', amount := 10.00);

  ✓ PromoWalletToppedUp
    stream_id:     SUB-001
    seq:           1
    amount:  10
```

Alice makes calls and buys data packs:

```deql
EXECUTE DebitMain(wallet_id := 'SUB-001', amount := 5.00, reason := 'voice_call_5min');

  ✓ MainWalletDebited
    stream_id:     SUB-001
    seq:           2
    amount:  5
    reason:  voice_call_5min

EXECUTE DebitMain(wallet_id := 'SUB-001', amount := 15.00, reason := 'data_pack_1gb');
EXECUTE DebitPromo(wallet_id := 'SUB-001', amount := 3.50, reason := 'sms_bundle_100');
```

Bob (SUB-002) is an enterprise user with roaming:

```deql
EXECUTE TopUpMain(wallet_id := 'SUB-002', amount := 100.00);
EXECUTE TopUpRoaming(wallet_id := 'SUB-002', amount := 75.00);

EXECUTE DebitRoaming(wallet_id := 'SUB-002', amount := 25.00, reason := 'roaming_data_eu');

  ✓ RoamingWalletDebited
    stream_id:     SUB-002
    seq:           2
    amount:  25
    reason:  roaming_data_eu

EXECUTE DebitRoaming(wallet_id := 'SUB-002', amount := 30.00, reason := 'roaming_data_asia');
```

Corporate pool for enterprise account:

```deql
EXECUTE TopUpCorporatePool(wallet_id := 'CORP-001', amount := 5000.00);

  ✓ CorporatePoolWalletToppedUp
    stream_id:     CORP-001
    seq:           1
    amount:  5000

EXECUTE DebitCorporatePool(wallet_id := 'CORP-001', amount := 150.00, reason := 'employee_alice_intl_call');
EXECUTE DebitCorporatePool(wallet_id := 'CORP-001', amount := 200.00, reason := 'employee_bob_data_roaming');
EXECUTE DebitCorporatePool(wallet_id := 'CORP-001', amount := 75.00, reason := 'employee_carol_sms');
```

## The Extensibility Story

Marketing launches a loyalty points program. One `APPLY` call:

```deql
APPLY TEMPLATE wallet_aggregate WITH (WalletName = 'Loyalty', Currency = 'PTS');

  Template 'wallet_aggregate' expanded: 7 definitions generated
    (AGGREGATE LoyaltyWallet, COMMAND TopUpLoyalty, COMMAND DebitLoyalty, ...)
```

Immediately usable:

```deql
EXECUTE TopUpLoyalty(wallet_id := 'SUB-001', amount := 500.00);

  ✓ LoyaltyWalletToppedUp
    stream_id:     SUB-001
    seq:           1
    amount:  500

EXECUTE DebitLoyalty(wallet_id := 'SUB-001', amount := 100.00, reason := 'redeem_data_pack');

  ✓ LoyaltyWalletDebited
    stream_id:     SUB-001
    seq:           2
    amount:  100
    reason:  redeem_data_pack
```

The operator expands to new regions — each gets its own roaming wallet with a different currency:

```deql
APPLY TEMPLATE wallet_aggregate WITH (WalletName = 'RoamingEU', Currency = 'EUR');
APPLY TEMPLATE wallet_aggregate WITH (WalletName = 'RoamingAPAC', Currency = 'SGD');

EXECUTE TopUpRoamingEU(wallet_id := 'SUB-002', amount := 50.00);
EXECUTE DebitRoamingEU(wallet_id := 'SUB-002', amount := 12.50, reason := 'roaming_data_france');

  ✓ RoamingEUWalletToppedUp
    stream_id:     SUB-002
    seq:           1
    amount:  50

  ✓ RoamingEUWalletDebited
    stream_id:     SUB-002
    seq:           2
    amount:  12.5
    reason:  roaming_data_france

EXECUTE TopUpRoamingAPAC(wallet_id := 'SUB-002', amount := 80.00);
EXECUTE DebitRoamingAPAC(wallet_id := 'SUB-002', amount := 20.00, reason := 'roaming_data_singapore');

  ✓ RoamingAPACWalletToppedUp
    stream_id:     SUB-002
    seq:           1
    amount:  80

  ✓ RoamingAPACWalletDebited
    stream_id:     SUB-002
    seq:           2
    amount:  20
    reason:  roaming_data_singapore
```

Final state: 7 wallet types, 49 definitions, all from 1 template.

## Inspect — Simulate Campaign Top-ups

```deql
CREATE TABLE campaign_topups AS VALUES
    ('SUB-100', 25.00),
    ('SUB-101', 25.00),
    ('SUB-102', 25.00);

INSPECT DECISION TopUpPromoWallet
FROM campaign_topups
INTO simulated_promo_topups;

  INSPECT DECISION → 3 event(s) emitted, 0 rejected → simulated_promo_topups

SELECT stream_id, event_type, data FROM simulated_promo_topups;

+-----------+---------------------+-----------------+
| stream_id | event_type          | data            |
+-----------+---------------------+-----------------+
| SUB-100   | PromoWalletToppedUp | {amount: 25.00} |
| SUB-101   | PromoWalletToppedUp | {amount: 25.00} |
| SUB-102   | PromoWalletToppedUp | {amount: 25.00} |
+-----------+---------------------+-----------------+
```

## What This Demonstrates

- **Template reuse at scale** — 7 wallet types from 1 template, 49 definitions total
- **Incremental growth** — start with 4 wallets, add Loyalty, then regional roaming — no existing code changes
- **Domain-specific naming** — `TopUpMain`, `DebitRoamingEU`, `LoyaltyWalletDebited` — all generated from parameters
- **Guards in templates** — `WHERE :amount > 0` is inherited by every wallet type
- **INSPECT** for simulating batch campaign top-ups without side effects
