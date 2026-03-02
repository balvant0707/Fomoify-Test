# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Shopify embedded app for sales conversion through social proof popups:
- Recent purchase notifications (FOMO)
- Flash sale countdown bars (urgency)
- Visitor activity alerts

**Stack:** Remix 2.17 + React 18 + Prisma 6 + MySQL + Shopify Polaris 12

## Common Commands

```bash
npm run dev              # Start Remix dev server
npm run build            # Generate Prisma client + build Remix
npm run lint             # ESLint with cache
npm run setup            # Generate Prisma + deploy migrations
npx prisma db push       # Push schema changes (use instead of migrate for P3014 errors)
npm run graphql-codegen  # Generate GraphQL types
```

## Architecture

### Route Structure (Remix)
- `app/routes/app.jsx` - Admin shell with navigation, handles parent auth
- `app/routes/app._index.jsx` - Dashboard home with theme installation
- `app/routes/app.notification.*.jsx` - Notification configuration pages (recent, flash, visitor)
- `app/routes/proxy.fomo.$subpath.jsx` - API proxy for storefront (`/apps/fomo/*`)
- `app/routes/webhooks.$.jsx` - Shopify webhook handlers (uninstall, GDPR, scopes)
- `app/routes/auth.$.jsx` - OAuth flow

### Key Patterns
- **Session storage:** PrismaSessionStorage with offline sessions (`offline_<shop>`)
- **Shop backfill:** `ensureShop.server.js` creates shop rows from session if missing
- **Caching:** `serverCache.server.js` provides TTL-based memory cache
- **Path alias:** `~/*` maps to `app/*`

### Theme Extension
`extensions/fomo-popup/` contains:
- `assets/m2fomos.js` - Self-contained frontend script (~500 lines) injected into storefronts
- `blocks/*.liquid` - Theme app embed blocks

The frontend script fetches config from `/apps/fomo/popup?shop=...` and renders popups.

### Data Flow
1. Merchant configures popup in admin UI → saves to `notificationconfig` table
2. Storefront loads theme extension script
3. Script calls `/apps/fomo/popup` → returns config from DB
4. Script renders DOM popups with real order data

## Database

Three Prisma models in MySQL:
- `notificationconfig` - Popup settings per shop (indexed on `[shop, key]`)
- `session` - Shopify OAuth sessions
- `shop` - Installation tracking

Key fields in `notificationconfig`:
- `key`: "recent" or "flash" (popup type)
- `*Json` fields: Store JSON arrays (products, locations, names)
- `orderDays`: Default 7, controls order recency filter

## Known Issues

**TODO.md:** Redirect loop in `app._index.jsx` - the `_reauth` parameter logic should be removed. On auth failure, return `restReady: false` immediately instead of redirecting.

## Environment

Required in `.env`:
- `DATABASE_URL` / `SHADOW_DATABASE_URL` - MySQL connection (URL-encoded special chars: `%25` for `%`, `%23` for `#`)
- Shopify app credentials (API key, secret, scopes)

## Shopify Specifics

- API version: 2025-01
- Scopes: read/write products, themes, script_tags, customers, orders
- Webhooks: APP_UNINSTALLED, GDPR (3 types), APP_SCOPES_UPDATE
- Distribution: App Store (not custom)
