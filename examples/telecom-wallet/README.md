# Telecom Wallet System — DeQL Demo

A mobile operator manages subscriber balances across multiple wallet types. Every subscriber can have several wallets — main balance, promotional credits, roaming allowance, corporate pool — each following the same top-up/debit pattern but carrying different business context.

## The Wallet Story

The `wallet_aggregate` template captures the top-up/debit lifecycle once:
- 1 aggregate, 2 commands, 2 events, 2 decisions = 7 definitions per wallet type

The demo starts with 4 wallet types for a typical operator, then shows how the system grows:
- Loyalty points wallet added for a marketing campaign
- Regional roaming wallets (EU, APAC) added for market expansion

Final state: 7 wallet types, 49 definitions, all from 1 template.

## Subscriber Lifecycle

The demo walks through realistic subscriber scenarios:
- Alice (SUB-001): top-up → voice call → data pack → promo SMS
- Bob (SUB-002): enterprise user with roaming across EU and APAC
- CORP-001: shared corporate pool with employee charges

## Blocks Covered

| Block | What it does in this demo |
|---|---|
| TEMPLATE | `wallet_aggregate` — top-up/debit pattern with currency parameter |
| APPLY TEMPLATE | 7 instantiations showing incremental product growth |
| EXECUTE | Full subscriber lifecycle across Main, Promo, Roaming, CorporatePool, Loyalty, RoamingEU, RoamingAPAC |
| DESCRIBE TEMPLATE | Shows all 7 instances with their parameters |
| INSPECT | Simulated batch campaign top-ups |
| VALIDATE / EXPORT | Consistency check and reproducible output |
