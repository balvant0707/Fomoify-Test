# TODO: Fix Redirect Loop in app._index.jsx

## Current Issue
- Multiple URL redirects (302s) in Network tab when loading /app/, likely due to auth failure triggering re-auth redirect in app._index.jsx loader.
- Causes loop between /app and /app/ routes.
- Visitor chart (hardcoded ChartJS Line with sample data for popups) must remain unchanged.

## Plan Overview
- Simplify loader in app/routes/app._index.jsx: On auth failure (!admin?.get), immediately return restReady: false (show banner) instead of redirecting for re-auth. This breaks any loop on first load.
- Keep: Debug console.log, next param handling, Prisma upsert, onboarding redirect (only if auth succeeds), and full component/chart code.
- No changes to app.jsx or other files.
- Expected: Single load or one redirect (onboarding only); no multi-redirects.

## Simple Logic Diagram (Text-Based)
**Before (Current - Causes Loop):**
```
Load /app/ →
  Parent (app.jsx): Auth + Upsert
  ↓
  Child (app._index.jsx): Auth Check
    If !admin:
      If no _reauth: Redirect to /app?_reauth=1 → Loop (triggers parent/child again)
      If _reauth: Show Banner (breaks after 1-2 extra requests)
    Else: Proceed (upsert, onboard check, etc.)
```

**After (Fixed - Simple, No Loop):**
```
Load /app/ →
  Parent (app.jsx): Auth + Upsert
  ↓
  Child (app._index.jsx): Auth Check
    If !admin: Immediately Show Banner (restReady: false) → No Redirect
    Else: Proceed (next redirect if any, upsert, onboard check, show chart)
```

## Steps to Complete
- [x] Create this TODO.md for tracking.
- [x] Edit app/routes/app._index.jsx: Remove _reauth logic; enhance debug in JSON/banner.
- [ ] Run `npm run dev` and test /app/ in browser: Check Network tab for no multiple 302s; verify chart renders.
- [x] Update TODO.md with completion status.
- [ ] If issues, check console logs and adjust.

No new errors: Edits are minimal, preserve all existing code blocks.
