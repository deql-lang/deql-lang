---
title: Telecom Wallet
description: Multi-wallet system with top-up, debit, and balance guards — a complete DeQL example.
---

A telecom billing example demonstrating how the `wallet_aggregate` template enables multiple wallet types per subscriber — each with the same top-up/debit mechanics but different business context.

## Domain

A mobile operator manages subscriber balances across multiple wallet types:

- Main — primary prepaid/postpaid balance
- Promo — promotional credits from campaigns
- Roaming — dedicated roaming allowance
- CorporatePool — shared balance for enterprise accounts

Each wallet supports top-up (credit) and debit (charge) operations. Debits are guarded by a balance check.

## Files

| File | Description |
|---|---|
| `template.deql` | The reusable `wallet_aggregate` template |
| `wallets.deql` | Instantiations for Main, Promo, Roaming, CorporatePool |
| `projections.deql` | Read models for balance dashboard and transaction history |
| `eventstore.deql` | Storage configuration |
| `inspect.deql` | Tests covering top-ups, debits, guards, and projections |

## Running
Coming soon ...