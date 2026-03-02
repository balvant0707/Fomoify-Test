# Webhook Fix + Store Owner Tracking Design

## Problem

1. **Webhook 404 failures** — `shop/redact` and `app/uninstalled` return 404 because `shopify.app.toml` declares URIs like `/webhooks/app/uninstalled` while the programmatic config uses `/webhooks`. Two conflicting route files (`webhooks.jsx` and `webhooks.$.jsx`) cause Remix routing failures.

2. **No store owner data persisted** — The app fetches shop name/email during auth but discards it. No database for newsletters or marketing.

## Part 1: Webhook Fix

### Changes

- **Consolidate into `webhooks.jsx`** — single handler for all topics: APP_UNINSTALLED, APP_SCOPES_UPDATE, ORDERS_CREATE, CUSTOMERS_DATA_REQUEST, CUSTOMERS_REDACT, SHOP_REDACT. Add try/catch around `authenticate.webhook`.
- **Update `shopify.app.toml`** — all webhook URIs point to `/webhooks`, add `orders/create`.
- **Delete `webhooks.$.jsx`** — eliminates the routing conflict.
- **Clean up `shopify.server.js` afterAuth** — remove duplicate welcome email logic (already handled in `auth.$.jsx`).

## Part 2: Store Owner Database

### Schema — extend existing `shop` model

New columns on `shop` table:

| Field | Type | Source |
|---|---|---|
| `ownerName` | String? | `shop.shopOwnerName` |
| `email` | String? | `shop.email` |
| `contactEmail` | String? | `shop.contactEmail` |
| `name` | String? | `shop.name` |
| `country` | String? | `shop.billingAddress.country` |
| `city` | String? | `shop.billingAddress.city` |
| `currency` | String? | `shop.currencyCode` |
| `phone` | String? | `shop.billingAddress.phone` |
| `primaryDomain` | String? | `shop.primaryDomain.host` |
| `plan` | String? | `shop.plan.displayName` |
| `status` | String (default "installed") | Computed on install/uninstall |

### Data flow

- **Install/re-auth** (`auth.$.jsx`): Expand GraphQL query, persist all fields via `upsertInstalledShop`, set `status = "installed"`.
- **Uninstall** (`webhooks.jsx`): Set `status = "uninstalled"`, `uninstalledAt = now`, `accessToken = null`.
